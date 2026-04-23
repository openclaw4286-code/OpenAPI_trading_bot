"""Backtest runner (STEP 13): mechanics verified with forced confluence."""
from __future__ import annotations

import csv

import numpy as np
import pandas as pd
import pytest

from kis_ict_trader.backtest import runner as R
from kis_ict_trader.signals.ictsignals import MtfConfluence


def _strong_uptrend(n=200, seed=3):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2024-01-02", periods=n, freq="B")
    c = 100 + np.linspace(0, 40, n) + rng.normal(0, 0.6, n)
    op = c + rng.normal(0, 0.15, n)
    hi = np.maximum(op, c) + np.abs(rng.normal(0.5, 0.15, n))
    lo = np.minimum(op, c) - np.abs(rng.normal(0.5, 0.15, n))
    return pd.DataFrame(
        {"open": op, "high": hi, "low": lo, "close": c, "volume": [10_000] * n},
        index=idx,
    )


def test_empty_input_returns_zero_trade_report():
    rep = R.backtest_symbol(
        "X",
        pd.DataFrame(columns=["open", "high", "low", "close", "volume"]),
    )
    assert rep.n_trades == 0
    assert rep.end_equity == rep.start_equity


def test_forced_confluence_trades_execute_cleanly(monkeypatch):
    df = _strong_uptrend()

    def always_bull(htf, mtf, ltf):
        last = float(ltf["close"].iloc[-1])
        return MtfConfluence(
            htf_trend="bull", mtf_trend="bull",
            ltf_trigger_idx=len(ltf) - 1, entry_price=last,
            trigger_kind="BOS", poi_kind="FVG",
            poi_level=(last * 0.985, last * 0.995),
            session="pm", direction="bull",
        )

    monkeypatch.setattr(R, "evaluate_mtf_entry", always_bull)
    rep = R.backtest_symbol(
        "FORCE", df, start_equity=100_000_000.0,
        warmup_bars=60, max_hold_bars=8, ltf_window=30,
    )
    assert rep.n_trades > 0
    for t in rep.trades:
        assert t.exit_ts is not None
        assert t.exit_reason in ("stop", "target", "timeout", "eod")
        if t.exit_reason == "stop":
            assert abs(t.exit_price - t.stop) < 1e-6
        elif t.exit_reason == "target":
            assert abs(t.exit_price - t.target) < 1e-6
        assert (t.pnl_cash >= 0) == (t.r_multiple >= 0)

    # Equity matches sum of trade PnL
    assert abs(
        rep.end_equity - rep.start_equity
        - sum(t.pnl_cash for t in rep.trades)
    ) < 1e-6

    # No overlapping trades
    for a, b in zip(rep.trades, rep.trades[1:]):
        assert a.exit_ts < b.entry_ts


def test_csv_export_roundtrip(tmp_path, monkeypatch):
    df = _strong_uptrend()
    monkeypatch.setattr(
        R, "evaluate_mtf_entry",
        lambda h, m, l: MtfConfluence(
            "bull", "bull", len(l) - 1, float(l["close"].iloc[-1]),
            "BOS", "FVG",
            (float(l["close"].iloc[-1]) * 0.985,
             float(l["close"].iloc[-1]) * 0.995),
            "pm", "bull",
        ),
    )
    rep = R.backtest_symbol("FORCE", df, warmup_bars=60)
    path = tmp_path / "trades.csv"
    R.save_report_csv(rep, path)
    rows = list(csv.reader(path.open()))
    assert len(rows) == 1 + rep.n_trades
    assert rows[0][0] == "symbol"


def test_backtest_many_independent_equity(trending_daily):
    many = R.backtest_many(
        {"A": trending_daily.iloc[:200], "B": trending_daily.iloc[100:300]},
    )
    assert set(many.keys()) == {"A", "B"}
    # Both reports start at the default equity
    assert all(r.start_equity == 100_000_000.0 for r in many.values())
