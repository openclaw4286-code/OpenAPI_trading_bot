# kis_ict_trader

ICT-style intraday trader for Korean equities, built on the KIS
OpenAPI. Signal generation, risk / sizing, LLM-gated approval,
order lifecycle, observability, and backtesting all live in one
package.

*Status: dry-run ready. 213 tests / ruff clean / mypy clean.*

---

## What it does

1. **Daily universe screen** — ranks candidate tickers by a weighted
   factor blend (momentum / value / quality / volume / vol-adjusted
   return / growth) and persists the top-N.
2. **Multi-timeframe ICT** — weekly / daily / 15-minute confluence:
   swings, BOS / CHoCH, Fair Value Gaps, Order Blocks, liquidity
   sweeps. Entry requires HTF+MTF trend alignment plus an LTF
   trigger inside a POI.
3. **Strategy + sizing** — emits a `TradeSignal` with entry / stop /
   three R-multiple targets, then runs half-Kelly sizing against
   single / total exposure caps.
4. **LLM gate** — the top-R:R candidates go to the local Claude CLI
   with news / fundamentals / recent-trade context and price charts;
   anything the model can't approve with valid JSON is rejected.
5. **Execution** — limit-order entry, cancel-replace on stale fills,
   tranched exits (TP1 + BE, TP2 + structure trail, TP3 flatten,
   stop-out on a single bar). Every step is audited and logged.
6. **Observability** — atomic JSON state for loop / positions /
   signal quality; Slack or Discord webhook notifier; static HTML
   dashboard; container healthcheck.

---

## Install

```bash
git clone <your-fork>
cd OpenAPI_trading_bot
python -m venv venv && source venv/bin/activate
pip install -r kis_ict_trader/requirements.txt
pip install -r requirements-dev.txt   # pytest / ruff / mypy
```

`.env` at the repo root (never commit):

```ini
# Required — KIS OpenAPI credentials
KIS_APP_KEY=...
KIS_APP_SECRET=...
KIS_ACCOUNT_NO=12345678
KIS_ACCOUNT_PRODUCT_CODE=01
KIS_ENV=vps                   # vps (모의투자) | real (실전)

# Optional — news + fundamentals + alerts
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
DART_API_KEY=...
KIS_NOTIFY_WEBHOOK_URL=https://hooks.slack.com/services/...
KIS_NOTIFY_PROVIDER=slack     # slack | discord

# Optional — opt-in features
KIS_MTF_MODE=daily            # daily (legacy W/D/15m) | h4 (true D/4h/15m)
KIS_MTF_H4_DAYS_BACK=20
KIS_QUALITY_FILTER=0          # 1 = prune underperforming symbols
```

Drop a `data/cache/krx_tickers.csv` with columns `ticker, name,
market, is_etf_etn` so `build_daily_universe` has something to screen.

---

## CLI

```bash
python -m kis_ict_trader                   # scheduler daemon (mon-fri, KST)
python -m kis_ict_trader --once            # one run_once pass, exit
python -m kis_ict_trader --once --dry-run  # dry-run override
python -m kis_ict_trader --once --live     # live override (bypass cfg.TEST_MODE)
python -m kis_ict_trader --build-universe  # screen + persist top-N
python -m kis_ict_trader --list-universe   # print daily_universe.json summary
python -m kis_ict_trader --dashboard       # write logs/dashboard.html
python -m kis_ict_trader --dashboard /tmp/dash.html
python -m kis_ict_trader --smoke           # read-only connectivity check
python -m kis_ict_trader --smoke --smoke-ticker 000660
python -m kis_ict_trader --smoke --smoke-dart
```

`--dry-run` and `--live` are mutually exclusive and override
`cfg.TEST_MODE` for the run. Scheduler mode uses APScheduler with
cron (daily universe build at 08:00 KST) + an interval trigger
(every 60s during session).

---

## Deploy

**Docker**

```bash
docker compose up -d                          # scheduler
docker compose run --rm trader --once         # one-shot
docker compose run --rm trader --smoke        # connectivity
```

Volumes bind `./var/state` / `./var/logs` / `./var/cache` so
`positions.json`, `loop_state.json`, `signal_quality.json`, the
KIS token cache, and minute-parquet caches survive rebuilds.

**systemd**

```bash
sudo cp deploy/kis-ict-trader.service /etc/systemd/system/
sudo install -m 600 .env /etc/kis-ict-trader/.env
sudo useradd -r -s /usr/sbin/nologin -d /opt/kis-ict-trader trader
sudo chown -R trader:trader /opt/kis-ict-trader
sudo systemctl daemon-reload
sudo systemctl enable --now kis-ict-trader.service
journalctl -u kis-ict-trader -f
```

**Healthcheck** (for both paths):

```bash
python -m kis_ict_trader.deploy.healthcheck
# exit 0 = last run within 5 min or outside session hours
# exit 1 = stale during session / missing loop_state
```

---

## Go-live checklist

1. `.env` filled with real KIS credentials; `KIS_ENV=vps` initially.
2. `data/cache/krx_tickers.csv` staged.
3. `python -m kis_ict_trader --build-universe` — creates
   `state/daily_universe.json`.
4. `python -m kis_ict_trader --smoke` — all 7 checks ✓.
5. `python -m kis_ict_trader --once --dry-run` — full pipeline
   runs, `state/loop_state.json` populated, no orders sent.
6. Flip `KIS_ENV=real` only after vps scheduler runs cleanly for
   several sessions.
7. `python -m kis_ict_trader --smoke` again (different TR IDs on
   real vs. vps) before the first live run.

---

## Architecture

```
kis_ict_trader/
├── config.py                 # all tunables; cfg.validate() at startup
├── __main__.py               # argparse CLI + APScheduler daemon
├── loop.py                   # run_once: the full pipeline in one async pass
│
├── data/
│   ├── fetcher.py            # KIS price / daily / minute / historical-minute
│   ├── fundamentals.py       # DART + CSV fallback
│   ├── news.py               # Naver news search
│   ├── quant_screener.py     # factor-weighted ranking
│   └── universe.py           # build + persist daily top-N
│
├── signals/
│   └── ictsignals.py         # swings, BOS/CHoCH, FVG, OB, sweeps,
│                             # evaluate_mtf_entry(HTF, MTF, LTF)
│
├── algorithm/
│   ├── ict_strategy.py       # MtfConfluence → TradeSignal + SignalGate
│   ├── position_sizing.py    # half-Kelly + exposure caps
│   ├── position_manager.py   # bar-driven TP1/TP2/TP3 + trail + stop-out
│   └── signal_quality.py     # per-symbol R / MFE / MAE + universe filter
│
├── llm/
│   ├── gate.py               # Claude CLI approve/reject, strict JSON parse
│   └── context.py            # news + fundamentals + trade history injector
│
├── chart/
│   └── renderer.py           # candle + ICT overlays → PNG for the LLM
│
├── execution/
│   ├── kis_client.py         # OAuth + hashkey + rate-limited GET/POST
│   ├── orders.py             # place / cancel / balance / reconcile
│   └── order_lifecycle.py    # inquire-daily-ccld + revise + retry
│
├── observability/
│   ├── state.py              # loop_state / positions / quality persistence
│   ├── notify.py             # Slack / Discord webhook (swallows errors)
│   ├── report.py             # daily P&L aggregator + markdown
│   └── dashboard.py          # self-contained HTML report
│
├── backtest/
│   └── runner.py             # backtest_symbol (single) + backtest_portfolio
│                             # (shared equity, exposure caps, LLM hook,
│                             #  split exits, per-symbol quality)
│
└── deploy/
    ├── healthcheck.py        # container / systemd watchdog
    └── smoke_test.py         # read-only KIS GET checklist
```

Supporting files at repo root:

```
Dockerfile / docker-compose.yml   # deployable container
deploy/kis-ict-trader.service     # systemd unit (hardened)
.github/workflows/ci.yml          # ruff + mypy, then pytest matrix
pyproject.toml / pytest.ini       # lint / type / test config
kis_ict_trader/state/*.json       # runtime state (gitignored)
kis_ict_trader/logs/              # rotating logs
kis_ict_trader/data/cache/        # KRX tickers + minute parquet cache
```

---

## Design invariants

- **ALLOW_SHORT=False by default** — Korean retail shorting is
  restricted; bear signals are logged but never routed to orders.
- **TEST_MODE=True by default** — dry-run unless `--live` or an
  explicit config flip. Safe to `git pull` without fear.
- **LLM reject on parse error** — if the Claude CLI response can't
  be parsed into a strict JSON verdict, the candidate is rejected
  with an `error` tag. No guessing.
- **Atomic state writes** — every `*.json` under `state/` is
  written via `tmp + rename`, so a crash mid-write can't corrupt.
- **Never-loosen stop** — `manage_position` ratchets the stop only
  in the direction that tightens it, across both BE moves and
  structure trails.
- **Observability never breaks trading** — webhook / dashboard /
  persistence failures are logged and swallowed; the loop
  continues.
- **Scheduler coalesces slow ticks** — APScheduler `max_instances=1
  + coalesce=True`, so a 90-second LLM call doesn't stack up three
  more ticks waiting behind it.

---

## Backtesting

```python
from kis_ict_trader.backtest.runner import (
    backtest_portfolio, backtest_symbol,
)

# Single symbol, legacy single-exit path
rep = backtest_symbol("005930", daily_df, warmup_bars=60)
print(rep.summary())

# Portfolio: shared equity + exposure caps + split exits + LLM sim
rep = backtest_portfolio(
    {"005930": samsung_df, "000660": hynix_df, "035420": naver_df},
    start_equity=100_000_000,
    split_exits=True,
    llm_approve=lambda sig, ltf: sig.rr >= 1.8,
)
print(rep.summary())
# {'n_trades': 42, 'win_rate': 0.55, 'avg_r': +0.38,
#  'max_drawdown': -0.08, 'total_return': +0.12,
#  'llm_rejected': 15, 'skipped_no_room': 7}
```

---

## Development

```bash
pytest -q                                       # 213 tests
ruff check .                                    # style + imports
mypy kis_ict_trader                             # baseline types
python -m kis_ict_trader --smoke                # live connectivity
```

CI runs ruff + mypy first, then pytest on Python 3.11 and 3.12.

---

## License / disclaimer

This is strategy research code. It places real orders against a real
brokerage when `KIS_ENV=real` and `TEST_MODE=False`. You are the
sole operator of every resulting trade — test extensively on `vps`
(모의투자) before going live, and never deploy without reading the
go-live checklist above.
