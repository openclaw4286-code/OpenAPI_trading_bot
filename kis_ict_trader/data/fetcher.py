"""KIS OpenAPI market-data fetcher.

Thin wrappers over `execution.kis_client.KISClient` that normalize KIS REST
responses into pandas DataFrames / dicts. No on-disk caching here — backtest
cache is added later in STEP 11.

All prices are returned as int (KRW) and volumes as int (shares).
All timestamps are naive pandas.Timestamp in KST (KIS fields are implicitly
Asia/Seoul); upstream code should not re-localize unless comparing to UTC.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from .. import config as cfg
from ..execution.kis_client import KISClient

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
PATH_PRICE = "/uapi/domestic-stock/v1/quotations/inquire-price"
PATH_CHART_DAILY = (
    "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
)
PATH_CHART_MINUTE = (
    "/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice"
)
# Historical intraday (past-day minute bars). Each call returns at most
# ~30 1-minute bars ending at FID_INPUT_HOUR_1 of FID_INPUT_DATE_1.
PATH_CHART_MINUTE_DAILY = (
    "/uapi/domestic-stock/v1/quotations/inquire-time-dailychartprice"
)
PATH_BALANCE = "/uapi/domestic-stock/v1/trading/inquire-balance"

# KIS market-div code for 일반 KOSPI/KOSDAQ/KONEX 현물.
_MARKET_DIV = "J"

_OHLCV_COLS = ["open", "high", "low", "close", "volume"]


# ---------------------------------------------------------------------------
# Current price
# ---------------------------------------------------------------------------
async def get_current_price(client: KISClient, ticker: str) -> dict[str, Any]:
    """Return KIS 주식현재가 `output` dict for `ticker`.

    Useful fields: stck_prpr (현재가), per, pbr, eps, bps,
    hts_avls (시가총액, 억원 단위), lstn_stcn (상장주식수), acml_vol.
    """
    params = {
        "FID_COND_MRKT_DIV_CODE": _MARKET_DIV,
        "FID_INPUT_ISCD": ticker,
    }
    j = await client.get(PATH_PRICE, "price_current", params=params)
    return dict(j.get("output") or {})


# ---------------------------------------------------------------------------
# Daily OHLCV (paginated)
# ---------------------------------------------------------------------------
async def get_daily_ohlcv(
    client: KISClient,
    ticker: str,
    start: str | datetime,
    end: str | datetime,
    adjusted: bool = True,
) -> pd.DataFrame:
    """Daily OHLCV between `start` and `end` (inclusive).

    KIS `inquire-daily-itemchartprice` returns at most ~100 business days per
    request, so we walk backwards in ~130 calendar-day chunks until we cover
    the requested span. Returns an empty DataFrame with standard columns when
    no data is available.
    """
    start_dt = _to_date(start)
    end_dt = _to_date(end)
    if end_dt < start_dt:
        raise ValueError("end must be >= start")

    rows: list[dict] = []
    cursor = end_dt
    step = timedelta(days=130)
    while cursor >= start_dt:
        chunk_start = max(start_dt, cursor - step)
        params = {
            "FID_COND_MRKT_DIV_CODE": _MARKET_DIV,
            "FID_INPUT_ISCD": ticker,
            "FID_INPUT_DATE_1": chunk_start.strftime("%Y%m%d"),
            "FID_INPUT_DATE_2": cursor.strftime("%Y%m%d"),
            "FID_PERIOD_DIV_CODE": "D",
            "FID_ORG_ADJ_PRC": "0" if adjusted else "1",
        }
        j = await client.get(PATH_CHART_DAILY, "chart_daily", params=params)
        out2 = j.get("output2") or []
        if not out2:
            break
        rows.extend(out2)
        # Advance cursor using the actual oldest date returned (KIS caps a
        # single response at ~100 business days, which may be shorter than
        # the requested window). Stop once we've passed start_dt.
        oldest_str = str(out2[-1].get("stck_bsop_date") or "")
        try:
            oldest_dt = datetime.strptime(oldest_str, "%Y%m%d")
        except ValueError:
            break
        if oldest_dt <= start_dt:
            break
        next_cursor = oldest_dt - timedelta(days=1)
        # Safety: if the server fails to advance us, abort rather than loop.
        if next_cursor >= cursor:
            break
        cursor = next_cursor

    df = _normalize_daily(rows)
    if df.empty:
        return df
    mask = (df.index >= pd.Timestamp(start_dt)) & (df.index <= pd.Timestamp(end_dt))
    return df.loc[mask]


# ---------------------------------------------------------------------------
# Minute OHLCV (today, resampled)
# ---------------------------------------------------------------------------
async def get_minute_ohlcv(
    client: KISClient,
    ticker: str,
    interval_minutes: int = 15,
    end_time_hhmmss: str | None = None,
    max_batches: int = 20,
) -> pd.DataFrame:
    """Intraday OHLCV for `ticker`, resampled to `interval_minutes`.

    KIS `inquire-time-itemchartprice` returns up to 30 1-minute bars per call
    ending at FID_INPUT_HOUR_1. We walk backwards until 09:00 or until the
    response is empty, then resample.

    NOTE: this TR only supports **today's** session. Historical intraday
    needs a different TR and is handled in the backtest pipeline (STEP 11).
    """
    if interval_minutes < 1:
        raise ValueError("interval_minutes must be >= 1")

    if end_time_hhmmss is None:
        end_time_hhmmss = datetime.now().strftime("%H%M%S")

    rows: list[dict] = []
    hhmmss = end_time_hhmmss
    for _ in range(max_batches):
        params = {
            "FID_ETC_CLS_CODE": "",
            "FID_COND_MRKT_DIV_CODE": _MARKET_DIV,
            "FID_INPUT_ISCD": ticker,
            "FID_INPUT_HOUR_1": hhmmss,
            "FID_PW_DATA_INCU_YN": "N",
        }
        j = await client.get(PATH_CHART_MINUTE, "chart_minute", params=params)
        out2 = j.get("output2") or []
        if not out2:
            break
        rows.extend(out2)
        oldest = str(out2[-1].get("stck_cntg_hour", "") or "")
        if not oldest or oldest <= "090000":
            break
        hhmmss = _subtract_one_minute(oldest)

    m1 = _normalize_minute(rows)
    if m1.empty or interval_minutes == 1:
        return m1
    return _resample(m1, interval_minutes)


# ---------------------------------------------------------------------------
# Historical intraday (multi-day paged)
# ---------------------------------------------------------------------------
async def get_historical_minute_ohlcv(
    client: KISClient,
    ticker: str,
    *,
    days_back: int = 20,
    interval_minutes: int = 60,
    use_cache: bool = True,
) -> pd.DataFrame:
    """Past-session minute OHLCV walked backward `days_back` business days
    and resampled to `interval_minutes`.

    KIS `inquire-time-dailychartprice` returns at most ~30 one-minute
    bars per call, ending at FID_INPUT_HOUR_1 on FID_INPUT_DATE_1. We
    sweep each business day from 15:30 back to 09:00 in 30-bar chunks.

    A parquet cache at `cfg.DIR_DATA_CACHE/minute_<ticker>.parquet`
    stores the 1-minute series so subsequent calls only top up the
    most recent day rather than re-paging the whole window. Cache is
    skipped when `use_cache=False` (e.g. tests or forced refresh).
    """
    cache_path = cfg.DIR_DATA_CACHE / f"minute_{ticker}.parquet"
    cached = pd.DataFrame(columns=_OHLCV_COLS)
    if use_cache and cache_path.exists():
        try:
            cached = pd.read_parquet(cache_path)
        except Exception:
            cached = pd.DataFrame(columns=_OHLCV_COLS)

    today = datetime.now().date()
    want_oldest = datetime.combine(
        today - timedelta(days=days_back * 2), datetime.min.time(),
    )
    # If cache already covers the requested window, short-circuit.
    if (
        use_cache
        and not cached.empty
        and cached.index.min() <= pd.Timestamp(want_oldest)
    ):
        return _resample(cached, interval_minutes) if interval_minutes != 1 \
            else cached

    have_oldest = cached.index.min() if not cached.empty else None
    rows: list[dict] = []
    remaining = days_back
    day = today
    while remaining > 0:
        # Skip weekends
        if day.weekday() >= 5:
            day -= timedelta(days=1)
            continue
        day_str = day.strftime("%Y%m%d")
        hhmmss = "153000"
        # Per day, KIS caps each page at ~30 bars; 1 session = ~390 bars
        # (09:00–15:30). Walk up to 20 pages to guarantee coverage.
        for _ in range(20):
            params = {
                "FID_COND_MRKT_DIV_CODE": _MARKET_DIV,
                "FID_INPUT_ISCD": ticker,
                "FID_INPUT_DATE_1": day_str,
                "FID_INPUT_HOUR_1": hhmmss,
                "FID_PW_DATA_INCU_YN": "N",
                "FID_FAKE_TICK_INCU_YN": "N",
            }
            j = await client.get(
                PATH_CHART_MINUTE_DAILY, "chart_minute_daily", params=params,
            )
            out2 = j.get("output2") or []
            if not out2:
                break
            # Ensure every row carries the date we queried for,
            # since the endpoint may omit stck_bsop_date.
            for r in out2:
                r.setdefault("stck_bsop_date", day_str)
            rows.extend(out2)
            oldest = str(out2[-1].get("stck_cntg_hour", "") or "")
            if not oldest or oldest <= "090000":
                break
            hhmmss = _subtract_one_minute(oldest)
        remaining -= 1
        day -= timedelta(days=1)
        if have_oldest is not None \
                and pd.Timestamp(datetime.combine(day, datetime.min.time())) \
                < have_oldest:
            # Reached into already-cached territory
            break

    fresh = _normalize_minute(rows)
    combined = (
        pd.concat([cached, fresh]).sort_index()
        .loc[lambda d: ~d.index.duplicated(keep="last")]
    ) if not fresh.empty else cached

    if use_cache and not combined.empty:
        try:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            combined.to_parquet(cache_path)
        except Exception:
            # Cache failure must not break the fetch — trading still works
            # without the on-disk index.
            pass

    if combined.empty or interval_minutes == 1:
        return combined
    return _resample(combined, interval_minutes)


# ---------------------------------------------------------------------------
# Balance / account
# ---------------------------------------------------------------------------
async def get_balance(client: KISClient) -> dict[str, Any]:
    """Account holdings + summary (예수금/평가금액 등).

    Returns {'holdings': [output1 rows], 'summary': output2[0] or {}}.
    """
    params = {
        "CANO": cfg.KIS_ACCOUNT_NO,
        "ACNT_PRDT_CD": cfg.KIS_ACCOUNT_PRODUCT_CODE,
        "AFHR_FLPR_YN": "N",
        "OFL_YN": "",
        "INQR_DVSN": "02",          # 종목별
        "UNPR_DVSN": "01",
        "FUND_STTL_ICLD_YN": "N",
        "FNCG_AMT_AUTO_RDPT_YN": "N",
        "PRCS_DVSN": "01",          # 전일매매 미포함
        "CTX_AREA_FK100": "",
        "CTX_AREA_NK100": "",
    }
    j = await client.get(PATH_BALANCE, "balance", params=params)
    out1 = j.get("output1") or []
    out2 = j.get("output2") or []
    return {"holdings": list(out1), "summary": dict(out2[0]) if out2 else {}}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _to_date(x: str | datetime) -> datetime:
    if isinstance(x, datetime):
        return x.replace(hour=0, minute=0, second=0, microsecond=0)
    return datetime.strptime(str(x), "%Y%m%d")


def _subtract_one_minute(hhmmss: str) -> str:
    t = datetime.strptime(hhmmss, "%H%M%S") - timedelta(minutes=1)
    return t.strftime("%H%M%S")


def _normalize_daily(rows: list[dict]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=_OHLCV_COLS)
    df = pd.DataFrame(rows)
    df["ts"] = pd.to_datetime(df["stck_bsop_date"], format="%Y%m%d")
    df = df.assign(
        open=pd.to_numeric(df["stck_oprc"], errors="coerce"),
        high=pd.to_numeric(df["stck_hgpr"], errors="coerce"),
        low=pd.to_numeric(df["stck_lwpr"], errors="coerce"),
        close=pd.to_numeric(df["stck_clpr"], errors="coerce"),
        volume=pd.to_numeric(df["acml_vol"], errors="coerce"),
    )
    df = df[["ts", *_OHLCV_COLS]].dropna(subset=["open", "high", "low", "close"])
    df = df.drop_duplicates("ts").sort_values("ts").set_index("ts")
    for c in _OHLCV_COLS[:-1]:
        df[c] = df[c].astype(int)
    df["volume"] = df["volume"].fillna(0).astype("int64")
    return df


def _normalize_minute(
    rows: list[dict], default_date: str | None = None
) -> pd.DataFrame:
    """Normalize intraday OHLCV rows.

    `default_date` is used for rows missing `stck_bsop_date` (some
    endpoint variants omit it and rely on the request date instead).
    """
    if not rows:
        return pd.DataFrame(columns=_OHLCV_COLS)
    df = pd.DataFrame(rows)
    # 시각 문자열 6자리 보장
    df["stck_cntg_hour"] = df["stck_cntg_hour"].astype(str).str.zfill(6)
    if "stck_bsop_date" not in df.columns:
        if default_date is None:
            default_date = datetime.now().strftime("%Y%m%d")
        df["stck_bsop_date"] = default_date
    else:
        df["stck_bsop_date"] = df["stck_bsop_date"].fillna(
            default_date or datetime.now().strftime("%Y%m%d")
        )
    df["ts"] = pd.to_datetime(
        df["stck_bsop_date"].astype(str) + df["stck_cntg_hour"],
        format="%Y%m%d%H%M%S",
    )
    df = df.assign(
        open=pd.to_numeric(df["stck_oprc"], errors="coerce"),
        high=pd.to_numeric(df["stck_hgpr"], errors="coerce"),
        low=pd.to_numeric(df["stck_lwpr"], errors="coerce"),
        close=pd.to_numeric(df["stck_prpr"], errors="coerce"),
        volume=pd.to_numeric(df.get("cntg_vol"), errors="coerce"),
    )
    df = df[["ts", *_OHLCV_COLS]].dropna(subset=["open", "high", "low", "close"])
    df = df.drop_duplicates("ts").sort_values("ts").set_index("ts")
    return df


def _resample(df1: pd.DataFrame, interval_minutes: int) -> pd.DataFrame:
    if df1.empty:
        return df1
    rule = f"{interval_minutes}min"
    agg = (
        df1.resample(rule, label="left", closed="left")
        .agg({
            "open":  "first",
            "high":  "max",
            "low":   "min",
            "close": "last",
            "volume": "sum",
        })
        .dropna(subset=["open", "high", "low", "close"])
    )
    return agg
