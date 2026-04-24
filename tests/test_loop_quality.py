"""Loop integration for signal quality (STEP 24):
filter_by_quality universe pruning + TradeOutcome persistence."""
from __future__ import annotations

import pandas as pd
import pytest

from kis_ict_trader import config as cfg
from kis_ict_trader import loop as L
from kis_ict_trader.algorithm.signal_quality import SymbolQuality
from kis_ict_trader.execution.orders import AccountBalance, Position
from kis_ict_trader.observability import state as S


class NoopClient:
    async def __aenter__(self): return self
    async def __aexit__(self, *a): pass
    async def close(self): pass


@pytest.mark.asyncio
async def test_quality_filter_prunes_bad_symbols(monkeypatch):
    # Seed a persisted quality dict: "BAD" has 10 trades with avg_r=-0.5
    bad = SymbolQuality(
        symbol="BAD", n_trades=10, n_wins=1,
        sum_r=-5.0, sum_mfe_r=2.0, sum_mae_r=-8.0,
        last_updated="2026-04-22T10:00:00",
    )
    good = SymbolQuality(
        symbol="GOOD", n_trades=10, n_wins=6,
        sum_r=4.0, sum_mfe_r=6.0, sum_mae_r=-3.0,
        last_updated="2026-04-22T10:00:00",
    )
    S.save_signal_quality({"BAD": bad, "GOOD": good})

    monkeypatch.setattr(L, "QUALITY_FILTER_ENABLED", True)

    async def empty_find(client, symbol=None): return []
    monkeypatch.setattr(L, "find_pending", empty_find)

    async def no_balance(c):
        return AccountBalance(0.0, 0.0, 0.0, [], raw={})
    monkeypatch.setattr(L, "get_balance", no_balance)

    async def no_daily(*a, **k):
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    monkeypatch.setattr(L, "get_daily_ohlcv", no_daily)

    async def no_minute(*a, **k):
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    monkeypatch.setattr(L, "get_minute_ohlcv", no_minute)

    report = await L.run_once(
        client=NoopClient(),
        universe=["BAD", "GOOD", "UNSAMPLED"],
        dry_run=True,
        llm_runner=lambda p: '{"approved": false, "confidence": 0.1, '
                              '"rationale": "x"}',
        concurrency=1,
    )
    # BAD dropped; GOOD and UNSAMPLED retained
    assert "BAD" in report.quality_filter_dropped
    assert "GOOD" not in report.quality_filter_dropped
    assert "UNSAMPLED" not in report.quality_filter_dropped
    assert report.universe_size == 2


@pytest.mark.asyncio
async def test_quality_filter_disabled_by_default(monkeypatch):
    bad = SymbolQuality(
        symbol="BAD", n_trades=10, n_wins=1, sum_r=-5.0,
        sum_mfe_r=2.0, sum_mae_r=-8.0,
    )
    S.save_signal_quality({"BAD": bad})
    monkeypatch.setattr(L, "QUALITY_FILTER_ENABLED", False)

    async def empty_find(client, symbol=None): return []
    monkeypatch.setattr(L, "find_pending", empty_find)

    async def no_balance(c):
        return AccountBalance(0.0, 0.0, 0.0, [], raw={})
    monkeypatch.setattr(L, "get_balance", no_balance)

    async def no_daily(*a, **k):
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    monkeypatch.setattr(L, "get_daily_ohlcv", no_daily)

    async def no_minute(*a, **k):
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    monkeypatch.setattr(L, "get_minute_ohlcv", no_minute)

    report = await L.run_once(
        client=NoopClient(),
        universe=["BAD"],
        dry_run=True,
        llm_runner=lambda p: '{"approved": false, "confidence": 0.1, '
                              '"rationale": "x"}',
        concurrency=1,
    )
    # Universe left intact because the filter is off.
    assert report.universe_size == 1
    assert report.quality_filter_dropped == {}


def test_last_exit_price_picks_most_recent():
    """The loop helper that sources the exit price for trade-outcome
    logging must read the last close_* action for the symbol, ignoring
    hold / move_stop / other symbols."""
    from datetime import datetime

    from kis_ict_trader.loop import LoopReport, ManagementRecord, _last_exit_price

    rep = LoopReport(
        started_at=datetime.now(), finished_at=datetime.now(),
        universe_size=0,
    )
    rep.management = [
        ManagementRecord(symbol="X", kind="hold", qty=0, price=0.0,
                         reason="no_trigger", submitted=False),
        ManagementRecord(symbol="X", kind="close_partial", qty=50,
                         price=102.0, reason="tp1_hit", submitted=True),
        ManagementRecord(symbol="X", kind="move_stop", qty=0, price=100.0,
                         reason="move_to_be", submitted=False),
        ManagementRecord(symbol="Y", kind="close_all", qty=30, price=90.0,
                         reason="stop_hit", submitted=True),
        ManagementRecord(symbol="X", kind="close_all", qty=50, price=104.0,
                         reason="tp3_hit", submitted=True),
    ]
    assert _last_exit_price(rep, "X") == 104.0
    assert _last_exit_price(rep, "Y") == 90.0
    assert _last_exit_price(rep, "Z") is None
