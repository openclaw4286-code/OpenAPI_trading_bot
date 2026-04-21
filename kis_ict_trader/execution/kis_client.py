"""KIS OpenAPI common client.

Every REST call to 한국투자증권 OpenAPI must go through this module so that:
  * OAuth access_token is cached (24h validity, 1-req/min reissue cap)
  * POST orders carry a hashkey header (built via /uapi/hashkey)
  * Requests are throttled per KIS rate limit (real: 20/s, vps: 2/s)
  * TR_ID is resolved from config based on KIS_ENV (real | vps)
"""
from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any, Mapping

import httpx

from .. import config as cfg


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class KISAPIError(RuntimeError):
    def __init__(
        self,
        status: int,
        rt_cd: str,
        msg_cd: str,
        msg1: str,
        raw: Any,
    ) -> None:
        super().__init__(
            f"KIS API error: http={status} rt_cd={rt_cd!r} "
            f"msg_cd={msg_cd!r} msg={msg1!r}"
        )
        self.status = status
        self.rt_cd = rt_cd
        self.msg_cd = msg_cd
        self.msg1 = msg1
        self.raw = raw


# ---------------------------------------------------------------------------
# Rate limiter (sliding 1-second window)
# ---------------------------------------------------------------------------
class _RateLimiter:
    def __init__(self, rate_per_sec: int) -> None:
        self._rate = max(1, int(rate_per_sec))
        self._times: list[float] = []
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            self._times = [t for t in self._times if now - t < 1.0]
            if len(self._times) >= self._rate:
                sleep_for = 1.0 - (now - self._times[0])
                if sleep_for > 0:
                    await asyncio.sleep(sleep_for)
                now = time.monotonic()
                self._times = [t for t in self._times if now - t < 1.0]
            self._times.append(time.monotonic())


# ---------------------------------------------------------------------------
# Token cache (file-backed, 24h TTL, 1/min reissue cap)
# ---------------------------------------------------------------------------
class _TokenCache:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = asyncio.Lock()
        self._memo: dict | None = None

    def load(self) -> dict:
        if self._memo is not None:
            return self._memo
        if not self.path.exists():
            self._memo = {}
            return self._memo
        try:
            self._memo = json.loads(self.path.read_text("utf-8"))
        except Exception:
            self._memo = {}
        return self._memo

    def save(self, data: dict) -> None:
        self._memo = data
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
        tmp.replace(self.path)

    @staticmethod
    def is_valid(data: dict) -> bool:
        if not data.get("access_token") or not data.get("expires_at"):
            return False
        return (data["expires_at"] - time.time()) > cfg.KIS_TOKEN_REFRESH_BEFORE_SEC

    @staticmethod
    def issue_age_sec(data: dict) -> float:
        last = data.get("issued_at")
        if not last:
            return float("inf")
        return time.time() - float(last)


# ---------------------------------------------------------------------------
# KIS async client
# ---------------------------------------------------------------------------
class KISClient:
    """Async singleton-ish client. Use either `async with KISClient()` or
    create once and reuse across the app; call `close()` on shutdown."""

    def __init__(self) -> None:
        self._base = cfg.kis_base_url()
        self._app_key = cfg.KIS_APP_KEY
        self._app_secret = cfg.KIS_APP_SECRET
        self._limiter = _RateLimiter(cfg.kis_req_per_sec())
        self._cache = _TokenCache(cfg.PATH_TOKEN_CACHE)
        self._http: httpx.AsyncClient | None = None

    # --- context manager --------------------------------------------------
    async def __aenter__(self) -> "KISClient":
        await self._ensure_http()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()

    async def close(self) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    async def _ensure_http(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(base_url=self._base, timeout=15.0)
        return self._http

    # --- OAuth token ------------------------------------------------------
    async def get_access_token(self) -> str:
        async with self._cache._lock:
            data = self._cache.load()
            if self._cache.is_valid(data):
                return data["access_token"]

            # Respect 1-request-per-minute reissue cap.
            if (
                self._cache.issue_age_sec(data) < cfg.KIS_TOKEN_REISSUE_COOLDOWN_SEC
                and data.get("access_token")
            ):
                return data["access_token"]

            token = await self._request_new_token()
            self._cache.save(token)
            return token["access_token"]

    async def _request_new_token(self) -> dict:
        http = await self._ensure_http()
        body = {
            "grant_type": "client_credentials",
            "appkey": self._app_key,
            "appsecret": self._app_secret,
        }
        delay = 2.0
        last_exc: Exception | None = None
        for _ in range(4):
            try:
                r = await http.post("/oauth2/tokenP", json=body)
            except httpx.RequestError as e:
                last_exc = e
                await asyncio.sleep(delay)
                delay *= 2
                continue

            if r.status_code == 200:
                j = r.json()
                if "access_token" not in j:
                    raise KISAPIError(200, "", "", "missing access_token", j)
                return {
                    "access_token": j["access_token"],
                    "token_type": j.get("token_type", "Bearer"),
                    "expires_at": time.time() + int(j.get("expires_in", 86400)),
                    "issued_at": time.time(),
                }
            if r.status_code in (429, 500, 502, 503, 504):
                await asyncio.sleep(delay)
                delay *= 2
                continue

            # Non-retryable
            try:
                j = r.json()
            except Exception:
                j = {"text": r.text[:200]}
            raise KISAPIError(
                r.status_code,
                j.get("rt_cd", ""),
                j.get("msg_cd", "") or j.get("error_code", ""),
                j.get("msg1", "") or j.get("error_description", r.text[:200]),
                j,
            )
        raise RuntimeError(f"Token request failed after retries: {last_exc!r}")

    # --- hashkey ----------------------------------------------------------
    async def build_hashkey(self, body: Mapping[str, Any]) -> str:
        """Required for every POST (order) request."""
        http = await self._ensure_http()
        headers = {
            "content-type": "application/json; charset=utf-8",
            "appkey": self._app_key,
            "appsecret": self._app_secret,
        }
        r = await http.post("/uapi/hashkey", json=dict(body), headers=headers)
        if r.status_code != 200:
            try:
                j = r.json()
            except Exception:
                j = {"text": r.text[:200]}
            raise KISAPIError(
                r.status_code,
                j.get("rt_cd", ""),
                j.get("msg_cd", ""),
                j.get("msg1", "hashkey request failed"),
                j,
            )
        j = r.json()
        h = j.get("HASH") or j.get("hash") or ""
        if not h:
            raise KISAPIError(200, "", "", "empty hashkey", j)
        return h

    # --- headers ----------------------------------------------------------
    def _headers(
        self,
        tr_id_key: str,
        token: str,
        hashkey: str | None,
    ) -> dict[str, str]:
        h = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "appkey": self._app_key,
            "appsecret": self._app_secret,
            "tr_id": cfg.tr_id(tr_id_key),
            "custtype": "P",
        }
        if hashkey:
            h["hashkey"] = hashkey
        return h

    # --- verbs ------------------------------------------------------------
    async def get(
        self,
        path: str,
        tr_id_key: str,
        params: Mapping[str, Any] | None = None,
        extra_headers: Mapping[str, str] | None = None,
    ) -> dict:
        http = await self._ensure_http()
        token = await self.get_access_token()
        headers = self._headers(tr_id_key, token, None)
        if extra_headers:
            headers.update(extra_headers)
        await self._limiter.acquire()
        r = await http.get(path, params=dict(params or {}), headers=headers)
        return self._handle_response(r)

    async def post(
        self,
        path: str,
        tr_id_key: str,
        body: Mapping[str, Any],
        extra_headers: Mapping[str, str] | None = None,
    ) -> dict:
        http = await self._ensure_http()
        token = await self.get_access_token()
        hashkey = await self.build_hashkey(body)
        headers = self._headers(tr_id_key, token, hashkey)
        if extra_headers:
            headers.update(extra_headers)
        await self._limiter.acquire()
        r = await http.post(path, json=dict(body), headers=headers)
        return self._handle_response(r)

    # --- response parsing -------------------------------------------------
    @staticmethod
    def _handle_response(r: httpx.Response) -> dict:
        try:
            j = r.json()
        except Exception:
            raise KISAPIError(
                r.status_code, "", "", r.text[:200], {"text": r.text}
            )

        if r.status_code != 200:
            raise KISAPIError(
                r.status_code,
                str(j.get("rt_cd", "")),
                str(j.get("msg_cd", "")),
                str(j.get("msg1", r.text[:200])),
                j,
            )

        rt_cd = str(j.get("rt_cd", ""))
        if rt_cd and rt_cd != "0":
            raise KISAPIError(
                r.status_code,
                rt_cd,
                str(j.get("msg_cd", "")),
                str(j.get("msg1", "")),
                j,
            )
        return j
