"""Naver News search (https://developers.naver.com/docs/serviceapi/search/news/news.md).

Async HTTP wrapper around the public search/news.json endpoint.
Returns an empty list when NAVER_CLIENT_ID / NAVER_CLIENT_SECRET are
unset so news enrichment can degrade gracefully — quant screening
and trading still work without it.
"""
from __future__ import annotations

import html
import logging
import os
import re
from dataclasses import dataclass
from email.utils import parsedate_to_datetime

import httpx

from .. import config as cfg

NAVER_BASE = "https://openapi.naver.com/v1/search/news.json"

NAVER_CLIENT_ID: str = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET: str = os.getenv("NAVER_CLIENT_SECRET", "")

log = logging.getLogger(__name__)

_TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class NewsItem:
    title: str
    description: str
    link: str
    original_link: str
    published_at: str          # ISO 8601 or "" when unparseable


def _clean(text: str) -> str:
    """Unescape HTML entities, then strip any residual tags Naver returns."""
    if not text:
        return ""
    return _TAG_RE.sub("", html.unescape(text)).strip()


def _iso_pubdate(raw: str) -> str:
    if not raw:
        return ""
    try:
        dt = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return ""
    if dt is None:
        return ""
    return dt.isoformat(timespec="seconds")


async def get_news(
    query: str,
    top_n: int | None = None,
    *,
    sort: str = "date",
) -> list[NewsItem]:
    """Return up to top_n recent news items for `query`.

    Empty list on missing creds, HTTP error, or parse error — never raises.
    """
    if not (NAVER_CLIENT_ID and NAVER_CLIENT_SECRET):
        log.debug("NAVER credentials missing; skipping news search for %r", query)
        return []

    n = int(top_n if top_n is not None else cfg.NEWS_TOP_N)
    n = max(1, min(n, 100))
    params = {"query": query, "display": n, "sort": sort}
    headers = {
        "X-Naver-Client-Id":     NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(NAVER_BASE, params=params, headers=headers)
    except Exception as e:
        log.warning("Naver news fetch failed for %r: %s", query, e)
        return []

    if r.status_code != 200:
        log.warning(
            "Naver news HTTP %s for %r: %s",
            r.status_code, query, r.text[:200],
        )
        return []

    try:
        data = r.json()
    except Exception as e:
        log.warning("Naver news parse failed: %s", e)
        return []

    items: list[NewsItem] = []
    for it in (data.get("items") or []):
        items.append(NewsItem(
            title=_clean(it.get("title", "")),
            description=_clean(it.get("description", "")),
            link=it.get("link", "") or "",
            original_link=it.get("originallink", "") or "",
            published_at=_iso_pubdate(it.get("pubDate", "")),
        ))
    return items[:n]
