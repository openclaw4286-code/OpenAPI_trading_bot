"""Container / service healthcheck.

Exit 0 when the scheduler has ticked recently enough for the current
time window, exit 1 otherwise. "Recently enough" is relaxed outside
trading hours so an idle overnight container isn't reported unhealthy.

Designed to be run as `python -m kis_ict_trader.deploy.healthcheck`
from a Docker HEALTHCHECK or systemd Watchdog.

Rules:
  During SESSION_OPEN..SESSION_CLOSE (KST):
    last_run_at within STALE_THRESHOLD_MIN  → OK (exit 0)
    otherwise                                → FAIL (exit 1)
    no loop_state.json yet                   → FAIL (exit 1)

  Outside session hours (incl. weekends):
    always OK (exit 0) — the scheduler legitimately idles; we just
    verify the file is readable when it exists.
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime, time as dtime, timedelta

from .. import config as cfg


STALE_THRESHOLD_MIN: int = 5


def _parse_hhmm(s: str) -> dtime:
    h, m = s.split(":")
    return dtime(int(h), int(m))


def _within_session(now: datetime | None = None) -> bool:
    n = now or datetime.now()
    # Weekends: KRX closed
    if n.weekday() >= 5:
        return False
    return _parse_hhmm(cfg.SESSION_OPEN) <= n.time() <= _parse_hhmm(cfg.SESSION_CLOSE)


def _read_last_run_at() -> datetime | None:
    p = cfg.PATH_LOOP_STATE
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text("utf-8"))
    except Exception as e:
        print(f"unreadable {p}: {e}", file=sys.stderr)
        return None
    ts = data.get("last_run_at")
    if not ts:
        return None
    try:
        return datetime.fromisoformat(str(ts))
    except ValueError as e:
        print(f"bad last_run_at {ts!r}: {e}", file=sys.stderr)
        return None


def check(now: datetime | None = None) -> tuple[int, str]:
    """Return (exit_code, message). Extracted for testability."""
    current = now or datetime.now()
    in_session = _within_session(current)
    last = _read_last_run_at()

    if last is None:
        if in_session:
            return 1, "no loop_state / last_run_at during session"
        return 0, "idle (outside session, no state yet)"

    age = current - last
    threshold = timedelta(minutes=STALE_THRESHOLD_MIN)

    if age <= threshold:
        return 0, f"fresh (age={age.total_seconds():.0f}s)"

    if in_session:
        return 1, f"stale during session (age={age.total_seconds():.0f}s)"
    return 0, f"stale outside session (age={age.total_seconds():.0f}s) ok"


def main() -> int:
    code, msg = check()
    (sys.stdout if code == 0 else sys.stderr).write(msg + "\n")
    return code


if __name__ == "__main__":
    sys.exit(main())
