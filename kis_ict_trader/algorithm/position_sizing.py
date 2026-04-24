"""Position sizing: Kelly → clamp → exposure caps → integer shares.

Given a `TradeSignal` (which carries a realized R:R) and the current
portfolio state, produce a `SizingResult` whose `shares` is ready to
feed the order layer.

Formula:
    f_kelly = W - (1 - W) / b        (W = win_rate, b = signal.rr)
    f_adj   = f_kelly / 2            (if half_kelly)
    f_adj   = clamp(f_adj, min_position_pct, max_position_pct)
    f_adj   = min(f_adj, max_single_exposure - current_symbol_exposure)
    f_adj   = min(f_adj, max_total_exposure  - current_total_exposure)
    notional = equity * f_adj
    shares   = floor(notional / entry_price) rounded down to lot_size

The `clipped_by` list records every cap that bound the final size, so
callers can log / analyse what restricted the order. `reason` is a
single canonical tag summarising the outcome.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

from .. import config as cfg
from .ict_strategy import TradeSignal

log = logging.getLogger(__name__)


@dataclass
class SizingResult:
    shares: int
    notional: float
    position_pct: float
    kelly_raw: float
    kelly_adj: float
    reason: str                          # "ok" | "kelly_nonpositive" | "below_min_lot" | ...
    clipped_by: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Kelly
# ---------------------------------------------------------------------------
def kelly_fraction(win_rate: float, rr: float) -> float:
    """Classic Kelly for binary win/loss trades. Returns 0 for bad inputs."""
    if rr <= 0.0 or not (0.0 < win_rate < 1.0):
        return 0.0
    return win_rate - (1.0 - win_rate) / rr


# ---------------------------------------------------------------------------
# Sizing
# ---------------------------------------------------------------------------
def compute_size(
    signal: TradeSignal,
    equity: float,
    current_total_exposure: float = 0.0,
    current_symbol_exposure: float = 0.0,
    lot_size: int = 1,
) -> SizingResult:
    """Translate a signal into an integer share count.

    - `equity`: total account value used as the denominator for % caps.
    - `current_total_exposure`: fraction of equity already deployed
      across all open positions (0..1).
    - `current_symbol_exposure`: fraction of equity already deployed in
      this specific symbol (0..1).
    - `lot_size`: minimum tradable unit. KRX cash equities are typically
      1 share, but pass through for ETF/board lot exceptions.
    """
    clipped: list[str] = []

    if equity <= 0.0 or signal.entry <= 0.0:
        return SizingResult(
            shares=0, notional=0.0, position_pct=0.0,
            kelly_raw=0.0, kelly_adj=0.0, reason="invalid_inputs",
        )

    win_rate = float(cfg.SIZING["win_rate"])
    half = bool(cfg.SIZING["half_kelly"])
    min_pct = float(cfg.SIZING["min_position_pct"])
    max_pct = float(cfg.SIZING["max_position_pct"])
    max_single = float(cfg.SIZING["max_single_exposure"])
    max_total = float(cfg.SIZING["max_total_exposure"])

    kelly_raw = kelly_fraction(win_rate, signal.rr)
    if kelly_raw <= 0.0:
        return SizingResult(
            shares=0, notional=0.0, position_pct=0.0,
            kelly_raw=kelly_raw, kelly_adj=0.0, reason="kelly_nonpositive",
        )

    f = kelly_raw / 2.0 if half else kelly_raw
    if f > max_pct:
        clipped.append("max_position_pct")
        f = max_pct
    if f < min_pct:
        # below minimum-allocation threshold → skip (rather than bump up).
        return SizingResult(
            shares=0, notional=0.0, position_pct=0.0,
            kelly_raw=kelly_raw, kelly_adj=f,
            reason="kelly_below_min", clipped_by=clipped,
        )

    single_room = max(0.0, max_single - current_symbol_exposure)
    if f > single_room:
        clipped.append("max_single_exposure")
        f = single_room

    total_room = max(0.0, max_total - current_total_exposure)
    if f > total_room:
        clipped.append("max_total_exposure")
        f = total_room

    if f <= 0.0:
        return SizingResult(
            shares=0, notional=0.0, position_pct=0.0,
            kelly_raw=kelly_raw, kelly_adj=0.0,
            reason="exposure_capped", clipped_by=clipped,
        )

    notional = equity * f
    raw_shares = int(math.floor(notional / signal.entry))
    lot = max(1, int(lot_size))
    shares = (raw_shares // lot) * lot

    if shares <= 0:
        return SizingResult(
            shares=0, notional=0.0, position_pct=0.0,
            kelly_raw=kelly_raw, kelly_adj=f,
            reason="below_min_lot", clipped_by=clipped,
        )

    realized_notional = shares * signal.entry
    return SizingResult(
        shares=shares,
        notional=realized_notional,
        position_pct=realized_notional / equity,
        kelly_raw=kelly_raw,
        kelly_adj=f,
        reason="ok",
        clipped_by=clipped,
    )
