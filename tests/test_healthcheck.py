"""Healthcheck (STEP 18): session window × file state matrix."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import pytest

from kis_ict_trader import config as cfg
from kis_ict_trader.deploy import healthcheck as HC


@pytest.fixture
def session_times():
    return {
        "in_session": datetime(2026, 4, 22, 10, 30),     # Wed 10:30
        "out_session": datetime(2026, 4, 22, 22, 0),     # Wed 22:00
        "weekend": datetime(2026, 4, 25, 10, 30),        # Sat
    }


class TestWithinSession:
    def test_weekday_in_hours(self, session_times):
        assert HC._within_session(session_times["in_session"])

    def test_weekday_out_of_hours(self, session_times):
        assert not HC._within_session(session_times["out_session"])

    def test_weekend(self, session_times):
        assert not HC._within_session(session_times["weekend"])

    def test_boundaries(self):
        assert HC._within_session(datetime(2026, 4, 22, 9, 0))
        assert not HC._within_session(datetime(2026, 4, 22, 8, 59))
        assert HC._within_session(datetime(2026, 4, 22, 15, 30))
        assert not HC._within_session(datetime(2026, 4, 22, 15, 31))


def _write_state(path, last_run_at):
    path.write_text(json.dumps({"last_run_at": last_run_at.isoformat()}))


class TestCheckMatrix:
    def test_missing_file_during_session_fails(self, session_times):
        # PATH_LOOP_STATE is in tmp_path via the autouse fixture; don't create it.
        rc, msg = HC.check(session_times["in_session"])
        assert rc == 1

    def test_missing_file_outside_ok(self, session_times):
        rc, _ = HC.check(session_times["out_session"])
        assert rc == 0

    def test_fresh_during_session(self, session_times):
        _write_state(
            cfg.PATH_LOOP_STATE,
            session_times["in_session"] - timedelta(seconds=30),
        )
        rc, msg = HC.check(session_times["in_session"])
        assert rc == 0 and "fresh" in msg

    def test_stale_during_session_fails(self, session_times):
        _write_state(
            cfg.PATH_LOOP_STATE,
            session_times["in_session"] - timedelta(seconds=600),
        )
        rc, msg = HC.check(session_times["in_session"])
        assert rc == 1 and "stale" in msg

    def test_stale_outside_session_ok(self, session_times):
        _write_state(
            cfg.PATH_LOOP_STATE,
            session_times["out_session"] - timedelta(hours=6),
        )
        rc, _ = HC.check(session_times["out_session"])
        assert rc == 0

    def test_stale_weekend_ok(self, session_times):
        _write_state(
            cfg.PATH_LOOP_STATE,
            session_times["weekend"] - timedelta(hours=20),
        )
        rc, _ = HC.check(session_times["weekend"])
        assert rc == 0

    def test_bad_timestamp_treated_as_missing(self, session_times):
        cfg.PATH_LOOP_STATE.write_text(json.dumps({"last_run_at": "garbage"}))
        rc, _ = HC.check(session_times["in_session"])
        assert rc == 1

    def test_corrupt_json_treated_as_missing(self, session_times):
        cfg.PATH_LOOP_STATE.write_text("not json at all")
        rc, _ = HC.check(session_times["in_session"])
        assert rc == 1
