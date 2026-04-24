"""Static HTML dashboard for loop state, positions, and signal quality.

Reads the three persisted JSON blobs and renders a single self-contained
HTML file:
  loop_state.json     → scheduler summary + recent submissions + daily P&L
  positions.json      → open trades with trailing stop + tranche flags
  signal_quality.json → per-symbol win rate / avg R / MFE / MAE table

Charts (cumulative P&L, per-symbol avg R) are built with matplotlib and
embedded as base64 PNGs, so the resulting file is a single portable
artefact that can be served by any static HTTP server or emailed.

Invocation: `python -m kis_ict_trader --dashboard [path]`. With no
`path`, writes to cfg.DIR_LOGS / "dashboard.html".
"""
from __future__ import annotations

import base64
import html
import io
import logging
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402

from .. import config as cfg  # noqa: E402
from ..algorithm.position_manager import PositionState  # noqa: E402
from ..algorithm.signal_quality import SymbolQuality  # noqa: E402
from .state import (  # noqa: E402
    load_loop_state,
    load_positions,
    load_signal_quality,
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Chart helpers (matplotlib → base64 PNG)
# ---------------------------------------------------------------------------
def _fig_to_b64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _equity_curve_png(daily_pnl: dict) -> str:
    if not daily_pnl:
        return ""
    dates = sorted(daily_pnl.keys())
    cum = 0.0
    series: list[float] = []
    for d in dates:
        cum += float(daily_pnl[d].get("pnl_cash", 0.0))
        series.append(cum)

    fig, ax = plt.subplots(figsize=(9.0, 3.2), dpi=110)
    ax.plot(range(len(dates)), series, color="#1b5e20", linewidth=1.8)
    ax.fill_between(range(len(dates)), 0, series,
                    alpha=0.15, color="#1b5e20")
    ax.axhline(0, color="#999", linestyle="--", linewidth=0.8)
    step = max(1, len(dates) // 10)
    ax.set_xticks(list(range(0, len(dates), step)))
    ax.set_xticklabels(
        [dates[i] for i in range(0, len(dates), step)],
        rotation=30, ha="right", fontsize=8,
    )
    ax.set_ylabel("Cumulative P&L (KRW)")
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    return _fig_to_b64(fig)


def _avg_r_bar_png(quality: dict[str, SymbolQuality]) -> str:
    if not quality:
        return ""
    items = sorted(
        quality.values(), key=lambda q: q.avg_r, reverse=True,
    )
    symbols = [q.symbol for q in items]
    avg_rs = [q.avg_r for q in items]
    colors = ["#2e7d32" if r >= 0 else "#c62828" for r in avg_rs]

    fig, ax = plt.subplots(
        figsize=(max(6.0, 0.35 * len(items) + 2), 3.2), dpi=110,
    )
    ax.bar(range(len(items)), avg_rs, color=colors,
           edgecolor="#333", linewidth=0.5)
    ax.axhline(0, color="#999", linestyle="--", linewidth=0.8)
    ax.set_ylabel("avg R / trade")
    ax.set_xticks(range(len(items)))
    ax.set_xticklabels(symbols, rotation=30, ha="right", fontsize=8)
    ax.grid(True, alpha=0.25, axis="y")
    fig.tight_layout()
    return _fig_to_b64(fig)


# ---------------------------------------------------------------------------
# HTML sections
# ---------------------------------------------------------------------------
def _esc(v) -> str:
    return html.escape("" if v is None else str(v))


_CSS = """
:root { --fg:#222; --muted:#666; --ok:#1b5e20; --bad:#c62828; --warn:#ed6c02;
        --bg:#fafafa; --card:#fff; --border:#e0e0e0; }
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
       margin: 0; padding: 20px 28px; color: var(--fg); background: var(--bg); }
header { display:flex; justify-content: space-between; align-items: baseline;
         border-bottom: 1px solid var(--border); padding-bottom: 8px;
         margin-bottom: 16px; }
h1 { margin: 0; font-size: 1.4em; }
h2 { font-size: 1.05em; margin: 20px 0 8px; color: #333; }
.generated { color: var(--muted); font-size: 0.85em; }
section { background: var(--card); border: 1px solid var(--border);
          border-radius: 6px; padding: 14px 18px; margin-bottom: 14px; }
dl.grid { display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 4px 18px; font-size: 0.92em; margin: 0; }
dl.grid dt { color: var(--muted); }
dl.grid dd { margin: 0; font-variant-numeric: tabular-nums; }
table { border-collapse: collapse; width: 100%; font-size: 0.9em; }
th, td { text-align: left; padding: 6px 10px;
         border-bottom: 1px solid var(--border); }
th { background: #f5f5f5; font-weight: 600; font-size: 0.85em;
     text-transform: uppercase; letter-spacing: 0.04em; }
td.num { font-variant-numeric: tabular-nums; text-align: right; }
tr.pos td.num.pnl { color: var(--ok); }
tr.neg td.num.pnl { color: var(--bad); }
.pill { display:inline-block; padding: 1px 8px; border-radius: 10px;
        font-size: 0.8em; font-weight: 600; }
.pill.ok { background: #e8f5e9; color: var(--ok); }
.pill.bad { background: #fdecea; color: var(--bad); }
.pill.warn { background: #fff4e5; color: var(--warn); }
img.chart { max-width: 100%; border: 1px solid var(--border);
            border-radius: 4px; }
.empty { color: var(--muted); font-style: italic; }
.mono { font-family: ui-monospace, SF Mono, Menlo, monospace; }
"""


def _section_meta(state: dict) -> str:
    summary = state.get("last_run_summary") or {}
    err = summary.get("error")
    err_pill = (
        f'<span class="pill bad">{_esc(err)}</span>'
        if err else '<span class="pill ok">ok</span>'
    )
    rows = [
        ("last_run_at", _esc(state.get("last_run_at") or "never")),
        ("elapsed_s", _esc(summary.get("elapsed_s", "-"))),
        ("universe", _esc(summary.get("universe_size", "-"))),
        ("signals", _esc(summary.get("signals", "-"))),
        ("approved", _esc(summary.get("approved", "-"))),
        ("submitted", _esc(summary.get("submitted", "-"))),
        ("error", err_pill),
    ]
    dl = "\n".join(
        f"<dt>{k}</dt><dd>{v}</dd>" for k, v in rows
    )
    return f"""<section>
  <h2>Scheduler</h2>
  <dl class="grid">{dl}</dl>
</section>"""


def _section_pnl(state: dict) -> str:
    daily = state.get("daily_pnl") or {}
    if not daily:
        return ('<section><h2>Cumulative P&amp;L</h2>'
                '<p class="empty">no closed trades yet</p></section>')
    png = _equity_curve_png(daily)
    dates = sorted(daily.keys())
    total_pnl = sum(float(daily[d].get("pnl_cash", 0.0)) for d in dates)
    total_trades = sum(int(daily[d].get("trades", 0)) for d in dates)
    total_wins = sum(int(daily[d].get("wins", 0)) for d in dates)
    wr = (total_wins / total_trades * 100.0) if total_trades else 0.0
    img = (f'<img class="chart" '
           f'src="data:image/png;base64,{png}" alt="equity curve" />'
           if png else '<p class="empty">chart unavailable</p>')
    return f"""<section>
  <h2>Cumulative P&amp;L ({len(dates)} days)</h2>
  <dl class="grid">
    <dt>total_pnl</dt><dd>{total_pnl:+,.0f} KRW</dd>
    <dt>trades</dt><dd>{total_trades}</dd>
    <dt>wins</dt><dd>{total_wins}</dd>
    <dt>win_rate</dt><dd>{wr:.2f}%</dd>
  </dl>
  {img}
</section>"""


def _section_positions(positions: dict[str, PositionState]) -> str:
    if not positions:
        return ('<section><h2>Open Positions</h2>'
                '<p class="empty">no open positions</p></section>')
    rows = []
    for sym, p in sorted(positions.items()):
        sig = p.signal
        pct_open = (
            100.0 * p.remaining_qty / p.initial_qty
            if p.initial_qty else 0.0
        )
        tranches = (
            ("TP1" if p.tp1_done else "") +
            (" · TP2" if p.tp2_done else "") +
            (" · TP3" if p.tp3_done else "")
        ).strip(" ·") or "-"
        rows.append(
            f'<tr><td class="mono">{_esc(sym)}</td>'
            f'<td>{_esc(sig.direction)}</td>'
            f'<td class="num">{sig.entry:,.2f}</td>'
            f'<td class="num">{p.current_stop:,.2f}</td>'
            f'<td class="num">{p.remaining_qty:,} / {p.initial_qty:,} '
            f'({pct_open:.0f}%)</td>'
            f'<td>{_esc(tranches)}</td>'
            f'<td class="num">{p.max_favorable:,.2f}</td>'
            f'<td class="num">{p.max_adverse:,.2f}</td></tr>'
        )
    body = "\n".join(rows)
    return f"""<section>
  <h2>Open Positions ({len(positions)})</h2>
  <table>
    <thead><tr>
      <th>symbol</th><th>dir</th><th>entry</th><th>stop</th>
      <th>qty</th><th>tranches</th><th>MFE</th><th>MAE</th>
    </tr></thead>
    <tbody>{body}</tbody>
  </table>
</section>"""


def _section_quality(quality: dict[str, SymbolQuality]) -> str:
    if not quality:
        return ('<section><h2>Signal Quality</h2>'
                '<p class="empty">no completed trades yet</p></section>')
    png = _avg_r_bar_png(quality)
    items = sorted(
        quality.values(),
        key=lambda q: (q.n_trades, q.avg_r), reverse=True,
    )
    rows = []
    for q in items:
        pnl_class = "pos" if q.avg_r >= 0 else "neg"
        rows.append(
            f'<tr class="{pnl_class}"><td class="mono">{_esc(q.symbol)}</td>'
            f'<td class="num">{q.n_trades}</td>'
            f'<td class="num">{q.n_wins}</td>'
            f'<td class="num">{q.win_rate * 100:.1f}%</td>'
            f'<td class="num pnl">{q.avg_r:+.3f}</td>'
            f'<td class="num">{q.mfe_mean:+.3f}</td>'
            f'<td class="num">{q.mae_mean:+.3f}</td>'
            f'<td class="mono">{_esc(q.last_updated or "-")}</td></tr>'
        )
    body = "\n".join(rows)
    img = (f'<img class="chart" src="data:image/png;base64,{png}" '
           f'alt="avg R per symbol" />'
           if png else '')
    return f"""<section>
  <h2>Signal Quality ({len(quality)} symbols)</h2>
  {img}
  <table>
    <thead><tr>
      <th>symbol</th><th>n</th><th>wins</th><th>win%</th>
      <th>avg R</th><th>MFE</th><th>MAE</th><th>updated</th>
    </tr></thead>
    <tbody>{body}</tbody>
  </table>
</section>"""


def _section_submissions(state: dict) -> str:
    rec = list(state.get("recent_submitted") or [])
    if not rec:
        return ('<section><h2>Recent Submissions</h2>'
                '<p class="empty">no submissions recorded</p></section>')
    rows = []
    for r in reversed(rec[-20:]):
        ok = bool(r.get("ok"))
        pill = ('<span class="pill ok">ok</span>' if ok
                else '<span class="pill bad">fail</span>')
        rows.append(
            f'<tr><td class="mono">{_esc(r.get("ts", "-"))}</td>'
            f'<td class="mono">{_esc(r.get("symbol", "-"))}</td>'
            f'<td>{pill}</td>'
            f'<td class="mono">{_esc(r.get("detail", ""))}</td></tr>'
        )
    body = "\n".join(rows)
    return f"""<section>
  <h2>Recent Submissions (latest {min(20, len(rec))})</h2>
  <table>
    <thead><tr><th>ts</th><th>symbol</th><th>status</th>
      <th>detail</th></tr></thead>
    <tbody>{body}</tbody>
  </table>
</section>"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def build_dashboard_html(
    *,
    loop_state: dict | None = None,
    positions: dict[str, PositionState] | None = None,
    quality: dict[str, SymbolQuality] | None = None,
) -> str:
    """Render the full dashboard as a single HTML string."""
    loop_state = loop_state if loop_state is not None else load_loop_state()
    positions = positions if positions is not None else load_positions()
    quality = quality if quality is not None else load_signal_quality()

    generated = datetime.now().isoformat(timespec="seconds")
    env = cfg.KIS_ENV
    test_mode = "TEST" if cfg.TEST_MODE else "LIVE"
    sections = [
        _section_meta(loop_state),
        _section_pnl(loop_state),
        _section_positions(positions),
        _section_quality(quality),
        _section_submissions(loop_state),
    ]
    body = "\n".join(sections)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>KIS ICT Trader — Dashboard</title>
<style>{_CSS}</style>
</head><body>
<header>
  <h1>KIS ICT Trader
    <span class="pill {'warn' if test_mode == 'TEST' else 'ok'}">{test_mode}</span>
    <span class="pill">{_esc(env)}</span>
  </h1>
  <span class="generated">generated {generated}</span>
</header>
{body}
</body></html>"""


def write_dashboard(out_path: Path | None = None) -> Path:
    """Render + write the dashboard to disk, creating parent dirs."""
    p = Path(out_path) if out_path is not None \
        else (cfg.DIR_LOGS / "dashboard.html")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(build_dashboard_html(), encoding="utf-8")
    return p
