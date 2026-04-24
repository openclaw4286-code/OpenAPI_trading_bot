"""Historical backtest for the ICT stack (daily bars).

Replays `evaluate_mtf_entry` + `build_signal` + `compute_size` bar-by-bar
on historical daily data, simulates fills against same-bar / next-bar
OHLC and aggregates trade-by-trade P&L.

Scope:
- Daily bars only. KIS's minute TR is today-only, so proper 15m replay
  is not supported yet. Timeframe approximation here:
      HTF = weekly   (resampled)
      MTF = daily
      LTF = daily tail (trailing `ltf_window` bars)
  This keeps the same 3-level confluence shape used in live, just at a
  lower resolution — good enough for sanity-checking the strategy's
  edge on historical data.
- Long-only (cfg.ALLOW_SHORT assumed False). Bear signals are skipped.
- Single-entry per symbol at a time; signal emitted while a trade is
  open is ignored.

Fill models:
  * single-exit (default): legacy path, one entry + one exit at the
    chosen `exit_target_idx` / stop / timeout.
  * split_exits=True: shares `algorithm.position_manager.manage_position`
    with live so tranches (50% at TP1 + BE, 50% of remaining at TP2
    + trail, TP3 flatten, stop flatten) execute against historical
    bars. The aggregate P&L is the weighted sum across tranches.

Additional hooks:
  * llm_approve(signal, ltf) -> bool: when provided, the backtest
    calls it per signal and skips the entry if it returns False. Use
    a stub that mimics your LLM gate policy to evaluate how much the
    gate gives up vs. catches.
  * per-symbol SymbolQuality records are always populated; the report
    exposes `quality_by_symbol` for downstream filter tuning.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Sequence

import pandas as pd

from .. import config as cfg
from ..algorithm.ict_strategy import SignalGate, TradeSignal, build_signal
from ..algorithm.position_manager import (
    ManagementAction,
    PositionState,
    manage_position,
)
from ..algorithm.position_sizing import SizingResult, compute_size
from ..algorithm.signal_quality import (
    SymbolQuality,
    TradeOutcome,
    update_quality,
)
from ..signals.ictsignals import evaluate_mtf_entry


log = logging.getLogger(__name__)


LlmApproveFn = Callable[[TradeSignal, pd.DataFrame], bool]


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class ExitTranche:
    """One leg of a split exit (TP1 / TP2 / TP3 / stop / timeout)."""
    ts: pd.Timestamp
    price: float
    qty: int
    reason: str
    r_multiple: float = 0.0


@dataclass
class BacktestTrade:
    symbol: str
    direction: str
    entry_ts: pd.Timestamp
    entry_price: float
    stop: float
    target: float
    qty: int
    exit_ts: pd.Timestamp | None = None
    exit_price: float | None = None     # weighted average when split
    exit_reason: str = ""               # final tranche reason
    pnl_cash: float = 0.0
    r_multiple: float = 0.0
    max_favorable: float = 0.0          # MFE in price terms
    max_adverse: float = 0.0            # MAE in price terms
    exit_tranches: list[ExitTranche] = field(default_factory=list)


@dataclass
class BacktestReport:
    symbol: str
    start: pd.Timestamp
    end: pd.Timestamp
    start_equity: float
    end_equity: float
    trades: list[BacktestTrade] = field(default_factory=list)
    equity_curve: pd.Series = field(default_factory=lambda: pd.Series(dtype=float))
    quality_by_symbol: dict[str, SymbolQuality] = field(default_factory=dict)
    llm_rejected: int = 0              # count of signals blocked by llm_approve

    @property
    def total_return(self) -> float:
        if self.start_equity <= 0:
            return 0.0
        return (self.end_equity / self.start_equity) - 1.0

    @property
    def n_trades(self) -> int:
        return len(self.trades)

    @property
    def n_wins(self) -> int:
        return sum(1 for t in self.trades if t.pnl_cash > 0)

    @property
    def win_rate(self) -> float:
        if not self.trades:
            return 0.0
        return self.n_wins / len(self.trades)

    @property
    def avg_r(self) -> float:
        if not self.trades:
            return 0.0
        return sum(t.r_multiple for t in self.trades) / len(self.trades)

    @property
    def max_drawdown(self) -> float:
        """Peak-to-trough drawdown on the equity curve (fraction)."""
        if self.equity_curve.empty:
            return 0.0
        running_peak = self.equity_curve.cummax()
        dd = (self.equity_curve - running_peak) / running_peak
        return float(dd.min()) if not dd.empty else 0.0

    def summary(self) -> dict:
        return {
            "symbol": self.symbol,
            "start": str(self.start.date()),
            "end": str(self.end.date()),
            "start_equity": round(self.start_equity, 2),
            "end_equity": round(self.end_equity, 2),
            "total_return": round(self.total_return, 4),
            "n_trades": self.n_trades,
            "win_rate": round(self.win_rate, 4),
            "avg_r": round(self.avg_r, 4),
            "max_drawdown": round(self.max_drawdown, 4),
        }


# ---------------------------------------------------------------------------
# Frame prep
# ---------------------------------------------------------------------------
def _resample_weekly(daily: pd.DataFrame) -> pd.DataFrame:
    return (
        daily.resample("W")
        .agg({
            "open": "first", "high": "max", "low": "min",
            "close": "last", "volume": "sum",
        })
        .dropna(subset=["open", "high", "low", "close"])
    )


def _frames_at(
    daily: pd.DataFrame, cursor: int, ltf_window: int,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None:
    """Build HTF/MTF/LTF using information available up to `daily.iloc[cursor]`
    inclusive (signal-bar is cursor; fill bar is cursor+1)."""
    sub = daily.iloc[: cursor + 1]
    if len(sub) < max(ltf_window, 30):
        return None
    htf = _resample_weekly(sub)
    if len(htf) < 8:
        return None
    mtf = sub
    ltf = sub.iloc[-ltf_window:]
    return htf, mtf, ltf


# ---------------------------------------------------------------------------
# Fill simulator
# ---------------------------------------------------------------------------
def _check_exit(
    bar: pd.Series, stop: float, target: float, direction: str,
) -> tuple[str, float] | None:
    """Return (reason, price) if bar triggers stop or target.
    Stop takes precedence when both hit the same bar (conservative)."""
    hi = float(bar["high"])
    lo = float(bar["low"])
    if direction == "bull":
        if lo <= stop:
            return "stop", stop
        if hi >= target:
            return "target", target
    else:  # bear
        if hi >= stop:
            return "stop", stop
        if lo <= target:
            return "target", target
    return None


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------
def _finalize_trade(trade: BacktestTrade) -> None:
    """Aggregate tranche exits into pnl_cash / weighted exit_price /
    overall r_multiple. Single-exit trades are a 1-tranche case."""
    if not trade.exit_tranches:
        return
    sign = 1.0 if trade.direction == "bull" else -1.0
    risk_per_share = abs(trade.entry_price - trade.stop) or 1e-9
    total_qty = sum(t.qty for t in trade.exit_tranches)
    total_cash = 0.0
    weighted_price = 0.0
    for t in trade.exit_tranches:
        per_share = sign * (t.price - trade.entry_price)
        t.r_multiple = per_share / risk_per_share
        total_cash += per_share * t.qty
        weighted_price += t.price * t.qty
    trade.pnl_cash = total_cash
    trade.r_multiple = total_cash / (total_qty * risk_per_share) \
        if total_qty > 0 else 0.0
    trade.exit_price = weighted_price / total_qty if total_qty > 0 else None
    trade.exit_ts = trade.exit_tranches[-1].ts
    trade.exit_reason = trade.exit_tranches[-1].reason


def _split_exit_step(
    trade: BacktestTrade,
    state: PositionState,
    bar: pd.Series,
    ts: pd.Timestamp,
) -> bool:
    """Run manage_position for one bar; append any exit tranches to the
    trade and return True if the position is now flat."""
    actions = manage_position(state, bar)
    for act in actions:
        if act.kind == "close_partial":
            trade.exit_tranches.append(ExitTranche(
                ts=ts, price=float(act.price), qty=int(act.qty),
                reason=act.reason,
            ))
        elif act.kind == "close_all":
            trade.exit_tranches.append(ExitTranche(
                ts=ts, price=float(act.price), qty=int(act.qty),
                reason=act.reason,
            ))
    return state.remaining_qty <= 0


def backtest_symbol(
    symbol: str,
    daily: pd.DataFrame,
    *,
    start_equity: float = 100_000_000.0,
    ltf_window: int = 30,
    max_hold_bars: int = 10,
    exit_target_idx: int = 1,
    warmup_bars: int = 60,
    split_exits: bool = False,
    llm_approve: LlmApproveFn | None = None,
) -> BacktestReport:
    """Run a single-symbol daily-bar backtest.

    `daily` must be OHLCV indexed by a DatetimeIndex, sorted ascending.
    Equity accrues per realized trade; open positions don't mark-to-market
    the equity curve (keeps the curve stepwise and deterministic).

    If `split_exits` is True, exits are driven by
    `algorithm.position_manager.manage_position` so tranches fire at
    TP1/TP2/TP3 with BE + structure-style stop lifts in between. The
    aggregate P&L is the weighted sum across tranches.

    `llm_approve(signal, ltf)` is called per signal before entry; when
    provided and False, the trade is skipped and counted in
    `report.llm_rejected`.
    """
    if daily.empty:
        return BacktestReport(
            symbol=symbol,
            start=pd.Timestamp.min, end=pd.Timestamp.min,
            start_equity=start_equity, end_equity=start_equity,
        )

    daily = daily.sort_index()
    equity = float(start_equity)
    curve: dict[pd.Timestamp, float] = {daily.index[0]: equity}
    trades: list[BacktestTrade] = []
    qualities: dict[str, SymbolQuality] = {}
    gate = SignalGate()
    open_trade: BacktestTrade | None = None
    open_state: PositionState | None = None
    bars_held = 0
    llm_rejected = 0

    def _close_trade(exit_ts: pd.Timestamp) -> None:
        """Finalize open trade, push into trades list, update quality,
        advance equity curve. Assumes open_trade/open_state are set."""
        nonlocal equity
        _finalize_trade(open_trade)
        equity += open_trade.pnl_cash
        curve[exit_ts] = equity
        if open_state is not None:
            open_trade.max_favorable = float(open_state.max_favorable)
            open_trade.max_adverse = float(open_state.max_adverse)
            outcome = TradeOutcome(
                symbol=symbol, direction=open_trade.direction,
                entry=open_trade.entry_price, stop=open_trade.stop,
                exit_price=float(open_trade.exit_price or open_trade.entry_price),
                max_favorable=open_trade.max_favorable,
                max_adverse=open_trade.max_adverse,
            )
            update_quality(qualities, outcome,
                           now_iso=exit_ts.isoformat())
        trades.append(open_trade)

    n = len(daily)
    for i in range(warmup_bars, n):
        bar = daily.iloc[i]
        ts = daily.index[i]

        # --- manage open trade on today's bar -----------------------------
        if open_trade is not None:
            bars_held += 1
            if split_exits and open_state is not None:
                flat = _split_exit_step(open_trade, open_state, bar, ts)
                if not flat and bars_held >= max_hold_bars:
                    # Force flatten at close on timeout.
                    open_trade.exit_tranches.append(ExitTranche(
                        ts=ts, price=float(bar["close"]),
                        qty=int(open_state.remaining_qty),
                        reason="timeout",
                    ))
                    open_state.remaining_qty = 0
                    flat = True
                if flat:
                    _close_trade(ts)
                    open_trade, open_state, bars_held = None, None, 0
            else:
                hit = _check_exit(
                    bar, open_trade.stop, open_trade.target,
                    open_trade.direction,
                )
                if hit is None and bars_held >= max_hold_bars:
                    hit = ("timeout", float(bar["close"]))
                if hit is not None:
                    reason, price = hit
                    open_trade.exit_tranches.append(ExitTranche(
                        ts=ts, price=float(price),
                        qty=int(open_trade.qty), reason=reason,
                    ))
                    if open_state is not None:
                        # Keep MFE/MAE updated so metrics reflect the
                        # held bar before exit.
                        manage_position(open_state, bar)
                        open_state.remaining_qty = 0
                    _close_trade(ts)
                    open_trade, open_state, bars_held = None, None, 0

        # --- look for a new signal on this bar ----------------------------
        if open_trade is not None:
            continue
        frames = _frames_at(daily, i, ltf_window)
        if frames is None:
            continue
        htf, mtf, ltf = frames
        try:
            conf = evaluate_mtf_entry(htf, mtf, ltf)
            dec = build_signal(symbol, conf, ltf, gate=gate, now_ts=ts)
        except Exception as e:
            log.debug("backtest signal error %s @ %s: %s", symbol, ts, e)
            continue
        if dec.outcome != "signal" or dec.signal is None:
            continue
        sig = dec.signal
        if sig.direction != "bull":
            continue  # long-only

        # --- size at next bar open (fill bar) -----------------------------
        if i + 1 >= n:
            break
        fill_bar = daily.iloc[i + 1]
        fill_price = float(fill_bar["open"])
        if fill_price <= 0:
            continue
        # rebuild signal with realistic fill price so stop/targets
        # reflect the actual entry, not the signal-bar close.
        r_cash_per_share = abs(sig.entry - sig.stop) or 1e-9
        stop_abs = fill_price - r_cash_per_share if sig.direction == "bull" \
            else fill_price + r_cash_per_share
        target_abs = fill_price + (sig.targets[exit_target_idx] - sig.entry) \
            if sig.direction == "bull" \
            else fill_price - (sig.entry - sig.targets[exit_target_idx])

        fill_sig = TradeSignal(
            symbol=sig.symbol, direction=sig.direction,
            entry=fill_price, stop=stop_abs,
            targets=[fill_price + (t - sig.entry) for t in sig.targets]
            if sig.direction == "bull"
            else [fill_price - (sig.entry - t) for t in sig.targets],
            rr=sig.rr, poi_kind=sig.poi_kind,
            trigger_kind=sig.trigger_kind, session=sig.session,
            ts=daily.index[i + 1], meta=dict(sig.meta),
        )

        # --- LLM gate hook (pre-sizing; cheap reject) ---------------------
        if llm_approve is not None:
            try:
                if not llm_approve(fill_sig, ltf):
                    llm_rejected += 1
                    continue
            except Exception as e:
                log.debug("llm_approve raised for %s: %s — skipping", symbol, e)
                llm_rejected += 1
                continue

        sr: SizingResult = compute_size(
            fill_sig, equity=equity, current_total_exposure=0.0,
            current_symbol_exposure=0.0,
        )
        if sr.reason != "ok" or sr.shares <= 0:
            continue

        open_trade = BacktestTrade(
            symbol=symbol, direction="bull",
            entry_ts=daily.index[i + 1], entry_price=fill_price,
            stop=stop_abs, target=target_abs,
            qty=sr.shares,
        )
        open_state = PositionState.from_signal(fill_sig, qty=sr.shares)
        bars_held = 0

    # Flush an open trade at the last bar's close
    if open_trade is not None:
        last_ts = daily.index[-1]
        last_px = float(daily.iloc[-1]["close"])
        open_trade.exit_tranches.append(ExitTranche(
            ts=last_ts, price=last_px,
            qty=int(open_state.remaining_qty if open_state else open_trade.qty),
            reason="eod",
        ))
        if open_state is not None:
            open_state.remaining_qty = 0
        _close_trade(last_ts)

    equity_curve = pd.Series(curve).sort_index()
    # Forward-fill so the curve spans the entire range, not just trade days.
    equity_curve = equity_curve.reindex(daily.index).ffill().fillna(start_equity)

    return BacktestReport(
        symbol=symbol,
        start=daily.index[0],
        end=daily.index[-1],
        start_equity=start_equity,
        end_equity=float(equity),
        trades=trades,
        equity_curve=equity_curve,
        quality_by_symbol=qualities,
        llm_rejected=llm_rejected,
    )


def backtest_many(
    frames_by_symbol: dict[str, pd.DataFrame],
    *,
    start_equity: float = 100_000_000.0,
    **kw,
) -> dict[str, BacktestReport]:
    """Run `backtest_symbol` independently for each symbol.
    Each symbol uses its own equity slice (no cross-symbol allocation)."""
    out: dict[str, BacktestReport] = {}
    for sym, df in frames_by_symbol.items():
        out[sym] = backtest_symbol(sym, df, start_equity=start_equity, **kw)
    return out


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
def save_report_csv(report: BacktestReport, path) -> None:
    """Persist the per-trade ledger to CSV for offline analysis."""
    import csv
    from pathlib import Path

    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "symbol", "direction", "entry_ts", "entry_price",
            "exit_ts", "exit_price", "exit_reason",
            "qty", "pnl_cash", "r_multiple", "stop", "target",
        ])
        for t in report.trades:
            w.writerow([
                t.symbol, t.direction,
                t.entry_ts.isoformat() if t.entry_ts is not None else "",
                round(t.entry_price, 4),
                t.exit_ts.isoformat() if t.exit_ts is not None else "",
                round(t.exit_price or 0.0, 4),
                t.exit_reason, t.qty,
                round(t.pnl_cash, 2), round(t.r_multiple, 4),
                round(t.stop, 4), round(t.target, 4),
            ])
