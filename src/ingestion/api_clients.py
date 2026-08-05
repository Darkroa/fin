import requests
from loguru import logger
from typing import List, Dict
import os

class NewsAPIClient:
    def __init__(self):
        self.api_key = os.getenv("NEWSAPI_KEY")
        self.base_url = "https://newsapi.org/v2"

    def fetch_financial_news(self, q: str = "finance OR stock OR market", limit: int = 20) -> List[Dict]:
        if not self.api_key:
            logger.warning("NEWSAPI_KEY not set – skipping NewsAPI")
            return []

        # NewsAPI requires apiKey as a query param, so it WILL appear in the URL
        # string passed to urllib3. Mitigation: register a loguru filter (in main.py)
        # that redacts known secrets from any message.
        params = {
            "q": q,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": limit,
            "apiKey": self.api_key,
        }

        try:
            resp = requests.get(f"{self.base_url}/everything", params=params, timeout=12)
            resp.raise_for_status()
            articles = resp.json().get("articles", [])
            logger.info(f"✅ NewsAPI returned {len(articles)} articles")
            return articles
        except requests.exceptions.RequestException as e:
            logger.error(f"NewsAPI request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected NewsAPI error: {e}")
            return []


class AlphaVantageClient:
    def __init__(self):
        self.api_key = os.getenv("ALPHA_VANTAGE_KEY")
        self.base_url = "https://www.alphavantage.co/query"

    def fetch_news_sentiment(self, tickers: str = "AAPL,MSFT,GOOGL", limit: int = 20) -> List[Dict]:
        if not self.api_key:
            logger.warning("ALPHA_VANTAGE_KEY not set – skipping Alpha Vantage")
            return []

        # AlphaVantage requires the apikey query param. Same log-redaction
        # mitigation as NewsAPI above.
        params = {
            "function": "NEWS_SENTIMENT",
            "tickers": tickers,
            "limit": limit,
            "apikey": self.api_key,
        }

        try:
            resp = requests.get(self.base_url, params=params, timeout=12)
            resp.raise_for_status()
            data = resp.json()
            articles = data.get("feed", [])
            logger.info(f"✅ Alpha Vantage returned {len(articles)} sentiment articles")
            return articles
        except requests.exceptions.RequestException as e:
            logger.error(f"Alpha Vantage request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected Alpha Vantage error: {e}")
            return []