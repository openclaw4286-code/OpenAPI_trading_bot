"""4h MTF opt-in (STEP 21): _fetch_frames mode selection."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from kis_ict_trader import loop as L


@pytest.fixture
def daily_400():
    rng = np.random.default_rng(1)
    n = 400
    idx = pd.date_range("2024-01-02", periods=n, freq="B")
    c = 100 + np.cumsum(rng.normal(0.3, 0.8, n))
    return pd.DataFrame(
        {"open": c, "high": c + 0.5, "low": c - 0.5, "close": c,
         "volume": [10_000] * n},
        index=idx,
    )


@pytest.fixture
def ltf_60():
    idx = pd.date_range("2026-04-22 09:00", periods=60, freq="15min")
    c = np.linspace(100, 105, 60)
    return pd.DataFrame(
        {"open": c, "high": c + 0.2, "low": c - 0.2, "close": c,
         "volume": [1000] * 60},
        index=idx,
    )


class NoopClient:
    async def __aenter__(self): return self
    async def __aexit__(self, *a): pass
    async def close(self): pass


@pytest.mark.asyncio
async def test_daily_mode_uses_daily_as_mtf(monkeypatch, daily_400, ltf_60):
    async def daily(*a, **k): return daily_400

    async def minute(*a, **k): return ltf_60

    called = {"h4": 0}

    async def h4(*a, **k):
        called["h4"] += 1
        return pd.DataFrame()

    monkeypatch.setattr(L, "get_daily_ohlcv", daily)
    monkeypatch.setattr(L, "get_minute_ohlcv", minute)
    monkeypatch.setattr(L, "get_historical_minute_ohlcv", h4)

    frames = await L._fetch_frames(NoopClient(), "005930", mtf_mode="daily")
    assert frames is not None
    htf, mtf, ltf = frames
    pd.testing.assert_frame_equal(mtf, daily_400)
    assert called["h4"] == 0   # historical fetch NOT called in daily mode


@pytest.mark.asyncio
async def test_h4_mode_uses_historical_minute(monkeypatch, daily_400, ltf_60):
    # Build a realistic 4h MTF: ~40 4-hour bars on business days
    idx4h = pd.date_range("2026-03-01 09:00", periods=40, freq="4h")
    h4_df = pd.DataFrame(
        {"open": 100, "high": 101, "low": 99, "close": 100, "volume": 1000},
        index=idx4h,
    )

    async def daily(*a, **k): return daily_400

    async def minute(*a, **k): return ltf_60

    async def h4(*a, **k): return h4_df

    monkeypatch.setattr(L, "get_daily_ohlcv", daily)
    monkeypatch.setattr(L, "get_minute_ohlcv", minute)
    monkeypatch.setattr(L, "get_historical_minute_ohlcv", h4)

    frames = await L._fetch_frames(NoopClient(), "005930", mtf_mode="h4")
    assert frames is not None
    htf, mtf, ltf = frames
    pd.testing.assert_frame_equal(mtf, h4_df)   # MTF is the 4h series
    # HTF is always weekly-resampled daily
    assert len(htf) > 10


@pytest.mark.asyncio
async def test_h4_mode_falls_back_when_too_few_bars(monkeypatch, daily_400,
                                                    ltf_60):
    async def daily(*a, **k): return daily_400

    async def minute(*a, **k): return ltf_60

    async def h4(*a, **k):
        return pd.DataFrame(   # fewer than 10 bars → fallback
            columns=["open", "high", "low", "close", "volume"],
        )

    monkeypatch.setattr(L, "get_daily_ohlcv", daily)
    monkeypatch.setattr(L, "get_minute_ohlcv", minute)
    monkeypatch.setattr(L, "get_historical_minute_ohlcv", h4)

    frames = await L._fetch_frames(NoopClient(), "005930", mtf_mode="h4")
    assert frames is not None
    _, mtf, _ = frames
    # Falls back to the full daily frame
    pd.testing.assert_frame_equal(mtf, daily_400)


@pytest.mark.asyncio
async def test_h4_fetch_exception_falls_back_to_daily(monkeypatch, daily_400,
                                                     ltf_60):
    async def daily(*a, **k): return daily_400

    async def minute(*a, **k): return ltf_60

    async def broken(*a, **k):
        raise RuntimeError("KIS unavailable")

    monkeypatch.setattr(L, "get_daily_ohlcv", daily)
    monkeypatch.setattr(L, "get_minute_ohlcv", minute)
    monkeypatch.setattr(L, "get_historical_minute_ohlcv", broken)

    frames = await L._fetch_frames(NoopClient(), "005930", mtf_mode="h4")
    assert frames is not None
    _, mtf, _ = frames
    # Broken historical fetch → daily fallback, pipeline keeps running
    pd.testing.assert_frame_equal(mtf, daily_400)
