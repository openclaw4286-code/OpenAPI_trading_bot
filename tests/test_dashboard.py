"""HTML dashboard (STEP 27)."""
from __future__ import annotations

import pandas as pd

from kis_ict_trader.algorithm.position_manager import PositionState
from kis_ict_trader.algorithm.signal_quality import SymbolQuality
from kis_ict_trader.observability import dashboard as D


def test_build_dashboard_empty_state():
    """No persisted data yet — page still renders, each section has an
    empty-state placeholder so the operator sees "no X yet" rather than
    a broken page."""
    html = D.build_dashboard_html(
        loop_state={}, positions={}, quality={},
    )
    assert "<!doctype html>" in html
    # Every section renders some empty-state copy
    for needle in [
        "no closed trades yet",
        "no open positions",
        "no completed trades yet",
        "no submissions recorded",
    ]:
        assert needle in html, f"expected empty-state text: {needle!r}"


def test_sections_render_with_data(make_signal):
    """All five sections should appear with representative data."""
    loop_state = {
        "last_run_at": "2026-04-22T15:00:00",
        "last_run_summary": {
            "elapsed_s": 4.2, "universe_size": 20,
            "signals": 3, "approved": 1, "submitted": 1, "error": None,
        },
        "recent_submitted": [
            {"ts": "2026-04-22T09:31:00", "symbol": "005930",
             "ok": True, "detail": "MOCK1"},
            {"ts": "2026-04-22T10:05:00", "symbol": "000660",
             "ok": False, "detail": "api_error: x"},
        ],
        "daily_pnl": {
            "2026-04-20": {"trades": 3, "wins": 2, "pnl_cash": 150_000,
                            "r_sum": 1.2},
            "2026-04-21": {"trades": 2, "wins": 1, "pnl_cash": -40_000,
                            "r_sum": -0.3},
            "2026-04-22": {"trades": 1, "wins": 1, "pnl_cash": 80_000,
                            "r_sum": 0.9},
        },
    }

    pos = PositionState.from_signal(make_signal("005930"), qty=100)
    pos.tp1_done = True
    pos.current_stop = 100.0
    pos.remaining_qty = 50
    pos.max_favorable = 104.2
    pos.max_adverse = 98.5
    positions = {"005930": pos}

    quality = {
        "005930": SymbolQuality(
            "005930", n_trades=12, n_wins=8,
            sum_r=4.2, sum_mfe_r=9.0, sum_mae_r=-3.2,
            last_updated="2026-04-22T15:00:00",
        ),
        "000660": SymbolQuality(
            "000660", n_trades=8, n_wins=2,
            sum_r=-2.0, sum_mfe_r=3.0, sum_mae_r=-5.0,
            last_updated="2026-04-21T15:00:00",
        ),
    }

    html = D.build_dashboard_html(
        loop_state=loop_state, positions=positions, quality=quality,
    )
    # Scheduler summary
    assert "2026-04-22T15:00:00" in html
    assert "universe" in html
    # Positions table (symbol + BE stop)
    assert "005930" in html and "100.00" in html
    # TP1 flag rendered
    assert "TP1" in html
    # Quality table
    assert "000660" in html
    # Submissions table
    assert "MOCK1" in html
    assert "api_error" in html
    # P&L header reflects 3 days of data
    assert "Cumulative P&amp;L (3 days)" in html


def test_write_dashboard_creates_file(tmp_path, monkeypatch):
    """write_dashboard writes a non-trivial HTML file at the given path.
    Using a tmp path keeps the autouse isolation fixture happy."""
    path = tmp_path / "reports" / "dash.html"
    out = D.write_dashboard(path)
    assert out == path and path.exists()
    size = path.stat().st_size
    # Even empty dashboards are ~2KB of chrome + CSS
    assert size > 1500, f"suspiciously small dashboard: {size} bytes"
    text = path.read_text()
    assert "KIS ICT Trader" in text


def test_write_dashboard_default_path(tmp_path, monkeypatch):
    """Without an explicit path we fall back to cfg.DIR_LOGS/dashboard.html."""
    from kis_ict_trader import config as cfg
    monkeypatch.setattr(cfg, "DIR_LOGS", tmp_path)
    out = D.write_dashboard()
    assert out == tmp_path / "dashboard.html"
    assert out.exists()


def test_equity_curve_png_with_empty_input():
    assert D._equity_curve_png({}) == ""


def test_avg_r_bar_png_with_empty_input():
    assert D._avg_r_bar_png({}) == ""


def test_avg_r_bar_png_emits_base64():
    q = {"A": SymbolQuality("A", n_trades=5, n_wins=3,
                             sum_r=1.5, sum_mfe_r=2.0, sum_mae_r=-1.0)}
    png = D._avg_r_bar_png(q)
    assert isinstance(png, str) and len(png) > 100
    # base64 of a real PNG starts with iVBORw0K...
    import base64
    raw = base64.b64decode(png)
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
