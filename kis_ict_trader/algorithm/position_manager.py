"""Open-position lifecycle management.

For each open position we hold, `manage_position(state, bar, swings)`
returns the list of actions the execution layer should take on a given
bar: trim tranches at TP1/TP2, lift the stop to breakeven, trail the
stop along structure after TP2, or flatten on stop-out / TP3.

The function is pure — no I/O. The caller owns:
- fetching the current bar (latest LTF candle) and swing snapshot,
- persisting PositionState between invocations,
- translating ManagementAction into KIS cancel / new-order calls.

Decision order per bar (first match wins, except structure trail which
runs after all tranche checks):
  1. Stop-out → close_all
  2. TP3 hit (untaken) → close_all
  3. TP2 hit (untaken) → close_partial + structure trail
  4. TP1 hit (untaken) → close_partial + move stop to breakeven
  5. Continuous structure trail, only after TP2 (ratchet, never loosen)
  6. Otherwise → [hold]

Never-loosen invariant: every stop move checks the new level is on the
right side of the existing stop for the trade direction.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Literal

import pandas as pd

from ..signals.ictsignals import SwingPoint
from .ict_strategy import TradeSignal


log = logging.getLogger(__name__)

ActionKind = Literal["hold", "move_stop", "close_partial", "close_all"]

DEFAULT_TP1_FRAC: float = 0.50       # sell 50% at TP1
DEFAULT_TP2_FRAC: float = 0.50       # sell 50% of remaining at TP2
DEFAULT_BE_ON_TP1: bool = True       # move stop to entry after TP1 trim


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class PositionState:
    """Mutable bookkeeping for one open position.

    The original `signal` is immutable; `remaining_qty` + `current_stop`
    + tranche flags evolve as the management function runs.
    """
    signal: TradeSignal
    initial_qty: int
    remaining_qty: int
    current_stop: float
    tp1_done: bool = False
    tp2_done: bool = False
    tp3_done: bool = False

    @classmethod
    def from_signal(
        cls, signal: TradeSignal, qty: int
    ) -> "PositionState":
        return cls(
            signal=signal, initial_qty=int(qty),
            remaining_qty=int(qty), current_stop=float(signal.stop),
        )


@dataclass
class ManagementAction:
    kind: ActionKind
    qty: int = 0                     # for close_partial / close_all
    price: float = 0.0               # stop price (move_stop) or tranche level
    reason: str = ""


# ---------------------------------------------------------------------------
# Stop trail helper
# ---------------------------------------------------------------------------
def _structure_trail(
    direction: str,
    swings: list[SwingPoint],
    current_price: float,
    current_stop: float,
) -> float | None:
    """Tightest ratchet-only stop based on recent opposite swings.

    Bull: highest swing low strictly below current price and strictly
    above the current stop.
    Bear: lowest swing high strictly above current price and strictly
    below the current stop.
    """
    if direction == "bull":
        candidates = [
            s.price for s in swings
            if s.kind == "low" and s.price < current_price
        ]
        if not candidates:
            return None
        best = max(candidates)
        return best if best > current_stop else None

    candidates = [
        s.price for s in swings
        if s.kind == "high" and s.price > current_price
    ]
    if not candidates:
        return None
    best = min(candidates)
    return best if best < current_stop else None


# ---------------------------------------------------------------------------
# Tranche / stop-hit detection helpers
# ---------------------------------------------------------------------------
def _hit_stop(direction: str, bar: pd.Series, stop: float) -> bool:
    if direction == "bull":
        return float(bar["low"]) <= stop
    return float(bar["high"]) >= stop


def _hit_target(direction: str, bar: pd.Series, level: float) -> bool:
    if direction == "bull":
        return float(bar["high"]) >= level
    return float(bar["low"]) <= level


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def manage_position(
    state: PositionState,
    bar: pd.Series,
    swings: list[SwingPoint] | None = None,
    *,
    tp1_fraction: float = DEFAULT_TP1_FRAC,
    tp2_fraction: float = DEFAULT_TP2_FRAC,
    be_on_tp1: bool = DEFAULT_BE_ON_TP1,
) -> list[ManagementAction]:
    """Produce the action list for one bar of price action.

    Mutates `state` to reflect tranches taken and the stop trail so the
    caller can persist the new state verbatim.
    """
    if state.remaining_qty <= 0:
        return [ManagementAction(kind="hold", reason="already_closed")]

    sig = state.signal
    direction = sig.direction
    close = float(bar["close"])
    t1, t2, t3 = sig.targets[0], sig.targets[1], sig.targets[2]

    # 1) stop-out
    if _hit_stop(direction, bar, state.current_stop):
        qty = state.remaining_qty
        state.remaining_qty = 0
        return [ManagementAction(
            kind="close_all", qty=qty,
            price=state.current_stop, reason="stop_hit",
        )]

    # 2) TP3: flatten
    if not state.tp3_done and _hit_target(direction, bar, t3):
        qty = state.remaining_qty
        state.remaining_qty = 0
        state.tp3_done = True
        return [ManagementAction(
            kind="close_all", qty=qty, price=t3, reason="tp3_hit",
        )]

    actions: list[ManagementAction] = []

    # 3) TP2: partial + structure trail
    if not state.tp2_done and _hit_target(direction, bar, t2):
        qty = max(1, int(state.remaining_qty * tp2_fraction))
        qty = min(qty, state.remaining_qty)
        actions.append(ManagementAction(
            kind="close_partial", qty=qty, price=t2, reason="tp2_hit",
        ))
        state.remaining_qty -= qty
        state.tp2_done = True
        if swings:
            new_stop = _structure_trail(
                direction, swings, close, state.current_stop,
            )
            if new_stop is not None:
                actions.append(ManagementAction(
                    kind="move_stop", price=new_stop,
                    reason="trail_after_tp2",
                ))
                state.current_stop = new_stop
        return actions

    # 4) TP1: partial + move to BE
    if not state.tp1_done and _hit_target(direction, bar, t1):
        qty = max(1, int(state.remaining_qty * tp1_fraction))
        qty = min(qty, state.remaining_qty)
        actions.append(ManagementAction(
            kind="close_partial", qty=qty, price=t1, reason="tp1_hit",
        ))
        state.remaining_qty -= qty
        state.tp1_done = True
        if be_on_tp1:
            be = float(sig.entry)
            tighten = (
                (direction == "bull" and be > state.current_stop)
                or (direction == "bear" and be < state.current_stop)
            )
            if tighten:
                actions.append(ManagementAction(
                    kind="move_stop", price=be, reason="move_to_be",
                ))
                state.current_stop = be
        return actions

    # 5) continuous structure trail (only after TP2 to avoid premature tightening)
    if state.tp2_done and swings:
        new_stop = _structure_trail(
            direction, swings, close, state.current_stop,
        )
        if new_stop is not None:
            actions.append(ManagementAction(
                kind="move_stop", price=new_stop, reason="structure_trail",
            ))
            state.current_stop = new_stop

    return actions or [ManagementAction(kind="hold", reason="no_trigger")]
