"""Durable loop + open-position state (atomic JSON on disk).

Two payloads live side-by-side under `cfg.DIR_STATE/`:

  loop_state.json       — last-run summary, recent submissions,
                          rolling daily P&L aggregates.
  positions.json        — PositionState per open symbol, so trailing
                          stops / tranche flags survive process
                          restarts.

All writes go through `_atomic_write` (tmp file + rename) so a crash
mid-write cannot corrupt the file. Reads swallow FileNotFound and
JSON errors returning an empty-but-valid structure.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

import pandas as pd

from .. import config as cfg
from ..algorithm.ict_strategy import TradeSignal
from ..algorithm.position_manager import PositionState
from ..algorithm.signal_quality import SymbolQuality


log = logging.getLogger(__name__)

PATH_POSITION_STATE: Path = cfg.DIR_STATE / "positions.json"
PATH_SIGNAL_QUALITY: Path = cfg.DIR_STATE / "signal_quality.json"
MAX_RECENT_SUBMISSIONS: int = 50


# ---------------------------------------------------------------------------
# Atomic write
# ---------------------------------------------------------------------------
def _atomic_write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    tmp.replace(path)


def _read_json(path: Path, default: dict) -> dict:
    if not path.exists():
        return dict(default)
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception as e:
        log.warning("%s unreadable (%s) — falling back to default", path, e)
        return dict(default)


# ---------------------------------------------------------------------------
# TradeSignal / PositionState <-> dict
# ---------------------------------------------------------------------------
def _signal_to_dict(sig: TradeSignal) -> dict:
    return {
        "symbol": sig.symbol,
        "direction": sig.direction,
        "entry": float(sig.entry),
        "stop": float(sig.stop),
        "targets": [float(t) for t in sig.targets],
        "rr": float(sig.rr),
        "poi_kind": sig.poi_kind,
        "trigger_kind": sig.trigger_kind,
        "session": sig.session,
        "ts": sig.ts.isoformat() if hasattr(sig.ts, "isoformat") else str(sig.ts),
        "meta": dict(sig.meta or {}),
    }


def _signal_from_dict(d: dict) -> TradeSignal:
    return TradeSignal(
        symbol=str(d["symbol"]),
        direction=d["direction"],
        entry=float(d["entry"]),
        stop=float(d["stop"]),
        targets=[float(t) for t in d["targets"]],
        rr=float(d["rr"]),
        poi_kind=d.get("poi_kind"),
        trigger_kind=str(d.get("trigger_kind", "")),
        session=str(d.get("session", "")),
        ts=pd.Timestamp(d["ts"]),
        meta=dict(d.get("meta") or {}),
    )


def position_state_to_dict(state: PositionState) -> dict:
    return {
        "signal": _signal_to_dict(state.signal),
        "initial_qty": int(state.initial_qty),
        "remaining_qty": int(state.remaining_qty),
        "current_stop": float(state.current_stop),
        "tp1_done": bool(state.tp1_done),
        "tp2_done": bool(state.tp2_done),
        "tp3_done": bool(state.tp3_done),
        "max_favorable": float(state.max_favorable),
        "max_adverse": float(state.max_adverse),
    }


def position_state_from_dict(d: dict) -> PositionState:
    entry = float(d["signal"]["entry"])
    return PositionState(
        signal=_signal_from_dict(d["signal"]),
        initial_qty=int(d["initial_qty"]),
        remaining_qty=int(d["remaining_qty"]),
        current_stop=float(d["current_stop"]),
        tp1_done=bool(d.get("tp1_done", False)),
        tp2_done=bool(d.get("tp2_done", False)),
        tp3_done=bool(d.get("tp3_done", False)),
        max_favorable=float(d.get("max_favorable", entry)),
        max_adverse=float(d.get("max_adverse", entry)),
    )


# ---------------------------------------------------------------------------
# Position state (per-symbol dict)
# ---------------------------------------------------------------------------
def load_positions(path: Path | None = None) -> dict[str, PositionState]:
    p = path or PATH_POSITION_STATE
    raw = _read_json(p, {})
    out: dict[str, PositionState] = {}
    for sym, payload in (raw or {}).items():
        try:
            out[sym] = position_state_from_dict(payload)
        except Exception as e:
            log.warning("positions[%s] dropped (corrupt): %s", sym, e)
    return out


def save_positions(
    positions: dict[str, PositionState], path: Path | None = None
) -> Path:
    p = path or PATH_POSITION_STATE
    payload = {
        sym: position_state_to_dict(state)
        for sym, state in positions.items()
        if state.remaining_qty > 0
    }
    _atomic_write(p, payload)
    return p


# ---------------------------------------------------------------------------
# Loop state
# ---------------------------------------------------------------------------
def load_loop_state(path: Path | None = None) -> dict:
    p = path or cfg.PATH_LOOP_STATE
    default = {
        "last_run_at": None,
        "last_run_summary": None,
        "recent_submitted": [],
        "daily_pnl": {},
    }
    return _read_json(p, default)


def save_loop_state(state: dict, path: Path | None = None) -> Path:
    p = path or cfg.PATH_LOOP_STATE
    _atomic_write(p, state)
    return p


def record_run(
    state: dict,
    *,
    started_at: datetime,
    finished_at: datetime,
    universe_size: int,
    n_signals: int,
    n_approved: int,
    submitted: list[tuple[str, bool, str]],
    error: str = "",
) -> dict:
    """Merge a completed run into loop_state (pure — returns new dict)."""
    out = dict(state)
    elapsed = (finished_at - started_at).total_seconds()
    out["last_run_at"] = finished_at.isoformat(timespec="seconds")
    out["last_run_summary"] = {
        "started_at": started_at.isoformat(timespec="seconds"),
        "elapsed_s": round(elapsed, 3),
        "universe_size": int(universe_size),
        "signals": int(n_signals),
        "approved": int(n_approved),
        "submitted": len(submitted),
        "error": error or None,
    }

    recent = list(out.get("recent_submitted") or [])
    for sym, ok, detail in submitted:
        recent.append({
            "ts": finished_at.isoformat(timespec="seconds"),
            "symbol": sym,
            "ok": bool(ok),
            "detail": str(detail),
        })
    out["recent_submitted"] = recent[-MAX_RECENT_SUBMISSIONS:]
    return out


def record_daily_pnl(
    state: dict,
    date_key: str,
    *,
    pnl_cash: float,
    n_trades: int,
    n_wins: int,
    r_sum: float,
) -> dict:
    """Accumulate end-of-day P&L aggregates for one date."""
    out = dict(state)
    daily = dict(out.get("daily_pnl") or {})
    prev = daily.get(date_key, {
        "trades": 0, "wins": 0, "pnl_cash": 0.0, "r_sum": 0.0,
    })
    daily[date_key] = {
        "trades": int(prev["trades"]) + int(n_trades),
        "wins": int(prev["wins"]) + int(n_wins),
        "pnl_cash": float(prev["pnl_cash"]) + float(pnl_cash),
        "r_sum": float(prev["r_sum"]) + float(r_sum),
    }
    out["daily_pnl"] = daily
    return out


# ---------------------------------------------------------------------------
# Retry-count persistence (used by loop.py for price-revise rate limiting)
# ---------------------------------------------------------------------------
def load_retry_counts(state: dict) -> dict[str, int]:
    raw = state.get("retry_counts") or {}
    out: dict[str, int] = {}
    for k, v in raw.items():
        try:
            out[str(k)] = int(v)
        except (TypeError, ValueError):
            continue
    return out


def set_retry_counts(state: dict, counts: dict[str, int]) -> dict:
    out = dict(state)
    out["retry_counts"] = {str(k): int(v) for k, v in counts.items() if v > 0}
    return out


# ---------------------------------------------------------------------------
# Per-symbol signal quality (MFE / MAE / win-rate)
# ---------------------------------------------------------------------------
def load_signal_quality(path: Path | None = None) -> dict[str, SymbolQuality]:
    p = path or PATH_SIGNAL_QUALITY
    raw = _read_json(p, {})
    out: dict[str, SymbolQuality] = {}
    for sym, payload in (raw or {}).items():
        try:
            # Tolerate both bare dicts and files written with the derived
            # win_rate/avg_r fields embedded.
            out[sym] = SymbolQuality.from_dict(
                payload if isinstance(payload, dict) else {}
            )
        except Exception as e:
            log.warning("signal_quality[%s] dropped (corrupt): %s", sym, e)
    return out


def save_signal_quality(
    qualities: dict[str, SymbolQuality], path: Path | None = None,
) -> Path:
    p = path or PATH_SIGNAL_QUALITY
    payload = {sym: q.to_dict() for sym, q in qualities.items()}
    _atomic_write(p, payload)
    return p
