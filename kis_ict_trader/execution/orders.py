"""High-level order / balance helpers built on top of KISClient.

Keeps KIS-specific body & response shapes in one place so the loop
layer can speak in domain terms (OrderRequest, Position, AccountBalance,
ReconcileResult) and the KIS client stays a thin HTTP surface.

Design notes:
- Every function is async and accepts any object that exposes
  `.get(path, tr_id_key, params=...)` and `.post(path, tr_id_key, body)`
  coroutines. In production that's `KISClient`; tests inject a fake.
- Parse-time int/float coercions tolerate empty strings and missing
  keys (KIS occasionally returns "" instead of "0").
- `reconcile_positions` is pure — no I/O — so it's the safe place for
  the decision logic that protects against double-fills.
"""
from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from .. import config as cfg
from ..algorithm.ict_strategy import TradeSignal
from .kis_client import KISAPIError

log = logging.getLogger(__name__)

OrderDivision = Literal["limit", "market"]
Side = Literal["buy", "sell"]

ORDER_PATH = "/uapi/domestic-stock/v1/trading/order-cash"
MODIFY_PATH = "/uapi/domestic-stock/v1/trading/order-rvsecncl"
BALANCE_PATH = "/uapi/domestic-stock/v1/trading/inquire-balance"


# ---------------------------------------------------------------------------
# Transport protocol (for typing + test injection)
# ---------------------------------------------------------------------------
class _HttpClient(Protocol):
    async def get(
        self,
        path: str,
        tr_id_key: str,
        params: Mapping[str, Any] | None = ...,
        extra_headers: Mapping[str, str] | None = ...,
    ) -> dict: ...

    async def post(
        self,
        path: str,
        tr_id_key: str,
        body: Mapping[str, Any],
        extra_headers: Mapping[str, str] | None = ...,
    ) -> dict: ...


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass
class OrderRequest:
    symbol: str
    side: Side
    quantity: int
    division: OrderDivision = "limit"
    price: float = 0.0
    client_tag: str = ""                    # caller correlation id


@dataclass
class OrderResult:
    ok: bool
    order_no: str = ""
    krx_fwdg_ord_orgno: str = ""
    raw: dict = field(default_factory=dict)
    error: str = ""


@dataclass
class Position:
    symbol: str
    name: str
    quantity: int
    sellable_quantity: int
    avg_price: float
    current_price: float
    eval_amount: float
    profit_amount: float
    profit_rate: float


@dataclass
class AccountBalance:
    cash_available: float                   # 주문가능현금
    total_eval: float                       # 총 평가금액 (현금+주식)
    total_profit: float
    positions: list[Position]
    raw: dict = field(default_factory=dict)


@dataclass
class ReconcileResult:
    to_submit: list[TradeSignal]            # no position yet
    already_filled: list[TradeSignal]       # position already meets desired size
    partial: list[TradeSignal]              # position exists but under-sized
    stale_positions: list[Position]         # held but no matching signal


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _safe_int(v: Any, default: int = 0) -> int:
    try:
        s = str(v).strip()
        if not s:
            return default
        return int(float(s))
    except (TypeError, ValueError):
        return default


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        s = str(v).strip()
        if not s:
            return default
        return float(s)
    except (TypeError, ValueError):
        return default


def _tr_key_for(side: Side) -> str:
    return "order_cash_buy" if side == "buy" else "order_cash_sell"


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
async def place_order(client: _HttpClient, req: OrderRequest) -> OrderResult:
    """Submit a cash buy/sell. Limit orders require a positive price;
    market orders always send price "0"."""
    if req.quantity <= 0:
        return OrderResult(ok=False, error="non_positive_quantity")
    if req.division == "limit" and req.price <= 0:
        return OrderResult(ok=False, error="limit_requires_price")

    body = {
        "CANO": cfg.KIS_ACCOUNT_NO,
        "ACNT_PRDT_CD": cfg.KIS_ACCOUNT_PRODUCT_CODE,
        "PDNO": req.symbol,
        "ORD_DVSN": "01" if req.division == "market" else "00",
        "ORD_QTY": str(int(req.quantity)),
        "ORD_UNPR": (
            "0" if req.division == "market" else str(int(round(req.price)))
        ),
    }
    try:
        resp = await client.post(ORDER_PATH, _tr_key_for(req.side), body)
    except KISAPIError as e:
        return OrderResult(
            ok=False, error=f"api_error: {e.msg1}",
            raw=getattr(e, "raw", {}) or {},
        )

    out = resp.get("output") or {}
    return OrderResult(
        ok=True,
        order_no=str(out.get("ODNO", "") or ""),
        krx_fwdg_ord_orgno=str(out.get("KRX_FWDG_ORD_ORGNO", "") or ""),
        raw=resp,
    )


async def cancel_order(
    client: _HttpClient,
    order_no: str,
    krx_fwdg_ord_orgno: str,
    quantity: int = 0,
) -> OrderResult:
    """Cancel (RVSE_CNCL_DVSN_CD='02'). quantity<=0 cancels the whole order."""
    body = {
        "CANO": cfg.KIS_ACCOUNT_NO,
        "ACNT_PRDT_CD": cfg.KIS_ACCOUNT_PRODUCT_CODE,
        "KRX_FWDG_ORD_ORGNO": krx_fwdg_ord_orgno,
        "ORGN_ODNO": order_no,
        "ORD_DVSN": "00",
        "RVSE_CNCL_DVSN_CD": "02",
        "ORD_QTY": str(max(0, int(quantity))),
        "ORD_UNPR": "0",
        "QTY_ALL_ORD_YN": "Y" if quantity <= 0 else "N",
    }
    try:
        resp = await client.post(MODIFY_PATH, "order_modify", body)
    except KISAPIError as e:
        return OrderResult(ok=False, error=f"api_error: {e.msg1}")
    return OrderResult(ok=True, raw=resp)


# ---------------------------------------------------------------------------
# Balance / positions
# ---------------------------------------------------------------------------
def _parse_position(row: Mapping[str, Any]) -> Position:
    return Position(
        symbol=str(row.get("pdno", "") or ""),
        name=str(row.get("prdt_name", "") or ""),
        quantity=_safe_int(row.get("hldg_qty")),
        sellable_quantity=_safe_int(row.get("ord_psbl_qty")),
        avg_price=_safe_float(row.get("pchs_avg_pric")),
        current_price=_safe_float(row.get("prpr")),
        eval_amount=_safe_float(row.get("evlu_amt")),
        profit_amount=_safe_float(row.get("evlu_pfls_amt")),
        profit_rate=_safe_float(row.get("evlu_pfls_rt")),
    )


async def get_balance(client: _HttpClient) -> AccountBalance:
    """Fetch holdings + cash via inquire-balance (single page).

    The full response supports pagination via CTX_AREA_FK100 / NK100; the
    first page is sufficient for a portfolio with <100 positions which
    this strategy is bounded to by `max_total_exposure` / sizing.
    """
    params = {
        "CANO": cfg.KIS_ACCOUNT_NO,
        "ACNT_PRDT_CD": cfg.KIS_ACCOUNT_PRODUCT_CODE,
        "AFHR_FLPR_YN": "N",
        "OFL_YN": "",
        "INQR_DVSN": "02",
        "UNPR_DVSN": "01",
        "FUND_STTL_ICLD_YN": "N",
        "FNCG_AMT_AUTO_RDPT_YN": "N",
        "PRCS_DVSN": "01",
        "CTX_AREA_FK100": "",
        "CTX_AREA_NK100": "",
    }
    resp = await client.get(BALANCE_PATH, "balance", params=params)

    output1 = resp.get("output1") or []
    output2_list = resp.get("output2") or []
    output2 = output2_list[0] if output2_list else {}

    positions = [
        _parse_position(r) for r in output1
        if _safe_int(r.get("hldg_qty")) > 0
    ]

    return AccountBalance(
        cash_available=_safe_float(output2.get("dnca_tot_amt")),
        total_eval=_safe_float(output2.get("tot_evlu_amt")),
        total_profit=_safe_float(output2.get("evlu_pfls_smtl_amt")),
        positions=positions,
        raw=resp,
    )


# ---------------------------------------------------------------------------
# Signal ↔ position reconciliation (pure, no I/O)
# ---------------------------------------------------------------------------
def reconcile_positions(
    signals: list[TradeSignal],
    size_by_symbol: Mapping[str, int],
    positions: list[Position],
) -> ReconcileResult:
    """Classify signals by what action (if any) the order layer should
    take given current holdings.

    - `to_submit`: symbol has no position → place the full order.
    - `already_filled`: existing quantity ≥ desired → skip.
    - `partial`: existing quantity > 0 but < desired → top-up candidate;
      the caller may choose to skip rather than top-up for ICT entries.
    - `stale_positions`: held but not in today's signal set → managed by
      trailing/exit logic, not sizing.
    """
    pos_by_sym = {p.symbol: p for p in positions}
    seen: set[str] = set()
    to_submit: list[TradeSignal] = []
    already: list[TradeSignal] = []
    partial: list[TradeSignal] = []

    for sig in signals:
        seen.add(sig.symbol)
        desired = int(size_by_symbol.get(sig.symbol, 0))
        p = pos_by_sym.get(sig.symbol)
        if p is None or p.quantity <= 0:
            to_submit.append(sig)
        elif p.quantity >= desired > 0:
            already.append(sig)
        elif desired > 0:
            partial.append(sig)
        else:
            # zero desired size (sizer rejected) + existing position:
            # treat as "already" so the caller doesn't double-enter.
            already.append(sig)

    stale = [
        p for p in positions
        if p.symbol not in seen and p.quantity > 0
    ]
    return ReconcileResult(
        to_submit=to_submit,
        already_filled=already,
        partial=partial,
        stale_positions=stale,
    )


# ---------------------------------------------------------------------------
# Convenience: signal → OrderRequest
# ---------------------------------------------------------------------------
def build_entry_order(
    signal: TradeSignal, quantity: int,
    division: OrderDivision = "limit",
) -> OrderRequest:
    """Map a TradeSignal + sized quantity into an OrderRequest.
    Long trades → buy, short trades → sell (only used when
    cfg.ALLOW_SHORT is True upstream)."""
    side: Side = "buy" if signal.direction == "bull" else "sell"
    return OrderRequest(
        symbol=signal.symbol,
        side=side,
        quantity=int(quantity),
        division=division,
        price=float(signal.entry) if division == "limit" else 0.0,
        client_tag=f"ict:{signal.trigger_kind}:{signal.ts.isoformat()}",
    )
