from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
            _conn.commit()
    except Exception:
        pass

    scheduler.start()
    
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


# ===================== Root Endpoint =====================
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
        reload=True,           # Enable auto-reload during development
        log_level="info"
    )
