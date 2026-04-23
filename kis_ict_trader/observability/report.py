"""End-of-day P&L aggregator + markdown formatter.

`build_daily_summary(trades, date)` reduces a list of closed-trade
dicts into one JSON-friendly summary. `format_markdown(summary)` turns
it into a compact message ready for Slack/Discord or the rotating
log. The summary shape is deliberately flat so downstream storage
(daily_pnl in loop_state, a CSV archive, etc.) stays simple.
"""
from __future__ import annotations

from datetime import date as _date
from typing import Iterable, Mapping


def _to_float(v, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def build_daily_summary(
    trades: Iterable[Mapping],
    date: str | _date | None = None,
) -> dict:
    """Collapse closed trades into a one-day aggregate.

    `trades` is an iterable of dicts with at least:
      symbol, pnl_cash, r_multiple
    Extra fields are ignored. The function is pure and deterministic.
    """
    if date is None:
        d = _date.today().isoformat()
    elif isinstance(date, _date):
        d = date.isoformat()
    else:
        d = str(date)

    trades = list(trades)
    n = len(trades)
    wins = sum(1 for t in trades if _to_float(t.get("pnl_cash")) > 0)
    pnl_cash = sum(_to_float(t.get("pnl_cash")) for t in trades)
    r_sum = sum(_to_float(t.get("r_multiple")) for t in trades)

    per_symbol: dict[str, dict] = {}
    for t in trades:
        sym = str(t.get("symbol", ""))
        s = per_symbol.setdefault(
            sym, {"trades": 0, "wins": 0, "pnl_cash": 0.0, "r_sum": 0.0}
        )
        s["trades"] += 1
        s["pnl_cash"] += _to_float(t.get("pnl_cash"))
        s["r_sum"] += _to_float(t.get("r_multiple"))
        if _to_float(t.get("pnl_cash")) > 0:
            s["wins"] += 1

    return {
        "date": d,
        "trades": n,
        "wins": wins,
        "losses": n - wins,
        "win_rate": round(wins / n, 4) if n else 0.0,
        "pnl_cash": round(pnl_cash, 2),
        "r_sum": round(r_sum, 4),
        "avg_r": round(r_sum / n, 4) if n else 0.0,
        "per_symbol": {
            sym: {
                "trades": v["trades"],
                "wins": v["wins"],
                "pnl_cash": round(v["pnl_cash"], 2),
                "r_sum": round(v["r_sum"], 4),
            }
            for sym, v in per_symbol.items()
        },
    }


def format_markdown(summary: Mapping) -> str:
    """Render `build_daily_summary` output as a concise text block.

    Layout:
      Daily P&L 2026-04-22
      trades=5 wins=3 (60.00%)  pnl=+125,000 KRW  R=+1.23
      - 005930: trades=2 wins=2 pnl=+80,000  R=+1.10
      - 000660: trades=3 wins=1 pnl=+45,000  R=+0.13
    """
    date = summary.get("date", "-")
    n = int(summary.get("trades", 0))
    wins = int(summary.get("wins", 0))
    wr_pct = float(summary.get("win_rate", 0.0)) * 100.0
    pnl = float(summary.get("pnl_cash", 0.0))
    r_sum = float(summary.get("r_sum", 0.0))

    header = f"Daily P&L {date}"
    core = (
        f"trades={n} wins={wins} ({wr_pct:.2f}%)  "
        f"pnl={pnl:+,.0f} KRW  R={r_sum:+.2f}"
    )
    lines = [header, core]

    per = summary.get("per_symbol") or {}
    for sym, v in sorted(per.items()):
        lines.append(
            f"- {sym}: trades={int(v.get('trades', 0))} "
            f"wins={int(v.get('wins', 0))} "
            f"pnl={float(v.get('pnl_cash', 0)):+,.0f}  "
            f"R={float(v.get('r_sum', 0)):+.2f}"
        )
    return "\n".join(lines)
