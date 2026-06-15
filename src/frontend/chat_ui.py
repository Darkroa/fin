import gradio as gr
from loguru import logger


def chat(message: str, history):
    try:
        from src.conversation.agent import chat_with_agent
        response = chat_with_agent(message)
        return response
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return f"⚠️ Sorry, something went wrong: {str(e)}"


with gr.Blocks(title="FinAi", theme=gr.themes.Dark()) as demo:
    gr.Markdown("# 🤖 FinAi\n**Powered by Finllm** — Your Intelligent Financial Assistant")

    chatbot = gr.Chatbot(height=600, label="Chat with FinAi")
    msg = gr.Textbox(
        label="Ask anything about markets, stocks, or request a full analysis report",
        placeholder="Give me a complete analysis report on AAPL including trendlines, sentiment, and forecast...",
    )

    clear = gr.Button("Clear Conversation")

    def respond(message, history):
        bot_reply = chat(message, history)
        history.append((message, bot_reply))
        return "", history

    msg.submit(respond, [msg, chatbot], [msg, chatbot])
    clear.click(lambda: [], None, chatbot)


if __name__ == "__main__":
    logger.info("🌐 Starting FinAi Chat UI on http://0.0.0.0:7860")
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False)
