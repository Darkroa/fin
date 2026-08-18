import os
import asyncio
from pathlib import Path
from collections import deque
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
import httpx
from loguru import logger

# ── In-memory circular log buffer (last 500 lines) ──────────────────────────
LOG_BUFFER: deque = deque(maxlen=500)


def _log_sink(message: str) -> None:
    LOG_BUFFER.append(message.rstrip())


import re as _re

# Patterns to redact from any log message — API keys would otherwise leak into
# access logs / log-aggregator dashboards that capture full URLs.
_SECRET_PATTERNS = [
    _re.compile(r"(apiKey|apikey|api_key)=[^&\s\"']+", _re.IGNORECASE),
    _re.compile(r"(token|access_token)=[^&\s\"']+", _re.IGNORECASE),
    _re.compile(r"(password|passwd|pwd)=[^&\s\"']+", _re.IGNORECASE),
]


def _redact_secrets(message):
    """loguru filter: strip known secrets from log records."""
    try:
        record = message.record
        msg = record["message"]
        for pat in _SECRET_PATTERNS:
            msg = pat.sub(lambda m: f"{m.group(1)}=REDACTED", msg)
        record["message"] = msg
    except Exception:
        pass


logger.add(
    _log_sink,
    format="{time:HH:mm:ss} | {level:<8} | {message}",
    level="DEBUG",
    colorize=False,
    filter=_redact_secrets,
)
# ────────────────────────────────────────────────────────────────────────────

from src.api.routes import router
from src.api.middleware import APIRateLimitMiddleware
from src.database.models import Base
from src.database.session import engine

UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="FinAi API",
    version="1.0.0",
    description="AI-Powered Financial News Ingestion & Automated Trading Platform",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ===================== Middleware =====================
_cors_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
if _cors_origins_env:
    _cors_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
else:
    _cors_origins = ["http://localhost:5000", "http://localhost:3000", "http://127.0.0.1:5000", "http://127.0.0.1:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(APIRateLimitMiddleware)

# ===================== Prometheus Metrics =====================
try:
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=False,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics", "/docs", "/redoc", "/openapi.json"],
        inprogress_name="finai_inprogress",
        inprogress_labels=True,
    ).instrument(app).expose(
        app, endpoint="/metrics", include_in_schema=True, tags=["monitoring"]
    )
    logger.info("Prometheus metrics exposed at /metrics")
except Exception as _prom_err:
    logger.warning(f"Prometheus instrumentation skipped: {_prom_err}")


# Include API routes
app.include_router(router, prefix="/api")


# ===================== Monitoring Proxies =====================
@app.api_route("/prom/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def proxy_prometheus(path: str, request: Request):
    from src.utils.config import config

    base = config.PROMETHEUS_URL.rstrip("/")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=f"{base}/prom/{path}",
                params=request.query_params,
                content=await request.body(),
                headers={
                    k: v
                    for k, v in request.headers.items()
                    if k.lower() not in ("host", "content-length", "transfer-encoding")
                },
                follow_redirects=True,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "text/plain"),
            )
        except Exception:
            return Response(
                content=b"<h2>Prometheus is starting up...</h2>",
                status_code=503,
                media_type="text/html",
            )


@app.api_route("/graf/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def proxy_grafana(path: str, request: Request):
    from src.utils.config import config

    base = config.GRAFANA_URL.rstrip("/")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=f"{base}/{path}",
                params=request.query_params,
                content=await request.body(),
                headers={
                    k: v
                    for k, v in request.headers.items()
                    if k.lower() not in ("host", "content-length", "transfer-encoding")
                },
                follow_redirects=True,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "text/plain"),
            )
        except Exception:
            return Response(
                content=b"<h2>Grafana is starting up...</h2>",
                status_code=503,
                media_type="text/html",
            )


# ===================== Mobile App Page =====================
@app.get("/mobile", include_in_schema=False)
async def serve_mobile_page():
    from fastapi.responses import HTMLResponse
    expo_url = "exp://fin--aifin.replit.app:8099"
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={expo_url}&color=F0B90B&bgcolor=0B0E11"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>FinAi Mobile App</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:#0B0E11;color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}}
  .logo{{display:flex;align-items:center;gap:10px;margin-bottom:32px}}
  .logo-icon{{width:44px;height:44px;background:#F0B90B;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#0B0E11}}
  .logo-text{{font-size:26px;font-weight:800;color:#F0B90B}}
  .card{{background:#141519;border:1px solid #2a2d35;border-radius:20px;padding:36px 32px;max-width:400px;width:100%;text-align:center}}
  h1{{font-size:22px;font-weight:700;margin-bottom:8px}}
  p{{color:#9ca3af;font-size:14px;margin-bottom:28px;line-height:1.6}}
  .qr-wrap{{background:#0B0E11;border-radius:14px;padding:16px;display:inline-block;margin-bottom:24px;border:1px solid #2a2d35}}
  .qr-wrap img{{display:block;border-radius:8px}}
  .step{{background:#1a1d23;border-radius:12px;padding:14px 16px;margin-bottom:10px;text-align:left;font-size:13px;color:#d1d5db;display:flex;gap:12px;align-items:flex-start}}
  .step-num{{background:#F0B90B;color:#0B0E11;font-weight:700;font-size:11px;border-radius:50%;width:22px;height:22px;min-width:22px;display:flex;align-items:center;justify-content:center}}
  .url-box{{background:#1a1d23;border:1px solid #2a2d35;border-radius:10px;padding:12px 16px;font-family:monospace;font-size:12px;color:#F0B90B;word-break:break-all;margin-top:20px;margin-bottom:8px}}
  .label{{font-size:11px;color:#6b7280;margin-bottom:4px;text-align:left}}
  a.back{{display:inline-block;margin-top:28px;color:#6b7280;font-size:13px;text-decoration:none}}
  a.back:hover{{color:#F0B90B}}
</style>
</head>
<body>
<div class="logo">
  <div class="logo-icon">F</div>
  <div class="logo-text">FinAi</div>
</div>
<div class="card">
  <h1>Open in Expo Go</h1>
  <p>Scan this QR code with your iPhone Camera or the Expo Go app to launch FinAi on your phone.</p>
  <div class="qr-wrap">
    <img src="{qr_url}" width="220" height="220" alt="Expo QR Code"/>
  </div>
  <div class="step"><span class="step-num">1</span>Download <strong>Expo Go</strong> from the App Store</div>
  <div class="step"><span class="step-num">2</span>Open your iPhone <strong>Camera app</strong> and point it at the QR code above</div>
  <div class="step"><span class="step-num">3</span>Tap the banner that appears — FinAi will open in Expo Go</div>
  <div class="label">Or enter this URL manually in Expo Go:</div>
  <div class="url-box">{expo_url}</div>
</div>
<a class="back" href="/">← Back to FinAi Web</a>
</body>
</html>"""
    return HTMLResponse(content=html)


# ===================== Static Frontend Serving =====================
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

SERVER_DIST = Path(__file__).parent.parent.parent / "server" / "dist"

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# ── Server admin panel served at /server ──────────────────────────
if SERVER_DIST.exists():
    app.mount(
        "/server/assets",
        StaticFiles(directory=str(SERVER_DIST / "assets")),
        name="server_assets",
    )

    @app.get("/server", include_in_schema=False)
    async def serve_server_root():
        return FileResponse(str(SERVER_DIST / "index.html"))

    @app.get("/server/{full_path:path}", include_in_schema=False)
    async def serve_server_spa(full_path: str):
        candidate = SERVER_DIST / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(SERVER_DIST / "index.html"))


# ── React dashboard served at / ───────────────────────────────────
if FRONTEND_DIST.exists():
    app.mount(
        "/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets"
    )

    @app.get("/")
    async def serve_root():
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    @app.get("/robots.txt", include_in_schema=False)
    async def serve_robots():
        robots = FRONTEND_DIST / "robots.txt"
        if robots.exists():
            return FileResponse(str(robots), media_type="text/plain")
        from fastapi.responses import PlainTextResponse

        return PlainTextResponse("User-agent: *\nAllow: /\nDisallow: /api/\n")

    @app.get("/favicon.svg", include_in_schema=False)
    async def serve_favicon():
        favicon = FRONTEND_DIST / "favicon.svg"
        if favicon.exists():
            return FileResponse(str(favicon), media_type="image/svg+xml")
        from fastapi import HTTPException

        raise HTTPException(status_code=404)

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith(
            (
                "api/",
                "docs",
                "redoc",
                "openapi.json",
                "metrics",
                "prom/",
                "prom",
                "graf/",
                "graf",
                "assets/",
                "uploads/",
                "server/",
                "mobile",
                "ws/",
            )
        ):
            from fastapi import HTTPException

            raise HTTPException(status_code=404)
        index = FRONTEND_DIST / "index.html"
        if index.exists():
            return FileResponse(str(index))
        from fastapi import HTTPException

        raise HTTPException(status_code=404)
else:

    @app.get("/")
    async def root():
        return {
            "message": "Welcome to FinAi - AI Powered Trading Platform",
            "version": "1.0.0",
            "status": "healthy",
            "docs": "/docs",
            "metrics": "/metrics",
            "api_prefix": "/api",
            "mobile_app": "/app",
        }


# ===================== Startup & Shutdown Events =====================
@app.on_event("startup")
async def startup_event():
    # ── Log which database is active ─────────────────────────────────────────
    from src.database.session import SUPABASE_DB_URL, DATABASE_URL

    if SUPABASE_DB_URL:
        logger.success("🗄️  Database → Supabase PostgreSQL (SUPABASE_DB_URL)")
    else:
        logger.info(f"🗄️  Database → fallback PostgreSQL (DATABASE_URL)")

    # ── DB schema + migrations (create_all + incremental ALTER TABLE) ─────────
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import text as _text

    try:
        with engine.connect() as _conn:
            for stmt in [
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS transfer_pin VARCHAR(255)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_deletion BOOLEAN DEFAULT FALSE",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS reason VARCHAR(200)",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS paper BOOLEAN DEFAULT TRUE",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS exchange VARCHAR(50)",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS stop_loss FLOAT",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS take_profit FLOAT",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS leverage FLOAT DEFAULT 1.0",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS lot_size FLOAT",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription VARCHAR(50) DEFAULT 'free'",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_connected BOOLEAN DEFAULT FALSE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20)",
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_proof TEXT",
                "ALTER TABLE ads ADD COLUMN IF NOT EXISTS description TEXT",
                "ALTER TABLE ads ADD COLUMN IF NOT EXISTS ad_type VARCHAR(50) DEFAULT 'banner'",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS require_claim BOOLEAN DEFAULT FALSE",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS task_description TEXT",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_methods TEXT",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_period VARCHAR(20) DEFAULT 'monthly'",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_auto_renew BOOLEAN DEFAULT TRUE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(100)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS dob VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS sex VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_code VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMP",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_locked BOOLEAN DEFAULT FALSE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_tier INTEGER DEFAULT 0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR DEFAULT 'none'",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMP",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_usdt FLOAT DEFAULT 0.0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS exchange_connections TEXT",
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS start_date VARCHAR(20)",
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS end_date VARCHAR(20)",
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS roi_percent FLOAT",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS trade_leverage FLOAT DEFAULT 1.0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_leverage FLOAT DEFAULT 1.0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_tickers JSONB",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS default_capital FLOAT DEFAULT 0.0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_per_trade FLOAT DEFAULT 1.0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS max_drawdown FLOAT DEFAULT 10.0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(100)",
                "ALTER TABLE ads ADD COLUMN IF NOT EXISTS link_url TEXT",
                "ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
                "ALTER TABLE ads ADD COLUMN IF NOT EXISTS image_base64 TEXT",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS alpaca_api_key VARCHAR(255)",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS alpaca_secret_key VARCHAR(255)",
                "CREATE TABLE IF NOT EXISTS user_activity_logs (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, user_email VARCHAR(255), action VARCHAR(100) NOT NULL, ip_address VARCHAR(100), user_agent VARCHAR(300), created_at TIMESTAMP DEFAULT NOW())",
                "CREATE TABLE IF NOT EXISTS price_alerts (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), symbol VARCHAR(30) NOT NULL, target_price FLOAT NOT NULL, direction VARCHAR(10) NOT NULL, is_active BOOLEAN DEFAULT TRUE, triggered_at TIMESTAMP, notify_browser BOOLEAN DEFAULT TRUE, notify_telegram BOOLEAN DEFAULT FALSE, notify_whatsapp BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW())",
                "CREATE TABLE IF NOT EXISTS testimonials (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, role VARCHAR(100), content TEXT NOT NULL, rating INTEGER DEFAULT 5, avatar_initials VARCHAR(5), avatar_color VARCHAR(20), is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW())",
                "CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id INTEGER REFERENCES users(id), referred_id INTEGER REFERENCES users(id), bonus_granted BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW())",
                "CREATE TABLE IF NOT EXISTS subscriptions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), plan VARCHAR(50), status VARCHAR(20) DEFAULT 'pending', amount FLOAT, payment_proof TEXT, created_at TIMESTAMP DEFAULT NOW(), approved_at TIMESTAMP)",
                "CREATE TABLE IF NOT EXISTS bonuses (id SERIAL PRIMARY KEY, title VARCHAR(200), description TEXT, amount FLOAT, bonus_type VARCHAR(50), require_claim BOOLEAN DEFAULT FALSE, task_description TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW())",
                "CREATE TABLE IF NOT EXISTS bonus_claims (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), bonus_id INTEGER REFERENCES bonuses(id), claimed_at TIMESTAMP DEFAULT NOW(), status VARCHAR(20) DEFAULT 'approved')",
                # Ensure model-named tables exist (create_all handles new DBs; these guard existing DBs)
                "CREATE TABLE IF NOT EXISTS subscription_requests (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) NOT NULL, plan VARCHAR(50) NOT NULL, period VARCHAR(20) DEFAULT 'monthly', amount_usdt FLOAT NOT NULL, payment_method VARCHAR(50) DEFAULT 'wallet', status VARCHAR(20) DEFAULT 'pending', auto_renew BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), processed_at TIMESTAMP, processed_by INTEGER, note TEXT)",
                "CREATE TABLE IF NOT EXISTS user_bonus_claims (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) NOT NULL, bonus_id INTEGER REFERENCES bonuses(id) NOT NULL, status VARCHAR(20) DEFAULT 'pending', assigned_at TIMESTAMP DEFAULT NOW(), claimed_at TIMESTAMP)",
                # Column additions for subscription_requests
                "ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS period VARCHAR(20) DEFAULT 'monthly'",
                "ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE",
                "ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'wallet'",
                "ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP",
                "ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS processed_by INTEGER",
                "ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS note TEXT",
                # Column additions for user_bonus_claims
                "ALTER TABLE user_bonus_claims ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'",
                "ALTER TABLE user_bonus_claims ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT NOW()",
                # Bonus model extra columns
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS amount_usdt FLOAT",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS target VARCHAR(30)",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS target_user_id INTEGER REFERENCES users(id)",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS tier_required INTEGER",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS granted_count INTEGER DEFAULT 0",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)",
                "ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS note TEXT",
                # EventBot trade identification
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS is_event_bot BOOLEAN DEFAULT FALSE",
                # EventBot config: leverage, TP, SL stored on trade_logs for position cards
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS take_profit FLOAT",
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS stop_loss FLOAT",
                # Chat feedback (like/dislike on Fin AI responses)
                """CREATE TABLE IF NOT EXISTS chat_feedback (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    message_hash VARCHAR(64) NOT NULL,
                    feedback VARCHAR(8) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                "CREATE INDEX IF NOT EXISTS idx_chat_feedback_hash ON chat_feedback(message_hash)",
                "CREATE INDEX IF NOT EXISTS idx_chat_feedback_user ON chat_feedback(user_id)",
                # Exness-style position tracking
                """CREATE TABLE IF NOT EXISTS positions (
                    id               SERIAL PRIMARY KEY,
                    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    ticker           VARCHAR(30) NOT NULL,
                    side             VARCHAR(10) NOT NULL,
                    status           VARCHAR(20) NOT NULL DEFAULT 'open',
                    lot_size         FLOAT NOT NULL,
                    contract_size    FLOAT NOT NULL DEFAULT 1.0,
                    entry_price      FLOAT NOT NULL,
                    close_price      FLOAT,
                    leverage         FLOAT NOT NULL DEFAULT 1.0,
                    margin           FLOAT NOT NULL,
                    realized_pnl     FLOAT,
                    stop_loss        FLOAT,
                    take_profit      FLOAT,
                    exchange         VARCHAR(50),
                    exchange_label   VARCHAR(100),
                    broker_order_id  VARCHAR(200),
                    broker_error     TEXT,
                    open_trade_id    INTEGER,
                    close_trade_id   INTEGER,
                    opened_at        TIMESTAMP DEFAULT NOW(),
                    closed_at        TIMESTAMP
                )""",
                "CREATE INDEX IF NOT EXISTS idx_positions_user_status ON positions(user_id, status)",
                "CREATE INDEX IF NOT EXISTS idx_positions_user_ticker ON positions(user_id, ticker)",
                # Link trade_logs → positions
                "ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS position_id INTEGER REFERENCES positions(id)",
                # HD Wallet: allow admins to set a custom derivation index per user
                # (defaults to user.id when NULL — keeps existing behaviour)
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS hd_wallet_index INTEGER",
                # Tatum blockchain monitoring fields on transactions
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tatum_subscription_id VARCHAR(100)",
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS monitoring_status VARCHAR(30) DEFAULT 'none'",
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(300)",
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS blockchain_amount FLOAT",
                "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS blockchain_confirmed_at TIMESTAMP",
                # token_version for JWT revocation (security fix #9)
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0 NOT NULL",
            ]:
                _conn.execute(_text(stmt))
            _conn.commit()

            # Fix JSON/JSONB columns that may have been created as TEXT
            for _fix in [
                """
                DO $$ BEGIN
                  IF (SELECT data_type FROM information_schema.columns
                      WHERE table_name='users' AND column_name='exchange_connections') = 'text' THEN
                    ALTER TABLE users ALTER COLUMN exchange_connections TYPE JSONB
                    USING CASE WHEN exchange_connections IS NULL OR exchange_connections=''
                               THEN '[]'::jsonb ELSE exchange_connections::jsonb END;
                  END IF;
                END $$
                """,
                """
                DO $$ BEGIN
                  IF (SELECT data_type FROM information_schema.columns
                      WHERE table_name='users' AND column_name='withdrawal_methods') = 'text' THEN
                    ALTER TABLE users ALTER COLUMN withdrawal_methods TYPE JSONB
                    USING CASE WHEN withdrawal_methods IS NULL OR TRIM(withdrawal_methods)=''
                               THEN '[]'::jsonb ELSE withdrawal_methods::jsonb END;
                  END IF;
                END $$
                """,
                "UPDATE users SET exchange_connections = '[]'::jsonb WHERE exchange_connections IS NULL",
            ]:
                _conn.execute(_text(_fix))
            _conn.commit()

            import secrets as _sec, string as _str

            _alphabet = _str.ascii_uppercase + _str.digits
            _rows = _conn.execute(
                _text("SELECT id FROM users WHERE referral_code IS NULL")
            ).fetchall()
            _check_sql = _text("SELECT 1 FROM users WHERE referral_code = :code")
            _update_sql = _text("UPDATE users SET referral_code = :code WHERE id = :uid")
            for _row in _rows:
                while True:
                    _code = "".join(_sec.choice(_alphabet) for _ in range(8))
                    _exists = _conn.execute(_check_sql, {"code": _code}).fetchone()
                    if not _exists:
                        break
                _conn.execute(_update_sql, {"code": _code, "uid": _row[0]})
            _conn.commit()
    except Exception:
        pass

    # Seed admin — credentials MUST come from env. Refuse to boot without them.
    _ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip()
    _ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "").strip()
    if _ADMIN_EMAIL and _ADMIN_PASS:
        try:
            from src.database.session import SessionLocal as _SL
            from src.users.crud import get_user_by_email as _gube, create_user as _cu
            from src.users.schemas import UserCreate as _UC

            with _SL() as _db:
                _existing = _gube(_db, _ADMIN_EMAIL)
                if not _existing:
                    _admin = _cu(_db, _UC(email=_ADMIN_EMAIL, password=_ADMIN_PASS))
                    _admin.is_admin = True
                    _admin.is_mail_verified = True
                    _admin.account_tier = 3
                    _db.commit()
                    logger.success(f"Admin seeded: {_ADMIN_EMAIL}")
                else:
                    if not _existing.is_admin:
                        _existing.is_admin = True
                        _existing.is_mail_verified = True
                        _existing.account_tier = 3
                        _db.commit()
                    logger.info(f"Admin already exists: {_ADMIN_EMAIL}")
        except Exception as _seed_err:
            logger.warning(f"Admin seed skipped: {_seed_err}")
    else:
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed")

    # Seed default BTC deposit address
    try:
        from src.database.session import SessionLocal as _SL2
        from src.database.models import WalletConfig as _WC

        _BTC_ADDR = "1LA4XUiQgTELjvDiRBQ41y4T2C5Y7L5Wmt"
        with _SL2() as _db2:
            _btc = _db2.query(_WC).filter(_WC.key == "btc_address").first()
            if not _btc:
                _db2.add(
                    _WC(
                        key="btc_address",
                        value=_BTC_ADDR,
                        label="Bitcoin (BTC) Address",
                    )
                )
                _db2.commit()
                logger.success(f" BTC deposit address seeded: {_BTC_ADDR}")
            elif not _btc.value:
                _btc.value = _BTC_ADDR
                _db2.commit()
                logger.info(" BTC deposit address updated")
    except Exception as _btc_err:
        logger.warning(f"BTC address seed skipped: {_btc_err}")

    # Seed default VPS plans and asset products
    try:
        import json as _json
        from src.database.session import SessionLocal as _SL3
        from src.database.models import WalletConfig as _WC2

        _DEFAULT_VPS = '[{"id":1,"name":"DigitalOcean","price":6,"specs":"1 vCPU \u00b7 1GB RAM \u00b7 25GB SSD"},{"id":2,"name":"Linode","price":5,"specs":"1 vCPU \u00b7 1GB RAM \u00b7 25GB SSD"},{"id":3,"name":"Vultr","price":6,"specs":"1 vCPU \u00b7 1GB RAM \u00b7 25GB SSD"},{"id":4,"name":"Kamatera","price":4,"specs":"1 vCPU \u00b7 1GB RAM \u00b7 20GB SSD"},{"id":5,"name":"Liquid Web","price":15,"specs":"1 vCPU \u00b7 2GB RAM \u00b7 40GB SSD"},{"id":6,"name":"Hostinger","price":4,"specs":"1 vCPU \u00b7 1GB RAM \u00b7 20GB SSD"},{"id":7,"name":"IONOS","price":5,"specs":"1 vCPU \u00b7 1GB RAM \u00b7 25GB SSD"},{"id":8,"name":"ScalaHosting","price":10,"specs":"1 vCPU \u00b7 2GB RAM \u00b7 50GB SSD"},{"id":9,"name":"InMotion Hosting","price":20,"specs":"2 vCPU \u00b7 4GB RAM \u00b7 75GB SSD"},{"id":10,"name":"A2 Hosting","price":5,"specs":"1 vCPU \u00b7 1GB RAM \u00b7 25GB SSD"}]'
        _DEFAULT_ASSETS = '[{"id":1,"name":"Bitcoin (BTC)","price":67432,"icon":"\u20bf"},{"id":2,"name":"Ethereum (ETH)","price":3521,"icon":"\u039e"},{"id":3,"name":"BNB","price":598,"icon":"B"}]'
        with _SL3() as _db3:
            for _key, _val, _lbl in [
                ("vps_plans", _DEFAULT_VPS, "VPS Plans"),
                ("asset_products", _DEFAULT_ASSETS, "Asset Products"),
            ]:
                _row = _db3.query(_WC2).filter(_WC2.key == _key).first()
                if not _row:
                    _db3.add(_WC2(key=_key, value=_val, label=_lbl))
            _db3.commit()
            logger.success(" VPS plans and asset products seeded")
    except Exception as _prod_err:
        logger.warning(f"Product seed skipped: {_prod_err}")

    # ── Load Evolution API config — env var (start.sh) wins, syncs to DB ────────
    # Priority: if the env var is already set (written by start.sh / Replit secrets),
    # it is the source of truth (it matches what the Evolution API process started with).
    # We write it back to the DB so the admin UI stays in sync.
    # Only fall back to the DB value when no env var is present.
    try:
        from src.database.session import SessionLocal as _SL_EVO
        from src.database.models import WalletConfig as _WC_EVO

        with _SL_EVO() as _ev_db:
            _EVO_MAP = [
                ("evo_api_url", "EVOLUTION_API_URL", "Evolution API URL"),
                ("evo_api_key", "EVOLUTION_API_KEY", "Evolution API Key"),
                ("evo_instance", "EVOLUTION_INSTANCE", "Evolution Instance Name"),
            ]
            _changed = False
            for _ev_db_key, _ev_env_key, _ev_label in _EVO_MAP:
                _env_val = os.environ.get(_ev_env_key, "").strip()
                _ev_row = (
                    _ev_db.query(_WC_EVO).filter(_WC_EVO.key == _ev_db_key).first()
                )
                _db_val = (_ev_row.value or "").strip() if _ev_row else ""

                if _env_val:
                    # Env var is set (start.sh / secrets) — it must match the running
                    # Evolution API process, so sync it into the DB as well.
                    if _db_val != _env_val:
                        if _ev_row:
                            _ev_row.value = _env_val
                        else:
                            _ev_db.add(
                                _WC_EVO(
                                    key=_ev_db_key,
                                    value=_env_val,
                                    label=_ev_label,
                                    updated_by=None,
                                )
                            )
                        _changed = True
                elif _db_val:
                    # No env var — fall back to DB value.
                    os.environ[_ev_env_key] = _db_val

            if _changed:
                _ev_db.commit()

            _has_evo = bool(os.environ.get("EVOLUTION_API_KEY"))
            if _has_evo:
                logger.success(" Evolution API config loaded from database")
            else:
                logger.info(
                    "  EVOLUTION_API_KEY not set — WhatsApp via Evolution disabled"
                )
    except Exception as _ev_err:
        logger.warning(f"Evolution API config load skipped: {_ev_err}")

    # Scheduler + Telegram webhook run in background so startup finishes fast
    asyncio.create_task(_deferred_init())
    logger.success(" FinAi API started — background init in progress")


async def _deferred_init():
    """Start scheduler and register Telegram webhook after server is ready."""
    try:
        from src.notifications.scheduler import scheduler

        scheduler.start()
        logger.success(" Scheduler started")
    except Exception as _sch_err:
        logger.warning(f"Scheduler start skipped: {_sch_err}")

    try:
        import httpx as _hx
        import os

        _bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        _wh_secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

        # Build a full HTTPS webhook URL — Telegram requires an absolute URL
        _raw = os.getenv("WEBHOOK_URL", "").strip()
        if _raw and _raw.startswith("http"):
            # Caller supplied a full URL already
            WEBHOOK_URL = _raw.rstrip("/") + "/api/telegram/webhook" if "/api/telegram/webhook" not in _raw else _raw
        else:
            # Derive from REPLIT_DOMAINS or fall back to the known Replit domain
            _domain = os.getenv("REPLIT_DOMAINS", "fin--aifin.replit.app").split(",")[0].strip()
            WEBHOOK_URL = f"https://{_domain}/api/telegram/webhook"
        logger.info(f"Webhook URL: {WEBHOOK_URL}")
        if _bot_token:
            payload = {"url": WEBHOOK_URL}
            if _wh_secret:
                payload["secret_token"] = _wh_secret
            async with _hx.AsyncClient(timeout=10) as _c:
                _r = await _c.post(
                    f"https://api.telegram.org/bot{_bot_token}/setWebhook",
                    json=payload,
                )
                _data = _r.json()
                if _data.get("ok"):
                    logger.success(f" Telegram webhook registered: {WEBHOOK_URL}")
                else:
                    logger.warning(f"  Telegram webhook registration failed: {_data}")
        else:
            logger.info("  TELEGRAM_BOT_TOKEN not set — webhook skipped")
    except Exception as _tg_err:
        logger.warning(f"Telegram webhook init skipped: {_tg_err}")


@app.on_event("shutdown")
async def shutdown_event():
    try:
        from src.notifications.scheduler import scheduler

        scheduler.shutdown()
        logger.info(" Scheduler shut down gracefully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
