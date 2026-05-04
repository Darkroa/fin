import streamlit as st
import requests
import jwt
from datetime import datetime
import os

st.set_page_config(
    page_title="FinAi — AI Trading Platform",
    layout="wide",
    page_icon="📈",
    initial_sidebar_state="collapsed",
)

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000/api")

if "jwt_token" not in st.session_state:
    st.session_state.jwt_token = None
if "user_email" not in st.session_state:
    st.session_state.user_email = None
if "show_auth" not in st.session_state:
    st.session_state.show_auth = False
if "auth_tab" not in st.session_state:
    st.session_state.auth_tab = "login"

DARK_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, [data-testid="stAppViewContainer"], [data-testid="stApp"] {
    background-color: #0b0e11 !important;
    color: #eaecef !important;
    font-family: 'Inter', sans-serif !important;
}

[data-testid="stSidebar"] { display: none !important; }
[data-testid="stToolbar"] { display: none !important; }
.stDeployButton { display: none !important; }
footer { display: none !important; }
#MainMenu { display: none !important; }

[data-testid="stAppViewContainer"] > div:first-child { padding: 0 !important; }
[data-testid="block-container"] { padding: 0 !important; max-width: 100% !important; }

/* NAV BAR */
.finai-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 48px;
    background: rgba(11,14,17,0.95);
    border-bottom: 1px solid #1e2329;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
}
.finai-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 22px;
    font-weight: 800;
    color: #f0b90b;
    letter-spacing: -0.5px;
}
.finai-logo-icon {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, #f0b90b, #f8d254);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
}
.nav-links {
    display: flex;
    gap: 32px;
    align-items: center;
}
.nav-link {
    color: #848e9c;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.2s;
    cursor: pointer;
}
.nav-link:hover { color: #eaecef; }
.nav-cta {
    background: #f0b90b;
    color: #0b0e11;
    font-weight: 700;
    font-size: 14px;
    padding: 10px 24px;
    border-radius: 6px;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.2s;
    border: none;
    display: inline-block;
}
.nav-cta:hover { background: #f8d254; }

/* HERO */
.hero-section {
    padding: 90px 48px 80px;
    text-align: center;
    background: radial-gradient(ellipse at 50% 0%, rgba(240,185,11,0.08) 0%, transparent 70%);
}
.hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(240,185,11,0.1);
    border: 1px solid rgba(240,185,11,0.3);
    color: #f0b90b;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 20px;
    margin-bottom: 28px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}
.hero-title {
    font-size: 62px;
    font-weight: 800;
    line-height: 1.1;
    color: #eaecef;
    margin-bottom: 20px;
    letter-spacing: -1.5px;
}
.hero-title span { color: #f0b90b; }
.hero-sub {
    font-size: 18px;
    color: #848e9c;
    max-width: 560px;
    margin: 0 auto 40px;
    line-height: 1.6;
}
.hero-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 60px;
}
.btn-primary {
    background: #f0b90b;
    color: #0b0e11;
    font-weight: 700;
    font-size: 16px;
    padding: 14px 36px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
}
.btn-primary:hover { background: #f8d254; transform: translateY(-1px); }
.btn-secondary {
    background: transparent;
    color: #eaecef;
    font-weight: 600;
    font-size: 16px;
    padding: 14px 36px;
    border-radius: 8px;
    border: 1px solid #2b3139;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
}
.btn-secondary:hover { border-color: #f0b90b; color: #f0b90b; }

/* STATS BAR */
.stats-bar {
    display: flex;
    justify-content: center;
    gap: 64px;
    padding: 32px 48px;
    background: #161a1e;
    border-top: 1px solid #1e2329;
    border-bottom: 1px solid #1e2329;
    flex-wrap: wrap;
}
.stat-item { text-align: center; }
.stat-num {
    font-size: 28px;
    font-weight: 800;
    color: #f0b90b;
    display: block;
}
.stat-label {
    font-size: 13px;
    color: #848e9c;
    margin-top: 4px;
}

/* FEATURES */
.features-section {
    padding: 80px 48px;
    background: #0b0e11;
}
.section-title {
    text-align: center;
    font-size: 36px;
    font-weight: 800;
    color: #eaecef;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
}
.section-sub {
    text-align: center;
    color: #848e9c;
    font-size: 16px;
    margin-bottom: 56px;
}
.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    max-width: 1100px;
    margin: 0 auto;
}
.feature-card {
    background: #161a1e;
    border: 1px solid #1e2329;
    border-radius: 12px;
    padding: 28px;
    transition: border-color 0.2s, transform 0.2s;
}
.feature-card:hover { border-color: #f0b90b; transform: translateY(-2px); }
.feature-icon {
    font-size: 32px;
    margin-bottom: 16px;
    display: block;
}
.feature-title {
    font-size: 17px;
    font-weight: 700;
    color: #eaecef;
    margin-bottom: 10px;
}
.feature-desc {
    font-size: 14px;
    color: #848e9c;
    line-height: 1.6;
}

/* TICKER TAPE */
.ticker-tape {
    background: #161a1e;
    border-top: 1px solid #1e2329;
    border-bottom: 1px solid #1e2329;
    padding: 12px 0;
    overflow: hidden;
}
.ticker-content {
    display: flex;
    gap: 48px;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
}
.ticker-item { color: #848e9c; }
.ticker-up { color: #0ecb81; }
.ticker-down { color: #f6465d; }

/* AUTH CARD */
.auth-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.75);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
}
.auth-card {
    background: #161a1e;
    border: 1px solid #2b3139;
    border-radius: 16px;
    padding: 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}
.auth-logo {
    text-align: center;
    margin-bottom: 24px;
}
.auth-logo-icon {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, #f0b90b, #f8d254);
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    margin-bottom: 12px;
}
.auth-title {
    font-size: 24px;
    font-weight: 800;
    color: #eaecef;
    margin-bottom: 6px;
}
.auth-sub {
    font-size: 14px;
    color: #848e9c;
    margin-bottom: 28px;
}
.auth-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #eaecef;
    margin-bottom: 8px;
}
.auth-divider {
    text-align: center;
    color: #848e9c;
    font-size: 13px;
    margin: 20px 0;
    position: relative;
}
.auth-divider::before {
    content: '';
    position: absolute;
    top: 50%; left: 0; right: 0;
    height: 1px;
    background: #2b3139;
}
.auth-divider span {
    background: #161a1e;
    padding: 0 12px;
    position: relative;
}
.auth-switch {
    text-align: center;
    font-size: 14px;
    color: #848e9c;
    margin-top: 20px;
}
.auth-switch a { color: #f0b90b; text-decoration: none; cursor: pointer; font-weight: 600; }

/* Streamlit form overrides */
[data-testid="stTextInput"] input {
    background: #0b0e11 !important;
    border: 1px solid #2b3139 !important;
    color: #eaecef !important;
    border-radius: 8px !important;
    padding: 12px 16px !important;
    font-size: 15px !important;
}
[data-testid="stTextInput"] input:focus {
    border-color: #f0b90b !important;
    box-shadow: 0 0 0 2px rgba(240,185,11,0.2) !important;
}
[data-testid="stTextInput"] label {
    color: #eaecef !important;
    font-weight: 600 !important;
    font-size: 13px !important;
}
[data-testid="stFormSubmitButton"] button {
    background: #c0392b !important;
    color: #fff !important;
    font-weight: 700 !important;
    font-size: 16px !important;
    border-radius: 8px !important;
    border: none !important;
    padding: 14px !important;
    width: 100% !important;
    transition: background 0.2s !important;
}
[data-testid="stFormSubmitButton"] button:hover {
    background: #e74c3c !important;
}
.stButton button {
    background: transparent !important;
    color: #f0b90b !important;
    font-weight: 600 !important;
    border: 1px solid #f0b90b !important;
    border-radius: 8px !important;
    transition: all 0.2s !important;
}
.stButton button:hover {
    background: #f0b90b !important;
    color: #0b0e11 !important;
}

/* CTA section */
.cta-section {
    padding: 80px 48px;
    text-align: center;
    background: linear-gradient(135deg, #161a1e, #0b0e11);
    border-top: 1px solid #1e2329;
}
.cta-title {
    font-size: 40px;
    font-weight: 800;
    color: #eaecef;
    margin-bottom: 16px;
}
.cta-sub {
    font-size: 16px;
    color: #848e9c;
    margin-bottom: 36px;
}

/* Footer */
.finai-footer {
    background: #0b0e11;
    border-top: 1px solid #1e2329;
    padding: 24px 48px;
    text-align: center;
    color: #848e9c;
    font-size: 13px;
}
</style>
"""

st.markdown(DARK_CSS, unsafe_allow_html=True)


def login_user(email: str, password: str):
    try:
        resp = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "password": password},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            token = data["access_token"]
            decoded = jwt.decode(token, options={"verify_signature": False})
            st.session_state.jwt_token = token
            st.session_state.user_email = decoded.get("sub")
            st.session_state.show_auth = False
            st.rerun()
        else:
            detail = resp.json().get("detail", "Invalid email or password")
            st.error(f"{detail}")
    except requests.exceptions.ConnectionError:
        st.error("Cannot connect to backend. Please try again.")
    except Exception as e:
        st.error(f"Login failed: {str(e)}")


def signup_user(email: str, password: str, full_name: str):
    try:
        resp = requests.post(
            f"{API_BASE}/auth/signup",
            json={"email": email, "password": password, "full_name": full_name},
            timeout=10,
        )
        if resp.status_code == 200:
            st.success("Account created! Please sign in.")
            st.session_state.auth_tab = "login"
            st.rerun()
        else:
            detail = resp.json().get("detail", "Signup failed")
            st.error(f"{detail}")
    except Exception as e:
        st.error(f"Signup error: {str(e)}")


if st.session_state.jwt_token:
    st.switch_page("src/frontend/user_dashboard.py")

st.markdown("""
<div class="finai-nav">
    <div class="finai-logo">
        <div class="finai-logo-icon">📈</div>
        FinAi
    </div>
    <div class="nav-links">
        <span class="nav-link">Features</span>
        <span class="nav-link">Markets</span>
        <span class="nav-link">Pricing</span>
        <span class="nav-link">Docs</span>
    </div>
</div>
""", unsafe_allow_html=True)

st.markdown("""
<div class="ticker-tape">
    <div class="ticker-content">
        <span class="ticker-item">BTC/USD</span><span class="ticker-up">$67,432.10 ▲ +2.4%</span>
        <span class="ticker-item"> · </span>
        <span class="ticker-item">ETH/USD</span><span class="ticker-up">$3,521.80 ▲ +1.8%</span>
        <span class="ticker-item"> · </span>
        <span class="ticker-item">AAPL</span><span class="ticker-up">$192.35 ▲ +0.9%</span>
        <span class="ticker-item"> · </span>
        <span class="ticker-item">TSLA</span><span class="ticker-down">$248.70 ▼ -1.2%</span>
        <span class="ticker-item"> · </span>
        <span class="ticker-item">SPX</span><span class="ticker-up">5,304.12 ▲ +0.5%</span>
        <span class="ticker-item"> · </span>
        <span class="ticker-item">NVDA</span><span class="ticker-up">$875.40 ▲ +3.1%</span>
        <span class="ticker-item"> · </span>
        <span class="ticker-item">MSFT</span><span class="ticker-up">$415.20 ▲ +0.7%</span>
        <span class="ticker-item"> · </span>
        <span class="ticker-item">BNB/USD</span><span class="ticker-down">$412.60 ▼ -0.3%</span>
    </div>
</div>
""", unsafe_allow_html=True)

st.markdown("""
<div class="hero-section">
    <div class="hero-badge">🤖 Powered by Grok AI</div>
    <div class="hero-title">
        Trade Smarter with<br><span>AI-Powered</span> Insights
    </div>
    <div class="hero-sub">
        FinAi reads real-time financial news, detects market events, and executes automated trading strategies — all powered by Grok's advanced language intelligence.
    </div>
</div>
""", unsafe_allow_html=True)

col_l, col_c1, col_c2, col_r = st.columns([2, 1, 1, 2])
with col_c1:
    if st.button("Get Started", use_container_width=True, key="hero_start"):
        st.session_state.show_auth = True
        st.session_state.auth_tab = "signup"
        st.rerun()
with col_c2:
    if st.button("Sign In", use_container_width=True, key="hero_login"):
        st.session_state.show_auth = True
        st.session_state.auth_tab = "login"
        st.rerun()

st.markdown("""
<div class="stats-bar">
    <div class="stat-item">
        <span class="stat-num">$2.4B+</span>
        <span class="stat-label">Volume Analyzed</span>
    </div>
    <div class="stat-item">
        <span class="stat-num">50K+</span>
        <span class="stat-label">News Articles Daily</span>
    </div>
    <div class="stat-item">
        <span class="stat-num">99.9%</span>
        <span class="stat-label">Uptime</span>
    </div>
    <div class="stat-item">
        <span class="stat-num">12ms</span>
        <span class="stat-label">Avg Signal Latency</span>
    </div>
</div>
""", unsafe_allow_html=True)

st.markdown("""
<div class="features-section">
    <div class="section-title">Everything you need to trade intelligently</div>
    <div class="section-sub">From AI news analysis to automated order execution</div>
    <div class="features-grid">
        <div class="feature-card">
            <span class="feature-icon">🧠</span>
            <div class="feature-title">Grok AI Analysis</div>
            <div class="feature-desc">Real-time sentiment analysis and market impact scoring powered by the latest Grok LLM for precise trading signals.</div>
        </div>
        <div class="feature-card">
            <span class="feature-icon">📰</span>
            <div class="feature-title">News Ingestion Engine</div>
            <div class="feature-desc">Aggregates from Bloomberg, CNBC, Reuters, and 50+ sources. Events detected and ranked by market impact within seconds.</div>
        </div>
        <div class="feature-card">
            <span class="feature-icon">🤖</span>
            <div class="feature-title">Automated Trading Bots</div>
            <div class="feature-desc">Per-user bots with configurable risk parameters. Supports Alpaca paper & live trading with max drawdown protection.</div>
        </div>
        <div class="feature-card">
            <span class="feature-icon">📊</span>
            <div class="feature-title">Trendline Forecasting</div>
            <div class="feature-desc">ATR-based trendline analysis with breakout detection and AI-powered price forecasting across any timeframe.</div>
        </div>
        <div class="feature-card">
            <span class="feature-icon">🔔</span>
            <div class="feature-title">Multi-Channel Alerts</div>
            <div class="feature-desc">Get trade alerts via Telegram, WhatsApp, Slack, or email the instant a high-impact event is detected.</div>
        </div>
        <div class="feature-card">
            <span class="feature-icon">🔒</span>
            <div class="feature-title">Secure API Access</div>
            <div class="feature-desc">Scoped API keys for external integrations. Rate-limited and audited. Control your bots from any application.</div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

st.markdown("""
<div class="cta-section">
    <div class="cta-title">Ready to trade with AI?</div>
    <div class="cta-sub">Join thousands of traders using FinAi to stay ahead of the market.</div>
</div>
""", unsafe_allow_html=True)

col_l2, col_c3, col_r2 = st.columns([3, 1, 3])
with col_c3:
    if st.button("Create Free Account", use_container_width=True, key="cta_signup"):
        st.session_state.show_auth = True
        st.session_state.auth_tab = "signup"
        st.rerun()

st.markdown("""
<div class="finai-footer">
    © 2026 FinAi — AI-Powered Financial Intelligence Platform. All rights reserved.
</div>
""", unsafe_allow_html=True)

if st.session_state.show_auth:
    with st.container():
        st.markdown("---")
        col_lf, col_form, col_rf = st.columns([1, 1.2, 1])
        with col_form:
            st.markdown("""
            <div style="text-align:center;margin-bottom:24px;">
                <div style="width:52px;height:52px;background:linear-gradient(135deg,#f0b90b,#f8d254);
                border-radius:12px;display:inline-flex;align-items:center;justify-content:center;
                font-size:26px;margin-bottom:12px;">📈</div>
                <div style="font-size:11px;color:#848e9c;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">FinAi Platform</div>
            </div>
            """, unsafe_allow_html=True)

            tab_col1, tab_col2 = st.columns(2)
            with tab_col1:
                if st.button("Sign In", use_container_width=True, key="tab_login"):
                    st.session_state.auth_tab = "login"
                    st.rerun()
            with tab_col2:
                if st.button("Create Account", use_container_width=True, key="tab_signup"):
                    st.session_state.auth_tab = "signup"
                    st.rerun()

            st.markdown("<br>", unsafe_allow_html=True)

            if st.session_state.auth_tab == "login":
                st.markdown("""
                <div style="margin-bottom:6px;">
                    <span style="font-size:22px;font-weight:800;color:#eaecef;">Welcome back</span><br>
                    <span style="font-size:14px;color:#848e9c;">Enter your credentials to access your account</span>
                </div>
                """, unsafe_allow_html=True)
                with st.form("login_form", clear_on_submit=False):
                    email = st.text_input("Email", placeholder="name@example.com")
                    password = st.text_input("Password", type="password", placeholder="••••••••")
                    submitted = st.form_submit_button("Login", use_container_width=True)
                    if submitted:
                        if email and password:
                            login_user(email, password)
                        else:
                            st.warning("Please fill in all fields.")

                st.markdown("""
                <div style="text-align:center;font-size:13px;color:#848e9c;margin-top:16px;">
                    Don't have an account? <span style="color:#f0b90b;cursor:pointer;font-weight:600;">Sign up</span>
                </div>
                """, unsafe_allow_html=True)

            else:
                st.markdown("""
                <div style="margin-bottom:6px;">
                    <span style="font-size:22px;font-weight:800;color:#eaecef;">Create account</span><br>
                    <span style="font-size:14px;color:#848e9c;">Start trading with AI today — it's free</span>
                </div>
                """, unsafe_allow_html=True)
                with st.form("signup_form", clear_on_submit=False):
                    full_name = st.text_input("Full Name", placeholder="John Doe")
                    email = st.text_input("Email", placeholder="name@example.com")
                    password = st.text_input("Password", type="password", placeholder="Min. 8 characters")
                    password2 = st.text_input("Confirm Password", type="password", placeholder="••••••••")
                    submitted = st.form_submit_button("Create Account", use_container_width=True)
                    if submitted:
                        if not all([full_name, email, password, password2]):
                            st.warning("Please fill in all fields.")
                        elif password != password2:
                            st.error("Passwords do not match.")
                        elif len(password) < 8:
                            st.error("Password must be at least 8 characters.")
                        else:
                            signup_user(email, password, full_name)

            if st.button("← Back to Home", key="back_home"):
                st.session_state.show_auth = False
                st.rerun()
