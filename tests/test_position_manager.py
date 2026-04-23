"""Position manager (STEP 14): tranches + trail + never-loosen."""
from __future__ import annotations

import pandas as pd
import pytest

from kis_ict_trader.algorithm.position_manager import (
    PositionState,
    _structure_trail,
    manage_position,
)
from kis_ict_trader.signals.ictsignals import SwingPoint


def sp(price: float, kind: str = "low", idx: int = 0) -> SwingPoint:
    return SwingPoint(idx=idx, ts=pd.Timestamp("2026-04-22 11:00"),
                      price=price, kind=kind)


class TestBullLifecycle:
    def test_hold_when_no_level_hit(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        acts = manage_position(state, make_bar(99.5, 101, 99, 100.5))
        assert acts[0].kind == "hold"

    def test_tp1_partial_and_be_move(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        acts = manage_position(state, make_bar(100.5, 102.5, 100, 102.0))
        kinds = [a.kind for a in acts]
        assert kinds == ["close_partial", "move_stop"]
        cp = acts[0]
        assert cp.qty == 50 and cp.price == 102.0 and cp.reason == "tp1_hit"
        assert acts[1].price == 100.0 and state.tp1_done

    def test_tp1_idempotent(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        manage_position(state, make_bar(100.5, 102.5, 100, 102.0))
        acts = manage_position(state, make_bar(101, 103, 100.5, 102.5))
        assert all(a.kind == "hold" for a in acts)

    def test_tp2_partial_and_structure_trail(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        manage_position(state, make_bar(100.5, 102.5, 100, 102.0))  # TP1 first
        swings = [sp(101.0, "low", 3), sp(100.5, "low", 7)]
        acts = manage_position(
            state, make_bar(102.5, 104.2, 102.0, 103.9), swings=swings,
        )
        kinds = [a.kind for a in acts]
        assert "close_partial" in kinds and "move_stop" in kinds
        trail = [a for a in acts if a.kind == "move_stop"][0]
        assert trail.price == 101.0
        assert state.current_stop == 101.0 and state.tp2_done

    def test_continuous_trail_after_tp2(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        manage_position(state, make_bar(100.5, 102.5, 100, 102.0))
        manage_position(state, make_bar(102.5, 104.2, 102.0, 103.9),
                        swings=[sp(101.0, "low", 3)])
        # Fresh bar, higher swing low available → further tighten
        acts = manage_position(
            state, make_bar(104.0, 105.5, 103.8, 105.0),
            swings=[sp(101.0, "low", 3), sp(102.5, "low", 12)],
        )
        assert acts[0].kind == "move_stop" and acts[0].price == 102.5

    def test_never_loosens_stop(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        manage_position(state, make_bar(100.5, 102.5, 100, 102.0))
        manage_position(state, make_bar(102.5, 104.2, 102.0, 103.9),
                        swings=[sp(101.0, "low", 3)])
        before = state.current_stop
        acts = manage_position(
            state, make_bar(105.0, 105.5, 104.5, 105.2),
            swings=[sp(99.0, "low", 20)],  # below prev stop — must be ignored
        )
        assert acts[0].kind == "hold"
        assert state.current_stop == before

    def test_tp3_closes_all(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        manage_position(state, make_bar(100.5, 102.5, 100, 102.0))
        manage_position(state, make_bar(102.5, 104.2, 102.0, 103.9),
                        swings=[sp(101.0, "low", 3)])
        acts = manage_position(state, make_bar(105.0, 106.5, 104.0, 106.2))
        assert acts[0].kind == "close_all" and acts[0].qty == 25
        assert state.remaining_qty == 0 and state.tp3_done

    def test_already_closed_shortcircuits(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        state.remaining_qty = 0
        acts = manage_position(state, make_bar(106, 107, 105, 106.5))
        assert acts[0].reason == "already_closed"

    def test_immediate_stop_out(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(), qty=100)
        acts = manage_position(state, make_bar(99, 99.5, 97.5, 97.8))
        assert acts[0].kind == "close_all" and acts[0].reason == "stop_hit"


class TestBearLifecycle:
    def test_tp1_tightens_stop_to_entry(self, make_signal, make_bar):
        sig = make_signal(direction="bear", entry=100.0, stop=102.0)
        state = PositionState.from_signal(sig, qty=100)
        acts = manage_position(state, make_bar(100.5, 100.8, 97.5, 98.0))
        assert any(a.kind == "close_partial" and a.price == 98.0 for a in acts)
        ms = [a for a in acts if a.kind == "move_stop"]
        assert ms and ms[0].price == 100.0 and state.current_stop == 100.0


class TestStructureTrailHelper:
    def test_empty_swings_returns_none(self):
        assert _structure_trail("bull", [], 100.0, 95.0) is None

    def test_wrong_kind_ignored_for_bull(self):
        assert _structure_trail(
            "bull", [sp(99.0, "high", 0)], 100.0, 95.0,
        ) is None
