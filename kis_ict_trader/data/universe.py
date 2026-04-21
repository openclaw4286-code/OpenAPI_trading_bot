"""Daily universe: fetch candidate inputs, run quant screener, persist top-N.

Candidate tickers are supplied by a user-prepared CSV at
`data/cache/krx_tickers.csv` with columns:

    ticker, name, market, is_etf_etn

(columns `market` and `is_etf_etn` are optional; `ticker` is zero-padded
to 6 digits on load). KIS OpenAPI does not expose a straightforward
"all-listed" endpoint, so this is the most reliable source.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

from .. import config as cfg
from ..execution.kis_client import KISClient
from .fetcher import get_current_price, get_daily_ohlcv
from .fundamentals import Fundamentals, get_fundamentals
from .quant_screener import QuantCandidate, ScreenResult, screen


log = logging.getLogger(__name__)

CACHE_TICKERS_CSV = cfg.DIR_DATA_CACHE / "krx_tickers.csv"


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
def load_daily_universe(path: Path | None = None) -> dict | None:
    """Return the persisted universe JSON, or None if missing/corrupt."""
    p = path or cfg.PATH_DAILY_UNIVERSE
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text("utf-8"))
    except Exception as e:
        log.warning("failed to read %s: %s", p, e)
        return None


def save_daily_universe(
    entries: list[ScreenResult],
    path: Path | None = None,
) -> Path:
    """Atomically write `entries` to daily_universe.json."""
    p = path or cfg.PATH_DAILY_UNIVERSE
    payload = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "built_at": datetime.now().isoformat(timespec="seconds"),
        "top_n": int(cfg.UNIVERSE_TOP_N),
        "entries": [
            {
                "ticker":  e.ticker,
                "name":    e.name,
                "score":   e.score,
                "factors": e.factors,
                "raw":     e.raw,
            }
            for e in entries
        ],
    }
    tmp = p.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), "utf-8"
    )
    tmp.replace(p)
    return p


# ---------------------------------------------------------------------------
# Candidate tickers CSV
# ---------------------------------------------------------------------------
def load_candidate_tickers(path: Path | None = None) -> pd.DataFrame:
    p = path or CACHE_TICKERS_CSV
    if not p.exists():
        raise FileNotFoundError(
            f"Candidate tickers CSV not found at {p}. "
            "Prepare a KRX list with columns: ticker, name, "
            "market (KOSPI/KOSDAQ), is_etf_etn."
        )
    df = pd.read_csv(p, dtype={"ticker": str})
    if "ticker" not in df.columns or "name" not in df.columns:
        raise ValueError(
            f"{p} missing required columns 'ticker' and/or 'name'"
        )
    if "market" not in df.columns:
        df["market"] = ""
    if "is_etf_etn" not in df.columns:
        df["is_etf_etn"] = False
    df["ticker"] = df["ticker"].astype(str).str.zfill(6)
    df["is_etf_etn"] = df["is_etf_etn"].fillna(False).astype(bool)
    return df


# ---------------------------------------------------------------------------
# Per-candidate assembly
# ---------------------------------------------------------------------------
def _float_or_none(s) -> float | None:
    if s is None or s == "" or s == "-":
        return None
    try:
        return float(str(s).replace(",", ""))
    except ValueError:
        return None


def _parse_market_cap_krw(price_info: dict) -> float:
    """KIS `hts_avls` is quoted in 억원 (1e8 KRW)."""
    raw = price_info.get("hts_avls")
    try:
        return float(str(raw).replace(",", "")) * 100_000_000
    except (TypeError, ValueError):
        return 0.0


def _exclusion_flags(
    price_info: dict, row: dict
) -> tuple[bool, bool, bool]:
    mrkt = str(price_info.get("mrkt_warn_cls_code") or "")
    trht = str(price_info.get("trht_yn") or "")
    iscd = str(price_info.get("iscd_stat_cls_code") or "")
    # KIS 관리/경고/위험 (01/02/03) or 상태코드 51~59
    is_admin = mrkt in ("01", "02", "03") or iscd in (
        "51", "52", "53", "54", "55", "57", "58", "59"
    )
    is_halted = trht == "Y"
    is_etf = bool(row.get("is_etf_etn", False))
    name = str(row.get("name", ""))
    if not is_etf and ("ETF" in name.upper() or "ETN" in name.upper()):
        is_etf = True
    return is_etf, is_admin, is_halted


async def _build_one(
    client: KISClient,
    row: dict,
    *,
    daily_start: str,
    daily_end: str,
    sem: asyncio.Semaphore,
) -> QuantCandidate | None:
    ticker = row["ticker"]
    name = row["name"]
    async with sem:
        try:
            price = await get_current_price(client, ticker)
        except Exception as e:
            log.warning("price fetch failed %s: %s", ticker, e)
            return None
        try:
            daily = await get_daily_ohlcv(
                client, ticker, daily_start, daily_end
            )
        except Exception as e:
            log.warning("daily fetch failed %s: %s", ticker, e)
            return None

    price_val = _float_or_none(price.get("stck_prpr")) or 0.0
    market_cap = _parse_market_cap_krw(price)
    per = _float_or_none(price.get("per"))
    pbr = _float_or_none(price.get("pbr"))

    try:
        fundamentals = await get_fundamentals(
            ticker,
            market_cap_krw=market_cap,
            kis_per=per,
            kis_pbr=pbr,
        )
    except Exception as e:
        log.warning("fundamentals failed %s: %s", ticker, e)
        fundamentals = Fundamentals(ticker=ticker, per=per, pbr=pbr)

    is_etf, is_admin, is_halted = _exclusion_flags(price, row)
    return QuantCandidate(
        ticker=ticker,
        name=name,
        price=price_val,
        market_cap_krw=market_cap,
        per=per,
        pbr=pbr,
        daily=daily,
        fundamentals=fundamentals,
        is_etf_etn=is_etf,
        is_admin=is_admin,
        is_halted=is_halted,
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
async def build_daily_universe(
    client: KISClient,
    tickers_df: pd.DataFrame | None = None,
    *,
    concurrency: int = 10,
    lookback_days: int = 400,
    persist: bool = True,
) -> list[ScreenResult]:
    """Collect candidate inputs concurrently, rank, optionally persist."""
    tickers_df = (
        tickers_df if tickers_df is not None else load_candidate_tickers()
    )
    end = date.today()
    start = end - timedelta(days=lookback_days)
    daily_start = start.strftime("%Y%m%d")
    daily_end = end.strftime("%Y%m%d")

    sem = asyncio.Semaphore(max(1, int(concurrency)))
    tasks = [
        _build_one(
            client,
            row.to_dict(),
            daily_start=daily_start,
            daily_end=daily_end,
            sem=sem,
        )
        for _, row in tickers_df.iterrows()
    ]
    results = await asyncio.gather(*tasks)
    candidates = [c for c in results if c is not None]
    log.info(
        "universe build: %d/%d candidates assembled",
        len(candidates), len(tickers_df),
    )

    ranked = screen(candidates)
    if persist:
        save_daily_universe(ranked)
        log.info(
            "universe saved to %s (top %d)",
            cfg.PATH_DAILY_UNIVERSE, len(ranked),
        )
    return ranked
