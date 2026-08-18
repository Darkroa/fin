import os
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from mt5_adapter import MT5AdapterError, account, markets, order
from schemas import MT5Credentials, MarketsRequest, OrderRequest
from security import require_signed_request


app = FastAPI(
    title="FinAi MT5 Bridge",
    version="1.0.0",
    docs_url=None if os.getenv("MT5_BRIDGE_DOCS", "false").lower() != "true" else "/docs",
    redoc_url=None,
)


@app.exception_handler(MT5AdapterError)
async def mt5_adapter_error(_: Request, exc: MT5AdapterError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/health")
async def health() -> dict[str, Any]:
    import mt5_adapter

    return {
        "status": "ok" if mt5_adapter._mt5 is not None else "degraded",
        "adapter": "MetaTrader5" if mt5_adapter._mt5 is not None else "unavailable",
        "live_orders_enabled": os.getenv("ALLOW_LIVE_ORDERS", "false").lower() == "true",
    }


@app.post("/account", dependencies=[Depends(require_signed_request)])
async def account_endpoint(data: MT5Credentials) -> dict[str, Any]:
    return await run_in_threadpool(account, data.model_dump())


@app.post("/markets", dependencies=[Depends(require_signed_request)])
async def markets_endpoint(data: MarketsRequest) -> dict[str, Any]:
    return await run_in_threadpool(markets, data.model_dump(), data.query)


@app.post("/order", dependencies=[Depends(require_signed_request)])
async def order_endpoint(data: OrderRequest) -> dict[str, Any]:
    return await run_in_threadpool(order, data.model_dump(), data.model_dump())


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "FinAi MT5 Bridge", "status": "online"}