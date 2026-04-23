"""Per-signal LLM context enrichment.

Collects news headlines, fundamentals, a short price-action summary,
and recent trade history for a symbol into a flat dict suitable for
`llm.gate.build_prompt(context=...)`. Everything is best-effort:
fetch failures degrade to "(fetch error)" strings so the LLM still
gets a complete prompt rather than crashing the pipeline.

Intended call site: `loop.run_once` after sizing, before handing the
sized signal list to `evaluate_candidates`.
"""
from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable

import pandas as pd

from ..algorithm.ict_strategy import TradeSignal
from ..data.fundamentals import Fundamentals, get_fundamentals
from ..data.news import NewsItem, get_news
from ..observability.state import load_loop_state


log = logging.getLogger(__name__)

NEWS_MAX_ITEMS: int = 5
TRADE_HISTORY_LOOKBACK: int = 5

NewsFetcher = Callable[[str, int], Awaitable[list[NewsItem]]]
FundamentalsFetcher = Callable[[str], Awaitable[Fundamentals]]


# ---------------------------------------------------------------------------
# Price action summary
# ---------------------------------------------------------------------------
def _price_action_summary(ltf: pd.DataFrame) -> str:
    if ltf is None or ltf.empty:
        return "no data"
    first = ltf.iloc[0]
    last = ltf.iloc[-1]
    try:
        delta_pct = (float(last["close"]) / float(first["close"]) - 1.0) * 100.0
    except (ZeroDivisionError, TypeError):
        delta_pct = 0.0
    hi = float(ltf["high"].max())
    lo = float(ltf["low"].min())
    tail = ltf.iloc[-min(5, len(ltf)):]
    direction = (
        "up" if float(tail["close"].iloc[-1]) > float(tail["close"].iloc[0])
        else "down"
    )
    return (
        f"{len(ltf)} bars, range {lo:.2f}..{hi:.2f}, "
        f"session change {delta_pct:+.2f}%, last {len(tail)} bars: {direction}"
    )


# ---------------------------------------------------------------------------
# News / fundamentals formatting
# ---------------------------------------------------------------------------
def _format_news(items: list[NewsItem], limit: int = NEWS_MAX_ITEMS) -> str:
    if not items:
        return "(no recent news)"
    lines = []
    for it in items[:limit]:
        when = it.published_at or "?"
        title = (it.title or "")[:140]
        lines.append(f"- [{when}] {title}")
    return "\n".join(lines)


def _format_fundamentals(f: Fundamentals | None) -> str:
    if f is None:
        return "(no fundamentals)"
    parts: list[str] = []
    if f.per is not None:
        parts.append(f"PER={f.per:.2f}")
    if f.pbr is not None:
        parts.append(f"PBR={f.pbr:.2f}")
    if f.roe is not None:
        parts.append(f"ROE={f.roe:.2f}%")
    if f.op_margin is not None:
        parts.append(f"OP-margin={f.op_margin:.2f}%")
    if f.debt_ratio is not None:
        parts.append(f"Debt={f.debt_ratio:.2f}%")
    if f.revenue_yoy is not None:
        parts.append(f"RevYoY={f.revenue_yoy * 100:.2f}%")
    if f.op_yoy is not None:
        parts.append(f"OpYoY={f.op_yoy * 100:.2f}%")
    if f.sector:
        parts.append(f"sector={f.sector}")
    parts.append(f"src={f.source}")
    return " / ".join(parts)


# ---------------------------------------------------------------------------
# Trade history (from loop_state.json)
# ---------------------------------------------------------------------------
def _recent_trades_for(
    symbol: str, limit: int = TRADE_HISTORY_LOOKBACK,
) -> str:
    try:
        st = load_loop_state()
    except Exception:
        return "(no history)"
    records = st.get("recent_submitted") or []
    matches = [r for r in records if r.get("symbol") == symbol]
    if not matches:
        return "(no prior submissions)"
    lines: list[str] = []
    for r in matches[-limit:]:
        ts = str(r.get("ts", "?"))
        ok = "ok" if r.get("ok") else "fail"
        detail = str(r.get("detail", ""))[:60]
        lines.append(f"- {ts} {ok} {detail}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def build_signal_context(
    signal: TradeSignal,
    ltf: pd.DataFrame | None = None,
    *,
    name: str | None = None,
    fetch_news: bool = True,
    fetch_fundamentals: bool = True,
    news_fetcher: NewsFetcher | None = None,
    fundamentals_fetcher: FundamentalsFetcher | None = None,
) -> dict[str, Any]:
    """Collect a flat context dict for one signal.

    `news_fetcher` / `fundamentals_fetcher` let tests inject stubs
    without monkey-patching module globals.
    """
    news_fn = news_fetcher or get_news
    fund_fn = fundamentals_fetcher or get_fundamentals

    ctx: dict[str, Any] = {}
    ctx["price_action"] = _price_action_summary(ltf) if ltf is not None else "n/a"
    ctx["recent_trades"] = _recent_trades_for(signal.symbol)

    if fetch_news:
        query = name or signal.symbol
        try:
            items = await news_fn(query, NEWS_MAX_ITEMS)
            ctx["news"] = _format_news(items)
        except Exception as e:
            log.debug("news fetch failed for %s: %s", query, e)
            ctx["news"] = "(fetch error)"

    if fetch_fundamentals:
        try:
            f = await fund_fn(signal.symbol)
            ctx["fundamentals"] = _format_fundamentals(f)
        except Exception as e:
            log.debug("fundamentals fetch failed for %s: %s", signal.symbol, e)
            ctx["fundamentals"] = "(fetch error)"

    return ctx
