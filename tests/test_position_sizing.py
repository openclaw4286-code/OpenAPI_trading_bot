"""Sizing (STEP 7): Kelly + exposure caps + lot rounding."""
from __future__ import annotations

import pytest

from kis_ict_trader import config as cfg
from kis_ict_trader.algorithm.position_sizing import (
    compute_size,
    kelly_fraction,
)


class TestKelly:
    def test_valid(self):
        assert abs(kelly_fraction(0.55, 2.0) - 0.325) < 1e-9

    def test_zero_rr(self):
        assert kelly_fraction(0.55, 0.0) == 0.0

    def test_boundary_win_rate(self):
        assert kelly_fraction(1.0, 2.0) == 0.0
        assert kelly_fraction(0.0, 2.0) == 0.0

    def test_negative_returned_as_is(self):
        # Raw formula can return negative; compute_size then rejects it
        assert kelly_fraction(0.3, 1.0) < 0.0


class TestComputeSize:
    def test_happy_path_bound_by_single_exposure(self, make_signal):
        sig = make_signal()  # rr=2.0
        r = compute_size(sig, equity=100_000_000)
        assert r.reason == "ok"
        assert "max_single_exposure" in r.clipped_by
        assert abs(r.kelly_adj - 0.10) < 1e-9
        assert r.shares == 100_000

    def test_existing_symbol_exposure_reduces_size(self, make_signal):
        r = compute_size(make_signal(), equity=100_000_000,
                         current_symbol_exposure=0.08)
        assert abs(r.kelly_adj - 0.02) < 1e-9 and r.shares == 20_000

    def test_total_exposure_cap(self, make_signal):
        r = compute_size(make_signal(), equity=100_000_000,
                         current_total_exposure=0.48)
        assert "max_total_exposure" in r.clipped_by
        assert abs(r.kelly_adj - 0.02) < 1e-9

    def test_kelly_nonpositive_skips(self, make_signal):
        r = compute_size(make_signal(rr=0.5), equity=100_000_000)
        assert r.reason == "kelly_nonpositive" and r.shares == 0

    def test_invalid_inputs(self, make_signal):
        assert compute_size(make_signal(), equity=0).reason == "invalid_inputs"
        assert compute_size(make_signal(entry=0.0),
                            equity=1_000_000).reason == "invalid_inputs"

    def test_lot_size_rounds_down(self, make_signal):
        r = compute_size(make_signal(), equity=1_500_000, lot_size=1000)
        assert r.shares == 1000

    def test_below_min_lot(self, make_signal):
        r = compute_size(make_signal(entry=1_000_000.0), equity=50_000)
        assert r.reason == "below_min_lot" and r.shares == 0

    def test_below_min_pct_skips(self, monkeypatch, make_signal):
        monkeypatch.setitem(cfg.SIZING, "min_position_pct", 0.05)
        monkeypatch.setitem(cfg.SIZING, "win_rate", 0.51)
        r = compute_size(make_signal(rr=1.01), equity=100_000_000)
        assert r.reason == "kelly_below_min"

    def test_max_position_pct_caps(self, monkeypatch, make_signal):
        monkeypatch.setitem(cfg.SIZING, "max_position_pct", 0.05)
        r = compute_size(make_signal(), equity=100_000_000)
        assert "max_position_pct" in r.clipped_by
        assert abs(r.kelly_adj - 0.05) < 1e-9
