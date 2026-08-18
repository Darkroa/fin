import hashlib
import hmac
import os
import re
import time
from collections import OrderedDict

from fastapi import HTTPException, Request


NONCE_TTL_SECONDS = max(30, int(os.getenv("MT5_NONCE_TTL_SECONDS", "90")))
_seen_nonces: OrderedDict[str, int] = OrderedDict()
_NONCE_RE = re.compile(r"^[a-f0-9]{16,128}$")


def _purge_nonces(now: int) -> None:
    cutoff = now - NONCE_TTL_SECONDS
    while _seen_nonces:
        _, created_at = next(iter(_seen_nonces.items()))
        if created_at >= cutoff:
            break
        _seen_nonces.popitem(last=False)


def authenticate_request(request: Request, raw_body: bytes) -> None:
    """
    Authenticate backend-to-bridge traffic.

    The request must include:
      X-MT5-BRIDGE-KEY
      X-MT5-Timestamp
      X-MT5-Nonce
      X-MT5-Signature = HMAC-SHA256(secret, timestamp.nonce.body)

    Credentials are deliberately not logged or included in error messages.
    """
    bridge_key = os.getenv("MT5_BRIDGE_KEY", "").strip()
    signing_secret = os.getenv("MT5_BRIDGE_SIGNING_SECRET", "").strip()
    if not bridge_key or not signing_secret:
        raise HTTPException(status_code=503, detail="Bridge security is not configured")

    supplied_key = request.headers.get("X-MT5-BRIDGE-KEY", "")
    if not hmac.compare_digest(supplied_key, bridge_key):
        raise HTTPException(status_code=401, detail="Invalid bridge credentials")

    timestamp_text = request.headers.get("X-MT5-Timestamp", "")
    nonce = request.headers.get("X-MT5-Nonce", "")
    supplied_signature = request.headers.get("X-MT5-Signature", "")
    try:
        timestamp = int(timestamp_text)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid bridge timestamp")

    now = int(time.time())
    if abs(now - timestamp) > NONCE_TTL_SECONDS:
        raise HTTPException(status_code=401, detail="Expired bridge request")
    if not _NONCE_RE.fullmatch(nonce):
        raise HTTPException(status_code=401, detail="Invalid bridge nonce")

    _purge_nonces(now)
    if nonce in _seen_nonces:
        raise HTTPException(status_code=409, detail="Duplicate bridge request")

    signed_message = f"{timestamp}.{nonce}.".encode("utf-8") + raw_body
    expected_signature = hmac.new(
        signing_secret.encode("utf-8"),
        signed_message,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(supplied_signature, expected_signature):
        raise HTTPException(status_code=401, detail="Invalid bridge signature")

    _seen_nonces[nonce] = now


async def require_signed_request(request: Request) -> None:
    raw_body = await request.body()
    authenticate_request(request, raw_body)