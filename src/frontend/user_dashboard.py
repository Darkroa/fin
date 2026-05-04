import streamlit as st
import yfinance as yf
import plotly.graph_objects as go
import pandas as pd
from datetime import datetime
import os
import time

from src.database.session import SessionLocal
from src.database.models import User, Event, UserMoney
from src.users.bot_manager import get_user_bot_manager

st.set_page_config(
    page_title="FinAi — Dashboard",
    layout="wide",
    page_icon="📈",
    initial_sidebar_state="expanded",
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

# ── Brightness toggle state ──
if "bright_mode" not in st.session_state:
    st.session_state.bright_mode = False

BG    = "#f0f2f5" if st.session_state.bright_mode else "#0b0e11"
CARD  = "#ffffff" if st.session_state.bright_mode else "#161a1e"
CARD2 = "#f4f6f8" if st.session_state.bright_mode else "#0d1117"
BDR   = "#d0d7de" if st.session_state.bright_mode else "#1e2329"
TXT   = "#1a1d24" if st.session_state.bright_mode else "#eaecef"
MUTED = "#5a6472" if st.session_state.bright_mode else "#848e9c"
CHART_BG = "#ffffff" if st.session_state.bright_mode else "#161a1e"
PLOT_TEMPLATE = "plotly_white" if st.session_state.bright_mode else "plotly_dark"

DASH_CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

*, *::before, *::after {{ box-sizing: border-box; }}
html, body,
[data-testid="stApp"],
[data-testid="stAppViewContainer"],
[data-testid="stMain"], .main, section.main {{
    background-color: {BG} !important;
    color: {TXT} !important;
    font-family: 'Inter', sans-serif !important;
}}
[data-testid="stToolbar"], [data-testid="stDecoration"],
[data-testid="stStatusWidget"], .stDeployButton,
footer, #MainMenu {{ display: none !important; }}

/* Sidebar */
[data-testid="stSidebar"] {{
    background: {CARD2} !important;
    border-right: 1px solid {BDR} !important;
}}
[data-testid="stSidebar"] .stRadio label {{ color: {MUTED} !important; font-size: 14px !important; }}
[data-testid="stSidebar"] .stRadio label:hover {{ color: #f0b90b !important; }}

/* Metrics */
[data-testid="stMetric"] {{
    background: {CARD} !important;
    border: 1px solid {BDR} !important;
    border-radius: 10px !important;
    padding: 16px !important;
}}
[data-testid="stMetricLabel"] {{ color: {MUTED} !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase; letter-spacing: 0.6px; }}
[data-testid="stMetricValue"] {{ color: {TXT} !important; font-size: 22px !important; font-weight: 800 !important; }}
[data-testid="stMetricDeltaIcon-Up"]   {{ color: #0ecb81 !important; }}
[data-testid="stMetricDeltaIcon-Down"] {{ color: #f6465d !important; }}

/* Buttons */
[data-testid="stButton"] > button {{
    background: {CARD} !important;
    color: {TXT} !important;
    border: 1px solid {BDR} !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    transition: all 0.2s !important;
}}
[data-testid="stButton"] > button:hover {{
    border-color: #f0b90b !important;
    color: #f0b90b !important;
}}

/* Cards */
.b-card {{
    background: {CARD};
    border: 1px solid {BDR};
    border-radius: 10px;
    padding: 20px 22px;
    margin-bottom: 14px;
}}
.balance-card {{
    background: linear-gradient(135deg, {CARD}, {'#eef4ff' if st.session_state.bright_mode else '#1a2035'});
    border: 1px solid {'#b8d4ff' if st.session_state.bright_mode else '#f0b90b44'};
    border-radius: 12px;
    padding: 26px;
    margin-bottom: 18px;
}}
.section-hdr {{
    font-size: 17px;
    font-weight: 700;
    color: {TXT};
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid {BDR};
}}
.market-row {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 0;
    border-bottom: 1px solid {BDR};
}}
.market-row:last-child {{ border-bottom: none; }}

/* Ticker */
.live-ticker {{
    background: {'#1a1d24' if not st.session_state.bright_mode else '#e8ecf0'};
    border-bottom: 1px solid {BDR};
    padding: 9px 16px;
    overflow: hidden;
    white-space: nowrap;
    font-size: 12px;
}}
.t-up {{ color: #0ecb81; font-weight: 700; margin-right: 20px; }}
.t-dn {{ color: #f6465d; font-weight: 700; margin-right: 20px; }}
.t-sym {{ color: {MUTED}; margin-right: 4px; }}

/* Form fields */
[data-testid="stTextInput"] input {{
    background: {'#f8f9fa' if st.session_state.bright_mode else '#0b0e11'} !important;
    border: 1px solid {BDR} !important;
    color: {TXT} !important;
    border-radius: 6px !important;
}}
[data-testid="stTextInput"] input:focus {{ border-color: #f0b90b !important; }}
[data-testid="stTextInput"] label {{ color: {MUTED} !important; font-size: 12px !important; font-weight: 600 !important; }}
[data-testid="stNumberInput"] input {{ background: {'#f8f9fa' if st.session_state.bright_mode else '#0b0e11'} !important; border-color: {BDR} !important; color: {TXT} !important; }}

[data-testid="stFormSubmitButton"] button {{
    background: #f0b90b !important;
    color: #0b0e11 !important;
    font-weight: 700 !important;
    border: none !important;
    border-radius: 6px !important;
}}
[data-testid="stFormSubmitButton"] button:hover {{ background: #f8d254 !important; }}

[data-testid="stDataFrame"] {{ background: {CARD} !important; border-radius: 8px !important; }}
hr {{ border-color: {BDR} !important; }}

/* Brightness toggle button */
#bright-btn button {{
    background: {'#f0b90b' if st.session_state.bright_mode else '#2b3139'} !important;
    color: {'#0b0e11' if st.session_state.bright_mode else '#eaecef'} !important;
    border: none !important;
    border-radius: 20px !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    padding: 6px 14px !important;
}}

/* Admin credentials card */
.admin-cred-card {{
    background: rgba(240,185,11,0.08);
    border: 1px solid rgba(240,185,11,0.25);
    border-radius: 8px;
    padding: 12px 14px;
    margin-top: 8px;
    font-size: 12px;
    color: {MUTED};
}}
.admin-cred-card b {{ color: {TXT}; }}
</style>
"""
st.markdown(DASH_CSS, unsafe_allow_html=True)


@st.cache_data(ttl=60)
def fetch_prices():
    syms = {"BTC-USD": "BTC", "ETH-USD": "ETH", "AAPL": "AAPL",
            "TSLA": "TSLA", "SPY": "SPY", "NVDA": "NVDA"}
    results = {}
    for sym, label in syms.items():
        try:
            h = yf.Ticker(sym).history(period="2d")
            if len(h) >= 2:
                p = float(h["Close"].iloc[-1])
                prev = float(h["Close"].iloc[-2])
                chg = (p - prev) / prev * 100
                results[label] = (p, chg)
        except Exception:
            results[label] = (None, 0.0)
    return results


def get_price(sym: str):
    try:
        h = yf.Ticker(sym).history(period="2d")
        if len(h) >= 2:
            p = float(h["Close"].iloc[-1])
            prev = float(h["Close"].iloc[-2])
            return p, (p - prev) / prev * 100
        return float(h["Close"].iloc[-1]), 0.0
    except Exception:
        return None, 0.0


first_letter = (user.full_name or user_email or "U")[0].upper()

# ── TOP BAR ──
tc1, tc2, tc3, tc4 = st.columns([0.8, 5, 1.2, 0.8])
with tc1:
    st.markdown(f'<div style="font-size:20px;font-weight:800;color:#f0b90b;padding:6px 0;">📈</div>', unsafe_allow_html=True)
with tc2:
    st.markdown(f'<div style="font-size:19px;font-weight:800;color:#f0b90b;padding:7px 0;">FinAi</div>', unsafe_allow_html=True)
with tc3:
    icon = "☀️ Light" if not st.session_state.bright_mode else "🌙 Dark"
    st.markdown('<div id="bright-btn">', unsafe_allow_html=True)
    if st.button(icon, key="bright_toggle", use_container_width=True):
        st.session_state.bright_mode = not st.session_state.bright_mode
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)
with tc4:
    st.markdown(f"""
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:4px 0;">
        <div style="width:32px;height:32px;background:linear-gradient(135deg,#f0b90b,#f8d254);
        border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
        font-size:13px;font-weight:800;color:#0b0e11;">{first_letter}</div>
    </div>
    """, unsafe_allow_html=True)

# ── LIVE TICKER BAR ──
prices = fetch_prices()
ticker_html = '<div class="live-ticker">'
for label, (p, chg) in prices.items():
    if p:
        cls = "t-up" if chg >= 0 else "t-dn"
        arrow = "▲" if chg >= 0 else "▼"
        ticker_html += f'<span class="t-sym">{label}</span><span class="{cls}">${p:,.2f} {arrow} {abs(chg):.2f}%</span>'
ticker_html += f'<span style="color:{MUTED};font-size:11px;float:right;">Auto-refreshes every 60s</span></div>'
st.markdown(ticker_html, unsafe_allow_html=True)

st.markdown(f'<hr style="margin:0 0 6px;">', unsafe_allow_html=True)

# ── SIDEBAR ──
with st.sidebar:
    st.markdown(f'<div style="font-size:17px;font-weight:800;color:#f0b90b;padding:6px 0 14px;">📈 FinAi</div>', unsafe_allow_html=True)
    st.markdown(f'<div style="font-size:11px;color:{MUTED};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Navigation</div>', unsafe_allow_html=True)

    nav = st.radio("", [
        "Overview", "Markets", "Trading Bots", "Portfolio",
        "Deposit", "Withdrawal", "History", "Analysis", "Profile", "API Keys"
    ], label_visibility="collapsed")

    st.markdown("<br>", unsafe_allow_html=True)

    if user.is_admin:
        st.markdown(f'<div style="font-size:11px;color:{MUTED};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Admin</div>', unsafe_allow_html=True)
        if st.button("Admin Panel", use_container_width=True, key="admin_btn"):
            st.switch_page("admin/admin_dashboard.py")

        # Admin credentials info
        st.markdown(f"""
        <div class="admin-cred-card">
            <div style="font-size:11px;font-weight:700;color:#f0b90b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Default Admin Login</div>
            <div style="margin-bottom:3px;"><span style="color:{MUTED};">Email: </span><b>admin@finai.io</b></div>
            <div style="margin-bottom:3px;"><span style="color:{MUTED};">Pass: </span><b>admin123!</b></div>
            <div style="font-size:10px;color:{MUTED};margin-top:6px;">Change via API or DB after first login.</div>
        </div>
        """, unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)

    if st.button("Logout", use_container_width=True, key="logout_btn"):
        for k in list(st.session_state.keys()):
            del st.session_state[k]
        st.switch_page("src/frontend/login.py")


# ══════════════════════════════════════════════════════════════
#  OVERVIEW
# ══════════════════════════════════════════════════════════════
if nav == "Overview":
    st.markdown('<div class="section-hdr">Dashboard Overview</div>', unsafe_allow_html=True)

    usd = float(user.default_capital)
    btc_p, btc_ch = get_price("BTC-USD")
    eth_p, eth_ch = get_price("ETH-USD")
    spy_p, spy_ch = get_price("SPY")

    col_bal, col_b1, col_b2 = st.columns([2, 1, 1])
    with col_bal:
        btc_eq = usd / btc_p if btc_p else 0
        badge_color = "#0ecb81" if (btc_ch or 0) >= 0 else "#f6465d"
        st.markdown(f"""
        <div class="balance-card">
            <div style="font-size:11px;color:{MUTED};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Total Balance</div>
            <div style="font-size:36px;font-weight:800;color:{TXT};letter-spacing:-1px;">${usd:,.2f}</div>
            <div style="font-size:13px;color:{MUTED};margin-top:4px;">≈ {btc_eq:.6f} BTC</div>
            <div style="margin-top:14px;">
                <span style="background:{'rgba(14,203,129,0.12)' if (btc_ch or 0)>=0 else 'rgba(246,70,93,0.12)'};
                color:{badge_color};font-size:12px;font-weight:700;padding:4px 10px;border-radius:4px;">
                    BTC {'+' if (btc_ch or 0)>=0 else ''}{btc_ch:.2f}% 24h
                </span>
            </div>
        </div>
        """, unsafe_allow_html=True)

    with col_b1:
        manager = get_user_bot_manager(user.email, user.id)
        bots = manager.get_status() or {}
        for label, val, color in [
            ("Risk / Trade", f"{user.risk_per_trade}%", "#f0b90b"),
            ("Max Drawdown", f"{user.max_drawdown}%", "#f6465d"),
            ("Active Bots", str(len(bots)), "#0ecb81"),
        ]:
            st.markdown(f"""
            <div class="b-card" style="text-align:center;padding:16px;">
                <div style="font-size:11px;color:{MUTED};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">{label}</div>
                <div style="font-size:22px;font-weight:800;color:{color};">{val}</div>
            </div>
            """, unsafe_allow_html=True)

    with col_b2:
        for label, val, color in [
            ("Status", "Active" if user.is_active else "Inactive", "#0ecb81" if user.is_active else "#f6465d"),
            ("Admin", "Yes" if user.is_admin else "No", "#f0b90b" if user.is_admin else MUTED),
            ("Verified", "Yes" if getattr(user, "is_mail_verified", False) else "No", "#0ecb81" if getattr(user, "is_mail_verified", False) else "#f6465d"),
        ]:
            st.markdown(f"""
            <div class="b-card" style="text-align:center;padding:16px;">
                <div style="font-size:11px;color:{MUTED};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">{label}</div>
                <div style="font-size:16px;font-weight:700;color:{color};">{val}</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    col_left, col_right = st.columns([2, 1])

    with col_left:
        st.markdown('<div class="section-hdr">Market Chart</div>', unsafe_allow_html=True)
        chart_sym = st.selectbox("", ["BTC-USD", "ETH-USD", "AAPL", "TSLA", "NVDA", "SPY", "MSFT"],
                                 label_visibility="collapsed")
        try:
            df = yf.download(chart_sym, period="3mo", interval="1d", progress=False)
            if not df.empty:
                fig = go.Figure()
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
                    line=dict(color='#f0b90b', width=1.5, dash='dot'), name="MA20",
                ))
                fig.update_layout(
                    template=PLOT_TEMPLATE,
                    paper_bgcolor=CHART_BG,
                    plot_bgcolor=CHART_BG,
                    height=360,
                    margin=dict(l=0, r=0, t=20, b=0),
                    xaxis=dict(gridcolor=BDR, rangeslider=dict(visible=False)),
                    yaxis=dict(gridcolor=BDR),
                    legend=dict(bgcolor="rgba(0,0,0,0)"),
                    font=dict(color=MUTED),
                )
                st.plotly_chart(fig, use_container_width=True)
        except Exception as e:
            st.info(f"Chart unavailable: {e}")

    with col_right:
        st.markdown('<div class="section-hdr">Market Watch</div>', unsafe_allow_html=True)
        market_pairs = [
            ("BTC/USD", "₿ Bitcoin", btc_p, btc_ch),
            ("ETH/USD", "⟠ Ethereum", eth_p, eth_ch),
            ("SPY", "📊 S&P 500", spy_p, spy_ch),
        ]
        mkt_html = f'<div class="b-card" style="padding:0 18px;">'
        for sym, name, price, chg in market_pairs:
            color = "#0ecb81" if (chg or 0) >= 0 else "#f6465d"
            sign = "+" if (chg or 0) >= 0 else ""
            mkt_html += f"""
            <div class="market-row">
                <div>
                    <div style="font-size:13px;font-weight:700;color:{TXT};">{sym}</div>
                    <div style="font-size:12px;color:{MUTED};">{name}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:13px;font-weight:700;color:{TXT};">{"$"+f"{price:,.2f}" if price else "—"}</div>
                    <div style="font-size:12px;color:{color};font-weight:600;">{sign}{chg:.2f}%</div>
                </div>
            </div>"""
        mkt_html += '</div>'
        st.markdown(mkt_html, unsafe_allow_html=True)

        st.markdown(f'<div class="section-hdr" style="margin-top:14px;">Quick Actions</div>', unsafe_allow_html=True)
        qa1, qa2 = st.columns(2)
        with qa1:
            if st.button("Deposit", use_container_width=True, key="qa_dep"):
                st.rerun()
        with qa2:
            if st.button("Withdraw", use_container_width=True, key="qa_wd"):
                st.rerun()
        if st.button("Launch Bot", use_container_width=True, key="qa_bot"):
            st.rerun()

    # Recent events
    try:
        events = db.query(Event).order_by(Event.created_at.desc()).limit(4).all()
        if events:
            st.markdown(f'<div class="section-hdr" style="margin-top:6px;">Recent Market Events</div>', unsafe_allow_html=True)
            for ev in events:
                imp = ev.impact_score or 0
                imp_color = "#f6465d" if imp >= 7 else "#f0b90b" if imp >= 5 else "#0ecb81"
                sent_color = "#0ecb81" if ev.sentiment == "positive" else "#f6465d" if ev.sentiment == "negative" else MUTED
                st.markdown(f"""
                <div class="b-card" style="padding:12px 16px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;">
                        <div style="flex:1;">
                            <div style="font-size:13px;font-weight:700;color:{TXT};margin-bottom:3px;">{ev.title or 'Event'}</div>
                            <div style="font-size:12px;color:{MUTED};">{ev.event_type} · {ev.created_at.strftime('%b %d, %H:%M') if ev.created_at else ''}</div>
                        </div>
                        <div style="text-align:right;flex-shrink:0;">
                            <div style="font-size:12px;color:{imp_color};font-weight:700;">Impact {imp}/10</div>
                            <div style="font-size:12px;color:{sent_color};text-transform:capitalize;">{ev.sentiment or ''}</div>
                        </div>
                    </div>
                </div>""", unsafe_allow_html=True)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════
#  MARKETS
# ══════════════════════════════════════════════════════════════
elif nav == "Markets":
    st.markdown('<div class="section-hdr">Live Markets</div>', unsafe_allow_html=True)

    col_ref, _ = st.columns([1, 5])
    with col_ref:
        if st.button("Refresh Prices", use_container_width=True):
            st.cache_data.clear()
            st.rerun()

    watchlist = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD",
                 "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "SPY", "QQQ"]
    rows = []
    with st.spinner("Fetching live prices..."):
        for sym in watchlist:
            try:
                h = yf.Ticker(sym).history(period="2d")
                if len(h) >= 2:
                    p = float(h["Close"].iloc[-1])
                    prev = float(h["Close"].iloc[-2])
                    chg = (p - prev) / prev * 100
                    vol = float(h["Volume"].iloc[-1])
                    rows.append({
                        "Asset": sym,
                        "Price (USD)": f"${p:,.2f}",
                        "24h Change": f"{'+' if chg>=0 else ''}{chg:.2f}%",
                        "Volume": f"{vol:,.0f}",
                    })
            except Exception:
                rows.append({"Asset": sym, "Price (USD)": "—", "24h Change": "—", "Volume": "—"})
    if rows:
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)


# ══════════════════════════════════════════════════════════════
#  TRADING BOTS
# ══════════════════════════════════════════════════════════════
elif nav == "Trading Bots":
    st.markdown('<div class="section-hdr">Trading Bots</div>', unsafe_allow_html=True)
    manager = get_user_bot_manager(user.email, user.id)
    status = manager.get_status() or {}

    if status:
        for ticker, s in status.items():
            pnl = s.get("unrealized_pnl", 0)
            pnl_color = "#0ecb81" if pnl >= 0 else "#f6465d"
            running = s.get("running", False)
            st.markdown(f"""
            <div class="b-card">
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <div>
                        <div style="font-size:15px;font-weight:700;color:{TXT};">{ticker}</div>
                        <div style="font-size:12px;color:{'#0ecb81' if running else MUTED};">{'● Running' if running else '○ Stopped'}</div>
                    </div>
                    <div style="font-size:22px;font-weight:800;color:{pnl_color};">{'+' if pnl>=0 else ''}${pnl:.2f}</div>
                </div>
                <div style="display:flex;gap:20px;font-size:12px;color:{MUTED};">
                    <span>Portfolio: <b style="color:{TXT};">${s.get('portfolio_value',0):,.2f}</b></span>
                    <span>Position: <b style="color:{TXT};">{s.get('position',0):.4f}</b></span>
                    <span>Drawdown: <b style="color:#f6465d;">{s.get('current_drawdown_pct',0):.1f}%</b></span>
                </div>
            </div>""", unsafe_allow_html=True)
            if st.button(f"Stop {ticker}", key=f"stop_{ticker}"):
                manager.stop_bot(ticker)
                st.success(f"{ticker} bot stopped.")
                st.rerun()
    else:
        st.markdown(f"""
        <div class="b-card" style="text-align:center;padding:40px;">
            <div style="font-size:36px;margin-bottom:10px;">🤖</div>
            <div style="font-size:15px;font-weight:700;color:{TXT};margin-bottom:6px;">No Active Bots</div>
            <div style="font-size:13px;color:{MUTED};">Launch your first bot below</div>
        </div>""", unsafe_allow_html=True)

    st.markdown(f'<div class="section-hdr" style="margin-top:20px;">Launch New Bot</div>', unsafe_allow_html=True)
    with st.form("start_bot_form"):
        bc1, bc2, bc3 = st.columns([2, 1, 1])
        with bc1:
            ticker = st.text_input("Ticker Symbol", value="AAPL", placeholder="e.g. AAPL, BTC-USD")
        with bc2:
            paper = st.checkbox("Paper Trading", value=True)
        with bc3:
            capital = st.number_input("Capital ($)", value=float(user.default_capital), min_value=100.0)
        if st.form_submit_button("Start Bot", use_container_width=True) and ticker:
            result = manager.start_bot(ticker.strip().upper(), paper)
            st.success(f"Bot started: {result}")
            st.rerun()


# ══════════════════════════════════════════════════════════════
#  PORTFOLIO
# ══════════════════════════════════════════════════════════════
elif nav == "Portfolio":
    import plotly.graph_objects as go_pie
    st.markdown('<div class="section-hdr">Portfolio</div>', unsafe_allow_html=True)
    usd = float(user.default_capital)
    allocations = [
        ("USD Cash", usd * 0.4, "#f0b90b"),
        ("BTC",      usd * 0.3, "#f7931a"),
        ("ETH",      usd * 0.2, "#627eea"),
        ("Other",    usd * 0.1, "#848e9c"),
    ]
    fig = go.Figure(data=[go.Pie(
        labels=[a[0] for a in allocations],
        values=[a[1] for a in allocations],
        marker=dict(colors=[a[2] for a in allocations]),
        hole=0.58,
        textfont=dict(color="#eaecef"),
    )])
    fig.update_layout(
        paper_bgcolor=CHART_BG, plot_bgcolor=CHART_BG,
        font=dict(color=MUTED), height=300,
        margin=dict(l=0, r=0, t=0, b=0),
        legend=dict(font=dict(color=MUTED)),
        annotations=[dict(text=f"${usd:,.0f}", x=0.5, y=0.5,
                         font_size=18, font_color=TXT, showarrow=False)],
    )
    c_pie, c_list = st.columns([1, 1])
    with c_pie:
        st.plotly_chart(fig, use_container_width=True)
    with c_list:
        for name, val, color in allocations:
            st.markdown(f"""
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid {BDR};">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:10px;height:10px;border-radius:50%;background:{color};flex-shrink:0;"></div>
                    <span style="font-size:13px;color:{TXT};font-weight:600;">{name}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:13px;color:{TXT};font-weight:700;">${val:,.2f}</div>
                    <div style="font-size:11px;color:{MUTED};">{val/usd*100:.0f}%</div>
                </div>
            </div>""", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
#  DEPOSIT
# ══════════════════════════════════════════════════════════════
elif nav == "Deposit":
    import qrcode
    from io import BytesIO
    import base64

    st.markdown('<div class="section-hdr">Deposit Funds</div>', unsafe_allow_html=True)
    coin_data = {
        "BTC":  {"address": "1FMXu8fTqFHALrsxavrYAS5wD3urbPk6hh"},
        "ETH":  {"address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"},
        "USDT": {"address": "0x28c6c06298d514db089934071355e5743bf21d60"},
    }
    dc1, dc2 = st.columns([1, 1])
    with dc1:
        with st.form("deposit_form"):
            sel_coin   = st.selectbox("Cryptocurrency", list(coin_data.keys()))
            amount_usd = st.number_input("Amount in USD ($)", min_value=10.0, value=100.0, step=10.0)
            if st.form_submit_button("Submit Deposit Request", use_container_width=True):
                db.add(UserMoney(user_id=user.id, amount=amount_usd, status="pending"))
                db.commit()
                st.success(f"Deposit request of ${amount_usd} submitted. Awaiting admin approval.")
    with dc2:
        addr = coin_data.get(sel_coin if "sel_coin" in dir() else "BTC", coin_data["BTC"])["address"]
        qr = qrcode.make(addr)
        buf = BytesIO()
        qr.save(buf, format="PNG")
        st.image(f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}", width=160)
        st.code(addr, language=None)
        st.warning("Send only the correct asset. Wrong network = permanent loss.")


# ══════════════════════════════════════════════════════════════
#  WITHDRAWAL
# ══════════════════════════════════════════════════════════════
elif nav == "Withdrawal":
    st.markdown('<div class="section-hdr">Withdrawal</div>', unsafe_allow_html=True)
    st.markdown(f"""
    <div class="b-card">
        <div style="font-size:11px;color:{MUTED};text-transform:uppercase;font-weight:700;margin-bottom:6px;">Available Balance</div>
        <div style="font-size:30px;font-weight:800;color:#0ecb81;">${user.default_capital:,.2f}</div>
    </div>""", unsafe_allow_html=True)
    with st.form("withdrawal_form"):
        coin       = st.selectbox("Cryptocurrency", ["BTC", "ETH", "USDT"])
        amount_usd = st.number_input("Amount (USD)", min_value=10.0, max_value=float(user.default_capital), value=100.0, step=10.0)
        address    = st.text_input("Destination Wallet Address", placeholder="Enter wallet address")
        if st.form_submit_button("Submit Withdrawal", use_container_width=True):
            if not address.strip():
                st.error("Please enter a destination wallet address.")
            else:
                db.add(UserMoney(user_id=user.id, amount=-amount_usd, status="pending"))
                db.commit()
                st.success(f"Withdrawal of ${amount_usd} requested. Processing within 24h.")


# ══════════════════════════════════════════════════════════════
#  HISTORY
# ══════════════════════════════════════════════════════════════
elif nav == "History":
    st.markdown('<div class="section-hdr">Transaction History</div>', unsafe_allow_html=True)
    try:
        txs = db.query(UserMoney).filter(UserMoney.user_id == user.id).order_by(UserMoney.created_at.desc()).all()
        if txs:
            rows = []
            for t in txs:
                amt = float(t.amount or 0)
                rows.append({
                    "Date":   t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "—",
                    "Type":   "Deposit" if amt > 0 else "Withdrawal",
                    "Amount": f"${abs(amt):,.2f}",
                    "Status": (t.status or "—").capitalize(),
                })
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        else:
            st.info("No transactions yet.")
    except Exception as e:
        st.info(f"Could not load transactions: {e}")


# ══════════════════════════════════════════════════════════════
#  ANALYSIS
# ══════════════════════════════════════════════════════════════
elif nav == "Analysis":
    import requests as req
    st.markdown('<div class="section-hdr">Market Analysis</div>', unsafe_allow_html=True)
    ac1, ac2 = st.columns([1, 2])
    with ac1:
        with st.form("analysis_form"):
            ticker = st.text_input("Ticker", value="AAPL")
            period = st.selectbox("Period", ["30d", "60d", "90d", "6mo"])
            if st.form_submit_button("Analyze", use_container_width=True):
                with st.spinner(f"Analyzing {ticker}..."):
                    try:
                        r = req.get(f"{API_BASE}/analyze-trendline",
                                    params={"ticker": ticker, "period": period}, timeout=30)
                        with ac2:
                            if r.status_code == 200:
                                st.json(r.json())
                            else:
                                st.error(f"Analysis failed: {r.text}")
                    except Exception as e:
                        with ac2:
                            st.error(f"Error: {e}")


# ══════════════════════════════════════════════════════════════
#  PROFILE
# ══════════════════════════════════════════════════════════════
elif nav == "Profile":
    st.markdown('<div class="section-hdr">Profile Settings</div>', unsafe_allow_html=True)
    pc1, pc2 = st.columns([1, 1])
    with pc1:
        st.markdown(f"""
        <div class="b-card">
            <div style="width:56px;height:56px;background:linear-gradient(135deg,#f0b90b,#f8d254);
            border-radius:50%;display:flex;align-items:center;justify-content:center;
            font-size:22px;font-weight:800;color:#0b0e11;margin-bottom:14px;">{first_letter}</div>
            <div style="font-size:17px;font-weight:700;color:{TXT};">{user.full_name or 'No name set'}</div>
            <div style="font-size:13px;color:{MUTED};margin-top:2px;">{user.email}</div>
            <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
                <span style="background:{'rgba(14,203,129,0.1)' if user.is_active else 'rgba(246,70,93,0.1)'};
                color:{'#0ecb81' if user.is_active else '#f6465d'};font-size:12px;font-weight:700;
                padding:3px 10px;border-radius:4px;">{'Active' if user.is_active else 'Inactive'}</span>
                {'<span style="background:rgba(240,185,11,0.1);color:#f0b90b;font-size:12px;font-weight:700;padding:3px 10px;border-radius:4px;">Admin</span>' if user.is_admin else ''}
            </div>
        </div>""", unsafe_allow_html=True)
    with pc2:
        with st.form("profile_form"):
            new_name = st.text_input("Full Name", value=user.full_name or "")
            risk     = st.slider("Risk per Trade (%)", 0.1, 5.0, float(user.risk_per_trade), 0.1)
            drawdown = st.slider("Max Drawdown (%)", 5.0, 30.0, float(user.max_drawdown), 1.0)
            if st.form_submit_button("Save Settings", use_container_width=True):
                user.full_name    = new_name
                user.risk_per_trade = risk
                user.max_drawdown   = drawdown
                db.commit()
                st.success("Settings saved.")
                st.rerun()


# ══════════════════════════════════════════════════════════════
#  API KEYS
# ══════════════════════════════════════════════════════════════
elif nav == "API Keys":
    import requests as req
    st.markdown('<div class="section-hdr">API Keys</div>', unsafe_allow_html=True)
    headers = {"Authorization": f"Bearer {st.session_state.jwt_token}"}

    with st.form("create_key_form"):
        kc1, kc2 = st.columns([2, 1])
        with kc1:
            key_name = st.text_input("Key Name", placeholder="e.g. my-trading-script")
        with kc2:
            expires = st.number_input("Expires (days)", value=365, min_value=1)
        if st.form_submit_button("Create API Key", use_container_width=True) and key_name:
            try:
                r = req.post(f"{API_BASE}/api-keys",
                             params={"key_name": key_name, "expires_days": int(expires)},
                             headers=headers, timeout=10)
                if r.status_code == 200:
                    st.success("Key created — save it now, it won't be shown again.")
                    st.code(r.json().get("api_key", ""), language=None)
                else:
                    st.error(f"Failed: {r.text}")
            except Exception as e:
                st.error(f"Error: {e}")

    try:
        r = req.get(f"{API_BASE}/api-keys", headers=headers, timeout=10)
        if r.status_code == 200 and r.json():
            st.dataframe(pd.DataFrame(r.json()), use_container_width=True, hide_index=True)
    except Exception:
        pass

db.close()
