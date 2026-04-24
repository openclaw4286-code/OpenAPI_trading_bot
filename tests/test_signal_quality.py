"""Signal quality tracker (STEP 24): metrics, rolling update, universe filter."""
from __future__ import annotations

import pandas as pd
import pytest

from kis_ict_trader.algorithm.position_manager import (
    PositionState,
    manage_position,
)
from kis_ict_trader.algorithm.signal_quality import (
    QualityFilter,
    SymbolQuality,
    TradeOutcome,
    compute_trade_metrics,
    filter_by_quality,
    update_quality,
)
from kis_ict_trader.observability import state as S


# ---------------------------------------------------------------------------
# compute_trade_metrics
# ---------------------------------------------------------------------------
class TestComputeMetrics:
    def test_bull_winner(self):
        m = compute_trade_metrics(TradeOutcome(
            symbol="X", direction="bull",
            entry=100.0, stop=98.0,
            exit_price=104.0, max_favorable=105.0, max_adverse=99.5,
        ))
        # risk = 2; (104-100)/2 = 2.0 R
        assert m["r"] == pytest.approx(2.0)
        assert m["mfe_r"] == pytest.approx(2.5)
        # MAE was a 0.5 pullback below entry → -0.25 R
        assert m["mae_r"] == pytest.approx(-0.25)

    def test_bull_stop_out(self):
        m = compute_trade_metrics(TradeOutcome(
            "X", "bull", 100.0, 98.0, 98.0, 101.0, 98.0,
        ))
        assert m["r"] == pytest.approx(-1.0)

    def test_bear_winner(self):
        m = compute_trade_metrics(TradeOutcome(
            "Y", "bear", 100.0, 102.0, 96.0, 95.0, 100.5,
        ))
        # risk = 2, bear sign inverts: (-4) / 2 → but sign flip → +2.0
        assert m["r"] == pytest.approx(2.0)
        assert m["mfe_r"] == pytest.approx(2.5)
        assert m["mae_r"] == pytest.approx(-0.25)

    def test_zero_risk_guard(self):
        # stop == entry collapses risk to ~0; shouldn't divide-by-zero.
        m = compute_trade_metrics(TradeOutcome(
            "Z", "bull", 100.0, 100.0, 101.0, 101.0, 100.0,
        ))
        assert isinstance(m["r"], float)


# ---------------------------------------------------------------------------
# update_quality rolling
# ---------------------------------------------------------------------------
class TestUpdateQuality:
    def test_creates_entry_on_first_trade(self):
        q: dict[str, SymbolQuality] = {}
        rec = update_quality(q, TradeOutcome(
            "A", "bull", 100, 98, 104, 105, 99,
        ), now_iso="2026-04-22T10:00:00")
        assert rec is q["A"]
        assert rec.n_trades == 1 and rec.n_wins == 1
        assert rec.avg_r == pytest.approx(2.0)
        assert rec.last_updated == "2026-04-22T10:00:00"

    def test_accumulates_across_trades(self):
        q = {}
        update_quality(q, TradeOutcome("A", "bull", 100, 98, 104, 105, 99))
        update_quality(q, TradeOutcome("A", "bull", 100, 98, 96, 101, 96))
        rec = q["A"]
        assert rec.n_trades == 2 and rec.n_wins == 1
        assert rec.win_rate == 0.5
        # Avg R = (2.0 + -2.0) / 2 = 0.0
        assert rec.avg_r == pytest.approx(0.0)

    def test_updates_different_symbols_independently(self):
        q = {}
        update_quality(q, TradeOutcome("A", "bull", 100, 98, 104, 105, 99))
        update_quality(q, TradeOutcome("B", "bull", 50, 49, 48, 51, 48))
        assert set(q) == {"A", "B"}
        assert q["A"].n_wins == 1 and q["B"].n_wins == 0


# ---------------------------------------------------------------------------
# filter_by_quality
# ---------------------------------------------------------------------------
class TestFilterByQuality:
    def test_under_sampled_always_passes(self):
        q = {"A": SymbolQuality("A", n_trades=2, n_wins=0,
                                 sum_r=-5, sum_mfe_r=1, sum_mae_r=-5)}
        kept, dropped = filter_by_quality(["A", "B"], q)
        assert kept == ["A", "B"]
        assert dropped == {}

    def test_drops_negative_avg_r(self):
        q = {"A": SymbolQuality(
            "A", n_trades=10, n_wins=2,
            sum_r=-5.0,  # avg -0.5 < -0.3
            sum_mfe_r=2.0, sum_mae_r=-8.0,
        )}
        kept, dropped = filter_by_quality(["A", "B"], q)
        assert kept == ["B"]
        assert "A" in dropped and "avg_r" in dropped["A"]

    def test_drops_low_win_rate(self):
        q = {"A": SymbolQuality(
            "A", n_trades=10, n_wins=2,       # 20% < 35%
            sum_r=0.5,                         # avg_r positive → must check wr
            sum_mfe_r=5.0, sum_mae_r=-2.0,
        )}
        kept, dropped = filter_by_quality(["A"], q)
        assert kept == [] and "win_rate" in dropped["A"]

    def test_policy_override(self):
        q = {"A": SymbolQuality(
            "A", n_trades=10, n_wins=3,
            sum_r=0.5, sum_mfe_r=1, sum_mae_r=-1,
        )}
        pol = QualityFilter(min_trades=15)       # not enough samples
        kept, _ = filter_by_quality(["A"], q, pol)
        assert kept == ["A"]


# ---------------------------------------------------------------------------
# Persistence (observability.state)
# ---------------------------------------------------------------------------
class TestPersistence:
    def test_round_trip(self, tmp_path):
        path = tmp_path / "q.json"
        q = {"A": SymbolQuality("A", n_trades=5, n_wins=3,
                                 sum_r=2.4, sum_mfe_r=6.0, sum_mae_r=-3.0,
                                 last_updated="2026-04-22T10:00:00")}
        S.save_signal_quality(q, path)
        back = S.load_signal_quality(path)
        assert "A" in back
        r = back["A"]
        assert r.n_trades == 5 and r.n_wins == 3
        assert r.sum_r == pytest.approx(2.4)
        assert r.last_updated == "2026-04-22T10:00:00"

    def test_corrupt_file_returns_empty(self, tmp_path):
        path = tmp_path / "q.json"
        path.write_text("not json")
        assert S.load_signal_quality(path) == {}


# ---------------------------------------------------------------------------
# PositionState MFE/MAE update path
# ---------------------------------------------------------------------------
class TestMfeMaeTracking:
    def test_mfe_mae_updated_each_bar(self, make_signal, make_bar):
        state = PositionState.from_signal(make_signal(entry=100.0), qty=100)
        # Initially both set to entry.
        assert state.max_favorable == 100.0 and state.max_adverse == 100.0

        # Bar 1: stays below TP1=102, well above stop=98 → no tranche event,
        # just tracking. Wick high 101.5 and low 99.0 update both extremes.
        manage_position(state, make_bar(100.5, 101.5, 99.0, 100.7))
        assert state.max_favorable == 101.5
        assert state.max_adverse == 99.0
        assert not state.tp1_done

        # Bar 2: new high 102.0 (no TP1 because strict >), same low region →
        # MFE extends, MAE unchanged.
        manage_position(state, make_bar(100.8, 101.9, 99.2, 101.5))
        assert state.max_favorable == 101.9
        assert state.max_adverse == 99.0

        # Bar 3: new deeper low 98.5 (still above stop=98) → MAE deepens.
        manage_position(state, make_bar(101.5, 101.8, 98.5, 99.0))
        assert state.max_adverse == 98.5
        assert state.max_favorable == 101.9
        assert not state.tp1_done     # still no TP1 hit

    def test_bear_inverts_mfe_mae(self, make_signal, make_bar):
        sig = make_signal(direction="bear", entry=100.0, stop=102.0)
        state = PositionState.from_signal(sig, qty=100)
        # Bear: favorable = price going DOWN (low), adverse = going UP (high).
        manage_position(state, make_bar(100, 100.5, 98.0, 99.0))
        assert state.max_favorable == 98.0    # lowest low so far
        assert state.max_adverse == 100.5     # highest high so far
