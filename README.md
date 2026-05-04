# FinAi — AI-Powered Financial Intelligence & Automated Trading

> Trade smarter with real-time AI analysis, automated bots, and multi-broker execution.

---

## What is FinAi?

FinAi is a production-ready platform that reads live financial news, detects market events using Grok AI, performs deep sentiment and trendline analysis, and runs automated trading bots across Alpaca and Binance — all from a sleek, Binance-inspired dashboard.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Grok AI Analysis** | Sentiment, market impact scoring, and price forecasting via Grok LLM |
| **News Ingestion** | Bloomberg, CNBC, Reuters, NewsAPI, AlphaVantage — 50+ sources |
| **Automated Bots** | Per-user trading bots with configurable risk, drawdown limits, paper & live modes |
| **Trendline Analysis** | ATR-based breakout detection with AI forecasting |
| **Crypto + Stocks** | Alpaca (US equities) + Binance (crypto) broker integrations |
| **Dark Dashboard** | Binance-style UI: overview, markets, portfolio, bots, deposit/withdraw |
| **Admin Panel** | User management, transaction approval, event monitoring, system health |
| **Multi-Channel Alerts** | Telegram, WhatsApp, Slack, Email notifications on trade signals |
| **API Keys** | Scoped, rate-limited API keys for external automations |
| **RAG Search** | ChromaDB vector store for semantic search over ingested news |

---

## Tech Stack

- **Backend**: FastAPI + Uvicorn
- **Frontend**: Streamlit (dark, Binance-inspired)
- **Database**: PostgreSQL (SQLAlchemy + Alembic)
- **Task Queue**: Celery (Redis when available; eager/synchronous fallback)
- **AI/LLM**: Grok via LangChain-Groq (primary), OpenAI (fallback)
- **Vector DB**: ChromaDB
- **Trading**: alpaca-py, python-binance, yfinance
- **Notifications**: Twilio, python-telegram-bot, slack-sdk

---

## Quick Start on Replit

1. **Fork / import** this project on Replit
2. Add secrets in the **Secrets** panel:
   - `GROK_API_KEY` — from [console.groq.com](https://console.groq.com)
   - `JWT_SECRET_KEY` — any long random string
   - `OPENAI_API_KEY` — optional, for embeddings
3. Click **Run** — the app starts automatically
4. Open the preview at port **5000**

> The app works without Redis — Celery runs in synchronous mode automatically.

---

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `GROK_API_KEY` | Yes | Primary AI engine |
| `JWT_SECRET_KEY` | Yes | JWT token signing |
| `OPENAI_API_KEY` | Recommended | Embeddings + fallback LLM |
| `DATABASE_URL` | Auto | Set by Replit PostgreSQL |
| `NEWSAPI_KEY` | Optional | newsapi.org |
| `ALPHA_VANTAGE_KEY` | Optional | alphavantage.co |
| `ALPACA_API_KEY` | Optional | Alpaca trading |
| `ALPACA_SECRET_KEY` | Optional | Alpaca trading |
| `TELEGRAM_BOT_TOKEN` | Optional | Trade alerts |
| `TELEGRAM_CHAT_ID` | Optional | Alert target chat |
| `TWILIO_ACCOUNT_SID` | Optional | WhatsApp alerts |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio auth |
| `SLACK_BOT_TOKEN` | Optional | Slack alerts |

---

## Project Structure

```
src/
├── api/           FastAPI backend (routes, middleware, main app)
├── analysis/      AI analysis (sentiment, trendlines, forecaster, impact)
├── auth/          JWT authentication and dependencies
├── celery_app/    Task queue (Redis-free fallback mode built-in)
├── conversation/  Conversational AI agent
├── database/      SQLAlchemy models + session
├── event/         Market event detection
├── frontend/      Streamlit UI (login/landing, dashboard, pages)
├── ingestion/     News scrapers and API clients
├── notifications/ Alert delivery (Telegram, WhatsApp, Slack, Email)
├── rag/           ChromaDB vector store and retriever
├── trading/       Trading bots and broker integrations
└── users/         User CRUD, API keys, bot manager
admin/             Admin Streamlit dashboard
migrations/        Alembic database migrations
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register user |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/users/me` | Current user info |
| GET | `/api/events` | Recent market events |
| POST | `/api/ingest` | Trigger news ingestion |
| GET | `/api/analyze-trendline?ticker=AAPL` | Trendline analysis |
| GET | `/api/admin/users` | All users (admin) |
| POST | `/api/admin/approve-transaction` | Approve transaction |
| GET | `/api/health` | Health check |
| GET | `/docs` | Interactive API docs (Swagger) |

---

## Screenshots

- **Landing Page** — Dark hero with ticker tape, feature grid, and CTA
- **Login** — Dark card with email/password, styled like professional trading apps
- **Dashboard** — Binance-style: candlestick charts, market watch, balance card, quick actions
- **Trading Bots** — Live bot status with P&L, drawdown, one-click start/stop
- **Admin Panel** — User management, transaction approval, event feed, system health

---

## License

MIT — Built for traders, by traders.
