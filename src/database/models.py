from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Use environment variable with a strong default for local development
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://finuser:finpass@localhost:5432/finai_db"   # Changed name to match project
)

# Synchronous engine (used by most of your current code)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,          # Helps with stale connections
    pool_size=10,
    max_overflow=20,
    echo=False                   # Set to True only for debugging SQL
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db():
    """Dependency for FastAPI routes - yields a session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Optional: Async support (for future Celery/FastAPI async tasks)
async_engine = None
AsyncSessionLocal = None

def init_async_engine():
    global async_engine, AsyncSessionLocal
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    
    async_url = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    async_engine = create_async_engine(async_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
