"""
WhatsApp messaging provider.
Primary:  Evolution API (self-hosted, QR-connected WhatsApp)
Fallback: Twilio WhatsApp API
"""
import os
import re
import requests
from loguru import logger


def _clean_phone(phone: str) -> str:
    """Strip '+', spaces, and dashes — Evolution API wants digits only."""
    return re.sub(r"[^\d]", "", phone)


# ──────────────────────────────────────────────────────────────────────────────
# Evolution API helpers
# ──────────────────────────────────────────────────────────────────────────────

def _ev_base() -> str:
    return os.getenv("EVOLUTION_API_URL", "").rstrip("/")

def _ev_key() -> str:
    return os.getenv("EVOLUTION_API_KEY", "")

def _ev_instance() -> str:
    return os.getenv("EVOLUTION_INSTANCE", "finai")

def _ev_headers() -> dict:
    return {"apikey": _ev_key(), "Content-Type": "application/json"}


def evolution_send(phone: str, text: str) -> bool:
    """Send a WhatsApp message via Evolution API. Returns True on success."""
    base = _ev_base()
    if not base or not _ev_key():
        return False
    number = _clean_phone(phone)
    if not number:
        return False
    try:
        resp = requests.post(
            f"{base}/message/sendText/{_ev_instance()}",
            headers=_ev_headers(),
            json={"number": number, "text": text},
            timeout=10,
        )
        if resp.status_code in (200, 201):
            logger.info(f"Evolution API: message sent to {number}")
            return True
        logger.warning(f"Evolution API send failed ({resp.status_code}): {resp.text[:200]}")
        return False
    except Exception as exc:
        logger.error(f"Evolution API send error: {exc}")
        return False


def evolution_qr() -> dict:
    """
    Fetch the QR code for the Evolution API instance.
    Returns dict with keys: base64 (data URI), code (pairing code), status.
    """
    base = _ev_base()
    if not base or not _ev_key():
        return {"error": "Evolution API not configured (EVOLUTION_API_URL / EVOLUTION_API_KEY missing)"}
    try:
        resp = requests.get(
            f"{base}/instance/connect/{_ev_instance()}",
            headers=_ev_headers(),
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "base64": data.get("base64") or data.get("qrcode", {}).get("base64", ""),
                "code":   data.get("code") or data.get("qrcode", {}).get("code", ""),
                "status": "qr_ready",
            }
        return {"error": f"Evolution API returned {resp.status_code}: {resp.text[:200]}"}
    except Exception as exc:
        return {"error": str(exc)}


def evolution_status() -> dict:
    """
    Return the connection state of the Evolution instance.
    Possible states: open, close, connecting, qr.
    Also returns config metadata (api_url, instance, api_key_set) so the
    admin panel can confirm which secrets are in place without leaking values.
    """
    base = _ev_base()
    key  = _ev_key()
    meta = {
        "api_url":     base or None,
        "instanceName": _ev_instance(),
        "api_key_set": bool(key),
    }
    if not base or not key:
        return {"state": "not_configured", **meta}
    try:
        resp = requests.get(
            f"{base}/instance/connectionState/{_ev_instance()}",
            headers=_ev_headers(),
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            state = (
                data.get("instance", {}).get("state")
                or data.get("state")
                or "unknown"
            )
            return {"state": state, "instance": _ev_instance(), **meta}
        return {"state": "error", "detail": f"{resp.status_code}: {resp.text[:200]}", **meta}
    except Exception as exc:
        return {"state": "error", "detail": str(exc), **meta}


# ──────────────────────────────────────────────────────────────────────────────
# Twilio fallback
# ──────────────────────────────────────────────────────────────────────────────

def twilio_send(phone: str, text: str) -> bool:
    """Send a WhatsApp message via Twilio. Returns True on success."""
    sid   = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    frm   = os.getenv("TWILIO_WHATSAPP_NUMBER", "+14155238886").strip()
    if not sid or not token:
        return False
    to = phone if phone.startswith("+") else f"+{_clean_phone(phone)}"
    try:
        resp = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            auth=(sid, token),
            data={"From": f"whatsapp:{frm}", "To": f"whatsapp:{to}", "Body": text},
            timeout=10,
        )
        if resp.status_code in (200, 201):
            logger.info(f"Twilio WhatsApp: message sent to {to}")
            return True
        logger.warning(f"Twilio send failed ({resp.status_code}): {resp.text[:200]}")
        return False
    except Exception as exc:
        logger.error(f"Twilio send error: {exc}")
        return False


# ──────────────────────────────────────────────────────────────────────────────
# Public API — always call this
# ──────────────────────────────────────────────────────────────────────────────

def send_whatsapp(phone: str, text: str) -> bool:
    """
    Send a WhatsApp message.
    Tries Evolution API first; if it fails or is not configured, falls back to Twilio.
    Returns True if at least one provider succeeded.
    """
    if evolution_send(phone, text):
        return True
    logger.info("Evolution API unavailable — falling back to Twilio")
    return twilio_send(phone, text)
