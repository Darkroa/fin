"""Server-side MetaApi Cloud SDK adapter for MT4/MT5 accounts.

The browser only submits broker credentials to the authenticated FinAi API.
MetaApi owns the cloud terminal after provisioning, so subsequent operations
use the MetaApi account id and the server-side METAAPI_KEY only.
"""

from __future__ import annotations

import os
import json
from typing import Any, Awaitable, Callable, Optional, TypeVar

from loguru import logger
from metaapi_cloud_sdk import MetaApi

T = TypeVar("T")


class MetaApiProviderError(RuntimeError):
    """Raised when MetaApi is unavailable or rejects an account operation."""


def _token() -> str:
    token = os.getenv("METAAPI_KEY", "").strip()
    if not token:
        raise MetaApiProviderError(
            "MetaApi is not configured. Set METAAPI_KEY in the server secret store."
        )
    return token


def _client() -> MetaApi:
    return MetaApi(_token(), {"application": "FinAi"})


def _value(value: Any, *keys: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        for key in keys:
            if key in value and value[key] is not None:
                return value[key]
    else:
        for key in keys:
            candidate = getattr(value, key, None)
            if candidate is not None:
                return candidate
    return default


def _number(value: Any, *keys: str) -> Optional[float]:
    candidate = _value(value, *keys)
    if candidate is None:
        return None
    try:
        return float(candidate)
    except (TypeError, ValueError):
        return None


def _safe_error(exc: Exception, *secrets: str) -> str:
    """Return a provider error without echoing passwords or access tokens."""
    message = str(exc).strip()
    details = getattr(exc, "details", None)
    if details:
        try:
            detail_text = json.dumps(details, default=str, separators=(",",":"))
        except (TypeError, ValueError):
            detail_text = str(details)
        message = f"{message} Details: {detail_text}"
    for secret in (os.getenv("METAAPI_KEY", ""), *secrets):
        if secret:
            message = message.replace(secret, "[redacted]")
    return message[:600] or type(exc).__name__


def _mask_login(login: str) -> str:
    s = str(login or "")
    return ("****" + s[-4:]) if len(s) > 4 else ("****")


def _sanitize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _account_infrastructure() -> tuple[str, Optional[str]]:
    """Resolve and validate the MetaApi infrastructure settings.

    G2 is retained as the production default. MetaApi does not offer regular
    reliability on G2, so a regular-reliability test must explicitly use G1.
    """
    account_type = os.getenv("METAAPI_ACCOUNT_TYPE", "cloud-g2").strip().lower()
    reliability = os.getenv("METAAPI_RELIABILITY", "").strip().lower() or None

    if account_type not in {"cloud-g1", "cloud-g2"}:
        raise MetaApiProviderError(
            "Invalid METAAPI_ACCOUNT_TYPE. Use cloud-g1 or cloud-g2."
        )
    if reliability not in {None, "regular", "high"}:
        raise MetaApiProviderError(
            "Invalid METAAPI_RELIABILITY. Use regular or high."
        )
    if account_type == "cloud-g2" and reliability == "regular":
        raise MetaApiProviderError(
            "MetaApi does not offer regular reliability on cloud-g2. "
            "Use cloud-g1 for regular-reliability testing."
        )
    return account_type, reliability


async def create_account(
    *,
    login: str,
    password: str,
    server: str,
    platform: str,
    name: str,
) -> dict[str, Any]:
    """Provision, deploy, and verify a broker account in MetaApi.

    Improvements:
    - sanitize inputs (strip whitespace)
    - mask login in logs
    - longer deployment/connect timeout for flaky providers
    - more explicit logging of provider 'details' to help debug authentication
      vs. network vs. broker issues
    """
    client = _client()
    account = None

    # sanitize/normalize inputs
    login = _sanitize_text(login)
    password = _sanitize_text(password)  # keep as str, don't log it
    server = _sanitize_text(server)
    platform = _sanitize_text(platform).lower()
    name = _sanitize_text(name)
    account_type, reliability = _account_infrastructure()

    logger.info(
        "MetaApi create_account called (login=%s, server=%s, platform=%s, type=%s, reliability=%s, name=%s)",
        _mask_login(login),
        server,
        platform,
        account_type,
        reliability or "provider-default",
        name,
    )

    try:
        payload = {
            "name": name,
            "login": login,
            "password": password,
            "server": server,
            "platform": platform,
            # MetaApi requires magic for account creation. Manual trades
            # must use magic 0.
            "magic": 0,
            "type": account_type,
            "manualTrades": True,
        }
        if reliability:
            payload["reliability"] = reliability
        account = await client.metatrader_account_api.create_account(payload)
        await account.deploy()
        # increase connect timeout: some brokers are slow to accept connections
        await account.wait_connected(timeout_in_seconds=300, interval_in_milliseconds=1500)
        await account.reload()
        return {
            "id": account.id,
            "login": str(_value(account, "login", default=login)),
            "server": str(_value(account, "server", default=server)),
            "platform": str(_value(account, "platform", default=platform)).upper(),
            "connection_status": str(_value(account, "connection_status", default="CONNECTED")),
            "state": str(_value(account, "state", default="DEPLOYED")),
        }
    except Exception as exc:
        # Log exception and any provider details for debugging.
        # We do not log passwords or the METAAPI_KEY here.
        try:
            details = getattr(exc, "details", None)
            if details:
                logger.warning("MetaApi provisioning failed with details: %s", json.dumps(details, default=str))
        except Exception:
            # ignore logging errors
            pass

        logger.exception("MetaApi account provisioning failed (masked login=%s)", _mask_login(login))
        if account is not None:
            try:
                await account.remove()
            except Exception:
                logger.warning("MetaApi cleanup after provisioning failure failed")
        # Raise a user-facing provider error (secrets redacted). MetaApi's
        # high-reliability credit message is about the MetaApi workspace, not
        # the broker account being connected.
        safe_error = _safe_error(exc, password, login)
        error_lower = safe_error.lower()
        if "high reliability" in error_lower and "top up" in error_lower:
            safe_error = (
                "MetaApi workspace credit is insufficient for high-reliability "
                "provisioning. Add MetaApi workspace credit, or configure "
                "METAAPI_ACCOUNT_TYPE=cloud-g1 and "
                "METAAPI_RELIABILITY=regular for testing."
            )
        raise MetaApiProviderError(safe_error) from exc
    finally:
        client.close()


async def remove_account(account_id: str) -> None:
    """Remove a provisioned MetaApi terminal when the user disconnects it."""
    client = _client()
    try:
        account = await client.metatrader_account_api.get_account(account_id)
        await account.remove()
        await account.wait_removed(timeout_in_seconds=60, interval_in_milliseconds=1000)
    except Exception as exc:
        logger.warning(f"MetaApi account removal failed: {type(exc).__name__}")
        raise MetaApiProviderError(_safe_error(exc)) from exc
    finally:
        client.close()


async def with_rpc_connection(
    account_id: str,
    operation: Callable[[Any, Any], Awaitable[T]],
) -> T:
    """Run one RPC operation against an already provisioned MetaApi account.

    Increased synchronization timeout to tolerate slower terminals.
    """
    client = _client()
    connection = None
    try:
        account = await client.metatrader_account_api.get_account(account_id)
        connection = account.get_rpc_connection()
        await connection.connect()
        # a little more time for synchronization with the cloud terminal
        await connection.wait_synchronized(timeout_in_seconds=180)
        return await operation(account, connection)
    except MetaApiProviderError:
        raise
    except Exception as exc:
        logger.exception("MetaApi RPC operation failed for account_id=%s", account_id)
        raise MetaApiProviderError(_safe_error(exc)) from exc
    finally:
        if connection is not None:
            try:
                await connection.close()
            except Exception:
                logger.warning("MetaApi RPC connection cleanup failed")
        client.close()


async def verify_account(
    *,
    login: str,
    password: str,
    server: str,
    platform: str,
    name: str,
) -> dict[str, Any]:
    """Alias used by the connection endpoint to make the intent explicit."""
    return await create_account(
        login=login,
        password=password,
        server=server,
        platform=platform,
        name=name,
    )
