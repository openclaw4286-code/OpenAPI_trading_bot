"""LLM gate (STEP 8): ranking, prompt, verdict parsing, evaluate_candidates."""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from kis_ict_trader.llm import gate as G


class TestRankCandidates:
    def test_top_n_by_rr(self, make_signal):
        sigs = [make_signal(symbol=f"S{i}", rr=1.5 + i * 0.3) for i in range(5)]
        top = G.rank_candidates(sigs)
        assert [s.symbol for s in top] == ["S4", "S3", "S2"]

    def test_top_n_override(self, make_signal):
        sigs = [make_signal(symbol=f"S{i}", rr=1.5 + i * 0.3) for i in range(5)]
        assert len(G.rank_candidates(sigs, n=1)) == 1

    def test_n_zero_returns_empty(self, make_signal):
        sigs = [make_signal(symbol=f"S{i}", rr=1.5 + i * 0.3) for i in range(3)]
        assert G.rank_candidates(sigs, n=0) == []


class TestBuildPrompt:
    def test_contains_all_fields(self, make_signal):
        sig = make_signal(symbol="005930")
        prompt = G.build_prompt(sig, context={"earnings": "2026-05-01"})
        assert "005930" in prompt
        assert "rr (to TP2)   : 2.00" in prompt
        assert "earnings" in prompt

    def test_empty_context_uses_placeholder(self, make_signal):
        assert "(none)" in G.build_prompt(make_signal())

    def test_missing_charts_placeholder(self, make_signal):
        assert "(not attached)" in G.build_prompt(make_signal())


class TestParseVerdict:
    def test_plain_json(self):
        v = G.parse_verdict(
            '{"approved": true, "confidence": 0.72, "rationale": "clean"}',
            "X",
        )
        assert v.approved and abs(v.confidence - 0.72) < 1e-6
        assert v.rationale == "clean" and v.error is None

    def test_fenced_json(self):
        raw = (
            'Verdict:\n```json\n'
            '{"approved": false, "confidence": 0.3, "rationale": "news"}\n'
            '```\n'
        )
        v = G.parse_verdict(raw, "Y")
        assert not v.approved and v.rationale == "news"

    def test_garbage_is_parse_error(self):
        v = G.parse_verdict("no json at all", "Z")
        assert v.error == "parse_error" and not v.approved

    def test_confidence_clamped_above_one(self):
        v = G.parse_verdict(
            '{"approved": true, "confidence": 5, "rationale": ""}', "W",
        )
        assert v.confidence == 1.0

    def test_confidence_clamped_below_zero(self):
        v = G.parse_verdict(
            '{"approved": true, "confidence": -0.5, "rationale": ""}', "W",
        )
        assert v.confidence == 0.0


@pytest.mark.asyncio
async def test_evaluate_candidates_mixed_outcomes(make_signal):
    sigs = [make_signal(symbol=f"S{i}", rr=1.5 + i * 0.3) for i in range(5)]

    def stub(prompt):
        sym = prompt.split("symbol        :")[1].split()[0]
        if sym == "S4":
            return '{"approved": true, "confidence": 0.8, "rationale": "go"}'
        if sym == "S3":
            return '{"approved": false, "confidence": 0.4, "rationale": "skip"}'
        raise subprocess.TimeoutExpired(cmd="claude", timeout=90)

    verdicts = G.evaluate_candidates(sigs, cli_runner=stub)
    assert len(verdicts) == 3
    assert verdicts[0].symbol == "S4" and verdicts[0].approved
    assert verdicts[1].symbol == "S3" and not verdicts[1].approved
    assert verdicts[2].symbol == "S2" and verdicts[2].error == "timeout"


def test_evaluate_candidates_runtime_error(make_signal):
    def broken(prompt):
        raise RuntimeError("boom")
    verdicts = G.evaluate_candidates([make_signal()], cli_runner=broken)
    assert verdicts[0].error == "cli_error" and not verdicts[0].approved


def test_chart_file_filter(tmp_path, make_signal):
    (tmp_path / "daily.png").write_bytes(b"x")  # only daily present
    seen = []

    def cap(prompt):
        seen.append(prompt)
        return '{"approved": true, "confidence": 0.5, "rationale": "ok"}'

    G.evaluate_candidates(
        [make_signal(symbol="005930")],
        chart_dir_by_symbol={"005930": tmp_path},
        cli_runner=cap,
    )
    assert "daily.png" in seen[0]
    assert "15m.png" not in seen[0]
