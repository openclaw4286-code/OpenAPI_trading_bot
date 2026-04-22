"""Final-stage LLM gate for ICT trade candidates.

Takes the post-strategy, post-sizing `TradeSignal` set and sends the top
`cfg.LLM["top_n_candidates"]` (ranked by R:R) to the Claude CLI for a
final approve/reject vote. The CLI is invoked via subprocess so no API
key is required — authentication is handled out-of-band by Claude Max.

The LLM is instructed to reply with a single strict JSON object so the
parser is deterministic. If the response can't be parsed, we reject the
candidate with an `error` tag rather than guessing.

Tests inject a `cli_runner` stub; production uses `call_claude_cli`.
"""
from __future__ import annotations

import json
import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .. import config as cfg
from ..algorithm.ict_strategy import TradeSignal


log = logging.getLogger(__name__)


@dataclass
class LlmVerdict:
    symbol: str
    approved: bool
    confidence: float              # 0..1
    rationale: str
    raw: str = ""
    error: str | None = None


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
_PROMPT_TEMPLATE = """You are the final-stage risk gate for an ICT-based
intraday Korean equities system (KIS OpenAPI). Review one trade candidate
and respond with a single strict JSON object on its own line:

{{"approved": <bool>, "confidence": <float 0..1>, "rationale": "<=2 short sentences"}}

Approval rules:
- APPROVE only if HTF and MTF trend align with the trade direction, the POI
  is sensible (OB or unfilled FVG), the LTF trigger lies inside that POI,
  and the session is appropriate for an ICT entry.
- REJECT if news/earnings risk is flagged in context, R:R < 1.5, the POI
  has been repeatedly tagged, or the setup is ambiguous.
- No markdown. No prose outside the JSON.

Candidate:
  symbol        : {symbol}
  direction     : {direction}
  entry         : {entry:.4f}
  stop          : {stop:.4f}
  targets       : {targets}
  rr (to TP2)   : {rr:.2f}
  poi_kind      : {poi_kind}
  trigger_kind  : {trigger_kind}
  session       : {session}
  htf_trend     : {htf_trend}
  mtf_trend     : {mtf_trend}
  sl_method     : {sl_method}

Additional context:
{context_block}

Charts (if available, paths):
{chart_block}
"""


def build_prompt(
    signal: TradeSignal,
    context: dict | None = None,
    chart_paths: list[Path] | None = None,
) -> str:
    ctx = context or {}
    context_block = (
        "\n".join(f"  {k}: {v}" for k, v in ctx.items()) if ctx else "  (none)"
    )
    if chart_paths:
        chart_block = "\n".join(f"  {p}" for p in chart_paths)
    else:
        chart_block = "  (not attached)"
    meta = signal.meta or {}
    return _PROMPT_TEMPLATE.format(
        symbol=signal.symbol,
        direction=signal.direction,
        entry=signal.entry,
        stop=signal.stop,
        targets=[round(t, 4) for t in signal.targets],
        rr=signal.rr,
        poi_kind=signal.poi_kind or "none",
        trigger_kind=signal.trigger_kind,
        session=signal.session,
        htf_trend=meta.get("htf_trend", "?"),
        mtf_trend=meta.get("mtf_trend", "?"),
        sl_method=meta.get("sl_method", "?"),
        context_block=context_block,
        chart_block=chart_block,
    )


# ---------------------------------------------------------------------------
# Candidate ranking
# ---------------------------------------------------------------------------
def rank_candidates(
    signals: list[TradeSignal], n: int | None = None
) -> list[TradeSignal]:
    """Order by R:R desc, then by absolute R desc (bigger risk envelope first)."""
    limit = int(n if n is not None else cfg.LLM["top_n_candidates"])
    ordered = sorted(
        signals,
        key=lambda s: (s.rr, abs(s.entry - s.stop)),
        reverse=True,
    )
    return ordered[: max(0, limit)]


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------
def _extract_json(text: str) -> dict | None:
    # 1) Fenced JSON block
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    # 2) Any flat JSON object that mentions "approved"
    for candidate in re.findall(r"\{[^{}]*\"approved\"[^{}]*\}", text, flags=re.S):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def parse_verdict(raw: str, symbol: str) -> LlmVerdict:
    data = _extract_json(raw)
    if not data:
        return LlmVerdict(
            symbol=symbol, approved=False, confidence=0.0,
            rationale="unparseable LLM response", raw=raw,
            error="parse_error",
        )
    approved = bool(data.get("approved", False))
    try:
        conf = float(data.get("confidence", 0.0))
    except (TypeError, ValueError):
        conf = 0.0
    conf = min(1.0, max(0.0, conf))
    rationale = str(data.get("rationale", ""))[:400]
    return LlmVerdict(
        symbol=symbol, approved=approved, confidence=conf,
        rationale=rationale, raw=raw,
    )


# ---------------------------------------------------------------------------
# CLI invocation
# ---------------------------------------------------------------------------
def call_claude_cli(prompt: str, timeout: int | None = None) -> str:
    """Invoke the Claude CLI non-interactively (stdin prompt)."""
    binary = str(cfg.LLM["cli_binary"])
    model = str(cfg.LLM["model"])
    to = int(timeout if timeout is not None else cfg.LLM["timeout_sec"])
    cmd = [binary, "-p", "--model", model, "--output-format", "text"]
    proc = subprocess.run(
        cmd, input=prompt, capture_output=True, text=True, timeout=to,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"claude CLI failed ({proc.returncode}): "
            f"{proc.stderr.strip()[:500]}"
        )
    return proc.stdout


# ---------------------------------------------------------------------------
# Top-level evaluation
# ---------------------------------------------------------------------------
CliRunner = Callable[[str], str]


def _collect_charts(symbol: str, chart_dir: Path | None) -> list[Path]:
    if chart_dir is None:
        return []
    charts: list[Path] = []
    for fname in (
        cfg.LLM["chart_htf_filename"],
        cfg.LLM["chart_ltf_filename"],
    ):
        p = Path(chart_dir) / str(fname)
        if p.exists():
            charts.append(p)
    return charts


def evaluate_candidates(
    signals: list[TradeSignal],
    context_by_symbol: dict[str, dict] | None = None,
    chart_dir_by_symbol: dict[str, Path] | None = None,
    cli_runner: CliRunner | None = None,
) -> list[LlmVerdict]:
    """Run the LLM gate against the top-N candidates.

    - `context_by_symbol`: per-symbol free-form context (earnings date,
      sector news summary, prior fills, etc.).
    - `chart_dir_by_symbol`: directory containing daily.png/15m.png per
      symbol. Missing files are silently skipped.
    - `cli_runner`: override for tests. Defaults to `call_claude_cli`.
    """
    runner = cli_runner or call_claude_cli
    ctx_map = context_by_symbol or {}
    chart_map = chart_dir_by_symbol or {}
    verdicts: list[LlmVerdict] = []

    for sig in rank_candidates(signals):
        charts = _collect_charts(sig.symbol, chart_map.get(sig.symbol))
        prompt = build_prompt(sig, ctx_map.get(sig.symbol), charts)
        try:
            raw = runner(prompt)
        except subprocess.TimeoutExpired as e:
            log.warning("LLM timeout for %s: %s", sig.symbol, e)
            verdicts.append(LlmVerdict(
                symbol=sig.symbol, approved=False, confidence=0.0,
                rationale="cli_timeout", error="timeout",
            ))
            continue
        except Exception as e:
            log.warning("LLM call failed for %s: %s", sig.symbol, e)
            verdicts.append(LlmVerdict(
                symbol=sig.symbol, approved=False, confidence=0.0,
                rationale=f"cli_error: {e}", error="cli_error",
            ))
            continue
        verdicts.append(parse_verdict(raw, sig.symbol))
    return verdicts
