import os
from typing import Any


try:
    import MetaTrader5 as _mt5
except ImportError:  # MetaTrader5 is Windows-terminal-only.
    _mt5 = None


class MT5AdapterError(RuntimeError):
    pass


def _require_terminal() -> Any:
    if _mt5 is None:
        raise MT5AdapterError(
            "MetaTrader5 package is unavailable. Run the bridge on Windows with an installed MT5 terminal."
        )
    return _mt5


def _connect(credentials: dict[str, Any]) -> Any:
    mt5 = _require_terminal()
    try:
        login = int(credentials["account_number"])
    except (TypeError, ValueError):
        raise MT5AdapterError("Invalid MT5 account number")

    if not mt5.initialize(
        login=login,
        password=credentials["password"],
        server=credentials["server"],
    ):
        code, message = mt5.last_error()
        raise MT5AdapterError(f"MT5 terminal login failed ({code}): {message}")
    return mt5


def _shutdown(mt5: Any) -> None:
    try:
        mt5.shutdown()
    except Exception:
        pass


def _position_dict(position: Any) -> dict[str, Any]:
    return {
        "ticket": int(position.ticket),
        "symbol": position.symbol,
        "side": "buy" if position.type == 0 else "sell",
        "volume": float(position.volume),
        "price_open": float(position.price_open),
        "price_current": float(position.price_current),
        "stop_loss": float(position.sl),
        "take_profit": float(position.tp),
        "profit": float(position.profit),
        "time": int(position.time),
    }


def account(credentials: dict[str, Any]) -> dict[str, Any]:
    mt5 = _connect(credentials)
    try:
        info = mt5.account_info()
        if info is None:
            raise MT5AdapterError("MT5 account information is unavailable")
        positions = mt5.positions_get() or ()
        return {
            "connected": True,
            "login": int(info.login),
            "server": str(info.server),
            "currency": str(info.currency),
            "balance": float(info.balance),
            "equity": float(info.equity),
            "free_margin": float(info.margin_free),
            "margin": float(info.margin),
            "margin_level": float(info.margin_level or 0),
            "open_positions": len(positions),
            "positions": [_position_dict(position) for position in positions],
        }
    finally:
        _shutdown(mt5)


def markets(credentials: dict[str, Any], query: str = "") -> dict[str, Any]:
    mt5 = _connect(credentials)
    try:
        symbols = mt5.symbols_get() or ()
        needle = query.strip().lower()
        results = []
        for symbol in symbols:
            name = str(symbol.name)
            description = str(getattr(symbol, "description", "") or "")
            if needle and needle not in name.lower() and needle not in description.lower():
                continue
            tick = mt5.symbol_info_tick(name)
            results.append({
                "symbol": name,
                "name": description or name,
                "type": "MT5",
                "bid": float(tick.bid) if tick else None,
                "ask": float(tick.ask) if tick else None,
                "spread": float((tick.ask - tick.bid)) if tick else None,
                "digits": int(getattr(symbol, "digits", 0)),
                "trade_enabled": bool(getattr(symbol, "trade_mode", 0)),
            })
            if len(results) >= 100:
                break
        return {"markets": results}
    finally:
        _shutdown(mt5)


def order(credentials: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
    if not credentials.get("is_demo", True) and not credentials.get("allow_live_trading", False):
        raise MT5AdapterError("Live order rejected: live trading is disabled")
    if not credentials.get("is_demo", True) and os.getenv("ALLOW_LIVE_ORDERS", "false").lower() != "true":
        raise MT5AdapterError("Live order rejected: bridge live-order kill switch is disabled")

    mt5 = _connect(credentials)
    try:
        symbol = str(request["symbol"]).upper()
        if not mt5.symbol_select(symbol, True):
            raise MT5AdapterError("MT5 symbol is not available for this account")
        symbol_info = mt5.symbol_info(symbol)
        tick = mt5.symbol_info_tick(symbol)
        if symbol_info is None or tick is None:
            raise MT5AdapterError("MT5 quote is unavailable")

        side = request["side"].lower()
        is_buy = side == "buy"
        trade_type = mt5.ORDER_TYPE_BUY if is_buy else mt5.ORDER_TYPE_SELL
        price = float(tick.ask if is_buy else tick.bid)
        trade_request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(request["volume"]),
            "type": trade_type,
            "price": price,
            "deviation": int(os.getenv("MT5_MAX_DEVIATION", "20")),
            "magic": int(os.getenv("MT5_MAGIC_NUMBER", "260818")),
            "comment": "FinAi confirmed order",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        if request.get("stop_loss") is not None:
            trade_request["sl"] = float(request["stop_loss"])
        if request.get("take_profit") is not None:
            trade_request["tp"] = float(request["take_profit"])

        result = mt5.order_send(trade_request)
        if result is None:
            raise MT5AdapterError("MT5 returned no order result")
        success_codes = {
            getattr(mt5, "TRADE_RETCODE_DONE", 10009),
            getattr(mt5, "TRADE_RETCODE_DONE_PARTIAL", 10010),
        }
        if result.retcode not in success_codes:
            raise MT5AdapterError(f"MT5 rejected order ({result.retcode}): {result.comment}")
        return {
            "status": "filled" if result.retcode == getattr(mt5, "TRADE_RETCODE_DONE", 10009) else "partial",
            "order_id": int(result.order or 0),
            "deal_id": int(result.deal or 0),
            "symbol": symbol,
            "side": side,
            "volume": float(request["volume"]),
            "fill_price": float(result.price or price),
            "message": str(result.comment),
        }
    finally:
        _shutdown(mt5)