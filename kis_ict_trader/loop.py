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
import os
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
from .algorithm.position_manager import (
    ManagementAction,
    PositionState,
    manage_position,
)
from .algorithm.position_sizing import SizingResult, compute_size
from .chart.renderer import render_signal_charts
from .data.fetcher import (
    get_current_price,
    get_daily_ohlcv,
    get_historical_minute_ohlcv,
    get_minute_ohlcv,
)
from .data.universe import load_daily_universe
from .execution.kis_client import KISClient
from .execution.order_lifecycle import (
    RetryAction,
    RetryPolicy,
    find_pending,
    retry_stale_limits,
)
from .execution.orders import (
    AccountBalance,
    OrderRequest,
    ReconcileResult,
    build_entry_order,
    get_balance,
    place_order,
    reconcile_positions,
)
from .llm.gate import CliRunner, LlmVerdict, evaluate_candidates
from .observability.notify import Notifier, NoopNotifier
from .observability.state import (
    load_loop_state,
    load_positions,
    load_retry_counts,
    record_run,
    save_loop_state,
    save_positions,
    set_retry_counts,
)
from .signals.ictsignals import IctSnapshot, detect_all, evaluate_mtf_entry


log = logging.getLogger(__name__)

HTF_LOOKBACK_DAYS: int = 365
MIN_HTF_BARS: int = 40
MIN_LTF_BARS: int = 20
DEFAULT_CONCURRENCY: int = 6

# MTF source selection (env-configurable; default preserves existing
# D/D/15m behaviour so deployments aren't forced onto the historical
# minute endpoint until they opt in):
#   "daily"          — MTF = daily (legacy, used when history minutes
#                       aren't available or the operator wants a lower
#                       API-call profile)
#   "h4"             — MTF = 240-minute bars built from past-session
#                       minutes via get_historical_minute_ohlcv. Matches
#                       the ICT spec (D / 4h / 15m).
MTF_MODE_ENV: str = os.getenv("KIS_MTF_MODE", "daily").strip().lower()
MTF_H4_DAYS_BACK: int = int(os.getenv("KIS_MTF_H4_DAYS_BACK", "20"))


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
class ManagementRecord:
    symbol: str
    kind: str                              # action kind (hold/move_stop/close_*)
    qty: int
    price: float
    reason: str
    submitted: bool                        # did an order actually go out?
    detail: str = ""                       # order_no, error, or "dry_run"


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
    open_positions_before: int = 0
    open_positions_after: int = 0
    management: list[ManagementRecord] = field(default_factory=list)
    retry_actions: list[RetryAction] = field(default_factory=list)
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
    client: KISClient,
    ticker: str,
    *,
    mtf_mode: str | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None:
    """Return (HTF, MTF, LTF) for `ticker`.

    HTF is weekly-resampled daily OHLCV (always).
    LTF is 15-minute OHLCV for today (always).

    MTF depends on `mtf_mode` (falls back to module default from
    KIS_MTF_MODE):
      "daily" → daily OHLCV (legacy; minimal API calls)
      "h4"    → 4-hour bars built from past-session minute data via
                get_historical_minute_ohlcv; if that returns too few
                bars we fall back to daily so the pipeline still
                produces a confluence snapshot.
    """
    mode = (mtf_mode or MTF_MODE_ENV).lower()
    today = datetime.now()
    start = today - timedelta(days=HTF_LOOKBACK_DAYS)
    daily = await get_daily_ohlcv(client, ticker, start, today)
    if daily.empty or len(daily) < MIN_HTF_BARS:
        return None
    htf = _resample_weekly(daily)
    if htf.empty or len(htf) < 10:
        return None

    if mode == "h4":
        try:
            h4 = await get_historical_minute_ohlcv(
                client, ticker,
                days_back=MTF_H4_DAYS_BACK, interval_minutes=240,
            )
        except Exception as e:
            log.warning("h4 MTF fetch failed for %s: %s — falling back to daily",
                        ticker, e)
            h4 = pd.DataFrame()
        mtf = h4 if (not h4.empty and len(h4) >= 10) else daily
    else:
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
    notifier: Notifier | None = None,
) -> LoopReport:
    started = datetime.now()
    report = LoopReport(
        started_at=started, finished_at=started, universe_size=0,
    )
    owns_client = client is None
    if client is None:
        client = KISClient()
        await client.__aenter__()

    notify = notifier or NoopNotifier()
    open_positions = load_positions()
    report.open_positions_before = len(open_positions)
    dry = bool(cfg.TEST_MODE) if dry_run is None else bool(dry_run)

    persisted_state = load_loop_state()
    retry_counts = load_retry_counts(persisted_state)

    try:
        # -- refresh stale limit orders (cancel-replace) ------------------
        try:
            report.retry_actions = await _refresh_pending_orders(
                client, notify=notify, dry=dry, retry_counts=retry_counts,
            )
        except Exception as e:
            log.warning("retry refresh failed: %s", e)
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

        # -- balance + exposure -------------------------------------------
        # Always fetch — both sizing and position management benefit
        # from a fresh account snapshot.
        try:
            balance = await get_balance(client)
            report.balance = balance
            total_exp, by_sym = _exposure_from_balance(balance)
        except Exception as e:
            log.warning("balance fetch failed: %s", e)
            balance = None
            total_exp, by_sym = 0.0, {}

        if not signals or balance is None:
            await _manage_open_positions(
                client, open_positions, report, dry=dry, notify=notify,
            )
            return report

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
            await _manage_open_positions(
                client, open_positions, report, dry=dry, notify=notify,
            )
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
        for sig in rec_result.to_submit:
            qty = size_by_symbol[sig.symbol]
            req = build_entry_order(sig, qty)
            if dry:
                report.submitted.append((
                    sig.symbol, True, f"dry_run qty={qty} @ {sig.entry}",
                ))
                open_positions[sig.symbol] = PositionState.from_signal(sig, qty)
                await notify.info(
                    f"entry {sig.symbol} (dry)",
                    f"qty={qty} @ {sig.entry:.2f} stop={sig.stop:.2f} "
                    f"tp={[round(t,2) for t in sig.targets]} rr={sig.rr:.2f}",
                )
                continue
            res = await place_order(client, req)
            detail = res.error or res.order_no
            report.submitted.append((sig.symbol, res.ok, detail))
            if res.ok:
                open_positions[sig.symbol] = PositionState.from_signal(sig, qty)
                await notify.info(
                    f"entry {sig.symbol}",
                    f"qty={qty} @ {sig.entry:.2f} stop={sig.stop:.2f} "
                    f"ord={res.order_no}",
                )
            else:
                await notify.warn(
                    f"entry failed {sig.symbol}", detail,
                )

        # -- manage open positions ----------------------------------------
        await _manage_open_positions(
            client, open_positions, report, dry=dry, notify=notify,
        )

    except Exception as e:
        log.exception("run_once failed")
        report.error = f"{type(e).__name__}: {e}"
        try:
            await notify.error("run_once exception", str(e))
        except Exception:
            pass
    finally:
        report.finished_at = datetime.now()
        report.open_positions_after = len(open_positions)

        # persist observability state
        try:
            save_positions(open_positions)
            loop_state = load_loop_state()
            n_signals = sum(
                1 for r in report.decisions.values()
                if r.decision and r.decision.outcome == "signal"
            )
            loop_state = record_run(
                loop_state,
                started_at=report.started_at,
                finished_at=report.finished_at,
                universe_size=report.universe_size,
                n_signals=n_signals,
                n_approved=len(report.approved),
                submitted=report.submitted,
                error=report.error,
            )
            loop_state = set_retry_counts(loop_state, retry_counts)
            save_loop_state(loop_state)
        except Exception:
            log.exception("observability persistence failed")

        # drop heavy transient frames before the report leaves this scope
        for r in report.decisions.values():
            r._htf = r._mtf = r._ltf = None
            r._htf_snap = r._ltf_snap = None
        if owns_client:
            await client.close()

    return report


# ---------------------------------------------------------------------------
# Position management
# ---------------------------------------------------------------------------
async def _frames_for_managed(
    client: KISClient,
    symbol: str,
    report: LoopReport,
) -> tuple[pd.DataFrame, IctSnapshot] | None:
    """Reuse frames already fetched this cycle; fall back to a fresh
    fetch for positions held outside today's universe."""
    rec = report.decisions.get(symbol)
    if rec is not None and rec._ltf is not None:
        ltf = rec._ltf
        if rec._ltf_snap is None:
            rec._ltf_snap = detect_all(ltf)
        return ltf, rec._ltf_snap
    try:
        frames = await _fetch_frames(client, symbol)
    except Exception as e:
        log.warning("management fetch failed for %s: %s", symbol, e)
        return None
    if frames is None:
        return None
    _, _, ltf = frames
    return ltf, detect_all(ltf)


async def _manage_open_positions(
    client: KISClient,
    open_positions: dict[str, PositionState],
    report: LoopReport,
    *,
    dry: bool,
    notify: Notifier,
) -> None:
    """Run position_manager.manage_position against each open position,
    translate the resulting actions into KIS orders, and clear symbols
    that have been fully closed out."""
    if not open_positions:
        return

    for symbol in list(open_positions.keys()):
        state = open_positions[symbol]
        got = await _frames_for_managed(client, symbol, report)
        if got is None:
            report.management.append(ManagementRecord(
                symbol=symbol, kind="hold", qty=0, price=0.0,
                reason="no_frames", submitted=False,
            ))
            continue
        ltf, snap = got
        bar = ltf.iloc[-1]
        actions = manage_position(state, bar, snap.swings)

        for act in actions:
            if act.kind == "hold":
                report.management.append(ManagementRecord(
                    symbol=symbol, kind="hold", qty=0, price=0.0,
                    reason=act.reason, submitted=False,
                ))
                continue

            if act.kind == "move_stop":
                # State-only change — no broker stop order in this pipeline;
                # the next bar's manage_position() will detect a real stop hit.
                report.management.append(ManagementRecord(
                    symbol=symbol, kind="move_stop", qty=0,
                    price=act.price, reason=act.reason,
                    submitted=False, detail="state_only",
                ))
                continue

            if act.kind in ("close_partial", "close_all"):
                await _submit_exit(
                    client, symbol, act, state, report,
                    dry=dry, notify=notify,
                )

        if state.remaining_qty <= 0:
            open_positions.pop(symbol, None)


async def _refresh_pending_orders(
    client: KISClient,
    *,
    notify: Notifier,
    dry: bool,
    retry_counts: dict[str, int],
    policy: RetryPolicy | None = None,
) -> list[RetryAction]:
    """Cancel-replace stale limit orders at the top of each tick.

    In dry-run, the loop still *queries* pending orders (so the report
    is honest about what's sitting unfilled) but never submits a
    revise — that would touch the real account. Everything comes back
    as `skipped:dry_run` in the audit list.
    """
    try:
        pending = await find_pending(client)
    except Exception as e:
        log.warning("find_pending failed: %s", e)
        return []
    if not pending:
        return []

    if dry:
        return [
            RetryAction(
                order_no=p.order_no, symbol=p.symbol, reason="skipped:dry_run",
            )
            for p in pending
        ]

    current_prices: dict[str, float] = {}
    for status in pending:
        try:
            out = await get_current_price(client, status.symbol)
            px = float(out.get("stck_prpr", 0) or 0)
            if px > 0:
                current_prices[status.symbol] = px
        except Exception as e:
            log.warning("price fetch failed for %s: %s", status.symbol, e)

    actions = await retry_stale_limits(
        client,
        current_prices=current_prices,
        policy=policy,
        retry_counts=retry_counts,
        pending=pending,
    )

    for act in actions:
        if act.replace_result is not None and act.replace_result.ok:
            await notify.info(
                f"repriced {act.symbol}",
                f"ord={act.order_no} reason={act.reason}",
            )
        elif act.replace_result is not None and not act.replace_result.ok:
            await notify.warn(
                f"reprice failed {act.symbol}",
                f"ord={act.order_no} err={act.replace_result.error}",
            )
    return actions


async def _submit_exit(
    client: KISClient,
    symbol: str,
    act: ManagementAction,
    state: PositionState,
    report: LoopReport,
    *,
    dry: bool,
    notify: Notifier,
) -> None:
    side = "sell" if state.signal.direction == "bull" else "buy"
    # stop_hit is a live risk event → market order; targets are limits.
    division = "market" if act.reason == "stop_hit" else "limit"
    req = OrderRequest(
        symbol=symbol, side=side, quantity=int(act.qty),
        division=division,
        price=(0.0 if division == "market" else float(act.price)),
        client_tag=f"exit:{act.reason}",
    )

    if dry:
        report.management.append(ManagementRecord(
            symbol=symbol, kind=act.kind, qty=int(act.qty),
            price=float(act.price), reason=act.reason,
            submitted=True, detail="dry_run",
        ))
        await notify.info(
            f"exit {symbol} ({act.reason}, dry)",
            f"{act.kind} qty={act.qty} @ {act.price:.2f}",
        )
        return

    res = await place_order(client, req)
    detail = res.error or res.order_no
    report.management.append(ManagementRecord(
        symbol=symbol, kind=act.kind, qty=int(act.qty),
        price=float(act.price), reason=act.reason,
        submitted=res.ok, detail=detail,
    ))
    if res.ok:
        await notify.info(
            f"exit {symbol} ({act.reason})",
            f"{act.kind} qty={act.qty} @ {act.price:.2f} ord={res.order_no}",
        )
    else:
        await notify.warn(
            f"exit failed {symbol} ({act.reason})", detail,
        )
