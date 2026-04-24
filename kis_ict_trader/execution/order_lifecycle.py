"""Order lifecycle: query today's fills / pending, price-modify, and
retry stale limit orders.

Adds a second pass on top of `execution/orders.py`:
  - inquire_daily_ccld(client)            → list[OrderStatus]
  - find_pending(client, symbol=None)     → list[OrderStatus]   (rmn_qty>0)
  - modify_order(client, order_no, ...)   → OrderResult         (revise price)
  - cancel_and_replace(client, pending, new_price, ...)
  - retry_stale_limits(client, current_prices, policy, notify=None)

Why this lives separately: the first-pass order submitter
(`place_order`) fires-and-returns — it does not follow up on the order
afterwards. This module handles the "did it actually fill?" loop so
the strategy's limit entries don't sit un-filled for an entire
session while price walks away.

The retry policy is intentionally conservative:
  - Only entries / exits with remaining_qty>0 are candidates.
  - Cancel-replace fires when the order is older than `max_age_sec`
    OR when the current market price has drifted more than
    `max_drift_bps` basis points away from the limit on the wrong
    side (buy: mkt > limit+drift; sell: mkt < limit-drift).
  - Replacement price = current mid ± `reprice_offset_bps` nudging
    a little towards the market to encourage a fill without chasing.
"""
from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

from .. import config as cfg
from .kis_client import KISAPIError
from .orders import (
    MODIFY_PATH,
    OrderResult,
    _HttpClient,
    _safe_float,
    _safe_int,
    cancel_order,
)

log = logging.getLogger(__name__)

CCLD_PATH = "/uapi/domestic-stock/v1/trading/inquire-daily-ccld"

OrderSide = Literal["buy", "sell"]
OrderLifecycleStatus = Literal[
    "pending", "partial", "filled", "cancelled", "rejected", "unknown",
]


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class OrderStatus:
    order_no: str
    krx_fwdg_ord_orgno: str
    symbol: str
    name: str
    side: OrderSide
    submit_qty: int
    filled_qty: int
    remaining_qty: int
    limit_price: float               # 0 for market orders
    avg_fill_price: float
    order_time: str                  # HHMMSS
    cancelled: bool
    status: OrderLifecycleStatus
    raw: dict = field(default_factory=dict)

    @property
    def age_sec(self) -> int:
        """Seconds since this order was placed today. Returns 0 on parse fail."""
        try:
            hh = int(self.order_time[0:2])
            mm = int(self.order_time[2:4])
            ss = int(self.order_time[4:6])
        except (ValueError, IndexError):
            return 0
        now = datetime.now()
        ord_dt = now.replace(hour=hh, minute=mm, second=ss, microsecond=0)
        return max(0, int((now - ord_dt).total_seconds()))


@dataclass
class RetryPolicy:
    max_age_sec: int = 300          # cancel-replace after 5 min unfilled
    max_drift_bps: int = 30         # or once mid drifts > 0.30% the wrong way
    reprice_offset_bps: int = 5     # nudge replacement 0.05% towards market
    max_retries_per_order: int = 2
    # Track retry counts externally (caller-owned dict) — the module is
    # stateless so it's safe to run from parallel scheduler ticks.


@dataclass
class RetryAction:
    order_no: str
    symbol: str
    reason: str                     # "age" | "drift" | "skipped:<why>"
    cancel_result: OrderResult | None = None
    replace_result: OrderResult | None = None


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
def _parse_status(row: Mapping[str, Any]) -> OrderStatus:
    submit_qty = _safe_int(row.get("ord_qty"))
    filled_qty = _safe_int(row.get("tot_ccld_qty"))
    remaining_qty = _safe_int(row.get("rmn_qty"), default=submit_qty - filled_qty)
    cancelled = str(row.get("cncl_yn", "")).strip().upper() == "Y"

    if cancelled and remaining_qty == 0 and filled_qty == 0:
        status: OrderLifecycleStatus = "cancelled"
    elif filled_qty == 0 and remaining_qty > 0:
        status = "pending"
    elif filled_qty > 0 and remaining_qty > 0:
        status = "partial"
    elif filled_qty == submit_qty and submit_qty > 0:
        status = "filled"
    elif submit_qty > 0 and filled_qty == 0 and remaining_qty == 0 and not cancelled:
        status = "rejected"
    else:
        status = "unknown"

    # KIS encodes side as 01=sell, 02=buy
    side_code = str(row.get("sll_buy_dvsn_cd", "")).strip()
    side: OrderSide = "sell" if side_code == "01" else "buy"

    return OrderStatus(
        order_no=str(row.get("odno", "") or ""),
        krx_fwdg_ord_orgno=str(row.get("ord_gno_brno", "") or ""),
        symbol=str(row.get("pdno", "") or ""),
        name=str(row.get("prdt_name", "") or ""),
        side=side,
        submit_qty=submit_qty,
        filled_qty=filled_qty,
        remaining_qty=remaining_qty,
        limit_price=_safe_float(row.get("ord_unpr")),
        avg_fill_price=_safe_float(row.get("avg_prvs")),
        order_time=str(row.get("ord_tmd", "") or ""),
        cancelled=cancelled,
        status=status,
        raw=dict(row),
    )


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------
async def inquire_daily_ccld(
    client: _HttpClient,
    *,
    only_pending: bool = False,
    on_date: date | None = None,
) -> list[OrderStatus]:
    """Today's orders + fill status. `on_date` overrides for reconciliation
    of yesterday's tail, but KIS typically keeps only the current session.
    """
    target = (on_date or date.today()).strftime("%Y%m%d")
    params = {
        "CANO": cfg.KIS_ACCOUNT_NO,
        "ACNT_PRDT_CD": cfg.KIS_ACCOUNT_PRODUCT_CODE,
        "INQR_STRT_DT": target,
        "INQR_END_DT": target,
        "SLL_BUY_DVSN_CD": "00",        # 전체
        "INQR_DVSN": "00",              # 역순
        "PDNO": "",
        "CCLD_DVSN": "02" if only_pending else "00",
        "ORD_GNO_BRNO": "",
        "ODNO": "",
        "INQR_DVSN_3": "00",
        "INQR_DVSN_1": "",
        "CTX_AREA_FK100": "",
        "CTX_AREA_NK100": "",
    }
    resp = await client.get(CCLD_PATH, "ccld", params=params)
    rows = resp.get("output1") or []
    statuses = [_parse_status(r) for r in rows]
    if only_pending:
        statuses = [s for s in statuses if s.remaining_qty > 0]
    return statuses


async def find_pending(
    client: _HttpClient, symbol: str | None = None,
) -> list[OrderStatus]:
    all_pending = await inquire_daily_ccld(client, only_pending=True)
    if symbol is None:
        return all_pending
    return [s for s in all_pending if s.symbol == symbol]


# ---------------------------------------------------------------------------
# Modify (price revise)
# ---------------------------------------------------------------------------
async def modify_order(
    client: _HttpClient,
    order_no: str,
    krx_fwdg_ord_orgno: str,
    new_price: float,
    new_qty: int | None = None,
) -> OrderResult:
    """Send a price-revise (RVSE_CNCL_DVSN_CD='01') via order-rvsecncl.

    `new_qty` leaves the quantity unchanged when None. We always send
    the quantity explicitly because the KIS endpoint requires it.
    """
    if new_price <= 0:
        return OrderResult(ok=False, error="invalid_price")
    body = {
        "CANO": cfg.KIS_ACCOUNT_NO,
        "ACNT_PRDT_CD": cfg.KIS_ACCOUNT_PRODUCT_CODE,
        "KRX_FWDG_ORD_ORGNO": krx_fwdg_ord_orgno,
        "ORGN_ODNO": order_no,
        "ORD_DVSN": "00",
        "RVSE_CNCL_DVSN_CD": "01",      # 01 = revise, 02 = cancel
        "ORD_QTY": str(int(max(0, new_qty or 0))),
        "ORD_UNPR": str(int(round(new_price))),
        "QTY_ALL_ORD_YN": "Y" if (new_qty is None or new_qty <= 0) else "N",
    }
    try:
        resp = await client.post(MODIFY_PATH, "order_modify", body)
    except KISAPIError as e:
        return OrderResult(ok=False, error=f"api_error: {e.msg1}")
    return OrderResult(ok=True, raw=resp)


# ---------------------------------------------------------------------------
# Cancel + replace
# ---------------------------------------------------------------------------
async def cancel_and_replace(
    client: _HttpClient,
    pending: OrderStatus,
    new_price: float,
) -> tuple[OrderResult, OrderResult]:
    """Full cancel, then submit a fresh order via modify endpoint.

    We prefer revise over cancel+re-submit when possible because revise
    keeps the FIFO queue position at KRX. This helper uses revise only.
    The name `cancel_and_replace` is kept for callers expecting that
    concept; the actual call is a price revise that KIS routes as a
    modify rather than a new order.
    """
    modify_res = await modify_order(
        client, pending.order_no, pending.krx_fwdg_ord_orgno,
        new_price=new_price, new_qty=pending.remaining_qty,
    )
    # Return a sentinel cancel-result so the tuple shape is preserved for
    # callers that expect to log both steps.
    cancel_res = OrderResult(ok=True, raw={"note": "replaced_via_revise"})
    return cancel_res, modify_res


# ---------------------------------------------------------------------------
# Retry policy
# ---------------------------------------------------------------------------
def _should_retry(
    status: OrderStatus,
    current_price: float | None,
    policy: RetryPolicy,
) -> tuple[bool, str]:
    """Decide whether a pending order warrants cancel-replace.
    Returns (decision, reason). reason prefixed with "skipped:" when False."""
    if status.status not in ("pending", "partial"):
        return False, f"skipped:status={status.status}"
    if status.limit_price <= 0:
        return False, "skipped:market_order"
    if status.remaining_qty <= 0:
        return False, "skipped:no_remainder"

    if status.age_sec >= policy.max_age_sec:
        return True, "age"

    if current_price is None or current_price <= 0:
        return False, "skipped:no_mkt_price"

    drift_bps = (current_price - status.limit_price) / status.limit_price * 10_000
    if status.side == "buy":
        # Price has walked away *up* past our limit → we'll never fill
        if drift_bps > policy.max_drift_bps:
            return True, "drift"
    else:  # sell
        if -drift_bps > policy.max_drift_bps:
            return True, "drift"

    return False, "skipped:within_tolerance"


def _reprice(
    status: OrderStatus,
    current_price: float,
    policy: RetryPolicy,
) -> float:
    """Nudge the new limit a small offset towards market so it actually fills
    but doesn't fully chase."""
    offset_frac = policy.reprice_offset_bps / 10_000.0
    if status.side == "buy":
        return float(current_price) * (1.0 + offset_frac)
    return float(current_price) * (1.0 - offset_frac)


async def retry_stale_limits(
    client: _HttpClient,
    current_prices: Mapping[str, float],
    policy: RetryPolicy | None = None,
    retry_counts: dict[str, int] | None = None,
    pending: list[OrderStatus] | None = None,
) -> list[RetryAction]:
    """Cancel-replace every pending limit that's stale or drifted.

    `current_prices`: symbol → latest traded price (caller fetches).
    `retry_counts`  : symbol → number of revisions so far (caller-owned).
                      Prevents unbounded ping-pong when the market just
                      moves faster than we can re-quote.
    `pending`       : optional pre-fetched list (skips the KIS GET).
    """
    pol = policy or RetryPolicy()
    counts = retry_counts if retry_counts is not None else {}
    pend = pending if pending is not None else await inquire_daily_ccld(
        client, only_pending=True,
    )
    out: list[RetryAction] = []
    for status in pend:
        if counts.get(status.order_no, 0) >= pol.max_retries_per_order:
            out.append(RetryAction(
                order_no=status.order_no, symbol=status.symbol,
                reason="skipped:retry_cap",
            ))
            continue

        mkt = current_prices.get(status.symbol)
        should, why = _should_retry(status, mkt, pol)
        if not should:
            out.append(RetryAction(
                order_no=status.order_no, symbol=status.symbol, reason=why,
            ))
            continue

        new_price = _reprice(status, float(mkt or status.limit_price), pol)
        cancel_res, replace_res = await cancel_and_replace(
            client, status, new_price,
        )
        counts[status.order_no] = counts.get(status.order_no, 0) + 1
        out.append(RetryAction(
            order_no=status.order_no, symbol=status.symbol, reason=why,
            cancel_result=cancel_res, replace_result=replace_res,
        ))
        log.info(
            "retry %s %s %s: limit=%.2f mkt=%.2f new=%.2f age=%ds",
            status.order_no, status.symbol, why,
            status.limit_price, float(mkt or 0), new_price, status.age_sec,
        )
    return out


# ---------------------------------------------------------------------------
# Safety: force-flatten a pending order entirely
# ---------------------------------------------------------------------------
async def cancel_pending(
    client: _HttpClient, pending: OrderStatus,
) -> OrderResult:
    """Hard cancel (RVSE_CNCL_DVSN_CD='02') of the remaining quantity."""
    return await cancel_order(
        client,
        order_no=pending.order_no,
        krx_fwdg_ord_orgno=pending.krx_fwdg_ord_orgno,
        quantity=pending.remaining_qty,
    )
