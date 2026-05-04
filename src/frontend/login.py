import streamlit as st
import requests
import jwt
import os

st.set_page_config(
    page_title="FinAi — AI Trading Platform",
    layout="wide",
    page_icon="📈",
    initial_sidebar_state="collapsed",
)

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000/api")

for k, v in [("jwt_token", None), ("user_email", None),
             ("show_auth", False), ("auth_tab", "login")]:
    if k not in st.session_state:
        st.session_state[k] = v

if st.session_state.jwt_token:
    st.switch_page("src/frontend/user_dashboard.py")

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; }
html, body,
[data-testid="stApp"],
[data-testid="stAppViewContainer"],
[data-testid="stMain"],
.main, section.main {
    background-color: #0a0a0f !important;
    color: #eaecef !important;
    font-family: 'Inter', sans-serif !important;
}
[data-testid="stToolbar"], [data-testid="stDecoration"],
[data-testid="stStatusWidget"], .stDeployButton,
footer, #MainMenu { display: none !important; }
[data-testid="stSidebar"] { display: none !important; }
[data-testid="block-container"], .stMainBlockContainer {
    padding: 0 !important; max-width: 100% !important;
}

/* ── NAV BUTTONS via unique IDs ── */
#nav-signin-wrap button {
    background: transparent !important;
    color: #c8cdd4 !important;
    border: 1px solid #2b3139 !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    padding: 8px 20px !important;
    transition: all 0.2s !important;
}
#nav-signin-wrap button:hover {
    border-color: #f0b90b !important;
    color: #f0b90b !important;
}
#nav-getstarted-wrap button {
    background: #f0b90b !important;
    color: #0b0e11 !important;
    border: none !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    padding: 8px 20px !important;
    transition: all 0.2s !important;
}
#nav-getstarted-wrap button:hover { background: #f8d254 !important; }

/* hero buttons */
#hero-gs-wrap button {
    background: #f0b90b !important;
    color: #0b0e11 !important;
    border: none !important;
    border-radius: 8px !important;
    font-size: 15px !important;
    font-weight: 700 !important;
    padding: 13px 32px !important;
    width: 100% !important;
}
#hero-gs-wrap button:hover { background: #f8d254 !important; }
#hero-si-wrap button {
    background: #161a1e !important;
    color: #eaecef !important;
    border: 1px solid #2b3139 !important;
    border-radius: 8px !important;
    font-size: 15px !important;
    font-weight: 600 !important;
    padding: 13px 32px !important;
    width: 100% !important;
}
#hero-si-wrap button:hover { border-color: #f0b90b !important; color: #f0b90b !important; }

/* CTA button */
#cta-btn-wrap button {
    background: #f0b90b !important;
    color: #0b0e11 !important;
    border: none !important;
    border-radius: 8px !important;
    font-size: 15px !important;
    font-weight: 700 !important;
    padding: 14px 40px !important;
    width: 100% !important;
}
#cta-btn-wrap button:hover { background: #f8d254 !important; }

/* back / tab buttons */
#back-btn-wrap button {
    background: transparent !important;
    color: #848e9c !important;
    border: 1px solid #2b3139 !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    width: 100% !important;
}
#back-btn-wrap button:hover { color: #eaecef !important; border-color: #4a5568 !important; }

/* Auth tab buttons */
#tab-si-wrap button {
    border-radius: 6px 0 0 6px !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    width: 100% !important;
    border: 1px solid #2b3139 !important;
}
#tab-su-wrap button {
    border-radius: 0 6px 6px 0 !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    width: 100% !important;
    border: 1px solid #2b3139 !important;
}
#tab-si-wrap.tab-active button {
    background: #f0b90b !important; color: #0b0e11 !important; border-color: #f0b90b !important;
}
#tab-si-wrap.tab-inactive button {
    background: #0a0a0f !important; color: #848e9c !important;
}
#tab-su-wrap.tab-active button {
    background: #f0b90b !important; color: #0b0e11 !important; border-color: #f0b90b !important;
}
#tab-su-wrap.tab-inactive button {
    background: #0a0a0f !important; color: #848e9c !important;
}

/* ── Form fields ── */
[data-testid="stTextInput"] input {
    background: #111318 !important;
    border: 1px solid #2b3139 !important;
    color: #eaecef !important;
    border-radius: 8px !important;
    padding: 12px 14px !important;
    font-size: 14px !important;
    font-family: 'Inter', sans-serif !important;
}
[data-testid="stTextInput"] input:focus {
    border-color: #8b1a1a !important;
    box-shadow: 0 0 0 2px rgba(139,26,26,0.2) !important;
    outline: none !important;
}
[data-testid="stTextInput"] input::placeholder { color: #4a5568 !important; }
[data-testid="stTextInput"] label { color: #c8cdd4 !important; font-size: 13px !important; font-weight: 600 !important; }

/* ── RED submit button ── */
[data-testid="stFormSubmitButton"] button {
    background: linear-gradient(135deg, #8b1a1a, #a82020) !important;
    color: #fff !important;
    font-weight: 700 !important;
    font-size: 15px !important;
    border-radius: 8px !important;
    border: none !important;
    padding: 13px !important;
    width: 100% !important;
    letter-spacing: 0.5px !important;
    transition: all .2s !important;
    box-shadow: 0 4px 15px rgba(139,26,26,0.4) !important;
}
[data-testid="stFormSubmitButton"] button:hover {
    background: linear-gradient(135deg, #a82020, #c0392b) !important;
    box-shadow: 0 6px 20px rgba(139,26,26,0.5) !important;
}

/* Checkbox */
[data-testid="stCheckbox"] label { color: #848e9c !important; font-size: 13px !important; }
[data-testid="stCheckbox"] input[type=checkbox] { accent-color: #8b1a1a !important; }

/* NAV bar */
.nav-bar-wrap {
    background: #0a0a0f;
    border-bottom: 1px solid #1a1d24;
    padding: 0 40px;
}
/* TICKER */
.ticker-wrap { background: #111318; border-bottom: 1px solid #1a1d24; padding: 10px 24px; overflow: hidden; white-space: nowrap; }
.ticker-inner { display: inline-flex; gap: 40px; font-size: 13px; }
.t-sym { color: #848e9c; font-weight: 500; margin-right: 4px; }
.t-up  { color: #0ecb81; font-weight: 600; }
.t-dn  { color: #f6465d; font-weight: 600; }
.t-sep { color: #2b3139; margin: 0 4px; }

/* HERO */
.hero-wrap { padding: 80px 24px 56px; text-align: center; background: radial-gradient(ellipse at 50% -10%, rgba(240,185,11,0.08) 0%, transparent 65%); }
.hero-badge { display: inline-block; background: rgba(240,185,11,0.1); border: 1px solid rgba(240,185,11,0.3); color: #f0b90b; font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 20px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 24px; }
.hero-h1 { font-size: 58px; font-weight: 900; line-height: 1.08; color: #eaecef; margin: 0 auto 18px; max-width: 720px; letter-spacing: -2px; }
.hero-h1 em { font-style: normal; color: #f0b90b; }
.hero-sub { font-size: 17px; color: #848e9c; max-width: 520px; margin: 0 auto 36px; line-height: 1.65; }

/* STATS */
.stats-wrap { background: #111318; border-top: 1px solid #1a1d24; border-bottom: 1px solid #1a1d24; display: flex; justify-content: center; gap: 72px; padding: 28px 24px; flex-wrap: wrap; }
.stat-num { font-size: 28px; font-weight: 800; color: #f0b90b; display: block; }
.stat-lbl { font-size: 12px; color: #848e9c; margin-top: 3px; text-align: center; }

/* FEATURES */
.feat-wrap { padding: 72px 40px; background: #0a0a0f; }
.feat-head { text-align: center; font-size: 34px; font-weight: 800; color: #eaecef; margin-bottom: 10px; letter-spacing: -0.5px; }
.feat-sub  { text-align: center; font-size: 15px; color: #848e9c; margin-bottom: 48px; }
.feat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 18px; max-width: 1060px; margin: 0 auto; }
.feat-card { background: #111318; border: 1px solid #1a1d24; border-radius: 12px; padding: 26px; transition: border-color .2s, transform .2s; }
.feat-card:hover { border-color: rgba(240,185,11,.4); transform: translateY(-2px); }
.feat-icon { font-size: 30px; margin-bottom: 14px; display: block; }
.feat-title { font-size: 16px; font-weight: 700; color: #eaecef; margin-bottom: 8px; }
.feat-desc  { font-size: 13px; color: #848e9c; line-height: 1.6; }

/* CTA */
.cta-wrap { background: linear-gradient(160deg, #111318, #0a0a0f); border-top: 1px solid #1a1d24; padding: 72px 24px; text-align: center; }
.cta-h { font-size: 38px; font-weight: 800; color: #eaecef; margin-bottom: 12px; letter-spacing: -0.5px; }
.cta-sub { font-size: 15px; color: #848e9c; margin-bottom: 32px; }
.footer-wrap { background: #0a0a0f; border-top: 1px solid #1a1d24; padding: 20px 24px; text-align: center; color: #3a4050; font-size: 13px; }

hr { border-color: #1a1d24 !important; }

/* ── AUTH PAGE ── */
.auth-page-bg {
    min-height: 100vh;
    background: #080a0d;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 16px 60px;
}
.auth-logo-icon {
    width: 64px; height: 64px;
    background: linear-gradient(135deg, #5a0a0a, #8b1a1a);
    border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 30px;
    margin: 0 auto 16px;
    box-shadow: 0 8px 24px rgba(139,26,26,0.4);
}
.auth-app-title { font-size: 28px; font-weight: 900; color: #fff; text-align: center; letter-spacing: -0.5px; }
.auth-app-sub   { font-size: 14px; color: #4a5568; text-align: center; margin-top: 4px; margin-bottom: 28px; }
.auth-card {
    background: #111318;
    border: 1px solid #1e2329;
    border-radius: 16px;
    padding: 28px 28px 24px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.6);
}
.auth-welcome { font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 4px; }
.auth-sub-text { font-size: 13px; color: #4a5568; margin-bottom: 20px; }
.or-divider {
    display: flex; align-items: center; gap: 12px;
    color: #2b3139; font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 1px;
    margin: 16px 0;
}
.or-divider::before, .or-divider::after {
    content: ''; flex: 1; height: 1px; background: #1e2329;
}
.social-btns {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin-bottom: 4px;
}
.social-btn {
    background: #0a0a0f; border: 1px solid #1e2329; color: #c8cdd4;
    border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    cursor: default; transition: border-color .2s;
}
.social-btn:hover { border-color: #2b3139; }
.auth-footer-links { text-align: center; font-size: 13px; color: #4a5568; margin-top: 18px; }
.auth-footer-links a { color: #e05252; text-decoration: none; font-weight: 600; }
.auth-footer-links a:hover { text-decoration: underline; }
.auth-help { text-align: center; font-size: 12px; color: #2b3139; margin-top: 8px; }
.auth-help a { color: #2b3139; }
.page-footer { color: #1e2329; font-size: 12px; text-align: center; margin-top: 40px; }

/* forgot password row */
.forgot-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.forgot-link { font-size: 13px; color: #e05252; text-decoration: none; font-weight: 600; }
</style>
"""
st.markdown(CSS, unsafe_allow_html=True)


def login_user(email: str, password: str):
    try:
        resp = requests.post(f"{API_BASE}/auth/login",
                             json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            token = resp.json()["access_token"]
            decoded = jwt.decode(token, options={"verify_signature": False})
            st.session_state.jwt_token = token
            st.session_state.user_email = decoded.get("sub")
            st.session_state.show_auth = False
            st.rerun()
        else:
            st.error(resp.json().get("detail", "Invalid email or password."))
    except requests.exceptions.ConnectionError:
        st.error("Cannot connect to backend. Is the API running?")
    except Exception as e:
        st.error(f"Login error: {e}")


def signup_user(email: str, password: str, full_name: str):
    try:
        resp = requests.post(f"{API_BASE}/auth/signup",
                             json={"email": email, "password": password, "full_name": full_name},
                             timeout=10)
        if resp.status_code == 200:
            st.success("Account created! Sign in below.")
            st.session_state.auth_tab = "login"
            st.rerun()
        else:
            st.error(resp.json().get("detail", "Signup failed."))
    except Exception as e:
        st.error(f"Signup error: {e}")


# ══════════════════════════════════════════════════════════════════
#  AUTH PAGE  (full‑page, matches the reference image)
# ══════════════════════════════════════════════════════════════════
if st.session_state.show_auth:

    # Minimal top nav
    st.markdown('<div class="nav-bar-wrap">', unsafe_allow_html=True)
    na, nb, nc, nd, ne = st.columns([0.1, 1.6, 2.5, 0.52, 0.6])
    with na:
        st.markdown('<div style="padding:14px 0;font-size:18px;">📈</div>', unsafe_allow_html=True)
    with nb:
        st.markdown('<div style="padding:15px 0;font-size:19px;font-weight:800;color:#f0b90b;">FinAi</div>', unsafe_allow_html=True)
    with nd:
        st.markdown('<div id="nav-signin-wrap">', unsafe_allow_html=True)
        if st.button("Sign In", key="nav_si_auth", use_container_width=True):
            st.session_state.auth_tab = "login"; st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)
    with ne:
        st.markdown('<div id="nav-getstarted-wrap">', unsafe_allow_html=True)
        if st.button("Get Started", key="nav_gs_auth", use_container_width=True):
            st.session_state.auth_tab = "signup"; st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

    # Center column for auth card
    _, mid, _ = st.columns([1, 1.1, 1])
    with mid:
        st.markdown("""
        <div style="text-align:center;padding:36px 0 0;">
            <div class="auth-logo-icon">⇄</div>
            <div class="auth-app-title">FinAi</div>
            <div class="auth-app-sub">AI-Powered Trading Platform</div>
        </div>
        """, unsafe_allow_html=True)

        # Tab switcher
        t_si = st.session_state.auth_tab == "login"
        t_su = st.session_state.auth_tab == "signup"
        tc1, tc2 = st.columns(2)
        with tc1:
            st.markdown(f'<div id="tab-si-wrap" class="{"tab-active" if t_si else "tab-inactive"}">', unsafe_allow_html=True)
            if st.button("Sign In", key="tab_si", use_container_width=True):
                st.session_state.auth_tab = "login"; st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)
        with tc2:
            st.markdown(f'<div id="tab-su-wrap" class="{"tab-active" if t_su else "tab-inactive"}">', unsafe_allow_html=True)
            if st.button("Sign Up", key="tab_su", use_container_width=True):
                st.session_state.auth_tab = "signup"; st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="auth-card" style="margin-top:16px;">', unsafe_allow_html=True)

        # ── LOGIN FORM ──────────────────────────────────────
        if st.session_state.auth_tab == "login":
            st.markdown("""
            <div class="auth-welcome">Welcome back</div>
            <div class="auth-sub-text">Enter your credentials to access your account</div>
            """, unsafe_allow_html=True)

            with st.form("login_form"):
                st.text_input("Email", placeholder="name@example.com", key="li_email")
                st.text_input("Password", type="password", placeholder="••••••••", key="li_pass")

                fc1, fc2 = st.columns([1.5, 1])
                with fc1:
                    st.checkbox("Keep me signed in for 24h", key="li_remember")
                with fc2:
                    st.markdown('<div style="text-align:right;padding-top:6px;"><a href="#" class="forgot-link">Forgot password?</a></div>', unsafe_allow_html=True)

                if st.form_submit_button("Login", use_container_width=True):
                    e = st.session_state.get("li_email", "")
                    p = st.session_state.get("li_pass", "")
                    if e and p:
                        login_user(e, p)
                    else:
                        st.warning("Please fill in all fields.")

            # Social buttons (visual only)
            st.markdown("""
            <div class="social-btns">
                <div class="social-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Google
                </div>
                <div class="social-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#c8cdd4"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                    Apple
                </div>
            </div>
            <div class="or-divider"><span>OR CONTINUE WITH EMAIL</span></div>
            <div class="auth-footer-links">
                Don't have an account? <a href="#">Sign up</a>
            </div>
            <div class="auth-help">
                Need help? <a href="mailto:support@finai.io">support@finai.io</a>
            </div>
            """, unsafe_allow_html=True)

        # ── SIGNUP FORM ─────────────────────────────────────
        else:
            st.markdown("""
            <div class="auth-welcome">Create your account</div>
            <div class="auth-sub-text">Start trading with AI — it's free</div>
            """, unsafe_allow_html=True)

            with st.form("signup_form"):
                st.text_input("Full Name", placeholder="John Doe", key="su_name")
                st.text_input("Email", placeholder="name@example.com", key="su_email")
                st.text_input("Password", type="password", placeholder="Min. 8 characters", key="su_pass")
                st.text_input("Confirm Password", type="password", placeholder="Repeat password", key="su_pass2")

                if st.form_submit_button("Create Account", use_container_width=True):
                    nm = st.session_state.get("su_name", "")
                    em = st.session_state.get("su_email", "")
                    pw = st.session_state.get("su_pass", "")
                    p2 = st.session_state.get("su_pass2", "")
                    if not all([nm, em, pw, p2]):
                        st.warning("Please fill in all fields.")
                    elif pw != p2:
                        st.error("Passwords do not match.")
                    elif len(pw) < 8:
                        st.error("Password must be at least 8 characters.")
                    else:
                        signup_user(em, pw, nm)

            st.markdown("""
            <div class="or-divider"><span>OR SIGN IN WITH</span></div>
            <div class="social-btns">
                <div class="social-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Google
                </div>
                <div class="social-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#c8cdd4"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                    Apple
                </div>
            </div>
            <div class="auth-footer-links" style="margin-top:14px;">
                Already have an account? <a href="#">Sign in</a>
            </div>
            <div class="auth-help">
                Need help? <a href="mailto:support@finai.io">support@finai.io</a>
            </div>
            """, unsafe_allow_html=True)

        st.markdown('</div>', unsafe_allow_html=True)  # end auth-card

        st.markdown("<br>", unsafe_allow_html=True)
        st.markdown('<div id="back-btn-wrap">', unsafe_allow_html=True)
        if st.button("← Back to Home", key="back_home", use_container_width=True):
            st.session_state.show_auth = False
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="page-footer">© 2026 FinAi — AI-Powered Trading Platform. All rights reserved.</div>', unsafe_allow_html=True)

    st.stop()


# ══════════════════════════════════════════════════════════════════
#  LANDING PAGE
# ══════════════════════════════════════════════════════════════════

# ── NAV BAR ──
st.markdown('<div class="nav-bar-wrap">', unsafe_allow_html=True)
na, nb, nc, nd, ne = st.columns([0.1, 1.4, 2.8, 0.52, 0.6])
with na:
    st.markdown('<div style="padding:14px 0;font-size:18px;">📈</div>', unsafe_allow_html=True)
with nb:
    st.markdown('<div style="padding:15px 0;font-size:19px;font-weight:800;color:#f0b90b;">FinAi</div>', unsafe_allow_html=True)
with nc:
    st.markdown("""
    <div style="display:flex;align-items:center;justify-content:center;gap:36px;padding:16px 0;">
        <span style="color:#848e9c;font-size:14px;font-weight:500;">Features</span>
        <span style="color:#848e9c;font-size:14px;font-weight:500;">Markets</span>
        <span style="color:#848e9c;font-size:14px;font-weight:500;">Pricing</span>
        <span style="color:#848e9c;font-size:14px;font-weight:500;">Docs</span>
    </div>
    """, unsafe_allow_html=True)
with nd:
    st.markdown('<div id="nav-signin-wrap">', unsafe_allow_html=True)
    if st.button("Sign In", key="nav_si", use_container_width=True):
        st.session_state.show_auth = True
        st.session_state.auth_tab = "login"
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)
with ne:
    st.markdown('<div id="nav-getstarted-wrap">', unsafe_allow_html=True)
    if st.button("Get Started", key="nav_gs", use_container_width=True):
        st.session_state.show_auth = True
        st.session_state.auth_tab = "signup"
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)

# ── TICKER ──
st.markdown("""
<div class="ticker-wrap"><div class="ticker-inner">
  <span><span class="t-sym">BTC/USD</span><span class="t-up">$67,432 ▲ +2.4%</span></span>
  <span class="t-sep">|</span>
  <span><span class="t-sym">ETH/USD</span><span class="t-up">$3,521 ▲ +1.8%</span></span>
  <span class="t-sep">|</span>
  <span><span class="t-sym">AAPL</span><span class="t-up">$192.35 ▲ +0.9%</span></span>
  <span class="t-sep">|</span>
  <span><span class="t-sym">TSLA</span><span class="t-dn">$248.70 ▼ −1.2%</span></span>
  <span class="t-sep">|</span>
  <span><span class="t-sym">SPX</span><span class="t-up">5,304 ▲ +0.5%</span></span>
  <span class="t-sep">|</span>
  <span><span class="t-sym">NVDA</span><span class="t-up">$875 ▲ +3.1%</span></span>
  <span class="t-sep">|</span>
  <span><span class="t-sym">MSFT</span><span class="t-up">$415 ▲ +0.7%</span></span>
  <span class="t-sep">|</span>
  <span><span class="t-sym">BNB/USD</span><span class="t-dn">$412 ▼ −0.3%</span></span>
</div></div>
""", unsafe_allow_html=True)

# ── HERO ──
st.markdown("""
<div class="hero-wrap">
  <div class="hero-badge">🤖 Powered by Grok AI</div>
  <div class="hero-h1">Trade Smarter with<br><em>AI-Powered</em> Insights</div>
  <div class="hero-sub">FinAi reads real-time financial news, detects market events, and executes automated trading strategies — all powered by Grok's advanced intelligence.</div>
</div>
""", unsafe_allow_html=True)

_, hb1, hb2, _ = st.columns([2, 1, 1, 2])
with hb1:
    st.markdown('<div id="hero-gs-wrap">', unsafe_allow_html=True)
    if st.button("Get Started →", key="hero_gs", use_container_width=True):
        st.session_state.show_auth = True
        st.session_state.auth_tab = "signup"
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)
with hb2:
    st.markdown('<div id="hero-si-wrap">', unsafe_allow_html=True)
    if st.button("Sign In", key="hero_si", use_container_width=True):
        st.session_state.show_auth = True
        st.session_state.auth_tab = "login"
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)

# ── STATS ──
st.markdown("""
<div class="stats-wrap">
  <div><span class="stat-num">$2.4B+</span><div class="stat-lbl">Volume Analyzed</div></div>
  <div><span class="stat-num">50K+</span><div class="stat-lbl">News Articles / Day</div></div>
  <div><span class="stat-num">99.9%</span><div class="stat-lbl">Uptime</div></div>
  <div><span class="stat-num">12ms</span><div class="stat-lbl">Signal Latency</div></div>
</div>
""", unsafe_allow_html=True)

# ── FEATURES ──
st.markdown("""
<div class="feat-wrap">
  <div class="feat-head">Everything you need to trade intelligently</div>
  <div class="feat-sub">From AI news analysis to automated order execution</div>
  <div class="feat-grid">
    <div class="feat-card"><span class="feat-icon">🧠</span><div class="feat-title">Grok AI Analysis</div><div class="feat-desc">Real-time sentiment analysis and market impact scoring powered by Grok LLM for precise trading signals.</div></div>
    <div class="feat-card"><span class="feat-icon">📰</span><div class="feat-title">News Ingestion Engine</div><div class="feat-desc">Aggregates Bloomberg, CNBC, Reuters, 50+ sources. Events detected and ranked by market impact within seconds.</div></div>
    <div class="feat-card"><span class="feat-icon">🤖</span><div class="feat-title">Automated Trading Bots</div><div class="feat-desc">Per-user bots with configurable risk, drawdown limits, and Alpaca paper &amp; live trading support.</div></div>
    <div class="feat-card"><span class="feat-icon">📊</span><div class="feat-title">Trendline Forecasting</div><div class="feat-desc">ATR-based breakout detection with AI-powered price forecasting across any timeframe.</div></div>
    <div class="feat-card"><span class="feat-icon">🔔</span><div class="feat-title">Multi-Channel Alerts</div><div class="feat-desc">Trade alerts via Telegram, WhatsApp, Slack, or email the instant high-impact events are detected.</div></div>
    <div class="feat-card"><span class="feat-icon">🔑</span><div class="feat-title">Secure API Access</div><div class="feat-desc">Scoped, rate-limited API keys for external automations. Full audit log.</div></div>
  </div>
</div>
""", unsafe_allow_html=True)

# ── CTA ──
st.markdown("""
<div class="cta-wrap">
  <div class="cta-h">Ready to trade with AI?</div>
  <div class="cta-sub">Join thousands of traders using FinAi to stay ahead of the market.</div>
</div>
""", unsafe_allow_html=True)
_, cb, _ = st.columns([3, 1, 3])
with cb:
    st.markdown('<div id="cta-btn-wrap">', unsafe_allow_html=True)
    if st.button("Create Free Account", key="cta_btn", use_container_width=True):
        st.session_state.show_auth = True
        st.session_state.auth_tab = "signup"
        st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)

st.markdown('<div class="footer-wrap">© 2026 FinAi — AI-Powered Financial Intelligence Platform. All rights reserved.</div>', unsafe_allow_html=True)
