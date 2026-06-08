from fastapi import (
    APIRouter, BackgroundTasks, Query, Depends,
    HTTPException, Header, Request, status, UploadFile, File,
    WebSocket, WebSocketDisconnect
)
from datetime import datetime, timedelta
import random, string, base64, io, os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy.orm import Session
from typing import Optional, List
from loguru import logger
from pydantic import BaseModel

# Internal imports
from src.auth.auth import create_access_token
from src.users.crud import create_user, get_user_by_email
from src.database.session import get_db
from src.users.api_keys import create_api_key, revoke_api_key, get_user_by_api_key
from src.users.bot_manager import get_user_bot_manager
from src.auth.dependencies import get_current_user, require_admin
from src.database.models import (
    User, APIKey, Transaction, UserMoney, Event,
    Notification, WalletConfig, SupportTicket, SupportMessage, TradeLog, PriceAlert,
    SubscriptionRequest, Ad, Testimonial, UserActivityLog
)

# ===================== Pydantic Schemas =====================
class UserCreate2(BaseModel):
    email: str
    password: str
    referral_code: Optional[str] = None

class ApproveTransaction(BaseModel):
    transaction_id: str
    tx_hash: Optional[str] = None

class RejectTransaction(BaseModel):
    transaction_id: str

class PushNotification(BaseModel):
    title: str
    message: str
    target_all: bool = True
    target_user_id: Optional[int] = None

class DepositRequest(BaseModel):
    method: str        # crypto_btc / crypto_eth / crypto_usdt / bank
    asset: str
    amount_usdt: float
    tx_hash: Optional[str] = None
    wallet_address: Optional[str] = None
    bank_ref: Optional[str] = None
    note: Optional[str] = None
    payment_proof: Optional[str] = None  # base64 image for bank transfer proof

class WithdrawRequest(BaseModel):
    method: str
    asset: str
    amount_usdt: float
    wallet_address: Optional[str] = None
    bank_ref: Optional[str] = None
    note: Optional[str] = None
    transfer_pin: Optional[str] = None

class P2PRequest(BaseModel):
    recipient_email: str
    amount_usdt: float
    note: Optional[str] = None

class WalletConfigUpdate(BaseModel):
    key: str
    value: str
    label: Optional[str] = None

class WithdrawalMethodsUpdate(BaseModel):
    methods: List[dict]

class KYCUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    sex: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None

class ExchangeConnection(BaseModel):
    exchange: str
    api_key: str
    api_secret: str
    passphrase: Optional[str] = None
    label: Optional[str] = None

class AdminUpdateUser(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    balance_usdt: Optional[float] = None
    account_tier: Optional[int] = None
    kyc_status: Optional[str] = None
    is_active: Optional[bool] = None
    is_banned: Optional[bool] = None
    is_admin: Optional[bool] = None
    profile_locked: Optional[bool] = None
    subscription: Optional[str] = None
    is_mail_verified: Optional[bool] = None

class SupportTicketCreate(BaseModel):
    subject: str
    message: str
    priority: Optional[str] = "normal"

class SupportReply(BaseModel):
    ticket_id: int
    message: str

class EmailVerifyRequest(BaseModel):
    code: str

class ContactForm(BaseModel):
    subject: str
    message: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class SetTransferPinRequest(BaseModel):
    pin: str

class WebhookSettingsRequest(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    whatsapp_number: Optional[str] = None

class TelegramLinkRequest(BaseModel):
    code: str

class BotStartRequest(BaseModel):
    ticker: str = "BTC-USD"
    paper: bool = True
    initial_capital: float = 1000.0
    risk_per_trade_pct: float = 1.0
    max_drawdown_pct: float = 10.0

class BotParamsUpdate(BaseModel):
    default_capital: Optional[float] = None
    risk_per_trade: Optional[float] = None
    max_drawdown: Optional[float] = None
    preferred_tickers: Optional[list] = None

class TradeExecuteRequest(BaseModel):
    pair: str
    side: str
    order_type: str = "market"
    price: float
    amount: float
    paper: bool = True
    exchange_label: Optional[str] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    leverage: Optional[float] = 1.0
    lot_size: Optional[float] = None

class NotificationPrefsUpdate(BaseModel):
    # Channel toggles
    email: Optional[bool] = None
    whatsapp: Optional[bool] = None
    telegram: Optional[bool] = None
    # Trade alert toggles
    trade_open_alert: Optional[bool] = None
    trade_close_alert: Optional[bool] = None

class WhatsAppCodeRequest(BaseModel):
    phone: str

class WhatsAppVerifyRequest(BaseModel):
    code: str

class PriceAlertCreate(BaseModel):
    symbol: str
    target_price: float
    direction: str
    notify_browser: bool = True
    notify_telegram: bool = False
    notify_whatsapp: bool = False

class BotStartRequestV2(BaseModel):
    ticker: str = "BTC-USD"
    paper: bool = False
    initial_capital: float = 200.0
    balance_to_use: Optional[float] = None
    risk_per_trade_pct: float = 40.0
    max_drawdown_pct: float = 10.0
    exchange_label: Optional[str] = None
    strategy: str = "sma"
    take_profit_pct: float = 4.0
    direction: str = "auto"
    bot_name: Optional[str] = None
    leverage: float = 200.0
    sl_usdt: float = 100.0
    stop_loss_pct: float = 50.0
    lot_size: float = 1.0


class BotClosePositionRequest(BaseModel):
    bot_id: str


class CloseManualTradeRequest(BaseModel):
    trade_id: int


class TFASetupRequest(BaseModel):
    tfa_method: str                     # 'telegram' | 'email'
    recovery_email: Optional[str] = None


class TFAVerifyRequest(BaseModel):
    partial_token: str
    code: str


# ===================== Router =====================
router = APIRouter()


# ─── Admin Telegram alert helper ──────────────────────────────────────────────
def _fire_admin_telegram_alert(message_md: str, db=None) -> None:
    """
    Fire-and-forget admin Telegram notification.
    Sends to TELEGRAM_ADMIN_CHAT_ID env var AND to every admin user
    with a linked Telegram chat_id.  Runs in a background thread.
    """
    import threading, requests as _rq
    tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not tg_token:
        return

    chat_ids: set = set()

    env_cid = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    if env_cid:
        chat_ids.add(env_cid)

    if db is not None:
        try:
            admins = db.query(User).filter(User.is_admin == True).all()
            for adm in admins:
                cid = adm.telegram_chat_id or (dict(adm.notification_preferences or {}).get("telegram_chat_id"))
                if cid:
                    chat_ids.add(str(cid))
        except Exception:
            pass

    def _send(ids=chat_ids, tok=tg_token, txt=message_md):
        for cid in ids:
            try:
                _rq.post(
                    f"https://api.telegram.org/bot{tok}/sendMessage",
                    json={"chat_id": cid, "text": txt, "parse_mode": "Markdown"},
                    timeout=8,
                )
            except Exception as _e:
                logger.warning(f"Admin Telegram alert failed (chat {cid}): {_e}")

    threading.Thread(target=_send, daemon=True).start()


# ===================== API Key Auth =====================
def authenticate_api_key(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    api_key = authorization.split(" ")[1]
    user = get_user_by_api_key(db, api_key)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    return user


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "first_name": u.first_name,
        "middle_name": u.middle_name,
        "last_name": u.last_name,
        "full_name": u.full_name,
        "username": u.username,
        "phone": u.phone,
        "dob": u.dob,
        "sex": u.sex,
        "address": u.address,
        "country": u.country,
        "profile_photo": u.profile_photo,
        "is_active": u.is_active,
        "is_admin": u.is_admin,
        "is_banned": u.is_banned,
        "is_mail_verified": u.is_mail_verified,
        "profile_locked": u.profile_locked,
        "account_tier": u.account_tier,
        "kyc_status": u.kyc_status,
        "balance_usdt": u.balance_usdt or 0.0,
        "exchange_connections": [
            {"exchange": c.get("exchange"), "label": c.get("label"), "api_key_masked": c.get("api_key", "")[:6] + "****"}
            for c in (u.exchange_connections or [])
        ],
        "default_capital": u.default_capital,
        "risk_per_trade": u.risk_per_trade,
        "max_drawdown": u.max_drawdown,
        "preferred_tickers": u.preferred_tickers,
        "notification_preferences": u.notification_preferences,
        "subscription": u.subscription or "free",
        "telegram_chat_id": u.telegram_chat_id,
        "whatsapp_number": u.whatsapp_number,
        "telegram_connected": bool(u.telegram_connected),
        "whatsapp_connected": bool(u.whatsapp_connected),
        "trade_leverage": u.trade_leverage or 1.0,
        "bot_leverage": u.bot_leverage or 1.0,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _tx_dict(t: Transaction) -> dict:
    return {
        "id": t.id,
        "tx_type": t.tx_type,
        "method": t.method,
        "asset": t.asset,
        "amount_usdt": t.amount_usdt,
        "amount_asset": t.amount_asset,
        "fee": t.fee,
        "status": t.status,
        "tx_hash": t.tx_hash,
        "wallet_address": t.wallet_address,
        "bank_ref": t.bank_ref,
        "note": t.note,
        "payment_proof": t.payment_proof,
        "recipient_user_id": t.recipient_user_id,
        "start_date": t.start_date,
        "end_date": t.end_date,
        "roi_percent": t.roi_percent,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ===================== Auth Routes =====================
@router.post("/auth/signup")
async def signup(user_data: UserCreate2, db: Session = Depends(get_db)):
    if get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    from src.users.schemas import UserCreate as UC
    import secrets as _sec, string as _str
    uc = UC(email=user_data.email, password=user_data.password)
    user = create_user(db, uc)
    # Generate unique referral code
    _alpha = _str.ascii_uppercase + _str.digits
    for _ in range(10):
        _code = ''.join(_sec.choice(_alpha) for _ in range(8))
        if not db.query(User).filter(User.referral_code == _code).first():
            break
    user.referral_code = _code
    # Handle referral — credit referrer if a valid code was provided
    if user_data.referral_code:
        referrer = db.query(User).filter(User.referral_code == user_data.referral_code).first()
        if referrer and referrer.id != user.id:
            user.referred_by = user_data.referral_code
            # Check if there's an active referral bonus configured
            from src.database.models import Bonus as _Bonus
            ref_bonus = db.query(_Bonus).filter(
                _Bonus.bonus_type == "referral_signup",
                _Bonus.active == True,
            ).first()
            if ref_bonus:
                # Credit referrer
                referrer.balance_usdt = (referrer.balance_usdt or 0) + ref_bonus.amount_usdt
                ref_bonus.granted_count = (ref_bonus.granted_count or 0) + 1
                db.add(Transaction(
                    user_id=referrer.id,
                    tx_type="bonus",
                    method="internal",
                    asset="USDT",
                    amount_usdt=ref_bonus.amount_usdt,
                    status="completed",
                    note=f"Referral bonus — {user.email} signed up with your code",
                ))
                db.add(Notification(
                    title="Referral bonus credited! 🎉",
                    message=f"${ref_bonus.amount_usdt:.2f} USDT added to your balance — {user.email} signed up using your referral code.",
                    target_all=False, target_user_id=referrer.id, created_by=None, read_by_user_ids=[],
                ))
                # Notify the NEW user too
                db.add(Notification(
                    title="Welcome bonus applied! 🎁",
                    message=f"You signed up with a referral code — your referrer received a ${ref_bonus.amount_usdt:.2f} USDT bonus. Keep trading to unlock more rewards!",
                    target_all=False, target_user_id=user.id, created_by=None, read_by_user_ids=[],
                ))
            else:
                # No active bonus rule but still acknowledge the referral to the new user
                db.add(Notification(
                    title="Referral code accepted! 🎁",
                    message=f"Thanks for using a referral code! Your referral has been recorded. Bonuses are credited automatically when promotions are active.",
                    target_all=False, target_user_id=user.id, created_by=None, read_by_user_ids=[],
                ))
    db.commit()
    return {"id": user.id, "email": user.email, "referral_code": user.referral_code}


def _send_login_telegram(chat_id: str, bot_token: str, email: str, ip: str, ua: str):
    """Fire-and-forget Telegram login alert."""
    import threading, requests as _req
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    text = (
        "🔐 *New Login Detected*\n\n"
        f"📧 Account: `{email}`\n"
        f"🕐 Time: {now}\n"
        f"🌐 IP: `{ip}`\n"
        f"💻 Device: `{ua[:80]}`\n\n"
        "_If this wasn't you, change your password immediately._"
    )
    def _do():
        try:
            _req.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                timeout=8,
            )
        except Exception as _e:
            logger.warning(f"Login Telegram alert failed: {_e}")
    threading.Thread(target=_do, daemon=True).start()


@router.post("/auth/forgot-password")
async def forgot_password(data: dict, db: Session = Depends(get_db)):
    """Generate a 6-digit reset code and send it to the user's email (and Telegram/WhatsApp if linked)."""
    email = (data.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    from sqlalchemy import func as _sqlfunc
    user = db.query(User).filter(_sqlfunc.lower(User.email) == email.lower()).first()
    # Always return success to avoid user enumeration
    if not user:
        return {"message": "If that email is registered, a reset code has been sent.", "dev_code": None}

    code    = "".join(random.choices(string.digits, k=6))
    expires = datetime.utcnow() + timedelta(minutes=15)

    # Store code in notification_preferences (no schema change needed)
    prefs = dict(user.notification_preferences or {})
    prefs["pw_reset_code"]    = code
    prefs["pw_reset_expires"] = expires.isoformat()
    user.notification_preferences = prefs
    db.commit()

    email_sent = False
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_key:
        try:
            import resend as _resend
            _resend.api_key = resend_key
            from_addr = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
            _resend.Emails.send({
                "from": f"FinAi <{from_addr}>",
                "to":   [email],
                "subject": "FinAi — Password Reset Code",
                "html": f"""
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0b0e11;padding:32px;border-radius:12px">
                  <div style="text-align:center;margin-bottom:24px">
                    <span style="font-size:28px;font-weight:900;color:#f0b90b">⚡ FinAi</span>
                  </div>
                  <h2 style="color:#eaecef;font-size:20px;margin:0 0 12px">Reset your password</h2>
                  <p style="color:#848e9c;font-size:14px;margin:0 0 24px">Enter this 6-digit code on the FinAi reset page:</p>
                  <div style="background:#1e2329;border:1px solid #2b3139;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px">
                    <span style="font-size:44px;font-weight:900;letter-spacing:14px;color:#f0b90b;font-family:monospace">{code}</span>
                  </div>
                  <p style="color:#4a5568;font-size:12px;text-align:center">Expires in 15 minutes. If you didn't request this, ignore this email.</p>
                </div>
                """,
            })
            email_sent = True
            logger.info(f"Password reset code sent via Resend to {email}")
        except Exception as e:
            logger.error(f"Resend reset email failed: {e}")

    # Also send via Telegram if linked
    tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    tg_chat  = user.telegram_chat_id or prefs.get("telegram_chat_id")
    if tg_token and tg_chat:
        try:
            import httpx as _hx
            async with _hx.AsyncClient(timeout=5) as c:
                await c.post(
                    f"https://api.telegram.org/bot{tg_token}/sendMessage",
                    json={
                        "chat_id": tg_chat,
                        "text": (
                            f"🔐 <b>FinAi Password Reset</b>\n\n"
                            f"Your reset code is: <code>{code}</code>\n\n"
                            f"Expires in 15 minutes. If you didn't request this, ignore this message."
                        ),
                        "parse_mode": "HTML",
                    }
                )
        except Exception as e:
            logger.error(f"Telegram reset code send failed: {e}")

    # Also send via WhatsApp if linked
    if user.whatsapp_number:
        try:
            from twilio.rest import Client as _Twilio
            _tc = _Twilio(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
            _tc.messages.create(
                from_=f"whatsapp:{os.getenv('TWILIO_WHATSAPP_NUMBER', '+14155238886')}",
                body=f"🔐 FinAi Password Reset\nYour code is: *{code}*\nExpires in 15 minutes.",
                to=f"whatsapp:{user.whatsapp_number}",
            )
        except Exception as e:
            logger.error(f"WhatsApp reset code send failed: {e}")

    logger.info(f"Password reset code for {email}: {code}")
    return {
        "message": "If that email is registered, a reset code has been sent.",
        "dev_code": code if not email_sent else None,
    }


@router.post("/auth/reset-password")
async def reset_password(data: dict, db: Session = Depends(get_db)):
    """Validate the reset code and update the user's password."""
    email    = (data.get("email") or "").strip()
    code     = (data.get("code") or "").strip()
    new_pass = (data.get("new_password") or "").strip()

    if not email or not code or not new_pass:
        raise HTTPException(status_code=400, detail="Email, code, and new_password are required")
    if len(new_pass) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    from sqlalchemy import func as _sqlfunc2
    user = db.query(User).filter(_sqlfunc2.lower(User.email) == email.lower()).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid code or email")

    prefs   = dict(user.notification_preferences or {})
    stored  = prefs.get("pw_reset_code")
    expires = prefs.get("pw_reset_expires")

    if not stored or stored != code:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    if expires and datetime.utcnow() > datetime.fromisoformat(expires):
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    # Update password
    import bcrypt as _bcrypt
    user.hashed_password = _bcrypt.hashpw(new_pass.encode(), _bcrypt.gensalt()).decode()

    # Clear the reset code
    prefs.pop("pw_reset_code", None)
    prefs.pop("pw_reset_expires", None)
    user.notification_preferences = prefs
    db.commit()

    logger.info(f"Password reset successfully for {email}")
    return {"message": "Password updated successfully. You can now log in."}


@router.post("/auth/login")
async def login(request: Request, user_data: UserCreate2, db: Session = Depends(get_db)):
    db_user = get_user_by_email(db, user_data.email)
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if not db_user.verify_password(user_data.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if db_user.is_banned:
        raise HTTPException(status_code=403, detail="Account banned. Contact support.")
    token = create_access_token({"sub": db_user.email})

    # ── Two-factor authentication check ──────────────────────────────────
    _prefs_2fa = dict(db_user.notification_preferences or {})
    if _prefs_2fa.get("tfa_enabled"):
        import random as _rnd, threading as _thr2fa, requests as _rq2fa
        from datetime import timedelta as _td2fa
        _code = str(_rnd.randint(100000, 999999))
        _expires = (datetime.utcnow() + _td2fa(minutes=10)).isoformat()
        _prefs_2fa["tfa_pending_code"]    = _code
        _prefs_2fa["tfa_code_expires"]    = _expires
        db_user.notification_preferences = _prefs_2fa
        db.commit()

        _method = _prefs_2fa.get("tfa_method", "telegram")
        _tg_tok = os.getenv("TELEGRAM_BOT_TOKEN", "")
        _tg_cid = db_user.telegram_chat_id or _prefs_2fa.get("telegram_chat_id")
        _tfa_msg = (
            f"🔐 *FinAi Login Verification*\n\n"
            f"Your 2FA code: `{_code}`\n\n"
            f"This code expires in 10 minutes.\n"
            f"_If you didn't request this, change your password immediately._"
        )

        if _method == "telegram" and _tg_tok and _tg_cid:
            def _send_2fa_tg(tok=_tg_tok, cid=_tg_cid, txt=_tfa_msg):
                try:
                    _rq2fa.post(
                        f"https://api.telegram.org/bot{tok}/sendMessage",
                        json={"chat_id": cid, "text": txt, "parse_mode": "Markdown"},
                        timeout=8,
                    )
                except Exception as _e:
                    logger.warning(f"2FA Telegram send failed: {_e}")
            _thr2fa.Thread(target=_send_2fa_tg, daemon=True).start()
        elif _method == "email":
            try:
                import resend as _resend2fa
                _resend2fa.api_key = os.getenv("RESEND_API_KEY", "")
                _from2fa = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
                _resend2fa.Emails.send({
                    "from": f"FinAi <{_from2fa}>",
                    "to": [db_user.email],
                    "subject": "FinAi — Login Verification Code",
                    "html": f"""
                    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0b0e11;padding:32px;border-radius:12px">
                      <div style="text-align:center;margin-bottom:24px">
                        <span style="font-size:28px;font-weight:900;color:#f0b90b">⚡ FinAi</span>
                      </div>
                      <h2 style="color:#eaecef;font-size:20px;margin:0 0 12px">Login Verification Code</h2>
                      <p style="color:#848e9c;font-size:14px;margin:0 0 24px">Enter this 6-digit code to complete your login:</p>
                      <div style="background:#1e2329;border:1px solid #2b3139;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px">
                        <span style="font-size:44px;font-weight:900;letter-spacing:14px;color:#f0b90b;font-family:monospace">{_code}</span>
                      </div>
                      <p style="color:#4a5568;font-size:12px;text-align:center;margin:0">This code expires in 10 minutes. If you didn't request this, change your password immediately.</p>
                    </div>
                    """,
                })
                logger.info(f"✉️  2FA code sent via email to {db_user.email}")
            except Exception as _e:
                logger.warning(f"2FA email send failed for {db_user.email}: {_e}")

        from jose import jwt as _jose_jwt
        _SECRET = os.getenv("JWT_SECRET_KEY", "super-secret-key-change-in-production")
        from datetime import timedelta as _td_partial
        _partial_token = _jose_jwt.encode(
            {"sub": db_user.email, "purpose": "2fa_pending", "exp": datetime.utcnow() + _td_partial(minutes=10)},
            _SECRET, algorithm="HS256"
        )
        return {"requires_2fa": True, "partial_token": _partial_token, "method": _method}

    # ── Login notifications (non-blocking) ──────────────────────────────
    try:
        client_ip  = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown").split(",")[0].strip()
        user_agent = request.headers.get("User-Agent", "unknown")[:120]
        now_str    = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

        # 1. In-app notification (persisted to DB)
        notif = Notification(
            title=f"New login to your account",
            message=f"A login was detected on {now_str} from IP {client_ip}. Device: {user_agent[:80]}. If this wasn't you, change your password.",
            target_all=False,
            target_user_id=db_user.id,
            created_by=None,
            read_by_user_ids=[],
        )
        db.add(notif)
        db.commit()

        # 2. Telegram DM to the user (if they have linked Telegram)
        prefs      = dict(db_user.notification_preferences or {})
        tg_token   = os.getenv("TELEGRAM_BOT_TOKEN") or prefs.get("telegram_bot_token")
        tg_chat_id = db_user.telegram_chat_id or prefs.get("telegram_chat_id")
        if tg_token and tg_chat_id:
            _send_login_telegram(tg_chat_id, tg_token, db_user.email, client_ip, user_agent)

        # 3. Notify ALL admins — in-app + Telegram (including the admin logging in)
        _admin_tg_text = (
            f"👤 *Login Alert — {'Admin' if db_user.is_admin else 'User'}*\n\n"
            f"📧 Account: `{db_user.email}`\n"
            f"🕐 Time: {now_str}\n"
            f"🌐 IP: `{client_ip}`\n"
            f"💻 Device: `{user_agent[:80]}`"
        )
        # Fire Telegram to ALL admins (env-var chat + every admin's linked chat)
        _fire_admin_telegram_alert(_admin_tg_text, db)

        # In-app notification for ALL admins (including the one logging in)
        admins = db.query(User).filter(User.is_admin == True).all()
        for _adm in admins:
            _adm_notif = Notification(
                title=f"{'Admin' if db_user.is_admin else 'User'} login: {db_user.email}",
                message=(
                    f"{db_user.email} logged in at {now_str} · "
                    f"IP: {client_ip} · Device: {user_agent[:80]}"
                ),
                target_all=False,
                target_user_id=_adm.id,
                created_by=None,
                read_by_user_ids=[],
            )
            db.add(_adm_notif)

        db.commit()  # persist admin in-app notifications

        # 4. Record last_login_at / last_login_ip on user + activity log
        db_user.last_login_at = datetime.utcnow()
        db_user.last_login_ip = client_ip
        act = UserActivityLog(
            user_id=db_user.id,
            user_email=db_user.email,
            action="login",
            ip_address=client_ip,
            user_agent=user_agent,
            details=f"Successful login · {'Admin' if db_user.is_admin else 'User'}",
        )
        db.add(act)
        db.commit()

    except Exception as _notif_err:
        logger.warning(f"Login notification skipped: {_notif_err}")

    return {"access_token": token, "token_type": "bearer"}


@router.post("/auth/verify-2fa")
async def verify_2fa(body: TFAVerifyRequest, db: Session = Depends(get_db)):
    """Verify 2FA code from Telegram/email and return full JWT."""
    from jose import jwt as _jose_jwt, JWTError as _JWTError
    _SECRET = os.getenv("JWT_SECRET_KEY", "super-secret-key-change-in-production")
    try:
        payload = _jose_jwt.decode(body.partial_token, _SECRET, algorithms=["HS256"])
        if payload.get("purpose") != "2fa_pending":
            raise HTTPException(status_code=400, detail="Invalid token purpose")
        email = payload.get("sub")
    except _JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired 2FA session. Please log in again.")

    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    prefs = dict(user.notification_preferences or {})
    pending_code = prefs.get("tfa_pending_code")
    code_expires = prefs.get("tfa_code_expires")

    if not pending_code:
        raise HTTPException(status_code=400, detail="No pending 2FA code. Please log in again.")
    if code_expires:
        from datetime import timezone as _tz
        try:
            exp_dt = datetime.fromisoformat(code_expires)
            if exp_dt < datetime.utcnow():
                raise HTTPException(status_code=400, detail="2FA code has expired. Please log in again.")
        except ValueError:
            pass
    if body.code != pending_code:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    # Clear the pending code
    prefs.pop("tfa_pending_code", None)
    prefs.pop("tfa_code_expires", None)
    user.notification_preferences = prefs
    db.commit()

    return {"access_token": create_access_token({"sub": user.email}), "token_type": "bearer"}


@router.post("/auth/resend-2fa")
async def resend_2fa(body: dict, db: Session = Depends(get_db)):
    """Generate and re-send a fresh 2FA code using the existing partial token."""
    from jose import jwt as _jose_jwt, JWTError as _JWTError
    import random as _rnd2, threading as _thr2r, requests as _rq2r
    _SECRET = os.getenv("JWT_SECRET_KEY", "super-secret-key-change-in-production")
    partial_token = body.get("partial_token", "")
    try:
        payload = _jose_jwt.decode(partial_token, _SECRET, algorithms=["HS256"])
        if payload.get("purpose") != "2fa_pending":
            raise HTTPException(status_code=400, detail="Invalid token")
        email = payload.get("sub")
    except _JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired 2FA session. Please log in again.")

    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    prefs = dict(user.notification_preferences or {})
    _code2r = str(_rnd2.randint(100000, 999999))
    from datetime import timedelta as _td2r
    prefs["tfa_pending_code"]  = _code2r
    prefs["tfa_code_expires"]  = (datetime.utcnow() + _td2r(minutes=10)).isoformat()
    user.notification_preferences = prefs
    db.commit()

    _method2r = prefs.get("tfa_method", "telegram")
    _tg_tok2r = os.getenv("TELEGRAM_BOT_TOKEN", "")
    _tg_cid2r = user.telegram_chat_id or prefs.get("telegram_chat_id")
    _msg2r = (
        f"🔐 *FinAi Login Verification*\n\n"
        f"Your new 2FA code: `{_code2r}`\n\n"
        f"This code expires in 10 minutes."
    )

    if _method2r == "telegram" and _tg_tok2r and _tg_cid2r:
        def _tg_resend(tok=_tg_tok2r, cid=_tg_cid2r, txt=_msg2r):
            try:
                _rq2r.post(
                    f"https://api.telegram.org/bot{tok}/sendMessage",
                    json={"chat_id": cid, "text": txt, "parse_mode": "Markdown"},
                    timeout=8,
                )
            except Exception as _e:
                logger.warning(f"2FA resend Telegram failed: {_e}")
        _thr2r.Thread(target=_tg_resend, daemon=True).start()
    elif _method2r == "email":
        try:
            import resend as _resend2r
            _resend2r.api_key = os.getenv("RESEND_API_KEY", "")
            _from2r = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
            _resend2r.Emails.send({
                "from": f"FinAi <{_from2r}>",
                "to": [user.email],
                "subject": "FinAi — New Login Verification Code",
                "html": f"""
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0b0e11;padding:32px;border-radius:12px">
                  <div style="text-align:center;margin-bottom:24px">
                    <span style="font-size:28px;font-weight:900;color:#f0b90b">⚡ FinAi</span>
                  </div>
                  <h2 style="color:#eaecef;font-size:20px;margin:0 0 12px">New Login Code</h2>
                  <p style="color:#848e9c;font-size:14px;margin:0 0 24px">Your previous code has been replaced. Use this new code:</p>
                  <div style="background:#1e2329;border:1px solid #2b3139;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px">
                    <span style="font-size:44px;font-weight:900;letter-spacing:14px;color:#f0b90b;font-family:monospace">{_code2r}</span>
                  </div>
                  <p style="color:#4a5568;font-size:12px;text-align:center;margin:0">Expires in 10 minutes.</p>
                </div>
                """,
            })
            logger.info(f"✉️  2FA resend code sent via email to {user.email}")
        except Exception as _e:
            logger.warning(f"2FA resend email failed for {user.email}: {_e}")

    return {"message": "New 2FA code sent", "method": _method2r}


@router.get("/users/me")
async def get_me(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_dict(user)


@router.post("/users/update-profile")
async def update_profile(data: KYCUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.profile_locked:
        raise HTTPException(status_code=403, detail="Profile is locked by admin. Contact support.")
    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None and hasattr(user, field):
            setattr(user, field, val)
    # Update full_name
    parts = [user.first_name, user.middle_name, user.last_name]
    user.full_name = " ".join(p for p in parts if p)
    db.commit()
    db.refresh(user)
    return _user_dict(user)


@router.post("/users/notification-preferences")
async def update_notification_preferences(
    data: NotificationPrefsUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Merge only the fields that were explicitly sent — never wipe unrelated keys
    prefs = dict(user.notification_preferences or {})
    update = data.model_dump(exclude_unset=True)
    prefs.update(update)
    user.notification_preferences = prefs
    db.commit()
    db.refresh(user)
    return _user_dict(user)


@router.post("/users/upload-photo")
async def upload_photo(current_user=Depends(get_current_user), db: Session = Depends(get_db), file: UploadFile = File(...)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Photo must be under 2MB")
    b64 = base64.b64encode(content).decode()
    mime = file.content_type or "image/jpeg"
    user.profile_photo = f"data:{mime};base64,{b64}"
    db.commit()
    return {"profile_photo": user.profile_photo}


@router.post("/users/send-verify-email")
async def send_verify_email(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_mail_verified:
        return {"message": "Already verified"}
    code = "".join(random.choices(string.digits, k=6))
    user.email_verify_code = code
    user.email_verify_expires = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    email_sent = False
    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key:
        try:
            import resend as _resend
            _resend.api_key = resend_key
            from_addr = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
            _resend.Emails.send({
                "from": f"FinAi <{from_addr}>",
                "to": [user.email],
                "subject": "Your FinAi Verification Code",
                "html": f"""
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0b0e11;padding:32px;border-radius:12px">
                  <div style="text-align:center;margin-bottom:24px">
                    <span style="font-size:28px;font-weight:900;color:#f0b90b">⚡ FinAi</span>
                  </div>
                  <h2 style="color:#eaecef;font-size:20px;margin:0 0 12px">Verify your email address</h2>
                  <p style="color:#848e9c;font-size:14px;margin:0 0 24px">Enter this 6-digit code to complete your email verification:</p>
                  <div style="background:#1e2329;border:1px solid #2b3139;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px">
                    <span style="font-size:44px;font-weight:900;letter-spacing:14px;color:#f0b90b;font-family:monospace">{code}</span>
                  </div>
                  <p style="color:#4a5568;font-size:12px;text-align:center;margin:0">This code expires in 15 minutes. Never share it with anyone.</p>
                </div>
                """,
            })
            email_sent = True
            logger.info(f"✉️  Verification email sent via Resend to {user.email}")
        except Exception as e:
            logger.error(f"Resend email failed for {user.email}: {e}")
            logger.warning(
                "⚠️  Email not delivered. Using onboarding@resend.dev only sends to the Resend account owner. "
                "To send to any user: verify a domain at resend.com/domains and set the "
                "RESEND_FROM_EMAIL environment variable (e.g. noreply@yourdomain.com)."
            )

    # Also send to WhatsApp if user has a verified WhatsApp number
    prefs = dict(user.notification_preferences or {})
    wa_phone = prefs.get("whatsapp_number") if prefs.get("whatsapp_verified") else None
    if wa_phone:
        try:
            from twilio.rest import Client as _Twilio
            _tc = _Twilio(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
            _from = f"whatsapp:{os.getenv('TWILIO_WHATSAPP_NUMBER', '+14155238886')}"
            _tc.messages.create(
                from_=_from,
                body=f"🔐 FinAi Email Verification\nYour code is: *{code}*\nExpires in 15 minutes.",
                to=f"whatsapp:{wa_phone}",
            )
        except Exception as e:
            logger.error(f"WhatsApp co-send failed: {e}")

    # Fallback: send via Telegram if email failed and user has Telegram linked
    if not email_sent:
        tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        tg_chat  = user.telegram_chat_id or prefs.get("telegram_chat_id")
        if tg_token and tg_chat:
            try:
                import httpx as _hx2
                import asyncio as _asyncio2
                async def _tg_send():
                    async with _hx2.AsyncClient(timeout=5) as _c:
                        await _c.post(
                            f"https://api.telegram.org/bot{tg_token}/sendMessage",
                            json={
                                "chat_id": tg_chat,
                                "text": (
                                    f"🔐 <b>FinAi Email Verification</b>\n\n"
                                    f"Your verification code is: <code>{code}</code>\n\n"
                                    f"Expires in 15 minutes."
                                ),
                                "parse_mode": "HTML",
                            }
                        )
                _asyncio2.create_task(_tg_send())
                email_sent = True  # count Telegram as delivery
                logger.info(f"Verification code sent via Telegram fallback to chat {tg_chat}")
            except Exception as _te:
                logger.error(f"Telegram fallback send failed: {_te}")

    logger.info(f"Email verify code for {user.email}: {code}")
    # Always return dev_code so developers/admins can retrieve it if email fails
    return {"message": "Verification code sent", "dev_code": code, "email_sent": email_sent}


@router.post("/users/send-whatsapp-code")
async def send_whatsapp_code(data: WhatsAppCodeRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "+14155238886")
    if not account_sid or not auth_token:
        raise HTTPException(status_code=503, detail="WhatsApp service not configured. Contact support.")
    code    = "".join(random.choices(string.digits, k=6))
    expires = datetime.utcnow() + timedelta(minutes=10)
    prefs = dict(user.notification_preferences or {})
    prefs["whatsapp_otp_code"]    = code
    prefs["whatsapp_otp_phone"]   = data.phone
    prefs["whatsapp_otp_expires"] = expires.isoformat()
    user.notification_preferences = prefs
    db.commit()
    try:
        from twilio.rest import Client as _Twilio
        _tc = _Twilio(account_sid, auth_token)
        _from = f"whatsapp:{from_number}"
        _tc.messages.create(
            from_=_from,
            body=f"🔐 FinAi WhatsApp Verification\n\nYour code is: *{code}*\n\nExpires in 10 minutes. Do not share this code.",
            to=f"whatsapp:{data.phone}",
        )
        logger.info(f"WhatsApp OTP sent to {data.phone}")
    except Exception as e:
        logger.error(f"WhatsApp OTP send failed: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to send WhatsApp message: {str(e)}")
    return {"message": "Verification code sent to WhatsApp"}


@router.post("/users/verify-whatsapp")
async def verify_whatsapp(data: WhatsAppVerifyRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    prefs       = dict(user.notification_preferences or {})
    stored_code = prefs.get("whatsapp_otp_code")
    stored_phone = prefs.get("whatsapp_otp_phone")
    expires_str = prefs.get("whatsapp_otp_expires")
    if not stored_code:
        raise HTTPException(status_code=400, detail="No pending verification. Request a code first.")
    if stored_code != data.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    if expires_str and datetime.utcnow() > datetime.fromisoformat(expires_str):
        raise HTTPException(status_code=400, detail="Code has expired. Request a new one.")
    # Uniqueness: reject if another account already has this number
    all_users_wa = db.query(User).filter(User.email != current_user["email"]).all()
    for _wu in all_users_wa:
        _wp = dict(_wu.notification_preferences or {})
        if _wp.get("whatsapp_number") == stored_phone and _wp.get("whatsapp_verified"):
            raise HTTPException(status_code=400, detail="This WhatsApp number is already linked to another FinAi account.")
    prefs["whatsapp_verified"] = True
    prefs["whatsapp_number"]   = stored_phone
    user.whatsapp_connected    = True
    for k in ["whatsapp_otp_code", "whatsapp_otp_phone", "whatsapp_otp_expires"]:
        prefs.pop(k, None)
    user.notification_preferences = prefs
    db.commit()
    return {"message": "WhatsApp verified successfully", "phone": stored_phone}


@router.get("/users/telegram-chatid")
async def get_telegram_chat_id(token: str, current_user=Depends(get_current_user)):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"https://api.telegram.org/bot{token}/getUpdates")
            result = r.json()
            if not result.get("ok"):
                raise HTTPException(status_code=400, detail="Invalid bot token or Telegram API error")
            updates = result.get("result", [])
            if not updates:
                return {"chat_id": None, "message": "No messages yet. Send /start to your bot first, then retry."}
            latest   = updates[-1]
            msg      = latest.get("message") or latest.get("channel_post") or {}
            chat     = msg.get("chat", {})
            chat_id  = str(chat.get("id", ""))
            username = chat.get("username", "")
            name     = chat.get("first_name", "")
            return {"chat_id": chat_id, "username": username, "first_name": name, "message": "Chat ID found!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/users/verify-email")
async def verify_email(data: EmailVerifyRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_mail_verified:
        return {"message": "Already verified"}
    if not user.email_verify_code or user.email_verify_code != data.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    if user.email_verify_expires and datetime.utcnow() > user.email_verify_expires:
        raise HTTPException(status_code=400, detail="Verification code expired")
    user.is_mail_verified = True
    user.email_verify_code = None
    user.email_verify_expires = None
    db.commit()
    return {"message": "Email verified successfully"}


@router.post("/users/setup-2fa")
async def setup_2fa(data: TFASetupRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Enable 2FA for the current user (stores settings in notification_preferences)."""
    if data.tfa_method not in ("telegram", "email"):
        raise HTTPException(status_code=400, detail="tfa_method must be 'telegram' or 'email'")
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    prefs = dict(user.notification_preferences or {})
    if data.tfa_method == "telegram":
        if not user.telegram_connected and not (user.telegram_chat_id or prefs.get("telegram_chat_id")):
            raise HTTPException(status_code=400, detail="Connect your Telegram account first before enabling Telegram 2FA")
    prefs["tfa_enabled"] = True
    prefs["tfa_method"]  = data.tfa_method
    if data.recovery_email:
        prefs["recovery_email"] = data.recovery_email
    user.notification_preferences = prefs
    db.commit()
    return {"ok": True, "tfa_enabled": True, "tfa_method": data.tfa_method}


@router.post("/users/disable-2fa")
async def disable_2fa(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Disable 2FA for the current user."""
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    prefs = dict(user.notification_preferences or {})
    prefs["tfa_enabled"]      = False
    prefs["tfa_pending_code"] = None
    prefs["tfa_code_expires"] = None
    user.notification_preferences = prefs
    db.commit()
    return {"ok": True, "tfa_enabled": False}


@router.post("/users/submit-kyc")
async def submit_kyc(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    required = [user.first_name, user.last_name, user.phone, user.dob, user.country]
    if not all(required):
        raise HTTPException(status_code=400, detail="Please complete your profile before submitting KYC")
    user.kyc_status = "submitted"
    user.kyc_submitted_at = datetime.utcnow()
    db.commit()
    _fire_admin_telegram_alert(
        f"📋 *KYC Submitted*\n\n"
        f"👤 User: `{user.email}`\n"
        f"🧑 Name: {user.first_name or ''} {user.last_name or ''}\n"
        f"🕐 Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"🔍 Status → *Pending Review*",
        db=db,
    )
    return {"message": "KYC submitted for review", "kyc_status": "submitted"}


@router.post("/users/exchange-connect")
async def connect_exchange(data: ExchangeConnection, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    connections = list(user.exchange_connections or [])
    # Remove existing connection for same exchange if any
    connections = [c for c in connections if c.get("exchange") != data.exchange]
    connections.append({
        "exchange": data.exchange,
        "api_key": data.api_key,
        "api_secret": data.api_secret,
        "passphrase": data.passphrase,
        "label": data.label or data.exchange,
    })
    user.exchange_connections = connections
    db.commit()
    return {"message": f"{data.exchange} connected successfully", "connections": len(connections)}


@router.delete("/users/exchange-disconnect/{exchange}")
async def disconnect_exchange(exchange: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.exchange_connections = [c for c in (user.exchange_connections or []) if c.get("exchange") != exchange]
    db.commit()
    return {"message": f"{exchange} disconnected"}


# ===================== Wallet / Transactions =====================
@router.get("/wallet/config")
async def get_wallet_config(db: Session = Depends(get_db)):
    # Always return all expected keys with defaults so frontend is never empty
    result = {
        "btc_address":          {"value": "1LA4XUiQgTELjvDiRBQ41y4T2C5Y7L5Wmt", "label": "Bitcoin (BTC) Address"},
        "eth_address":          {"value": "", "label": "Ethereum (ETH) Address"},
        "usdt_trc20":           {"value": "", "label": "USDT TRC-20 Address"},
        "bank_name":            {"value": "", "label": "Bank Name"},
        "bank_address":         {"value": "", "label": "Bank Address"},
        "bank_account":         {"value": "", "label": "Account Number / IBAN"},
        "bank_routing":         {"value": "", "label": "Routing / Sort Code"},
        "bank_swift":           {"value": "", "label": "SWIFT / BIC Code"},
        "bank_name_beneficiary":{"value": "", "label": "Beneficiary Name"},
        "deposit_note":         {"value": "", "label": "Deposit Note"},
    }
    for c in db.query(WalletConfig).all():
        result[c.key] = {"value": c.value or "", "label": c.label or c.key}
    return result


DEFAULT_VPS_PLANS = [
    {"id": 1,  "name": "DigitalOcean",     "price": 6,  "specs": "1 vCPU · 1GB RAM · 25GB SSD"},
    {"id": 2,  "name": "Linode",           "price": 5,  "specs": "1 vCPU · 1GB RAM · 25GB SSD"},
    {"id": 3,  "name": "Vultr",            "price": 6,  "specs": "1 vCPU · 1GB RAM · 25GB SSD"},
    {"id": 4,  "name": "Kamatera",         "price": 4,  "specs": "1 vCPU · 1GB RAM · 20GB SSD"},
    {"id": 5,  "name": "Liquid Web",       "price": 15, "specs": "1 vCPU · 2GB RAM · 40GB SSD"},
    {"id": 6,  "name": "Hostinger",        "price": 4,  "specs": "1 vCPU · 1GB RAM · 20GB SSD"},
    {"id": 7,  "name": "IONOS",            "price": 5,  "specs": "1 vCPU · 1GB RAM · 25GB SSD"},
    {"id": 8,  "name": "ScalaHosting",     "price": 10, "specs": "1 vCPU · 2GB RAM · 50GB SSD"},
    {"id": 9,  "name": "InMotion Hosting", "price": 20, "specs": "2 vCPU · 4GB RAM · 75GB SSD"},
    {"id": 10, "name": "A2 Hosting",       "price": 5,  "specs": "1 vCPU · 1GB RAM · 25GB SSD"},
]
DEFAULT_ASSET_PRODUCTS = [
    {"id": 1, "name": "Bitcoin (BTC)",   "price": 67432, "icon": "₿"},
    {"id": 2, "name": "Ethereum (ETH)",  "price": 3521,  "icon": "Ξ"},
    {"id": 3, "name": "BNB",             "price": 598,   "icon": "B"},
]
DEFAULT_PRICING_PLANS = [
    {"name": "Free",   "price": 0,   "period": "forever"},
    {"name": "Pro",    "price": 49,  "period": "month"},
    {"name": "Elite",  "price": 99,  "period": "month"},
    {"name": "Elite+", "price": 199, "period": "month"},
]


@router.get("/wallet/vps-plans")
async def get_vps_plans(db: Session = Depends(get_db)):
    import json as _json
    row = db.query(WalletConfig).filter(WalletConfig.key == "vps_plans").first()
    if row and row.value:
        try:
            return _json.loads(row.value)
        except Exception:
            pass
    return DEFAULT_VPS_PLANS


@router.get("/wallet/asset-products")
async def get_asset_products(db: Session = Depends(get_db)):
    import json as _json
    row = db.query(WalletConfig).filter(WalletConfig.key == "asset_products").first()
    if row and row.value:
        try:
            return _json.loads(row.value)
        except Exception:
            pass
    return DEFAULT_ASSET_PRODUCTS


class BuyAssetRequest(BaseModel):
    asset_id: int
    name: str
    price: float
    start_date: str | None = None
    end_date: str | None = None
    roi_percent: float | None = None

class RentVpsRequest(BaseModel):
    plan_id: int
    name: str
    price: float
    start_date: str | None = None
    end_date: str | None = None
    roi_percent: float | None = None


@router.post("/wallet/buy-asset")
async def buy_asset_endpoint(data: BuyAssetRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if (user.balance_usdt or 0) < data.price:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    user.balance_usdt = (user.balance_usdt or 0) - data.price
    tx = Transaction(
        user_id=user.id,
        tx_type="asset",
        method="balance",
        asset=data.name,
        amount_usdt=data.price,
        fee=0.0,
        status="pending",
        note=f"Asset purchase: {data.name}",
        start_date=data.start_date,
        end_date=data.end_date,
        roi_percent=data.roi_percent,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    _fire_admin_telegram_alert(
        f"🪙 *New Asset Purchase*\n\n"
        f"👤 User: `{user.email}`\n"
        f"💎 Asset: `{data.name}`\n"
        f"💰 Price: `${data.price:,.2f} USDT`\n"
        f"🔍 Status → *Pending Approval*",
        db=db,
    )
    return _tx_dict(tx)


@router.post("/wallet/rent-vps")
async def rent_vps_endpoint(data: RentVpsRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if (user.balance_usdt or 0) < data.price:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    user.balance_usdt = (user.balance_usdt or 0) - data.price
    tx = Transaction(
        user_id=user.id,
        tx_type="vps",
        method="balance",
        asset="USDT",
        amount_usdt=data.price,
        fee=0.0,
        status="pending",
        note=f"VPS rental: {data.name}",
        start_date=data.start_date,
        end_date=data.end_date,
        roi_percent=data.roi_percent,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    _fire_admin_telegram_alert(
        f"🖥️ *New VPS Rental*\n\n"
        f"👤 User: `{user.email}`\n"
        f"🖥️ Plan: `{data.name}`\n"
        f"💰 Price: `${data.price:,.2f} USDT/mo`\n"
        f"🔍 Status → *Pending Approval*",
        db=db,
    )
    return _tx_dict(tx)


@router.post("/wallet/close-purchase/{tx_id}")
async def close_purchase(tx_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id,
        Transaction.user_id == user.id,
        Transaction.tx_type.in_(["vps", "asset"]),
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if tx.status == "cancelled":
        raise HTTPException(status_code=400, detail="Already cancelled")
    tx.status = "cancelled"
    tx.note = (tx.note or "") + " | Closed by user"
    db.commit()
    db.refresh(tx)
    return _tx_dict(tx)


@router.get("/wallet/pricing-plans")
async def get_pricing_plans(db: Session = Depends(get_db)):
    import json as _json
    row = db.query(WalletConfig).filter(WalletConfig.key == "pricing_plans").first()
    if row and row.value:
        try:
            return _json.loads(row.value)
        except Exception:
            pass
    return DEFAULT_PRICING_PLANS


@router.post("/wallet/deposit")
async def request_deposit(data: DepositRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    tx = Transaction(
        user_id=user.id,
        tx_type="deposit",
        method=data.method,
        asset=data.asset,
        amount_usdt=data.amount_usdt,
        amount_asset=data.amount_usdt,  # simplified, admin approves exact amount
        fee=0.0,
        status="pending",
        tx_hash=data.tx_hash,
        wallet_address=data.wallet_address,
        bank_ref=data.bank_ref,
        note=data.note,
        payment_proof=data.payment_proof,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    _fire_admin_telegram_alert(
        f"💵 *New Deposit Request*\n\n"
        f"👤 User: `{user.email}`\n"
        f"💰 Amount: `${data.amount_usdt:,.2f} USDT` via {data.method}\n"
        f"🪙 Asset: {data.asset or '—'}\n"
        f"🕐 Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"🔍 Status → *Pending Approval*",
        db=db,
    )
    return _tx_dict(tx)


@router.post("/wallet/withdraw")
async def request_withdrawal(data: WithdrawRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    import bcrypt as _bcrypt
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.balance_usdt < data.amount_usdt:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    # Verify transfer PIN if user has one set
    if user.transfer_pin:
        if not data.transfer_pin:
            raise HTTPException(status_code=400, detail="Transfer PIN is required")
        if not _bcrypt.checkpw(data.transfer_pin.encode(), user.transfer_pin.encode()):
            raise HTTPException(status_code=400, detail="Invalid transfer PIN")
    # Hold balance pending admin approval
    user.balance_usdt -= data.amount_usdt
    tx = Transaction(
        user_id=user.id,
        tx_type="withdrawal",
        method=data.method,
        asset=data.asset,
        amount_usdt=data.amount_usdt,
        fee=0.0,
        status="pending",
        wallet_address=data.wallet_address,
        bank_ref=data.bank_ref,
        note=data.note,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    _fire_admin_telegram_alert(
        f"💸 *New Withdrawal Request*\n\n"
        f"👤 User: `{user.email}`\n"
        f"💰 Amount: `${data.amount_usdt:,.2f} USDT` via {data.method}\n"
        f"🪙 Asset: {data.asset or '—'}\n"
        f"🏦 Address: `{data.wallet_address or data.bank_ref or '—'}`\n"
        f"🕐 Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"🔍 Status → *Pending Approval*",
        db=db,
    )
    return _tx_dict(tx)


@router.delete("/wallet/deposits/{tx_id}")
async def cancel_deposit(tx_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id,
        Transaction.user_id == user.id,
        Transaction.tx_type == "deposit",
        Transaction.status == "pending",
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Pending deposit not found")
    tx.status = "cancelled"
    db.commit()
    return {"ok": True}


@router.get("/users/withdrawal-methods")
async def get_withdrawal_methods(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    import json as _json
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        return _json.loads(user.withdrawal_methods or "[]")
    except Exception:
        return []


@router.post("/users/withdrawal-methods")
async def save_withdrawal_methods(data: WithdrawalMethodsUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    import json as _json
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.withdrawal_methods = _json.dumps(data.methods)
    db.commit()
    return {"ok": True}


@router.post("/wallet/p2p")
async def p2p_send(data: P2PRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    sender = db.query(User).filter(User.email == current_user["email"]).first()
    recipient = db.query(User).filter(User.email == data.recipient_email).first()
    if not sender or not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    if sender.id == recipient.id:
        raise HTTPException(status_code=400, detail="Cannot send to yourself")
    if sender.balance_usdt < data.amount_usdt:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    sender.balance_usdt -= data.amount_usdt
    recipient.balance_usdt += data.amount_usdt
    # Record both sides
    tx_send = Transaction(user_id=sender.id, tx_type="p2p_send", method="internal", asset="USDT",
                          amount_usdt=data.amount_usdt, fee=0.0, status="completed",
                          recipient_user_id=recipient.id, note=data.note)
    tx_recv = Transaction(user_id=recipient.id, tx_type="p2p_receive", method="internal", asset="USDT",
                          amount_usdt=data.amount_usdt, fee=0.0, status="completed",
                          recipient_user_id=sender.id, note=data.note)
    db.add(tx_send); db.add(tx_recv)
    db.commit()
    db.refresh(tx_send)
    return {"message": f"${data.amount_usdt:.2f} USDT sent to {data.recipient_email}", "transaction": _tx_dict(tx_send)}


@router.get("/wallet/transactions")
async def get_my_transactions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    txs = db.query(Transaction).filter(Transaction.user_id == user.id).order_by(Transaction.created_at.desc()).limit(100).all()
    return [_tx_dict(t) for t in txs]


# ===================== API Keys =====================
def _subscription_limits(subscription: str) -> dict:
    """Return {api_keys, bots, event_bots} limits for a subscription tier.
    event_bots = number of EventBot (AI event-driven) bots allowed.
    """
    sub = (subscription or "free").lower()
    tiers = {
        "free":       {"api_keys": 1,    "bots": 1,    "event_bots": 0},
        "pro":        {"api_keys": 10,   "bots": 10,   "event_bots": 4},
        "elite":      {"api_keys": 20,   "bots": 20,   "event_bots": 8},
        "elite+":     {"api_keys": 40,   "bots": 40,   "event_bots": 15},
        "elite plus": {"api_keys": 40,   "bots": 40,   "event_bots": 15},
        "custom":     {"api_keys": 9999, "bots": 9999, "event_bots": 50},
    }
    return tiers.get(sub, {"api_keys": 1, "bots": 1, "event_bots": 0})


@router.get("/subscription/limits")
async def get_subscription_limits(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    limits = _subscription_limits(user.subscription or "free")
    active_keys = db.query(APIKey).filter(APIKey.user_id == user.id, APIKey.is_active == True).count()
    return {
        "subscription": user.subscription or "free",
        "limits": limits,
        "used": {"api_keys": active_keys},
    }


@router.post("/api-keys")
async def create_new_api_key(key_name: str, purpose: str = "bot", expires_days: int = 365,
                              db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_mail_verified:
        raise HTTPException(status_code=403, detail="Email verification required to create API keys")
    if user.account_tier < 1:
        raise HTTPException(status_code=403, detail="Account verification (KYC tier 1) required to create API keys")

    # Enforce subscription limits
    limits = _subscription_limits(user.subscription or "free")
    active_keys = db.query(APIKey).filter(APIKey.user_id == user.id, APIKey.is_active == True).count()
    if active_keys >= limits["api_keys"]:
        raise HTTPException(
            status_code=403,
            detail=f"API key limit reached for your plan ({limits['api_keys']} max). Upgrade to create more.",
        )

    new_key = create_api_key(db, user.id, key_name, expires_days)
    if hasattr(new_key, 'purpose'):
        new_key.purpose = purpose
        db.commit()
    return {
        "message": "API Key created successfully",
        "key_name": key_name,
        "api_key": new_key.api_key,
        "warning": "Save this key now — it will not be shown again.",
    }


@router.get("/api-keys")
async def list_api_keys(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    keys = db.query(APIKey).filter(APIKey.user_id == user.id).all()
    return [{"id": k.id, "key_name": k.key_name, "purpose": getattr(k, "purpose", "bot"),
             "created_at": k.created_at, "expires_at": k.expires_at,
             "is_active": k.is_active, "last_used_at": k.last_used_at} for k in keys]


@router.delete("/api-keys/{key_id}")
async def revoke_key(key_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    key = db.query(APIKey).filter(APIKey.id == key_id, APIKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    db.commit()
    return {"message": "API key revoked"}


# ===================== Admin Routes =====================
@router.get("/admin/users", dependencies=[Depends(require_admin)])
async def admin_get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_dict(u) for u in users]


@router.post("/admin/update-user", dependencies=[Depends(require_admin)])
async def admin_update_user(data: AdminUpdateUser, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_tier = user.account_tier or 0
    old_kyc  = user.kyc_status or ""
    for field, val in data.model_dump(exclude_unset=True).items():
        if field == "user_id":
            continue
        if val is not None and hasattr(user, field):
            setattr(user, field, val)
    new_tier = user.account_tier or 0
    new_kyc  = user.kyc_status or ""

    _deferred_notifs = []  # (title, message) pairs to fire after commit

    # Auto-trigger tier-achievement bonuses when tier increases
    if new_tier > old_tier:
        from src.database.models import Bonus as _Bonus
        tier_bonuses = db.query(_Bonus).filter(
            _Bonus.bonus_type == "tier_achievement",
            _Bonus.tier_required == new_tier,
            _Bonus.active == True,
        ).all()
        for _tb in tier_bonuses:
            # Don't double-grant: check if user already got this bonus
            _already = db.query(Transaction).filter(
                Transaction.user_id == user.id,
                Transaction.tx_type == "bonus",
                Transaction.note.like(f"%tier_bonus_{_tb.id}%"),
            ).first()
            if not _already:
                user.balance_usdt = (user.balance_usdt or 0) + _tb.amount_usdt
                _tb.granted_count = (_tb.granted_count or 0) + 1
                db.add(Transaction(
                    user_id=user.id,
                    tx_type="bonus",
                    method="internal",
                    asset="USDT",
                    amount_usdt=_tb.amount_usdt,
                    status="completed",
                    note=f"Tier {new_tier} achievement bonus — tier_bonus_{_tb.id}",
                ))
                _deferred_notifs.append((
                    f"🎉 Tier {new_tier} Achievement Bonus!",
                    f"Congratulations on reaching Tier {new_tier}! ${_tb.amount_usdt:.2f} USDT bonus has been added to your balance.",
                ))
        # Notify tier upgrade even without bonus
        if not _deferred_notifs:
            _tier_labels = {1: "Tier 1", 2: "Tier 2", 3: "Tier 3 — Priority"}
            _deferred_notifs.append((
                f"🏅 Account Upgraded to {_tier_labels.get(new_tier, f'Tier {new_tier}')}",
                f"Your account has been upgraded to Tier {new_tier}. You now have access to higher limits and more features.",
            ))

    # KYC status change notification
    if new_kyc != old_kyc and new_kyc:
        if new_kyc == "approved":
            _deferred_notifs.append((
                "✅ KYC Verification Approved",
                "Your identity verification has been approved. Your account is now verified and you have full access to all features.",
            ))
        elif new_kyc == "rejected":
            _deferred_notifs.append((
                "❌ KYC Verification Rejected",
                "Your identity verification was not approved. Please contact support or resubmit with clearer documents.",
            ))

    db.commit()
    db.refresh(user)

    # Fire all deferred notifications (in-app + external channels)
    for _t, _m in _deferred_notifs:
        try:
            _notify_user(user, _t, _m, db)
        except Exception as _ne:
            logger.warning(f"Deferred notification failed: {_ne}")

    return _user_dict(user)


@router.post("/admin/delete-user", dependencies=[Depends(require_admin)])
async def admin_delete_user(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


@router.get("/admin/transactions", dependencies=[Depends(require_admin)])
async def get_all_transactions(db: Session = Depends(get_db)):
    txs = db.query(Transaction).order_by(Transaction.created_at.desc()).limit(500).all()
    result = []
    for t in txs:
        d = _tx_dict(t)
        d["user_email"] = t.user.email if t.user else None
        result.append(d)
    return result


@router.post("/admin/approve-transaction", dependencies=[Depends(require_admin)])
async def approve_transaction(data: ApproveTransaction, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == int(data.transaction_id)).first()
    if not tx:
        # fallback to UserMoney
        um = db.query(UserMoney).filter(UserMoney.id == int(data.transaction_id)).first()
        if um:
            um.status = "approved"
            um.user.balance_usdt = (um.user.balance_usdt or 0) + um.amount
            db.commit()
            return {"status": "approved"}
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.status = "approved"
    if data.tx_hash:
        tx.tx_hash = data.tx_hash
    user = db.query(User).filter(User.id == tx.user_id).first()
    if tx.tx_type == "deposit":
        if user:
            user.balance_usdt = (user.balance_usdt or 0) + tx.amount_usdt
    db.commit()
    # Notify user about approval
    if user:
        import asyncio as _aio
        tx_label = tx.tx_type.replace("_", " ").title()
        _notif_title = f"✅ {tx_label} Approved"
        _notif_msg = (
            f"Your {tx.tx_type.replace('_', ' ')} of ${tx.amount_usdt:.2f} USDT "
            f"has been approved and your balance has been updated."
        )
        try:
            _notify_user(user, _notif_title, _notif_msg, db)
        except Exception as _ne:
            logger.warning(f"Approval notification failed: {_ne}")
    return {"status": "approved", "transaction_id": data.transaction_id}


@router.post("/admin/reject-transaction", dependencies=[Depends(require_admin)])
async def reject_transaction(data: RejectTransaction, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == int(data.transaction_id)).first()
    if not tx:
        um = db.query(UserMoney).filter(UserMoney.id == int(data.transaction_id)).first()
        if um:
            um.status = "rejected"
            db.commit()
            return {"status": "rejected"}
        raise HTTPException(status_code=404, detail="Transaction not found")
    user = db.query(User).filter(User.id == tx.user_id).first()
    if tx.tx_type in ("withdrawal", "vps", "asset") and tx.status == "pending":
        # Refund the held amount
        if user:
            user.balance_usdt = (user.balance_usdt or 0) + tx.amount_usdt
    tx.status = "rejected"
    db.commit()
    # Notify user about rejection
    if user:
        import asyncio as _aio
        tx_label = tx.tx_type.replace("_", " ").title()
        _notif_title = f"❌ {tx_label} Rejected"
        _notif_msg = (
            f"Your {tx.tx_type.replace('_', ' ')} of ${tx.amount_usdt:.2f} USDT "
            f"has been rejected. "
            + ("Your funds have been returned to your balance." if tx.tx_type == "withdrawal" else
               "Please contact support if you believe this is an error.")
        )
        try:
            _notify_user(user, _notif_title, _notif_msg, db)
        except Exception as _ne:
            logger.warning(f"Rejection notification failed: {_ne}")
    return {"status": "rejected", "transaction_id": data.transaction_id}


@router.get("/admin/wallet-config", dependencies=[Depends(require_admin)])
async def admin_get_wallet_config(db: Session = Depends(get_db)):
    configs = db.query(WalletConfig).all()
    return [{"key": c.key, "value": c.value, "label": c.label, "updated_at": c.updated_at} for c in configs]


@router.post("/admin/wallet-config", dependencies=[Depends(require_admin)])
async def admin_update_wallet_config(data: WalletConfigUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(WalletConfig).filter(WalletConfig.key == data.key).first()
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    if config:
        config.value = data.value
        if data.label:
            config.label = data.label
        config.updated_by = uid
    else:
        config = WalletConfig(key=data.key, value=data.value, label=data.label, updated_by=uid)
        db.add(config)
    db.commit()
    return {"key": data.key, "value": data.value, "label": data.label}


@router.get("/admin/api-key-users", dependencies=[Depends(require_admin)])
async def admin_get_api_key_users(db: Session = Depends(get_db)):
    keys = db.query(APIKey).filter(APIKey.is_active == True).all()
    return [{
        "id": k.id,
        "user_email": k.user.email if k.user else None,
        "user_id": k.user_id,
        "key_name": k.key_name,
        "purpose": getattr(k, "purpose", "bot"),
        "created_at": k.created_at,
        "last_used_at": k.last_used_at,
        "expires_at": k.expires_at,
    } for k in keys]


@router.post("/admin/notifications", dependencies=[Depends(require_admin)])
async def push_notification(data: PushNotification, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    notif = Notification(title=data.title, message=data.message, target_all=data.target_all,
                         target_user_id=data.target_user_id if not data.target_all else None,
                         read_by_user_ids=[], created_by=uid)
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Deliver externally (Telegram / WhatsApp / Resend email) to targeted users
    # We skip the already-persisted in-app record and just fire external channels
    import threading as _pt
    def _deliver_external():
        try:
            from src.database.session import SessionLocal as _SL
            _db2 = _SL()
            try:
                if data.target_all:
                    targets = _db2.query(User).filter(User.is_active == True).all() if hasattr(User, "is_active") else _db2.query(User).all()
                else:
                    t = _db2.query(User).filter(User.id == data.target_user_id).first()
                    targets = [t] if t else []
                import asyncio as _aio
                loop = _aio.new_event_loop()
                for u in targets:
                    try:
                        loop.run_until_complete(_notify_external_only(u, data.title, data.message))
                    except Exception:
                        pass
                loop.close()
            finally:
                _db2.close()
        except Exception as _ex:
            logger.warning(f"Admin push external delivery failed: {_ex}")
    _pt.Thread(target=_deliver_external, daemon=True).start()

    return {"id": notif.id, "title": notif.title, "message": notif.message,
            "target_all": notif.target_all, "target_user_id": notif.target_user_id,
            "created_at": notif.created_at.isoformat()}


@router.get("/admin/notifications", dependencies=[Depends(require_admin)])
async def get_all_notifications(db: Session = Depends(get_db)):
    notifs = db.query(Notification).order_by(Notification.created_at.desc()).limit(100).all()
    return [{"id": n.id, "title": n.title, "message": n.message, "target_all": n.target_all,
             "target_user_id": n.target_user_id, "created_at": n.created_at.isoformat()} for n in notifs]


@router.get("/admin/support-tickets", dependencies=[Depends(require_admin)])
async def admin_get_tickets(db: Session = Depends(get_db)):
    tickets = db.query(SupportTicket).order_by(SupportTicket.updated_at.desc()).limit(200).all()
    return [{
        "id": t.id, "subject": t.subject, "status": t.status, "priority": t.priority,
        "user_email": t.user.email if t.user else None, "user_id": t.user_id,
        "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat(),
        "message_count": len(t.messages),
    } for t in tickets]


@router.get("/admin/support-tickets/{ticket_id}", dependencies=[Depends(require_admin)])
async def admin_get_ticket_messages(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {
        "id": ticket.id, "subject": ticket.subject, "status": ticket.status,
        "priority": ticket.priority, "user_email": ticket.user.email if ticket.user else None,
        "messages": [{"id": m.id, "message": m.message, "is_admin": m.is_admin,
                      "sender_email": m.sender.email if m.sender else None,
                      "created_at": m.created_at.isoformat()} for m in ticket.messages]
    }


@router.post("/admin/support-reply", dependencies=[Depends(require_admin)])
async def admin_reply_ticket(data: SupportReply, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == data.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    msg = SupportMessage(ticket_id=ticket.id, sender_id=uid, message=data.message, is_admin=True)
    ticket.status = "in_progress"
    db.add(msg)
    db.commit()
    return {"message": "Reply sent", "ticket_id": ticket.id}


@router.post("/admin/support-tickets/{ticket_id}/status", dependencies=[Depends(require_admin)])
async def admin_update_ticket_status(ticket_id: int, new_status: str, db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.status = new_status
    db.commit()
    return {"status": new_status}


@router.get("/admin/health")
async def admin_health_check(db: Session = Depends(get_db)):
    import time
    checks = {}
    # DB
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        checks["database"] = {"status": "healthy", "latency_ms": 0}
    except Exception as e:
        checks["database"] = {"status": "error", "error": str(e)}
    # Celery
    try:
        from src.celery_app import celery_app as ca
        i = ca.control.inspect(timeout=1)
        stats = i.ping() or {}
        checks["celery"] = {"status": "healthy" if stats else "degraded", "workers": len(stats)}
    except Exception as e:
        checks["celery"] = {"status": "error", "error": str(e)}
    # External services
    import httpx
    for name, url in [("coingecko", "https://api.coingecko.com/api/v3/ping"),
                      ("binance", "https://api.binance.com/api/v3/ping")]:
        try:
            t0 = time.time()
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(url)
            checks[name] = {"status": "healthy" if r.status_code == 200 else "degraded",
                            "latency_ms": round((time.time() - t0) * 1000)}
        except Exception as e:
            checks[name] = {"status": "error", "error": str(e)[:100]}
    overall = "healthy" if all(c["status"] == "healthy" for c in checks.values()) else "degraded"
    return {"overall": overall, "checks": checks, "timestamp": datetime.utcnow().isoformat()}


# ===================== Notification Delivery Helper =====================
def _notify_user(user: "User", title: str, message: str, db: "Session") -> None:
    """
    Persist an in-app Notification for `user` (synchronously, using the caller's
    DB session) and then fire external delivery channels in background threads.
    Safe to call from both sync and async FastAPI routes — NO event-loop tricks needed.
    """
    import threading as _thr

    # 1. Persist in-app notification immediately (same session, caller commits or we commit here)
    try:
        db.add(Notification(title=title, message=message, target_all=False,
                            target_user_id=user.id, created_by=None, read_by_user_ids=[]))
        db.commit()
    except Exception as _dbe:
        logger.warning(f"_notify_user DB write failed for user {user.id}: {_dbe}")
        try:
            db.rollback()
        except Exception:
            pass

    # Snapshot values needed in threads (avoid holding ORM object refs across threads)
    _uid         = user.id
    _email_addr  = user.email
    _tg_chat     = user.telegram_chat_id or (dict(user.notification_preferences or {}).get("telegram_chat_id"))
    _wa_phone    = getattr(user, "whatsapp_number", None) or (dict(user.notification_preferences or {}).get("whatsapp_number"))
    _wa_verified = getattr(user, "whatsapp_connected", False) or (dict(user.notification_preferences or {}).get("whatsapp_verified"))

    prefs       = dict(user.notification_preferences or {})
    tg_token    = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    wa_sid      = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    wa_token    = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    wa_from_num = os.getenv("TWILIO_WHATSAPP_NUMBER", "+14155238886").strip()
    resend_key  = os.getenv("RESEND_API_KEY", "").strip()
    from_email  = os.getenv("RESEND_FROM_EMAIL", "noreply@finai.com").strip()
    full_msg    = f"*{title}*\n\n{message}"

    # 2. Telegram (user's own linked chat)
    if tg_token and _tg_chat:
        def _tg(tok=tg_token, cid=_tg_chat, txt=full_msg, uid=_uid):
            try:
                import requests as _rq
                _rq.post(
                    f"https://api.telegram.org/bot{tok}/sendMessage",
                    json={"chat_id": cid, "text": txt, "parse_mode": "Markdown"},
                    timeout=8,
                )
            except Exception as _e:
                logger.warning(f"Telegram delivery to user {uid} failed: {_e}")
        _thr.Thread(target=_tg, daemon=True).start()

    # 3. WhatsApp (Twilio) — if user has linked number
    if wa_sid and wa_token and _wa_phone and _wa_verified:
        def _wa(sid=wa_sid, tok=wa_token, frm=wa_from_num, to=_wa_phone, txt=full_msg, uid=_uid):
            try:
                import requests as _rq
                _rq.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                    auth=(sid, tok),
                    data={"From": f"whatsapp:{frm}", "To": f"whatsapp:{to}", "Body": txt},
                    timeout=8,
                )
            except Exception as _e:
                logger.warning(f"WhatsApp delivery to user {uid} failed: {_e}")
        _thr.Thread(target=_wa, daemon=True).start()

    # 4. Resend email
    if resend_key and _email_addr:
        _html_body = (
            f"<div style='font-family:Arial,sans-serif;max-width:520px;margin:0 auto;"
            f"background:#0b0e11;padding:28px;border-radius:12px;color:#eaecef'>"
            f"<div style='margin-bottom:20px'><span style='font-size:22px;font-weight:900;color:#f0b90b'>⚡ FinAi</span></div>"
            f"<h2 style='color:#eaecef;font-size:17px;margin:0 0 12px'>{title}</h2>"
            f"<div style='background:#1e2329;border:1px solid #2b3139;border-radius:10px;padding:16px;margin-bottom:16px'>"
            f"<p style='color:#848e9c;font-size:13px;margin:0;line-height:1.6'>{message.replace(chr(10), '<br>')}</p>"
            f"</div>"
            f"<p style='color:#4a5568;font-size:11px;margin:0'>This is an automated notification from FinAi.</p>"
            f"</div>"
        )
        def _email(key=resend_key, frm=from_email, to=_email_addr, subj=title, html=_html_body, uid=_uid):
            try:
                import resend as _resend
                _resend.api_key = key
                _resend.Emails.send({"from": f"FinAi <{frm}>", "to": to, "subject": subj, "html": html})
            except Exception as _e:
                logger.warning(f"Resend delivery to user {uid} failed: {_e}")
        _thr.Thread(target=_email, daemon=True).start()


async def _notify_external_only(user: "User", title: str, message: str) -> None:
    """Fire external channels only (no DB write). Runs in a plain thread event loop."""
    prefs       = dict(user.notification_preferences or {})
    tg_token    = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    wa_sid      = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    wa_token    = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    wa_from_num = os.getenv("TWILIO_WHATSAPP_NUMBER", "+14155238886").strip()
    resend_key  = os.getenv("RESEND_API_KEY", "").strip()
    from_email  = os.getenv("RESEND_FROM_EMAIL", "noreply@finai.com").strip()
    full_msg    = f"{title}\n\n{message}"

    tg_chat = getattr(user, "telegram_chat_id", None) or prefs.get("telegram_chat_id")
    if tg_token and tg_chat:
        try:
            import httpx as _hx
            _hx.post(
                f"https://api.telegram.org/bot{tg_token}/sendMessage",
                json={"chat_id": tg_chat, "text": full_msg, "parse_mode": "Markdown"},
                timeout=6,
            )
        except Exception as _e:
            logger.warning(f"Telegram ext delivery to user {user.id}: {_e}")

    wa_phone    = getattr(user, "whatsapp_number", None) or prefs.get("whatsapp_number")
    wa_verified = getattr(user, "whatsapp_connected", False) or prefs.get("whatsapp_verified")
    if wa_sid and wa_token and wa_phone and wa_verified:
        try:
            import httpx as _hx
            _hx.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{wa_sid}/Messages.json",
                auth=(wa_sid, wa_token),
                data={"From": f"whatsapp:{wa_from_num}", "To": f"whatsapp:{wa_phone}",
                      "Body": full_msg},
                timeout=6,
            )
        except Exception as _e:
            logger.warning(f"WhatsApp ext delivery to user {user.id}: {_e}")

    if resend_key and getattr(user, "email", None):
        try:
            import resend as _resend
            _resend.api_key = resend_key
            _resend.Emails.send({
                "from": from_email,
                "to": user.email,
                "subject": title,
                "html": f"<p>{message.replace(chr(10), '<br>')}</p>",
            })
        except Exception as _e:
            logger.warning(f"Resend ext delivery to user {user.id}: {_e}")


# ===================== Notifications =====================
@router.get("/notifications")
async def get_user_notifications(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    notifs = (db.query(Notification)
               .filter((Notification.target_all == True) | (Notification.target_user_id == uid))
               .order_by(Notification.created_at.desc()).limit(50).all())
    return [{"id": n.id, "title": n.title, "message": n.message,
             "is_read": uid in (n.read_by_user_ids or []),
             "target_all": n.target_all, "created_at": n.created_at.isoformat()} for n in notifs]


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Not found")
    read_by = list(notif.read_by_user_ids or [])
    if uid not in read_by:
        read_by.append(uid)
        notif.read_by_user_ids = read_by
        db.commit()
    return {"status": "read"}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    notifs = (db.query(Notification)
               .filter((Notification.target_all == True) | (Notification.target_user_id == uid)).all())
    for n in notifs:
        read_by = list(n.read_by_user_ids or [])
        if uid not in read_by:
            read_by.append(uid)
            n.read_by_user_ids = read_by
    db.commit()
    return {"status": "all_read"}


@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.target_user_id == uid,
        Notification.target_all == False,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Not found or cannot delete")
    db.delete(notif)
    db.commit()
    return {"status": "deleted"}


@router.get("/admin/user-activity", dependencies=[Depends(require_admin)])
async def admin_get_user_activity(limit: int = 200, db: Session = Depends(get_db)):
    logs = (db.query(UserActivityLog)
              .order_by(UserActivityLog.created_at.desc())
              .limit(limit).all())
    return [{
        "id": l.id,
        "user_id": l.user_id,
        "user_email": l.user_email,
        "action": l.action,
        "ip_address": l.ip_address,
        "user_agent": l.user_agent,
        "details": l.details,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in logs]


@router.delete("/admin/user-activity/clear", dependencies=[Depends(require_admin)])
async def admin_clear_user_activity(db: Session = Depends(get_db)):
    deleted = db.query(UserActivityLog).delete()
    db.commit()
    _fire_admin_telegram_alert(
        f"🗑️ *Activity Log Cleared*\n\nAll {deleted} activity log entries have been cleared by an admin.",
        db,
    )
    return {"status": "cleared", "deleted": deleted}


@router.delete("/notifications/clear-read")
async def clear_read_notifications(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    # Delete user-specific notifications that are read
    user_notifs = db.query(Notification).filter(
        Notification.target_user_id == uid,
        Notification.target_all == False,
    ).all()
    deleted = 0
    for n in user_notifs:
        if uid in (n.read_by_user_ids or []):
            db.delete(n)
            deleted += 1
    db.commit()
    return {"status": "cleared", "deleted": deleted}


# ===================== Support Desk =====================
@router.post("/support/tickets")
async def create_ticket(data: SupportTicketCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    ticket = SupportTicket(user_id=uid, subject=data.subject, status="open", priority=data.priority)
    db.add(ticket)
    db.flush()
    msg = SupportMessage(ticket_id=ticket.id, sender_id=uid, message=data.message, is_admin=False)
    db.add(msg)
    db.commit()
    db.refresh(ticket)
    _fire_admin_telegram_alert(
        f"🎫 *New Support Ticket*\n\n"
        f"👤 User ID: `{uid}`\n"
        f"📌 Subject: {data.subject[:80]}\n"
        f"🔥 Priority: {data.priority or 'normal'}\n"
        f"🕐 Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"💬 Message: {data.message[:120]}{'…' if len(data.message) > 120 else ''}",
        db=db,
    )
    return {"id": ticket.id, "subject": ticket.subject, "status": ticket.status,
            "created_at": ticket.created_at.isoformat()}


@router.get("/support/tickets")
async def get_my_tickets(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    tickets = db.query(SupportTicket).filter(SupportTicket.user_id == uid).order_by(SupportTicket.updated_at.desc()).all()
    return [{"id": t.id, "subject": t.subject, "status": t.status, "priority": t.priority,
             "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat(),
             "message_count": len(t.messages)} for t in tickets]


@router.get("/support/tickets/{ticket_id}")
async def get_ticket_messages(ticket_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    is_admin = current_user.get("is_admin", False) if isinstance(current_user, dict) else False
    if ticket.user_id != uid and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": ticket.id, "subject": ticket.subject, "status": ticket.status, "priority": ticket.priority,
        "messages": [{"id": m.id, "message": m.message, "is_admin": m.is_admin,
                      "created_at": m.created_at.isoformat()} for m in ticket.messages]
    }


@router.post("/support/tickets/{ticket_id}/reply")
async def reply_to_ticket(ticket_id: int, data: SupportReply, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket or ticket.user_id != uid:
        raise HTTPException(status_code=404, detail="Ticket not found")
    msg = SupportMessage(ticket_id=ticket.id, sender_id=uid, message=data.message, is_admin=False)
    db.add(msg)
    db.commit()
    return {"message": "Reply sent"}


# ===================== Core Features =====================
@router.get("/events")
async def get_recent_events(limit: int = 20, db: Session = Depends(get_db)):
    events = db.query(Event).order_by(Event.created_at.desc()).limit(limit).all()
    return [e.to_dict() for e in events]


@router.get("/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "healthy" if db_ok else "degraded", "db": db_ok,
            "timestamp": datetime.utcnow().isoformat()}


# ===================== Security Routes =====================

@router.post("/users/change-password")
async def change_password(data: ChangePasswordRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.verify_password(data.current_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    user.hashed_password = User.hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


class UpdateLeverageRequest(BaseModel):
    trade_leverage: float = 1.0
    bot_leverage: float = 1.0

@router.post("/users/update-leverage")
async def update_leverage(data: UpdateLeverageRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.trade_leverage = max(1.0, min(200.0, data.trade_leverage))
    user.bot_leverage   = max(1.0, min(200.0, data.bot_leverage))
    db.commit()
    db.refresh(user)
    return _user_dict(user)


@router.post("/users/set-transfer-pin")
async def set_transfer_pin(data: SetTransferPinRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not data.pin.isdigit() or len(data.pin) < 4 or len(data.pin) > 6:
        raise HTTPException(status_code=400, detail="PIN must be 4–6 digits")
    import bcrypt as _bcrypt
    user.transfer_pin = _bcrypt.hashpw(data.pin.encode(), _bcrypt.gensalt()).decode()
    db.commit()
    return {"message": "Transfer PIN set successfully"}


@router.post("/users/request-delete")
async def request_account_deletion(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if getattr(user, "pending_deletion", False):
        return {"message": "Deletion request already submitted. Admin will process it soon."}
    # Create support ticket so admin sees the request
    ticket = SupportTicket(user_id=user.id, subject="Account Deletion Request", status="open", priority="high")
    db.add(ticket)
    db.flush()
    msg = SupportMessage(
        ticket_id=ticket.id, sender_id=user.id,
        message="User has requested permanent account deletion. Please review and process within 24–48 hours.",
        is_admin=False
    )
    db.add(msg)
    try:
        user.pending_deletion = True
    except Exception:
        pass
    db.commit()
    return {"message": "Account deletion request submitted. Admin will review within 24–48 hours."}


@router.post("/users/save-webhook")
async def save_webhook_settings(data: WebhookSettingsRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    prefs = dict(user.notification_preferences or {})
    if data.telegram_bot_token is not None:
        prefs["telegram_bot_token"] = data.telegram_bot_token
    if data.telegram_chat_id is not None:
        prefs["telegram_chat_id"] = data.telegram_chat_id
    if data.whatsapp_number is not None:
        prefs["whatsapp_number"] = data.whatsapp_number
    user.notification_preferences = prefs
    db.commit()
    return {"message": "Webhook settings saved successfully"}


# ===================== JWT-Authenticated Bot Routes =====================

@router.post("/bots/start")
async def jwt_start_bot(body: BotStartRequestV2, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Enforce subscription bot limits
    limits = _subscription_limits(user.subscription or "free")
    manager_check = get_user_bot_manager(user.email, user.id)
    current_bot_count = sum(1 for v in manager_check.get_status().values() if v.get("running"))
    if current_bot_count >= limits["bots"]:
        raise HTTPException(
            status_code=403,
            detail=f"Bot limit reached for your plan ({limits['bots']} max). Upgrade to run more bots.",
        )

    # FinLux and SMA strategies are subscriber-only
    if body.strategy in ("finlux", "sma") and (user.subscription or "free") == "free":
        raise HTTPException(
            status_code=403,
            detail="FinLux and SMA strategies require a paid subscription. Upgrade your plan to access them.",
        )

    # If a specific exchange label is provided, validate it exists
    if not body.paper and body.exchange_label:
        connections = user.exchange_connections or []
        matched = [c for c in connections if c.get("label") == body.exchange_label or c.get("exchange") == body.exchange_label]
        if not matched:
            raise HTTPException(status_code=400, detail=f"Exchange '{body.exchange_label}' not found in your connections.")
    # balance_to_use overrides initial_capital when provided
    capital = body.balance_to_use or body.initial_capital or user.default_capital or 200.0
    if capital <= 0:
        capital = user.default_capital or 200.0
    if capital < 200.0:
        raise HTTPException(status_code=400, detail="Minimum capital required is $200 USDT to start the bot.")
    # Always live — paper trading is disabled
    if (user.balance_usdt or 0) < capital:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Need ${capital:,.2f} USDT.")
    # Find Binance credentials if user has a Binance connection
    binance_api_key = None
    binance_secret = None
    connections = user.exchange_connections or []
    if body.exchange_label:
        conn = next((c for c in connections if c.get("label") == body.exchange_label or c.get("exchange") == body.exchange_label), None)
        if conn and conn.get("exchange", "").lower() == "binance":
            binance_api_key = conn.get("api_key")
            binance_secret = conn.get("api_secret")
    else:
        binance_conn = next((c for c in connections if c.get("exchange", "").lower() == "binance"), None)
        if binance_conn:
            binance_api_key = binance_conn.get("api_key")
            binance_secret = binance_conn.get("api_secret")
    manager = get_user_bot_manager(user.email, user.id)
    result = manager.start_bot(
        ticker=body.ticker,
        paper=False,           # paper trading disabled — all bots use real balance
        initial_capital=capital,
        risk_per_trade_pct=body.risk_per_trade_pct,
        max_drawdown_pct=body.max_drawdown_pct,
        strategy=body.strategy,
        take_profit_pct=body.take_profit_pct,
        direction=body.direction,
        bot_name=body.bot_name,
        binance_api_key=binance_api_key,
        binance_secret=binance_secret,
        leverage=body.leverage,
        sl_usdt=body.sl_usdt,
        stop_loss_pct=body.stop_loss_pct,
        lot_size=body.lot_size,
    )
    return {"status": "success", "message": result, "bot_status": manager.get_status()}


@router.post("/bots/stop")
async def jwt_stop_bot(ticker: str = Query(default="ALL"), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    manager = get_user_bot_manager(user.email, user.id)
    return {"status": "success", "message": manager.stop_bot(ticker)}


@router.post("/bots/close-position")
async def jwt_close_bot_position(body: BotClosePositionRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    manager = get_user_bot_manager(user.email, user.id)
    message = manager.close_position(body.bot_id)
    return {"status": "success", "message": message, "bot_status": manager.get_status()}


@router.get("/trade/open-positions")
async def get_open_positions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all open BUY positions (manual + paper trades with no closing SELL)."""
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Get ALL buy trades (paper + real) that don't have a realized pnl yet
    open_buys = (
        db.query(TradeLog)
        .filter(
            TradeLog.user_id == user.id,
            TradeLog.action == "BUY",
            TradeLog.pnl == None,
        )
        .order_by(TradeLog.created_at.desc())
        .limit(50)
        .all()
    )
    # Net out against SELL trades to find truly open positions
    all_sells = (
        db.query(TradeLog)
        .filter(
            TradeLog.user_id == user.id,
            TradeLog.action == "SELL",
        )
        .all()
    )
    sold_tickers: dict = {}
    for s in all_sells:
        sold_tickers[s.ticker] = sold_tickers.get(s.ticker, 0.0) + (s.qty or 0.0)
    remaining_buys = []
    for b in open_buys:
        sold_qty = sold_tickers.get(b.ticker, 0.0)
        rem = (b.qty or 0.0) - sold_qty
        if rem > 0:
            sold_tickers[b.ticker] = 0.0
            remaining_buys.append((b, rem))
        elif sold_qty > 0:
            sold_tickers[b.ticker] = sold_qty - (b.qty or 0.0)
    open_buys_filtered = remaining_buys if remaining_buys else [(b, b.qty or 0.0) for b in open_buys]
    from src.trading.trade_bot import _fetch_live_price
    result = []
    for t, effective_qty in open_buys_filtered:
        entry_price = t.price or 0
        lev = max(float(t.leverage or 1), 1.0)
        try:
            current_price  = _fetch_live_price(t.ticker)
            # PnL is on full notional position (not just margin)
            unrealized_pnl = (current_price - entry_price) * effective_qty
            # Margin at risk
            margin         = (entry_price * effective_qty) / lev
            # Return on margin (for display)
            pnl_pct        = round(unrealized_pnl / margin * 100, 2) if margin > 0 else 0.0
        except Exception:
            current_price  = entry_price
            unrealized_pnl = 0.0
            pnl_pct        = 0.0
            margin         = (entry_price * effective_qty) / lev
        result.append({
            "id":             t.id,
            "ticker":         t.ticker,
            "action":         t.action,
            "price":          entry_price,
            "qty":            effective_qty,
            "leverage":       lev,
            "margin":         round(margin, 2),
            "exchange":       t.exchange,
            "paper":          t.paper,
            "created_at":     t.created_at.isoformat() if t.created_at else None,
            "current_price":  round(current_price, 4),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "pnl_pct":        pnl_pct,
        })
    return {"positions": result}


@router.post("/trade/close/{trade_id}")
async def close_manual_trade(trade_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Close an open BUY position at current market price."""
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    trade = db.query(TradeLog).filter(
        TradeLog.id == trade_id,
        TradeLog.user_id == user.id,
        TradeLog.action == "BUY",
        TradeLog.pnl == None,
    ).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Open position not found")
    from src.trading.trade_bot import _fetch_live_price
    current_price = _fetch_live_price(trade.ticker)
    entry_price   = trade.price or 0
    qty           = trade.qty or 0
    lev           = max(float(trade.leverage or 1), 1.0)
    # PnL on full notional position
    pnl           = (current_price - entry_price) * qty
    # Return margin + pnl to wallet (margin was what was originally deducted)
    margin        = (entry_price * qty) / lev
    proceeds      = max(margin + pnl, 0.0)  # floor at 0 (liquidation)

    # Credit proceeds back to wallet
    user.balance_usdt = round((user.balance_usdt or 0) + proceeds, 8)

    # Mark the original BUY trade with P&L
    trade.pnl = round(pnl, 8)

    # Log the SELL side
    sell_log = TradeLog(
        user_id=user.id,
        ticker=trade.ticker,
        action="SELL",
        price=current_price,
        qty=trade.qty,
        pnl=round(pnl, 8),
        reason=f"manual close of trade #{trade_id}",
        paper=False,
        exchange=trade.exchange or "internal",
    )
    db.add(sell_log)
    db.commit()
    db.refresh(sell_log)
    return {
        "status":        "closed",
        "trade_id":      trade_id,
        "close_price":   round(current_price, 4),
        "pnl":           round(pnl, 2),
        "proceeds":      round(proceeds, 2),
        "new_balance":   user.balance_usdt,
    }


@router.get("/bots/status")
async def jwt_bot_status(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    mgr = get_user_bot_manager(user.email, user.id)
    status = mgr.get_status()
    any_running = any(v.get("running") for v in status.values()) if status else False
    return {"bots": status, "running": any_running, "capital": user.default_capital or 0.0}


@router.post("/bots/update-params")
async def update_bot_params(body: BotParamsUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.default_capital is not None:
        user.default_capital = body.default_capital
    if body.risk_per_trade is not None:
        user.risk_per_trade = body.risk_per_trade
    if body.max_drawdown is not None:
        user.max_drawdown = body.max_drawdown
    if body.preferred_tickers is not None:
        user.preferred_tickers = body.preferred_tickers
    db.commit()
    db.refresh(user)
    return {"status": "saved", "default_capital": user.default_capital, "risk_per_trade": user.risk_per_trade,
            "max_drawdown": user.max_drawdown, "preferred_tickers": user.preferred_tickers}


@router.get("/bots/trades")
async def jwt_get_trades(limit: int = 20, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db_trades = (
        db.query(TradeLog)
        .filter(TradeLog.user_id == user.id)
        .order_by(TradeLog.created_at.desc())
        .limit(limit)
        .all()
    )
    result = [
        {
            "id": t.id,
            "ticker": t.ticker,
            "action": t.action,
            "price": t.price,
            "qty": t.qty,
            "pnl": t.pnl,
            "reason": t.reason,
            "paper": t.paper,
            "exchange": t.exchange,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in db_trades
    ]
    in_memory = get_user_bot_manager(user.email, user.id).get_trades(limit)
    for t in in_memory:
        t["created_at"] = t.get("time", "").isoformat() if hasattr(t.get("time", ""), "isoformat") else str(t.get("time", ""))
    seen_ids = {t["id"] for t in result}
    merged = result + [t for t in in_memory if t.get("id") not in seen_ids]
    merged.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"trades": merged[:limit]}


@router.post("/trade/execute")
async def execute_trade(body: TradeExecuteRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Resolve exchange connection if label provided
    conn = None
    if body.exchange_label:
        connections = user.exchange_connections or []
        conn = next((c for c in connections if c.get("label") == body.exchange_label), None)
        if not conn:
            raise HTTPException(status_code=400, detail=f"Exchange '{body.exchange_label}' not found in your connections.")

    leverage   = max(float(body.leverage or 1), 1.0)
    # lot_size is the authoritative quantity when provided; fall back to amount
    effective_qty = float(body.lot_size) if (body.lot_size and float(body.lot_size) > 0) else body.amount
    total_cost = round(body.price * effective_qty, 8)
    # Margin = notional / leverage (what's actually deducted from balance)
    margin_cost = round(total_cost / leverage, 8)

    if body.side == "buy":
        if (user.balance_usdt or 0) < margin_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient balance. Need ${margin_cost:,.2f} USDT margin ({leverage}x leverage).")
        user.balance_usdt = round((user.balance_usdt or 0) - margin_cost, 8)
    elif body.side == "sell":
        user.balance_usdt = round((user.balance_usdt or 0) + margin_cost, 8)
    else:
        raise HTTPException(status_code=400, detail="side must be 'buy' or 'sell'")

    # Normalize ticker: BTC/USDT → BTC-USD (compatible with price lookup maps)
    ticker = body.pair.replace("/", "-").replace("_", "-")
    ticker = ticker.replace("-USDT", "-USD").replace("-usdt", "-USD")
    exchange_name = conn.get("exchange", "live") if conn else "internal"

    log = TradeLog(
        user_id=user.id,
        ticker=ticker,
        action=body.side.upper(),
        price=body.price,
        qty=effective_qty,
        pnl=None,
        reason=f"{body.order_type} order via trading terminal ({exchange_name})",
        paper=False,
        exchange=exchange_name,
        stop_loss=body.stop_loss if body.side == "buy" else None,
        take_profit=body.take_profit if body.side == "buy" else None,
        leverage=body.leverage or 1.0,
        lot_size=body.lot_size,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    exchange_result = None
    exchange_error = None

    # If a live exchange API key is selected, also place the real order there
    if conn:
        api_key_val = conn.get("api_key", "")
        secret_val = conn.get("api_secret", "")
        passphrase = conn.get("passphrase", "")
        exchange_id = conn.get("exchange", "").lower()
        try:
            import ccxt
            ex_class = getattr(ccxt, exchange_id, None)
            if ex_class is None:
                raise ValueError(f"Exchange '{exchange_id}' not supported by ccxt")
            creds: dict = {"apiKey": api_key_val, "secret": secret_val}
            if passphrase:
                creds["password"] = passphrase
            exchange_obj = ex_class(creds)
            side_str = body.side.lower()
            if body.order_type == "market":
                order = exchange_obj.create_market_order(body.pair, side_str, body.amount)
            else:
                order = exchange_obj.create_limit_order(body.pair, side_str, body.amount, body.price)
            exchange_result = {"order_id": str(order.get("id", "")), "status": order.get("status", "submitted")}
            log.exchange = exchange_id
            db.commit()
        except Exception as e:
            exchange_error = str(e)
            logger.warning(f"Exchange order failed for {user.email} on {exchange_id}: {e}")

    # ── Trade notification via Telegram / WhatsApp ──────────────────
    try:
        import os as _os, threading as _thr
        _prefs = dict(user.notification_preferences or {})
        _tg_token = _os.getenv("TELEGRAM_BOT_TOKEN")
        _msg = (
            f"{'🟢 BUY' if body.side == 'buy' else '🔴 SELL'} {body.pair}\n"
            f"Price: ${body.price:,.4f}\n"
            f"Qty: {body.amount}\n"
            f"Total: ${total_cost:,.2f} USDT\n"
            f"Exchange: {exchange_name}\n"
            f"Balance: ${user.balance_usdt:,.2f} USDT"
        )
        # Telegram — user personal chat
        if _prefs.get("telegram") and user.telegram_chat_id and _tg_token:
            def _tg(tok, cid, txt):
                try:
                    import requests as _r
                    _r.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                            json={"chat_id": cid, "text": txt}, timeout=5)
                except Exception:
                    pass
            _thr.Thread(target=_tg, args=(_tg_token, user.telegram_chat_id, _msg), daemon=True).start()
        # WhatsApp — user verified number
        _wa_prefs = _prefs.get("whatsapp_verified") or user.whatsapp_connected
        _wa_phone = _prefs.get("whatsapp_number") or user.whatsapp_number
        if _prefs.get("whatsapp") and _wa_prefs and _wa_phone:
            def _wa(phone, txt):
                try:
                    from twilio.rest import Client as _TC
                    tc = _TC(_os.getenv("TWILIO_ACCOUNT_SID"), _os.getenv("TWILIO_AUTH_TOKEN"))
                    tc.messages.create(
                        from_=f"whatsapp:{_os.getenv('TWILIO_WHATSAPP_NUMBER', '+14155238886')}",
                        body=txt, to=f"whatsapp:{phone}"
                    )
                except Exception:
                    pass
            _thr.Thread(target=_wa, args=(_wa_phone, _msg), daemon=True).start()
    except Exception:
        pass

    return {
        "status": "executed",
        "routed_via": exchange_name,
        "trade": {
            "id": log.id,
            "ticker": log.ticker,
            "action": log.action,
            "price": log.price,
            "qty": log.qty,
            "total_usdt": total_cost,
            "new_balance": user.balance_usdt,
            "exchange": log.exchange,
            "stop_loss": log.stop_loss,
            "take_profit": log.take_profit,
            "leverage": log.leverage,
            "lot_size": log.lot_size,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        },
        "exchange_result": exchange_result,
        "exchange_error": exchange_error,
    }


# ===================== Telegram Webhook (FinAitradebot) =====================

@router.post("/users/telegram-generate-code")
async def generate_telegram_link_code(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a unique code stored in user's notification_preferences (DB-persisted)."""
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    import secrets as _sec
    code = f"FinAi-{_sec.randbelow(900000) + 100000}"
    prefs = dict(user.notification_preferences or {})
    prefs["telegram_link_code"] = code
    prefs["telegram_link_expires"] = (datetime.utcnow() + timedelta(minutes=30)).isoformat()
    user.notification_preferences = prefs
    db.commit()
    return {
        "code": code,
        "bot_url": "https://t.me/FinAitradebot",
        "instructions": f"Send this code to @FinAitradebot in Telegram to link your account: {code}"
    }


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive webhook updates from Telegram bot (@FinAitradebot).
    Protected by TELEGRAM_WEBHOOK_SECRET if set — Telegram sends it in
    the X-Telegram-Bot-Api-Secret-Token header.
    """
    webhook_secret = os.getenv("TELEGRAM_WEBHOOK_SECRET")
    if webhook_secret:
        incoming = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if incoming != webhook_secret:
            logger.warning("Telegram webhook: invalid secret token — request rejected")
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    try:
        data = await request.json()
    except Exception:
        return {"ok": True}

    message = data.get("message") or data.get("edited_message") or {}
    text = message.get("text", "").strip()
    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    first_name = chat.get("first_name", "")

    if not text or not chat_id:
        return {"ok": True}

    import httpx as _hx

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return {"ok": True}

    async def send_reply(msg: str):
        try:
            async with _hx.AsyncClient(timeout=5) as c:
                await c.post(f"https://api.telegram.org/bot{bot_token}/sendMessage",
                             json={"chat_id": chat_id, "text": msg, "parse_mode": "HTML"})
        except Exception:
            pass

    # /start command
    if text == "/start":
        await send_reply(
            f"👋 Welcome to <b>FinAi Trading Bot</b>, {first_name}!\n\n"
            "To link your FinAi account:\n"
            "1. Go to your Profile → Security tab\n"
            "2. Click <b>Generate Code</b> under Telegram\n"
            "3. Send the code here (e.g. <code>FinAi-627392</code>)\n\n"
            "Commands after linking:\n"
            "/status — portfolio status\n"
            "/balance — your USDT balance\n"
            "/trades — recent trades\n"
            "/help — show this menu"
        )
        return {"ok": True}

    # Code linking — look up code from DB (persisted in notification_preferences)
    if text.startswith("FinAi-"):
        code = text.strip()
        # Find the user who has this pending code
        all_users = db.query(User).all()
        code_user = None
        for _u in all_users:
            _p = dict(_u.notification_preferences or {})
            if _p.get("telegram_link_code") == code:
                # Check expiry
                _exp = _p.get("telegram_link_expires")
                if _exp and datetime.utcnow() > datetime.fromisoformat(_exp):
                    await send_reply("❌ Code expired. Generate a new one from Profile → FinAPI tab.")
                    return {"ok": True}
                code_user = _u
                break
        if not code_user:
            await send_reply("❌ Invalid or expired code. Generate a new one from Profile → FinAPI tab.")
            return {"ok": True}
        prefs = dict(code_user.notification_preferences or {})
        # Uniqueness: reject if another account already has this Telegram chat_id
        for _tu in all_users:
            if _tu.id != code_user.id:
                _tp = dict(_tu.notification_preferences or {})
                if _tp.get("telegram_chat_id") == chat_id or _tu.telegram_chat_id == chat_id:
                    await send_reply(
                        "❌ This Telegram account is already linked to another FinAi account.\n\n"
                        "Please disconnect it from the other account first, or contact support."
                    )
                    return {"ok": True}
        prefs["telegram_chat_id"]     = chat_id
        prefs["telegram_verified"]    = True
        prefs["telegram_first_name"]  = first_name
        # Also persist to the dedicated column
        code_user.telegram_chat_id    = chat_id
        code_user.telegram_connected  = True
        # Clear the one-time code
        prefs.pop("telegram_link_code", None)
        prefs.pop("telegram_link_expires", None)
        code_user.notification_preferences = prefs
        db.commit()
        await send_reply(
            f"✅ <b>Account linked successfully!</b>\n\n"
            f"Welcome, {first_name}! Your FinAi account (<code>{code_user.email}</code>) is now connected.\n\n"
            "You'll receive real-time alerts for:\n"
            "• Login activity\n• Price alerts\n• Stop Loss / Take Profit triggers\n• Bot trade signals\n\n"
            "Type /help to see available commands."
        )
        return {"ok": True}

    # Find user by chat_id in prefs
    all_users = db.query(User).all()
    linked_user = None
    for u in all_users:
        prefs = dict(u.notification_preferences or {})
        if prefs.get("telegram_chat_id") == chat_id:
            linked_user = u
            break

    if not linked_user:
        await send_reply("⚠️ Account not linked. Send your FinAi code (e.g. <code>FinAi-627392</code>) to get started.")
        return {"ok": True}

    # ── Full command dispatch for linked users ──
    parts = text.split()
    cmd   = parts[0].lower()

    # /balance
    if cmd == "/balance":
        bal = linked_user.balance_usdt or 0
        await send_reply(f"💰 <b>Wallet Balance</b>\n\n<b>${bal:,.2f} USDT</b>")

    # /portfolio
    elif cmd == "/portfolio":
        from src.database.models import TradeLog as _TL
        bal = linked_user.balance_usdt or 0
        mgr = get_user_bot_manager(linked_user.email, linked_user.id)
        bot_st = mgr.get_status()
        running = [b for b in bot_st.values() if b.get("running")]
        trades = db.query(_TL).filter(_TL.user_id == linked_user.id).order_by(_TL.created_at.desc()).limit(3).all()
        lines = [f"📊 <b>Portfolio — {linked_user.first_name or linked_user.email}</b>\n"]
        lines.append(f"💰 Balance: <b>${bal:,.2f} USDT</b>")
        lines.append(f"🤖 Active bots: {len(running)}")
        for b in running[:3]:
            lines.append(f"  • {b.get('ticker','?')} | P&amp;L: ${b.get('realized_pnl',0):.2f} | DD: {b.get('current_drawdown_pct',0):.1f}%")
        if trades:
            lines.append("\n📜 <b>Recent trades:</b>")
            for t in trades:
                pnl_s = f" | P&amp;L: ${t.pnl:+.2f}" if t.pnl is not None else ""
                lines.append(f"  • {t.action} {t.ticker} @ ${t.price:,.2f}{pnl_s}")
        await send_reply("\n".join(lines))

    # /pnl
    elif cmd == "/pnl":
        from src.database.models import TradeLog as _TL
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        t_today = db.query(_TL).filter(
            _TL.user_id == linked_user.id,
            _TL.created_at >= today,
            _TL.pnl.isnot(None)
        ).all()
        total_pnl = sum(t.pnl for t in t_today if t.pnl is not None)
        wins   = sum(1 for t in t_today if t.pnl and t.pnl > 0)
        losses = sum(1 for t in t_today if t.pnl and t.pnl < 0)
        sign = "🟢" if total_pnl >= 0 else "🔴"
        await send_reply(
            f"{sign} <b>Today's P&amp;L</b>\n\n"
            f"Total: <b>${total_pnl:+,.2f} USDT</b>\n"
            f"Trades: {len(t_today)} ({wins} wins / {losses} losses)\n"
            f"Date: {datetime.utcnow().strftime('%Y-%m-%d UTC')}"
        )

    # /bots
    elif cmd == "/bots":
        mgr = get_user_bot_manager(linked_user.email, linked_user.id)
        bot_st = mgr.get_status()
        if not bot_st:
            await send_reply("🤖 No bots running.\n\nUse /start BTC-USD to launch a paper bot.")
        else:
            lines = ["🤖 <b>Running Bots</b>\n"]
            for bot_id, s in bot_st.items():
                icon = "🟢" if s.get("running") else "🔴"
                lines.append(
                    f"{icon} <b>{s.get('bot_name', bot_id)}</b> ({s.get('ticker','?')})\n"
                    f"   Value: ${s.get('portfolio_value',0):.2f} | P&amp;L: ${s.get('realized_pnl',0):.2f}\n"
                    f"   Win Rate: {s.get('win_rate',0):.1f}% | DD: {s.get('current_drawdown_pct',0):.1f}%"
                )
            await send_reply("\n".join(lines))

    # /status (alias for /bots)
    elif cmd == "/status":
        mgr = get_user_bot_manager(linked_user.email, linked_user.id)
        bot_st = mgr.get_status()
        if not bot_st:
            await send_reply("ℹ️ No active bots running.")
        else:
            lines = ["📊 <b>Bot Status</b>\n"]
            for bot_id, s in bot_st.items():
                icon = "🟢" if s.get("running") else "🔴"
                lines.append(f"{icon} <b>{s.get('bot_name', bot_id)}</b>")
                lines.append(f"   Ticker: {s.get('ticker','—')} | Value: ${s.get('portfolio_value',0):.2f}")
                lines.append(f"   P&amp;L: ${s.get('realized_pnl',0):.2f} | DD: {s.get('current_drawdown_pct',0):.1f}%")
            await send_reply("\n".join(lines))

    # /start <ticker> — paper bot
    elif cmd == "/start" and len(parts) > 1:
        ticker = parts[1].upper()
        mgr = get_user_bot_manager(linked_user.email, linked_user.id)
        result = mgr.start_bot(ticker=ticker, paper=True)
        await send_reply(f"🚀 <b>Paper Bot Launched</b>\n\nTicker: <b>{ticker}</b>\n{result}\n\nUse /bots to monitor.")

    # /stop [ALL | botid]
    elif cmd == "/stop":
        mgr = get_user_bot_manager(linked_user.email, linked_user.id)
        result = mgr.stop_bot()
        await send_reply(f"🛑 <b>Bots Stopped</b>\n\n{result}")

    # /price <symbol>
    elif cmd == "/price":
        symbol = parts[1].upper() if len(parts) > 1 else "BTC"
        cg_map = {
            "BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana",
            "XRP": "ripple", "BNB": "binancecoin", "ADA": "cardano",
            "DOGE": "dogecoin", "AVAX": "avalanche-2", "MATIC": "matic-network",
            "DOT": "polkadot", "LINK": "chainlink",
        }
        coin_id = cg_map.get(symbol, symbol.lower())
        try:
            async with _hx.AsyncClient(timeout=6) as c:
                r = await c.get(
                    f"https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": coin_id, "vs_currencies": "usd", "include_24hr_change": "true"}
                )
                d = r.json().get(coin_id, {})
            price  = d.get("usd", 0)
            change = d.get("usd_24h_change", 0)
            sign   = "🟢 +" if change >= 0 else "🔴 "
            await send_reply(
                f"📈 <b>{symbol} / USD</b>\n\n"
                f"Price: <b>${price:,.2f}</b>\n"
                f"24h: {sign}{change:.2f}%\n\n"
                f"<i>Data: CoinGecko</i>"
            )
        except Exception:
            await send_reply(f"⚠️ Could not fetch price for {symbol}. Try again shortly.")

    # /ask <question>
    elif cmd == "/ask":
        question = " ".join(parts[1:]) if len(parts) > 1 else ""
        if not question:
            await send_reply("❓ Usage: /ask &lt;question&gt;\n\ne.g. /ask Should I buy ETH now?")
        else:
            bal = linked_user.balance_usdt or 0
            mgr = get_user_bot_manager(linked_user.email, linked_user.id)
            bot_st = mgr.get_status()
            running = [b for b in bot_st.values() if b.get("running")]
            ctx = f"User balance ${bal:,.2f} USDT, {len(running)} active bots."
            answer = None
            try:
                grok_key = os.getenv("GROQ_API_KEY") or os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY")
                oai_key  = os.getenv("OPENAI_API_KEY")
                if grok_key:
                    from langchain_groq import ChatGroq
                    _llm = ChatGroq(api_key=grok_key, model="llama-3.3-70b-versatile", max_tokens=200)
                    _msg = _llm.invoke(f"You are FinAi, an AI trading assistant. {ctx} Answer briefly (2-3 sentences): {question}")
                    answer = _msg.content.strip()
                elif oai_key:
                    from langchain_openai import ChatOpenAI
                    _llm = ChatOpenAI(api_key=oai_key, model="gpt-4o-mini", max_tokens=200)
                    _msg = _llm.invoke(f"You are FinAi, an AI trading assistant. {ctx} Answer briefly: {question}")
                    answer = _msg.content.strip()
            except Exception as _ae:
                logger.error(f"AI /ask error: {_ae}")
            if not answer:
                answer = (
                    f"Your current balance is ${bal:,.2f} USDT with {len(running)} active bot(s). "
                    "For full AI analysis and trading signals, visit the FinAi web app."
                )
            await send_reply(f"🤖 <b>FinAi AI</b>\n\n{answer}")

    # /trades
    elif cmd == "/trades":
        from src.database.models import TradeLog as _TL
        trades = db.query(_TL).filter(_TL.user_id == linked_user.id).order_by(_TL.created_at.desc()).limit(5).all()
        if not trades:
            await send_reply("📜 No trades yet.")
        else:
            lines = ["📜 <b>Last 5 Trades</b>\n"]
            for t in trades:
                pnl_s   = f" | P&amp;L: ${t.pnl:+.2f}" if t.pnl is not None else ""
                paper_s = " [PAPER]" if getattr(t, 'paper', False) else ""
                lines.append(f"• {t.action} {t.ticker} @ ${t.price:,.2f}{pnl_s}{paper_s}")
            await send_reply("\n".join(lines))

    # /help
    elif cmd == "/help":
        await send_reply(
            "📖 <b>FinAi Bot Commands</b>\n\n"
            "📊 <b>Account</b>\n"
            "/portfolio — Balance, bots &amp; recent activity\n"
            "/pnl — Today's profit &amp; loss\n"
            "/balance — Wallet balance\n\n"
            "🤖 <b>Bots</b>\n"
            "/bots — Running bots\n"
            "/status — Bot status\n"
            "/start BTC-USD — Launch a paper bot\n"
            "/stop ALL — Stop all bots\n\n"
            "💰 <b>Market</b>\n"
            "/price BTC — Live BTC price\n"
            "/price ETH — Live ETH price\n\n"
            "💬 <b>AI Chat</b>\n"
            "/ask &lt;question&gt; — Ask anything\n"
            "  e.g. /ask What is my portfolio worth?\n\n"
            "📋 <b>Other</b>\n"
            "/trades — Last 5 trades\n"
            "/help — Show this menu"
        )

    else:
        await send_reply(
            f"👋 Hi {first_name}!\n\n"
            "I didn't recognise that command.\n"
            "Type /help to see all available commands."
        )

    return {"ok": True}


# ===================== WhatsApp Twilio Webhook =====================
# In-memory WhatsApp link codes: code → {user_id, phone}
_whatsapp_link_codes: dict = {}

@router.post("/users/whatsapp-generate-code")
async def generate_whatsapp_link_code(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a unique code for the user to send via WhatsApp to link their account."""
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    import secrets as _sec
    code = f"WA-{_sec.randbelow(900000) + 100000}"
    _whatsapp_link_codes[code] = {"user_id": user.id, "email": user.email}
    twilio_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "+14155238886")
    return {
        "code": code,
        "whatsapp_number": twilio_number,
        "instructions": f"Send this code via WhatsApp to {twilio_number} to link your account: {code}",
    }


@router.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive inbound WhatsApp messages from Twilio."""
    try:
        form = await request.form()
    except Exception:
        return {"status": "ok"}

    body    = str(form.get("Body", "")).strip()
    from_   = str(form.get("From", ""))    # e.g. "whatsapp:+1234567890"
    phone   = from_.replace("whatsapp:", "").strip()

    if not body or not phone:
        return {"status": "ok"}

    import httpx as _hx
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN", "")
    wa_number   = os.getenv("TWILIO_WHATSAPP_NUMBER", "+14155238886")

    async def send_wa(msg: str):
        if not account_sid or not auth_token:
            return
        try:
            async with _hx.AsyncClient(timeout=5) as c:
                await c.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
                    auth=(account_sid, auth_token),
                    data={"From": f"whatsapp:{wa_number}", "To": from_, "Body": msg},
                )
        except Exception:
            pass

    # Check if body matches a link code
    if body.upper().startswith("WA-"):
        code = body.strip()
        link_data = _whatsapp_link_codes.get(code)
        if not link_data:
            await send_wa("❌ Invalid or expired code. Go to FinAi Profile → FinAPI → WhatsApp to generate a new one.")
            return {"status": "ok"}
        user = db.query(User).filter(User.id == link_data["user_id"]).first()
        if user:
            user.whatsapp_number = phone
            user.whatsapp_connected = True
            # Persist in notification_preferences too
            prefs = dict(user.notification_preferences or {})
            prefs["whatsapp_number"] = phone
            prefs["whatsapp_verified"] = True
            user.notification_preferences = prefs
            db.commit()
            del _whatsapp_link_codes[code]
            await send_wa(
                f"✅ *FinAi WhatsApp Linked!*\n\n"
                f"Your account ({user.email}) is now connected.\n\n"
                "You'll receive trade alerts, bot status, and market events here.\n\n"
                "Reply *HELP* for available commands."
            )
        return {"status": "ok"}

    # Find user by phone
    linked_user = db.query(User).filter(User.whatsapp_number == phone).first()
    if not linked_user:
        await send_wa(
            "👋 Welcome to *FinAi Trading Bot*!\n\n"
            "To link your account:\n"
            "1. Go to your FinAi Profile → FinAPI tab\n"
            "2. Click *Generate Code* under WhatsApp\n"
            "3. Send the code here (e.g. WA-627392)"
        )
        return {"status": "ok"}

    # ── Full WhatsApp command dispatch ──
    wa_parts = body.split()
    wa_cmd   = wa_parts[0].upper().lstrip("/")

    if wa_cmd == "BALANCE":
        bal = linked_user.balance_usdt or 0
        await send_wa(f"💰 *Wallet Balance*\n\n*${bal:,.2f} USDT*")

    elif wa_cmd == "PORTFOLIO":
        from src.database.models import TradeLog as _TL
        bal    = linked_user.balance_usdt or 0
        mgr    = get_user_bot_manager(linked_user.email, linked_user.id)
        bot_st = mgr.get_status()
        running = [b for b in bot_st.values() if b.get("running")]
        trades = db.query(_TL).filter(_TL.user_id == linked_user.id).order_by(_TL.created_at.desc()).limit(3).all()
        lines  = [f"📊 *Portfolio — {linked_user.first_name or linked_user.email}*\n"]
        lines.append(f"💰 Balance: *${bal:,.2f} USDT*")
        lines.append(f"🤖 Active bots: {len(running)}")
        for b in running[:3]:
            lines.append(f"  • {b.get('ticker','?')} | P&L: ${b.get('realized_pnl',0):.2f}")
        if trades:
            lines.append("\n📜 *Recent trades:*")
            for t in trades:
                pnl_s = f" | P&L: ${t.pnl:+.2f}" if t.pnl is not None else ""
                lines.append(f"  • {t.action} {t.ticker} @ ${t.price:,.2f}{pnl_s}")
        await send_wa("\n".join(lines))

    elif wa_cmd == "PNL":
        from src.database.models import TradeLog as _TL
        today   = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        t_today = db.query(_TL).filter(
            _TL.user_id == linked_user.id,
            _TL.created_at >= today,
            _TL.pnl.isnot(None)
        ).all()
        total_pnl = sum(t.pnl for t in t_today if t.pnl is not None)
        wins   = sum(1 for t in t_today if t.pnl and t.pnl > 0)
        losses = sum(1 for t in t_today if t.pnl and t.pnl < 0)
        sign = "🟢 +" if total_pnl >= 0 else "🔴 "
        await send_wa(
            f"{'🟢' if total_pnl >= 0 else '🔴'} *Today's P&L*\n\n"
            f"Total: *${total_pnl:+,.2f} USDT*\n"
            f"Trades: {len(t_today)} ({wins} wins / {losses} losses)\n"
            f"Date: {datetime.utcnow().strftime('%Y-%m-%d UTC')}"
        )

    elif wa_cmd in ("BOTS", "STATUS"):
        mgr    = get_user_bot_manager(linked_user.email, linked_user.id)
        bot_st = mgr.get_status()
        if not bot_st:
            await send_wa("🤖 No bots running.\n\nSend: START BTC-USD to launch a paper bot.")
        else:
            lines = ["🤖 *Bot Status*\n"]
            for bot_id, s in bot_st.items():
                icon = "🟢" if s.get("running") else "🔴"
                lines.append(
                    f"{icon} *{s.get('bot_name', bot_id)}* ({s.get('ticker','?')})\n"
                    f"   Value: ${s.get('portfolio_value',0):.2f} | P&L: ${s.get('realized_pnl',0):.2f}\n"
                    f"   Win Rate: {s.get('win_rate',0):.1f}% | DD: {s.get('current_drawdown_pct',0):.1f}%"
                )
            await send_wa("\n".join(lines))

    elif wa_cmd == "START" and len(wa_parts) > 1:
        ticker = wa_parts[1].upper()
        mgr    = get_user_bot_manager(linked_user.email, linked_user.id)
        result = mgr.start_bot(ticker=ticker, paper=True)
        await send_wa(f"🚀 *Paper Bot Launched*\n\nTicker: *{ticker}*\n{result}\n\nSend BOTS to monitor.")

    elif wa_cmd == "STOP":
        mgr    = get_user_bot_manager(linked_user.email, linked_user.id)
        result = mgr.stop_bot()
        await send_wa(f"🛑 *Bots Stopped*\n\n{result}")

    elif wa_cmd == "PRICE" and len(wa_parts) > 1:
        symbol  = wa_parts[1].upper()
        cg_map  = {
            "BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana",
            "XRP": "ripple", "BNB": "binancecoin", "ADA": "cardano",
            "DOGE": "dogecoin", "AVAX": "avalanche-2",
        }
        coin_id = cg_map.get(symbol, symbol.lower())
        try:
            async with _hx.AsyncClient(timeout=6) as c:
                r = await c.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": coin_id, "vs_currencies": "usd", "include_24hr_change": "true"}
                )
                d = r.json().get(coin_id, {})
            price  = d.get("usd", 0)
            change = d.get("usd_24h_change", 0)
            sign   = "🟢 +" if change >= 0 else "🔴 "
            await send_wa(f"📈 *{symbol} / USD*\n\nPrice: *${price:,.2f}*\n24h: {sign}{change:.2f}%")
        except Exception:
            await send_wa(f"⚠️ Could not fetch price for {symbol}. Try again shortly.")

    elif wa_cmd == "ASK":
        question = " ".join(wa_parts[1:]) if len(wa_parts) > 1 else ""
        if not question:
            await send_wa("❓ Usage: ASK <question>\n\ne.g. ASK Should I buy ETH now?")
        else:
            bal    = linked_user.balance_usdt or 0
            mgr    = get_user_bot_manager(linked_user.email, linked_user.id)
            bot_st = mgr.get_status()
            running = [b for b in bot_st.values() if b.get("running")]
            ctx    = f"User balance ${bal:,.2f} USDT, {len(running)} active bots."
            answer = None
            try:
                grok_key = os.getenv("GROQ_API_KEY") or os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY")
                oai_key  = os.getenv("OPENAI_API_KEY")
                if grok_key:
                    from langchain_groq import ChatGroq
                    _llm = ChatGroq(api_key=grok_key, model="llama-3.3-70b-versatile", max_tokens=200)
                    _msg = _llm.invoke(f"You are FinAi, an AI trading assistant. {ctx} Answer briefly (2-3 sentences): {question}")
                    answer = _msg.content.strip()
                elif oai_key:
                    from langchain_openai import ChatOpenAI
                    _llm = ChatOpenAI(api_key=oai_key, model="gpt-4o-mini", max_tokens=200)
                    _msg = _llm.invoke(f"You are FinAi, an AI trading assistant. {ctx} Answer briefly: {question}")
                    answer = _msg.content.strip()
            except Exception:
                pass
            if not answer:
                answer = (
                    f"Your current balance is ${bal:,.2f} USDT with {len(running)} active bot(s). "
                    "For full AI analysis and trading signals, visit the FinAi web app."
                )
            await send_wa(f"🤖 *FinAi AI*\n\n{answer}")

    elif wa_cmd == "TRADES":
        from src.database.models import TradeLog as _TL
        trades = db.query(_TL).filter(_TL.user_id == linked_user.id).order_by(_TL.created_at.desc()).limit(5).all()
        if not trades:
            await send_wa("📜 No trades yet.")
        else:
            lines = ["📜 *Last 5 Trades*\n"]
            for t in trades:
                pnl_s = f" | P&L: ${t.pnl:+.2f}" if t.pnl is not None else ""
                lines.append(f"• {t.action} {t.ticker} @ ${t.price:,.2f}{pnl_s}")
            await send_wa("\n".join(lines))

    elif wa_cmd == "HELP":
        await send_wa(
            "📖 *FinAi WhatsApp Commands*\n\n"
            "📊 *Account*\n"
            "PORTFOLIO — Balance, bots & activity\n"
            "PNL — Today's profit & loss\n"
            "BALANCE — Wallet balance\n\n"
            "🤖 *Bots*\n"
            "BOTS — Running bots\n"
            "STATUS — Bot status\n"
            "START BTC-USD — Launch paper bot\n"
            "STOP — Stop all bots\n\n"
            "💰 *Market*\n"
            "PRICE BTC — Live BTC price\n"
            "PRICE ETH — Live ETH price\n\n"
            "💬 *AI Chat*\n"
            "ASK <question> — Ask anything\n\n"
            "📋 *Other*\n"
            "TRADES — Last 5 trades\n"
            "HELP — Show this menu"
        )

    else:
        await send_wa(
            f"👋 Hi {linked_user.first_name or 'there'}!\n\n"
            "I didn't recognise that command.\n"
            "Reply *HELP* to see all available commands."
        )
    return {"status": "ok"}


# ===================== Public Bot Routes (API Key) =====================
@router.post("/public/bot/start")
async def public_start_bot(ticker: str = Query(...), paper: bool = False, user=Depends(authenticate_api_key)):
    manager = get_user_bot_manager(user.email, user.id)
    result = manager.start_bot(ticker, paper)
    return {"status": "success", "message": result, "bot_status": manager.get_status()}


@router.post("/public/bot/stop")
async def public_stop_bot(user=Depends(authenticate_api_key)):
    manager = get_user_bot_manager(user.email, user.id)
    return {"status": "success", "message": manager.stop_bot()}


@router.get("/public/bot/status")
async def public_bot_status(user=Depends(authenticate_api_key)):
    return get_user_bot_manager(user.email, user.id).get_status()


@router.get("/public/bot/trades")
async def public_get_trades(limit: int = 20, user=Depends(authenticate_api_key)):
    return {"trades": get_user_bot_manager(user.email, user.id).get_trades(limit)}


# ===================== Ingest / Analysis =====================
@router.post("/ingest")
async def trigger_ingestion(background_tasks: BackgroundTasks):
    from src.celery_app.tasks import ingest_and_detect_events
    task = ingest_and_detect_events.delay()
    return {"status": "triggered", "task_id": task.id}


@router.get("/analyze-trendline")
async def analyze_trendline(ticker: str = Query(...), period: str = Query("60d")):
    try:
        import yfinance as yf
        from src.analysis.trendline_analyzer import TrendlineAnalyzer
        df = yf.download(ticker, period=period, interval="1h", progress=False)
        if df.empty:
            raise HTTPException(status_code=404, detail="No data")
        analyzer = TrendlineAnalyzer(length=14, mult=1.0, calc_method="Atr")
        return analyzer.analyze(df, ticker=ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/public/recommendations")
async def get_live_recommendations():
    """Live AI-powered BUY/SELL/HOLD recommendations using real prices."""
    import httpx, random
    HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinAi/1.0)", "Accept": "application/json"}
    prices: dict = {}
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price"
                "?ids=bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,chainlink,avalanche-2,polkadot"
                "&vs_currencies=usd&include_24hr_change=true&include_7d_change=true",
                headers=HEADERS,
            )
            if r.status_code == 200:
                prices = r.json()
    except Exception:
        pass

    ID_MAP = {
        "bitcoin":       {"symbol": "BTC/USDT", "name": "Bitcoin",   "cat": "crypto"},
        "ethereum":      {"symbol": "ETH/USDT", "name": "Ethereum",  "cat": "crypto"},
        "binancecoin":   {"symbol": "BNB/USDT", "name": "BNB",       "cat": "crypto"},
        "solana":        {"symbol": "SOL/USDT", "name": "Solana",    "cat": "crypto"},
        "ripple":        {"symbol": "XRP/USDT", "name": "XRP",       "cat": "crypto"},
        "cardano":       {"symbol": "ADA/USDT", "name": "Cardano",   "cat": "crypto"},
        "dogecoin":      {"symbol": "DOGE/USDT","name": "Dogecoin",  "cat": "crypto"},
        "chainlink":     {"symbol": "LINK/USDT","name": "Chainlink", "cat": "crypto"},
        "avalanche-2":   {"symbol": "AVAX/USDT","name": "Avalanche", "cat": "crypto"},
        "polkadot":      {"symbol": "DOT/USDT", "name": "Polkadot",  "cat": "crypto"},
    }

    REASONS_BUY  = ["Strong bullish momentum. Price above 20-day MA with rising volume.",
                    "Oversold RSI bounce with positive divergence. Breakout imminent.",
                    "Institutional accumulation detected. 7-day trend turning bullish.",
                    "Key support held. High-confidence reversal pattern forming.",]
    REASONS_SELL = ["Bearish divergence on RSI. Distribution pattern detected.",
                    "Price rejected at key resistance. Downward pressure increasing.",
                    "Funding rates elevated. Profit-taking likely. High reversal risk.",]
    REASONS_HOLD = ["Consolidating near key level. Await clear directional breakout.",
                    "Mixed signals — momentum neutral. Hold existing position.",
                    "Range-bound. Wait for volume catalyst before new entry.",]

    PRICE_FALLBACKS = {
        "bitcoin": {"usd": 97000, "usd_24h_change": 2.4,  "usd_7d_change": 5.1},
        "ethereum": {"usd": 3200, "usd_24h_change": 1.8,  "usd_7d_change": 3.2},
        "binancecoin": {"usd": 628, "usd_24h_change": 0.9, "usd_7d_change": 1.8},
        "solana": {"usd": 170, "usd_24h_change": 3.2,     "usd_7d_change": 8.1},
        "ripple": {"usd": 0.52, "usd_24h_change": 1.1,    "usd_7d_change": -2.3},
        "cardano": {"usd": 0.48, "usd_24h_change": 0.8,   "usd_7d_change": 1.4},
        "dogecoin": {"usd": 0.165, "usd_24h_change": -0.5,"usd_7d_change": -4.2},
        "chainlink": {"usd": 14.80, "usd_24h_change": 2.1,"usd_7d_change": 6.3},
        "avalanche-2": {"usd": 38.50, "usd_24h_change": 2.8, "usd_7d_change": 7.2},
        "polkadot": {"usd": 7.20, "usd_24h_change": 1.4,  "usd_7d_change": 2.9},
    }

    results = []
    for coin_id, meta in ID_MAP.items():
        d = prices.get(coin_id) or PRICE_FALLBACKS.get(coin_id, {})
        price_usd  = d.get("usd", 0)
        change_24h = d.get("usd_24h_change", random.uniform(-5, 5))
        change_7d  = d.get("usd_7d_change", change_24h * 3)
        if price_usd == 0:
            continue
        score = change_24h * 0.6 + change_7d * 0.4
        if score > 3:
            rec, conf = "BUY",  min(95, int(60 + abs(score) * 2.5))
            reason = random.choice(REASONS_BUY)
        elif score < -3:
            rec, conf = "SELL", min(95, int(60 + abs(score) * 2.5))
            reason = random.choice(REASONS_SELL)
        else:
            rec, conf = "HOLD", int(50 + random.randint(0, 15))
            reason = random.choice(REASONS_HOLD)
        results.append({
            "symbol":         meta["symbol"],
            "name":           meta["name"],
            "price":          round(price_usd, 6),
            "change":         round(change_24h, 2),
            "recommendation": rec,
            "confidence":     conf,
            "reason":         reason,
            "cat":            meta["cat"],
        })
    results.sort(key=lambda x: abs(x["change"]), reverse=True)
    return results[:9]


@router.get("/public/news")
async def get_live_news():
    """Fetch live financial news from multiple free RSS sources (Bloomberg, Reuters, CNBC, Yahoo, etc.)."""
    import httpx, feedparser, time as _time
    from html import unescape

    # ── Free RSS feeds from major sources (no API key required) ──
    RSS_SOURCES = [
        ("Reuters",         "https://feeds.reuters.com/reuters/businessNews"),
        ("CNBC",            "https://www.cnbc.com/id/10000664/device/rss/rss.html"),
        ("Yahoo Finance",   "https://finance.yahoo.com/news/rssindex"),
        ("Bloomberg",       "https://feeds.bloomberg.com/markets/news.rss"),
        ("MarketWatch",     "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
        ("Seeking Alpha",   "https://seekingalpha.com/feed.xml"),
        ("CoinDesk",        "https://www.coindesk.com/arc/outboundfeeds/rss/"),
        ("CoinTelegraph",   "https://cointelegraph.com/rss"),
        ("The Block",       "https://www.theblock.co/rss.xml"),
        ("Decrypt",         "https://decrypt.co/feed"),
        ("Benzinga",        "https://www.benzinga.com/feed"),
        ("Investopedia",    "https://www.investopedia.com/feedbuilder/feed/getfeed/?feedName=rss_headline"),
    ]

    articles = []

    async def _fetch_rss(session: httpx.AsyncClient, name: str, url: str):
        try:
            r = await session.get(url, timeout=6, follow_redirects=True,
                                  headers={"User-Agent": "Mozilla/5.0 (compatible; FinAi/1.0)"})
            if r.status_code == 200:
                feed = feedparser.parse(r.text)
                for entry in feed.entries[:4]:
                    title = unescape(entry.get("title", "")).strip()
                    link  = entry.get("link", "")
                    desc  = unescape(entry.get("summary", entry.get("description", ""))).strip()
                    pub   = entry.get("published", entry.get("updated", ""))
                    if title and link:
                        articles.append({
                            "title":       title[:200],
                            "source":      name,
                            "url":         link,
                            "published":   pub,
                            "description": desc[:300] if desc else "",
                        })
        except Exception:
            pass

    async with httpx.AsyncClient(timeout=8) as client:
        import asyncio
        await asyncio.gather(*[_fetch_rss(client, name, url) for name, url in RSS_SOURCES])

    # Sort by published date desc, fallback to order received
    def _pub_ts(a):
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(a["published"]).timestamp()
        except Exception:
            try:
                from dateutil import parser as dp
                return dp.parse(a["published"]).timestamp()
            except Exception:
                return 0.0

    articles.sort(key=_pub_ts, reverse=True)

    # Deduplicate by title
    seen, unique = set(), []
    for a in articles:
        key = a["title"][:60].lower()
        if key not in seen:
            seen.add(key)
            unique.append(a)

    if not unique:
        unique = [
            {"title": "Bitcoin Holds $97K as Institutional Demand Surges", "source": "Reuters",
             "url": "https://reuters.com/markets", "published": "", "description": "BTC consolidates gains amid record ETF inflows."},
            {"title": "Ethereum ETF Volumes Hit All-Time High", "source": "CNBC",
             "url": "https://cnbc.com/crypto", "published": "", "description": "Spot ETH ETFs record highest weekly volume since launch."},
            {"title": "Fed Signals Rate Cuts Ahead — Risk Assets Rally", "source": "Bloomberg",
             "url": "https://bloomberg.com/markets", "published": "", "description": "Markets price in two rate cuts for H2 2025."},
            {"title": "Solana DeFi TVL Crosses $10B Milestone", "source": "CoinDesk",
             "url": "https://coindesk.com", "published": "", "description": "SOL ecosystem growth accelerates with new protocol launches."},
            {"title": "AI Tokens Lead Altcoin Surge This Week", "source": "Yahoo Finance",
             "url": "https://finance.yahoo.com", "published": "", "description": "AI-themed projects outperform market by 2x."},
            {"title": "NVIDIA Posts Record Revenue on AI Demand", "source": "MarketWatch",
             "url": "https://marketwatch.com", "published": "", "description": "NVDA shares surge after beating earnings estimates."},
        ]
    return unique[:20]


# ── Stock price cache (yfinance, refreshed every 5 min) ──
_stock_cache: dict  = {"data": {}, "ts": 0.0}
_crypto_cache: dict = {"data": {}, "ts": 0.0}   # Binance.US 24hr cache (90s TTL)
_STOCK_TICKERS = ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "GOOGL", "AMZN", "META", "BRK-B", "JPM", "V", "JNJ", "WMT", "XOM", "GLD"]

# CoinGecko-ID → Binance.US symbol
_BINANCE_US_CRYPTO = {
    "bitcoin":       "BTCUSDT",  "ethereum":      "ETHUSDT",  "binancecoin":   "BNBUSDT",
    "solana":        "SOLUSDT",  "ripple":        "XRPUSDT",  "cardano":       "ADAUSDT",
    "dogecoin":      "DOGEUSDT", "polkadot":      "DOTUSDT",  "chainlink":     "LINKUSDT",
    "avalanche-2":   "AVAXUSDT", "matic-network": "MATICUSDT","litecoin":      "LTCUSDT",
    "uniswap":       "UNIUSDT",  "stellar":       "XLMUSDT",
}

def _get_live_crypto_prices() -> dict:
    """Fetch all crypto 24hr tickers from Binance.US in one batch call."""
    import time as _time, requests as _req
    now = _time.time()
    if now - _crypto_cache["ts"] < 90 and _crypto_cache["data"]:
        return _crypto_cache["data"]
    try:
        r = _req.get("https://api.binance.us/api/v3/ticker/24hr", timeout=8)
        if r.status_code == 200:
            tickers = {item["symbol"]: item for item in r.json()}
            result = {}
            for cg_id, sym in _BINANCE_US_CRYPTO.items():
                item = tickers.get(sym, {})
                price = float(item.get("lastPrice", 0) or 0)
                chg   = float(item.get("priceChangePercent", 0) or 0)
                if price > 0:
                    result[cg_id] = {"usd": round(price, 8), "usd_24h_change": round(chg, 2)}
            if result:
                _crypto_cache["data"] = result
                _crypto_cache["ts"]   = now
                return result
    except Exception:
        pass
    return _crypto_cache["data"]   # return stale cache if fetch fails


def _get_live_stock_prices() -> dict:
    """Fetch real-time stock prices via Yahoo Finance REST API (no yfinance package)."""
    import time as _time, requests as _req
    now = _time.time()
    if now - _stock_cache["ts"] < 60 and _stock_cache["data"]:
        return _stock_cache["data"]

    _YF_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinAi/1.0)"}
    # Yahoo Finance symbols (BRK-B for Berkshire)
    _YF_SYMBOLS = {
        "AAPL": "AAPL", "TSLA": "TSLA", "NVDA": "NVDA", "SPY": "SPY",
        "MSFT": "MSFT", "GOOGL": "GOOGL", "AMZN": "AMZN", "META": "META",
        "BRK": "BRK-B", "JPM": "JPM", "V": "V", "JNJ": "JNJ",
        "WMT": "WMT", "XOM": "XOM", "GLD": "GLD",
    }
    result = {}
    for key, sym in _YF_SYMBOLS.items():
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=2d"
            r = _req.get(url, headers=_YF_HEADERS, timeout=6)
            if r.status_code == 200:
                data = r.json()
                meta = data["chart"]["result"][0]["meta"]
                price = meta.get("regularMarketPrice") or meta.get("previousClose", 0)
                prev  = meta.get("chartPreviousClose") or meta.get("previousClose", price)
                chg   = round((price - prev) / prev * 100, 2) if prev else 0.0
                if price and float(price) > 0:
                    result[key] = {"usd": round(float(price), 2), "usd_24h_change": chg}
        except Exception:
            pass

    if result:
        _stock_cache["data"] = result
        _stock_cache["ts"]   = now
        return result

    return _stock_cache["data"] or {
        "AAPL":  {"usd": 195.32, "usd_24h_change": 0.45},
        "TSLA":  {"usd": 175.35, "usd_24h_change": 1.02},
        "NVDA":  {"usd": 875.20, "usd_24h_change": 1.75},
        "SPY":   {"usd": 526.62, "usd_24h_change": 0.43},
        "MSFT":  {"usd": 415.12, "usd_24h_change": -0.34},
        "GOOGL": {"usd": 400.80, "usd_24h_change": 0.71},
        "AMZN":  {"usd": 272.68, "usd_24h_change": 0.56},
        "META":  {"usd": 609.63, "usd_24h_change": -0.46},
        "BRK":   {"usd": 475.94, "usd_24h_change": 0.18},
        "JPM":   {"usd": 302.10, "usd_24h_change": -0.37},
        "V":     {"usd": 318.79, "usd_24h_change": -0.28},
        "JNJ":   {"usd": 221.32, "usd_24h_change": -0.13},
        "WMT":   {"usd": 130.43, "usd_24h_change": 0.27},
        "XOM":   {"usd": 144.57, "usd_24h_change": -0.37},
        "GLD":   {"usd": 301.77, "usd_24h_change": 0.39},
    }


def _get_live_metals_prices() -> dict:
    """Fetch real-time metals/commodities prices via Yahoo Finance futures REST API."""
    import time as _time, requests as _req
    _YF_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinAi/1.0)"}
    _METALS_YF = {
        "gold":      "GC=F",
        "silver":    "SI=F",
        "platinum":  "PL=F",
        "palladium": "PA=F",
        "copper":    "HG=F",
        "oil_wti":   "CL=F",
        "nat_gas":   "NG=F",
    }
    result = {}
    for key, sym in _METALS_YF.items():
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=2d"
            r = _req.get(url, headers=_YF_HEADERS, timeout=6)
            if r.status_code == 200:
                data = r.json()
                meta = data["chart"]["result"][0]["meta"]
                price = meta.get("regularMarketPrice") or meta.get("previousClose", 0)
                prev  = meta.get("chartPreviousClose") or meta.get("previousClose", price)
                chg   = round((price - prev) / prev * 100, 2) if prev else 0.0
                if price and float(price) > 0:
                    result[key] = {"usd": round(float(price), 2), "usd_24h_change": chg}
        except Exception:
            pass
    return result


@router.get("/public/prices")
async def get_live_prices():
    import httpx, asyncio
    from concurrent.futures import ThreadPoolExecutor

    HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinAi/1.0)", "Accept": "application/json"}
    metals_data: dict = {}

    # ── Run crypto + stocks + metals in parallel via thread pool ──
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=3) as pool:
        crypto_fut  = loop.run_in_executor(pool, _get_live_crypto_prices)
        stocks_fut  = loop.run_in_executor(pool, _get_live_stock_prices)
        metals_fut  = loop.run_in_executor(pool, _get_live_metals_prices)

        # Also try metals.live as supplemental (async, low timeout)
        async with httpx.AsyncClient(timeout=5, follow_redirects=True) as client:
            try:
                r = await client.get("https://api.metals.live/v1/spot", headers=HEADERS)
                if r.status_code == 200:
                    items = r.json()
                    if isinstance(items, list):
                        for item in items:
                            metals_data.update(item)
                    elif isinstance(items, dict):
                        metals_data = items
            except Exception:
                pass

        crypto_data  = await crypto_fut
        stocks_data  = await stocks_fut
        metals_yahoo = await metals_fut

    # ── Crypto hard fallback ──
    if not crypto_data:
        crypto_data = {
            "bitcoin":       {"usd": 97000.0, "usd_24h_change": 0.91},
            "ethereum":      {"usd": 3200.0,  "usd_24h_change": 1.61},
            "binancecoin":   {"usd": 628.0,   "usd_24h_change": 1.42},
            "solana":        {"usd": 155.0,   "usd_24h_change": 5.64},
            "ripple":        {"usd": 2.40,    "usd_24h_change": 2.30},
            "cardano":       {"usd": 0.75,    "usd_24h_change": 3.26},
            "dogecoin":      {"usd": 0.18,    "usd_24h_change": 1.85},
            "polkadot":      {"usd": 6.50,    "usd_24h_change": 2.27},
            "chainlink":     {"usd": 13.20,   "usd_24h_change": 4.95},
            "avalanche-2":   {"usd": 22.40,   "usd_24h_change": 4.09},
            "matic-network": {"usd": 0.38,    "usd_24h_change": 1.50},
            "litecoin":      {"usd": 90.0,    "usd_24h_change": 2.46},
            "uniswap":       {"usd": 6.50,    "usd_24h_change": 10.72},
            "stellar":       {"usd": 0.29,    "usd_24h_change": 2.58},
        }

    # ── Merge metals: Yahoo Finance primary, metals.live supplement ──
    _METALS_FB = {
        "gold": 3290.0, "silver": 32.80, "platinum": 1020.0,
        "palladium": 1050.0, "copper": 4.58, "oil_wti": 78.40, "nat_gas": 2.18,
    }
    def _mval(key: str) -> dict:
        if key in metals_yahoo:
            return metals_yahoo[key]
        raw = float(metals_data.get(key, metals_data.get(key.upper(), 0.0)))
        fb = _METALS_FB.get(key, 0.0)
        price = raw if raw > 0 else fb
        return {"usd": round(price, 2), "usd_24h_change": 0.0}

    return {
        **crypto_data,
        "metals": {k: _mval(k) for k in _METALS_FB},
        "stocks": stocks_data,
    }


@router.get("/celery/task/{task_id}")
async def get_celery_task_status(task_id: str):
    from celery.result import AsyncResult
    from src.celery_app import celery_app as _celery_app
    task_result = AsyncResult(task_id, app=_celery_app)
    response = {"task_id": task_id, "status": task_result.status,
                "successful": task_result.successful(), "failed": task_result.failed()}
    if task_result.ready():
        try:
            response["result"] = task_result.get() if task_result.successful() else str(task_result.result)
        except Exception as e:
            response["result"] = f"Error: {str(e)}"
    return response


# ===================== Today's P&L =====================
@router.get("/stats/today-pnl")
async def get_today_pnl(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades = (
        db.query(TradeLog)
        .filter(TradeLog.user_id == uid, TradeLog.created_at >= today_start, TradeLog.pnl.isnot(None))
        .all()
    )
    total_pnl = sum(t.pnl for t in today_trades if t.pnl is not None)
    user = db.query(User).filter(User.id == uid).first()
    balance = user.balance_usdt or 0
    pct = (total_pnl / balance * 100) if balance > 0 else 0
    return {
        "today_pnl": round(total_pnl, 2),
        "today_pct": round(pct, 2),
        "trade_count": len(today_trades),
    }


# ===================== Cumulative P&L for bots chart =====================
@router.get("/bots/pnl-history")
async def get_bot_pnl_history(days: int = 30, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    since = datetime.utcnow() - timedelta(days=days)
    trades = (
        db.query(TradeLog)
        .filter(TradeLog.user_id == uid, TradeLog.created_at >= since, TradeLog.pnl.isnot(None))
        .order_by(TradeLog.created_at.asc())
        .all()
    )
    cumulative = 0.0
    chart = []
    for t in trades:
        cumulative += t.pnl or 0
        chart.append({
            "date": t.created_at.strftime("%b %d") if t.created_at else "",
            "pnl": round(t.pnl or 0, 2),
            "cumulative": round(cumulative, 2),
        })
    return {"history": chart, "total_pnl": round(cumulative, 2), "trade_count": len(trades)}


# ===================== Price Alerts =====================
@router.get("/alerts")
async def list_price_alerts(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    alerts = db.query(PriceAlert).filter(PriceAlert.user_id == uid).order_by(PriceAlert.created_at.desc()).all()
    return [{"id": a.id, "symbol": a.symbol, "target_price": a.target_price, "direction": a.direction,
             "is_active": a.is_active, "notify_browser": a.notify_browser, "notify_telegram": a.notify_telegram,
             "notify_whatsapp": a.notify_whatsapp, "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
             "created_at": a.created_at.isoformat()} for a in alerts]


@router.post("/alerts")
async def create_price_alert(data: PriceAlertCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    if data.direction not in ("above", "below"):
        raise HTTPException(status_code=400, detail="direction must be 'above' or 'below'")
    alert = PriceAlert(
        user_id=uid,
        symbol=data.symbol.upper(),
        target_price=data.target_price,
        direction=data.direction,
        notify_browser=data.notify_browser,
        notify_telegram=data.notify_telegram,
        notify_whatsapp=data.notify_whatsapp,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return {"id": alert.id, "symbol": alert.symbol, "target_price": alert.target_price,
            "direction": alert.direction, "is_active": alert.is_active, "created_at": alert.created_at.isoformat()}


@router.delete("/alerts/{alert_id}")
async def delete_price_alert(alert_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id, PriceAlert.user_id == uid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"status": "deleted"}


@router.post("/alerts/{alert_id}/toggle")
async def toggle_price_alert(alert_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user["id"] if isinstance(current_user, dict) else current_user.id
    alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id, PriceAlert.user_id == uid).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_active = not alert.is_active
    db.commit()
    return {"id": alert.id, "is_active": alert.is_active}


@router.post("/alerts/check")
async def check_price_alerts(db: Session = Depends(get_db)):
    """Background-callable: check all active alerts against current prices."""
    import httpx
    active = db.query(PriceAlert).filter(PriceAlert.is_active == True).all()
    if not active:
        return {"checked": 0, "triggered": 0}
    symbols = list({a.symbol for a in active})
    prices: dict = {}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get("https://api.coingecko.com/api/v3/simple/price",
                                 params={"ids": "bitcoin,ethereum,binancecoin,solana", "vs_currencies": "usd"})
            if r.status_code == 200:
                raw = r.json()
                prices = {"BTC/USDT": raw.get("bitcoin", {}).get("usd", 0),
                          "ETH/USDT": raw.get("ethereum", {}).get("usd", 0),
                          "BNB/USDT": raw.get("binancecoin", {}).get("usd", 0),
                          "SOL/USDT": raw.get("solana", {}).get("usd", 0)}
    except Exception:
        pass
    triggered = 0
    for alert in active:
        current = prices.get(alert.symbol, 0)
        if current == 0:
            continue
        fired = (alert.direction == "above" and current >= alert.target_price) or \
                (alert.direction == "below" and current <= alert.target_price)
        if fired:
            alert.is_active = False
            alert.triggered_at = datetime.utcnow()
            triggered += 1
            user = db.query(User).filter(User.id == alert.user_id).first()
            if user and alert.notify_telegram:
                prefs = dict(user.notification_preferences or {})
                tok = prefs.get("telegram_bot_token")
                cid = prefs.get("telegram_chat_id")
                if tok and cid:
                    try:
                        import httpx as _hx
                        async with _hx.AsyncClient(timeout=5) as c:
                            await c.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                                         json={"chat_id": cid, "text": f"🔔 FinAi Price Alert\n{alert.symbol} hit ${alert.target_price:,.2f} ({alert.direction})\nCurrent: ${current:,.2f}"})
                    except Exception:
                        pass
    db.commit()
    return {"checked": len(active), "triggered": triggered}


# ===================== AI Chat =====================

class AIChatRequest(BaseModel):
    message: str

@router.post("/ai/chat")
async def ai_chat(body: AIChatRequest, current_user=Depends(get_current_user)):
    """Chat with the FinAi AI assistant — uses Grok/GPT or falls back to local engine."""
    try:
        from src.conversation.agent import chat_with_agent
        reply = chat_with_agent(body.message, user_email=current_user.get("email"))
        return {"reply": reply}
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        try:
            from src.utils.local_llm import local_chat
            reply = local_chat(body.message, current_user.get("email"))
            return {"reply": reply}
        except Exception:
            return {"reply": "I'm Fin, your FinAi assistant. I'm having a moment — try again shortly!"}


# ===================== Subscriptions (User) =====================

class SubscriptionRequestBody(BaseModel):
    plan: str
    period: str
    amount_usdt: float
    payment_method: str
    auto_renew: bool = True

@router.post("/subscribe")
async def request_subscription(body: SubscriptionRequestBody, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from src.database.models import SubscriptionRequest
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    pending = db.query(SubscriptionRequest).filter(
        SubscriptionRequest.user_id == user.id,
        SubscriptionRequest.status == "pending",
    ).first()
    if pending:
        raise HTTPException(status_code=400, detail="You already have a pending subscription request.")
    req = SubscriptionRequest(
        user_id=user.id,
        plan=body.plan,
        period=body.period,
        amount_usdt=body.amount_usdt,
        payment_method=body.payment_method,
        auto_renew=body.auto_renew,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    _fire_admin_telegram_alert(
        f"💳 *New Subscription Request*\n\n"
        f"👤 User: `{user.email}`\n"
        f"📦 Plan: *{body.plan}* ({body.period})\n"
        f"💰 Amount: `${body.amount_usdt:,.2f} USDT`\n"
        f"💳 Payment: {body.payment_method}\n"
        f"🕐 Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"🔍 Status → *Pending Approval*",
        db=db,
    )
    return {"status": "pending", "id": req.id, "message": "Subscription request submitted, awaiting admin approval."}


# ===================== Admin — Subscriptions =====================

@router.get("/admin/subscriptions")
async def admin_list_subscriptions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from src.database.models import SubscriptionRequest
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    subs = db.query(SubscriptionRequest).order_by(SubscriptionRequest.created_at.desc()).limit(200).all()
    result = []
    for s in subs:
        u = db.query(User).filter(User.id == s.user_id).first()
        result.append({
            "id":             s.id,
            "user_id":        s.user_id,
            "user_email":     u.email if u else "—",
            "user_name":      f"{u.first_name or ''} {u.last_name or ''}".strip() if u else "—",
            "plan":           s.plan,
            "period":         s.period,
            "amount_usdt":    s.amount_usdt,
            "payment_method": s.payment_method,
            "status":         s.status,
            "auto_renew":     s.auto_renew,
            "note":           s.note,
            "created_at":     s.created_at.isoformat() if s.created_at else None,
            "processed_at":   s.processed_at.isoformat() if s.processed_at else None,
        })
    return {"subscriptions": result}


class SubActionBody(BaseModel):
    sub_id: int
    note: Optional[str] = None

@router.post("/admin/approve-subscription")
async def admin_approve_subscription(body: SubActionBody, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from src.database.models import SubscriptionRequest, Notification, Transaction
    from datetime import datetime, timedelta
    admin = db.query(User).filter(User.email == current_user["email"]).first()
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    req = db.query(SubscriptionRequest).filter(SubscriptionRequest.id == body.sub_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Subscription request not found")
    period_days = {"monthly": 30, "6month": 180, "yearly": 365}.get(req.period, 30)
    expires = datetime.utcnow() + timedelta(days=period_days)
    req.status = "approved"
    req.processed_at = datetime.utcnow()
    req.processed_by = admin.id
    req.note = body.note
    user = db.query(User).filter(User.id == req.user_id).first()
    if user:
        # ── Upgrade the user's subscription plan ──────────────────────────
        user.subscription = req.plan
        user.subscription_expires_at = expires
        user.subscription_period = req.period
        if hasattr(user, 'subscription_auto_renew'):
            user.subscription_auto_renew = getattr(req, 'auto_renew', True)

        # Auto tier upgrade based on subscription plan
        _plan_tier = {"pro": 1, "elite": 2, "elite+": 3, "elite plus": 3, "custom": 3}
        _min_tier = _plan_tier.get((req.plan or "free").lower(), 0)
        if (user.account_tier or 0) < _min_tier:
            user.account_tier = _min_tier
            logger.info(f"Auto-upgraded user {user.email} to Tier {_min_tier} for {req.plan} subscription")

        # ── Deduct wallet balance if paid via wallet ──────────────────────
        payment_method = getattr(req, 'payment_method', None)
        amount = getattr(req, 'amount_usdt', 0) or 0
        if payment_method == 'wallet' and amount > 0:
            user.balance_usdt = max(0.0, (user.balance_usdt or 0.0) - float(amount))
            # Record subscription transaction
            tx = Transaction(
                user_id=user.id,
                tx_type='subscription',
                method='wallet',
                asset='USDT',
                amount_usdt=float(amount),
                status='completed',
                note=f"Subscription: {req.plan} ({req.period})"
            )
            db.add(tx)

        # ── Push notification to user ─────────────────────────────────────
        plan_display = (req.plan or '').replace('_', ' ').replace('elite+', 'Elite+').title()
        period_display = {'monthly': 'Monthly', '6month': '6 Months', 'yearly': 'Yearly'}.get(req.period, req.period or 'Monthly')
        expires_str = expires.strftime('%b %d, %Y')
        notif = Notification(
            title=f"🎉 Subscription Activated — {plan_display} Plan",
            message=(
                f"Your {plan_display} subscription has been approved and activated! "
                f"Billing period: {period_display}. "
                f"Expires: {expires_str}. "
                f"Enjoy your upgraded features. Thank you for subscribing to FinAi!"
            ),
            target_all=False,
            target_user_id=user.id,
            read_by_user_ids=[],
            created_by=admin.id,
        )
        db.add(notif)

    db.commit()
    return {
        "status": "approved",
        "plan": req.plan,
        "expires_at": expires.isoformat(),
        "user_id": user.id if user else None,
    }


@router.post("/admin/reject-subscription")
async def admin_reject_subscription(body: SubActionBody, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from src.database.models import SubscriptionRequest, Notification
    from datetime import datetime
    admin = db.query(User).filter(User.email == current_user["email"]).first()
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    req = db.query(SubscriptionRequest).filter(SubscriptionRequest.id == body.sub_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Subscription request not found")
    req.status = "rejected"
    req.processed_at = datetime.utcnow()
    req.processed_by = admin.id
    req.note = body.note
    # Notify the user of rejection
    user = db.query(User).filter(User.id == req.user_id).first()
    if user:
        plan_display = (req.plan or '').replace('_', ' ').replace('elite+', 'Elite+').title()
        reason = body.note or "Please contact support for more information."
        notif = Notification(
            title=f"Subscription Request Not Approved — {plan_display}",
            message=(
                f"Unfortunately your {plan_display} subscription request could not be approved at this time. "
                f"Reason: {reason} "
                f"If you believe this is an error or need assistance, please open a support ticket."
            ),
            target_all=False,
            target_user_id=user.id,
            read_by_user_ids=[],
            created_by=admin.id,
        )
        db.add(notif)
    db.commit()
    return {"status": "rejected"}


# ===================== WhatsApp — Disconnect =====================


@router.post("/users/disconnect-telegram")
async def disconnect_telegram(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    prefs: dict = dict(user.notification_preferences or {})
    for k in ("telegram_chat_id", "telegram_verified", "telegram_first_name",
              "telegram_bot_token", "telegram_link_code", "telegram_link_expires"):
        prefs.pop(k, None)
    user.notification_preferences = prefs
    user.telegram_chat_id   = None
    user.telegram_connected = False
    db.commit()
    return {"status": "disconnected"}


@router.post("/users/disconnect-whatsapp")
async def disconnect_whatsapp(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    prefs: dict = dict(user.notification_preferences or {})
    for k in ("whatsapp_verified", "whatsapp_number", "whatsapp_pending_code",
              "whatsapp_otp_code", "whatsapp_otp_phone", "whatsapp_otp_expires",
              "whatsapp_code_expires"):
        prefs.pop(k, None)
    user.notification_preferences = prefs
    user.whatsapp_connected = False
    db.commit()
    return {"status": "disconnected"}


# ===================== Live Visitor Tracking =====================
import time as _vtime
import uuid as _uuid
_visitor_sessions: dict = {}
_VISITOR_TTL = 300  # 5 minutes


def _get_visitor_geo(ip: str):
    """Lookup country/city for an IP using free ip-api.com."""
    if not ip or ip in ("127.0.0.1", "::1", "localhost", "testclient"):
        return None, None
    try:
        import requests as _rq
        r = _rq.get(f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,city",
                    timeout=3)
        if r.status_code == 200:
            d = r.json()
            if d.get("status") == "success":
                return f"{d.get('countryCode','')  }|{d.get('country','Unknown')}", d.get("city", "")
    except Exception:
        pass
    return None, None


def _telegram_admin_new_visitor(ip: str, country: str, city: str, page: str):
    """Notify admin Telegram chat when a brand-new visitor arrives."""
    import os as _os, threading as _thr
    tok  = _os.getenv("TELEGRAM_BOT_TOKEN")
    cid  = _os.getenv("TELEGRAM_ADMIN_CHAT_ID") or _os.getenv("TELEGRAM_CHAT_ID")
    if not tok or not cid:
        return
    geo = ""
    if country:
        parts = country.split("|")
        geo = f" · {parts[-1] if len(parts) > 1 else country}"
        if city:
            geo += f", {city}"
    page_label = page if page and page != "/" else "Home"
    msg = (
        f"👁 New Visitor — FinAi\n"
        f"Page: {page_label}\n"
        f"IP: {ip or 'unknown'}{geo}\n"
        f"Time: {datetime.utcnow().strftime('%H:%M UTC')}"
    )
    def _send():
        try:
            import requests as _r
            _r.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                    json={"chat_id": cid, "text": msg}, timeout=5)
        except Exception:
            pass
    _thr.Thread(target=_send, daemon=True).start()


@router.post("/visitors/track")
async def track_visitor(request: Request):
    """Frontend beacon — call every 30 s. Creates or updates a visitor session."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    session_id   = body.get("sessionId") or str(_uuid.uuid4())
    current_page = body.get("page", "/")
    now          = _vtime.time()

    ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()

    existing = _visitor_sessions.get(session_id)
    if existing is None:
        country, city = _get_visitor_geo(ip)
        _visitor_sessions[session_id] = {
            "sessionId":    session_id,
            "ip":           ip,
            "country":      country,
            "city":         city,
            "currentPage":  current_page,
            "firstSeen":    now,
            "lastSeen":     now,
            "pagesVisited": [current_page],
        }
        _telegram_admin_new_visitor(ip, country or "", city or "", current_page)
    else:
        pages = existing["pagesVisited"]
        if not pages or pages[-1] != current_page:
            pages.append(current_page)
        existing["currentPage"] = current_page
        existing["lastSeen"]    = now

    # Purge stale sessions
    stale = [k for k, v in list(_visitor_sessions.items()) if now - v["lastSeen"] > _VISITOR_TTL]
    for k in stale:
        _visitor_sessions.pop(k, None)

    return {"sessionId": session_id, "ok": True}


@router.get("/admin/visitors/live")
async def get_live_visitors(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin-only: returns currently active visitor sessions (active in last 5 min)."""
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    now    = _vtime.time()
    active = []
    for s in _visitor_sessions.values():
        if now - s["lastSeen"] <= _VISITOR_TTL:
            active.append({
                "sessionId":    s["sessionId"],
                "ip":           s["ip"],
                "country":      s["country"],
                "city":         s["city"],
                "currentPage":  s["currentPage"],
                "firstSeen":    datetime.utcfromtimestamp(s["firstSeen"]).isoformat(),
                "lastSeen":     datetime.utcfromtimestamp(s["lastSeen"]).isoformat(),
                "timeSpentMs":  int((s["lastSeen"] - s["firstSeen"]) * 1000),
                "pagesVisited": s["pagesVisited"],
            })
    return {"count": len(active), "sessions": active}


# ===================== FinEventAI Bot =====================
class FinEventBotStartRequest(BaseModel):
    bot_name:           str   = "default"
    min_impact_score:   int   = 7
    tickers:            list  = ["BTC-USD", "ETH-USD"]
    capital_per_trade:  float = 500.0
    max_trades_per_day: int   = 10
    paper:              bool  = True
    sentiment_filter:   str   = "both"   # "bullish" | "bearish" | "both"


@router.post("/bots/finevent/start")
async def start_fin_event_bot(
    body: FinEventBotStartRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check subscription limit
    limits = _subscription_limits(user.subscription or "free")
    from src.trading.fin_event_bot import FinEventBotManager
    mgr = FinEventBotManager.instance()
    running = mgr.list_user_bots(user.id)
    running_count = sum(1 for b in running if b.get("running"))
    if running_count >= limits["event_bots"] and limits["event_bots"] > 0:
        raise HTTPException(status_code=403, detail=f"Your plan allows up to {limits['event_bots']} FinEventAI bots. Upgrade to add more.")
    if limits["event_bots"] == 0:
        raise HTTPException(status_code=403, detail="FinEventAI bots require a Pro subscription or higher.")

    result = mgr.start(
        user_id            = user.id,
        user_email         = user.email,
        bot_name           = body.bot_name,
        min_impact_score   = body.min_impact_score,
        tickers            = body.tickers,
        capital_per_trade  = body.capital_per_trade,
        max_trades_per_day = body.max_trades_per_day,
        paper              = body.paper,
        sentiment_filter   = body.sentiment_filter,
    )
    return {"status": "started", "message": result, "bot_name": body.bot_name}


@router.post("/bots/finevent/stop")
async def stop_fin_event_bot(
    bot_name: str = "default",
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from src.trading.fin_event_bot import FinEventBotManager
    mgr = FinEventBotManager.instance()
    result = mgr.stop(user.id, bot_name)
    return {"status": "stopped", "message": result}


@router.get("/bots/finevent/status")
async def get_fin_event_status(
    bot_name: str = "default",
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from src.trading.fin_event_bot import FinEventBotManager
    mgr = FinEventBotManager.instance()
    return mgr.get_status(user.id, bot_name)


@router.get("/bots/finevent/list")
async def list_fin_event_bots(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from src.trading.fin_event_bot import FinEventBotManager
    mgr = FinEventBotManager.instance()
    limits = _subscription_limits(user.subscription or "free")
    return {
        "bots": mgr.list_user_bots(user.id),
        "max_event_bots": limits["event_bots"],
        "subscription": user.subscription or "free",
    }


@router.get("/bots/finevent/trades")
async def get_fin_event_trades(
    limit: int = 50,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    trades = (
        db.query(TradeLog)
        .filter(TradeLog.user_id == user.id, TradeLog.reason.like("%FinEventAI%"))
        .order_by(TradeLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":         t.id,
            "ticker":     t.ticker,
            "action":     t.action,
            "price":      t.price,
            "qty":        t.qty,
            "pnl":        t.pnl,
            "reason":     t.reason,
            "paper":      t.paper,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in trades
    ]


# ===================== Referral Routes =====================

@router.get("/referral/stats")
async def get_referral_stats(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the current user's referral code, referred count, and total bonus earned."""
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    referred_users = db.query(User).filter(User.referred_by == user.referral_code).all()
    bonus_txns = db.query(Transaction).filter(
        Transaction.user_id == user.id,
        Transaction.tx_type == "bonus",
        Transaction.note.like("%Referral bonus%"),
    ).all()
    total_earned = sum(t.amount_usdt for t in bonus_txns)
    domain = os.getenv("REPLIT_DEV_DOMAIN") or os.getenv("REPLIT_DOMAINS", "").split(",")[0].strip()
    ref_link = f"https://{domain}/login?ref={user.referral_code}" if domain else f"/login?ref={user.referral_code}"
    return {
        "referral_code": user.referral_code,
        "referral_link": ref_link,
        "referred_count": len(referred_users),
        "total_earned_usdt": total_earned,
        "referred_users": [
            {"email": u.email, "joined_at": u.created_at.isoformat() if u.created_at else None}
            for u in referred_users
        ],
    }


# ===================== Admin Bonus Routes =====================

@router.get("/admin/bonuses", dependencies=[Depends(require_admin)])
async def get_admin_bonuses(db: Session = Depends(get_db)):
    from src.database.models import Bonus as _Bonus
    bonuses = db.query(_Bonus).order_by(_Bonus.created_at.desc()).all()
    result = []
    for b in bonuses:
        result.append({
            "id": b.id,
            "title": b.title,
            "bonus_type": b.bonus_type,
            "amount_usdt": b.amount_usdt,
            "target": b.target,
            "target_user_id": b.target_user_id,
            "target_user_email": b.target_user.email if b.target_user else None,
            "tier_required": b.tier_required,
            "note": b.note,
            "active": b.active,
            "granted_count": b.granted_count,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })
    return result


class BonusGrantRequest(BaseModel):
    title: str
    bonus_type: str           # manual_grant | referral_signup | tier_achievement
    amount_usdt: float
    target: str               # all | new_users | specific
    target_user_email: Optional[str] = None
    tier_required: Optional[int] = None
    note: Optional[str] = None
    task_description: Optional[str] = None
    require_claim: bool = False  # if True, users must click Claim; balance not credited until claimed
    grant_now: bool = True    # immediately credit eligible users (ignored if require_claim=True)


@router.post("/admin/bonuses/grant", dependencies=[Depends(require_admin)])
async def admin_grant_bonus(
    data: BonusGrantRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from src.database.models import Bonus as _Bonus
    admin = db.query(User).filter(User.email == current_user["email"]).first()
    target_user = None
    if data.target == "specific":
        if not data.target_user_email:
            raise HTTPException(status_code=400, detail="target_user_email required for specific target")
        target_user = db.query(User).filter(User.email == data.target_user_email).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")

    from src.database.models import UserBonusClaim as _UserBonusClaim
    bonus = _Bonus(
        title=data.title,
        bonus_type=data.bonus_type,
        amount_usdt=data.amount_usdt,
        target=data.target,
        target_user_id=target_user.id if target_user else None,
        tier_required=data.tier_required,
        note=data.note,
        task_description=data.task_description,
        require_claim=data.require_claim,
        active=True,
        granted_count=0,
        created_by=admin.id if admin else None,
    )
    db.add(bonus)
    db.flush()

    credited_count = 0

    # For referral_signup and tier_achievement, just save the rule (trigger later)
    if data.bonus_type in ("referral_signup", "tier_achievement") and not data.grant_now:
        db.commit()
        return {"status": "created", "bonus_id": bonus.id, "credited": 0}

    # Determine recipients for manual_grant
    if data.bonus_type == "manual_grant":
        if data.target == "all":
            recipients = db.query(User).filter(User.is_active == True, User.is_banned == False).all()
        elif data.target == "new_users":
            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(days=30)
            recipients = db.query(User).filter(User.created_at >= cutoff, User.is_active == True).all()
        elif data.target == "specific" and target_user:
            recipients = [target_user]
        else:
            recipients = []

        if data.require_claim:
            # Create claim records — user must click Claim to receive the USDT
            for u in recipients:
                db.add(_UserBonusClaim(
                    user_id=u.id,
                    bonus_id=bonus.id,
                    status="pending",
                ))
                db.add(Notification(
                    title=f"Task Available: {data.title}",
                    message=data.task_description or data.note or f"You have a new task available! Complete it to claim ${data.amount_usdt:.2f} USDT.",
                    target_all=False, target_user_id=u.id, created_by=None, read_by_user_ids=[],
                ))
                credited_count += 1
        elif data.grant_now:
            # Immediately credit balance
            for u in recipients:
                u.balance_usdt = (u.balance_usdt or 0) + data.amount_usdt
                db.add(Transaction(
                    user_id=u.id,
                    tx_type="bonus",
                    method="internal",
                    asset="USDT",
                    amount_usdt=data.amount_usdt,
                    status="completed",
                    note=f"{data.title} — bonus_id_{bonus.id}",
                ))
                db.add(Notification(
                    title=f"Bonus Received: ${data.amount_usdt:.2f} USDT",
                    message=data.note or f"An admin granted you a ${data.amount_usdt:.2f} USDT bonus. It has been added to your balance.",
                    target_all=False, target_user_id=u.id, created_by=None, read_by_user_ids=[],
                ))
                credited_count += 1

        bonus.granted_count = credited_count

    db.commit()
    return {
        "status": "task_created" if data.require_claim else "granted",
        "bonus_id": bonus.id,
        "credited": credited_count,
        "require_claim": data.require_claim,
    }


@router.get("/wallet/my-tasks")
async def get_my_bonus_tasks(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all pending claimable bonus tasks for the current user."""
    from src.database.models import UserBonusClaim as _UBC, Bonus as _Bonus
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        return []
    claims = (
        db.query(_UBC)
        .filter(_UBC.user_id == user.id, _UBC.status == "pending")
        .join(_Bonus, _UBC.bonus_id == _Bonus.id)
        .filter(_Bonus.active == True)
        .order_by(_UBC.assigned_at.desc())
        .all()
    )
    return [
        {
            "claim_id": c.id,
            "bonus_id": c.bonus_id,
            "title": c.bonus.title,
            "amount_usdt": c.bonus.amount_usdt,
            "task_description": c.bonus.task_description,
            "note": c.bonus.note,
            "assigned_at": c.assigned_at.isoformat() if c.assigned_at else None,
        }
        for c in claims
    ]


@router.post("/wallet/my-tasks/{bonus_id}/claim")
async def claim_bonus_task(bonus_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """User claims a bonus task — credits balance and marks claim as completed."""
    from src.database.models import UserBonusClaim as _UBC, Bonus as _Bonus
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    claim = db.query(_UBC).filter(
        _UBC.user_id == user.id,
        _UBC.bonus_id == bonus_id,
        _UBC.status == "pending",
    ).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Task not found or already claimed")
    bonus = db.query(_Bonus).filter(_Bonus.id == bonus_id, _Bonus.active == True).first()
    if not bonus:
        raise HTTPException(status_code=404, detail="Bonus no longer active")
    # Credit user balance
    user.balance_usdt = (user.balance_usdt or 0) + bonus.amount_usdt
    claim.status = "claimed"
    claim.claimed_at = datetime.utcnow()
    db.add(Transaction(
        user_id=user.id,
        tx_type="bonus",
        method="internal",
        asset="USDT",
        amount_usdt=bonus.amount_usdt,
        status="completed",
        note=f"{bonus.title} — task claimed — bonus_id_{bonus.id}",
    ))
    db.add(Notification(
        title=f"Bonus Claimed: ${bonus.amount_usdt:.2f} USDT",
        message=f"You successfully claimed your task reward! ${bonus.amount_usdt:.2f} USDT has been added to your balance.",
        target_all=False, target_user_id=user.id, created_by=None, read_by_user_ids=[],
    ))
    db.commit()
    return {"status": "claimed", "amount_usdt": bonus.amount_usdt, "new_balance": user.balance_usdt}


@router.patch("/admin/bonuses/{bonus_id}/toggle", dependencies=[Depends(require_admin)])
async def toggle_bonus(bonus_id: int, db: Session = Depends(get_db)):
    from src.database.models import Bonus as _Bonus
    b = db.query(_Bonus).filter(_Bonus.id == bonus_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bonus not found")
    b.active = not b.active
    db.commit()
    return {"id": b.id, "active": b.active}


@router.delete("/admin/bonuses/{bonus_id}", dependencies=[Depends(require_admin)])
async def delete_bonus(bonus_id: int, db: Session = Depends(get_db)):
    from src.database.models import Bonus as _Bonus
    b = db.query(_Bonus).filter(_Bonus.id == bonus_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bonus not found")
    db.delete(b)
    db.commit()
    return {"status": "deleted"}


# ─────────────────────── ADMIN: BONUS COMPLETION TRACKER ──────────────────

@router.get("/admin/bonus-claims", dependencies=[Depends(require_admin)])
async def get_bonus_claims(db: Session = Depends(get_db)):
    """Return every claimable bonus with the full list of user claim records."""
    from src.database.models import Bonus as _Bonus, UserBonusClaim as _Claim
    bonuses = (
        db.query(_Bonus)
        .filter(_Bonus.require_claim == True)
        .order_by(_Bonus.created_at.desc())
        .all()
    )
    result = []
    for b in bonuses:
        claims = db.query(_Claim).filter(_Claim.bonus_id == b.id).all()
        claim_rows = []
        for c in claims:
            u = c.user
            claim_rows.append({
                "claim_id":   c.id,
                "user_id":    c.user_id,
                "user_email": u.email if u else None,
                "user_name":  (u.first_name or u.username or u.email.split("@")[0]) if u else "—",
                "status":     c.status,
                "assigned_at": c.assigned_at.isoformat() if c.assigned_at else None,
                "claimed_at":  c.claimed_at.isoformat() if c.claimed_at else None,
            })
        result.append({
            "bonus_id":         b.id,
            "title":            b.title,
            "amount_usdt":      b.amount_usdt,
            "task_description": b.task_description,
            "active":           b.active,
            "created_at":       b.created_at.isoformat() if b.created_at else None,
            "claims":           claim_rows,
            "total_claims":     len(claim_rows),
            "claimed_count":    sum(1 for c in claim_rows if c["status"] == "claimed"),
            "pending_count":    sum(1 for c in claim_rows if c["status"] == "pending"),
        })
    return result


@router.delete("/admin/bonus-claims/{claim_id}", dependencies=[Depends(require_admin)])
async def revoke_bonus_claim(claim_id: int, db: Session = Depends(get_db)):
    """Revoke a pending bonus claim — removes it so the user loses access to this task."""
    from src.database.models import UserBonusClaim as _Claim
    claim = db.query(_Claim).filter(_Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status == "claimed":
        raise HTTPException(status_code=400, detail="Cannot revoke an already-claimed reward.")
    db.delete(claim)
    db.commit()
    return {"status": "revoked", "claim_id": claim_id}


# ─────────────────────── ADMIN: REFERRAL MANAGEMENT ───────────────────────

class _ReferralCodeUpdate(BaseModel):
    referral_code: str

@router.get("/admin/referrals", dependencies=[Depends(require_admin)])
async def admin_list_referrals(db: Session = Depends(get_db)):
    """List every user with their referral code, how many they referred, and a link."""
    import os as _os
    domain = _os.environ.get("REPLIT_DEV_DOMAIN", "")
    users = db.query(User).filter(User.referral_code != None).order_by(User.id.asc()).all()
    result = []
    for u in users:
        referred_count = db.query(User).filter(User.referred_by == u.referral_code).count()
        result.append({
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "referral_code": u.referral_code,
            "referred_count": referred_count,
            "referral_link": f"https://{domain}/login?ref={u.referral_code}" if domain else None,
            "account_tier": u.account_tier,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return result


@router.patch("/admin/referrals/{user_id}/code", dependencies=[Depends(require_admin)])
async def admin_update_referral_code(user_id: int, body: _ReferralCodeUpdate, db: Session = Depends(get_db)):
    """Assign a custom referral code to any user."""
    new_code = body.referral_code.strip().upper()
    if not new_code or len(new_code) < 4 or len(new_code) > 20:
        raise HTTPException(status_code=400, detail="Code must be 4–20 characters")
    import re as _re
    if not _re.match(r'^[A-Z0-9]+$', new_code):
        raise HTTPException(status_code=400, detail="Only uppercase letters and digits allowed")
    conflict = db.query(User).filter(User.referral_code == new_code, User.id != user_id).first()
    if conflict:
        raise HTTPException(status_code=409, detail="That code is already taken by another user")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    old_code = u.referral_code
    u.referral_code = new_code
    # Rewrite referred_by for users who used the old code
    if old_code:
        db.query(User).filter(User.referred_by == old_code).update({"referred_by": new_code})
    db.commit()
    import os as _os
    domain = _os.environ.get("REPLIT_DEV_DOMAIN", "")
    referred_count = db.query(User).filter(User.referred_by == new_code).count()
    return {
        "id": u.id,
        "email": u.email,
        "referral_code": u.referral_code,
        "referral_link": f"https://{domain}/login?ref={u.referral_code}" if domain else None,
        "referred_count": referred_count,
    }


# ===================== Ads =====================
class AdCreate(BaseModel):
    title: str
    description: Optional[str] = None
    ad_type: str = "banner"
    image_base64: Optional[str] = None
    link_url: Optional[str] = None
    is_active: bool = True


@router.get("/ads/active")
async def get_active_ad(db: Session = Depends(get_db)):
    """Return the latest active ad for display to users."""
    ad = db.query(Ad).filter(Ad.is_active == True).order_by(Ad.created_at.desc()).first()
    if not ad:
        return None
    return {
        "id": ad.id,
        "title": ad.title,
        "description": ad.description,
        "ad_type": ad.ad_type or "banner",
        "image_base64": ad.image_base64,
        "link_url": ad.link_url,
        "created_at": ad.created_at.isoformat() if ad.created_at else None,
    }


@router.get("/ads/active-all")
async def get_all_active_ads(db: Session = Depends(get_db)):
    """Return all active ads for cycling display."""
    ads = db.query(Ad).filter(Ad.is_active == True).order_by(Ad.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "ad_type": a.ad_type or "banner",
            "image_base64": a.image_base64,
            "link_url": a.link_url,
        }
        for a in ads
    ]


@router.get("/admin/ads", dependencies=[Depends(require_admin)])
async def admin_list_ads(db: Session = Depends(get_db)):
    ads = db.query(Ad).order_by(Ad.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "ad_type": a.ad_type or "banner",
            "image_base64": a.image_base64,
            "link_url": a.link_url,
            "is_active": a.is_active,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in ads
    ]


@router.post("/admin/ads", dependencies=[Depends(require_admin)])
async def admin_create_ad(data: AdCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    ad = Ad(
        title=data.title,
        description=data.description,
        ad_type=data.ad_type or "banner",
        image_base64=data.image_base64,
        link_url=data.link_url,
        is_active=data.is_active,
        created_by=user.id if user else None,
    )
    db.add(ad)
    db.commit()
    db.refresh(ad)
    return {"id": ad.id, "title": ad.title, "ad_type": ad.ad_type, "is_active": ad.is_active}


class AdUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    ad_type: Optional[str] = None
    image_base64: Optional[str] = None
    link_url: Optional[str] = None
    is_active: Optional[bool] = None

@router.patch("/admin/ads/{ad_id}", dependencies=[Depends(require_admin)])
async def admin_update_ad(ad_id: int, data: AdUpdate, db: Session = Depends(get_db)):
    ad = db.query(Ad).filter(Ad.id == ad_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    if data.title is not None: ad.title = data.title
    if data.description is not None: ad.description = data.description
    if data.ad_type is not None: ad.ad_type = data.ad_type
    if data.image_base64 is not None: ad.image_base64 = data.image_base64
    if data.link_url is not None: ad.link_url = data.link_url
    if data.is_active is not None: ad.is_active = data.is_active
    db.commit()
    db.refresh(ad)
    return {"id": ad.id, "title": ad.title, "ad_type": ad.ad_type, "is_active": ad.is_active}

@router.patch("/admin/ads/{ad_id}/toggle", dependencies=[Depends(require_admin)])
async def admin_toggle_ad(ad_id: int, db: Session = Depends(get_db)):
    ad = db.query(Ad).filter(Ad.id == ad_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    ad.is_active = not ad.is_active
    db.commit()
    return {"id": ad.id, "is_active": ad.is_active}


@router.delete("/admin/ads/{ad_id}", dependencies=[Depends(require_admin)])
async def admin_delete_ad(ad_id: int, db: Session = Depends(get_db)):
    ad = db.query(Ad).filter(Ad.id == ad_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    db.delete(ad)
    db.commit()
    return {"message": "Ad deleted"}


# ===================== Per-User Deposit Config =====================
class UserDepositConfigSave(BaseModel):
    bank_name: Optional[str] = None
    bank_address: Optional[str] = None
    bank_account: Optional[str] = None
    bank_routing: Optional[str] = None
    bank_swift: Optional[str] = None
    bank_name_beneficiary: Optional[str] = None
    btc_address: Optional[str] = None
    eth_address: Optional[str] = None
    usdt_trc20: Optional[str] = None
    note: Optional[str] = None


@router.get("/admin/users/{user_id}/deposit-config", dependencies=[Depends(require_admin)])
async def admin_get_user_deposit_config(user_id: int, db: Session = Depends(get_db)):
    import json as _json
    key = f"user_deposit_config_{user_id}"
    row = db.query(WalletConfig).filter(WalletConfig.key == key).first()
    if row and row.value:
        try:
            return _json.loads(row.value)
        except Exception:
            return {}
    return {}


@router.post("/admin/users/{user_id}/deposit-config", dependencies=[Depends(require_admin)])
async def admin_set_user_deposit_config(
    user_id: int,
    data: UserDepositConfigSave,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import json as _json
    admin = db.query(User).filter(User.email == current_user["email"]).first()
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    key = f"user_deposit_config_{user_id}"
    payload = {k: v for k, v in data.dict().items() if v is not None}
    row = db.query(WalletConfig).filter(WalletConfig.key == key).first()
    if row:
        row.value = _json.dumps(payload)
        row.updated_by = admin.id if admin else None
    else:
        row = WalletConfig(
            key=key,
            value=_json.dumps(payload),
            label=f"Deposit config for user #{user_id}",
            updated_by=admin.id if admin else None,
        )
        db.add(row)
    db.commit()
    return {"message": "Deposit config saved", "user_id": user_id}


@router.get("/wallet/my-deposit-config")
async def get_my_deposit_config(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return user-specific deposit config if admin has set one, otherwise empty dict."""
    import json as _json
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        return {}
    key = f"user_deposit_config_{user.id}"
    row = db.query(WalletConfig).filter(WalletConfig.key == key).first()
    if row and row.value:
        try:
            return _json.loads(row.value)
        except Exception:
            return {}
    return {}


@router.delete("/admin/referrals/{user_id}/code", dependencies=[Depends(require_admin)])
async def admin_reset_referral_code(user_id: int, db: Session = Depends(get_db)):
    """Generate a fresh random referral code for a user (replaces their current one)."""
    import secrets as _sec, string as _str
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    old_code = u.referral_code
    _alpha = _str.ascii_uppercase + _str.digits
    for _ in range(20):
        _code = ''.join(_sec.choice(_alpha) for _ in range(8))
        if not db.query(User).filter(User.referral_code == _code).first():
            break
    u.referral_code = _code
    if old_code:
        db.query(User).filter(User.referred_by == old_code).update({"referred_by": _code})
    db.commit()
    import os as _os
    domain = _os.environ.get("REPLIT_DEV_DOMAIN", "")
    return {
        "id": u.id,
        "email": u.email,
        "referral_code": u.referral_code,
        "referral_link": f"https://{domain}/login?ref={u.referral_code}" if domain else None,
    }


# ===================== Testimonials =====================

class TestimonialCreate(BaseModel):
    name: str
    role: Optional[str] = None
    content: str
    rating: int = 5
    avatar_initials: Optional[str] = None
    avatar_color: Optional[str] = None

@router.get("/testimonials")
async def list_testimonials(db: Session = Depends(get_db)):
    """Public endpoint — returns active testimonials for the About page."""
    items = (
        db.query(Testimonial)
        .filter(Testimonial.is_active == True)
        .order_by(Testimonial.created_at.asc())
        .all()
    )
    return [
        {
            "id": t.id,
            "name": t.name,
            "role": t.role,
            "content": t.content,
            "rating": t.rating,
            "avatar_initials": t.avatar_initials,
            "avatar_color": t.avatar_color,
        }
        for t in items
    ]

@router.post("/admin/testimonials", dependencies=[Depends(require_admin)])
async def admin_create_testimonial(body: TestimonialCreate, db: Session = Depends(get_db)):
    t = Testimonial(
        name=body.name,
        role=body.role,
        content=body.content,
        rating=max(1, min(5, body.rating)),
        avatar_initials=body.avatar_initials or body.name[:2].upper(),
        avatar_color=body.avatar_color or "#f0b90b",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name, "message": "Testimonial created"}

@router.put("/admin/testimonials/{testimonial_id}", dependencies=[Depends(require_admin)])
async def admin_update_testimonial(testimonial_id: int, body: TestimonialCreate, db: Session = Depends(get_db)):
    t = db.query(Testimonial).filter(Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    t.name = body.name
    t.role = body.role
    t.content = body.content
    t.rating = max(1, min(5, body.rating))
    t.avatar_initials = body.avatar_initials or body.name[:2].upper()
    t.avatar_color = body.avatar_color or "#f0b90b"
    db.commit()
    return {"id": t.id, "name": t.name, "message": "Testimonial updated"}

@router.patch("/admin/testimonials/{testimonial_id}/toggle", dependencies=[Depends(require_admin)])
async def admin_toggle_testimonial(testimonial_id: int, db: Session = Depends(get_db)):
    t = db.query(Testimonial).filter(Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    t.is_active = not t.is_active
    db.commit()
    return {"id": t.id, "is_active": t.is_active}

@router.delete("/admin/testimonials/{testimonial_id}", dependencies=[Depends(require_admin)])
async def admin_delete_testimonial(testimonial_id: int, db: Session = Depends(get_db)):
    t = db.query(Testimonial).filter(Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    db.delete(t)
    db.commit()
    return {"message": "Testimonial deleted"}



# ===================== WebSocket — Live Balance Push =====================

@router.websocket("/ws/live")
async def live_data_ws(websocket: WebSocket, token: str = "", db: Session = Depends(get_db)):
    import asyncio as _aio
    from jose import jwt as _jwt
    await websocket.accept()
    try:
        _secret = os.getenv("JWT_SECRET_KEY", "super-secret-key-change-in-production")
        _payload = _jwt.decode(token, _secret, algorithms=["HS256"])
        _email = _payload.get("sub")
        if not _email:
            await websocket.close(code=4001)
            return
        user = db.query(User).filter(User.email == _email).first()
        if not user:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return
    try:
        while True:
            db.refresh(user)
            await websocket.send_json({
                "type": "balance",
                "balance_usdt": float(user.balance_usdt or 0),
            })
            await _aio.sleep(3)
    except (WebSocketDisconnect, Exception):
        pass
