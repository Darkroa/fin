import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://finuser:finpass@postgres:5432/finforge")
    REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # Monitoring services
    PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    GRAFANA_URL = os.getenv("GRAFANA_URL", "http://localhost:3001")

    # Default user settings
    DEFAULT_CAPITAL = 10000.0
    DEFAULT_RISK_PERCENT = 9.0
    DEFAULT_MAX_DRAWDOWN = 90.0

config = Config()