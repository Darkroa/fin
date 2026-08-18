"""Server-side MetaApi Cloud SDK adapter for MT4/MT5 accounts.

The browser only submits broker credentials to the authenticated FinAi API.
MetaApi owns the cloud terminal after provisioning, so subsequent operations
use the MetaApi account id and the server-side METAAPI_KEY only.
"""

from __future__ import annotations

import os
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
    for secret in (os.getenv("METAAPI_KEY", ""), *secrets):
        if secret:
            message = message.replace(secret, "[redacted]")
    return message[:240] or type(exc).__name__


async def create_account(
    *,
    login: str,
    password: str,
    server: str,
    platform: str,
    name: str,
) -> dict[str, Any]:
    """Provision, deploy, and verify a broker account in MetaApi."""
    client = _client()
    account = None
    try:
        account = await client.metatrader_account_api.create_account(
            {
                "name": name,
                "login": login,
                "password": password,
                "server": server,
                "platform": platform.lower(),
                "type": "cloud-g1",
                "manualTrades": True,
            }
        )
        await account.deploy()
        await account.wait_connected(timeout_in_seconds=180, interval_in_milliseconds=1500)
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
        logger.warning(f"MetaApi account provisioning failed: {type(exc).__name__}")
        if account is not None:
            try:
                await account.remove()
            except Exception:
                logger.warning("MetaApi cleanup after provisioning failure failed")
        raise MetaApiProviderError(_safe_error(exc, password, login)) from exc
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
    """Run one RPC operation against an already provisioned MetaApi account."""
    client = _client()
    connection = None
    try:
        account = await client.metatrader_account_api.get_account(account_id)
        connection = account.get_rpc_connection()
        await connection.connect()
        await connection.wait_synchronized(timeout_in_seconds=120)
        return await operation(account, connection)
    except MetaApiProviderError:
        raise
    except Exception as exc:
        logger.warning(f"MetaApi RPC operation failed: {type(exc).__name__}")
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