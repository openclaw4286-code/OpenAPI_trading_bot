"""Read-only smoke test (STEP 29)."""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import pytest

from kis_ict_trader.data.fundamentals import Fundamentals
from kis_ict_trader.deploy import smoke_test as S
from kis_ict_trader.execution.orders import AccountBalance


# ---------------------------------------------------------------------------
# Checklist helper
# ---------------------------------------------------------------------------
class TestChecklist:
    def test_summary_all_pass(self, capsys):
        cl = S.Checklist(echo=False)
        cl.record("a", True, "ok")
        cl.record("b", True, "ok")
        assert cl.summary() == 0

    def test_summary_has_failures(self):
        cl = S.Checklist(echo=False)
        cl.record("a", True, "")
        cl.record("b", False, "boom")
        assert cl.summary() == 1
        assert cl.passed == 1 and cl.total == 2

    def test_empty_checklist_fails(self):
        cl = S.Checklist(echo=False)
        assert cl.summary() == 1   # 0/0 is not "all passed"

    def test_echo_prints_marks(self, capsys):
        cl = S.Checklist(echo=True)
        cl.record("name", True, "detail")
        cl.record("name2", False, "err")
        cl.summary()
        out = capsys.readouterr().out
        assert "✓" in out and "✗" in out
        assert "PASSED 1/2" in out


# ---------------------------------------------------------------------------
# run_smoke integration with injected fakes
# ---------------------------------------------------------------------------
class FakeAsyncClient:
    """Async context-manager compatible fake KIS client.

    Drives the 8 check paths by tracking which step raised (if any)
    and returning plausible payloads for the rest.
    """

    def __init__(self, *, fail: set[str] | None = None):
        self.fail = fail or set()
        self.closed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        self.closed = True

    async def close(self):
        self.closed = True

    async def get_access_token(self):
        if "token" in self.fail:
            raise RuntimeError("token refused")
        return "A" * 256


def _patch_endpoints(monkeypatch, *, fail: set[str] | None = None):
    fail = fail or set()

    async def fake_price(client, ticker):
        if "price" in fail:
            raise RuntimeError("price down")
        return {"stck_prpr": "70500", "hts_kor_isnm": "삼성전자"}

    async def fake_daily(client, ticker, start, end, adjusted=True):
        if "daily" in fail:
            raise RuntimeError("daily down")
        idx = pd.date_range(end - timedelta(days=50), end, freq="B")
        return pd.DataFrame(
            {"open": 100, "high": 101, "low": 99, "close": 100,
             "volume": 1000}, index=idx,
        )

    async def fake_minute(client, ticker, interval_minutes=15):
        if "minute" in fail:
            raise RuntimeError("minute down")
        return pd.DataFrame(
            columns=["open", "high", "low", "close", "volume"],
        )  # empty → off-session acceptable

    async def fake_balance(client):
        if "balance" in fail:
            raise RuntimeError("balance down")
        return AccountBalance(
            cash_available=5_000_000, total_eval=12_050_000,
            total_profit=0.0, positions=[], raw={},
        )

    async def fake_ccld(client, *, only_pending=False, on_date=None):
        if "pending" in fail:
            raise RuntimeError("ccld down")
        return []

    monkeypatch.setattr(S, "get_current_price", fake_price)
    monkeypatch.setattr(S, "get_daily_ohlcv", fake_daily)
    monkeypatch.setattr(S, "get_minute_ohlcv", fake_minute)
    monkeypatch.setattr(S, "get_balance", fake_balance)
    monkeypatch.setattr(S, "inquire_daily_ccld", fake_ccld)


@pytest.mark.asyncio
async def test_run_smoke_all_pass(monkeypatch):
    _patch_endpoints(monkeypatch)
    rc = await S.run_smoke(
        ticker="005930", echo=False,
        client_factory=FakeAsyncClient,
    )
    assert rc == 0


@pytest.mark.asyncio
async def test_run_smoke_token_failure_early_aborts(monkeypatch, capsys):
    _patch_endpoints(monkeypatch)
    rc = await S.run_smoke(
        ticker="005930", echo=True,
        client_factory=lambda: FakeAsyncClient(fail={"token"}),
    )
    assert rc == 1
    # Early abort: we never attempted the price check.
    out = capsys.readouterr().out
    assert "current price" not in out


@pytest.mark.asyncio
async def test_run_smoke_continues_past_mid_failure(monkeypatch):
    """A balance failure must not abort the run — later checks still
    execute so the operator sees every failing endpoint in one pass."""
    _patch_endpoints(monkeypatch, fail={"balance"})
    rc = await S.run_smoke(
        ticker="005930", echo=False,
        client_factory=FakeAsyncClient,
    )
    assert rc == 1


@pytest.mark.asyncio
async def test_run_smoke_dart_optional(monkeypatch):
    _patch_endpoints(monkeypatch)

    async def fake_fund(ticker, **kw):
        return Fundamentals(ticker=ticker, per=10.0, source="dart")

    monkeypatch.setattr(
        "kis_ict_trader.data.fundamentals.get_fundamentals", fake_fund,
    )
    rc = await S.run_smoke(
        ticker="005930", with_dart=True, echo=False,
        client_factory=FakeAsyncClient,
    )
    assert rc == 0


@pytest.mark.asyncio
async def test_run_smoke_minute_empty_still_passes(monkeypatch):
    """Empty minute OHLCV at 03:00 KST is fine — the endpoint just
    has no session data yet. We still record a pass."""
    _patch_endpoints(monkeypatch)   # minute fake returns empty df
    rc = await S.run_smoke(
        ticker="005930", echo=False,
        client_factory=FakeAsyncClient,
    )
    assert rc == 0


@pytest.mark.asyncio
async def test_run_smoke_empty_daily_is_failure(monkeypatch):
    """Daily OHLCV is a harder requirement — empty → fail."""
    _patch_endpoints(monkeypatch)

    async def empty_daily(client, ticker, start, end, adjusted=True):
        return pd.DataFrame(
            columns=["open", "high", "low", "close", "volume"],
        )
    monkeypatch.setattr(S, "get_daily_ohlcv", empty_daily)

    rc = await S.run_smoke(
        ticker="005930", echo=False,
        client_factory=FakeAsyncClient,
    )
    assert rc == 1
