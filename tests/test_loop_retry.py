"""run_once retry/refresh integration (STEP 20) and state retry_counts."""
from __future__ import annotations

from datetime import datetime

import pytest

from kis_ict_trader import config as cfg
from kis_ict_trader import loop as L
from kis_ict_trader.execution.order_lifecycle import OrderStatus
from kis_ict_trader.execution.orders import AccountBalance, OrderResult
from kis_ict_trader.observability import state as S


# ---------------------------------------------------------------------------
# Retry counts persistence helpers
# ---------------------------------------------------------------------------
class TestRetryCountsPersist:
    def test_load_filters_non_numeric(self):
        st = {"retry_counts": {"A": 1, "B": "bad", "C": 3}}
        out = S.load_retry_counts(st)
        assert out == {"A": 1, "C": 3}

    def test_set_drops_zero(self):
        out = S.set_retry_counts({}, {"A": 0, "B": 2})
        assert out["retry_counts"] == {"B": 2}

    def test_roundtrip_through_loop_state(self, tmp_path):
        path = tmp_path / "loop_state.json"
        st = S.load_loop_state(path)
        st = S.set_retry_counts(st, {"ORD1": 2})
        S.save_loop_state(st, path)
        back = S.load_loop_state(path)
        assert S.load_retry_counts(back) == {"ORD1": 2}


# ---------------------------------------------------------------------------
# _refresh_pending_orders
# ---------------------------------------------------------------------------
class NoopClient:
    async def __aenter__(self): return self
    async def __aexit__(self, *a): pass
    async def close(self): pass


def _pending_order(order_no="01", symbol="005930", age_sec=400,
                   limit_price=70000, qty=100):
    return OrderStatus(
        order_no=order_no, krx_fwdg_ord_orgno="0079",
        symbol=symbol, name="t", side="buy",
        submit_qty=qty, filled_qty=0, remaining_qty=qty,
        limit_price=float(limit_price), avg_fill_price=0.0,
        order_time="",  # age_sec is patched below
        cancelled=False, status="pending", raw={},
    )


@pytest.mark.asyncio
async def test_refresh_skips_everything_in_dry_run(monkeypatch):
    p = _pending_order()

    async def fake_find(client, symbol=None): return [p]
    monkeypatch.setattr(L, "find_pending", fake_find)
    called = {"replace": 0}

    async def fake_retry(*a, **k):
        called["replace"] += 1
        return []
    monkeypatch.setattr(L, "retry_stale_limits", fake_retry)

    actions = await L._refresh_pending_orders(
        NoopClient(), notify=L.NoopNotifier(), dry=True, retry_counts={},
    )
    assert len(actions) == 1 and actions[0].reason == "skipped:dry_run"
    assert called["replace"] == 0  # retry_stale_limits NOT called


@pytest.mark.asyncio
async def test_refresh_calls_retry_with_current_prices(monkeypatch):
    p = _pending_order(order_no="01", symbol="005930")

    async def fake_find(client, symbol=None): return [p]

    async def fake_price(client, ticker):
        return {"stck_prpr": "70500" if ticker == "005930" else "0"}

    seen = {}

    async def fake_retry(client, *, current_prices, policy, retry_counts,
                         pending):
        seen["prices"] = dict(current_prices)
        seen["pending_count"] = len(pending)
        seen["counts_in"] = dict(retry_counts)
        retry_counts["01"] = retry_counts.get("01", 0) + 1
        return []

    monkeypatch.setattr(L, "find_pending", fake_find)
    monkeypatch.setattr(L, "get_current_price", fake_price)
    monkeypatch.setattr(L, "retry_stale_limits", fake_retry)

    counts: dict[str, int] = {}
    await L._refresh_pending_orders(
        NoopClient(), notify=L.NoopNotifier(), dry=False,
        retry_counts=counts,
    )
    assert seen["prices"] == {"005930": 70500.0}
    assert seen["pending_count"] == 1
    assert counts == {"01": 1}


@pytest.mark.asyncio
async def test_refresh_returns_empty_on_no_pending(monkeypatch):
    async def empty_find(client, symbol=None): return []
    monkeypatch.setattr(L, "find_pending", empty_find)
    actions = await L._refresh_pending_orders(
        NoopClient(), notify=L.NoopNotifier(), dry=False, retry_counts={},
    )
    assert actions == []


@pytest.mark.asyncio
async def test_refresh_swallows_find_pending_error(monkeypatch):
    async def broken(client, symbol=None):
        raise RuntimeError("network")
    monkeypatch.setattr(L, "find_pending", broken)
    # Should NOT raise
    actions = await L._refresh_pending_orders(
        NoopClient(), notify=L.NoopNotifier(), dry=False, retry_counts={},
    )
    assert actions == []


# ---------------------------------------------------------------------------
# Full run_once integration: retry runs, retry_counts persist
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_run_once_invokes_refresh_and_persists_counts(monkeypatch):
    # Force one pending order that will bump retry_counts
    p = _pending_order(order_no="77", symbol="005930")

    async def fake_find(client, symbol=None): return [p]

    async def fake_price(client, ticker):
        return {"stck_prpr": "70500"}

    from kis_ict_trader.execution.order_lifecycle import RetryAction

    async def fake_retry(client, *, current_prices, policy, retry_counts,
                         pending):
        retry_counts["77"] = retry_counts.get("77", 0) + 1
        return [RetryAction(
            order_no="77", symbol="005930", reason="age",
            replace_result=OrderResult(ok=True, order_no="NEW", raw={}),
        )]

    monkeypatch.setattr(L, "find_pending", fake_find)
    monkeypatch.setattr(L, "get_current_price", fake_price)
    monkeypatch.setattr(L, "retry_stale_limits", fake_retry)

    # Stub the rest of the pipeline so run_once finishes quickly.
    async def no_balance(client):
        return AccountBalance(0.0, 0.0, 0.0, [], raw={})
    monkeypatch.setattr(L, "get_balance", no_balance)

    async def no_daily(*a, **k):
        import pandas as pd
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    monkeypatch.setattr(L, "get_daily_ohlcv", no_daily)

    async def no_minute(*a, **k):
        import pandas as pd
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    monkeypatch.setattr(L, "get_minute_ohlcv", no_minute)

    report = await L.run_once(
        client=NoopClient(),
        universe=["005930"],
        dry_run=False,
        llm_runner=lambda p: '{"approved": false, "confidence": 0.1, '
                              '"rationale": "skip"}',
        concurrency=1,
    )
    assert len(report.retry_actions) == 1
    assert report.retry_actions[0].reason == "age"

    # Counts persisted to loop_state.json
    persisted = S.load_loop_state()
    assert S.load_retry_counts(persisted) == {"77": 1}


@pytest.mark.asyncio
async def test_run_once_dry_run_does_not_call_retry(monkeypatch):
    """dry-run path must query pending but never invoke retry_stale_limits."""
    p = _pending_order(order_no="88", symbol="000660")

    async def fake_find(client, symbol=None): return [p]
    called = {"retry": 0}

    async def fake_retry(*a, **k):
        called["retry"] += 1
        return []

    monkeypatch.setattr(L, "find_pending", fake_find)
    monkeypatch.setattr(L, "retry_stale_limits", fake_retry)

    async def no_balance(client):
        return AccountBalance(0.0, 0.0, 0.0, [], raw={})
    monkeypatch.setattr(L, "get_balance", no_balance)

    async def no_daily(*a, **k):
        import pandas as pd
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    monkeypatch.setattr(L, "get_daily_ohlcv", no_daily)

    async def no_minute(*a, **k):
        import pandas as pd
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    monkeypatch.setattr(L, "get_minute_ohlcv", no_minute)

    report = await L.run_once(
        client=NoopClient(),
        universe=["000660"],
        dry_run=True,
        llm_runner=lambda p: '{"approved": false, "confidence": 0.1, '
                              '"rationale": "skip"}',
        concurrency=1,
    )
    assert called["retry"] == 0
    assert report.retry_actions[0].reason == "skipped:dry_run"
