"""Order lifecycle (STEP 17): ccld parsing + modify + retry."""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from kis_ict_trader.execution.order_lifecycle import (
    CCLD_PATH,
    OrderStatus,
    RetryPolicy,
    _parse_status,
    _reprice,
    _should_retry,
    cancel_and_replace,
    cancel_pending,
    find_pending,
    inquire_daily_ccld,
    modify_order,
    retry_stale_limits,
)


def _t_ago(sec: int) -> str:
    return (datetime.now() - timedelta(seconds=sec)).strftime("%H%M%S")


@pytest.fixture
def rows():
    return [
        {"odno": "01", "ord_gno_brno": "0079", "pdno": "005930",
         "prdt_name": "삼성", "sll_buy_dvsn_cd": "02", "ord_qty": "100",
         "tot_ccld_qty": "0", "rmn_qty": "100", "ord_unpr": "70000",
         "avg_prvs": "0", "ord_tmd": _t_ago(400), "cncl_yn": "N"},
        {"odno": "02", "ord_gno_brno": "0079", "pdno": "000660",
         "prdt_name": "하이닉스", "sll_buy_dvsn_cd": "02", "ord_qty": "50",
         "tot_ccld_qty": "20", "rmn_qty": "30", "ord_unpr": "150000",
         "avg_prvs": "150000", "ord_tmd": _t_ago(30), "cncl_yn": "N"},
        {"odno": "03", "ord_gno_brno": "0079", "pdno": "035420",
         "prdt_name": "네이버", "sll_buy_dvsn_cd": "01", "ord_qty": "10",
         "tot_ccld_qty": "10", "rmn_qty": "0", "ord_unpr": "220000",
         "avg_prvs": "219500", "ord_tmd": _t_ago(60), "cncl_yn": "N"},
        {"odno": "04", "ord_gno_brno": "0079", "pdno": "005490",
         "prdt_name": "포스코", "sll_buy_dvsn_cd": "02", "ord_qty": "5",
         "tot_ccld_qty": "0", "rmn_qty": "0", "ord_unpr": "500000",
         "avg_prvs": "0", "ord_tmd": _t_ago(200), "cncl_yn": "Y"},
    ]


class TestParseStatus:
    def test_all_status_branches(self, rows):
        parsed = {r["odno"]: _parse_status(r) for r in rows}
        assert parsed["01"].status == "pending" and parsed["01"].side == "buy"
        assert parsed["02"].status == "partial" and parsed["02"].filled_qty == 20
        assert parsed["03"].status == "filled" and parsed["03"].side == "sell"
        assert parsed["04"].status == "cancelled"

    def test_age_sec_approx(self, rows):
        parsed = _parse_status(rows[0])
        assert 390 <= parsed.age_sec <= 420


class TestShouldRetry:
    @pytest.fixture
    def pol(self):
        return RetryPolicy(max_age_sec=300, max_drift_bps=30,
                           reprice_offset_bps=5, max_retries_per_order=2)

    def test_age_triggers(self, rows, pol):
        s = _parse_status(rows[0])
        d, why = _should_retry(s, 70500, pol)
        assert d and why == "age"

    def test_within_tolerance(self, rows, pol):
        s = _parse_status(rows[1])
        d, why = _should_retry(s, 150_050, pol)
        assert not d and "within_tolerance" in why

    def test_drift_buy(self, rows, pol):
        s = _parse_status(rows[1])
        d, why = _should_retry(s, 150_000 * 1.01, pol)
        assert d and why == "drift"

    def test_filled_skipped(self, rows, pol):
        s = _parse_status(rows[2])
        assert _should_retry(s, 220_000, pol) == (False, "skipped:status=filled")

    def test_market_order_skipped(self, pol):
        mkt = OrderStatus("99", "0079", "X", "", "buy", 10, 0, 10, 0.0, 0.0,
                          _t_ago(500), False, "pending", {})
        assert _should_retry(mkt, 1000, pol) == (False, "skipped:market_order")


class TestReprice:
    def test_buy_nudges_up(self, rows):
        pol = RetryPolicy()
        s = _parse_status(rows[0])
        assert 70500 < _reprice(s, 70500, pol) < 70600

    def test_sell_nudges_down(self, rows):
        pol = RetryPolicy()
        sell = OrderStatus("90", "0079", "X", "", "sell", 10, 0, 10,
                           200.0, 0.0, _t_ago(10), False, "pending", {})
        assert 198 < _reprice(sell, 199, pol) < 199


@pytest.mark.asyncio
class TestHttpFlow:
    async def test_inquire_flags(self, rows, fake_client):
        fc = fake_client(get_resp={"rt_cd": "0", "output1": rows, "output2": {}})
        allst = await inquire_daily_ccld(fc)
        assert len(allst) == 4 and fc.calls[-1][3]["CCLD_DVSN"] == "00"
        fc.calls.clear()
        pend = await inquire_daily_ccld(fc, only_pending=True)
        assert fc.calls[-1][3]["CCLD_DVSN"] == "02"
        assert {s.order_no for s in pend} == {"01", "02"}

    async def test_find_pending_filters(self, rows, fake_client):
        fc = fake_client(get_resp={"rt_cd": "0", "output1": rows, "output2": {}})
        out = await find_pending(fc, symbol="005930")
        assert [s.order_no for s in out] == ["01"]

    async def test_modify_body_shape(self, fake_client):
        fc = fake_client(post_resp={"rt_cd": "0", "output": {}})
        r = await modify_order(fc, "01", "0079", 71000.4, new_qty=100)
        assert r.ok
        body = fc.calls[-1][3]
        assert body["RVSE_CNCL_DVSN_CD"] == "01"
        assert body["ORD_UNPR"] == "71000"
        assert body["ORD_QTY"] == "100" and body["QTY_ALL_ORD_YN"] == "N"

    async def test_modify_qty_all_when_missing(self, fake_client):
        fc = fake_client(post_resp={"rt_cd": "0", "output": {}})
        await modify_order(fc, "01", "0079", 71000.0)
        assert fc.calls[-1][3]["QTY_ALL_ORD_YN"] == "Y"

    async def test_modify_rejects_zero_price(self, fake_client):
        bad = await modify_order(fake_client(), "01", "0079", 0)
        assert not bad.ok and bad.error == "invalid_price"

    async def test_modify_api_error(self, fake_client):
        err = await modify_order(fake_client(raise_on_post=True),
                                 "01", "0079", 71000)
        assert not err.ok and "api_error" in err.error

    async def test_cancel_and_replace_single_post(self, rows, fake_client):
        fc = fake_client(post_resp={"rt_cd": "0", "output": {}})
        s = _parse_status(rows[0])
        c, r = await cancel_and_replace(fc, s, 70800.0)
        assert c.ok and r.ok
        posts = [x for x in fc.calls if x[0] == "POST"]
        assert len(posts) == 1

    async def test_retry_stale_age_path(self, rows, fake_client):
        fc = fake_client(
            get_resp={"rt_cd": "0", "output1": rows, "output2": {}},
            post_resp={"rt_cd": "0", "output": {}},
        )
        pol = RetryPolicy(max_age_sec=300, max_drift_bps=30,
                         reprice_offset_bps=5, max_retries_per_order=2)
        counts: dict[str, int] = {}
        acts = await retry_stale_limits(
            fc, current_prices={"005930": 70500, "000660": 150_000},
            policy=pol, retry_counts=counts,
        )
        by = {a.order_no: a for a in acts}
        assert by["01"].reason == "age" and by["01"].replace_result.ok
        assert "within_tolerance" in by["02"].reason
        assert counts["01"] == 1

    async def test_retry_cap_honoured(self, rows, fake_client):
        fc = fake_client(
            get_resp={"rt_cd": "0", "output1": rows, "output2": {}},
            post_resp={"rt_cd": "0", "output": {}},
        )
        pol = RetryPolicy(max_retries_per_order=2)
        counts = {"01": 2}
        acts = await retry_stale_limits(
            fc, current_prices={"005930": 70500}, policy=pol,
            retry_counts=counts,
        )
        a01 = [a for a in acts if a.order_no == "01"][0]
        assert a01.reason == "skipped:retry_cap"

    async def test_cancel_pending_hard(self, rows, fake_client):
        fc = fake_client(post_resp={"rt_cd": "0", "output": {}})
        s = _parse_status(rows[0])
        await cancel_pending(fc, s)
        body = [c for c in fc.calls if c[0] == "POST"][0][3]
        assert body["RVSE_CNCL_DVSN_CD"] == "02"

    async def test_drift_reprice(self, fake_client):
        rows_drift = [{
            "odno": "55", "ord_gno_brno": "0079", "pdno": "035420",
            "prdt_name": "N", "sll_buy_dvsn_cd": "02", "ord_qty": "20",
            "tot_ccld_qty": "0", "rmn_qty": "20", "ord_unpr": "200000",
            "avg_prvs": "0", "ord_tmd": _t_ago(15), "cncl_yn": "N",
        }]
        fc = fake_client(
            get_resp={"rt_cd": "0", "output1": rows_drift, "output2": {}},
            post_resp={"rt_cd": "0", "output": {}},
        )
        pol = RetryPolicy(max_age_sec=300, max_drift_bps=30,
                          reprice_offset_bps=5)
        acts = await retry_stale_limits(
            fc, current_prices={"035420": 201_000}, policy=pol,
            retry_counts={},
        )
        assert len(acts) == 1 and acts[0].reason == "drift"
        body = [c for c in fc.calls if c[0] == "POST"][0][3]
        new_px = int(body["ORD_UNPR"])
        assert 201_000 < new_px <= 201_200
