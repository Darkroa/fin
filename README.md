# FinAi 🤖

**AI-Powered Financial Intelligence & Automated Trading Platform**

FinAi is a complete, production-ready system that reads real-time financial news, detects events, performs deep Grok-powered analysis, and executes smart trading strategies across multiple brokers.

Built with Grok as the core LLM for accurate, real-time market insights.

---

## ✨ Key Features

- **Real-time News Ingestion** — RSS feeds, NewsAPI, Alpha Vantage
- **Grok-Powered Analysis** — Trendlines, sentiment, market impact, price forecasting
- **Per-User Trading Bots** — Paper & live trading (Alpaca + Binance support)
- **User Dashboard** — Balance (USD + BTC live), optional risk parameters, deposit/withdrawal, transaction history
- **Admin Panel** — Full user management, complaints system with email replies
- **API Access** — Secure, scoped API keys for external scripts and apps
- **Verification Flow** — Email verification, account activation, ban system
- **Multi-Channel Notifications** — WhatsApp, Telegram, Slack, Email
- **Contact Us / Complaints** — Users can submit issues; admins can reply directly

---

## 🛠 Tech Stack

- **Backend**: FastAPI + Celery + Redis
- **AI**: Grok (primary) + GPT fallback via LangChain
- **Frontend**: Streamlit (User Dashboard) + Gradio (FinAi Chat)
- **Database**: PostgreSQL + SQLAlchemy
- **Vector Search**: ChromaDB (RAG)
- **Trading**: Alpaca & Binance brokers
- **Deployment**: Docker + Render-ready

---

## 🚀 Quick Start (Local)

1. Clone the repository
```bash
git clone [https://github.com/Darkroa/FinAi.git
