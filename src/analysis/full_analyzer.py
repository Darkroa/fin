from typing import Dict, Optional
from loguru import logger
import yfinance as yf
from datetime import datetime

from src.analysis.trendline_analyzer import TrendlineAnalyzer
from src.analysis.sentiment import SentimentAnalyzer
from src.analysis.impact_analyzer import ImpactAnalyzer
from src.analysis.forecaster import Forecaster
# from src.utils.llm import get_llm   # Uncomment and inject if you want explicit LLM control later


class FullAnalysisResult:
    """Unified result container for full stock analysis."""
    def __init__(self, ticker: str):
        self.ticker = ticker
        self.timestamp = datetime.now()
        
        # Technical
        self.technical: Optional[Dict] = None
        self.breakout_detected = False
        self.current_price = 0.0
        
        # Sentiment & Impact
        self.sentiment_score = 0.0
        self.overall_sentiment = "neutral"
        self.impact_score = 5
        self.key_drivers: list = []
        
        # Forecast
        self.short_term_target = 0.0
        self.medium_term_target = 0.0
        self.short_term_confidence = 0.5
        self.medium_term_confidence = 0.5
        
        # Overall
        self.overall_signal = "Neutral"
        self.confidence = 0.5
        self.recommendation = "Watch"
        self.summary = ""

    def to_dict(self) -> Dict:
        return {
            "ticker": self.ticker,
            "timestamp": self.timestamp.isoformat(),
            "current_price": round(self.current_price, 2),
            "technical": {
                "breakout_detected": self.breakout_detected,
                "upper_trend": getattr(self.technical, 'upper_trend', None) if self.technical else None,
                "lower_trend": getattr(self.technical, 'lower_trend', None) if self.technical else None,
                "details": self.technical if isinstance(self.technical, dict) else {}
            },
            "sentiment": {
                "score": round(self.sentiment_score, 2),
                "label": self.overall_sentiment,
            },
            "impact": {
                "score": self.impact_score,
                "key_drivers": self.key_drivers
            },
            "forecast": {
                "short_term_target": round(self.short_term_target, 2),
                "medium_term_target": round(self.medium_term_target, 2),
                "short_term_confidence": round(self.short_term_confidence, 2),
                "medium_term_confidence": round(self.medium_term_confidence, 2),
            },
            "overall": {
                "signal": self.overall_signal,
                "confidence": round(self.confidence, 2),
                "recommendation": self.recommendation,
                "summary": self.summary
            }
        }


class FullAnalyzer:
    """
    Orchestrates technical, sentiment, impact, and forecasting analysis.
    LLM-powered parts (sentiment, impact, forecaster) use Grok as the core engine.
    """
    def __init__(self):
        self.trend_analyzer = TrendlineAnalyzer(length=14, mult=1.0, calc_method='Atr')
        self.sentiment_analyzer = SentimentAnalyzer()
        self.impact_analyzer = ImpactAnalyzer()
        self.forecaster = Forecaster()

    def analyze(self, ticker: str, news_text: str = "") -> FullAnalysisResult:
        """Run complete analysis and return unified result."""
        result = FullAnalysisResult(ticker)

        try:
            # 1. Technical Analysis (data-driven, no LLM)
            df = yf.download(ticker, period="60d", interval="1h", progress=False)
            close_col = "Close" if "Close" in df.columns else "close"
            # yfinance can return a single-row all-NaN frame for delisted /
            # newly-listed / weekend-only tickers. Treat both as "no data".
            if df.empty or df[close_col].dropna().empty or len(df) < 30:
                logger.warning(f"No usable price data returned for {ticker}")
                result.summary = "No price data available."
                return result

            technical_result = self.trend_analyzer.analyze(df, ticker)
            result.technical = technical_result
            result.current_price = technical_result.get("current_price", 0.0)
            result.breakout_detected = (
                technical_result.get("breakout_up", False) or 
                technical_result.get("breakout_dn", False)
            )

            # 2. Sentiment Analysis (LLM-powered)
            if news_text and news_text.strip():
                sentiment_result = self.sentiment_analyzer.analyze(news_text, ticker)
                result.sentiment_score = getattr(sentiment_result, 'sentiment_score', 0.0)
                result.overall_sentiment = getattr(sentiment_result, 'overall_sentiment', "neutral")

            # 3. Impact Analysis (LLM-powered)
            impact_result = self.impact_analyzer.analyze(
                news_text or "No recent news", 
                ticker, 
                result.sentiment_score
            )
            result.impact_score = getattr(impact_result, 'impact_score', 5)
            result.key_drivers = getattr(impact_result, 'key_drivers', [])

            # 4. Forecasting (LLM-powered)
            forecast_result = self.forecaster.forecast(
                ticker=ticker,
                current_price=result.current_price,
                sentiment_score=result.sentiment_score,
                impact_score=result.impact_score,
                technical_breakout=result.breakout_detected
            )
            result.short_term_target = getattr(forecast_result, 'short_term_target', 0.0)
            result.medium_term_target = getattr(forecast_result, 'medium_term_target', 0.0)
            result.short_term_confidence = getattr(forecast_result, 'short_term_confidence', 0.5)
            result.medium_term_confidence = getattr(forecast_result, 'medium_term_confidence', 0.5)

            # 5. Overall Signal & Recommendation
            if result.breakout_detected and result.sentiment_score > 0.3 and result.impact_score >= 7:
                result.overall_signal = "Bullish"
                result.recommendation = "Buy"
                result.confidence = min(0.85, (result.sentiment_score + result.impact_score / 10) / 2)
            elif result.breakout_detected and result.sentiment_score < -0.3:
                result.overall_signal = "Bearish"
                result.recommendation = "Sell"
                # Symmetric with Bullish branch: scale confidence with both
                # |sentiment| and impact. Previously hardcoded 0.75 regardless
                # of how strong the signal was.
                result.confidence = min(0.85, (abs(result.sentiment_score) + result.impact_score / 10) / 2)
            else:
                result.overall_signal = "Neutral"
                result.recommendation = "Watch"
                result.confidence = 0.55

            result.summary = (
                f"{result.overall_signal} signal for {ticker}. "
                f"Short-term target: ${result.short_term_target:.2f} "
                f"({result.short_term_confidence:.0%} confidence)"
            )

            logger.success(f"Full analysis completed for {ticker} → {result.overall_signal} "
                          f"(confidence: {result.confidence:.2f})")
            return result

        except Exception as e:
            logger.error(f"Full analysis failed for {ticker}: {e}", exc_info=True)
            result.summary = f"Analysis failed: {str(e)}"
            return result


# ===================== Example Usage =====================
if __name__ == "__main__":
    analyzer = FullAnalyzer()
    
    sample_news = """
    Apple reported better than expected earnings. iPhone sales surged 18%.
    Analysts are raising price targets. Strong guidance for next quarter.
    """
    
    result = analyzer.analyze("AAPL", sample_news)
    
    print(result.summary)
    print("\nFull Result (JSON):")
    import json
    print(json.dumps(result.to_dict(), indent=2))