"""Candle chart renderer for ICT setups.

Produces per-symbol `daily.png` / `15m.png` files so the LLM gate can
attach them as visual context. Uses plain matplotlib (no mplfinance
overlays) with integer bar indices so POI rectangles, trend lines and
entry/SL/TP markers all align on the same x-axis.

Design choices:
- Integer x-axis keeps overlays trivial; date labels are interpolated
  from the DataFrame index for readability.
- All overlays are optional — the caller passes whichever primitives
  it has for the timeframe. Nothing is inferred inside the renderer.
- A `matplotlib.use("Agg")` switch is installed up front so the module
  is safe to import in headless workers (cron, scheduler, CI).
"""
from __future__ import annotations

import logging
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib.patches import Rectangle  # noqa: E402

from .. import config as cfg
from ..algorithm.ict_strategy import TradeSignal
from ..signals.ictsignals import (
    FairValueGap,
    IctSnapshot,
    LiquiditySweep,
    OrderBlock,
    StructureEvent,
    SwingPoint,
)


log = logging.getLogger(__name__)

_COLOR_UP = "#2e7d32"
_COLOR_DOWN = "#c62828"
_COLOR_FVG_BULL = "#4caf50"
_COLOR_FVG_BEAR = "#ef5350"
_COLOR_OB_BULL = "#1976d2"
_COLOR_OB_BEAR = "#f57c00"
_COLOR_SWING_HIGH = "#7b1fa2"
_COLOR_SWING_LOW = "#00838f"
_COLOR_ENTRY = "#000000"
_COLOR_STOP = "#b71c1c"
_COLOR_TARGET = "#1b5e20"


# ---------------------------------------------------------------------------
# Candles
# ---------------------------------------------------------------------------
def _draw_candles(ax, df: pd.DataFrame, width: float = 0.7) -> None:
    op = df["open"].to_numpy(dtype=float)
    hi = df["high"].to_numpy(dtype=float)
    lo = df["low"].to_numpy(dtype=float)
    cl = df["close"].to_numpy(dtype=float)
    for i in range(len(df)):
        color = _COLOR_UP if cl[i] >= op[i] else _COLOR_DOWN
        ax.plot([i, i], [lo[i], hi[i]], color=color, linewidth=0.8, zorder=2)
        body_low = min(op[i], cl[i])
        body_h = max(abs(cl[i] - op[i]), 1e-6)
        ax.add_patch(Rectangle(
            (i - width / 2, body_low), width, body_h,
            facecolor=color, edgecolor=color, linewidth=0.6, zorder=3,
        ))


def _set_xticks(ax, index: pd.DatetimeIndex, n_ticks: int = 8) -> None:
    n = len(index)
    if n == 0:
        return
    step = max(1, n // n_ticks)
    positions = list(range(0, n, step))
    labels = [index[i].strftime("%Y-%m-%d %H:%M") for i in positions]
    ax.set_xticks(positions)
    ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=8)
    ax.set_xlim(-1, n)


# ---------------------------------------------------------------------------
# Overlays
# ---------------------------------------------------------------------------
def _overlay_swings(ax, swings: list[SwingPoint]) -> None:
    for sw in swings:
        color = _COLOR_SWING_HIGH if sw.kind == "high" else _COLOR_SWING_LOW
        marker = "v" if sw.kind == "high" else "^"
        offset = 1.01 if sw.kind == "high" else 0.99
        ax.scatter(
            sw.idx, sw.price * offset,
            marker=marker, s=36, color=color, zorder=5,
        )


def _overlay_structure(ax, events: list[StructureEvent]) -> None:
    for ev in events:
        color = _COLOR_UP if ev.direction == "bull" else _COLOR_DOWN
        ax.axvline(ev.idx, color=color, linestyle=":", alpha=0.35, zorder=1)
        ax.text(
            ev.idx, ev.price, f" {ev.kind}",
            color=color, fontsize=7, va="center", zorder=6,
        )


def _overlay_fvgs(ax, fvgs: list[FairValueGap], x_max: int) -> None:
    for fvg in fvgs:
        if fvg.filled:
            continue
        color = _COLOR_FVG_BULL if fvg.direction == "bull" else _COLOR_FVG_BEAR
        ax.add_patch(Rectangle(
            (fvg.start_idx, fvg.low),
            max(1, x_max - fvg.start_idx),
            fvg.high - fvg.low,
            facecolor=color, alpha=0.12, edgecolor=color,
            linewidth=0.5, linestyle="--", zorder=1,
        ))


def _overlay_order_blocks(
    ax, obs: list[OrderBlock], x_max: int
) -> None:
    for ob in obs:
        if ob.mitigated:
            continue
        color = _COLOR_OB_BULL if ob.direction == "bull" else _COLOR_OB_BEAR
        ax.add_patch(Rectangle(
            (ob.idx, ob.low),
            max(1, x_max - ob.idx),
            ob.high - ob.low,
            facecolor=color, alpha=0.10, edgecolor=color,
            linewidth=0.7, zorder=1,
        ))


def _overlay_sweeps(ax, sweeps: list[LiquiditySweep]) -> None:
    for sw in sweeps:
        marker = "x"
        color = _COLOR_UP if sw.direction == "bull" else _COLOR_DOWN
        ax.scatter(
            sw.idx, sw.swept_price,
            marker=marker, s=52, color=color, zorder=6,
        )


def _overlay_levels(
    ax,
    entry: float | None,
    stop: float | None,
    targets: list[float] | None,
) -> None:
    if entry is not None:
        ax.axhline(entry, color=_COLOR_ENTRY, linewidth=1.1,
                   linestyle="-", alpha=0.8, zorder=4)
        ax.text(0, entry, " entry", fontsize=8, color=_COLOR_ENTRY,
                va="bottom", zorder=7)
    if stop is not None:
        ax.axhline(stop, color=_COLOR_STOP, linewidth=1.0,
                   linestyle="--", alpha=0.8, zorder=4)
        ax.text(0, stop, " SL", fontsize=8, color=_COLOR_STOP,
                va="bottom", zorder=7)
    for i, t in enumerate(targets or []):
        ax.axhline(t, color=_COLOR_TARGET, linewidth=0.9,
                   linestyle=":", alpha=0.7, zorder=4)
        ax.text(0, t, f" TP{i + 1}", fontsize=8, color=_COLOR_TARGET,
                va="bottom", zorder=7)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def render_chart(
    df: pd.DataFrame,
    out_path: Path,
    *,
    title: str = "",
    swings: list[SwingPoint] | None = None,
    structure: list[StructureEvent] | None = None,
    fvgs: list[FairValueGap] | None = None,
    order_blocks: list[OrderBlock] | None = None,
    sweeps: list[LiquiditySweep] | None = None,
    entry: float | None = None,
    stop: float | None = None,
    targets: list[float] | None = None,
    dpi: int = 110,
    figsize: tuple[float, float] = (11.0, 6.0),
) -> Path:
    """Render one OHLCV DataFrame with ICT overlays to `out_path`."""
    if df.empty:
        raise ValueError("render_chart: empty DataFrame")

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    try:
        _draw_candles(ax, df)
        x_max = len(df) - 1
        if fvgs:
            _overlay_fvgs(ax, fvgs, x_max)
        if order_blocks:
            _overlay_order_blocks(ax, order_blocks, x_max)
        if swings:
            _overlay_swings(ax, swings)
        if structure:
            _overlay_structure(ax, structure)
        if sweeps:
            _overlay_sweeps(ax, sweeps)
        _overlay_levels(ax, entry, stop, targets)

        _set_xticks(ax, df.index)
        ax.grid(True, alpha=0.25, zorder=0)
        ax.set_title(title, fontsize=11)
        ax.set_ylabel("price")
        fig.tight_layout()
        fig.savefig(out_path, dpi=dpi)
    finally:
        plt.close(fig)
    return out_path


def render_signal_charts(
    symbol: str,
    htf_df: pd.DataFrame,
    ltf_df: pd.DataFrame,
    out_dir: Path,
    *,
    signal: TradeSignal | None = None,
    htf_snapshot: IctSnapshot | None = None,
    ltf_snapshot: IctSnapshot | None = None,
) -> dict[str, Path]:
    """Render both chart files for one symbol into `out_dir`.

    Returns {"htf": <path>, "ltf": <path>} using cfg.LLM filenames so
    the LLM gate can locate them via its `chart_dir_by_symbol` map.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    htf_path = out_dir / str(cfg.LLM["chart_htf_filename"])
    ltf_path = out_dir / str(cfg.LLM["chart_ltf_filename"])

    entry = signal.entry if signal else None
    stop = signal.stop if signal else None
    targets = list(signal.targets) if signal else None

    def _snap_kwargs(snap: IctSnapshot | None) -> dict:
        if snap is None:
            return {}
        return dict(
            swings=snap.swings,
            structure=snap.structure,
            fvgs=snap.fvgs,
            order_blocks=snap.order_blocks,
            sweeps=snap.sweeps,
        )

    render_chart(
        htf_df, htf_path,
        title=f"{symbol} · HTF",
        entry=entry, stop=stop, targets=targets,
        **_snap_kwargs(htf_snapshot),
    )
    render_chart(
        ltf_df, ltf_path,
        title=f"{symbol} · LTF",
        entry=entry, stop=stop, targets=targets,
        **_snap_kwargs(ltf_snapshot),
    )
    return {"htf": htf_path, "ltf": ltf_path}
