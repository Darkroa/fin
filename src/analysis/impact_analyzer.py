from pydantic import BaseModel, Field
from typing import List
from loguru import logger
import json
import os


class MarketImpact(BaseModel):
    ticker: str
    impact_score: int = Field(..., ge=1, le=10)
    expected_price_move_percent: float
    time_horizon: str
    risk_level: str
    key_drivers: List[str]


class ImpactAnalyzer:
    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            self._llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.1,
                api_key=os.getenv("OPENAI_API_KEY") or os.getenv("GROK_API_KEY") or "placeholder",
            )
        return self._llm

    def analyze(self, news_text: str, ticker: str, sentiment_score: float) -> MarketImpact:
        prompt = f"""
        You are a professional market impact analyst.
        Given the news and sentiment score ({sentiment_score:.2f}), estimate the market impact on {ticker}.

        News: {news_text[:8000]}

        Return JSON with:
        - impact_score (1-10)
        - expected_price_move_percent (e.g. 2.5 or -1.8)
        - time_horizon ("short" or "medium")
        - risk_level ("low", "medium", "high")
        - key_drivers (list of 3-5 factors)
        """
        try:
            response = self.llm.invoke(prompt)
            result = json.loads(response.content)
            result["ticker"] = ticker
            return MarketImpact(**result)
        except Exception as e:
            logger.error(f"Impact analysis failed: {e}")
            return MarketImpact(
                ticker=ticker,
                impact_score=5,
                expected_price_move_percent=0.0,
                time_horizon="short",
                risk_level="medium",
                key_drivers=["Unable to analyze"],
            )
