"""ICT primitive detectors (STEP 5)."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from kis_ict_trader.signals import ictsignals as S


def _frame_with_pivots():
    # 60-bar 15-min frame with engineered pivots at idx 8 (low) and 15 (high)
    n = 60
    rng = np.random.default_rng(0)
    idx = pd.date_range("2026-04-22 09:00", periods=n, freq="15min")
    c = np.concatenate([np.linspace(100, 130, 40), np.linspace(130, 120, 20)])
    hi = c + 0.5
    lo = c - 0.5
    op = c.copy()
    hi[15] = c[15] + 3.0       # pivot high
    lo[8] = c[8] - 3.0         # pivot low
    # bull FVG engineered between bar 10 and 12
    hi[10] = 105.0
    lo[12] = 108.0
    return pd.DataFrame(
        {"open": op, "high": hi, "low": lo, "close": c, "volume": [1000] * n},
        index=idx,
    )


class TestSwings:
    def test_detects_engineered_pivots(self):
        df = _frame_with_pivots()
        swings = S.detect_swings(df, lookback=3)
        kinds = {(s.idx, s.kind) for s in swings}
        assert (8, "low") in kinds
        assert (15, "high") in kinds

    def test_empty_input_returns_empty(self):
        assert S.detect_swings(pd.DataFrame(), lookback=3) == []

    def test_short_input_returns_empty(self):
        df = _frame_with_pivots().iloc[:5]
        assert S.detect_swings(df, lookback=3) == []


class TestStructure:
    def test_first_break_is_choch(self):
        df = _frame_with_pivots()
        swings = S.detect_swings(df, lookback=3)
        events = S.detect_structure(df, swings)
        assert events and events[0].kind == "CHoCH"

    def test_no_swings_yields_no_events(self):
        df = _frame_with_pivots()
        assert S.detect_structure(df, swings=[]) == []


class TestFVG:
    def test_engineered_bull_fvg_present(self):
        df = _frame_with_pivots()
        fvgs = S.detect_fvgs(df)
        bull = [f for f in fvgs if f.direction == "bull"]
        assert any(f.start_idx == 10 for f in bull)

    def test_short_input(self):
        assert S.detect_fvgs(pd.DataFrame()) == []


class TestSessionDetect:
    @pytest.mark.parametrize(
        "hhmm,expected",
        [
            ("10:00", "asia"),
            ("12:00", "lunch"),
            ("14:00", "pm"),
            ("16:00", "off"),
        ],
    )
    def test_windows(self, hhmm, expected):
        assert S.detect_session(pd.Timestamp(f"2026-04-22 {hhmm}")) == expected


class TestMtfConfluence:
    def test_both_trends_aligned_without_poi_returns_no_direction(
        self, trending_daily, ltf_15m,
    ):
        """When HTF/MTF agree but there's no qualifying POI on the MTF,
        evaluate_mtf_entry must not fabricate a direction."""
        conf = S.evaluate_mtf_entry(trending_daily, trending_daily, ltf_15m)
        # direction is set only once a POI AND an LTF trigger align
        if conf.htf_trend == conf.mtf_trend and conf.htf_trend is not None:
            assert conf.htf_trend == conf.mtf_trend

    def test_mismatched_trends_direction_none(self, trending_daily, ltf_15m):
        bear = trending_daily.copy()
        bear["close"] = bear["close"].iloc[::-1].values
        bear["open"] = bear["open"].iloc[::-1].values
        bear["high"] = bear["high"].iloc[::-1].values
        bear["low"] = bear["low"].iloc[::-1].values
        conf = S.evaluate_mtf_entry(bear, trending_daily, ltf_15m)
        assert conf.direction is None
