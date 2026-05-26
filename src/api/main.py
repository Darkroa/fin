import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from prometheus_fastapi_instrumentator import Instrumentator
from loguru import logger

from src.api.routes import router
from src.api.middleware import APIRateLimitMiddleware
from src.notifications.scheduler import scheduler
from src.database.models import Base
from src.database.session import engine

app = FastAPI(
    title="FinAi API",           # Changed to match your repo name
    version="1.0.0",
    description="AI-Powered Financial News Ingestion & Automated Trading Platform",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ===================== Middleware =====================
# CORS - Be more restrictive in production!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],                    # Change to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Rate Limiting + API Usage Logging Middleware
app.add_middleware(APIRateLimitMiddleware)

# Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Include API routes with prefix
app.include_router(router, prefix="/api")


# ===================== Startup & Shutdown Events =====================
@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)

    # Safe column migrations for new fields (idempotent)
    from sqlalchemy import text as _text
    try:
        with engine.connect() as _conn:
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS transfer_pin VARCHAR(255)"))
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_deletion BOOLEAN DEFAULT FALSE"))
            _conn.execute(_text("ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS stop_loss FLOAT"))
            _conn.execute(_text("ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS take_profit FLOAT"))
            _conn.execute(_text("ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS leverage FLOAT DEFAULT 1.0"))
            _conn.execute(_text("ALTER TABLE trade_logs ADD COLUMN IF NOT EXISTS lot_size FLOAT"))
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription VARCHAR(50) DEFAULT 'free'"))
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100)"))
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50)"))
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_connected BOOLEAN DEFAULT FALSE"))
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE"))
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)"))
            _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20)"))
            _conn.commit()
            # Backfill referral_code for existing users who don't have one
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

    # Seed admin account (idempotent)
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

    scheduler.start()

    # ── Auto-register Telegram webhook ──────────────────────────────────
    try:
        import httpx as _hx, asyncio as _asyncio
        _bot_token  = os.getenv("TELEGRAM_BOT_TOKEN", "")
        _wh_secret  = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
        _domain     = (
            os.getenv("REPLIT_DEV_DOMAIN")
            or os.getenv("REPLIT_DOMAINS", "").split(",")[0].strip()
        )
        if _bot_token and _domain:
            _wh_url = f"https://{_domain}/api/telegram/webhook"
            async def _register_webhook():
                try:
                    payload = {"url": _wh_url}
                    if _wh_secret:
                        payload["secret_token"] = _wh_secret
                    async with _hx.AsyncClient(timeout=10) as _c:
                        _r = await _c.post(
                            f"https://api.telegram.org/bot{_bot_token}/setWebhook",
                            json=payload,
                        )
                        _data = _r.json()
                        if _data.get("ok"):
                            logger.success(f"✅ Telegram webhook registered: {_wh_url}")
                        else:
                            logger.warning(f"⚠️  Telegram webhook registration failed: {_data}")
                except Exception as _we:
                    logger.warning(f"Telegram webhook registration skipped: {_we}")
            _asyncio.create_task(_register_webhook())
        else:
            if not _bot_token:
                logger.info("ℹ️  TELEGRAM_BOT_TOKEN not set — webhook skipped")
    except Exception as _tg_err:
        logger.warning(f"Telegram startup init skipped: {_tg_err}")

    logger.success("🚀 FinAi API started successfully")
    logger.info("📊 Docs available at: http://localhost:8000/docs")
    logger.info("📈 Metrics available at: http://localhost:8000/metrics")


@app.on_event("shutdown")
async def shutdown_event():
    try:
        scheduler.shutdown()
        logger.info("🛑 Scheduler shut down gracefully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# ===================== Static Frontend Serving (Production) =====================
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API, docs, metrics, or static asset routes
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json", "metrics", "assets/")):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        index = FRONTEND_DIST / "index.html"
        if index.exists():
            return FileResponse(str(index))
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
else:
    # ===================== Root Endpoint (Dev only) =====================
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
