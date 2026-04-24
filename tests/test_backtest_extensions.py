"""Backtest extensions (STEP 25): split exits, LLM hook, quality collection."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from kis_ict_trader.backtest import runner as R
from kis_ict_trader.signals.ictsignals import MtfConfluence


def _strong_uptrend(n: int = 200, seed: int = 3) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2024-01-02", periods=n, freq="B")
    c = 100 + np.linspace(0, 40, n) + rng.normal(0, 0.6, n)
    op = c + rng.normal(0, 0.15, n)
    hi = np.maximum(op, c) + np.abs(rng.normal(0.5, 0.15, n))
    lo = np.minimum(op, c) - np.abs(rng.normal(0.5, 0.15, n))
    return pd.DataFrame(
        {"open": op, "high": hi, "low": lo, "close": c,
         "volume": [10_000] * n},
        index=idx,
    )


def _force_bull_confluence(htf, mtf, ltf):
    last = float(ltf["close"].iloc[-1])
    return MtfConfluence(
        htf_trend="bull", mtf_trend="bull",
        ltf_trigger_idx=len(ltf) - 1, entry_price=last,
        trigger_kind="BOS", poi_kind="FVG",
        poi_level=(last * 0.985, last * 0.995),
        session="pm", direction="bull",
    )


# ---------------------------------------------------------------------------
# Quality collection (always-on)
# ---------------------------------------------------------------------------
class TestQualityCollection:
    def test_quality_populated_after_trades(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)
        rep = R.backtest_symbol(
            "FORCE", _strong_uptrend(), warmup_bars=60, max_hold_bars=8,
        )
        assert rep.n_trades > 0
        assert "FORCE" in rep.quality_by_symbol
        q = rep.quality_by_symbol["FORCE"]
        assert q.n_trades == rep.n_trades
        # MFE sum should always be >= 0 for long trades
        assert q.sum_mfe_r >= 0

    def test_trade_carries_mfe_mae(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)
        rep = R.backtest_symbol(
            "FORCE", _strong_uptrend(), warmup_bars=60, max_hold_bars=8,
        )
        for t in rep.trades:
            assert t.max_favorable >= t.entry_price    # bull favorable = high
            assert t.max_adverse <= t.entry_price       # bull adverse = low


# ---------------------------------------------------------------------------
# LLM approve hook
# ---------------------------------------------------------------------------
class TestLlmApproveHook:
    def test_reject_all_blocks_every_entry(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)
        rep = R.backtest_symbol(
            "FORCE", _strong_uptrend(),
            llm_approve=lambda sig, ltf: False,
            warmup_bars=60,
        )
        assert rep.n_trades == 0
        assert rep.llm_rejected > 0
        assert rep.end_equity == rep.start_equity

    def test_approve_all_matches_baseline(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)
        base = R.backtest_symbol(
            "FORCE", _strong_uptrend(), warmup_bars=60, max_hold_bars=8,
        )
        approved = R.backtest_symbol(
            "FORCE", _strong_uptrend(),
            llm_approve=lambda sig, ltf: True,
            warmup_bars=60, max_hold_bars=8,
        )
        assert base.n_trades == approved.n_trades
        assert approved.llm_rejected == 0

    def test_llm_exception_counts_as_reject(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)

        def broken(sig, ltf):
            raise RuntimeError("flaky LLM")
        rep = R.backtest_symbol(
            "FORCE", _strong_uptrend(),
            llm_approve=broken, warmup_bars=60,
        )
        assert rep.n_trades == 0
        assert rep.llm_rejected > 0


# ---------------------------------------------------------------------------
# Split exits (tranched)
# ---------------------------------------------------------------------------
class TestSplitExits:
    def test_split_produces_exit_tranches(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)
        rep = R.backtest_symbol(
            "FORCE", _strong_uptrend(),
            split_exits=True, warmup_bars=60, max_hold_bars=12,
        )
        assert rep.n_trades > 0
        # At least one trade should have fired TP1 + something after
        has_multi = any(len(t.exit_tranches) >= 2 for t in rep.trades)
        assert has_multi, "expected at least one multi-tranche trade"

        for t in rep.trades:
            assert t.exit_tranches, "every trade must carry at least one tranche"
            # Total qty across tranches matches entry qty
            assert sum(tr.qty for tr in t.exit_tranches) == t.qty
            # Weighted exit price lies within [min, max] tranche prices
            prices = [tr.price for tr in t.exit_tranches]
            assert min(prices) <= (t.exit_price or 0) <= max(prices)

    def test_split_pnl_matches_tranche_sum(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)
        rep = R.backtest_symbol(
            "FORCE", _strong_uptrend(),
            split_exits=True, warmup_bars=60, max_hold_bars=12,
        )
        for t in rep.trades:
            sign = 1.0 if t.direction == "bull" else -1.0
            expected = sum(
                sign * (tr.price - t.entry_price) * tr.qty
                for tr in t.exit_tranches
            )
            assert abs(t.pnl_cash - expected) < 1e-6

    def test_tranche_reasons_cover_known_set(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)
        rep = R.backtest_symbol(
            "FORCE", _strong_uptrend(),
            split_exits=True, warmup_bars=60, max_hold_bars=12,
        )
        reasons = {
            tr.reason for t in rep.trades for tr in t.exit_tranches
        }
        assert reasons.issubset({
            "tp1_hit", "tp2_hit", "tp3_hit", "stop_hit", "timeout", "eod",
        })


# ---------------------------------------------------------------------------
# Combined: split exits + LLM hook + quality
# ---------------------------------------------------------------------------
class TestCombinedOptions:
    def test_split_with_selective_llm_gate(self, monkeypatch):
        monkeypatch.setattr(R, "evaluate_mtf_entry", _force_bull_confluence)

        # Approve only half of the opportunities — alternating flip-flop.
        state = {"toggle": False}

        def gate(sig, ltf):
            state["toggle"] = not state["toggle"]
            return state["toggle"]

        rep = R.backtest_symbol(
            "FORCE", _strong_uptrend(),
            split_exits=True, llm_approve=gate,
            warmup_bars=60, max_hold_bars=12,
        )
        assert rep.n_trades > 0
        assert rep.llm_rejected > 0
        # Quality always captured for the trades that did enter
        if rep.n_trades > 0:
            assert rep.quality_by_symbol["FORCE"].n_trades == rep.n_trades
