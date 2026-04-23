"""Strategy engine (STEP 6): confluence → TradeSignal + SignalGate."""
from __future__ import annotations

import pandas as pd
import pytest

from kis_ict_trader import config as cfg
from kis_ict_trader.algorithm.ict_strategy import (
    SignalGate,
    build_signal,
)
from kis_ict_trader.signals.ictsignals import MtfConfluence


@pytest.fixture
def ltf_min():
    idx = pd.date_range("2026-04-22 10:00", periods=5, freq="15min")
    return pd.DataFrame(
        {"open": [100] * 5, "high": [101] * 5, "low": [99] * 5,
         "close": [100] * 5, "volume": [1000] * 5},
        index=idx,
    )


def bull_conf():
    return MtfConfluence(
        htf_trend="bull", mtf_trend="bull",
        ltf_trigger_idx=4, entry_price=100.0,
        trigger_kind="BOS", poi_kind="FVG",
        poi_level=(98.0, 99.5), session="asia", direction="bull",
    )


def bear_conf():
    return MtfConfluence(
        htf_trend="bear", mtf_trend="bear",
        ltf_trigger_idx=4, entry_price=100.0,
        trigger_kind="BOS", poi_kind="OB",
        poi_level=(100.5, 102.0), session="asia", direction="bear",
    )


def no_conf():
    return MtfConfluence(None, None, None, None, None, None, None, "off", None)


class TestBuildSignal:
    def test_bull_confluence_emits_signal(self, ltf_min):
        gate = SignalGate()
        dec = build_signal(
            "005930", bull_conf(), ltf_min, tick_size=0.0, gate=gate,
            now_ts=pd.Timestamp("2026-04-22 10:30"),
        )
        assert dec.outcome == "signal"
        assert dec.signal.stop == 98.0
        assert dec.signal.targets == [102.0, 104.0, 106.0]
        assert dec.signal.meta["sl_method"] == "poi"

    def test_cooldown_rejects_second_call(self, ltf_min):
        gate = SignalGate()
        build_signal("005930", bull_conf(), ltf_min, gate=gate,
                     now_ts=pd.Timestamp("2026-04-22 10:30"))
        dec = build_signal("005930", bull_conf(), ltf_min, gate=gate,
                           now_ts=pd.Timestamp("2026-04-22 10:45"))
        assert dec.outcome == "reject" and "cooldown" in dec.reason

    def test_post_cooldown_allows_signal(self, ltf_min):
        gate = SignalGate()
        build_signal("005930", bull_conf(), ltf_min, gate=gate,
                     now_ts=pd.Timestamp("2026-04-22 10:30"))
        dec = build_signal("005930", bull_conf(), ltf_min, gate=gate,
                           now_ts=pd.Timestamp("2026-04-22 11:10"))
        assert dec.outcome == "signal"

    def test_bear_without_allow_short_rejects(self, ltf_min):
        dec = build_signal("000660", bear_conf(), ltf_min,
                           gate=SignalGate(),
                           now_ts=pd.Timestamp("2026-04-22 10:00"))
        assert dec.outcome == "reject" and dec.reason == "short_disabled"

    def test_bear_with_allow_short_emits(self, monkeypatch, ltf_min):
        monkeypatch.setattr(cfg, "ALLOW_SHORT", True)
        dec = build_signal("000660", bear_conf(), ltf_min,
                           gate=SignalGate(),
                           now_ts=pd.Timestamp("2026-04-22 10:00"))
        assert dec.outcome == "signal"
        assert dec.signal.stop > dec.signal.entry > dec.signal.targets[0]

    def test_no_confluence_waits(self, ltf_min):
        dec = build_signal("X", no_conf(), ltf_min, gate=SignalGate(),
                           now_ts=pd.Timestamp("2026-04-22 10:00"))
        assert dec.outcome == "wait"

    def test_wait_streak_blocks(self, ltf_min):
        gate = SignalGate()
        for i in range(3):
            build_signal("X", no_conf(), ltf_min, gate=gate,
                         now_ts=pd.Timestamp("2026-04-22 10:00")
                         + pd.Timedelta(minutes=i))
        dec = build_signal("X", no_conf(), ltf_min, gate=gate,
                           now_ts=pd.Timestamp("2026-04-22 10:05"))
        assert dec.outcome == "reject" and "wait_streak" in dec.reason

    def test_near_close_rejects_in_prod(self, monkeypatch, ltf_min):
        monkeypatch.setattr(cfg, "TEST_MODE", False)
        dec = build_signal("005930", bull_conf(), ltf_min,
                           gate=SignalGate(),
                           now_ts=pd.Timestamp("2026-04-22 15:20"))
        assert dec.outcome == "reject" and dec.reason == "near_close"

    def test_no_poi_uses_fallback_stop(self, ltf_min):
        conf = MtfConfluence("bull", "bull", 4, 100.0, "BOS", None, None,
                             "asia", "bull")
        dec = build_signal("Z", conf, ltf_min, gate=SignalGate(),
                           now_ts=pd.Timestamp("2026-04-22 10:00"))
        assert dec.outcome == "signal"
        assert dec.signal.meta["sl_method"] == "fallback"
