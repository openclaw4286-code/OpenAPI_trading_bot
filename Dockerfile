# syntax=docker/dockerfile:1.6
#
# KIS ICT Trader production image.
#
# Build:   docker build -t kis-ict-trader .
# Run:     docker run --rm --env-file .env kis-ict-trader
# One-shot: docker run --rm --env-file .env kis-ict-trader --once --dry-run
#
# State (positions.json / loop_state.json / token_cache.json) and logs
# live under /home/app/kis_ict_trader/{state,logs}. Mount volumes there
# to survive restarts.

# --- builder stage ---------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /build
COPY kis_ict_trader/requirements.txt .

# Build wheels under --user so the final stage can copy them in whole.
RUN pip install --user -r requirements.txt


# --- runtime stage ---------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/home/app/.local/bin:$PATH \
    TZ=Asia/Seoul

# Fonts: matplotlib needs a default face for chart rendering;
# fonts-nanum gives us Korean glyphs for Hangul ticker names.
# tzdata so the scheduler honours cfg.TIMEZONE correctly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata fonts-nanum \
 && rm -rf /var/lib/apt/lists/* \
 && ln -sf /usr/share/zoneinfo/${TZ} /etc/localtime \
 && echo ${TZ} > /etc/timezone

RUN useradd --create-home --shell /bin/bash --uid 1000 app

USER app
WORKDIR /home/app

# Bring the /root/.local pip tree from the builder to the app user home.
COPY --from=builder --chown=app:app /root/.local /home/app/.local

# App code
COPY --chown=app:app kis_ict_trader ./kis_ict_trader

# Writable paths → mount these as volumes in production.
VOLUME ["/home/app/kis_ict_trader/state", \
        "/home/app/kis_ict_trader/logs", \
        "/home/app/kis_ict_trader/data/cache"]

# Docker-level healthcheck — same script the systemd watchdog uses.
HEALTHCHECK --interval=5m --timeout=10s --start-period=2m --retries=2 \
  CMD python -m kis_ict_trader.deploy.healthcheck || exit 1

# The module exposes an argparse CLI; pass flags after `docker run ... image`
# e.g.  docker run ... kis-ict-trader --once --dry-run
ENTRYPOINT ["python", "-m", "kis_ict_trader"]
CMD []
