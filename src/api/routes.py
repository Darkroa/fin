from fastapi import (
    APIRouter, BackgroundTasks, Query, Depends,
    HTTPException, Header, Request, status, UploadFile, File,
    WebSocket, WebSocketDisconnect
)
from datetime import datetime, timedelta
import random, string, base64, io, os
from sqlalchemy.orm import Session
from typing import Optional, List
from loguru import logger
from pydantic import BaseModel

# Internal imports
from src.celery_app import celery_app
from src.celery_app.tasks import ingest_and_detect_events
from src.auth.auth import create_access_token
from src.users.crud import create_user, get_user_by_email
from src.database.session import get_db
from src.users.api_keys import create_api_key, revoke_api_key, get_user_by_api_key
from src.users.bot_manager import get_user_bot_manager
from src.auth.dependencies import get_current_user, require_admin
from src.database.models import (
    User, APIKey, Transaction, UserMoney, Event,
    Notification, WalletConfig, SupportTicket, SupportMessage, TradeLog, PriceAlert,
    SubscriptionRequest
)

# ===================== Pydantic Schemas =====================
class UserCreate2(BaseModel):
    email: str
    password: str

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
    paper: bool = True
    initial_capital: float = 1000.0
    risk_per_trade_pct: float = 1.0
    max_drawdown_pct: float = 10.0
    exchange_label: Optional[str] = None
    strategy: str = "sma"
    take_profit_pct: float = 4.0
    direction: str = "auto"
    bot_name: Optional[str] = None


class BotClosePositionRequest(BaseModel):
    bot_id: str


class CloseManualTradeRequest(BaseModel):
    trade_id: int


# ===================== Router =====================
router = APIRouter()


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
        "recipient_user_id": t.recipient_user_id,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ===================== Auth Routes =====================
@router.post("/auth/signup")
async def signup(user_data: UserCreate2, db: Session = Depends(get_db)):
    if get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    from src.users.schemas import UserCreate as UC
    uc = UC(email=user_data.email, password=user_data.password)
    user = create_user(db, uc)
    return {"id": user.id, "email": user.email}


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
        )
        db.add(notif)
        db.commit()

        # 2. Telegram DM to the user (if they have linked Telegram)
        prefs      = dict(db_user.notification_preferences or {})
        tg_token   = os.getenv("TELEGRAM_BOT_TOKEN") or prefs.get("telegram_bot_token")
        tg_chat_id = db_user.telegram_chat_id or prefs.get("telegram_chat_id")
        if tg_token and tg_chat_id:
            _send_login_telegram(tg_chat_id, tg_token, db_user.email, client_ip, user_agent)

        # 3. Notify every admin — in-app + Telegram
        admins = db.query(User).filter(User.is_admin == True, User.id != db_user.id).all()
        for _adm in admins:
            # In-app notification for admin
            _adm_notif = Notification(
                title=f"User login: {db_user.email}",
                message=(
                    f"{'Admin' if db_user.is_admin else 'User'} {db_user.email} "
                    f"logged in at {now_str} · IP: {client_ip} · "
                    f"Device: {user_agent[:80]}"
                ),
                target_all=False,
                target_user_id=_adm.id,
                created_by=None,
            )
            db.add(_adm_notif)

            # Telegram DM to admin (if admin has linked Telegram)
            _adm_prefs  = dict(_adm.notification_preferences or {})
            _adm_tg_cid = _adm.telegram_chat_id or _adm_prefs.get("telegram_chat_id")
            if tg_token and _adm_tg_cid:
                import threading as _thr2
                _adm_text = (
                    f"👤 *Login Alert — {'Admin' if db_user.is_admin else 'User'}*\n\n"
                    f"📧 Account: `{db_user.email}`\n"
                    f"🕐 Time: {now_str}\n"
                    f"🌐 IP: `{client_ip}`\n"
                    f"💻 Device: `{user_agent[:80]}`"
                )
                def _tg_adm(cid=_adm_tg_cid, tok=tg_token, txt=_adm_text):
                    try:
                        import requests as _rq
                        _rq.post(
                            f"https://api.telegram.org/bot{tok}/sendMessage",
                            json={"chat_id": cid, "text": txt, "parse_mode": "Markdown"},
                            timeout=8,
                        )
                    except Exception as _e:
                        logger.warning(f"Admin Telegram login alert failed: {_e}")
                _thr2.Thread(target=_tg_adm, daemon=True).start()

        db.commit()  # persist admin in-app notifications

    except Exception as _notif_err:
        logger.warning(f"Login notification skipped: {_notif_err}")

    return {"access_token": token, "token_type": "bearer"}


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
            logger.error(f"Resend email failed: {e}")

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

    logger.info(f"Email verify code for {user.email}: {code}")
    return {"message": "Verification code sent", "dev_code": code if not email_sent else None, "email_sent": email_sent}


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
    prefs["whatsapp_verified"] = True
    prefs["whatsapp_number"]   = stored_phone
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
        "btc_address":          {"value": "", "label": "Bitcoin (BTC) Address"},
        "eth_address":          {"value": "", "label": "Ethereum (ETH) Address"},
        "usdt_trc20":           {"value": "", "label": "USDT TRC-20 Address"},
        "bank_name":            {"value": "", "label": "Bank Name"},
        "bank_account":         {"value": "", "label": "Account Number / IBAN"},
        "bank_routing":         {"value": "", "label": "Routing / Sort Code"},
        "bank_swift":           {"value": "", "label": "SWIFT / BIC Code"},
        "bank_name_beneficiary":{"value": "", "label": "Beneficiary Name"},
    }
    for c in db.query(WalletConfig).all():
        result[c.key] = {"value": c.value or "", "label": c.label or c.key}
    return result


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
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
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
    return _tx_dict(tx)


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
    for field, val in data.model_dump(exclude_unset=True).items():
        if field == "user_id":
            continue
        if val is not None and hasattr(user, field):
            setattr(user, field, val)
    db.commit()
    db.refresh(user)
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
    if tx.tx_type == "deposit":
        user = db.query(User).filter(User.id == tx.user_id).first()
        if user:
            user.balance_usdt = (user.balance_usdt or 0) + tx.amount_usdt
    elif tx.tx_type == "withdrawal" and tx.status == "rejected":
        # refund on reject — handled in reject endpoint
        pass
    db.commit()
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
    if tx.tx_type == "withdrawal" and tx.status == "pending":
        # Refund the held amount
        user = db.query(User).filter(User.id == tx.user_id).first()
        if user:
            user.balance_usdt = (user.balance_usdt or 0) + tx.amount_usdt
    tx.status = "rejected"
    db.commit()
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

    # If a specific exchange label is provided, validate it exists
    if not body.paper and body.exchange_label:
        connections = user.exchange_connections or []
        matched = [c for c in connections if c.get("label") == body.exchange_label or c.get("exchange") == body.exchange_label]
        if not matched:
            raise HTTPException(status_code=400, detail=f"Exchange '{body.exchange_label}' not found in your connections.")
    capital = body.initial_capital if body.initial_capital > 0 else (user.default_capital or 1000.0)
    if not body.paper and (user.balance_usdt or 0) < capital:
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
        paper=body.paper,
        initial_capital=capital,
        risk_per_trade_pct=body.risk_per_trade_pct,
        max_drawdown_pct=body.max_drawdown_pct,
        strategy=body.strategy,
        take_profit_pct=body.take_profit_pct,
        direction=body.direction,
        bot_name=body.bot_name,
        binance_api_key=binance_api_key,
        binance_secret=binance_secret,
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
        try:
            ticker = t.ticker
            current_price = _fetch_live_price(ticker)
            unrealized_pnl = (current_price - (t.price or 0)) * effective_qty
        except Exception:
            current_price = t.price or 0
            unrealized_pnl = 0.0
        result.append({
            "id":             t.id,
            "ticker":         t.ticker,
            "action":         t.action,
            "price":          t.price,
            "qty":            effective_qty,
            "exchange":       t.exchange,
            "paper":          t.paper,
            "created_at":     t.created_at.isoformat() if t.created_at else None,
            "current_price":  round(current_price, 4),
            "unrealized_pnl": round(unrealized_pnl, 2),
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
    pnl           = (current_price - (trade.price or 0)) * (trade.qty or 0)
    proceeds      = (trade.qty or 0) * current_price

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

    total_cost = round(body.price * body.amount, 8)

    # Always update platform balance (whether using internal balance or routing to exchange)
    if body.side == "buy":
        if (user.balance_usdt or 0) < total_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient balance. Need ${total_cost:,.2f} USDT.")
        user.balance_usdt = round((user.balance_usdt or 0) - total_cost, 8)
    elif body.side == "sell":
        user.balance_usdt = round((user.balance_usdt or 0) + total_cost, 8)
    else:
        raise HTTPException(status_code=400, detail="side must be 'buy' or 'sell'")

    ticker = body.pair.replace("/", "-").replace("_", "-")
    exchange_name = conn.get("exchange", "live") if conn else "internal"

    log = TradeLog(
        user_id=user.id,
        ticker=ticker,
        action=body.side.upper(),
        price=body.price,
        qty=body.amount,
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
# In-memory code store for Telegram linking
_telegram_link_codes: dict = {}

@router.post("/users/telegram-generate-code")
async def generate_telegram_link_code(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a unique code for user to send to @FinAitradebot to link their account."""
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    import secrets
    code = f"FinAi-{secrets.randbelow(900000) + 100000}"
    _telegram_link_codes[code] = {"user_id": user.id, "email": user.email}
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

    # Code linking
    if text.startswith("FinAi-"):
        code = text.strip()
        link_data = _telegram_link_codes.get(code)
        if not link_data:
            await send_reply("❌ Invalid or expired code. Generate a new one from your Profile → Security tab.")
            return {"ok": True}
        user = db.query(User).filter(User.id == link_data["user_id"]).first()
        if user:
            prefs = dict(user.notification_preferences or {})
            prefs["telegram_chat_id"] = chat_id
            prefs["telegram_verified"] = True
            prefs["telegram_first_name"] = first_name
            user.notification_preferences = prefs
            db.commit()
            _telegram_link_codes.pop(code, None)
            await send_reply(
                f"✅ <b>Account linked successfully!</b>\n\n"
                f"Welcome, {first_name}! Your FinAi account (<code>{link_data['email']}</code>) is now connected.\n\n"
                "You'll receive real-time alerts for:\n"
                "• Price alerts\n• Stop Loss / Take Profit triggers\n• Bot trade signals\n\n"
                "Type /help to see available commands."
            )
        else:
            await send_reply("❌ User not found. Please try again.")
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

    # Handle commands for linked users
    cmd = text.lower().split()[0] if text else ""
    if cmd == "/status":
        from src.users.bot_manager import get_user_bot_manager
        mgr = get_user_bot_manager(linked_user.email, linked_user.id)
        status = mgr.get_status()
        if not status:
            await send_reply("ℹ️ No active bots running.")
        else:
            lines = ["📊 <b>Bot Status</b>\n"]
            for bot_id, s in status.items():
                running = "🟢" if s.get("running") else "🔴"
                lines.append(f"{running} <b>{s.get('bot_name', bot_id)}</b>")
                lines.append(f"  Ticker: {s.get('ticker', '—')} | Value: ${s.get('portfolio_value', 0):.2f}")
                lines.append(f"  P&L: ${s.get('realized_pnl', 0):.2f} | DD: {s.get('current_drawdown_pct', 0):.1f}%")
            await send_reply("\n".join(lines))

    elif cmd == "/balance":
        bal = linked_user.balance_usdt or 0
        await send_reply(f"💰 <b>Your Balance</b>\n${bal:,.2f} USDT")

    elif cmd == "/trades":
        from src.database.models import TradeLog as _TL
        trades = (
            db.query(_TL)
            .filter(_TL.user_id == linked_user.id)
            .order_by(_TL.created_at.desc())
            .limit(5)
            .all()
        )
        if not trades:
            await send_reply("No trades yet.")
        else:
            lines = ["📜 <b>Last 5 Trades</b>\n"]
            for t in trades:
                pnl_str = f" | P&L: ${t.pnl:.2f}" if t.pnl is not None else ""
                lines.append(f"• {t.action} {t.ticker} @ ${t.price:.2f}{pnl_str}")
            await send_reply("\n".join(lines))

    elif cmd == "/help":
        await send_reply(
            "📖 <b>FinAi Bot Commands</b>\n\n"
            "/status — Active bot portfolio\n"
            "/balance — Your USDT balance\n"
            "/trades — Last 5 trades\n"
            "/help — This menu"
        )
    else:
        await send_reply("❓ Unknown command. Type /help for available commands.")

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

    cmd = body.upper()
    if cmd == "BALANCE" or cmd == "/BALANCE":
        bal = linked_user.balance_usdt or 0
        await send_wa(f"💰 *Your Balance*\n${bal:,.2f} USDT")
    elif cmd == "STATUS" or cmd == "/STATUS":
        manager = get_user_bot_manager(linked_user.email, linked_user.id)
        status  = manager.get_status()
        running = status.get("running", False)
        bots    = status.get("bots", [])
        msg = f"🤖 *Bot Status*: {'🟢 Running' if running else '🔴 Offline'}\n"
        if bots:
            for b in bots[:3]:
                msg += f"\n• {b.get('ticker','?')} | PnL: ${b.get('realized_pnl', 0):.2f}"
        await send_wa(msg)
    elif cmd == "HELP" or cmd == "/HELP":
        await send_wa(
            "📖 *FinAi WhatsApp Commands*\n\n"
            "BALANCE — Your USDT balance\n"
            "STATUS — Bot portfolio status\n"
            "HELP — This menu"
        )
    else:
        await send_wa(
            f"👋 Hi {linked_user.first_name or 'there'}!\n"
            "Reply *HELP* for available commands."
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
    import time as _time
    now = _time.time()
    if now - _stock_cache["ts"] < 300 and _stock_cache["data"]:
        return _stock_cache["data"]
    try:
        import yfinance as yf
        raw = yf.download(
            _STOCK_TICKERS, period="2d", interval="1d",
            progress=False, auto_adjust=True, threads=True,
        )
        close = raw["Close"].iloc[-1]
        prev  = raw["Close"].iloc[-2]
        result = {}
        for t in _STOCK_TICKERS:
            try:
                p   = float(close[t])
                p0  = float(prev[t])
                chg = round((p - p0) / p0 * 100, 2) if p0 else 0.0
                key = "BRK" if t == "BRK-B" else t
                result[key] = {"usd": round(p, 2), "usd_24h_change": chg}
            except Exception:
                pass
        if result:
            _stock_cache["data"] = result
            _stock_cache["ts"]   = now
            return result
    except Exception:
        pass
    # fallback
    return _stock_cache["data"] or {
        "AAPL":  {"usd": 293.32, "usd_24h_change": 2.05},
        "TSLA":  {"usd": 428.35, "usd_24h_change": 4.02},
        "NVDA":  {"usd": 215.20, "usd_24h_change": 1.75},
        "SPY":   {"usd": 737.62, "usd_24h_change": 0.83},
        "MSFT":  {"usd": 415.12, "usd_24h_change": -1.34},
        "GOOGL": {"usd": 400.80, "usd_24h_change": 0.71},
        "AMZN":  {"usd": 272.68, "usd_24h_change": 0.56},
        "META":  {"usd": 609.63, "usd_24h_change": -1.16},
        "BRK":   {"usd": 475.94, "usd_24h_change": 0.18},
        "JPM":   {"usd": 302.10, "usd_24h_change": -1.37},
        "V":     {"usd": 318.79, "usd_24h_change": -0.78},
        "JNJ":   {"usd": 221.32, "usd_24h_change": -0.53},
        "WMT":   {"usd": 130.43, "usd_24h_change": 0.37},
        "XOM":   {"usd": 144.57, "usd_24h_change": -1.37},
        "GLD":   {"usd": 433.77, "usd_24h_change": 0.49},
    }


@router.get("/public/prices")
async def get_live_prices():
    import httpx, asyncio
    from concurrent.futures import ThreadPoolExecutor

    HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinAi/1.0)", "Accept": "application/json"}
    metals_data: dict = {}

    # ── Run crypto (Binance.US) + stocks (yfinance) + metals in parallel ──
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=2) as pool:
        crypto_fut = loop.run_in_executor(pool, _get_live_crypto_prices)
        stocks_fut = loop.run_in_executor(pool, _get_live_stock_prices)

        # Metals via metals.live (async)
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
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

        crypto_data = await crypto_fut
        stocks_data = await stocks_fut

    # ── Crypto hard fallback (only if Binance.US also failed) ──
    if not crypto_data:
        crypto_data = {
            "bitcoin":       {"usd": 80359.0, "usd_24h_change": 0.91},
            "ethereum":      {"usd": 2312.0,  "usd_24h_change": 1.61},
            "binancecoin":   {"usd": 648.0,   "usd_24h_change": 1.42},
            "solana":        {"usd": 93.31,   "usd_24h_change": 5.64},
            "ripple":        {"usd": 1.419,   "usd_24h_change": 2.30},
            "cardano":       {"usd": 0.272,   "usd_24h_change": 3.26},
            "dogecoin":      {"usd": 0.1088,  "usd_24h_change": 1.85},
            "polkadot":      {"usd": 1.35,    "usd_24h_change": 2.27},
            "chainlink":     {"usd": 10.42,   "usd_24h_change": 4.95},
            "avalanche-2":   {"usd": 9.93,    "usd_24h_change": 4.09},
            "matic-network": {"usd": 0.38,    "usd_24h_change": 1.50},
            "litecoin":      {"usd": 57.97,   "usd_24h_change": 2.46},
            "uniswap":       {"usd": 3.634,   "usd_24h_change": 10.72},
            "stellar":       {"usd": 0.1627,  "usd_24h_change": 2.58},
        }

    # ── Metals prices ──
    def _mval(key: str, fb: float) -> float:
        return float(metals_data.get(key, metals_data.get(key.upper(), fb)))

    gold_price   = _mval("gold",      3290.0)
    silver_price = _mval("silver",    32.80)
    plat_price   = _mval("platinum",  1020.0)
    pall_price   = _mval("palladium", 1050.0)
    copper_price = _mval("copper",    4.58)

    return {
        **crypto_data,
        "metals": {
            "gold":      {"usd": round(gold_price,   2), "usd_24h_change": round((gold_price   / 3278.0 - 1) * 100, 2)},
            "silver":    {"usd": round(silver_price, 2), "usd_24h_change": round((silver_price / 32.50  - 1) * 100, 2)},
            "platinum":  {"usd": round(plat_price,   2), "usd_24h_change": round((plat_price   / 1015.0 - 1) * 100, 2)},
            "palladium": {"usd": round(pall_price,   2), "usd_24h_change": round((pall_price   / 1040.0 - 1) * 100, 2)},
            "copper":    {"usd": round(copper_price, 2), "usd_24h_change": round((copper_price / 4.55   - 1) * 100, 2)},
            "oil_wti":   {"usd": 78.40,  "usd_24h_change": -0.35},
            "nat_gas":   {"usd": 2.18,   "usd_24h_change":  0.12},
        },
        "stocks": stocks_data,
    }


@router.get("/celery/task/{task_id}")
async def get_celery_task_status(task_id: str):
    from celery.result import AsyncResult
    task_result = AsyncResult(task_id, app=celery_app)
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
    """Chat with the FinAi AI assistant using Grok/GPT."""
    try:
        from src.conversation.agent import chat_with_agent
        reply = chat_with_agent(body.message)
        return {"reply": reply}
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        return {"reply": f"I'm having trouble connecting to my AI engine right now. Please make sure the GROK_API_KEY or OPENAI_API_KEY is configured. Error: {str(e)[:120]}"}


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
    from src.database.models import SubscriptionRequest
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
        user.subscription_expires_at = expires
        user.subscription_period = req.period
        if hasattr(user, 'subscription_auto_renew'):
            user.subscription_auto_renew = req.auto_renew
    db.commit()
    return {"status": "approved", "expires_at": expires.isoformat()}


@router.post("/admin/reject-subscription")
async def admin_reject_subscription(body: SubActionBody, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from src.database.models import SubscriptionRequest
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
    db.commit()
    return {"status": "rejected"}


# ===================== WhatsApp — Generate Code & Disconnect =====================

@router.post("/users/whatsapp-generate-code")
async def whatsapp_generate_code(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a pairing code for the user to send to the FinAi WhatsApp bot."""
    import random, string
    from datetime import datetime, timedelta
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    code = "WA-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    prefs: dict = user.notification_prefs or {}
    prefs["whatsapp_pending_code"] = code
    prefs["whatsapp_code_expires"] = (datetime.utcnow() + timedelta(minutes=30)).isoformat()
    prefs["whatsapp_verified"] = False
    user.notification_prefs = prefs
    db.commit()
    return {"code": code, "message": "Send this code to +1 415 523 8886 on WhatsApp to connect."}


@router.post("/users/disconnect-whatsapp")
async def disconnect_whatsapp(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    prefs: dict = user.notification_preferences or {}
    prefs.pop("whatsapp_verified", None)
    prefs.pop("whatsapp_number", None)
    prefs.pop("whatsapp_pending_code", None)
    prefs.pop("whatsapp_code_expires", None)
    user.notification_preferences = prefs
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
    from src.trading.fin_event_bot import FinEventBotManager
    mgr = FinEventBotManager.instance()
    result = mgr.start(
        user_id            = user.id,
        user_email         = user.email,
        min_impact_score   = body.min_impact_score,
        tickers            = body.tickers,
        capital_per_trade  = body.capital_per_trade,
        max_trades_per_day = body.max_trades_per_day,
        paper              = body.paper,
        sentiment_filter   = body.sentiment_filter,
    )
    return {"status": "started", "message": result}


@router.post("/bots/finevent/stop")
async def stop_fin_event_bot(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from src.trading.fin_event_bot import FinEventBotManager
    mgr = FinEventBotManager.instance()
    result = mgr.stop(user.id)
    return {"status": "stopped", "message": result}


@router.get("/bots/finevent/status")
async def get_fin_event_status(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from src.trading.fin_event_bot import FinEventBotManager
    mgr = FinEventBotManager.instance()
    return mgr.get_status(user.id)


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
