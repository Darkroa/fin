from langchain_core.prompts import ChatPromptTemplate
from langchain_community.tools import Tool
from langchain_core.messages import HumanMessage, AIMessage
from loguru import logger

from src.utils.llm import get_llm
from src.analysis.full_analyzer import FullAnalyzer
from src.rag.vector_store import FinancialRAG
from src.ingestion.news_fetcher import NewsFetcher


try:
    llm = get_llm(model="grok", temperature=0.7)
except Exception as _e:
    logger.warning(f"LLM init failed ({_e}) → using Local Intelligence Engine")
    from src.utils.local_llm import LocalAI
    llm = LocalAI()

rag = FinancialRAG()
full_analyzer = FullAnalyzer()
news_fetcher = NewsFetcher()

chat_history = []


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
        name="get_latest_financial_news",
        func=get_latest_financial_news,
        description="Get the most recent financial news across markets.",
    ),
    Tool(
        name="full_market_analysis",
        func=full_market_analysis,
        description=(
            "Run complete analysis on any ticker: trendlines, sentiment, impact, and price forecast. "
            "Use this first for any stock-specific question."
        ),
    ),
    Tool(
        name="retrieve_relevant_context",
        func=retrieve_relevant_context,
        description="Search historical news and past analyses for additional context.",
    ),
]

SYSTEM_PROMPT = """You are ChatFin, a professional AI Trading Assistant for the ChatFin trading platform.

You possess expert-level, up-to-date knowledge in:
• Technical Analysis (price action, indicators, chart patterns, volume profile, order flow)
• Fundamental Analysis (macro data, earnings, on-chain metrics, sector trends)
• Risk Management (position sizing, leverage control, portfolio risk, drawdown management)
• All major markets: Stocks, Forex, Cryptocurrencies, Futures, and Options
• Algorithmic & AI-powered bot trading strategies

Core Rules:
• Always respond in a concise, clear, structured, and highly professional tone.
• Use bullet points, tables, and formatted sections for better readability.
• Always include clear risk warnings with any trade suggestion.
• For trade ideas, provide: entry zone, stop-loss, take-profit levels, and risk-reward ratio.
• Perform multi-timeframe analysis (1m to Weekly) and highlight confluences or conflicts.
• You can analyze chart images when provided.
• You have access to real-time market data.

LLM Integration & Routing:
You intelligently route across multiple LLM providers: Google AI Studio, Groq Cloud, GitHub Models, OpenRouter, NVIDIA Build, DeepSeek, OpenAI (ChatGPT), and Grok.
• Automatically select the best model based on task complexity, speed, and availability.
• When no API key is available, seamlessly switch to the local LLM.
• Maintain complete consistency in personality, knowledge, and output quality regardless of the underlying LLM.

Personality & Tone:
• Act as a seasoned senior trader — calm, confident, decisive, and authoritative.
• Use professional yet approachable language. Adjust technical depth based on the user's level.
• Always close any trade suggestion or high-risk idea with: "This is financial analysis with ChatFin. Trade at your own risk."

Rules (Tool Use):
- When the user asks about any specific stock or ticker, ALWAYS use the full_market_analysis tool first.
- For general market updates, use get_latest_financial_news.
- Use retrieve_relevant_context when more historical background is needed.
- Give clear insights with confidence levels and actionable recommendations."""


def chat_with_agent(message: str, user_email: str = None) -> str:
    """Chat with FinAi agent. Falls back to local intelligence when no API keys."""
    global chat_history

    # If llm is LocalAI, route directly to context-aware local engine
    from src.utils.local_llm import LocalAI, local_chat
    if isinstance(llm, LocalAI):
        reply = local_chat(message, user_email)
        chat_history.append({"role": "user", "content": message})
        chat_history.append({"role": "assistant", "content": reply})
        return reply

    tool_descriptions = "\n".join([
        f"- {t.name}: {t.description}" for t in tools
    ])

    system_content = (
        f"{SYSTEM_PROMPT}\n\n"
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
        return reply

    except Exception as e:
        logger.error(f"Agent chat error: {e}")
        # Final fallback to local intelligence
        try:
            return local_chat(message, user_email)
        except Exception:
            return f"⚠️ FinAi assistant is temporarily unavailable."


logger.success("🤖 FinAi Agent is ready!")

agent_executor = type("AgentExecutor", (), {
    "invoke": staticmethod(lambda inp: {"output": chat_with_agent(inp.get("input", ""))})
})()
