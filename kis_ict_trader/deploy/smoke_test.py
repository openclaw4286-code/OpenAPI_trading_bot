"""Read-only KIS OpenAPI connectivity smoke test.

Hits every GET endpoint the live loop depends on and reports pass /
fail for each. NEVER places an order — run this as the final gate
before flipping to live mode or after rotating credentials.

Invocation:
    python -m kis_ict_trader --smoke
    python -m kis_ict_trader --smoke --smoke-ticker 000660
    python -m kis_ict_trader --smoke --smoke-dart

Exit codes:
    0  every check passed
    1  at least one check failed (or early-abort on env / token)

The `run_smoke` coroutine is deliberately injectable: tests hand it a
fake KIS client + stubbed data fetchers so the CI job can exercise the
pass / fail / early-abort code paths without touching the network.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .. import config as cfg
from ..data.fetcher import (
    get_current_price,
    get_daily_ohlcv,
    get_minute_ohlcv,
)
from ..execution.kis_client import KISClient
from ..execution.order_lifecycle import inquire_daily_ccld
from ..execution.orders import get_balance


@dataclass
class Checklist:
    """In-memory pass/fail tally with tidy console printing."""
    results: list[tuple[str, bool, str]] = field(default_factory=list)
    start: float = field(default_factory=time.monotonic)
    echo: bool = True

    def record(self, name: str, ok: bool, detail: str = "") -> bool:
        self.results.append((name, ok, detail))
        if self.echo:
            mark = "✓" if ok else "✗"
            print(f"  {mark} {name:20s}  {detail}")
        return ok

    @property
    def passed(self) -> int:
        return sum(1 for _, ok, _ in self.results if ok)

    @property
    def total(self) -> int:
        return len(self.results)

    def summary(self) -> int:
        elapsed = time.monotonic() - self.start
        if self.echo:
            print()
            print(f"PASSED {self.passed}/{self.total} in {elapsed:.2f}s")
        return 0 if self.passed == self.total and self.total > 0 else 1


def _client_factory() -> KISClient:
    """Wrapped so tests can monkey-patch a fake KISClient into the
    module namespace."""
    return KISClient()


async def run_smoke(
    ticker: str = "005930",
    *,
    with_dart: bool = False,
    client_factory=None,
    echo: bool = True,
) -> int:
    """Execute the read-only connectivity checklist.

    Returns the process exit code (0 = all pass).

    `client_factory` defaults to `_client_factory`; tests inject a
    fake async-context-manager-capable client.
    """
    cl = Checklist(echo=echo)
    if echo:
        print(f"KIS smoke test — env={cfg.KIS_ENV} ticker={ticker}")

    # 1. env vars -----------------------------------------------------------
    try:
        cfg.validate()
        acct_tail = (cfg.KIS_ACCOUNT_NO or "")[-4:]
        cl.record(
            "env vars", True,
            f"env={cfg.KIS_ENV} account=...{acct_tail}",
        )
    except Exception as e:
        cl.record("env vars", False, str(e)[:160])
        return cl.summary()

    factory = client_factory or _client_factory
    client = factory()
    async with client:
        # 2. OAuth token ----------------------------------------------------
        try:
            tok = await client.get_access_token()
            cl.record("OAuth token", True, f"len={len(tok)}")
        except Exception as e:
            cl.record("OAuth token", False, repr(e)[:160])
            return cl.summary()

        # 3. current price --------------------------------------------------
        try:
            px = await get_current_price(client, ticker)
            price = px.get("stck_prpr", "?")
            name = (px.get("bstp_kor_isnm") or px.get("hts_kor_isnm")
                    or "?")
            cl.record("current price", True, f"{price} ({name})")
        except Exception as e:
            cl.record("current price", False, repr(e)[:160])

        # 4. daily OHLCV ----------------------------------------------------
        try:
            today = datetime.now()
            df = await get_daily_ohlcv(
                client, ticker, today - timedelta(days=200), today,
            )
            cl.record(
                "daily OHLCV", not df.empty,
                f"{len(df)} bars" if not df.empty else "empty",
            )
        except Exception as e:
            cl.record("daily OHLCV", False, repr(e)[:160])

        # 5. minute OHLCV (today only) --------------------------------------
        try:
            mdf = await get_minute_ohlcv(client, ticker, interval_minutes=15)
            # Empty frame is expected outside session hours — still an
            # acceptable pass because the endpoint answered.
            cl.record(
                "minute OHLCV", True,
                f"{len(mdf)} bars (today)" if not mdf.empty
                else "empty (off-session ok)",
            )
        except Exception as e:
            cl.record("minute OHLCV", False, repr(e)[:160])

        # 6. account balance ------------------------------------------------
        try:
            bal = await get_balance(client)
            cl.record(
                "account balance", True,
                f"cash={bal.cash_available:,.0f} "
                f"eval={bal.total_eval:,.0f} "
                f"positions={len(bal.positions)}",
            )
        except Exception as e:
            cl.record("account balance", False, repr(e)[:160])

        # 7. pending orders -------------------------------------------------
        try:
            pend = await inquire_daily_ccld(client, only_pending=True)
            cl.record("pending orders", True, f"{len(pend)} pending")
        except Exception as e:
            cl.record("pending orders", False, repr(e)[:160])

    # 8. (optional) DART fundamentals --------------------------------------
    if with_dart:
        try:
            from ..data.fundamentals import get_fundamentals
            f = await get_fundamentals(ticker)
            cl.record(
                "DART fundamentals", f.source != "none",
                f"src={f.source}",
            )
        except Exception as e:
            cl.record("DART fundamentals", False, repr(e)[:160])

    return cl.summary()
