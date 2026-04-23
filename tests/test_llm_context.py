"""LLM context enrichment (STEP 22)."""
from __future__ import annotations

import pandas as pd
import pytest

from kis_ict_trader.data.fundamentals import Fundamentals
from kis_ict_trader.data.news import NewsItem
from kis_ict_trader.llm import context as C


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------
class TestPriceActionSummary:
    def test_empty_frame(self):
        assert C._price_action_summary(pd.DataFrame()) == "no data"

    def test_up_session(self, ltf_15m):
        out = C._price_action_summary(ltf_15m)
        assert "bars" in out and "range" in out and "change" in out

    def test_zero_first_close_handled(self):
        df = pd.DataFrame({
            "open": [0, 1, 2],
            "high": [0.5, 1.5, 2.5],
            "low":  [0.0, 0.5, 1.5],
            "close": [0, 1, 2],
        })
        # Should not raise even with zero initial close
        s = C._price_action_summary(df)
        assert isinstance(s, str) and "bars" in s


class TestFormatNews:
    def test_empty(self):
        assert C._format_news([]) == "(no recent news)"

    def test_items_truncated_and_dated(self):
        items = [
            NewsItem(title="t" * 200, description="", link="", original_link="",
                     published_at="2026-04-22T09:00:00"),
            NewsItem(title="b", description="", link="", original_link="",
                     published_at=""),
        ]
        out = C._format_news(items, limit=5)
        assert "2026-04-22T09:00:00" in out
        assert "?" in out                       # blank published_at → "?"
        # Each title capped at 140 chars (truncated in formatter)
        first_line = out.splitlines()[0]
        assert len(first_line) <= 180


class TestFormatFundamentals:
    def test_none_input(self):
        assert C._format_fundamentals(None) == "(no fundamentals)"

    def test_partial(self):
        f = Fundamentals(ticker="005930", per=12.3, pbr=1.2, roe=15.0,
                          source="dart")
        out = C._format_fundamentals(f)
        assert "PER=12.30" in out and "PBR=1.20" in out and "ROE=15.00%" in out
        assert "src=dart" in out


# ---------------------------------------------------------------------------
# Recent trades
# ---------------------------------------------------------------------------
class TestRecentTrades:
    def test_no_state_file(self, tmp_path, monkeypatch):
        # The autouse fixture already isolates; ensure the file is missing.
        from kis_ict_trader import config as cfg
        assert not cfg.PATH_LOOP_STATE.exists()
        assert "no prior" in C._recent_trades_for("X") \
            or "no history" in C._recent_trades_for("X")

    def test_filters_by_symbol(self, tmp_path, monkeypatch):
        from kis_ict_trader import config as cfg
        from kis_ict_trader.observability import state as S

        st = S.load_loop_state()
        st["recent_submitted"] = [
            {"ts": "2026-04-22T09:31:00", "symbol": "005930",
             "ok": True, "detail": "MOCK1"},
            {"ts": "2026-04-22T09:32:00", "symbol": "000660",
             "ok": False, "detail": "api_error"},
            {"ts": "2026-04-22T09:40:00", "symbol": "005930",
             "ok": True, "detail": "MOCK2"},
        ]
        S.save_loop_state(st)

        out = C._recent_trades_for("005930")
        assert "MOCK1" in out and "MOCK2" in out
        assert "api_error" not in out

        out2 = C._recent_trades_for("ZZZZ")
        assert "no prior" in out2


# ---------------------------------------------------------------------------
# build_signal_context end-to-end
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestBuildSignalContext:
    async def test_news_and_fundamentals_injected(self, make_signal, ltf_15m):
        async def fake_news(query, top_n):
            return [NewsItem(
                title="positive earnings beat", description="", link="",
                original_link="", published_at="2026-04-22T08:00:00",
            )]

        async def fake_fund(ticker):
            return Fundamentals(ticker=ticker, per=10.0, pbr=1.1, roe=12.0,
                                source="dart")

        ctx = await C.build_signal_context(
            make_signal(), ltf_15m, name="삼성전자",
            news_fetcher=fake_news,
            fundamentals_fetcher=fake_fund,
        )
        assert "price_action" in ctx and "bars" in ctx["price_action"]
        assert "positive earnings beat" in ctx["news"]
        assert "PER=10.00" in ctx["fundamentals"]
        assert "recent_trades" in ctx

    async def test_news_fetch_exception_swallowed(self, make_signal):
        async def broken(q, n):
            raise RuntimeError("naver down")

        async def fund_ok(t):
            return Fundamentals(ticker=t, source="none")

        ctx = await C.build_signal_context(
            make_signal(), ltf=None,
            news_fetcher=broken,
            fundamentals_fetcher=fund_ok,
        )
        assert ctx["news"] == "(fetch error)"
        # Other fields still present
        assert ctx["price_action"] == "n/a"
        assert ctx["fundamentals"] == "(no fundamentals)" \
            or "src=none" in ctx["fundamentals"]

    async def test_opt_out_flags(self, make_signal, ltf_15m):
        async def fail_if_called(*a, **k):
            raise AssertionError("should not be called")

        ctx = await C.build_signal_context(
            make_signal(), ltf_15m,
            fetch_news=False,
            fetch_fundamentals=False,
            news_fetcher=fail_if_called,
            fundamentals_fetcher=fail_if_called,
        )
        assert "news" not in ctx and "fundamentals" not in ctx
        assert "price_action" in ctx
