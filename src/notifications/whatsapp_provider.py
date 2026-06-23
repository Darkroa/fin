"""
WhatsApp notification provider.
Primary: Evolution API (self-hosted Baileys bridge).
Fallback: Twilio WhatsApp sandbox.
"""

import logging
import os
import re

import requests

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Evolution API helpers
# ──────────────────────────────────────────────────────────────────────────────

def _ev_base() -> str:
    return os.getenv("EVOLUTION_API_URL", "http://localhost:8080").rstrip("/")

def _ev_key() -> str:
    return os.getenv("EVOLUTION_API_KEY", "")

def _ev_instance() -> str:
    return os.getenv("EVOLUTION_INSTANCE", "FinAiEvobots")

def _ev_headers() -> dict:
    return {"apikey": _ev_key(), "Content-Type": "application/json"}


def _ev_configured() -> bool:
    return bool(_ev_base() and _ev_key())


def evolution_ensure_instance() -> dict:
    """
    Check whether the Evolution instance exists and create it if not.
    Returns {"ok": True, "created": bool} or {"error": "..."}.
    Called automatically by evolution_qr() and evolution_status().
    """
    base = _ev_base()
    if not _ev_configured():
        return {"error": "Evolution API not configured (EVOLUTION_API_KEY missing)"}

    instance_name = _ev_instance()

    # Check if instance already exists
    try:
        chk = requests.get(
            f"{base}/instance/connectionState/{instance_name}",
            headers=_ev_headers(),
            timeout=10,
        )
        if chk.status_code == 200:
            return {"ok": True, "created": False}
    except requests.exceptions.ConnectionError:
        return {"error": f"Cannot reach Evolution API at {base}. Make sure your Evolution API server is running and the URL is correct."}
    except requests.exceptions.Timeout:
        return {"error": f"Evolution API at {base} timed out."}
    except Exception as exc:
        return {"error": f"Evolution API error: {exc}"}

    # Instance not found → create it
    try:
        logger.info(f"Creating Evolution instance '{instance_name}'…")
        create = requests.post(
            f"{base}/instance/create",
            headers=_ev_headers(),
            json={
                "instanceName": instance_name,
                "qrcode": True,
                "integration": "WHATSAPP-BAILEYS",
            },
            timeout=20,
        )
        if create.status_code in (200, 201):
            logger.info(f"Evolution instance '{instance_name}' created")
            return {"ok": True, "created": True}
        return {
            "error": f"Failed to create instance ({create.status_code}): {create.text[:300]}"
        }
    except requests.exceptions.ConnectionError:
        return {"error": f"Cannot reach Evolution API at {base}. Make sure your Evolution API server is running and the URL is correct."}
    except requests.exceptions.Timeout:
        return {"error": f"Evolution API at {base} timed out. The server may be overloaded or unreachable."}
    except Exception as exc:
        return {"error": f"Evolution API error: {exc}"}


def evolution_send(phone: str, text: str) -> bool:
    """Send a WhatsApp message via Evolution API. Returns True on success."""
    if not _ev_configured():
        return False

    number = _clean_phone(phone)
    if not number:
        return False
    try:
        resp = requests.post(
            f"{_ev_base()}/message/sendText/{_ev_instance()}",
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
    Ensure the instance exists, then fetch its QR code.
    Returns dict with keys: base64 (data URI), code (pairing code), status.
    """
    base = _ev_base()
    if not _ev_configured():
        return {"error": "Evolution API not configured (EVOLUTION_API_KEY missing)"}

    # Make sure the instance exists before asking for QR
    ensure = evolution_ensure_instance()
    if "error" in ensure:
        return ensure

    try:
        resp = requests.get(
            f"{base}/instance/connect/{_ev_instance()}",
            headers=_ev_headers(),
            timeout=20,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Evolution v2 nests QR under "base64" or "qrcode.base64"
            b64  = data.get("base64") or data.get("qrcode", {}).get("base64", "")
            code = data.get("code")  or data.get("qrcode", {}).get("code",   "")
            return {"base64": b64, "code": code, "status": "qr_ready"}
        return {"error": f"Evolution API returned {resp.status_code}: {resp.text[:300]}"}
    except Exception as exc:
        return {"error": str(exc)}


def evolution_status() -> dict:
    """
    Return the connection state of the Evolution instance.
    Auto-creates the instance if it does not exist.
    Possible states: open, close, connecting, qr, not_configured, error.
    Also returns config metadata so the admin panel can display it.
    """
    base = _ev_base()
    key  = _ev_key()
    meta = {
        "api_url":      base,
        "instanceName": _ev_instance(),
        "api_key_set":  bool(key),
    }

    if not base or not key:
        return {"state": "not_configured", **meta}

    # Ensure instance exists (creates it if missing)
    ensure = evolution_ensure_instance()
    if "error" in ensure:
        return {"state": "error", "detail": ensure["error"], **meta}

    try:
        resp = requests.get(
            f"{base}/instance/connectionState/{_ev_instance()}",
            headers=_ev_headers(),
            timeout=10,
        )
        if resp.status_code == 200:
            data  = resp.json()
            state = (
                data.get("instance", {}).get("state")
                or data.get("state")
                or "unknown"
            )
            return {"state": state, "instance": _ev_instance(), **meta}
        return {
            "state": "error",
            "detail": f"{resp.status_code}: {resp.text[:200]}",
            **meta,
        }
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
        from twilio.rest import Client
        client = Client(sid, token)
        client.messages.create(
            body=text,
            from_=f"whatsapp:{frm}",
            to=f"whatsapp:{to}",
        )
        return True
    except Exception as exc:
        logger.error(f"Twilio send error: {exc}")
        return False


# ──────────────────────────────────────────────────────────────────────────────
# Unified send (Evolution first, Twilio fallback)
# ──────────────────────────────────────────────────────────────────────────────

def send_whatsapp(phone: str, text: str) -> bool:
    """Try Evolution API first; fall back to Twilio."""
    if _ev_configured() and evolution_send(phone, text):
        return True
    return twilio_send(phone, text)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _clean_phone(phone: str) -> str:
    """Strip non-digit characters; return digits only."""
    return re.sub(r"\D", "", phone or "")
