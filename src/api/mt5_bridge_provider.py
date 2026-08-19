"""Authenticated client for the optional Windows MetaTrader bridge.

The bridge is deliberately an adapter, not a second browser-facing API. Broker
credentials live only in the authenticated backend request and are encrypted
before a bridge-backed connection is stored.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

import httpx

from src.api.mt5_credentials import decrypt_mt5_password, encrypt_mt5_password


class MT5BridgeProviderError(RuntimeError):
    """Raised when the configured Windows bridge cannot complete an operation."""


def _config() -> tuple[str, str, str]:
    url = os.getenv("MT5_BRIDGE_URL", "").strip().rstrip("/")
    key = os.getenv("MT5_BRIDGE_KEY", "").strip()
    secret = os.getenv("MT5_BRIDGE_SIGNING_SECRET", "").strip()
    if not url or not key or not secret:
        raise MT5BridgeProviderError(
            "MT5 bridge is not configured. Set MT5_BRIDGE_URL, "
            "MT5_BRIDGE_KEY, and MT5_BRIDGE_SIGNING_SECRET."
        )
    return url, key, secret


def _credentials(connection: dict[str, Any]) -> dict[str, Any]:
    try:
        password = decrypt_mt5_password(connection)
    except Exception as exc:
        raise MT5BridgeProviderError(str(exc)) from exc
    return {
        "account_number": str(connection.get("account_number") or "").strip(),
        "server": str(connection.get("server") or "").strip(),
        "password": password,
        "broker": connection.get("broker"),
        "is_demo": bool(connection.get("is_demo", True)),
        "allow_live_trading": bool(connection.get("allow_live_trading", False)),
    }


async def _request(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url, bridge_key, signing_secret = _config()
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(16)
    message = f"{timestamp}.{nonce}.".encode() + body
    signature = hmac.new(signing_secret.encode(), message, hashlib.sha256).hexdigest()
    headers = {
        "content-type": "application/json",
        "X-MT5-BRIDGE-KEY": bridge_key,
        "X-MT5-Timestamp": timestamp,
        "X-MT5-Nonce": nonce,
        "X-MT5-Signature": signature,
    }
    try:
        async with httpx.AsyncClient(timeout=float(os.getenv("MT5_BRIDGE_TIMEOUT_SECONDS", "30"))) as client:
            response = await client.post(f"{url}{path}", content=body, headers=headers)
    except httpx.HTTPError as exc:
        raise MT5BridgeProviderError("MT5 bridge network request failed") from exc
    if response.status_code >= 400:
        try:
            detail = response.json().get("detail", "Bridge request rejected")
        except (ValueError, TypeError):
            detail = "Bridge request rejected"
        raise MT5BridgeProviderError(str(detail)[:500])
    try:
        data = response.json()
    except ValueError as exc:
        raise MT5BridgeProviderError("MT5 bridge returned invalid JSON") from exc
    if not isinstance(data, dict):
        raise MT5BridgeProviderError("MT5 bridge returned an invalid response")
    return data


def encrypt_password(password: str) -> str:
    try:
        return encrypt_mt5_password(password)
    except Exception as exc:
        raise MT5BridgeProviderError(str(exc)) from exc


async def verify_account(credentials: dict[str, Any]) -> dict[str, Any]:
    return await _request("/account", credentials)


async def read_account(connection: dict[str, Any]) -> dict[str, Any]:
    return await _request("/account", _credentials(connection))


async def read_markets(connection: dict[str, Any], query: str) -> dict[str, Any]:
    payload = _credentials(connection)
    payload["query"] = query
    return await _request("/markets", payload)


async def send_order(connection: dict[str, Any], order: dict[str, Any]) -> dict[str, Any]:
    payload = _credentials(connection)
    payload.update(order)
    return await _request("/order", payload)