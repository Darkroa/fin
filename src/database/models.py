from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    JSON, Text, ForeignKey, Enum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import bcrypt
import enum

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Basic profile
    first_name = Column(String(100), nullable=True)
    middle_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    full_name = Column(String(200), nullable=True)
    username = Column(String(100), unique=True, nullable=True, index=True)
    phone = Column(String(30), nullable=True)
    dob = Column(String(20), nullable=True)
    sex = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    country = Column(String(100), nullable=True)
    profile_photo = Column(Text, nullable=True)  # base64 or URL

    # Account status
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    is_mail_verified = Column(Boolean, default=False)
    email_verify_code = Column(String(10), nullable=True)
    email_verify_expires = Column(DateTime, nullable=True)
    profile_locked = Column(Boolean, default=False)  # admin can lock/unlock editing

    # KYC / account tier
    account_tier = Column(Integer, default=0)  # 0=unverified, 1,2,3
    kyc_status = Column(String(30), default="pending")  # pending / submitted / approved / rejected
    kyc_submitted_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Trading settings
    default_capital = Column(Float, default=0.0)
    risk_per_trade = Column(Float, default=1.0)
    max_drawdown = Column(Float, default=10.0)
    preferred_tickers = Column(JSON, default=["BTC/USDT"])
    notification_preferences = Column(JSON, default={"email": True, "whatsapp": False, "telegram": False})

    # Exchange connections (store as JSON list of {exchange, api_key, api_secret, passphrase?})
    exchange_connections = Column(JSON, default=[])

    # Legacy alpaca
    alpaca_api_key = Column(String(255), nullable=True)
    alpaca_secret_key = Column(String(255), nullable=True)

    # Wallet balance (USDT equivalent)
    balance_usdt = Column(Float, default=0.0)

    # Subscription
    subscription = Column(String(50), default="free")   # free / pro / elite / elite+ / custom
    subscription_expires_at = Column(DateTime, nullable=True)
    subscription_period = Column(String(20), default="monthly")  # monthly / 6month / yearly
    subscription_auto_renew = Column(Boolean, default=True)

    # Notification channel bindings
    telegram_chat_id = Column(String(100), nullable=True)
    whatsapp_number = Column(String(50), nullable=True)
    telegram_connected = Column(Boolean, default=False)
    whatsapp_connected = Column(Boolean, default=False)

    # Withdrawal payout methods (JSON list)
    withdrawal_methods = Column(Text, nullable=True)

    # Leverage settings
    trade_leverage = Column(Float, nullable=True, default=1.0)
    buy_leverage   = Column(Float, nullable=True, default=1.0)

    # Security
    transfer_pin = Column(String(255), nullable=True)   # bcrypt-hashed PIN
    pending_deletion = Column(Boolean, default=False)   # flagged for admin deletion

    # Login tracking
    last_login_at = Column(DateTime, nullable=True)
    last_login_ip = Column(String(100), nullable=True)

    # Referral
    referral_code = Column(String(20), unique=True, nullable=True, index=True)
    referred_by   = Column(String(20), nullable=True)   # code that was used at signup

    # Relationships
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan",
                                foreign_keys="Transaction.user_id")
    support_tickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")

    def verify_password(self, plain_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode("utf-8"), self.hashed_password.encode("utf-8"))

    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)      # login / logout / deposit / withdrawal / kyc_submit / etc.
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(String(300), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key_name = Column(String(100), nullable=False)
    api_key = Column(String(128), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    allowed_scopes = Column(JSON, default=[])
    purpose = Column(String(100), nullable=True)  # "bot", "vps", "asset"
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")


class Transaction(Base):
    """Unified transaction table for all money movements"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tx_type = Column(String(50), nullable=False)  # deposit / withdrawal / p2p_send / p2p_receive / trade / vps / asset
    method = Column(String(50), nullable=True)    # crypto_btc / crypto_eth / crypto_usdt / bank / internal
    asset = Column(String(20), nullable=True)     # BTC, ETH, USDT, USD
    amount_asset = Column(Float, nullable=True)   # amount in asset units
    amount_usdt = Column(Float, nullable=False)   # amount in USDT
    fee = Column(Float, default=0.0)
    status = Column(String(30), default="pending")  # pending / approved / rejected / completed / failed
    tx_hash = Column(String(300), nullable=True)
    wallet_address = Column(String(300), nullable=True)
    bank_ref = Column(String(200), nullable=True)
    note = Column(Text, nullable=True)
    payment_proof = Column(Text, nullable=True)   # base64 image uploaded by user for bank transfers
    recipient_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # for P2P
    start_date = Column(String(20), nullable=True)     # for VPS/asset: subscription start date
    end_date   = Column(String(20), nullable=True)     # for VPS/asset: subscription end date
    roi_percent = Column(Float, nullable=True)          # for VPS/asset: ROI % set by admin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="transactions", foreign_keys=[user_id])
    recipient = relationship("User", foreign_keys=[recipient_user_id])


# Keep UserMoney for backward compat
class UserMoney(Base):
    __tablename__ = "user_money"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float)
    status = Column(String(50), default="pending")
    tx_hash = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class WalletConfig(Base):
    """Admin-managed deposit addresses and bank details"""
    __tablename__ = "wallet_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)   # btc_address, eth_address, usdt_trc20, bank_name, bank_account, bank_routing, bank_swift
    value = Column(Text, nullable=True)
    label = Column(String(200), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)


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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ticker = Column(String(20))
    action = Column(String(10))
    price = Column(Float)
    qty = Column(Float)
    pnl = Column(Float, nullable=True)
    reason = Column(String(200), nullable=True)
    paper = Column(Boolean, default=True)
    exchange = Column(String(50), nullable=True)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    leverage = Column(Float, nullable=True, default=1.0)
    lot_size = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    target_all = Column(Boolean, default=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    read_by_user_ids = Column(JSON, default=list)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(300), nullable=False)
    status = Column(String(30), default="open")  # open / in_progress / resolved / closed
    priority = Column(String(20), default="normal")  # low / normal / high / urgent
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="support_tickets")
    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan")


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


class SubscriptionRequest(Base):
    __tablename__ = "subscription_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan = Column(String(50), nullable=False)
    period = Column(String(20), default="monthly")
    amount_usdt = Column(Float, nullable=False)
    payment_method = Column(String(50), default="wallet")
    status = Column(String(20), default="pending")
    auto_renew = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    processed_by = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)

    user = relationship("User")


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String(30), nullable=False)
    target_price = Column(Float, nullable=False)
    direction = Column(String(10), nullable=False)  # "above" or "below"
    is_active = Column(Boolean, default=True)
    triggered_at = Column(DateTime, nullable=True)
    notify_browser = Column(Boolean, default=True)
    notify_telegram = Column(Boolean, default=False)
    notify_whatsapp = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Ad(Base):
    """Admin-created in-app advertisements shown to users after login."""
    __tablename__ = "ads"

    id            = Column(Integer, primary_key=True, index=True)
    title         = Column(String(300), nullable=False)
    description   = Column(Text, nullable=True)           # note / caption shown under the ad
    ad_type       = Column(String(50), default="banner")  # banner / popup / sidebar / notification / ticker
    image_base64  = Column(Text, nullable=True)    # base64-encoded image
    link_url      = Column(String(500), nullable=True)
    is_active     = Column(Boolean, default=True)
    created_by    = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])


class Testimonial(Base):
    """Admin-managed user reviews / Trustpilot-style ratings shown on the About page."""
    __tablename__ = "testimonials"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(100), nullable=False)
    role            = Column(String(150), nullable=True)
    content         = Column(Text, nullable=False)
    rating          = Column(Integer, default=5)           # 1–5 stars
    avatar_initials = Column(String(5), nullable=True)
    avatar_color    = Column(String(20), nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class Bonus(Base):
    """Admin-created bonus campaigns (referral, tier achievement, manual grants)"""
    __tablename__ = "bonuses"

    id            = Column(Integer, primary_key=True, index=True)
    title         = Column(String(200), nullable=False)
    bonus_type    = Column(String(50), nullable=False)   # referral_signup | tier_achievement | manual_grant
    amount_usdt   = Column(Float, nullable=False)
    target        = Column(String(30), nullable=False)   # all | new_users | specific
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    tier_required = Column(Integer, nullable=True)       # auto-trigger when user reaches this tier
    note          = Column(Text, nullable=True)
    task_description = Column(Text, nullable=True)       # detailed task instructions shown to user
    require_claim = Column(Boolean, default=False)       # if True, user must click Claim to receive USDT
    active        = Column(Boolean, default=True)
    granted_count = Column(Integer, default=0)           # how many users credited
    created_by    = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    target_user = relationship("User", foreign_keys=[target_user_id])
    creator     = relationship("User", foreign_keys=[created_by])
    claims      = relationship("UserBonusClaim", back_populates="bonus")


class UserBonusClaim(Base):
    """Tracks which users have been assigned claimable bonus tasks and their claim status."""
    __tablename__ = "user_bonus_claims"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    bonus_id    = Column(Integer, ForeignKey("bonuses.id"), nullable=False)
    status      = Column(String(20), default="pending")  # pending / claimed
    assigned_at = Column(DateTime, default=datetime.utcnow)
    claimed_at  = Column(DateTime, nullable=True)

    user  = relationship("User", foreign_keys=[user_id])
    bonus = relationship("Bonus", back_populates="claims")
