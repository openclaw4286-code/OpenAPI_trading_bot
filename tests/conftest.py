"""Shared fixtures for the kis_ict_trader pytest suite.

Provides:
  - KIS env vars so cfg.validate() doesn't fail under test.
  - Per-test state isolation: redirect cfg.PATH_LOOP_STATE +
    observability.state.PATH_POSITION_STATE into tmp_path.
  - Signal / bar / Position factory helpers.
  - A reusable FakeClient that mimics KISClient's async get/post
    surface for the order modules.
"""
from __future__ import annotations

import os

# Populate KIS env vars BEFORE any kis_ict_trader import so config.validate
# passes when modules are first loaded.
os.environ.setdefault("KIS_APP_KEY", "A")
os.environ.setdefault("KIS_APP_SECRET", "B")
os.environ.setdefault("KIS_ACCOUNT_NO", "12345678")
os.environ.setdefault("KIS_ACCOUNT_PRODUCT_CODE", "01")
os.environ.setdefault("KIS_ENV", "vps")

from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from kis_ict_trader import config as cfg
from kis_ict_trader.algorithm.ict_strategy import TradeSignal
from kis_ict_trader.algorithm.position_manager import PositionState
from kis_ict_trader.execution.kis_client import KISAPIError
from kis_ict_trader.execution.orders import Position
from kis_ict_trader.observability import state as obs_state


# ---------------------------------------------------------------------------
# State isolation
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _isolate_state_paths(tmp_path, monkeypatch):
    """Every test gets its own state dir so positions.json /
    loop_state.json don't leak between tests or between suite runs."""
    monkeypatch.setattr(cfg, "PATH_LOOP_STATE", tmp_path / "loop_state.json")
    monkeypatch.setattr(
        obs_state, "PATH_POSITION_STATE", tmp_path / "positions.json",
    )
    yield


# ---------------------------------------------------------------------------
# Signal / bar / position factories
# ---------------------------------------------------------------------------
@pytest.fixture
def make_signal():
    def _make(
        symbol: str = "005930",
        direction: str = "bull",
        entry: float = 100.0,
        stop: float | None = None,
        rr: float = 2.0,
        poi_kind: str | None = "FVG",
        trigger_kind: str = "BOS",
        session: str = "pm",
        ts: pd.Timestamp | None = None,
    ) -> TradeSignal:
        if stop is None:
            stop = entry * 0.98 if direction == "bull" else entry * 1.02
        r = abs(entry - stop)
        if direction == "bull":
            targets = [entry + r, entry + 2 * r, entry + 3 * r]
        else:
            targets = [entry - r, entry - 2 * r, entry - 3 * r]
        return TradeSignal(
            symbol=symbol, direction=direction, entry=entry, stop=stop,
            targets=targets, rr=rr, poi_kind=poi_kind,
            trigger_kind=trigger_kind, session=session,
            ts=ts or pd.Timestamp("2026-04-22 10:00"),
            meta={"sl_method": "poi", "htf_trend": "bull", "mtf_trend": "bull"},
        )
    return _make


@pytest.fixture
def make_bar():
    def _make(o: float, h: float, lo: float, c: float) -> pd.Series:
        return pd.Series({"open": o, "high": h, "low": lo, "close": c})
    return _make


@pytest.fixture
def make_position():
    def _make(
        symbol: str = "005930", qty: int = 100, avg: float = 100.0,
        curr: float = 101.0,
    ) -> Position:
        eval_amt = qty * curr
        return Position(
            symbol=symbol, name="t", quantity=qty, sellable_quantity=qty,
            avg_price=avg, current_price=curr, eval_amount=eval_amt,
            profit_amount=qty * (curr - avg), profit_rate=0.0,
        )
    return _make


@pytest.fixture
def trending_daily():
    """~250 daily bars with a steady uptrend + small noise.
    Used by backtest and strategy tests that need enough history
    for warmups + swing detection."""
    rng = np.random.default_rng(42)
    n = 260
    idx = pd.date_range("2025-05-01", periods=n, freq="B")
    c = 100 + np.cumsum(rng.normal(0.35, 1.0, n))
    op = c + rng.normal(0, 0.25, n)
    hi = np.maximum(op, c) + np.abs(rng.normal(0.7, 0.2, n))
    lo = np.minimum(op, c) - np.abs(rng.normal(0.7, 0.2, n))
    return pd.DataFrame(
        {"open": op, "high": hi, "low": lo, "close": c, "volume": [10_000] * n},
        index=idx,
    )


@pytest.fixture
def ltf_15m():
    """60 x 15-min bars, mild drift. Good LTF fixture for management tests."""
    rng = np.random.default_rng(7)
    n = 60
    idx = pd.date_range("2026-04-22 09:00", periods=n, freq="15min")
    c = 100 + np.cumsum(rng.normal(0.05, 0.25, n))
    op = c + rng.normal(0, 0.07, n)
    hi = np.maximum(op, c) + np.abs(rng.normal(0.15, 0.05, n))
    lo = np.minimum(op, c) - np.abs(rng.normal(0.15, 0.05, n))
    return pd.DataFrame(
        {"open": op, "high": hi, "low": lo, "close": c, "volume": [1_000] * n},
        index=idx,
    )


# ---------------------------------------------------------------------------
# KIS fake client
# ---------------------------------------------------------------------------
class FakeKISClient:
    """Minimal async KIS transport stub. Matches the subset used by
    execution.orders + execution.order_lifecycle."""

    def __init__(
        self,
        get_resp: dict | None = None,
        post_resp: dict | None = None,
        *,
        raise_on_get: bool = False,
        raise_on_post: bool = False,
    ):
        self.get_resp = get_resp or {"rt_cd": "0"}
        self.post_resp = post_resp or {"rt_cd": "0", "output": {}}
        self.raise_on_get = raise_on_get
        self.raise_on_post = raise_on_post
        self.calls: list[tuple] = []

    async def get(
        self, path, tr_id_key, params=None, extra_headers=None,
    ):
        self.calls.append(("GET", path, tr_id_key, dict(params or {})))
        if self.raise_on_get:
            raise KISAPIError(500, "1", "X", "get failed", {})
        return self.get_resp

    async def post(
        self, path, tr_id_key, body, extra_headers=None,
    ):
        self.calls.append(("POST", path, tr_id_key, dict(body or {})))
        if self.raise_on_post:
            raise KISAPIError(500, "1", "X", "post failed", {})
        return self.post_resp


@pytest.fixture
def fake_client():
    return FakeKISClient
