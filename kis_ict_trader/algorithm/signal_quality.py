"""Per-symbol signal quality tracker.

Accumulates closed-trade statistics so the universe filter can drop
symbols that consistently lose on this strategy. All metrics are
R-multiple based (normalized by initial risk) so they're comparable
across price levels.

Metrics:
  win_rate  = wins / n_trades
  avg_r     = Σ realized R / n_trades
  mfe_mean  = Σ max-favorable R / n_trades   (how far price ran the
              right way before exit)
  mae_mean  = Σ max-adverse R / n_trades     (how deep price dug the
              wrong way during the trade; negative for bull losers
              that stopped out, zero for bull trades that never
              pulled back through entry)

`filter_by_quality` is a pure function that the loop can call against
the persisted quality dict to prune stale or underperforming symbols
from the universe before evaluation starts.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime


log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Trade outcome → metrics
# ---------------------------------------------------------------------------
@dataclass
class TradeOutcome:
    symbol: str
    direction: str                # "bull" | "bear"
    entry: float
    stop: float
    exit_price: float
    max_favorable: float          # best price reached while open
    max_adverse: float            # worst price reached while open


def compute_trade_metrics(outcome: TradeOutcome) -> dict[str, float]:
    """Return {r, mfe_r, mae_r} for one closed trade.

    R-multiples are signed by trade direction:
      bull: r > 0 means exit > entry (win)
      bear: r > 0 means exit < entry (win)
    `mae_r` is always ≤ 0 for a conforming trade (price went the
    wrong way at some point), `mfe_r` is always ≥ 0.
    """
    risk = abs(outcome.entry - outcome.stop) or 1e-9
    sign = 1.0 if outcome.direction == "bull" else -1.0
    r = sign * (outcome.exit_price - outcome.entry) / risk
    mfe = sign * (outcome.max_favorable - outcome.entry) / risk
    mae = sign * (outcome.max_adverse - outcome.entry) / risk
    return {"r": r, "mfe_r": mfe, "mae_r": mae}


# ---------------------------------------------------------------------------
# Per-symbol rolling aggregate
# ---------------------------------------------------------------------------
@dataclass
class SymbolQuality:
    symbol: str
    n_trades: int = 0
    n_wins: int = 0
    sum_r: float = 0.0
    sum_mfe_r: float = 0.0
    sum_mae_r: float = 0.0
    last_updated: str = ""

    @property
    def win_rate(self) -> float:
        return self.n_wins / self.n_trades if self.n_trades else 0.0

    @property
    def avg_r(self) -> float:
        return self.sum_r / self.n_trades if self.n_trades else 0.0

    @property
    def mfe_mean(self) -> float:
        return self.sum_mfe_r / self.n_trades if self.n_trades else 0.0

    @property
    def mae_mean(self) -> float:
        return self.sum_mae_r / self.n_trades if self.n_trades else 0.0

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "n_trades": int(self.n_trades),
            "n_wins": int(self.n_wins),
            "sum_r": float(self.sum_r),
            "sum_mfe_r": float(self.sum_mfe_r),
            "sum_mae_r": float(self.sum_mae_r),
            "last_updated": self.last_updated,
            # Derived (read-only, present for dashboards)
            "win_rate": round(self.win_rate, 4),
            "avg_r": round(self.avg_r, 4),
            "mfe_mean": round(self.mfe_mean, 4),
            "mae_mean": round(self.mae_mean, 4),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "SymbolQuality":
        return cls(
            symbol=str(d.get("symbol", "")),
            n_trades=int(d.get("n_trades", 0)),
            n_wins=int(d.get("n_wins", 0)),
            sum_r=float(d.get("sum_r", 0.0)),
            sum_mfe_r=float(d.get("sum_mfe_r", 0.0)),
            sum_mae_r=float(d.get("sum_mae_r", 0.0)),
            last_updated=str(d.get("last_updated", "")),
        )


def update_quality(
    qualities: dict[str, SymbolQuality],
    outcome: TradeOutcome,
    *,
    now_iso: str | None = None,
) -> SymbolQuality:
    """Fold `outcome` into `qualities[outcome.symbol]` in place,
    returning the updated record."""
    metrics = compute_trade_metrics(outcome)
    q = qualities.get(outcome.symbol) or SymbolQuality(symbol=outcome.symbol)
    q.n_trades += 1
    if metrics["r"] > 0:
        q.n_wins += 1
    q.sum_r += float(metrics["r"])
    q.sum_mfe_r += float(metrics["mfe_r"])
    q.sum_mae_r += float(metrics["mae_r"])
    q.last_updated = now_iso or datetime.now().isoformat(timespec="seconds")
    qualities[outcome.symbol] = q
    return q


# ---------------------------------------------------------------------------
# Universe filter
# ---------------------------------------------------------------------------
@dataclass
class QualityFilter:
    """Drop symbols that have traded ≥ `min_trades` times this strategy
    AND fail one of the floors. Untested / under-sampled symbols pass
    through so a new ticker gets a fair shot."""
    min_trades: int = 5
    avg_r_floor: float = -0.3
    win_rate_floor: float = 0.35

    def allows(self, q: SymbolQuality | None) -> tuple[bool, str]:
        if q is None or q.n_trades < self.min_trades:
            return True, "under-sampled"
        if q.avg_r < self.avg_r_floor:
            return False, (
                f"avg_r {q.avg_r:.2f} < {self.avg_r_floor:.2f}"
            )
        if q.win_rate < self.win_rate_floor:
            return False, (
                f"win_rate {q.win_rate:.2f} < {self.win_rate_floor:.2f}"
            )
        return True, "ok"


def filter_by_quality(
    universe: list[str],
    qualities: dict[str, SymbolQuality],
    policy: QualityFilter | None = None,
) -> tuple[list[str], dict[str, str]]:
    """Return (kept_tickers, dropped_reasons).

    `dropped_reasons[symbol]` explains why each filtered symbol was
    removed — useful for audit logs.
    """
    pol = policy or QualityFilter()
    kept: list[str] = []
    dropped: dict[str, str] = {}
    for sym in universe:
        ok, reason = pol.allows(qualities.get(sym))
        if ok:
            kept.append(sym)
        else:
            dropped[sym] = reason
    return kept, dropped
