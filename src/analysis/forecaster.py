from pydantic import BaseModel, Field
from typing import List
from loguru import logger
import json
import os
from datetime import datetime, timedelta


class PriceForecast(BaseModel):
    ticker: str
    short_term_target: float
    medium_term_target: float
    short_term_confidence: float
    medium_term_confidence: float
    forecasted_date_short: str
    forecasted_date_medium: str
    rationale: str


class Forecaster:
    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            self._llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.3,
                api_key=os.getenv("OPENAI_API_KEY") or os.getenv("GROK_API_KEY") or "placeholder",
            )
        return self._llm

    def forecast(self, ticker: str, current_price: float, sentiment_score: float,
                 impact_score: int, technical_breakout: bool = False) -> PriceForecast:
        prompt = f"""
        You are an expert price forecaster.
        Current price of {ticker}: ${current_price:.2f}
        Sentiment score: {sentiment_score:.2f}
        Impact score: {impact_score}/10
        Technical breakout detected: {technical_breakout}

        Provide realistic price targets:
        - Short-term target (next 1-5 trading days)
        - Medium-term target (next 2-6 weeks)

        Return only valid JSON with fields:
        - short_term_target (float)
        - medium_term_target (float)
        - short_term_confidence (float 0-1)
        - medium_term_confidence (float 0-1)
        - forecasted_date_short (YYYY-MM-DD)
        - forecasted_date_medium (YYYY-MM-DD)
        - rationale (string)
        """
        try:
            response = self.llm.invoke(prompt)
            result = json.loads(response.content)
            result["ticker"] = ticker
            return PriceForecast(**result)
        except Exception as e:
            logger.error(f"Forecasting failed: {e}")
            short_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
            med_date = (datetime.now() + timedelta(days=42)).strftime("%Y-%m-%d")
            return PriceForecast(
                ticker=ticker,
                short_term_target=current_price * 1.02,
                medium_term_target=current_price * 1.08,
                short_term_confidence=0.5,
                medium_term_confidence=0.45,
                forecasted_date_short=short_date,
                forecasted_date_medium=med_date,
                rationale="Fallback forecast due to error",
            )
