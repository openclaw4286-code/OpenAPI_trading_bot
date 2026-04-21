"""Quant screener: hard filter → 6-factor percentile weighted sum → top-N.

Run once per trading day (08:00 KST by default). The surviving top-N is
written to `state/daily_universe.json` by `data.universe` and held fixed
intraday.

Input: a list of QuantCandidate objects prepared by the caller. Each
candidate carries live KIS price/cap/PER/PBR, an OHLCV daily DataFrame,
fundamentals (DART/CSV) and listing/exclusion flags.

Output: ranked list of ScreenResult capped at `cfg.UNIVERSE_TOP_N`.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd

from .. import config as cfg
from .fundamentals import Fundamentals


log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class QuantCandidate:
    ticker: str
    name: str
    price: float
    market_cap_krw: float
    per: float | None
    pbr: float | None
    daily: pd.DataFrame               # index ts, cols open/high/low/close/volume
    fundamentals: Fundamentals
    is_etf_etn: bool = False
    is_admin: bool = False
    is_halted: bool = False


@dataclass
class ScreenResult:
    ticker: str
    name: str
    score: float
    factors: dict[str, float]         # percentile [0..1] per factor
    raw: dict[str, float | None]      # unscaled values (for logs/debug)
    reason: str = ""                  # populated only for drops


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _percentile_rank(series: pd.Series) -> pd.Series:
    """Ascending percentile rank in [0, 1]; NaN is pushed to 0 (penalty)."""
    return series.rank(pct=True, ascending=True, na_option="bottom").fillna(0.0)


# ---------------------------------------------------------------------------
# Raw factor extraction
# ---------------------------------------------------------------------------
def _momentum(daily: pd.DataFrame) -> float | None:
    """R3M + R6M + R12M, with -0.5 penalty when 1M return is negative."""
    if daily.empty or "close" not in daily.columns:
        return None
    close = daily["close"].astype(float)
    n = len(close)

    def ret(days: int) -> float | None:
        if n <= days:
            return None
        p0 = close.iloc[-days - 1]
        if p0 <= 0:
            return None
        return close.iloc[-1] / p0 - 1

    r1m  = ret(21)
    parts = [r for r in (ret(63), ret(126), ret(252)) if r is not None]
    if not parts:
        return None
    score = sum(parts)
    if r1m is not None and r1m < 0:
        score -= 0.5
    return score


def _volume_ratio(daily: pd.DataFrame) -> float | None:
    """Short/Long 거래대금 ratio."""
    short_w = int(cfg.QUANT_VOLUME_WINDOW_SHORT)
    long_w = int(cfg.QUANT_VOLUME_WINDOW_LONG)
    if daily.empty or len(daily) < long_w:
        return None
    close = daily["close"].astype(float)
    vol = daily["volume"].astype(float)
    turnover = close * vol
    short = turnover.tail(short_w).mean()
    long_ = turnover.tail(long_w).mean()
    if long_ <= 0:
        return None
    return float(short / long_)


def _vol_adj_return(daily: pd.DataFrame) -> float | None:
    w = int(cfg.QUANT_VOL_ADJ_RET_WINDOW)
    if daily.empty or len(daily) < w + 1:
        return None
    close = daily["close"].astype(float).iloc[-(w + 1):]
    rets = close.pct_change().dropna()
    std = rets.std(ddof=0)
    if std == 0 or np.isnan(std):
        return None
    total = close.iloc[-1] / close.iloc[0] - 1
    return float(total / std)


def _value(f: Fundamentals) -> float | None:
    """Higher is cheaper: mean of (1/PER, 1/PBR, 1/PSR) over available, positive multiples."""
    inv: list[float] = []
    for x in (f.per, f.pbr, f.psr):
        if x is None or x <= 0:
            continue
        inv.append(1.0 / x)
    if not inv:
        return None
    return float(sum(inv) / len(inv))


def _quality(f: Fundamentals) -> float | None:
    parts: list[float] = []
    if f.roe is not None:
        parts.append(float(f.roe))
    if f.op_margin is not None:
        parts.append(float(f.op_margin))
    if f.debt_ratio is not None:
        parts.append(-float(f.debt_ratio))
    if not parts:
        return None
    return sum(parts) / len(parts)


def _growth(f: Fundamentals) -> float | None:
    parts: list[float] = []
    if f.revenue_yoy is not None:
        parts.append(float(f.revenue_yoy))
    if f.op_yoy is not None:
        parts.append(float(f.op_yoy))
    if not parts:
        return None
    return sum(parts) / len(parts)


# ---------------------------------------------------------------------------
# Hard filter
# ---------------------------------------------------------------------------
def _hard_filter(c: QuantCandidate) -> tuple[bool, str]:
    hf = cfg.HARD_FILTER
    if c.is_etf_etn and bool(hf["exclude_etf_etn"]):
        return False, "etf_etn"
    if (c.is_admin or c.is_halted) and bool(hf["exclude_admin_halt"]):
        return False, "admin_halt"
    if c.market_cap_krw < float(hf["min_market_cap_krw"]):
        return False, "market_cap"
    if c.daily.empty:
        return False, "no_daily"
    vol20 = c.daily["volume"].tail(cfg.QUANT_VOLUME_WINDOW_SHORT).mean()
    if vol20 < float(hf["min_avg_volume_20d_shares"]):
        return False, "volume"
    needed_bars = 21 * int(hf["exclude_listed_months_below"])
    if len(c.daily) < needed_bars:
        return False, "listed_too_recent"
    return True, ""


# ---------------------------------------------------------------------------
# Screen
# ---------------------------------------------------------------------------
_FACTORS = ("momentum", "value", "quality", "volume", "vol_adj_ret", "growth")


def screen(candidates: Iterable[QuantCandidate]) -> list[ScreenResult]:
    candidates = list(candidates)
    survivors: list[QuantCandidate] = []
    drops: dict[str, int] = {}
    for c in candidates:
        ok, reason = _hard_filter(c)
        if not ok:
            drops[reason] = drops.get(reason, 0) + 1
            continue
        survivors.append(c)
    log.info(
        "hard-filter kept %d/%d (drops=%s)",
        len(survivors), len(candidates), drops,
    )
    if not survivors:
        return []

    raw = pd.DataFrame({
        "ticker":      [c.ticker for c in survivors],
        "momentum":    [_momentum(c.daily) for c in survivors],
        "volume":      [_volume_ratio(c.daily) for c in survivors],
        "vol_adj_ret": [_vol_adj_return(c.daily) for c in survivors],
        "value":       [_value(c.fundamentals) for c in survivors],
        "quality":     [_quality(c.fundamentals) for c in survivors],
        "growth":      [_growth(c.fundamentals) for c in survivors],
    })

    pct = pd.DataFrame({"ticker": raw["ticker"]})
    for col in _FACTORS:
        pct[col] = _percentile_rank(raw[col])

    w = cfg.FACTOR_WEIGHTS
    score = sum(pct[col] * float(w[col]) for col in _FACTORS)

    results: list[ScreenResult] = []
    for i, c in enumerate(survivors):
        results.append(ScreenResult(
            ticker=c.ticker,
            name=c.name,
            score=float(score.iloc[i]),
            factors={col: float(pct[col].iloc[i]) for col in _FACTORS},
            raw={
                col: (None if pd.isna(raw[col].iloc[i]) else float(raw[col].iloc[i]))
                for col in _FACTORS
            },
        ))
    results.sort(key=lambda r: r.score, reverse=True)
    return results[: int(cfg.UNIVERSE_TOP_N)]
