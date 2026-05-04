import streamlit as st
import yfinance as yf
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
from datetime import datetime, timedelta
import os

from src.database.session import SessionLocal
from src.database.models import User, TrendAnalysis, TradeLog, Event, UserMoney
from src.users.bot_manager import get_user_bot_manager

st.set_page_config(
    page_title="FinAi — Dashboard",
    layout="wide",
    page_icon="📈",
    initial_sidebar_state="collapsed",
)

if "jwt_token" not in st.session_state or not st.session_state.jwt_token:
    st.switch_page("src/frontend/login.py")

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000/api")
user_email = st.session_state.get("user_email", "")

db = SessionLocal()
user = db.query(User).filter(User.email == user_email).first()
if not user:
    db.close()
    st.session_state.jwt_token = None
    st.switch_page("src/frontend/login.py")

DASH_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

* { box-sizing: border-box; }
html, body, [data-testid="stAppViewContainer"], [data-testid="stApp"] {
    background-color: #0b0e11 !important;
    color: #eaecef !important;
    font-family: 'Inter', sans-serif !important;
}
[data-testid="stToolbar"] { display: none !important; }
.stDeployButton { display: none !important; }
footer { display: none !important; }
#MainMenu { display: none !important; }

/* Sidebar */
[data-testid="stSidebar"] {
    background: #0d1117 !important;
    border-right: 1px solid #1e2329 !important;
    min-width: 220px !important;
}
[data-testid="stSidebar"] .stRadio label { color: #848e9c !important; font-size: 14px !important; }
[data-testid="stSidebar"] .stRadio label:hover { color: #f0b90b !important; }

/* Metrics */
[data-testid="stMetric"] {
    background: #161a1e !important;
    border: 1px solid #1e2329 !important;
    border-radius: 10px !important;
    padding: 16px !important;
}
[data-testid="stMetricLabel"] { color: #848e9c !important; font-size: 12px !important; font-weight: 600 !important; text-transform: uppercase; letter-spacing: 0.5px; }
[data-testid="stMetricValue"] { color: #eaecef !important; font-size: 22px !important; font-weight: 700 !important; }
[data-testid="stMetricDelta"] { font-size: 13px !important; }
[data-testid="stMetricDeltaIcon-Up"] { color: #0ecb81 !important; }
[data-testid="stMetricDeltaIcon-Down"] { color: #f6465d !important; }

/* Buttons */
[data-testid="stButton"] > button {
    background: #2b3139 !important;
    color: #eaecef !important;
    border: 1px solid #2b3139 !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    transition: all 0.2s !important;
}
[data-testid="stButton"] > button:hover {
    background: #363c46 !important;
    border-color: #f0b90b !important;
}

/* Cards */
.binance-card {
    background: #161a1e;
    border: 1px solid #1e2329;
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 16px;
}
.binance-card:hover { border-color: #2b3139; }

.balance-card {
    background: linear-gradient(135deg, #161a1e 0%, #1a2035 100%);
    border: 1px solid #f0b90b44;
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 20px;
}
.balance-amount {
    font-size: 38px;
    font-weight: 800;
    color: #eaecef;
    letter-spacing: -1px;
}
.balance-sub {
    font-size: 14px;
    color: #848e9c;
    margin-top: 4px;
}
.badge-up {
    background: rgba(14,203,129,0.1);
    color: #0ecb81;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 4px;
    display: inline-block;
}
.badge-down {
    background: rgba(246,70,93,0.1);
    color: #f6465d;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 4px;
    display: inline-block;
}

/* Nav top bar */
.top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    background: #0d1117;
    border-bottom: 1px solid #1e2329;
    margin-bottom: 24px;
}
.top-logo { font-size: 20px; font-weight: 800; color: #f0b90b; }
.top-user {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: #848e9c;
}
.avatar {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, #f0b90b, #f8d254);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    color: #0b0e11;
}

/* Section titles */
.section-header {
    font-size: 18px;
    font-weight: 700;
    color: #eaecef;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.section-header span { color: #848e9c; font-size: 13px; font-weight: 400; }

/* Market list */
.market-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #1e2329;
}
.market-row:last-child { border-bottom: none; }
.market-name { font-size: 14px; font-weight: 600; color: #eaecef; }
.market-pair { font-size: 12px; color: #848e9c; }
.market-price { font-size: 14px; font-weight: 700; color: #eaecef; text-align: right; }

/* Input overrides */
[data-testid="stTextInput"] input {
    background: #0b0e11 !important;
    border: 1px solid #2b3139 !important;
    color: #eaecef !important;
    border-radius: 6px !important;
}
[data-testid="stTextInput"] input:focus { border-color: #f0b90b !important; }
[data-testid="stTextInput"] label { color: #848e9c !important; font-size: 12px !important; font-weight: 600 !important; }
[data-testid="stSelectbox"] { background: #0b0e11 !important; }
[data-testid="stNumberInput"] input { background: #0b0e11 !important; border-color: #2b3139 !important; color: #eaecef !important; }

/* Form submit */
[data-testid="stFormSubmitButton"] button {
    background: #f0b90b !important;
    color: #0b0e11 !important;
    font-weight: 700 !important;
    border: none !important;
    border-radius: 6px !important;
}
[data-testid="stFormSubmitButton"] button:hover { background: #f8d254 !important; }

/* Dataframe */
[data-testid="stDataFrame"] { background: #161a1e !important; border-radius: 8px !important; }

/* Dividers */
hr { border-color: #1e2329 !important; }
</style>
"""
st.markdown(DASH_CSS, unsafe_allow_html=True)


def get_price(ticker_sym: str) -> tuple:
    try:
        t = yf.Ticker(ticker_sym)
        hist = t.history(period="2d")
        if len(hist) >= 2:
            price = hist["Close"].iloc[-1]
            prev = hist["Close"].iloc[-2]
            pct = (price - prev) / prev * 100
            return price, pct
        return hist["Close"].iloc[-1], 0.0
    except Exception:
        return None, 0.0


first_letter = (user.full_name or user_email or "U")[0].upper()

col_logo, col_mid, col_user = st.columns([1, 6, 2])
with col_logo:
    st.markdown('<div style="font-size:20px;font-weight:800;color:#f0b90b;padding:8px 0;">📈 FinAi</div>', unsafe_allow_html=True)
with col_user:
    st.markdown(f"""
    <div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;padding:6px 0;">
        <span style="font-size:13px;color:#848e9c;">{user.full_name or user_email}</span>
        <div class="avatar">{first_letter}</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown('<hr style="margin:0 0 20px;">', unsafe_allow_html=True)

with st.sidebar:
    st.markdown('<div style="font-size:18px;font-weight:800;color:#f0b90b;padding:8px 0 16px;">📈 FinAi</div>', unsafe_allow_html=True)
    st.markdown('<div style="font-size:11px;color:#848e9c;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Navigation</div>', unsafe_allow_html=True)

    nav = st.radio(
        "",
        ["Overview", "Markets", "Trading Bots", "Portfolio", "Deposit", "Withdrawal", "History", "Analysis", "Profile", "API Keys"],
        label_visibility="collapsed",
    )

    st.markdown("<br>" * 3, unsafe_allow_html=True)
    if st.button("Logout", use_container_width=True):
        for k in list(st.session_state.keys()):
            del st.session_state[k]
        st.switch_page("src/frontend/login.py")

    if user.is_admin:
        st.markdown("---")
        if st.button("Admin Panel", use_container_width=True):
            st.switch_page("admin/admin_dashboard.py")


# ─────────────────────────── OVERVIEW ────────────────────────────
if nav == "Overview":
    st.markdown('<div class="section-header">Dashboard Overview</div>', unsafe_allow_html=True)

    usd = user.default_capital
    try:
        btc_p, btc_ch = get_price("BTC-USD")
        eth_p, eth_ch = get_price("ETH-USD")
        aapl_p, aapl_ch = get_price("AAPL")
        spy_p, spy_ch = get_price("SPY")
    except Exception:
        btc_p = eth_p = aapl_p = spy_p = None
        btc_ch = eth_ch = aapl_ch = spy_ch = 0.0

    col_bal, col_b1, col_b2 = st.columns([2, 1, 1])
    with col_bal:
        btc_eq = usd / btc_p if btc_p else 0
        st.markdown(f"""
        <div class="balance-card">
            <div style="font-size:12px;color:#848e9c;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Total Balance</div>
            <div class="balance-amount">${usd:,.2f}</div>
            <div class="balance-sub">≈ {btc_eq:.6f} BTC</div>
            <div style="margin-top:16px;display:flex;gap:12px;">
        </div>
        """, unsafe_allow_html=True)

    with col_b1:
        st.markdown(f"""
        <div class="binance-card" style="text-align:center;">
            <div style="font-size:12px;color:#848e9c;font-weight:600;margin-bottom:8px;">Risk / Trade</div>
            <div style="font-size:24px;font-weight:800;color:#f0b90b;">{user.risk_per_trade}%</div>
        </div>
        <div class="binance-card" style="text-align:center;">
            <div style="font-size:12px;color:#848e9c;font-weight:600;margin-bottom:8px;">Max Drawdown</div>
            <div style="font-size:24px;font-weight:800;color:#f6465d;">{user.max_drawdown}%</div>
        </div>
        """, unsafe_allow_html=True)

    with col_b2:
        manager = get_user_bot_manager(user.email, user.id)
        bots = manager.get_status() or {}
        st.markdown(f"""
        <div class="binance-card" style="text-align:center;">
            <div style="font-size:12px;color:#848e9c;font-weight:600;margin-bottom:8px;">Active Bots</div>
            <div style="font-size:24px;font-weight:800;color:#0ecb81;">{len(bots)}</div>
        </div>
        <div class="binance-card" style="text-align:center;">
            <div style="font-size:12px;color:#848e9c;font-weight:600;margin-bottom:8px;">Account Status</div>
            <div style="font-size:14px;font-weight:700;color:{'#0ecb81' if user.is_active else '#f6465d'};">{'Active' if user.is_active else 'Inactive'}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    col_left, col_right = st.columns([2, 1])
    with col_left:
        st.markdown('<div class="section-header">Market Chart</div>', unsafe_allow_html=True)
        chart_sym = st.selectbox("", ["AAPL", "BTC-USD", "ETH-USD", "TSLA", "NVDA", "SPY", "MSFT"], label_visibility="collapsed")
        try:
            df = yf.download(chart_sym, period="3mo", interval="1d", progress=False)
            if not df.empty:
                fig = go.Figure()
                colors = ['#0ecb81' if float(row['Close'].iloc[0]) >= float(row['Open'].iloc[0])
                          else '#f6465d' for _, row in df.iterrows()]
                fig.add_trace(go.Candlestick(
                    x=df.index,
                    open=df['Open'].squeeze(),
                    high=df['High'].squeeze(),
                    low=df['Low'].squeeze(),
                    close=df['Close'].squeeze(),
                    increasing=dict(line=dict(color='#0ecb81'), fillcolor='#0ecb81'),
                    decreasing=dict(line=dict(color='#f6465d'), fillcolor='#f6465d'),
                    name=chart_sym,
                ))
                ma20 = df['Close'].squeeze().rolling(20).mean()
                fig.add_trace(go.Scatter(
                    x=df.index, y=ma20,
                    line=dict(color='#f0b90b', width=1.5, dash='dot'),
                    name="MA20",
                ))
                fig.update_layout(
                    template="plotly_dark",
                    paper_bgcolor="#161a1e",
                    plot_bgcolor="#161a1e",
                    height=380,
                    margin=dict(l=0, r=0, t=24, b=0),
                    xaxis=dict(gridcolor="#1e2329", showgrid=True, rangeslider=dict(visible=False)),
                    yaxis=dict(gridcolor="#1e2329", showgrid=True),
                    legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(color="#848e9c")),
                    font=dict(color="#848e9c"),
                )
                st.plotly_chart(fig, use_container_width=True)
        except Exception as e:
            st.info(f"Chart unavailable: {e}")

    with col_right:
        st.markdown('<div class="section-header">Market Watch</div>', unsafe_allow_html=True)
        pairs = [
            ("BTC/USD", "₿ Bitcoin", btc_p, btc_ch),
            ("ETH/USD", "⟠ Ethereum", eth_p, eth_ch),
            ("AAPL", "🍎 Apple", aapl_p, aapl_ch),
            ("SPY", "📊 S&P 500", spy_p, spy_ch),
        ]
        mkt_html = '<div class="binance-card">'
        for sym, name, price, chg in pairs:
            color = "#0ecb81" if (chg or 0) >= 0 else "#f6465d"
            sign = "+" if (chg or 0) >= 0 else ""
            price_str = f"${price:,.2f}" if price else "—"
            mkt_html += f"""
            <div class="market-row">
                <div>
                    <div class="market-name">{sym}</div>
                    <div class="market-pair">{name}</div>
                </div>
                <div>
                    <div class="market-price">{price_str}</div>
                    <div style="font-size:12px;color:{color};text-align:right;font-weight:600;">{sign}{chg:.2f}%</div>
                </div>
            </div>
            """
        mkt_html += "</div>"
        st.markdown(mkt_html, unsafe_allow_html=True)

        st.markdown('<div class="section-header" style="margin-top:16px;">Quick Actions</div>', unsafe_allow_html=True)
        col_q1, col_q2 = st.columns(2)
        with col_q1:
            if st.button("Deposit", use_container_width=True):
                st.session_state["nav_override"] = "Deposit"
                st.rerun()
        with col_q2:
            if st.button("Withdraw", use_container_width=True):
                st.session_state["nav_override"] = "Withdrawal"
                st.rerun()
        if st.button("Start Bot", use_container_width=True):
            st.session_state["nav_override"] = "Trading Bots"
            st.rerun()

    try:
        events = db.query(Event).order_by(Event.created_at.desc()).limit(5).all()
        if events:
            st.markdown('<div class="section-header" style="margin-top:8px;">Recent Market Events</div>', unsafe_allow_html=True)
            for ev in events:
                imp_color = "#f6465d" if ev.impact_score >= 7 else "#f0b90b" if ev.impact_score >= 5 else "#0ecb81"
                sent_color = "#0ecb81" if ev.sentiment == "positive" else "#f6465d" if ev.sentiment == "negative" else "#848e9c"
                st.markdown(f"""
                <div class="binance-card" style="padding:14px 18px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                        <div>
                            <div style="font-size:14px;font-weight:600;color:#eaecef;margin-bottom:4px;">{ev.title or 'Event'}</div>
                            <div style="font-size:12px;color:#848e9c;">{ev.event_type} · {ev.created_at.strftime('%b %d, %H:%M') if ev.created_at else ''}</div>
                        </div>
                        <div style="text-align:right;flex-shrink:0;">
                            <div style="font-size:12px;color:{imp_color};font-weight:700;">Impact {ev.impact_score}/10</div>
                            <div style="font-size:12px;color:{sent_color};text-transform:capitalize;">{ev.sentiment or ''}</div>
                        </div>
                    </div>
                </div>
                """, unsafe_allow_html=True)
    except Exception:
        pass


# ─────────────────────────── MARKETS ────────────────────────────
elif nav == "Markets":
    st.markdown('<div class="section-header">Markets</div>', unsafe_allow_html=True)
    watchlist = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "SPY", "QQQ"]
    rows = []
    with st.spinner("Fetching live prices..."):
        for sym in watchlist:
            try:
                t = yf.Ticker(sym)
                hist = t.history(period="2d")
                if len(hist) >= 2:
                    p = hist["Close"].iloc[-1]
                    prev = hist["Close"].iloc[-2]
                    chg = (p - prev) / prev * 100
                    vol = hist["Volume"].iloc[-1]
                    rows.append({"Asset": sym, "Price": f"${p:,.2f}", "24h Change": f"{'+' if chg>=0 else ''}{chg:.2f}%", "Volume": f"{vol:,.0f}", "_chg": chg})
            except Exception:
                rows.append({"Asset": sym, "Price": "—", "24h Change": "—", "Volume": "—", "_chg": 0})

    if rows:
        df_mkt = pd.DataFrame(rows).drop(columns=["_chg"])
        st.dataframe(df_mkt, use_container_width=True, hide_index=True)


# ─────────────────────────── TRADING BOTS ────────────────────────────
elif nav == "Trading Bots":
    st.markdown('<div class="section-header">Trading Bots</div>', unsafe_allow_html=True)
    manager = get_user_bot_manager(user.email, user.id)
    status = manager.get_status() or {}

    if status:
        for ticker, s in status.items():
            pnl = s.get("unrealized_pnl", 0)
            pnl_color = "#0ecb81" if pnl >= 0 else "#f6465d"
            running = s.get("running", False)
            st.markdown(f"""
            <div class="binance-card">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                    <div>
                        <div style="font-size:16px;font-weight:700;color:#eaecef;">{ticker}</div>
                        <div style="font-size:12px;color:{'#0ecb81' if running else '#848e9c'};">{'● Running' if running else '○ Stopped'}</div>
                    </div>
                    <div style="font-size:22px;font-weight:800;color:{pnl_color};">{'+' if pnl>=0 else ''}${pnl:.2f}</div>
                </div>
                <div style="display:flex;gap:24px;font-size:13px;color:#848e9c;">
                    <span>Portfolio: <b style="color:#eaecef;">${s.get('portfolio_value',0):,.2f}</b></span>
                    <span>Position: <b style="color:#eaecef;">{s.get('position',0):.4f}</b></span>
                    <span>Drawdown: <b style="color:#f6465d;">{s.get('current_drawdown_pct',0):.1f}%</b></span>
                </div>
            </div>
            """, unsafe_allow_html=True)
            if st.button(f"Stop {ticker}", key=f"stop_{ticker}"):
                manager.stop_bot(ticker)
                st.success(f"{ticker} bot stopped.")
                st.rerun()
    else:
        st.markdown("""
        <div class="binance-card" style="text-align:center;padding:40px;">
            <div style="font-size:40px;margin-bottom:12px;">🤖</div>
            <div style="font-size:16px;font-weight:600;color:#eaecef;margin-bottom:8px;">No Active Bots</div>
            <div style="font-size:14px;color:#848e9c;">Launch your first trading bot below</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown('<div class="section-header" style="margin-top:24px;">Launch New Bot</div>', unsafe_allow_html=True)
    with st.form("start_bot_form"):
        col_t, col_p, col_cp = st.columns([2, 1, 1])
        with col_t:
            ticker = st.text_input("Ticker Symbol", value="AAPL", placeholder="e.g. AAPL, BTC-USD")
        with col_p:
            paper = st.checkbox("Paper Trading", value=True)
        with col_cp:
            capital = st.number_input("Capital ($)", value=float(user.default_capital), min_value=100.0)
        submitted = st.form_submit_button("Start Bot", use_container_width=True)
        if submitted and ticker:
            result = manager.start_bot(ticker.strip().upper(), paper)
            st.success(f"Bot started: {result}")
            st.rerun()


# ─────────────────────────── PORTFOLIO ────────────────────────────
elif nav == "Portfolio":
    st.markdown('<div class="section-header">Portfolio</div>', unsafe_allow_html=True)
    usd = user.default_capital
    allocations = [
        ("USD Cash", usd * 0.4, "#f0b90b"),
        ("BTC", usd * 0.3, "#f7931a"),
        ("ETH", usd * 0.2, "#627eea"),
        ("Other", usd * 0.1, "#848e9c"),
    ]
    fig_pie = go.Figure(data=[go.Pie(
        labels=[a[0] for a in allocations],
        values=[a[1] for a in allocations],
        marker=dict(colors=[a[2] for a in allocations]),
        hole=0.6,
        textfont=dict(color="#eaecef"),
    )])
    fig_pie.update_layout(
        paper_bgcolor="#161a1e",
        plot_bgcolor="#161a1e",
        font=dict(color="#848e9c"),
        height=300,
        margin=dict(l=0, r=0, t=0, b=0),
        showlegend=True,
        legend=dict(font=dict(color="#848e9c")),
        annotations=[dict(text=f"${usd:,.0f}", x=0.5, y=0.5, font_size=20, font_color="#eaecef", showarrow=False)],
    )
    col_pie, col_alloc = st.columns([1, 1])
    with col_pie:
        st.plotly_chart(fig_pie, use_container_width=True)
    with col_alloc:
        for name, val, color in allocations:
            pct = (val / usd) * 100
            st.markdown(f"""
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1e2329;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:10px;height:10px;border-radius:50%;background:{color};"></div>
                    <span style="font-size:14px;color:#eaecef;font-weight:600;">{name}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:14px;color:#eaecef;font-weight:700;">${val:,.2f}</div>
                    <div style="font-size:12px;color:#848e9c;">{pct:.0f}%</div>
                </div>
            </div>
            """, unsafe_allow_html=True)


# ─────────────────────────── DEPOSIT ────────────────────────────
elif nav == "Deposit":
    import qrcode
    from io import BytesIO
    import base64
    from decimal import Decimal

    st.markdown('<div class="section-header">Deposit Funds</div>', unsafe_allow_html=True)

    coin_data = {
        "BTC": {"name": "Bitcoin", "min": 0.00001, "address": "1FMXu8fTqFHALrsxavrYAS5wD3urbPk6hh"},
        "ETH": {"name": "Ethereum", "min": 0.001, "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"},
        "USDT": {"name": "Tether ERC20", "min": 1.0, "address": "0x28c6c06298d514db089934071355e5743bf21d60"},
    }

    col_form, col_info = st.columns([1, 1])
    with col_form:
        with st.form("deposit_form"):
            selected_coin = st.selectbox("Select Cryptocurrency", list(coin_data.keys()))
            amount_usd = st.number_input("Amount in USD ($)", min_value=10.0, value=100.0, step=10.0)
            submitted = st.form_submit_button("Confirm Deposit Request", use_container_width=True)
            if submitted:
                from datetime import timedelta
                expires = datetime.utcnow() + timedelta(hours=1)
                dep = UserMoney(user_id=user.id, amount=amount_usd, status="pending")
                db.add(dep)
                db.commit()
                st.success(f"Deposit request for ${amount_usd} submitted. Pending confirmation.")

    with col_info:
        coin = coin_data.get(selected_coin if "selected_coin" in dir() else "BTC", coin_data["BTC"])
        try:
            t = yf.Ticker(f"{list(coin_data.keys())[0]}-USD")
            price_live = t.history(period="1d")["Close"].iloc[-1]
            equiv = amount_usd / price_live if "amount_usd" in dir() else 0
            st.metric("Live Price", f"${price_live:,.2f}")
        except Exception:
            pass

        qr = qrcode.make(coin_data.get(selected_coin if "selected_coin" in dir() else "BTC", coin_data["BTC"])["address"])
        buf = BytesIO()
        qr.save(buf, format="PNG")
        st.image(f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}", width=180)
        st.code(coin_data.get(selected_coin if "selected_coin" in dir() else "BTC", coin_data["BTC"])["address"])
        st.warning("Send only the correct cryptocurrency. Wrong network = loss of funds.")


# ─────────────────────────── WITHDRAWAL ────────────────────────────
elif nav == "Withdrawal":
    from decimal import Decimal

    st.markdown('<div class="section-header">Withdrawal</div>', unsafe_allow_html=True)
    st.markdown(f"""
    <div class="binance-card">
        <div style="font-size:12px;color:#848e9c;text-transform:uppercase;font-weight:600;margin-bottom:6px;">Available Balance</div>
        <div style="font-size:32px;font-weight:800;color:#0ecb81;">${user.default_capital:,.2f}</div>
    </div>
    """, unsafe_allow_html=True)

    with st.form("withdrawal_form"):
        coin = st.selectbox("Cryptocurrency", ["BTC", "ETH", "USDT"])
        amount_usd = st.number_input("Amount USD", min_value=10.0, max_value=float(user.default_capital), value=100.0, step=10.0)
        address = st.text_input("Destination Wallet Address", placeholder="Enter wallet address")
        submitted = st.form_submit_button("Submit Withdrawal", use_container_width=True)
        if submitted:
            if not address.strip():
                st.error("Please enter a valid destination address.")
            elif amount_usd > user.default_capital:
                st.error("Insufficient balance.")
            else:
                wd = UserMoney(user_id=user.id, amount=-amount_usd, status="pending")
                db.add(wd)
                db.commit()
                st.success(f"Withdrawal of ${amount_usd} requested. Processing within 24 hours.")


# ─────────────────────────── HISTORY ────────────────────────────
elif nav == "History":
    st.markdown('<div class="section-header">Transaction History</div>', unsafe_allow_html=True)
    try:
        txs = db.query(UserMoney).filter(UserMoney.user_id == user.id).order_by(UserMoney.created_at.desc()).all()
        if txs:
            data = []
            for t in txs:
                amt = float(t.amount or 0)
                status_color = {"pending": "#f0b90b", "approved": "#0ecb81", "rejected": "#f6465d"}.get(t.status, "#848e9c")
                data.append({
                    "Date": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "—",
                    "Type": "Deposit" if amt > 0 else "Withdrawal",
                    "Amount": f"${abs(amt):,.2f}",
                    "Status": t.status.capitalize() if t.status else "—",
                })
            df_tx = pd.DataFrame(data)
            st.dataframe(df_tx, use_container_width=True, hide_index=True)
        else:
            st.info("No transactions yet.")
    except Exception as e:
        st.info(f"No transaction data available: {e}")


# ─────────────────────────── ANALYSIS ────────────────────────────
elif nav == "Analysis":
    import requests as req
    st.markdown('<div class="section-header">Market Analysis</div>', unsafe_allow_html=True)
    col_in, col_out = st.columns([1, 2])
    with col_in:
        with st.form("analysis_form"):
            ticker = st.text_input("Ticker", value="AAPL")
            period = st.selectbox("Period", ["30d", "60d", "90d", "6mo"])
            submitted = st.form_submit_button("Analyze", use_container_width=True)
    with col_out:
        if submitted and ticker:
            with st.spinner(f"Analyzing {ticker}..."):
                try:
                    r = req.get(f"{API_BASE}/analyze-trendline", params={"ticker": ticker, "period": period}, timeout=30)
                    if r.status_code == 200:
                        result = r.json()
                        st.json(result)
                    else:
                        st.error(f"Analysis failed: {r.text}")
                except Exception as e:
                    st.error(f"Analysis error: {e}")


# ─────────────────────────── PROFILE ────────────────────────────
elif nav == "Profile":
    st.markdown('<div class="section-header">Profile Settings</div>', unsafe_allow_html=True)
    col_pf, col_sp = st.columns([1, 1])
    with col_pf:
        st.markdown(f"""
        <div class="binance-card">
            <div class="avatar" style="width:60px;height:60px;font-size:24px;margin-bottom:16px;">{first_letter}</div>
            <div style="font-size:18px;font-weight:700;color:#eaecef;">{user.full_name or 'No name set'}</div>
            <div style="font-size:13px;color:#848e9c;margin-top:4px;">{user.email}</div>
            <div style="margin-top:12px;display:flex;gap:12px;">
                <span style="font-size:12px;color:{'#0ecb81' if user.is_active else '#f6465d'};font-weight:600;">{'● Active' if user.is_active else '○ Inactive'}</span>
                {'<span style="font-size:12px;color:#f0b90b;font-weight:600;">★ Admin</span>' if user.is_admin else ''}
            </div>
        </div>
        """, unsafe_allow_html=True)
    with col_sp:
        with st.form("profile_form"):
            new_name = st.text_input("Full Name", value=user.full_name or "")
            risk = st.slider("Risk per Trade (%)", 0.1, 5.0, float(user.risk_per_trade), 0.1)
            drawdown = st.slider("Max Drawdown (%)", 5.0, 30.0, float(user.max_drawdown), 1.0)
            submitted = st.form_submit_button("Save Settings", use_container_width=True)
            if submitted:
                user.full_name = new_name
                user.risk_per_trade = risk
                user.max_drawdown = drawdown
                db.commit()
                st.success("Settings saved successfully.")
                st.rerun()


# ─────────────────────────── API KEYS ────────────────────────────
elif nav == "API Keys":
    import requests as req
    st.markdown('<div class="section-header">API Keys</div>', unsafe_allow_html=True)
    headers = {"Authorization": f"Bearer {st.session_state.jwt_token}"}

    with st.form("create_key_form"):
        key_name = st.text_input("Key Name", placeholder="e.g. my-trading-script")
        expires = st.number_input("Expires (days)", value=365, min_value=1, max_value=3650)
        submitted = st.form_submit_button("Create API Key", use_container_width=True)
        if submitted and key_name:
            try:
                r = req.post(f"{API_BASE}/api-keys", params={"key_name": key_name, "expires_days": int(expires)}, headers=headers, timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    st.success("API Key created — save it now, it won't be shown again.")
                    st.code(data.get("api_key", ""), language=None)
                else:
                    st.error(f"Failed: {r.text}")
            except Exception as e:
                st.error(f"Error: {e}")

    try:
        r = req.get(f"{API_BASE}/api-keys", headers=headers, timeout=10)
        keys = r.json() if r.status_code == 200 else []
        if keys:
            df_keys = pd.DataFrame(keys)
            st.dataframe(df_keys, use_container_width=True, hide_index=True)
    except Exception:
        pass

db.close()
