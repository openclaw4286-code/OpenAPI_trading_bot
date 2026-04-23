"""End-to-end ICT loop:
universe → multi-TF data → MTF confluence → strategy → sizing →
charts → LLM gate → reconcile vs. positions → place orders.

`run_once(...)` is a single pass suitable for periodic invocation by
a scheduler (cron / APScheduler / systemd timer). The caller owns
scheduling policy (interval, jitter, session windows) — this module
is stateless apart from a per-call `SignalGate`.

Timeframe mapping (current data constraints):
  HTF = weekly (resampled from daily OHLCV, last ~1 year)
  MTF = daily  (as fetched)
  LTF = 15m    (today's session only — KIS intraday TR is today-only)

The config specifies D/4h/15m, but KIS's minute TR doesn't cover
historical intraday, so 4h-aggregated bars aren't retrievable yet.
Using W/D/15m preserves the three-level confluence structure (long-
term bias → swing structure → entry trigger) within current limits.
A future step can swap MTF to 4h once historical minute data is wired.

Dry-run rules:
- If `dry_run` is True, or `cfg.TEST_MODE` is True and no explicit
  override, orders are NOT submitted — they're recorded in the
  report as `(symbol, True, "dry_run qty=N")`.
- Bearish trades are already filtered out at the strategy layer when
  `cfg.ALLOW_SHORT` is False, so no extra guard here.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from . import config as cfg
from .algorithm.ict_strategy import (
    SignalDecision,
    SignalGate,
    TradeSignal,
    build_signal,
)
from .algorithm.position_sizing import SizingResult, compute_size
from .chart.renderer import render_signal_charts
from .data.fetcher import get_daily_ohlcv, get_minute_ohlcv
from .data.universe import load_daily_universe
from .execution.kis_client import KISClient
from .execution.orders import (
    AccountBalance,
    ReconcileResult,
    build_entry_order,
    get_balance,
    place_order,
    reconcile_positions,
)
from .llm.gate import CliRunner, LlmVerdict, evaluate_candidates
from .signals.ictsignals import IctSnapshot, detect_all, evaluate_mtf_entry


log = logging.getLogger(__name__)

HTF_LOOKBACK_DAYS: int = 365
MIN_HTF_BARS: int = 40
MIN_LTF_BARS: int = 20
DEFAULT_CONCURRENCY: int = 6


# ---------------------------------------------------------------------------
# Per-run records
# ---------------------------------------------------------------------------
@dataclass
class PerSymbolResult:
    symbol: str
    decision: SignalDecision | None = None
    sizing: SizingResult | None = None
    error: str = ""
    # transient frames retained so the chart layer can reuse them without
    # re-hitting KIS; set to None before the report is logged.
    _htf: pd.DataFrame | None = None
    _mtf: pd.DataFrame | None = None
    _ltf: pd.DataFrame | None = None
    _htf_snap: IctSnapshot | None = None
    _ltf_snap: IctSnapshot | None = None


@dataclass
class LoopReport:
    started_at: datetime
    finished_at: datetime
    universe_size: int
    decisions: dict[str, PerSymbolResult] = field(default_factory=dict)
    balance: AccountBalance | None = None
    approved: list[str] = field(default_factory=list)
    submitted: list[tuple[str, bool, str]] = field(default_factory=list)
    llm_verdicts: list[LlmVerdict] = field(default_factory=list)
    reconcile: ReconcileResult | None = None
    error: str = ""


# ---------------------------------------------------------------------------
# Timeframe plumbing
# ---------------------------------------------------------------------------
def _resample_weekly(daily: pd.DataFrame) -> pd.DataFrame:
    return (
        daily.resample("W")
        .agg(
            {
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
                "volume": "sum",
            }
        )
        .dropna(subset=["open", "high", "low", "close"])
    )


async def _fetch_frames(
    client: KISClient, ticker: str
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None:
    today = datetime.now()
    start = today - timedelta(days=HTF_LOOKBACK_DAYS)
    daily = await get_daily_ohlcv(client, ticker, start, today)
    if daily.empty or len(daily) < MIN_HTF_BARS:
        return None
    htf = _resample_weekly(daily)
    if htf.empty or len(htf) < 10:
        return None
    mtf = daily
    ltf = await get_minute_ohlcv(client, ticker, interval_minutes=15)
    if ltf.empty or len(ltf) < MIN_LTF_BARS:
        return None
    return htf, mtf, ltf


# ---------------------------------------------------------------------------
# Per-symbol evaluation
# ---------------------------------------------------------------------------
async def _evaluate_symbol(
    client: KISClient,
    symbol: str,
    gate: SignalGate,
    sem: asyncio.Semaphore,
) -> PerSymbolResult:
    async with sem:
        try:
            frames = await _fetch_frames(client, symbol)
        except Exception as e:
            log.warning("fetch failed for %s: %s", symbol, e)
            return PerSymbolResult(symbol=symbol, error=f"fetch_error: {e}")

        if frames is None:
            return PerSymbolResult(symbol=symbol, error="insufficient_data")

        htf, mtf, ltf = frames
        try:
            conf = evaluate_mtf_entry(htf, mtf, ltf)
            decision = build_signal(symbol, conf, ltf, gate=gate)
        except Exception as e:
            log.exception("strategy failed for %s", symbol)
            return PerSymbolResult(symbol=symbol, error=f"strategy_error: {e}")

        return PerSymbolResult(
            symbol=symbol,
            decision=decision,
            _htf=htf,
            _mtf=mtf,
            _ltf=ltf,
        )


# ---------------------------------------------------------------------------
# Exposure bookkeeping
# ---------------------------------------------------------------------------
def _exposure_from_balance(
    bal: AccountBalance,
) -> tuple[float, dict[str, float]]:
    if bal.total_eval <= 0:
        return 0.0, {}
    total = 0.0
    by_sym: dict[str, float] = {}
    for p in bal.positions:
        pct = p.eval_amount / bal.total_eval
        total += pct
        by_sym[p.symbol] = by_sym.get(p.symbol, 0.0) + pct
    return total, by_sym


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------
async def run_once(
    *,
    client: KISClient | None = None,
    universe: list[str] | None = None,
    dry_run: bool | None = None,
    chart_base_dir: Path | None = None,
    llm_runner: CliRunner | None = None,
    concurrency: int = DEFAULT_CONCURRENCY,
) -> LoopReport:
    started = datetime.now()
    report = LoopReport(
        started_at=started, finished_at=started, universe_size=0,
    )
    owns_client = client is None
    if client is None:
        client = KISClient()
        await client.__aenter__()

    try:
        # -- universe ------------------------------------------------------
        if universe is None:
            u = load_daily_universe() or {}
            entries = u.get("entries") or []
            universe = [str(e.get("ticker", "")) for e in entries if e.get("ticker")]
        report.universe_size = len(universe)
        if not universe:
            report.error = "empty_universe"
            return report

        # -- per-symbol evaluation ----------------------------------------
        gate = SignalGate()
        sem = asyncio.Semaphore(max(1, int(concurrency)))
        per = await asyncio.gather(*[
            _evaluate_symbol(client, s, gate, sem) for s in universe
        ])
        report.decisions = {r.symbol: r for r in per}

        signals: list[TradeSignal] = [
            r.decision.signal
            for r in per
            if r.decision
            and r.decision.outcome == "signal"
            and r.decision.signal is not None
        ]
        if not signals:
            return report

        # -- balance + exposure -------------------------------------------
        try:
            balance = await get_balance(client)
        except Exception as e:
            report.error = f"balance_error: {e}"
            return report
        report.balance = balance
        total_exp, by_sym = _exposure_from_balance(balance)

        # -- sizing (running totals so caps apply cumulatively) -----------
        size_by_symbol: dict[str, int] = {}
        for sig in signals:
            rec = report.decisions[sig.symbol]
            sr = compute_size(
                sig,
                equity=max(balance.total_eval, 1.0),
                current_total_exposure=total_exp,
                current_symbol_exposure=by_sym.get(sig.symbol, 0.0),
            )
            rec.sizing = sr
            if sr.reason == "ok":
                size_by_symbol[sig.symbol] = sr.shares
                total_exp += sr.position_pct
                by_sym[sig.symbol] = (
                    by_sym.get(sig.symbol, 0.0) + sr.position_pct
                )

        sized = [s for s in signals if size_by_symbol.get(s.symbol, 0) > 0]
        if not sized:
            return report

        # -- charts --------------------------------------------------------
        chart_dirs: dict[str, Path] = {}
        if chart_base_dir is not None:
            base = Path(chart_base_dir)
            for sig in sized:
                rec = report.decisions[sig.symbol]
                if rec._htf is None or rec._ltf is None:
                    continue
                if rec._htf_snap is None:
                    rec._htf_snap = detect_all(rec._htf)
                if rec._ltf_snap is None:
                    rec._ltf_snap = detect_all(rec._ltf)
                try:
                    out_dir = base / sig.symbol
                    render_signal_charts(
                        sig.symbol, rec._htf, rec._ltf, out_dir,
                        signal=sig,
                        htf_snapshot=rec._htf_snap,
                        ltf_snapshot=rec._ltf_snap,
                    )
                    chart_dirs[sig.symbol] = out_dir
                except Exception as e:
                    log.warning("chart render failed for %s: %s", sig.symbol, e)

        # -- LLM gate ------------------------------------------------------
        verdicts = evaluate_candidates(
            sized,
            chart_dir_by_symbol=chart_dirs or None,
            cli_runner=llm_runner,
        )
        report.llm_verdicts = verdicts
        approved_syms = {v.symbol for v in verdicts if v.approved}
        approved = [s for s in sized if s.symbol in approved_syms]
        report.approved = [s.symbol for s in approved]

        # -- reconcile vs. current holdings -------------------------------
        rec_result = reconcile_positions(
            approved, size_by_symbol, balance.positions,
        )
        report.reconcile = rec_result

        # -- submit --------------------------------------------------------
        dry = bool(cfg.TEST_MODE) if dry_run is None else bool(dry_run)
        for sig in rec_result.to_submit:
            qty = size_by_symbol[sig.symbol]
            req = build_entry_order(sig, qty)
            if dry:
                report.submitted.append((
                    sig.symbol, True, f"dry_run qty={qty} @ {sig.entry}",
                ))
                continue
            res = await place_order(client, req)
            report.submitted.append((
                sig.symbol, res.ok, res.error or res.order_no,
            ))

    except Exception as e:
        log.exception("run_once failed")
        report.error = f"{type(e).__name__}: {e}"
    finally:
        report.finished_at = datetime.now()
        # drop heavy transient frames before the report leaves this scope
        for r in report.decisions.values():
            r._htf = r._mtf = r._ltf = None
            r._htf_snap = r._ltf_snap = None
        if owns_client:
            await client.close()

    return report
