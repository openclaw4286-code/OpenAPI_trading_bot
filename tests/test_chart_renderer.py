"""Chart renderer (STEP 9): file output + overlay no-op branches."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from kis_ict_trader.chart.renderer import render_chart, render_signal_charts
from kis_ict_trader.signals.ictsignals import detect_all


def test_render_chart_writes_png(tmp_path, ltf_15m):
    path = tmp_path / "out.png"
    result = render_chart(ltf_15m, path, title="plain")
    assert result == path and path.exists()
    assert path.stat().st_size > 2000     # real PNG, not a stub


def test_render_chart_with_overlays(tmp_path, ltf_15m, make_signal):
    snap = detect_all(ltf_15m)
    sig = make_signal(entry=float(ltf_15m["close"].iloc[-1]))
    path = tmp_path / "with-overlays.png"
    render_chart(
        ltf_15m, path, title="overlays",
        swings=snap.swings,
        structure=snap.structure,
        fvgs=snap.fvgs,
        order_blocks=snap.order_blocks,
        sweeps=snap.sweeps,
        entry=sig.entry, stop=sig.stop, targets=sig.targets,
    )
    assert path.exists() and path.stat().st_size > 3000


def test_empty_dataframe_raises(tmp_path):
    with pytest.raises(ValueError):
        render_chart(
            pd.DataFrame(columns=["open", "high", "low", "close"]),
            tmp_path / "x.png",
        )


def test_render_signal_charts_pair(tmp_path, trending_daily, ltf_15m,
                                    make_signal):
    snap_h = detect_all(trending_daily)
    snap_l = detect_all(ltf_15m)
    sig = make_signal(entry=float(ltf_15m["close"].iloc[-1]))
    out = render_signal_charts(
        "005930", trending_daily, ltf_15m, tmp_path,
        signal=sig, htf_snapshot=snap_h, ltf_snapshot=snap_l,
    )
    assert out["htf"].exists() and out["ltf"].exists()
    assert out["htf"].name == "daily.png"
    assert out["ltf"].name == "15m.png"
