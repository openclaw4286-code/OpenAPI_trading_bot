"""Orders layer (STEP 10): place / cancel / balance / reconcile."""
from __future__ import annotations

import pandas as pd
import pytest

from kis_ict_trader.algorithm.ict_strategy import TradeSignal
from kis_ict_trader.execution.orders import (
    BALANCE_PATH,
    MODIFY_PATH,
    ORDER_PATH,
    OrderRequest,
    Position,
    build_entry_order,
    cancel_order,
    get_balance,
    place_order,
    reconcile_positions,
)


@pytest.mark.asyncio
async def test_limit_buy_happy_path(fake_client):
    fc = fake_client(post_resp={
        "rt_cd": "0",
        "output": {"ODNO": "0000123", "KRX_FWDG_ORD_ORGNO": "01790"},
    })
    res = await place_order(
        fc, OrderRequest("005930", "buy", 10, division="limit", price=70000.4),
    )
    assert res.ok and res.order_no == "0000123"
    path, tr, body = fc.calls[0][1], fc.calls[0][2], fc.calls[0][3]
    assert path == ORDER_PATH and tr == "order_cash_buy"
    assert body == {
        "CANO": "12345678",
        "ACNT_PRDT_CD": "01",
        "PDNO": "005930",
        "ORD_DVSN": "00",
        "ORD_QTY": "10",
        "ORD_UNPR": "70000",
    }


@pytest.mark.asyncio
async def test_market_sell_emits_zero_price(fake_client):
    fc = fake_client(post_resp={"rt_cd": "0", "output": {"ODNO": "9"}})
    await place_order(
        fc, OrderRequest("000660", "sell", 5, division="market"),
    )
    body = fc.calls[0][3]
    assert body["ORD_DVSN"] == "01" and body["ORD_UNPR"] == "0"
    assert fc.calls[0][2] == "order_cash_sell"


@pytest.mark.asyncio
async def test_validation_errors(fake_client):
    r0 = await place_order(fake_client(), OrderRequest("X", "buy", 0))
    assert not r0.ok and r0.error == "non_positive_quantity"
    rlim = await place_order(
        fake_client(), OrderRequest("X", "buy", 1, division="limit", price=0),
    )
    assert not rlim.ok and rlim.error == "limit_requires_price"


@pytest.mark.asyncio
async def test_api_error_wrapped(fake_client):
    fc = fake_client(raise_on_post=True)
    res = await place_order(fc, OrderRequest("005930", "buy", 1,
                                              division="market"))
    assert not res.ok and "api_error" in res.error


@pytest.mark.asyncio
async def test_cancel_full(fake_client):
    fc = fake_client(post_resp={"rt_cd": "0", "output": {}})
    res = await cancel_order(fc, "0000123", "01790", quantity=0)
    assert res.ok
    body = fc.calls[0][3]
    assert body["RVSE_CNCL_DVSN_CD"] == "02"
    assert body["QTY_ALL_ORD_YN"] == "Y" and fc.calls[0][2] == "order_modify"


@pytest.mark.asyncio
async def test_cancel_partial(fake_client):
    fc = fake_client(post_resp={"rt_cd": "0", "output": {}})
    await cancel_order(fc, "0000124", "01790", quantity=3)
    body = fc.calls[0][3]
    assert body["QTY_ALL_ORD_YN"] == "N" and body["ORD_QTY"] == "3"


@pytest.mark.asyncio
async def test_get_balance_parses(fake_client):
    fc = fake_client(get_resp={
        "rt_cd": "0",
        "output1": [
            {"pdno": "005930", "prdt_name": "삼성전자", "hldg_qty": "100",
             "ord_psbl_qty": "100", "pchs_avg_pric": "68000", "prpr": "70500",
             "evlu_amt": "7050000", "evlu_pfls_amt": "250000",
             "evlu_pfls_rt": "3.68"},
            {"pdno": "X", "prdt_name": "Y", "hldg_qty": "0",
             "ord_psbl_qty": "0", "pchs_avg_pric": "0", "prpr": "0",
             "evlu_amt": "0", "evlu_pfls_amt": "0", "evlu_pfls_rt": ""},
        ],
        "output2": [{
            "dnca_tot_amt": "5000000",
            "tot_evlu_amt": "12050000",
            "evlu_pfls_smtl_amt": "250000",
        }],
    })
    bal = await get_balance(fc)
    assert bal.cash_available == 5_000_000.0
    assert bal.total_eval == 12_050_000.0
    assert len(bal.positions) == 1 and bal.positions[0].symbol == "005930"
    assert fc.calls[0][1] == BALANCE_PATH


class TestReconcile:
    def _sig(self, sym: str) -> TradeSignal:
        return TradeSignal(
            sym, "bull", 100.0, 98.0, [102.0, 104.0, 106.0], 2.0,
            "FVG", "BOS", "asia", pd.Timestamp("2026-04-22 10:00"),
        )

    def test_four_way_classification(self, make_position):
        sigs = [self._sig(s) for s in ("A", "B", "C", "D")]
        size_map = {"A": 100, "B": 200, "C": 50, "D": 0}
        poses = [
            make_position("B", qty=200),
            make_position("C", qty=10),   # held but less than desired
            make_position("D", qty=5),    # held but desired=0
            make_position("E", qty=7),    # stale — not in signals
        ]
        rec = reconcile_positions(sigs, size_map, poses)
        assert [s.symbol for s in rec.to_submit] == ["A"]
        assert {s.symbol for s in rec.already_filled} == {"B", "D"}
        assert [s.symbol for s in rec.partial] == ["C"]
        assert [p.symbol for p in rec.stale_positions] == ["E"]


class TestBuildEntryOrder:
    def test_bull_to_buy(self, make_signal):
        req = build_entry_order(make_signal(), 10)
        assert req.side == "buy" and req.price == 100.0
        assert req.division == "limit"
        assert req.client_tag.startswith("ict:BOS:")

    def test_market_override_zeroes_price(self, make_signal):
        req = build_entry_order(make_signal(), 10, division="market")
        assert req.division == "market" and req.price == 0.0
