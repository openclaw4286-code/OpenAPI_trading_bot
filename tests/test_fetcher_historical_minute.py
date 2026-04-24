"""Historical intraday paging (STEP 21): get_historical_minute_ohlcv."""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import pytest

from kis_ict_trader.data import fetcher as F


def _minute_row(date: str, hhmmss: str, price: int = 100):
    return {
        "stck_bsop_date": date,
        "stck_cntg_hour": hhmmss,
        "stck_oprc": str(price),
        "stck_hgpr": str(price + 1),
        "stck_lwpr": str(price - 1),
        "stck_prpr": str(price),
        "cntg_vol": "100",
    }


class _ScriptedClient:
    """Returns a deterministic sequence of output2 payloads so we can
    verify paging / date-walking without hitting the network."""

    def __init__(self, payloads: list[list[dict]]):
        self.payloads = payloads
        self.calls = []

    async def get(self, path, tr_id_key, params=None, extra_headers=None):
        self.calls.append(dict(params or {}))
        if not self.payloads:
            return {"rt_cd": "0", "output2": []}
        return {"rt_cd": "0", "output2": self.payloads.pop(0)}

    async def post(self, *a, **k):
        raise AssertionError("post should not be called")


@pytest.mark.asyncio
async def test_paging_walks_backward_until_0900(monkeypatch, tmp_path):
    # Force DIR_DATA_CACHE to a tmp dir so the test doesn't write into
    # the package's cache.
    from kis_ict_trader import config as cfg
    monkeypatch.setattr(cfg, "DIR_DATA_CACHE", tmp_path)

    # Day 1 page 1 (15:30 → 15:01, 30 bars), page 2 (15:00 → 09:00 end).
    today = datetime.now().date()
    day1 = today.strftime("%Y%m%d")

    # Page 1: high-end bars ending at 15:30; oldest = 15:01
    page1 = [_minute_row(day1, f"1530{0:02d}") for _ in range(1)] + [
        _minute_row(day1, f"15{(mm):02d}00") for mm in range(29, -1, -1)
    ][:30]
    # Page 2: oldest hhmmss 09:00 so the loop breaks
    page2 = [_minute_row(day1, "090000")]

    scripted = _ScriptedClient([page1, page2])

    df = await F.get_historical_minute_ohlcv(
        scripted, "005930", days_back=1, interval_minutes=1, use_cache=False,
    )
    assert not df.empty
    # At least two GETs (two pages)
    assert len(scripted.calls) >= 2
    # Both used the 'chart_minute_daily' tr key indirectly — check path
    # through the actual call args.
    first = scripted.calls[0]
    assert first["FID_INPUT_DATE_1"] == day1
    assert first["FID_INPUT_HOUR_1"] == "153000"


@pytest.mark.asyncio
async def test_empty_first_page_stops_paging(monkeypatch, tmp_path):
    from kis_ict_trader import config as cfg
    monkeypatch.setattr(cfg, "DIR_DATA_CACHE", tmp_path)

    # First call empty; function should still walk remaining days but
    # produce an empty combined frame.
    scripted = _ScriptedClient([])
    df = await F.get_historical_minute_ohlcv(
        scripted, "X", days_back=1, interval_minutes=1, use_cache=False,
    )
    assert df.empty


@pytest.mark.asyncio
async def test_resample_to_60min(monkeypatch, tmp_path):
    from kis_ict_trader import config as cfg
    monkeypatch.setattr(cfg, "DIR_DATA_CACHE", tmp_path)

    # Seed enough 1-min bars on one day to produce at least one 60-min bar
    day = datetime.now().date().strftime("%Y%m%d")
    # 90 contiguous 1-min bars 09:00 .. 10:29
    bars = []
    for m in range(90):
        hh = 9 + m // 60
        mm = m % 60
        bars.append(_minute_row(day, f"{hh:02d}{mm:02d}00", price=100 + m))
    # Split into two pages (newest-first)
    bars.sort(key=lambda r: r["stck_cntg_hour"], reverse=True)
    pages = [bars[:30], bars[30:60], bars[60:90]]

    scripted = _ScriptedClient(pages)
    df = await F.get_historical_minute_ohlcv(
        scripted, "Y", days_back=1, interval_minutes=60, use_cache=False,
    )
    # After 60-min resample we should have ≥ 1 bar
    assert not df.empty
    # Index is Timestamp-like (freq may or may not be set after resample).
    assert isinstance(df.index, pd.DatetimeIndex)
    # Aggregated OHLCV columns
    assert set(df.columns) >= {"open", "high", "low", "close", "volume"}


@pytest.mark.asyncio
async def test_cache_short_circuit(monkeypatch, tmp_path):
    from kis_ict_trader import config as cfg
    monkeypatch.setattr(cfg, "DIR_DATA_CACHE", tmp_path)

    # Pre-populate a parquet cache that already covers the window.
    idx = pd.date_range(
        datetime.now() - timedelta(days=60),
        datetime.now(),
        freq="1min",
    )
    cached = pd.DataFrame(
        {"open": 1, "high": 1, "low": 1, "close": 1, "volume": 0}, index=idx,
    )
    cache_path = tmp_path / "minute_005930.parquet"
    cached.to_parquet(cache_path)

    scripted = _ScriptedClient([])   # no API pages scripted
    df = await F.get_historical_minute_ohlcv(
        scripted, "005930", days_back=5, interval_minutes=1, use_cache=True,
    )
    assert not df.empty and len(scripted.calls) == 0


@pytest.mark.asyncio
async def test_cache_write_failure_swallowed(monkeypatch, tmp_path):
    from kis_ict_trader import config as cfg
    monkeypatch.setattr(cfg, "DIR_DATA_CACHE", tmp_path)

    # Make to_parquet raise to simulate a bad cache disk.
    orig = pd.DataFrame.to_parquet

    def boom(self, *a, **k):
        raise OSError("disk")
    monkeypatch.setattr(pd.DataFrame, "to_parquet", boom)

    day = datetime.now().date().strftime("%Y%m%d")
    scripted = _ScriptedClient([[_minute_row(day, "150000")], []])
    df = await F.get_historical_minute_ohlcv(
        scripted, "Z", days_back=1, interval_minutes=1, use_cache=True,
    )
    # Fetch succeeds even though cache write failed.
    assert not df.empty
    pd.DataFrame.to_parquet = orig
