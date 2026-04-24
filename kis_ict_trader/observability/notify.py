"""Lightweight Slack / Discord webhook notifier.

Configure via env:
  KIS_NOTIFY_WEBHOOK_URL   full incoming-webhook URL (blank → Noop)
  KIS_NOTIFY_PROVIDER      "slack" (default) | "discord"

Every Notifier method is async and must never raise — the trading
loop is the caller, so a webhook flake should never cascade into a
failed order cycle. All network errors are logged and swallowed.
"""
from __future__ import annotations

import logging
import os
from typing import Literal

import httpx

log = logging.getLogger(__name__)

Level = Literal["info", "warn", "error"]

ENV_WEBHOOK_URL = "KIS_NOTIFY_WEBHOOK_URL"
ENV_PROVIDER = "KIS_NOTIFY_PROVIDER"
DEFAULT_TIMEOUT_SEC: float = 5.0


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
class Notifier:
    async def post(self, level: Level, title: str, text: str) -> None:
        raise NotImplementedError

    async def info(self, title: str, text: str = "") -> None:
        await self.post("info", title, text)

    async def warn(self, title: str, text: str = "") -> None:
        await self.post("warn", title, text)

    async def error(self, title: str, text: str = "") -> None:
        await self.post("error", title, text)


class NoopNotifier(Notifier):
    """Logs only — used when no webhook URL is configured."""

    async def post(self, level: Level, title: str, text: str) -> None:
        log.info("[notify:%s] %s | %s", level, title, text)


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------
_LEVEL_EMOJI = {"info": ":information_source:", "warn": ":warning:",
                "error": ":rotating_light:"}


def _format_slack(level: Level, title: str, text: str) -> dict:
    prefix = _LEVEL_EMOJI.get(level, "")
    body = f"*{prefix} {title}*"
    if text:
        body += f"\n```{text}```"
    return {"text": body}


def _format_discord(level: Level, title: str, text: str) -> dict:
    prefix = {"info": "ℹ️", "warn": "⚠️", "error": "🚨"}.get(level, "")
    body = f"**{prefix} {title}**"
    if text:
        body += f"\n```\n{text}\n```"
    return {"content": body}


class WebhookNotifier(Notifier):
    def __init__(
        self,
        url: str,
        provider: str = "slack",
        *,
        timeout: float = DEFAULT_TIMEOUT_SEC,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.url = url
        self.provider = provider.lower().strip() or "slack"
        self.timeout = float(timeout)
        # `client` is optional — when None, we create one per post() so
        # the caller never has to manage an async close().
        self._client = client

    async def post(self, level: Level, title: str, text: str) -> None:
        if self.provider == "discord":
            payload = _format_discord(level, title, text)
        else:
            payload = _format_slack(level, title, text)

        try:
            if self._client is not None:
                r = await self._client.post(
                    self.url, json=payload, timeout=self.timeout,
                )
            else:
                async with httpx.AsyncClient(timeout=self.timeout) as c:
                    r = await c.post(self.url, json=payload)
            if r.status_code >= 400:
                log.warning(
                    "notify webhook %s -> HTTP %s: %s",
                    self.provider, r.status_code, r.text[:200],
                )
        except Exception as e:
            # Never raise — observability must not break trading.
            log.warning("notify webhook failed: %s", e)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
def make_notifier(
    url: str | None = None, provider: str | None = None,
) -> Notifier:
    u = (url if url is not None else os.getenv(ENV_WEBHOOK_URL, "")).strip()
    if not u:
        return NoopNotifier()
    p = (provider or os.getenv(ENV_PROVIDER, "slack") or "slack").strip().lower()
    return WebhookNotifier(u, p)
