"""Hybrid fundamentals source: DART OpenAPI → CSV fallback → None.

Quant screener pulls these to score value / quality / growth factors.
KIS OpenAPI does not expose financial statements, so we wire this
up separately:

  1. **DART OpenAPI** (primary)  — corp_code mapping cached as parquet;
     main financial accounts fetched via `fnlttSinglAcnt.json`.
  2. **CSV fallback** at `data/cache/fundamentals.csv` — schema:
       ticker,per,pbr,psr,roe,op_margin,debt_ratio,revenue_yoy,op_yoy,sector
  3. **None**  — Fundamentals(source="none"), quant_screener applies
     a 0-score penalty to the missing factors but does not exclude the
     ticker outright.

PER / PBR from KIS 시세 override whichever source when passed in
(more real-time than DART/CSV which lag the statement cycle).
"""
from __future__ import annotations

import io
import logging
import os
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET

import httpx
import pandas as pd

from .. import config as cfg

# ---------------------------------------------------------------------------
# Constants / paths
# ---------------------------------------------------------------------------
DART_BASE = "https://opendart.fss.or.kr/api"
PATH_CORP_CODE = "/corpCode.xml"
PATH_SINGL_ACNT = "/fnlttSinglAcnt.json"

CACHE_CORP_CODES = cfg.DIR_DATA_CACHE / "corp_codes.parquet"
CACHE_FUNDAMENTALS_CSV = cfg.DIR_DATA_CACHE / "fundamentals.csv"

DART_API_KEY: str = os.getenv("DART_API_KEY", "")

log = logging.getLogger(__name__)

# DART 보고서 코드: 1Q=11013, 반기=11012, 3Q=11014, 사업=11011
_REPORT_CODE_FALLBACK = ["11014", "11012", "11013", "11011"]


@dataclass
class Fundamentals:
    ticker: str
    per: float | None = None
    pbr: float | None = None
    psr: float | None = None
    roe: float | None = None           # %
    op_margin: float | None = None     # %
    debt_ratio: float | None = None    # %
    revenue_yoy: float | None = None   # ratio (0.05 = +5%)
    op_yoy: float | None = None
    sector: str | None = None
    source: str = "none"               # "dart" | "csv" | "none"


# ---------------------------------------------------------------------------
# corp_code cache (DART)
# ---------------------------------------------------------------------------
class _CorpCodeCache:
    """Maps KRX ticker (6-digit) → DART corp_code (8-digit).

    `corpCode.xml` is served as a ZIP; we unzip in-memory then parquet the
    parsed rows so warm starts skip the network hit entirely.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self._df: pd.DataFrame | None = None

    async def load(self) -> pd.DataFrame:
        if self._df is not None:
            return self._df
        if self.path.exists():
            self._df = pd.read_parquet(self.path)
            return self._df
        self._df = await self._download()
        self._df.to_parquet(self.path, index=False)
        return self._df

    async def _download(self) -> pd.DataFrame:
        if not DART_API_KEY:
            raise RuntimeError("DART_API_KEY is not set")
        async with httpx.AsyncClient(timeout=60) as http:
            r = await http.get(
                f"{DART_BASE}{PATH_CORP_CODE}",
                params={"crtfc_key": DART_API_KEY},
            )
            r.raise_for_status()
            buf = io.BytesIO(r.content)
        with zipfile.ZipFile(buf) as z:
            name = z.namelist()[0]
            xml_bytes = z.read(name)
        root = ET.fromstring(xml_bytes)
        rows: list[dict] = []
        for el in root.iter("list"):
            rows.append({
                "corp_code":   (el.findtext("corp_code") or "").strip(),
                "corp_name":   (el.findtext("corp_name") or "").strip(),
                "stock_code":  (el.findtext("stock_code") or "").strip(),
                "modify_date": (el.findtext("modify_date") or "").strip(),
            })
        df = pd.DataFrame(rows)
        # listed only
        df = df[df["stock_code"].astype(str).str.len() == 6].reset_index(drop=True)
        return df

    def ticker_to_corp(self, ticker: str) -> str | None:
        if self._df is None:
            return None
        hit = self._df[self._df["stock_code"] == ticker]
        if hit.empty:
            return None
        return str(hit.iloc[0]["corp_code"])


_corp_cache = _CorpCodeCache(CACHE_CORP_CODES)


# ---------------------------------------------------------------------------
# CSV fallback
# ---------------------------------------------------------------------------
_csv_cache: pd.DataFrame | None = None


def _load_csv_fallback() -> pd.DataFrame:
    global _csv_cache
    if _csv_cache is not None:
        return _csv_cache
    if CACHE_FUNDAMENTALS_CSV.exists():
        _csv_cache = pd.read_csv(CACHE_FUNDAMENTALS_CSV, dtype={"ticker": str})
    else:
        _csv_cache = pd.DataFrame()
    return _csv_cache


def reset_csv_cache() -> None:
    """Let tests / ops force a reload of the CSV fallback."""
    global _csv_cache
    _csv_cache = None


# ---------------------------------------------------------------------------
# DART account extraction helpers
# ---------------------------------------------------------------------------
def _num(s: str | None) -> float | None:
    if s is None:
        return None
    t = str(s).strip()
    if not t or t == "-":
        return None
    try:
        return float(t.replace(",", ""))
    except ValueError:
        return None


def _pick(rows: list[dict], keyword: str, sj_div: str, field: str) -> float | None:
    """Return `field` of first row whose account_nm contains keyword."""
    for r in rows:
        if r.get("sj_div") != sj_div:
            continue
        if keyword in str(r.get("account_nm", "")):
            return _num(r.get(field))
    return None


async def _fetch_dart_main(
    http: httpx.AsyncClient,
    corp_code: str,
    year: int,
    reprt_code: str,
) -> list[dict]:
    r = await http.get(
        f"{DART_BASE}{PATH_SINGL_ACNT}",
        params={
            "crtfc_key": DART_API_KEY,
            "corp_code": corp_code,
            "bsns_year": str(year),
            "reprt_code": reprt_code,
        },
    )
    if r.status_code != 200:
        return []
    try:
        j = r.json()
    except Exception:
        return []
    if str(j.get("status")) != "000":
        return []
    return list(j.get("list") or [])


def _compute_from_rows(
    rows: list[dict],
    ticker: str,
    market_cap_krw: float | None,
    kis_per: float | None,
    kis_pbr: float | None,
) -> Fundamentals:
    rev      = _pick(rows, "매출액",     "IS", "thstrm_amount")
    op       = _pick(rows, "영업이익",   "IS", "thstrm_amount")
    net      = _pick(rows, "당기순이익", "IS", "thstrm_amount")
    equity   = _pick(rows, "자본총계",   "BS", "thstrm_amount")
    debt     = _pick(rows, "부채총계",   "BS", "thstrm_amount")

    prev_rev = _pick(rows, "매출액",     "IS", "frmtrm_amount")
    prev_op  = _pick(rows, "영업이익",   "IS", "frmtrm_amount")

    def _safe_div(a: float | None, b: float | None) -> float | None:
        if a is None or b is None or b == 0:
            return None
        return a / b

    roe        = _safe_div(net, equity)
    roe_pct    = roe * 100 if roe is not None else None
    op_margin  = _safe_div(op, rev)
    op_pct     = op_margin * 100 if op_margin is not None else None
    debt_ratio = _safe_div(debt, equity)
    debt_pct   = debt_ratio * 100 if debt_ratio is not None else None

    def _yoy(curr: float | None, prev: float | None) -> float | None:
        if curr is None or prev is None or prev == 0:
            return None
        return (curr - prev) / prev

    return Fundamentals(
        ticker=ticker,
        per=kis_per,
        pbr=kis_pbr,
        psr=_safe_div(market_cap_krw, rev),
        roe=roe_pct,
        op_margin=op_pct,
        debt_ratio=debt_pct,
        revenue_yoy=_yoy(rev, prev_rev),
        op_yoy=_yoy(op, prev_op),
        sector=None,
        source="dart",
    )


async def _from_dart(
    ticker: str,
    *,
    market_cap_krw: float | None,
    kis_per: float | None,
    kis_pbr: float | None,
) -> Fundamentals | None:
    corp_df = await _corp_cache.load()
    hit = corp_df[corp_df["stock_code"] == ticker]
    if hit.empty:
        return None
    corp_code = str(hit.iloc[0]["corp_code"])
    year = date.today().year
    async with httpx.AsyncClient(timeout=20) as http:
        for offset in (0, -1):
            for rc in _REPORT_CODE_FALLBACK:
                rows = await _fetch_dart_main(http, corp_code, year + offset, rc)
                if rows:
                    return _compute_from_rows(
                        rows, ticker,
                        market_cap_krw=market_cap_krw,
                        kis_per=kis_per,
                        kis_pbr=kis_pbr,
                    )
    return None


def _from_csv(ticker: str) -> Fundamentals | None:
    df = _load_csv_fallback()
    if df.empty or "ticker" not in df.columns:
        return None
    hit = df[df["ticker"] == ticker]
    if hit.empty:
        return None
    row = hit.iloc[0]

    def _g(k: str) -> float | None:
        v = row.get(k)
        if v is None:
            return None
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        return None if f != f else f  # NaN check

    sector = row.get("sector") if "sector" in df.columns else None
    return Fundamentals(
        ticker=ticker,
        per=_g("per"),
        pbr=_g("pbr"),
        psr=_g("psr"),
        roe=_g("roe"),
        op_margin=_g("op_margin"),
        debt_ratio=_g("debt_ratio"),
        revenue_yoy=_g("revenue_yoy"),
        op_yoy=_g("op_yoy"),
        sector=str(sector) if isinstance(sector, str) else None,
        source="csv",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def get_fundamentals(
    ticker: str,
    *,
    market_cap_krw: float | None = None,
    kis_per: float | None = None,
    kis_pbr: float | None = None,
) -> Fundamentals:
    """Resolve fundamentals with DART → CSV → None fallback chain.

    `market_cap_krw` comes from KIS 시세 (hts_avls field, converted from 억원
    to KRW by the caller). `kis_per` / `kis_pbr` override whatever the
    statements-derived row contains because they are live-quote derived.
    """
    if DART_API_KEY:
        try:
            f = await _from_dart(
                ticker,
                market_cap_krw=market_cap_krw,
                kis_per=kis_per,
                kis_pbr=kis_pbr,
            )
            if f is not None:
                return f
        except Exception as e:  # network / parse errors → fall through
            log.warning("DART fetch failed for %s: %s", ticker, e)

    csv_f = _from_csv(ticker)
    if csv_f is not None:
        if kis_per is not None:
            csv_f.per = kis_per
        if kis_pbr is not None:
            csv_f.pbr = kis_pbr
        return csv_f

    return Fundamentals(ticker=ticker, per=kis_per, pbr=kis_pbr, source="none")
