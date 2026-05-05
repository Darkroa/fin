from fastapi import (
    APIRouter, BackgroundTasks, Query, Depends,
    HTTPException, Header, Request, status, UploadFile, File
)
from datetime import datetime, timedelta
import random, string, base64, io
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
    Notification, WalletConfig, SupportTicket, SupportMessage
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


@router.post("/auth/login")
async def login(user_data: UserCreate2, db: Session = Depends(get_db)):
    db_user = get_user_by_email(db, user_data.email)
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if not db_user.verify_password(user_data.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if db_user.is_banned:
        raise HTTPException(status_code=403, detail="Account banned. Contact support.")
    token = create_access_token({"sub": db_user.email})
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
    # In production, send email here. For now, return code in response (dev mode)
    logger.info(f"Email verify code for {user.email}: {code}")
    return {"message": "Verification code sent", "dev_code": code}


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
    configs = db.query(WalletConfig).all()
    return {c.key: {"value": c.value, "label": c.label} for c in configs}


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
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.balance_usdt < data.amount_usdt:
        raise HTTPException(status_code=400, detail="Insufficient balance")
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
async def jwt_start_bot(ticker: str = Query(default="BTC-USD"), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    manager = get_user_bot_manager(user.email, user.id)
    result = manager.start_bot(ticker, paper=False)
    return {"status": "success", "message": result, "bot_status": manager.get_status()}


@router.post("/bots/stop")
async def jwt_stop_bot(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    manager = get_user_bot_manager(user.email, user.id)
    return {"status": "success", "message": manager.stop_bot()}


@router.get("/bots/status")
async def jwt_bot_status(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return get_user_bot_manager(user.email, user.id).get_status()


@router.get("/bots/trades")
async def jwt_get_trades(limit: int = 20, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    trades = get_user_bot_manager(user.email, user.id).get_trades(limit)
    return {"trades": trades}


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
