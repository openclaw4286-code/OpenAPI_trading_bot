"""ICT signal primitives: swings, BOS/CHoCH, FVG, Order Blocks, sweeps, sessions.

All detectors operate on a single-timeframe DataFrame that carries a
DatetimeIndex (KST preferred) and columns: open / high / low / close / volume.
`detect_all(df)` bundles the results; `evaluate_mtf_entry(htf, mtf, ltf)`
runs the classic D / 4h / 15m confluence check that the strategy layer
consumes.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import time
from typing import Literal

import pandas as pd

from .. import config as cfg

log = logging.getLogger(__name__)

Direction = Literal["bull", "bear"]


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class SwingPoint:
    idx: int
    ts: pd.Timestamp
    price: float
    kind: Literal["high", "low"]


@dataclass
class StructureEvent:
    idx: int
    ts: pd.Timestamp
    price: float
    kind: Literal["BOS", "CHoCH"]
    direction: Direction
    broken_swing: SwingPoint | None = None


@dataclass
class FairValueGap:
    start_idx: int              # idx of the first of the three bars
    ts_created: pd.Timestamp    # ts of the third (confirming) bar
    low: float
    high: float
    direction: Direction
    filled_ratio: float = 0.0
    filled: bool = False


@dataclass
class OrderBlock:
    idx: int
    ts: pd.Timestamp
    high: float
    low: float
    direction: Direction
    mitigated: bool = False


@dataclass
class LiquiditySweep:
    idx: int
    ts: pd.Timestamp
    swept_price: float
    direction: Direction        # bull = swept a low then reversed up
    swing_idx: int


@dataclass
class IctSnapshot:
    swings: list[SwingPoint]
    structure: list[StructureEvent]
    fvgs: list[FairValueGap]
    order_blocks: list[OrderBlock]
    sweeps: list[LiquiditySweep]
    session: str


@dataclass
class MtfConfluence:
    htf_trend: Direction | None
    mtf_trend: Direction | None
    ltf_trigger_idx: int | None
    entry_price: float | None
    trigger_kind: str | None            # "BOS" | "CHoCH"
    poi_kind: str | None                # "FVG" | "OB"
    poi_level: tuple[float, float] | None
    session: str
    direction: Direction | None


# ---------------------------------------------------------------------------
# Swings
# ---------------------------------------------------------------------------
def detect_swings(
    df: pd.DataFrame, lookback: int | None = None
) -> list[SwingPoint]:
    lb = int(lookback if lookback is not None else cfg.ICT["swing_lookback"])
    if df.empty or len(df) < 2 * lb + 1:
        return []
    hi = df["high"].to_numpy(dtype=float)
    lo = df["low"].to_numpy(dtype=float)
    out: list[SwingPoint] = []
    for i in range(lb, len(df) - lb):
        if (
            hi[i] > hi[i - lb:i].max()
            and hi[i] >= hi[i + 1:i + lb + 1].max()
        ):
            out.append(SwingPoint(
                idx=i, ts=df.index[i], price=float(hi[i]), kind="high",
            ))
        if (
            lo[i] < lo[i - lb:i].min()
            and lo[i] <= lo[i + 1:i + lb + 1].min()
        ):
            out.append(SwingPoint(
                idx=i, ts=df.index[i], price=float(lo[i]), kind="low",
            ))
    return out


# ---------------------------------------------------------------------------
# Market structure: BOS / CHoCH
# ---------------------------------------------------------------------------
def detect_structure(
    df: pd.DataFrame, swings: list[SwingPoint]
) -> list[StructureEvent]:
    """Walk the bars forward; whenever close breaks the most recent opposite
    confirmed swing, emit BOS (continuation) or CHoCH (reversal)."""
    if df.empty or not swings:
        return []
    close = df["close"].to_numpy(dtype=float)
    events: list[StructureEvent] = []
    trend: Direction | None = None
    last_high: SwingPoint | None = None
    last_low: SwingPoint | None = None
    siter = iter(swings)
    nxt = next(siter, None)
    for i in range(len(df)):
        while nxt is not None and nxt.idx <= i:
            if nxt.kind == "high":
                last_high = nxt
            else:
                last_low = nxt
            nxt = next(siter, None)
        price = close[i]
        if last_high is not None and price > last_high.price:
            kind_up: Literal["BOS", "CHoCH"] = (
                "BOS" if trend == "bull" else "CHoCH"
            )
            events.append(StructureEvent(
                i, df.index[i], float(price), kind_up, "bull", last_high,
            ))
            trend = "bull"
            last_high = None
        elif last_low is not None and price < last_low.price:
            kind_dn: Literal["BOS", "CHoCH"] = (
                "BOS" if trend == "bear" else "CHoCH"
            )
            events.append(StructureEvent(
                i, df.index[i], float(price), kind_dn, "bear", last_low,
            ))
            trend = "bear"
            last_low = None
    return events


# ---------------------------------------------------------------------------
# Fair Value Gaps
# ---------------------------------------------------------------------------
def detect_fvgs(df: pd.DataFrame) -> list[FairValueGap]:
    if len(df) < 3:
        return []
    hi = df["high"].to_numpy(dtype=float)
    lo = df["low"].to_numpy(dtype=float)
    fvgs: list[FairValueGap] = []
    for i in range(len(df) - 2):
        # Bull FVG: gap above bar i between hi[i] and lo[i+2]
        if hi[i] < lo[i + 2]:
            fvgs.append(FairValueGap(
                start_idx=i, ts_created=df.index[i + 2],
                low=float(hi[i]), high=float(lo[i + 2]),
                direction="bull",
            ))
        elif lo[i] > hi[i + 2]:
            fvgs.append(FairValueGap(
                start_idx=i, ts_created=df.index[i + 2],
                low=float(hi[i + 2]), high=float(lo[i]),
                direction="bear",
            ))

    fill_thresh = float(cfg.ICT["fvg_fill_ratio"])
    for fvg in fvgs:
        width = fvg.high - fvg.low
        if width <= 0:
            continue
        deepest = 0.0
        for j in range(fvg.start_idx + 3, len(df)):
            if fvg.direction == "bull":
                penetration = fvg.high - max(lo[j], fvg.low)
            else:
                penetration = min(hi[j], fvg.high) - fvg.low
            if penetration > deepest:
                deepest = penetration
        fvg.filled_ratio = float(min(1.0, deepest / width))
        fvg.filled = fvg.filled_ratio >= fill_thresh
    return fvgs


# ---------------------------------------------------------------------------
# Order Blocks
# ---------------------------------------------------------------------------
def detect_order_blocks(
    df: pd.DataFrame, structure: list[StructureEvent]
) -> list[OrderBlock]:
    """Last opposite-colored candle immediately preceding a BOS is the OB."""
    if df.empty or not structure:
        return []
    op = df["open"].to_numpy(dtype=float)
    cl = df["close"].to_numpy(dtype=float)
    hi = df["high"].to_numpy(dtype=float)
    lo = df["low"].to_numpy(dtype=float)
    lookback = int(cfg.ICT["ob_lookback_bars"])
    touch_flag = bool(cfg.ICT["ob_mitigation_touch"])
    obs: list[OrderBlock] = []
    for ev in structure:
        if ev.kind != "BOS":
            continue
        start = max(0, ev.idx - lookback)
        for j in range(ev.idx - 1, start - 1, -1):
            body_up = cl[j] > op[j]
            body_down = cl[j] < op[j]
            if ev.direction == "bull" and body_down:
                obs.append(OrderBlock(
                    j, df.index[j], float(hi[j]), float(lo[j]), "bull",
                ))
                break
            if ev.direction == "bear" and body_up:
                obs.append(OrderBlock(
                    j, df.index[j], float(hi[j]), float(lo[j]), "bear",
                ))
                break
    for ob in obs:
        for k in range(ob.idx + 1, len(df)):
            inside = (lo[k] <= ob.high) and (hi[k] >= ob.low)
            if inside:
                ob.mitigated = touch_flag
                break
    return obs


# ---------------------------------------------------------------------------
# Liquidity sweeps
# ---------------------------------------------------------------------------
def detect_sweeps(
    df: pd.DataFrame, swings: list[SwingPoint]
) -> list[LiquiditySweep]:
    if df.empty or not swings:
        return []
    hi = df["high"].to_numpy(dtype=float)
    lo = df["low"].to_numpy(dtype=float)
    op = df["open"].to_numpy(dtype=float)
    cl = df["close"].to_numpy(dtype=float)
    min_wick = float(cfg.ICT["sweep_wick_min_ratio"])
    lookback = int(cfg.ICT["sweep_lookback_bars"])
    sweeps: list[LiquiditySweep] = []
    for i in range(1, len(df)):
        start = max(0, i - lookback)
        recent = [s for s in swings if start <= s.idx < i]
        for s in reversed(recent):
            rng = max(hi[i] - lo[i], 1e-9)
            if s.kind == "high" and hi[i] > s.price and cl[i] < s.price:
                upper_wick = hi[i] - max(op[i], cl[i])
                if upper_wick / rng >= min_wick:
                    sweeps.append(LiquiditySweep(
                        i, df.index[i], float(s.price), "bear", s.idx,
                    ))
                    break
            if s.kind == "low" and lo[i] < s.price and cl[i] > s.price:
                lower_wick = min(op[i], cl[i]) - lo[i]
                if lower_wick / rng >= min_wick:
                    sweeps.append(LiquiditySweep(
                        i, df.index[i], float(s.price), "bull", s.idx,
                    ))
                    break
    return sweeps


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------
def _parse_hhmm(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def detect_session(ts) -> str:
    windows = cfg.ICT["session_windows"]
    t = ts.time() if hasattr(ts, "time") else ts
    for name, (start, end) in windows.items():
        if _parse_hhmm(start) <= t < _parse_hhmm(end):
            return name
    return "off"


# ---------------------------------------------------------------------------
# Single-TF bundle
# ---------------------------------------------------------------------------
def detect_all(df: pd.DataFrame) -> IctSnapshot:
    swings = detect_swings(df)
    structure = detect_structure(df, swings)
    fvgs = detect_fvgs(df)
    obs = detect_order_blocks(df, structure)
    sweeps = detect_sweeps(df, swings)
    session = detect_session(df.index[-1]) if not df.empty else "off"
    return IctSnapshot(
        swings=swings, structure=structure, fvgs=fvgs,
        order_blocks=obs, sweeps=sweeps, session=session,
    )


# ---------------------------------------------------------------------------
# D / 4h / 15m confluence
# ---------------------------------------------------------------------------
def _last_trend(df: pd.DataFrame) -> Direction | None:
    snap = detect_all(df)
    if not snap.structure:
        return None
    return snap.structure[-1].direction


def evaluate_mtf_entry(
    htf: pd.DataFrame,
    mtf: pd.DataFrame,
    ltf: pd.DataFrame,
) -> MtfConfluence:
    """Classic D/4h/15m confluence:
      1. HTF trend direction (from last structure event).
      2. MTF trend matches HTF.
      3. MTF exposes a POI in that direction (most recent unfilled FVG or
         unmitigated OB).
      4. LTF records a BOS/CHoCH in the same direction with its break price
         landing inside the POI range.
    """
    htf_dir = _last_trend(htf)
    mtf_dir = _last_trend(mtf)
    session = detect_session(ltf.index[-1]) if not ltf.empty else "off"
    conf = MtfConfluence(
        htf_trend=htf_dir, mtf_trend=mtf_dir,
        ltf_trigger_idx=None, entry_price=None,
        trigger_kind=None, poi_kind=None, poi_level=None,
        session=session, direction=None,
    )
    if htf_dir is None or mtf_dir is None or htf_dir != mtf_dir:
        return conf

    mtf_snap = detect_all(mtf)
    poi: tuple[float, float] | None = None
    poi_kind: str | None = None
    for fvg in reversed(mtf_snap.fvgs):
        if fvg.direction == htf_dir and not fvg.filled:
            poi = (fvg.low, fvg.high)
            poi_kind = "FVG"
            break
    if poi is None:
        for ob in reversed(mtf_snap.order_blocks):
            if ob.direction == htf_dir and not ob.mitigated:
                poi = (ob.low, ob.high)
                poi_kind = "OB"
                break
    if poi is None:
        return conf

    ltf_snap = detect_all(ltf)
    for ev in reversed(ltf_snap.structure):
        if ev.direction != htf_dir:
            continue
        if poi[0] <= ev.price <= poi[1]:
            conf.ltf_trigger_idx = ev.idx
            conf.entry_price = float(ev.price)
            conf.trigger_kind = ev.kind
            conf.poi_kind = poi_kind
            conf.poi_level = poi
            conf.direction = htf_dir
            break
    return conf
