"""Observability (STEP 15): state persistence + notify + daily report."""
from __future__ import annotations

import json
from datetime import datetime

import httpx
import pytest

from kis_ict_trader.algorithm.position_manager import PositionState
from kis_ict_trader.observability import notify as N
from kis_ict_trader.observability import report as R
from kis_ict_trader.observability import state as S


# ---------------------------------------------------------------------------
# state.py
# ---------------------------------------------------------------------------
class TestLoopState:
    def test_record_and_persist(self, tmp_path):
        loop_path = tmp_path / "loop_state.json"
        st = S.load_loop_state(loop_path)
        st = S.record_run(
            st,
            started_at=datetime(2026, 4, 22, 10, 0, 0),
            finished_at=datetime(2026, 4, 22, 10, 0, 4),
            universe_size=20, n_signals=3, n_approved=1,
            submitted=[("005930", True, "MOCK"),
                       ("000660", False, "api_error: x")],
        )
        st = S.record_daily_pnl(st, "2026-04-22",
                                pnl_cash=120_000, n_trades=2,
                                n_wins=1, r_sum=0.6)
        st = S.record_daily_pnl(st, "2026-04-22",
                                pnl_cash=50_000, n_trades=1,
                                n_wins=1, r_sum=0.3)
        S.save_loop_state(st, loop_path)
        back = json.loads(loop_path.read_text())
        assert back["last_run_summary"]["signals"] == 3
        assert back["last_run_summary"]["submitted"] == 2
        assert back["daily_pnl"]["2026-04-22"]["trades"] == 3
        assert back["daily_pnl"]["2026-04-22"]["pnl_cash"] == 170_000
        assert len(back["recent_submitted"]) == 2


class TestPositionsRoundTrip:
    def test_persisted_state(self, tmp_path, make_signal):
        path = tmp_path / "positions.json"
        state = PositionState.from_signal(make_signal("005930"), qty=100)
        state.tp1_done = True
        state.current_stop = 100.0
        state.remaining_qty = 50
        S.save_positions({"005930": state}, path)
        back = S.load_positions(path)
        assert "005930" in back
        r = back["005930"]
        assert r.initial_qty == 100 and r.remaining_qty == 50
        assert r.tp1_done and r.current_stop == 100.0
        assert r.signal.symbol == "005930"
        assert r.signal.targets == [102.0, 104.0, 106.0]

    def test_closed_filtered_on_save(self, tmp_path, make_signal):
        path = tmp_path / "positions.json"
        live = PositionState.from_signal(make_signal("005930"), qty=100)
        closed = PositionState.from_signal(make_signal("000660"), qty=10)
        closed.remaining_qty = 0
        S.save_positions({"005930": live, "000660": closed}, path)
        back = S.load_positions(path)
        assert "005930" in back and "000660" not in back

    def test_corrupt_file_returns_empty(self, tmp_path):
        path = tmp_path / "positions.json"
        path.write_text("not json")
        assert S.load_positions(path) == {}

    def test_missing_file_returns_empty(self, tmp_path):
        assert S.load_positions(tmp_path / "nope.json") == {}

    def test_atomic_write_leaves_no_tmp(self, tmp_path, make_signal):
        path = tmp_path / "positions.json"
        state = PositionState.from_signal(make_signal("005930"), qty=100)
        S.save_positions({"005930": state}, path)
        assert not (tmp_path / "positions.json.tmp").exists()


# ---------------------------------------------------------------------------
# notify.py
# ---------------------------------------------------------------------------
class TestNotifyFactory:
    def test_noop_default(self, monkeypatch):
        monkeypatch.delenv("KIS_NOTIFY_WEBHOOK_URL", raising=False)
        nop = N.make_notifier()
        assert isinstance(nop, N.NoopNotifier)

    def test_webhook_when_url(self, monkeypatch):
        monkeypatch.setenv("KIS_NOTIFY_WEBHOOK_URL", "http://example.test/hook")
        n = N.make_notifier()
        assert isinstance(n, N.WebhookNotifier)


class TestNotifyFormat:
    def test_slack(self):
        p = N._format_slack("warn", "title", "body")
        assert "warning" in p["text"] and "```body```" in p["text"]

    def test_discord(self):
        p = N._format_discord("error", "title", "body")
        assert "content" in p and "title" in p["content"]


@pytest.mark.asyncio
class TestWebhookNotifier:
    class FakeResp:
        status_code = 200
        text = "ok"

    class FakeClient:
        def __init__(self):
            self.calls = []

        async def post(self, url, json, timeout=None):
            self.calls.append((url, json))
            return TestWebhookNotifier.FakeResp()

    async def test_posts(self):
        fc = self.FakeClient()
        wh = N.WebhookNotifier("http://hook", "slack", client=fc)
        await wh.info("entry", "005930 @ 100")
        await wh.error("failure", "oops")
        assert len(fc.calls) == 2 and fc.calls[0][0] == "http://hook"

    async def test_swallows_network_error(self):
        class Broken:
            async def post(self, url, json, timeout=None):
                raise RuntimeError("network down")
        wh = N.WebhookNotifier("http://hook", "slack", client=Broken())
        await wh.info("t", "x")  # must NOT raise

    async def test_swallows_http_error(self):
        class Err500:
            async def post(self, url, json, timeout=None):
                class R:
                    status_code = 500
                    text = "boom"
                return R()
        wh = N.WebhookNotifier("http://hook", "discord", client=Err500())
        await wh.warn("t", "x")


# ---------------------------------------------------------------------------
# report.py
# ---------------------------------------------------------------------------
class TestDailyReport:
    def test_aggregates(self):
        trades = [
            {"symbol": "005930", "pnl_cash": 80_000, "r_multiple": 0.55},
            {"symbol": "005930", "pnl_cash": 40_000, "r_multiple": 0.30},
            {"symbol": "000660", "pnl_cash": -20_000, "r_multiple": -0.12},
            {"symbol": "000660", "pnl_cash": 25_000, "r_multiple": 0.18},
        ]
        s = R.build_daily_summary(trades, date="2026-04-22")
        assert s["trades"] == 4 and s["wins"] == 3 and s["losses"] == 1
        assert s["pnl_cash"] == 125_000.0
        assert s["per_symbol"]["005930"]["wins"] == 2
        assert abs(s["r_sum"] - 0.91) < 1e-9

    def test_empty(self):
        s = R.build_daily_summary([])
        assert s["trades"] == 0 and s["win_rate"] == 0.0

    def test_invalid_fields_tolerated(self):
        s = R.build_daily_summary([{"symbol": "X"}, {"pnl_cash": "abc"}])
        assert s["trades"] == 2 and s["pnl_cash"] == 0.0

    def test_markdown_has_per_symbol(self):
        trades = [
            {"symbol": "005930", "pnl_cash": 80_000, "r_multiple": 0.55},
            {"symbol": "000660", "pnl_cash": -20_000, "r_multiple": -0.12},
        ]
        s = R.build_daily_summary(trades, date="2026-04-22")
        md = R.format_markdown(s)
        assert "Daily P&L 2026-04-22" in md
        assert "005930" in md and "000660" in md
