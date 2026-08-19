"""API route recovery shim.

The checked-out routes module was replaced by a prose placeholder in the
upstream snapshot.  Keep the application bootable while loading the last
complete, syntax-checked route module that is present in the repository's
history.
"""

from fastapi import APIRouter
import subprocess
from pathlib import Path


_RECOVERY_REVISION = "7478e62"
_workspace = Path(__file__).resolve().parents[2]

try:
    _source = subprocess.check_output(
        ["git", "show", f"{_RECOVERY_REVISION}:src/api/routes.py"],
        cwd=_workspace,
        stderr=subprocess.STDOUT,
    )
except (OSError, subprocess.CalledProcessError) as exc:
    raise RuntimeError(
        "The API routes module is missing and its repository recovery source "
        "is unavailable."
    ) from exc

exec(compile(_source, str(Path(__file__)), "exec"), globals(), globals())

# The checked-in route module above is recovered from the last complete route
# snapshot. Keep the optional Windows bridge implementation as a small
# extension here so the large generated/recovered module does not need to be
# duplicated or manually maintained.
from fastapi import Body
from pydantic import Field
from fastapi.dependencies.utils import get_dependant

from src.api import mt5_bridge_provider as _mt5_bridge

ExchangeConnection.__annotations__["provider"] = Optional[str]
ExchangeConnection.model_fields["provider"] = Field(default="metaapi")
ExchangeConnection.model_rebuild(force=True)

_original_connect_exchange = connect_exchange
_original_mt5_account = mt5_account
_original_mt5_markets = mt5_markets
_original_mt5_order = mt5_order


async def _connect_exchange_with_provider(data: ExchangeConnection, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if str(getattr(data, "exchange", "")).lower() != "mt5":
        return await _original_connect_exchange(data, current_user, db)
    provider = str(getattr(data, "provider", "metaapi") or "metaapi").lower()
    if provider != "bridge":
        return await _original_connect_exchange(data, current_user, db)

    user = db.query(User).filter(User.email == current_user["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    account_number = str((data.account_number or data.api_key or "")).strip()
    server = re.sub(r"^[\s\u00a0]+|[\s\u00a0]+$", "", str(data.server or data.passphrase or ""))
    password = str(data.api_secret or "").strip()
    platform = str(data.mt5_platform or "MT5").strip().upper()
    label = str(data.label or data.broker or f"MT5 {account_number}").strip()
    if not account_number or not server or not password:
        raise HTTPException(status_code=400, detail="MT5 requires account number, broker server, and trading password")
    if not account_number.isdigit():
        raise HTTPException(status_code=400, detail="MT5 account number must contain digits only")
    if platform not in {"MT4", "MT5"}:
        raise HTTPException(status_code=400, detail="Platform must be MT4 or MT5")
    if data.is_demo is False and not data.allow_live_trading:
        raise HTTPException(status_code=400, detail="Enable live trading explicitly before connecting a live bridge account")

    bridge_credentials = {
        "account_number": account_number,
        "server": server,
        "password": password,
        "broker": data.broker or label,
        "is_demo": bool(data.is_demo),
        "allow_live_trading": bool(data.allow_live_trading and not data.is_demo),
    }
    try:
        verification = await _mt5_bridge.verify_account(bridge_credentials)
        encrypted_password = _mt5_bridge.encrypt_password(password)
    except _mt5_bridge.MT5BridgeProviderError as exc:
        raise HTTPException(status_code=502, detail=f"MT5 bridge could not verify this {platform} account: {exc}") from exc

    connections = list(user.exchange_connections or [])
    connections = [c for c in connections if c.get("label") != label]
    connections.append({
        "exchange": "mt5",
        "provider": "bridge",
        "api_key": "",
        "api_secret": encrypted_password,
        "api_secret_encrypted": True,
        "account_number": account_number,
        "account_number_masked": _mask_mt5_account(account_number),
        "server": server,
        "broker": data.broker or label,
        "label": label,
        "is_demo": bool(data.is_demo),
        "allow_live_trading": bool(data.allow_live_trading and not data.is_demo),
        "mt5_platform": platform,
        "status": "connected",
        "bridge_login": str(verification.get("login") or account_number),
    })
    user.exchange_connections = connections
    db.commit()
    return {"message": f"{label} connected to the Windows MT5 bridge successfully.", "connections": len(connections), "status": "connected", "provider": "bridge"}


async def _mt5_account_with_provider(label: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if user:
        connection = _find_mt5_connection(user, label)
        if str(connection.get("provider", "metaapi")).lower() == "bridge":
            try:
                result = await _mt5_bridge.read_account(connection)
            except _mt5_bridge.MT5BridgeProviderError as exc:
                raise HTTPException(status_code=502, detail=f"MT5 bridge account sync failed: {exc}") from exc
            result.update({
                "label": connection.get("label") or label,
                "provider": "bridge",
                "account_number": connection.get("account_number_masked"),
                "server": connection.get("server"),
                "broker": connection.get("broker"),
            })
            return result
    return await _original_mt5_account(label, current_user, db)


async def _mt5_markets_with_provider(data: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    label = str(data.get("label", "")).strip()
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if user and label:
        connection = _find_mt5_connection(user, label)
        if str(connection.get("provider", "metaapi")).lower() == "bridge":
            try:
                return await _mt5_bridge.read_markets(connection, str(data.get("query", "")).strip())
            except _mt5_bridge.MT5BridgeProviderError as exc:
                raise HTTPException(status_code=502, detail=f"MT5 bridge market search failed: {exc}") from exc
    return await _original_mt5_markets(data, current_user, db)


async def _mt5_order_with_provider(data: Mt5OrderRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user["email"]).first()
    if user:
        connection = _find_mt5_connection(user, data.label)
        if str(connection.get("provider", "metaapi")).lower() == "bridge":
            if not connection.get("is_demo", False) and not connection.get("allow_live_trading", False):
                raise HTTPException(status_code=403, detail="Live MT5 trading is disabled for this connection.")
            if not data.confirm_live:
                raise HTTPException(status_code=400, detail="Confirm the live MT5 order before sending it")
            try:
                return await _mt5_bridge.send_order(connection, {
                    "symbol": data.symbol.strip(),
                    "side": data.side.lower(),
                    "volume": data.volume,
                    "stop_loss": data.stop_loss,
                    "take_profit": data.take_profit,
                    "order_type": data.order_type,
                })
            except _mt5_bridge.MT5BridgeProviderError as exc:
                raise HTTPException(status_code=502, detail=f"MT5 bridge order was rejected: {exc}") from exc
    return await _original_mt5_order(data, current_user, db)


def _replace_endpoint(path: str, endpoint) -> None:
    for route in router.routes:
        if getattr(route, "path", None) == path:
            route.endpoint = endpoint
            route.dependant = get_dependant(path=route.path, call=endpoint)
            return
    raise RuntimeError(f"Route not found while installing MT5 provider adapter: {path}")


_replace_endpoint("/users/exchange-connect", _connect_exchange_with_provider)
_replace_endpoint("/users/mt5/account", _mt5_account_with_provider)
_replace_endpoint("/users/mt5/markets", _mt5_markets_with_provider)
_replace_endpoint("/users/mt5/order", _mt5_order_with_provider)