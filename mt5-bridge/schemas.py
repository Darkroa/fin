from typing import Optional

from pydantic import BaseModel, Field, field_validator


class MT5Credentials(BaseModel):
    account_number: str = Field(min_length=1, max_length=32)
    server: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=1, max_length=256)
    broker: Optional[str] = Field(default=None, max_length=100)
    is_demo: bool = True
    allow_live_trading: bool = False

    @field_validator("account_number")
    @classmethod
    def account_number_must_be_numeric(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError("account_number must contain digits only")
        return value


class MarketsRequest(MT5Credentials):
    query: str = Field(default="", max_length=80)


class OrderRequest(MT5Credentials):
    symbol: str = Field(min_length=1, max_length=64)
    side: str
    volume: float = Field(gt=0, le=1000)
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    order_type: str = "market"

    @field_validator("side")
    @classmethod
    def side_must_be_supported(cls, value: str) -> str:
        value = value.lower()
        if value not in {"buy", "sell"}:
            raise ValueError("side must be buy or sell")
        return value

    @field_validator("order_type")
    @classmethod
    def order_type_must_be_market(cls, value: str) -> str:
        if value.lower() != "market":
            raise ValueError("Only market orders are enabled in the first bridge version")
        return "market"