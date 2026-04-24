"""ICT strategy engine: MtfConfluence → TradeSignal (+ lifecycle gate).

Input : `signals.ictsignals.MtfConfluence` plus the LTF DataFrame and
        a per-symbol `SignalGate`.
Output: `SignalDecision` that either carries a `TradeSignal` or a
        `wait` / `reject` reason. All tunables come from `cfg.ICT`.

Contract with downstream code:
- TradeSignal.targets = [R1 (=1R), R2 (=rr_min_default R), R3 (=rr_strong R)].
- `stop` is always on the losing side of `entry` (guaranteed by a sanity
  check that rejects the signal otherwise).
- Bearish signals are emitted only when cfg.ALLOW_SHORT is True; otherwise
  they become rejects so the event is logged but never routed to orders.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import Literal

import pandas as pd

from .. import config as cfg
from ..signals.ictsignals import Direction, MtfConfluence

log = logging.getLogger(__name__)

MARKET_CLOSE_GUARD_MIN: int = 30


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class TradeSignal:
    symbol: str
    direction: Direction
    entry: float
    stop: float
    targets: list[float]                   # [R1, R2, R3]
    rr: float                              # realized R multiple to R2
    poi_kind: str | None                   # "FVG" | "OB" | None
    trigger_kind: str                      # "BOS" | "CHoCH"
    session: str
    ts: pd.Timestamp
    meta: dict = field(default_factory=dict)


Outcome = Literal["signal", "wait", "reject"]


@dataclass
class SignalDecision:
    signal: TradeSignal | None
    outcome: Outcome
    reason: str = ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _parse_hhmm(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def _is_near_close(
    now_ts: pd.Timestamp, guard_min: int = MARKET_CLOSE_GUARD_MIN
) -> bool:
    close_t = _parse_hhmm(cfg.SESSION_CLOSE)
    close_dt = datetime.combine(now_ts.date(), close_t)
    guard_start = close_dt - timedelta(minutes=guard_min)
    now_naive = now_ts.to_pydatetime().replace(tzinfo=None)
    return guard_start <= now_naive < close_dt


def _compute_stop(
    conf: MtfConfluence, entry: float, tick_size: float
) -> tuple[float, str]:
    """Return (stop_price, sl_method).

    sl_method is "poi" when the stop sits just beyond the POI range, or
    "fallback" when no valid POI-based stop exists (or it sits too close
    to entry) — in that case we use `cfg.ICT["sl_pct_fallback"]`.
    """
    fallback_pct = float(cfg.ICT["sl_pct_fallback"])
    min_gap = entry * 5e-4                          # 0.05% safety margin

    if conf.poi_level is None:
        if conf.direction == "bull":
            return entry * (1.0 - fallback_pct), "fallback"
        return entry * (1.0 + fallback_pct), "fallback"

    lo, hi = conf.poi_level
    tol = float(cfg.ICT["fvg_ce_tolerance_ticks"]) * max(tick_size, 0.0)

    if conf.direction == "bull":
        candidate = min(lo, entry) - tol
        if entry - candidate < min_gap:
            return entry * (1.0 - fallback_pct), "fallback"
        return candidate, "poi"

    candidate = max(hi, entry) + tol
    if candidate - entry < min_gap:
        return entry * (1.0 + fallback_pct), "fallback"
    return candidate, "poi"


def _compute_targets(
    entry: float, stop: float, direction: Direction
) -> list[float]:
    rr_default = float(cfg.ICT["rr_min_default"])
    rr_strong = float(cfg.ICT["rr_min_strong"])
    r = abs(entry - stop)
    if direction == "bull":
        return [entry + r, entry + r * rr_default, entry + r * rr_strong]
    return [entry - r, entry - r * rr_default, entry - r * rr_strong]


def _min_rr_for(poi_kind: str | None) -> float:
    if poi_kind in ("FVG", "OB"):
        return float(cfg.ICT["rr_min_with_poi"])
    return float(cfg.ICT["rr_min_default"])


# ---------------------------------------------------------------------------
# Signal lifecycle gate
# ---------------------------------------------------------------------------
class SignalGate:
    """Tracks cooldown and wait-streak per symbol in-process.

    - cooldown: after emitting a signal, block further signals for
      `cfg.ICT["signal_cooldown_min"]` minutes.
    - wait streak: if we return `wait` `cfg.ICT["wait_streak_block"]`
      times in a row for a symbol, the next evaluation is blocked
      outright so we stop burning evaluation budget on a dead setup.
    """

    def __init__(self) -> None:
        self._last_signal_ts: dict[str, pd.Timestamp] = {}
        self._wait_streak: dict[str, int] = {}

    def is_blocked(
        self, symbol: str, now_ts: pd.Timestamp
    ) -> tuple[bool, str]:
        cd = int(cfg.ICT["signal_cooldown_min"])
        streak_limit = int(cfg.ICT["wait_streak_block"])
        last = self._last_signal_ts.get(symbol)
        if last is not None:
            delta_min = (now_ts - last).total_seconds() / 60.0
            if delta_min < cd:
                return True, f"cooldown ({delta_min:.1f}/{cd}m)"
        streak = self._wait_streak.get(symbol, 0)
        if streak >= streak_limit:
            return True, f"wait_streak({streak}>={streak_limit})"
        return False, ""

    def register(
        self, symbol: str, outcome: Outcome, now_ts: pd.Timestamp
    ) -> None:
        if outcome == "signal":
            self._last_signal_ts[symbol] = now_ts
            self._wait_streak[symbol] = 0
        elif outcome == "wait":
            self._wait_streak[symbol] = self._wait_streak.get(symbol, 0) + 1
        # rejects: leave state untouched — rejects are deterministic filter
        # decisions, not market-data-driven misses.

    def reset(self, symbol: str | None = None) -> None:
        if symbol is None:
            self._last_signal_ts.clear()
            self._wait_streak.clear()
        else:
            self._last_signal_ts.pop(symbol, None)
            self._wait_streak.pop(symbol, None)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def build_signal(
    symbol: str,
    conf: MtfConfluence,
    ltf: pd.DataFrame,
    tick_size: float = 0.0,
    now_ts: pd.Timestamp | None = None,
    gate: SignalGate | None = None,
) -> SignalDecision:
    """Transform an MTF confluence into an actionable TradeSignal.

    Decision order:
      1. gate cooldown / wait-streak   → reject
      2. no confluence                 → wait
      3. short disabled                → reject
      4. near market close (prod only) → reject
      5. invalid/zero-risk stop        → reject
      6. R:R below threshold           → wait
      7. emit TradeSignal              → signal
    """
    if now_ts is None:
        now_ts = ltf.index[-1] if not ltf.empty else pd.Timestamp.now()

    if gate is not None:
        blocked, why = gate.is_blocked(symbol, now_ts)
        if blocked:
            return SignalDecision(None, "reject", f"gate:{why}")

    def _finalize(dec: SignalDecision) -> SignalDecision:
        if gate is not None:
            gate.register(symbol, dec.outcome, now_ts)
        return dec

    if conf.direction is None or conf.entry_price is None:
        return _finalize(SignalDecision(None, "wait", "no_confluence"))

    if conf.direction == "bear" and not cfg.ALLOW_SHORT:
        return _finalize(SignalDecision(None, "reject", "short_disabled"))

    if (not cfg.TEST_MODE) and _is_near_close(now_ts):
        return _finalize(SignalDecision(None, "reject", "near_close"))

    entry = float(conf.entry_price)
    stop, sl_method = _compute_stop(conf, entry, tick_size)

    bad_side = (
        (conf.direction == "bull" and stop >= entry)
        or (conf.direction == "bear" and stop <= entry)
    )
    if bad_side:
        return _finalize(SignalDecision(None, "reject", "invalid_stop"))

    r = abs(entry - stop)
    if r <= 0:
        return _finalize(SignalDecision(None, "reject", "zero_risk"))

    targets = _compute_targets(entry, stop, conf.direction)
    rr_to_r2 = abs(targets[1] - entry) / r
    min_rr = _min_rr_for(conf.poi_kind)
    if rr_to_r2 + 1e-9 < min_rr:
        return _finalize(SignalDecision(
            None, "wait", f"rr_below_min({rr_to_r2:.2f}<{min_rr})"
        ))

    sig = TradeSignal(
        symbol=symbol,
        direction=conf.direction,
        entry=entry,
        stop=stop,
        targets=targets,
        rr=rr_to_r2,
        poi_kind=conf.poi_kind,
        trigger_kind=conf.trigger_kind or "",
        session=conf.session,
        ts=now_ts,
        meta={
            "sl_method": sl_method,
            "poi_level": conf.poi_level,
            "htf_trend": conf.htf_trend,
            "mtf_trend": conf.mtf_trend,
        },
    )
    return _finalize(SignalDecision(sig, "signal", ""))
