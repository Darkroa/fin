from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    JSON, Text, ForeignKey
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import bcrypt

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    is_mail_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    default_capital = Column(Float, default=10000.0)
    risk_per_trade = Column(Float, default=1.0)
    max_drawdown = Column(Float, default=10.0)
    preferred_tickers = Column(JSON, default=["SPX"])
    notification_preferences = Column(JSON, default={"email": True, "whatsapp": True, "telegram": True})

    alpaca_api_key = Column(String(255), nullable=True)
    alpaca_secret_key = Column(String(255), nullable=True)

    api_keys = relationship("APIKey", back_populates="user")
    money_records = relationship("UserMoney", back_populates="user")

    def verify_password(self, plain_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode("utf-8"), self.hashed_password.encode("utf-8"))

    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key_name = Column(String(100), nullable=False)
    api_key = Column(String(128), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    allowed_scopes = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100))
    title = Column(String(500))
    description = Column(Text)
    tickers_affected = Column(JSON, default=[])
    impact_score = Column(Integer, default=5)
    sentiment = Column(String(50))
    confidence = Column(Float, default=0.5)
    short_term_impact = Column(Text)
    medium_term_impact = Column(Text)
    risk_level = Column(String(50))
    published_date = Column(DateTime, nullable=True)
    source_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "event_type": self.event_type,
            "title": self.title,
            "description": self.description,
            "tickers_affected": self.tickers_affected,
            "impact_score": self.impact_score,
            "sentiment": self.sentiment,
            "confidence": self.confidence,
            "short_term_impact": self.short_term_impact,
            "medium_term_impact": self.medium_term_impact,
            "risk_level": self.risk_level,
            "published_date": self.published_date.isoformat() if self.published_date else None,
            "source_url": self.source_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TrendAnalysis(Base):
    __tablename__ = "trend_analyses"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), index=True)
    trend_state = Column(String(50))
    current_price = Column(Float)
    predicted_price = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    atr = Column(Float, nullable=True)
    upper_trend = Column(Float, nullable=True)
    lower_trend = Column(Float, nullable=True)
    breakout_up = Column(Boolean, default=False)
    breakout_dn = Column(Boolean, default=False)
    prediction_text = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class TradeLog(Base):
    __tablename__ = "trade_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20))
    action = Column(String(10))
    price = Column(Float)
    qty = Column(Float)
    pnl = Column(Float, nullable=True)
    reason = Column(String(200), nullable=True)
    paper = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserMoney(Base):
    __tablename__ = "user_money"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float)
    status = Column(String(50), default="pending")
    tx_hash = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="money_records")
