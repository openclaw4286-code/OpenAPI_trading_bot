"""kis_ict_trader entrypoint.

Usage:
    python -m kis_ict_trader                 # scheduler mode (daemon)
    python -m kis_ict_trader --once          # single run_once pass, exit
    python -m kis_ict_trader --build-universe
    python -m kis_ict_trader --dry-run       # force dry_run (no orders)
    python -m kis_ict_trader --list-universe # print persisted universe

Scheduler layout (KST, cfg-driven):
  cfg.QUANT_SCREEN_TIME   daily  → build_daily_universe
  cfg.SESSION_OPEN..ENTRY_CUTOFF every cfg.LOOP_INTERVAL_SEC  → run_once
  Weekends are skipped automatically by APScheduler's day_of_week='mon-fri'.

run_once is reentrancy-protected via APScheduler's
max_instances=1 + coalesce=True — a slow pass won't overlap with the
next tick; missed ticks collapse into a single catch-up run.
"""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import logging
import signal
import sys
from logging.handlers import RotatingFileHandler

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from . import config as cfg
from .data.universe import (
    build_daily_universe,
    load_candidate_tickers,
    load_daily_universe,
)
from .execution.kis_client import KISClient
from .loop import LoopReport, run_once
from .observability.notify import make_notifier

log = logging.getLogger("kis_ict_trader")


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    root = logging.getLogger()
    root.setLevel(level)
    for h in list(root.handlers):
        root.removeHandler(h)

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-5s %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console = logging.StreamHandler(sys.stderr)
    console.setFormatter(fmt)
    root.addHandler(console)

    cfg.DIR_LOGS.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(
        cfg.DIR_LOGS / "ict_trader.log",
        maxBytes=10 * 1024 * 1024, backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    root.addHandler(fh)

    # Quiet down noisy libs at INFO+
    for noisy in ("httpx", "httpcore", "apscheduler"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Shared summary
# ---------------------------------------------------------------------------
def _log_report(report: LoopReport) -> None:
    elapsed = (report.finished_at - report.started_at).total_seconds()
    sig_count = sum(
        1 for r in report.decisions.values()
        if r.decision and r.decision.outcome == "signal"
    )
    log.info(
        "run_once finished: universe=%d signals=%d approved=%d "
        "submitted=%d elapsed=%.2fs error=%s",
        report.universe_size, sig_count, len(report.approved),
        len(report.submitted), elapsed, report.error or "-",
    )
    for symbol, ok, msg in report.submitted:
        log.info("  submit %s ok=%s %s", symbol, ok, msg)
    if report.reconcile and report.reconcile.stale_positions:
        stale = [p.symbol for p in report.reconcile.stale_positions]
        log.info("  stale positions (no current signal): %s", stale)


# ---------------------------------------------------------------------------
# One-shot modes
# ---------------------------------------------------------------------------
async def _cmd_once(dry_run: bool | None) -> int:
    report = await run_once(dry_run=dry_run, notifier=make_notifier())
    _log_report(report)
    return 0 if not report.error else 1


async def _cmd_build_universe() -> int:
    tickers = load_candidate_tickers()
    async with KISClient() as client:
        ranked = await build_daily_universe(client, tickers)
    log.info("built universe: %d entries persisted", len(ranked))
    return 0


def _cmd_list_universe() -> int:
    u = load_daily_universe()
    if not u:
        print("No persisted universe found.")
        return 1
    print(json.dumps({
        "date": u.get("date"),
        "built_at": u.get("built_at"),
        "top_n": u.get("top_n"),
        "count": len(u.get("entries") or []),
        "tickers": [
            (e.get("ticker"), e.get("name"), round(float(e.get("score", 0)), 3))
            for e in u.get("entries") or []
        ],
    }, ensure_ascii=False, indent=2))
    return 0


# ---------------------------------------------------------------------------
# Scheduler mode
# ---------------------------------------------------------------------------
def _cron(hhmm: str) -> CronTrigger:
    h, m = hhmm.split(":")
    return CronTrigger(
        day_of_week="mon-fri",
        hour=int(h), minute=int(m),
        timezone=cfg.TIMEZONE,
    )


async def _scheduled_run_once(dry_run: bool | None) -> None:
    try:
        report = await run_once(dry_run=dry_run, notifier=make_notifier())
        _log_report(report)
    except Exception:
        log.exception("run_once tick failed")


async def _scheduled_build_universe() -> None:
    try:
        tickers = load_candidate_tickers()
        async with KISClient() as client:
            ranked = await build_daily_universe(client, tickers)
        log.info("scheduled universe build: %d entries", len(ranked))
    except Exception:
        log.exception("universe build failed")


async def _run_scheduler(dry_run: bool | None) -> int:
    sched = AsyncIOScheduler(timezone=cfg.TIMEZONE)

    sched.add_job(
        _scheduled_build_universe,
        trigger=_cron(cfg.QUANT_SCREEN_TIME),
        id="build_universe",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
    )

    # Session-loop: 09:00..15:20 every LOOP_INTERVAL_SEC, Mon–Fri.
    # APScheduler doesn't have a native "cron window + interval" trigger,
    # so we start an IntervalTrigger and rely on cfg.ENTRY_CUTOFF guard
    # inside the strategy (near_close reject) to no-op past the cutoff.
    sched.add_job(
        _scheduled_run_once,
        args=(dry_run,),
        trigger=IntervalTrigger(
            seconds=max(5, int(cfg.LOOP_INTERVAL_SEC)),
            timezone=cfg.TIMEZONE,
        ),
        id="run_once",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )

    log.info(
        "scheduler started: tz=%s universe@%s loop_every=%ss "
        "session=%s..%s cutoff=%s dry_run=%s",
        cfg.TIMEZONE, cfg.QUANT_SCREEN_TIME, cfg.LOOP_INTERVAL_SEC,
        cfg.SESSION_OPEN, cfg.SESSION_CLOSE, cfg.ENTRY_CUTOFF,
        cfg.TEST_MODE if dry_run is None else dry_run,
    )

    sched.start()

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        # Windows fallback — signals fall through to KeyboardInterrupt there.
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, stop.set)

    try:
        await stop.wait()
    finally:
        log.info("scheduler stopping …")
        sched.shutdown(wait=False)
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="kis_ict_trader",
        description="KIS OpenAPI ICT trading agent.",
    )
    mode = p.add_mutually_exclusive_group()
    mode.add_argument(
        "--once", action="store_true",
        help="Run a single run_once pass then exit.",
    )
    mode.add_argument(
        "--build-universe", action="store_true",
        help="Build + persist the daily universe then exit.",
    )
    mode.add_argument(
        "--list-universe", action="store_true",
        help="Print the persisted daily_universe.json summary.",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Force dry-run (no orders submitted). "
             "Overrides cfg.TEST_MODE when set.",
    )
    p.add_argument(
        "--live", action="store_true",
        help="Force live mode (submit orders) even if cfg.TEST_MODE is True. "
             "Mutually exclusive with --dry-run.",
    )
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)
    if args.dry_run and args.live:
        p.error("--dry-run and --live are mutually exclusive")
    return args


def _resolve_dry_run(args: argparse.Namespace) -> bool | None:
    if args.dry_run:
        return True
    if args.live:
        return False
    return None  # fall through to cfg.TEST_MODE inside run_once


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    _setup_logging(args.verbose)
    cfg.validate()

    dry_run = _resolve_dry_run(args)

    if args.list_universe:
        return _cmd_list_universe()

    try:
        if args.build_universe:
            return asyncio.run(_cmd_build_universe())
        if args.once:
            return asyncio.run(_cmd_once(dry_run))
        return asyncio.run(_run_scheduler(dry_run))
    except KeyboardInterrupt:
        log.info("interrupted by user")
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
