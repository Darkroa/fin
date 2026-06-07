import os
import asyncio
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from prometheus_fastapi_instrumentator import Instrumentator
from loguru import logger

from src.api.routes import router
from src.api.middleware import APIRateLimitMiddleware
from src.database.models import Base
from src.database.session import engine

app = FastAPI(
    title="FinAi API",
    version="1.0.0",
    description="AI-Powered Financial News Ingestion & Automated Trading Platform",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ===================== Middleware =====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(APIRateLimitMiddleware)

# Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Include API routes
app.include_router(router, prefix="/api")

# ===================== Static Frontend Serving =====================
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

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
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json", "metrics", "assets/")):
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
            "api_prefix": "/api"
        }


# ===================== Startup & Shutdown Events =====================
@app.on_event("startup")
async def startup_event():
    
    # DB schema
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
            _rows = _conn.execute(_text("SELECT id FROM users WHERE referral_code IS NULL")).fetchall()
            for _row in _rows:
                while True:
                    _code = ''.join(_sec.choice(_alphabet) for _ in range(8))
                    _exists = _conn.execute(_text(f"SELECT 1 FROM users WHERE referral_code = '{_code}'")).fetchone()
                    if not _exists:
                        break
                _conn.execute(_text(f"UPDATE users SET referral_code = '{_code}' WHERE id = {_row[0]}"))
            _conn.commit()
    except Exception:
        pass

    # Seed admin
    try:
        from src.database.session import SessionLocal as _SL
        from src.users.crud import get_user_by_email as _gube, create_user as _cu
        from src.users.schemas import UserCreate as _UC
        _ADMIN_EMAIL = "AdminfinAi@gmail.com"
        _ADMIN_PASS  = "FineAdminpass1"
        with _SL() as _db:
            _existing = _gube(_db, _ADMIN_EMAIL)
            if not _existing:
                _admin = _cu(_db, _UC(email=_ADMIN_EMAIL, password=_ADMIN_PASS))
                _admin.is_admin        = True
                _admin.is_mail_verified = True
                _admin.account_tier    = 3
                _db.commit()
                logger.success(f"✅ Admin seeded: {_ADMIN_EMAIL}")
            else:
                if not _existing.is_admin:
                    _existing.is_admin        = True
                    _existing.is_mail_verified = True
                    _existing.account_tier    = 3
                    _db.commit()
                logger.info(f"ℹ️  Admin already exists: {_ADMIN_EMAIL}")
    except Exception as _seed_err:
        logger.warning(f"Admin seed skipped: {_seed_err}")

    # Seed default BTC deposit address
    try:
        from src.database.session import SessionLocal as _SL2
        from src.database.models import WalletConfig as _WC
        _BTC_ADDR = "1LA4XUiQgTELjvDiRBQ41y4T2C5Y7L5Wmt"
        with _SL2() as _db2:
            _btc = _db2.query(_WC).filter(_WC.key == "btc_address").first()
            if not _btc:
                _db2.add(_WC(key="btc_address", value=_BTC_ADDR, label="Bitcoin (BTC) Address"))
                _db2.commit()
                logger.success(f"✅ BTC deposit address seeded: {_BTC_ADDR}")
            elif not _btc.value:
                _btc.value = _BTC_ADDR
                _db2.commit()
                logger.info("✅ BTC deposit address updated")
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
                ("vps_plans",      _DEFAULT_VPS,    "VPS Plans"),
                ("asset_products", _DEFAULT_ASSETS, "Asset Products"),
            ]:
                _row = _db3.query(_WC2).filter(_WC2.key == _key).first()
                if not _row:
                    _db3.add(_WC2(key=_key, value=_val, label=_lbl))
            _db3.commit()
            logger.success("✅ VPS plans and asset products seeded")
    except Exception as _prod_err:
        logger.warning(f"Product seed skipped: {_prod_err}")

    # Scheduler + Telegram webhook run in background so startup finishes fast
    asyncio.create_task(_deferred_init())
    logger.success("🚀 FinAi API started — background init in progress")


async def _deferred_init():
    """Start scheduler and register Telegram webhook after server is ready."""
    try:
        from src.notifications.scheduler import scheduler
        scheduler.start()
        logger.success("⏰ Scheduler started")
    except Exception as _sch_err:
        logger.warning(f"Scheduler start skipped: {_sch_err}")

    try:
        import httpx as _hx
        import os

        _bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        _wh_secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

        # Prioritize custom domain from env, fallback to hardcoded
        WEBHOOK_URL = os.getenv(
            "WEBHOOK_URL", 
            "https://fin-ai--fibot.replit.app/api/telegram/webhook"
        )
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
                    logger.success(f"✅ Telegram webhook registered: {WEBHOOK_URL}")
                else:
                    logger.warning(f"⚠️  Telegram webhook registration failed: {_data}")
        else:
            logger.info("ℹ️  TELEGRAM_BOT_TOKEN not set — webhook skipped")
    except Exception as _tg_err:
        logger.warning(f"Telegram webhook init skipped: {_tg_err}")


@app.on_event("shutdown")
async def shutdown_event():
    try:
        from src.notifications.scheduler import scheduler
        scheduler.shutdown()
        logger.info("🛑 Scheduler shut down gracefully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
