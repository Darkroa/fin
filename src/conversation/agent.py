from langchain_community.tools import Tool
from loguru import logger

from src.utils.llm import get_llm, get_active_provider
from src.utils.market_data import build_market_context, get_top_snapshot, get_pair_detail
from src.analysis.full_analyzer import FullAnalyzer
from src.rag.vector_store import FinancialRAG
from src.ingestion.news_fetcher import NewsFetcher


rag = FinancialRAG()
full_analyzer = FullAnalyzer()
news_fetcher = NewsFetcher()

chat_history = []


def fetch_live_market_data(symbol: str) -> str:
    """Fetch live price, 24h change, volume, market cap for a crypto symbol or pair."""
    try:
        sym = symbol.strip().upper()
        detail = get_pair_detail(sym)
        if not detail:
            snap = get_top_snapshot()
            if snap:
                lines = []
                for cg_id, d in list(snap.items())[:8]:
                    sp = d.get("usd", 0)
                    sc = d.get("usd_24h_change", 0)
                    if sp > 0:
                        sign = "+" if sc >= 0 else ""
                        lines.append(f"{cg_id.upper()}: ${sp:,.2f} ({sign}{sc:.2f}%)")
                return "Top crypto live prices:\n" + "\n".join(lines)
            return "Could not fetch live market data right now."
        p   = detail.get("price_usd", 0)
        c24 = detail.get("change_24h", 0)
        c7  = detail.get("change_7d", 0)
        vol = detail.get("volume_24h", 0)
        mc  = detail.get("market_cap", 0)
        hi  = detail.get("high_24h", 0)
        lo  = detail.get("low_24h", 0)
        ath = detail.get("ath", 0)
        sign24 = "+" if c24 >= 0 else ""
        sign7  = "+" if c7  >= 0 else ""
        result = [
            f"Live data for {detail.get('name', sym)} ({detail.get('symbol', sym)}):",
            f"  Price:       ${p:,.4f}" if p < 1 else f"  Price:       ${p:,.2f}",
            f"  24h Change:  {sign24}{c24:.2f}%",
            f"  7d Change:   {sign7}{c7:.2f}%",
            f"  24h High:    ${hi:,.2f}",
            f"  24h Low:     ${lo:,.2f}",
            f"  24h Volume:  ${vol/1e9:.2f}B" if vol >= 1e9 else f"  24h Volume:  ${vol/1e6:.1f}M",
            f"  Market Cap:  ${mc/1e9:.2f}B",
            f"  CMC Rank:    #{detail.get('market_cap_rank', '—')}",
            f"  ATH:         ${ath:,.2f}  ({detail.get('ath_change_pct', 0):.1f}% from ATH)",
        ]
        return "\n".join(result)
    except Exception as e:
        logger.error(f"fetch_live_market_data error: {e}")
        return f"Could not fetch live data for {symbol}."


def get_latest_financial_news(query: str = "latest") -> str:
    try:
        articles = news_fetcher.run()
        if not articles:
            return "No recent financial news available."
        formatted = [
            f"📰 {a.get('title', 'Untitled')}\n"
            f"Source: {a.get('source', 'Unknown')}\n"
            f"Summary: {a.get('summary', '')[:280]}..."
            for a in articles[:5]
        ]
        return "\n\n".join(formatted)
    except Exception as e:
        logger.error(f"News fetch error: {e}")
        return "Unable to fetch latest news right now."


def full_market_analysis(ticker: str) -> dict:
    try:
        articles = news_fetcher.run()
        news_text = "\n\n".join([
            a.get("full_text", a.get("summary", ""))
            for a in articles
        ])
        result = full_analyzer.analyze(ticker, news_text)
        return result.to_dict()
    except Exception as e:
        logger.error(f"Full analysis failed for {ticker}: {e}", exc_info=True)
        return {
            "error": str(e),
            "ticker": ticker,
            "overall_signal": "Neutral",
            "summary": "Analysis could not be completed due to an error.",
        }


def retrieve_relevant_context(query: str) -> str:
    try:
        results = rag.similarity_search(query)
        if not results:
            return "No relevant historical context found."
        formatted = [
            f"{i}. {doc.get('content', doc.get('text', ''))[:400]}..."
            for i, doc in enumerate(results[:4], 1)
        ]
        return "\n\n".join(formatted)
    except Exception as e:
        logger.error(f"RAG retrieval error: {e}")
        return "Could not retrieve historical context."


tools = [
    Tool(
        name="fetch_live_market_data",
        func=fetch_live_market_data,
        description=(
            "Fetch live price, 24h change, 7d change, volume, market cap, ATH for any crypto symbol or pair "
            "(e.g. 'BTC', 'ETH/USDT', 'SOL'). Always call this when the user asks about a price."
        ),
    ),
    Tool(
        name="get_latest_financial_news",
        func=get_latest_financial_news,
        description="Get the most recent financial news across markets.",
    ),
    Tool(
        name="full_market_analysis",
        func=full_market_analysis,
        description=(
            "Run complete technical + sentiment analysis on any ticker: trendlines, indicators, price forecast. "
            "Use this for deeper analysis questions about stocks or crypto."
        ),
    ),
    Tool(
        name="retrieve_relevant_context",
        func=retrieve_relevant_context,
        description="Search historical news and past analyses for additional context.",
    ),
]

FIN_SYSTEM_PROMPT = """You are Fin — FinAi's intelligent trading assistant and the AI brain of the FinAi platform.

You possess expert-level knowledge in:
• Technical Analysis (price action, indicators, chart patterns, volume profile, order flow)
• Fundamental Analysis (macro data, earnings, on-chain metrics, sector trends)
• Risk Management (position sizing, leverage control, portfolio risk, drawdown management)
• All major markets: Stocks, Forex, Cryptocurrencies, Futures, and Options
• Algorithmic & AI-powered bot trading strategies

Your Identity — Fin:
• You are always Fin. Never mention GPT, Groq, Grok, Gemini, DeepSeek, or any model name.
• Never say "As an AI language model..." — you are Fin, a trading specialist.
• Personality: calm, confident, decisive, authoritative — like a seasoned senior trader.
• Adjust technical depth to the user's level.

Live Market Access:
• You have REAL-TIME access to live market prices via the fetch_live_market_data tool.
• When LIVE MARKET DATA is provided in the context below, treat those prices as current and authoritative.
• For any price question, ALWAYS use the fetch_live_market_data tool to get the latest data.
• Never say "I don't have access to current prices" — you do.

Core Rules:
• Always respond concisely, clearly, and professionally.
• Use bullet points and structured sections for readability.
• For trade ideas, always include: entry zone · stop-loss · take-profit · risk-reward ratio.
• Perform multi-timeframe analysis and highlight confluences or conflicts.
• Always include a risk warning with any trade suggestion.

Tool Use Rules:
• price question → fetch_live_market_data first
• specific ticker deep-dive → full_market_analysis
• market news/events → get_latest_financial_news
• historical background → retrieve_relevant_context

Sign-off: Always close trade suggestions with: "This is financial analysis from Fin. Trade at your own risk."
"""


def _get_llm_for_request():
    """Get best available LLM for each request (re-evaluates keys each time)."""
    try:
        return get_llm(temperature=0.7)
    except Exception as e:
        logger.warning(f"LLM init failed ({e}) → Local Intelligence Engine")
        from src.utils.local_llm import LocalAI
        return LocalAI()


def chat_with_agent(
    message: str,
    user_email: str = None,
    market_context: str = "",
) -> str:
    """Chat with Fin agent. Dynamically selects best available LLM provider.
    
    Args:
        message:        User's chat message.
        user_email:     Authenticated user's email (for personalisation).
        market_context: Pre-built live market data block to inject into system prompt.
    """
    global chat_history

    llm = _get_llm_for_request()

    # If LocalAI, route directly to context-aware local engine
    from src.utils.local_llm import LocalAI, local_chat
    if isinstance(llm, LocalAI):
        reply = local_chat(message, user_email)
        chat_history.append({"role": "user", "content": message})
        chat_history.append({"role": "assistant", "content": reply})
        return reply

    provider = get_active_provider()
    tool_descriptions = "\n".join([
        f"- {t.name}: {t.description}" for t in tools
    ])

    market_block = f"\n\n{market_context}\n" if market_context else ""

    system_content = (
        f"{FIN_SYSTEM_PROMPT}"
        f"{market_block}\n"
        f"Available tools (call them by returning 'USE_TOOL: <tool_name> | <input>'):\n"
        f"{tool_descriptions}\n\n"
        "If you need to use a tool, say 'USE_TOOL: tool_name | input'. "
        "Otherwise just respond directly."
    )

    messages = [{"role": "system", "content": system_content}]
    for h in chat_history[-10:]:
        messages.append(h)
    messages.append({"role": "user", "content": message})

    try:
        response = llm.invoke(messages)
        reply = response.content

        if "USE_TOOL:" in reply:
            parts = reply.split("USE_TOOL:")[1].strip().split("|")
            tool_name = parts[0].strip()
            tool_input = parts[1].strip() if len(parts) > 1 else ""
            for t in tools:
                if t.name == tool_name:
                    tool_result = str(t.func(tool_input))
                    follow_up = messages + [
                        {"role": "assistant", "content": reply},
                        {"role": "user", "content": f"Tool result: {tool_result[:2000]}. Now give your final answer."},
                    ]
                    final = llm.invoke(follow_up)
                    reply = final.content
                    break

        chat_history.append({"role": "user", "content": message})
        chat_history.append({"role": "assistant", "content": reply})
        logger.debug(f"Fin responded via [{provider}]")
        return reply

    except Exception as e:
        logger.error(f"Fin agent error (provider={provider}): {e}")
        try:
            return local_chat(message, user_email)
        except Exception:
            return "⚠️ Fin is temporarily unavailable. Please try again in a moment."


logger.success("🤖 Fin (FinAi Agent) is ready!")

agent_executor = type("AgentExecutor", (), {
    "invoke": staticmethod(lambda inp: {"output": chat_with_agent(inp.get("input", ""))})
})()
