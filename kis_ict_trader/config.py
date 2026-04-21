"""Central config for kis_ict_trader.

All tunable parameters live here — no hard-coded values elsewhere.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Paths & env loading
# ---------------------------------------------------------------------------
ROOT: Path = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env", override=False)

DIR_STATE = ROOT / "state"
DIR_LOGS = ROOT / "logs"
DIR_BACKTEST_RESULTS = ROOT / "backtest_results"
DIR_DATA_CACHE = ROOT / "data" / "cache"

PATH_TOKEN_CACHE = DIR_STATE / "token_cache.json"
PATH_LOOP_STATE = DIR_STATE / "loop_state.json"
PATH_DAILY_UNIVERSE = DIR_STATE / "daily_universe.json"
PATH_ENV_FILE = ROOT / ".env"

for _d in (DIR_STATE, DIR_LOGS, DIR_BACKTEST_RESULTS, DIR_DATA_CACHE):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Runtime flags
# ---------------------------------------------------------------------------
# True  : session / pre-market auction / econ-calendar locks are ignored.
#         Real orders are still dispatched (design: flat-after-fill testing).
# False : full production scheduling.
TEST_MODE: bool = True

# Korean retail shorting is restricted → keep False. Bearish signals are logged
# but never routed to order submission.
ALLOW_SHORT: bool = False

# ---------------------------------------------------------------------------
# KIS OpenAPI credentials & environment
# ---------------------------------------------------------------------------
KIS_APP_KEY: str = os.getenv("KIS_APP_KEY", "")
KIS_APP_SECRET: str = os.getenv("KIS_APP_SECRET", "")
KIS_ACCOUNT_NO: str = os.getenv("KIS_ACCOUNT_NO", "")
KIS_ACCOUNT_PRODUCT_CODE: str = os.getenv("KIS_ACCOUNT_PRODUCT_CODE", "01")

# "real" (실전) | "vps" (모의투자)
KIS_ENV: str = os.getenv("KIS_ENV", "vps").strip().lower()

KIS_BASE_URL_REAL: str = os.getenv(
    "KIS_BASE_URL_REAL", "https://openapi.koreainvestment.com:9443"
)
KIS_BASE_URL_VPS: str = os.getenv(
    "KIS_BASE_URL_VPS", "https://openapivts.koreainvestment.com:29443"
)


def is_real() -> bool:
    return KIS_ENV == "real"


def kis_base_url() -> str:
    return KIS_BASE_URL_REAL if is_real() else KIS_BASE_URL_VPS


# ---------------------------------------------------------------------------
# TR_ID routing (real / paper)
# ---------------------------------------------------------------------------
# Each key maps to {"real": <TR_ID>, "vps": <TR_ID>}.
# Cross-check against KIS official docs before use — on mismatch, halt and
# report rather than guessing.
TR_IDS: dict[str, dict[str, str]] = {
    # Orders (POST, require hashkey header)
    "order_cash_buy":  {"real": "TTTC0802U", "vps": "VTTC0802U"},
    "order_cash_sell": {"real": "TTTC0801U", "vps": "VTTC0801U"},
    "order_modify":    {"real": "TTTC0803U", "vps": "VTTC0803U"},

    # Market data (GET, same TR_ID on both envs)
    "price_current": {"real": "FHKST01010100", "vps": "FHKST01010100"},
    "chart_daily":   {"real": "FHKST03010100", "vps": "FHKST03010100"},
    "chart_minute":  {"real": "FHKST03010200", "vps": "FHKST03010200"},

    # Account
    "balance": {"real": "TTTC8434R", "vps": "VTTC8434R"},
    "ccld":    {"real": "TTTC8001R", "vps": "VTTC8001R"},
}


def tr_id(key: str) -> str:
    env_key = "real" if is_real() else "vps"
    return TR_IDS[key][env_key]


# ---------------------------------------------------------------------------
# Rate limits (client-side throttling)
# ---------------------------------------------------------------------------
KIS_REQ_PER_SEC_REAL: int = 20
KIS_REQ_PER_SEC_VPS: int = 2
KIS_TOKEN_REISSUE_COOLDOWN_SEC: int = 60  # /oauth2/tokenP : 1분 1회
KIS_TOKEN_REFRESH_BEFORE_SEC: int = 3600  # 만료 1시간 전 선제 갱신


def kis_req_per_sec() -> int:
    return KIS_REQ_PER_SEC_REAL if is_real() else KIS_REQ_PER_SEC_VPS


# ---------------------------------------------------------------------------
# Session schedule (KST, 24h)
# ---------------------------------------------------------------------------
SESSION_OPEN: str = "09:00"
SESSION_CLOSE: str = "15:30"
ENTRY_CUTOFF: str = "15:20"
QUANT_SCREEN_TIME: str = "08:00"
LOOP_INTERVAL_SEC: int = 60
TIMEZONE: str = "Asia/Seoul"

# ---------------------------------------------------------------------------
# Universe selection
# ---------------------------------------------------------------------------
UNIVERSE_TOP_N: int = 20
HARD_FILTER: dict[str, object] = {
    "min_market_cap_krw":         500_000_000_000,   # 5,000억
    "min_avg_volume_20d_shares":  500_000,           # 50만주
    "exclude_listed_months_below": 6,
    "exclude_etf_etn":             True,
    "exclude_admin_halt":          True,
}

FACTOR_WEIGHTS: dict[str, float] = {
    "momentum":    0.25,   # 3M/6M/12M 수익률 종합, 1M 음수면 페널티
    "value":       0.20,   # 섹터 내 PER/PBR/PSR 역순위, 적자 0점
    "quality":     0.20,   # ROE/영업이익률/부채비율(역순위)
    "volume":      0.15,   # 20d vs 60d 거래대금 비율
    "vol_adj_ret": 0.10,   # 60d 수익률 / 표준편차
    "growth":      0.10,   # 매출/영업이익 YoY
}

QUANT_MOMENTUM_LOOKBACKS_MONTHS: tuple[int, ...] = (3, 6, 12)
QUANT_MOMENTUM_RECENT_PENALTY_MONTHS: int = 1
QUANT_VOLUME_WINDOW_SHORT: int = 20
QUANT_VOLUME_WINDOW_LONG: int = 60
QUANT_VOL_ADJ_RET_WINDOW: int = 60

# ---------------------------------------------------------------------------
# ICT algorithm parameters
# ---------------------------------------------------------------------------
ICT: dict[str, object] = {
    # Timeframes
    "htf_tf": "D",
    "mtf_tf": "240",  # 4h
    "ltf_tf": "15",

    # Swing detection
    "swing_lookback": 3,                 # 좌우 N봉 스윙

    # Fair Value Gap
    "fvg_ce_tolerance_ticks": 2,         # CE ± 허용오차 (틱 단위)
    "fvg_fill_ratio": 0.50,              # 50% 이상 채워지면 Fill 인정

    # Order Block
    "ob_lookback_bars": 50,              # 탐지 구간
    "ob_mitigation_touch": True,         # 1 touch = mitigated

    # Liquidity sweep
    "sweep_wick_min_ratio": 0.3,         # 스윕 인정 위크 비율 최소
    "sweep_lookback_bars": 20,

    # Session (KST)
    "session_windows": {
        "asia":   ("09:00", "11:30"),
        "lunch":  ("11:30", "13:00"),
        "pm":     ("13:00", "15:30"),
    },

    # Risk / Reward
    "rr_min_default":   2.0,
    "rr_min_with_poi":  1.5,
    "rr_min_strong":    3.0,

    # Stop-loss fallback when no valid POI-based SL is found
    "sl_pct_fallback": 0.015,            # 1.5%

    # Signal lifecycle
    "signal_cooldown_min": 30,
    "wait_streak_block":   3,
}

# ---------------------------------------------------------------------------
# Position sizing
# ---------------------------------------------------------------------------
SIZING: dict[str, object] = {
    "win_rate":             0.55,        # 켈리 고정 승률
    "half_kelly":           True,
    "max_position_pct":     0.20,        # 켈리 산출 상한
    "min_position_pct":     0.01,        # 켈리 산출 하한 (음수면 skip)
    "max_single_exposure":  0.10,        # 단일 종목 최대 노출 (자산 대비)
    "max_total_exposure":   0.50,        # 전체 노출 한도
}

# ---------------------------------------------------------------------------
# KRX tick-size table (applied to every order-bound price)
# 2023-01 개정: KOSPI/KOSDAQ 공통
#   (upper_exclusive_price, tick)
# ---------------------------------------------------------------------------
TICK_TABLE_KRX: list[tuple[float, int]] = [
    (2_000,        1),
    (5_000,        5),
    (20_000,       10),
    (50_000,       50),
    (200_000,      100),
    (500_000,      500),
    (float("inf"), 1_000),
]

# ---------------------------------------------------------------------------
# LLM — Claude Max CLI (no API key)
# ---------------------------------------------------------------------------
LLM: dict[str, object] = {
    "cli_binary":         "claude",
    "model":              "claude-opus-4-6",
    "timeout_sec":        90,
    "top_n_candidates":   3,             # ICT 통과 중 R:R 상위 N만 LLM 검토
    "chart_htf_filename": "daily.png",
    "chart_ltf_filename": "15m.png",
}

# ---------------------------------------------------------------------------
# News / Economic calendar
# ---------------------------------------------------------------------------
NAVER_CLIENT_ID: str = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET: str = os.getenv("NAVER_CLIENT_SECRET", "")
NEWS_TOP_N: int = 5
ECON_CALENDAR_HIGH_IMPACT_ONLY: bool = True

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate() -> None:
    """Call from entrypoint after interactive .env prompting (if any)."""
    if KIS_ENV not in ("real", "vps"):
        raise ValueError(f"KIS_ENV must be 'real' or 'vps', got {KIS_ENV!r}")

    missing = [
        name for name, val in (
            ("KIS_APP_KEY", KIS_APP_KEY),
            ("KIS_APP_SECRET", KIS_APP_SECRET),
            ("KIS_ACCOUNT_NO", KIS_ACCOUNT_NO),
            ("KIS_ACCOUNT_PRODUCT_CODE", KIS_ACCOUNT_PRODUCT_CODE),
        ) if not val
    ]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")

    weight_sum = sum(FACTOR_WEIGHTS.values())
    if abs(weight_sum - 1.0) > 1e-9:
        raise ValueError(f"FACTOR_WEIGHTS must sum to 1.0, got {weight_sum}")

    if not (0 < float(ICT["fvg_fill_ratio"]) <= 1.0):
        raise ValueError("ICT.fvg_fill_ratio must be in (0, 1]")

    if SIZING["min_position_pct"] >= SIZING["max_position_pct"]:
        raise ValueError("SIZING.min_position_pct must be < max_position_pct")

    if SIZING["max_single_exposure"] > SIZING["max_total_exposure"]:
        raise ValueError(
            "SIZING.max_single_exposure must be <= max_total_exposure"
        )
