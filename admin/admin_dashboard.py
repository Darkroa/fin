import streamlit as st
import requests
import pandas as pd
from datetime import datetime
import os

st.set_page_config(
    page_title="FinAi Admin",
    page_icon="⚙️",
    layout="wide",
    initial_sidebar_state="expanded",
)

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000/api")

ADMIN_CSS = """
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

[data-testid="stSidebar"] {
    background: #0d1117 !important;
    border-right: 1px solid #1e2329 !important;
}

[data-testid="stMetric"] {
    background: #161a1e !important;
    border: 1px solid #1e2329 !important;
    border-radius: 10px !important;
    padding: 16px !important;
}
[data-testid="stMetricLabel"] { color: #848e9c !important; font-size: 12px !important; text-transform: uppercase; letter-spacing: 0.5px; }
[data-testid="stMetricValue"] { color: #eaecef !important; font-size: 24px !important; font-weight: 700 !important; }

[data-testid="stTextInput"] input {
    background: #0b0e11 !important;
    border: 1px solid #2b3139 !important;
    color: #eaecef !important;
    border-radius: 6px !important;
}
[data-testid="stTextInput"] input:focus { border-color: #f0b90b !important; }
[data-testid="stTextInput"] label { color: #848e9c !important; font-size: 12px !important; font-weight: 600 !important; }

[data-testid="stButton"] > button {
    background: #2b3139 !important;
    color: #eaecef !important;
    border: 1px solid #2b3139 !important;
    border-radius: 6px !important;
    font-weight: 600 !important;
    transition: all 0.2s !important;
}
[data-testid="stButton"] > button:hover {
    background: #363c46 !important;
    border-color: #f0b90b !important;
}
[data-testid="stFormSubmitButton"] button {
    background: #f0b90b !important;
    color: #0b0e11 !important;
    font-weight: 700 !important;
    border: none !important;
    border-radius: 6px !important;
}
[data-testid="stFormSubmitButton"] button:hover { background: #f8d254 !important; }

.admin-card {
    background: #161a1e;
    border: 1px solid #1e2329;
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 16px;
}
.section-header {
    font-size: 18px;
    font-weight: 700;
    color: #eaecef;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid #1e2329;
}
.badge-active { background:rgba(14,203,129,0.1);color:#0ecb81;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:700; }
.badge-banned { background:rgba(246,70,93,0.1);color:#f6465d;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:700; }
.badge-pending { background:rgba(240,185,11,0.1);color:#f0b90b;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:700; }

hr { border-color: #1e2329 !important; }
[data-testid="stDataFrame"] { background: #161a1e !important; border-radius: 8px !important; }
</style>
"""

st.markdown(ADMIN_CSS, unsafe_allow_html=True)

if "admin_jwt" not in st.session_state:
    st.session_state.admin_jwt = None

if not st.session_state.admin_jwt:
    col_l, col_c, col_r = st.columns([1.5, 1, 1.5])
    with col_c:
        st.markdown("""
        <div style="text-align:center;margin:40px 0 32px;">
            <div style="width:56px;height:56px;background:linear-gradient(135deg,#f0b90b,#f8d254);border-radius:12px;
            display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">⚙️</div>
            <div style="font-size:22px;font-weight:800;color:#eaecef;">FinAi Admin</div>
            <div style="font-size:14px;color:#848e9c;margin-top:4px;">Restricted Access — Admins Only</div>
        </div>
        """, unsafe_allow_html=True)

        with st.form("admin_login"):
            email = st.text_input("Admin Email", placeholder="admin@finai.io")
            password = st.text_input("Password", type="password", placeholder="••••••••")
            submitted = st.form_submit_button("Sign In to Admin Panel", use_container_width=True)
            if submitted:
                try:
                    resp = requests.post(f"{API_BASE}/auth/login", json={"email": email, "password": password}, timeout=10)
                    if resp.status_code == 200:
                        st.session_state.admin_jwt = resp.json()["access_token"]
                        st.success("Authenticated successfully.")
                        st.rerun()
                    else:
                        st.error("Invalid credentials or not an admin account.")
                except Exception as e:
                    st.error(f"Connection failed: {e}")
    st.stop()

headers = {"Authorization": f"Bearer {st.session_state.admin_jwt}"}

with st.sidebar:
    st.markdown('<div style="font-size:18px;font-weight:800;color:#f0b90b;padding:8px 0 20px;">⚙️ FinAi Admin</div>', unsafe_allow_html=True)
    nav = st.radio(
        "",
        ["Overview", "Users", "Transactions", "Events", "System", "WhatsApp Bot"],
        label_visibility="collapsed",
    )
    st.markdown("---")
    if st.button("Back to App", use_container_width=True):
        st.switch_page("src/frontend/user_dashboard.py")
    if st.button("Logout Admin", use_container_width=True):
        st.session_state.admin_jwt = None
        st.rerun()


def api_get(path):
    try:
        r = requests.get(f"{API_BASE}{path}", headers=headers, timeout=10)
        return r.json() if r.status_code == 200 else []
    except Exception:
        return []


def api_post(path, data):
    try:
        r = requests.post(f"{API_BASE}{path}", json=data, headers=headers, timeout=10)
        return r.json() if r.status_code == 200 else {"error": r.text}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────── OVERVIEW ────────────────────────────
if nav == "Overview":
    st.markdown('<div class="section-header">Admin Overview</div>', unsafe_allow_html=True)

    users = api_get("/admin/users")
    txs = api_get("/admin/transactions")

    total_users = len(users) if isinstance(users, list) else 0
    active_users = len([u for u in (users if isinstance(users, list) else []) if u.get("is_active")]) if users else 0
    banned = len([u for u in (users if isinstance(users, list) else []) if u.get("is_banned")]) if users else 0
    pending_tx = len([t for t in (txs if isinstance(txs, list) else []) if t.get("status") == "pending"]) if txs else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Users", total_users)
    c2.metric("Active Users", active_users)
    c3.metric("Banned", banned)
    c4.metric("Pending Transactions", pending_tx)

    st.markdown("<br>", unsafe_allow_html=True)
    col_u, col_t = st.columns(2)

    with col_u:
        st.markdown('<div class="section-header">Recent Users</div>', unsafe_allow_html=True)
        if isinstance(users, list) and users:
            df_u = pd.DataFrame(users[:10])
            st.dataframe(df_u, use_container_width=True, hide_index=True)
        else:
            st.info("No users found.")

    with col_t:
        st.markdown('<div class="section-header">Recent Transactions</div>', unsafe_allow_html=True)
        if isinstance(txs, list) and txs:
            df_t = pd.DataFrame(txs[:10])
            st.dataframe(df_t, use_container_width=True, hide_index=True)
        else:
            st.info("No transactions found.")


# ─────────────────────────── USERS ────────────────────────────
elif nav == "Users":
    st.markdown('<div class="section-header">User Management</div>', unsafe_allow_html=True)
    users = api_get("/admin/users")

    search = st.text_input("Search by email", placeholder="Filter users...")
    if isinstance(users, list):
        if search:
            users = [u for u in users if search.lower() in u.get("email", "").lower()]

        if users:
            for u in users:
                is_banned = u.get("is_banned", False)
                is_admin = u.get("is_admin", False)
                verified = u.get("is_mail_verified", False)
                st.markdown(f"""
                <div class="admin-card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:15px;font-weight:700;color:#eaecef;">{u.get('full_name') or 'No name'}</div>
                            <div style="font-size:13px;color:#848e9c;">{u.get('email')}</div>
                            <div style="margin-top:8px;display:flex;gap:8px;">
                                {'<span class="badge-banned">Banned</span>' if is_banned else '<span class="badge-active">Active</span>'}
                                {'<span style="background:rgba(240,185,11,0.1);color:#f0b90b;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:700;">Admin</span>' if is_admin else ''}
                                {'<span class="badge-active">Verified</span>' if verified else '<span class="badge-pending">Unverified</span>'}
                            </div>
                        </div>
                        <div style="text-align:right;font-size:12px;color:#848e9c;">
                            ID: {u.get('id')}
                        </div>
                    </div>
                </div>
                """, unsafe_allow_html=True)

                col_a, col_b, col_d = st.columns(3)
                with col_a:
                    action = "Unban" if is_banned else "Ban"
                    if st.button(f"{action} User", key=f"ban_{u['id']}"):
                        result = api_post("/admin/update-user", {"email": u["email"], "is_banned": not is_banned})
                        st.success(f"User {action.lower()}ned.") if "error" not in result else st.error(result["error"])
                        st.rerun()
                with col_b:
                    if st.button("Toggle Admin", key=f"adm_{u['id']}"):
                        result = api_post("/admin/update-user", {"email": u["email"], "is_admin": not is_admin})
                        st.success("Admin status toggled.") if "error" not in result else st.error(result["error"])
                        st.rerun()
                with col_d:
                    if st.button("Delete User", key=f"del_{u['id']}"):
                        result = api_post("/admin/delete-user", {})
                        st.warning(f"Delete requested for {u['email']}.")
        else:
            st.info("No users found.")
    else:
        st.error("Could not load users.")


# ─────────────────────────── TRANSACTIONS ────────────────────────────
elif nav == "Transactions":
    st.markdown('<div class="section-header">Transactions</div>', unsafe_allow_html=True)
    txs = api_get("/admin/transactions")

    status_filter = st.selectbox("Filter by Status", ["All", "pending", "approved", "rejected"])
    if isinstance(txs, list):
        if status_filter != "All":
            txs = [t for t in txs if t.get("status") == status_filter]
        if txs:
            for t in txs:
                amt = float(t.get("amount", 0))
                status = t.get("status", "pending")
                color = {"pending": "#f0b90b", "approved": "#0ecb81", "rejected": "#f6465d"}.get(status, "#848e9c")
                st.markdown(f"""
                <div class="admin-card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:15px;font-weight:700;color:#eaecef;">{'Deposit' if amt > 0 else 'Withdrawal'}</div>
                            <div style="font-size:13px;color:#848e9c;">{t.get('user_email', '—')}</div>
                            <div style="font-size:12px;color:#848e9c;margin-top:4px;">{t.get('created_at', '—')}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:20px;font-weight:800;color:#eaecef;">${abs(amt):,.2f}</div>
                            <div style="font-size:12px;color:{color};font-weight:700;text-transform:uppercase;">{status}</div>
                        </div>
                    </div>
                </div>
                """, unsafe_allow_html=True)

                if status == "pending":
                    col_ap, col_rj = st.columns(2)
                    with col_ap:
                        if st.button("Approve", key=f"ap_{t['id']}"):
                            result = api_post("/admin/approve-transaction", {"transaction_id": str(t["id"])})
                            st.success("Approved.") if "error" not in result else st.error(result["error"])
                            st.rerun()
                    with col_rj:
                        if st.button("Reject", key=f"rj_{t['id']}"):
                            result = api_post("/admin/reject-transaction", {"transaction_id": str(t["id"])})
                            st.warning("Rejected.") if "error" not in result else st.error(result["error"])
                            st.rerun()
        else:
            st.info("No transactions matching filter.")
    else:
        st.error("Could not load transactions.")


# ─────────────────────────── EVENTS ────────────────────────────
elif nav == "Events":
    st.markdown('<div class="section-header">Detected Market Events</div>', unsafe_allow_html=True)
    events = api_get("/events?limit=50")
    if isinstance(events, dict):
        events = events.get("events", [])
    if events:
        for ev in events:
            imp = ev.get("impact_score", 0)
            imp_color = "#f6465d" if imp >= 7 else "#f0b90b" if imp >= 5 else "#0ecb81"
            sent = ev.get("sentiment", "neutral")
            sent_color = "#0ecb81" if sent == "positive" else "#f6465d" if sent == "negative" else "#848e9c"
            st.markdown(f"""
            <div class="admin-card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
                    <div style="flex:1;">
                        <div style="font-size:14px;font-weight:700;color:#eaecef;margin-bottom:6px;">{ev.get('title', '—')}</div>
                        <div style="font-size:12px;color:#848e9c;">{ev.get('event_type','—')} · {ev.get('created_at','')[:16]}</div>
                        <div style="font-size:13px;color:#848e9c;margin-top:6px;">{(ev.get('short_term_impact') or '')[:120]}</div>
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                        <div style="font-size:18px;font-weight:800;color:{imp_color};">{imp}/10</div>
                        <div style="font-size:12px;color:{sent_color};text-transform:capitalize;">{sent}</div>
                        <div style="font-size:11px;color:#848e9c;margin-top:4px;">Conf: {ev.get('confidence',0):.0%}</div>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("No events detected yet. Trigger news ingestion to start detecting events.")
        if st.button("Trigger Ingestion Now"):
            result = requests.post(f"{API_BASE}/ingest", headers=headers, timeout=10)
            st.success(f"Ingestion triggered: {result.json()}")


# ─────────────────────────── SYSTEM ────────────────────────────
elif nav == "System":
    st.markdown('<div class="section-header">System Status</div>', unsafe_allow_html=True)

    col_h, col_c = st.columns(2)
    with col_h:
        try:
            r = requests.get(f"{API_BASE}/health", timeout=5)
            if r.status_code == 200:
                st.success("API Backend: Healthy")
                st.json(r.json())
            else:
                st.error("API Backend: Unhealthy")
        except Exception:
            st.error("API Backend: Unreachable")

    with col_c:
        try:
            r = requests.get(f"{API_BASE}/celery/workers", headers=headers, timeout=5)
            if r.status_code == 200:
                data = r.json()
                workers = data.get("active_workers", 0)
                if workers > 0:
                    st.success(f"Celery: {workers} worker(s) active")
                else:
                    st.warning("Celery: Running in eager mode (no Redis workers)")
                st.json(data)
        except Exception as e:
            st.warning(f"Celery status unavailable: {e}")

    st.markdown("---")
    st.markdown('<div class="section-header">Actions</div>', unsafe_allow_html=True)
    col_act1, col_act2 = st.columns(2)
    with col_act1:
        if st.button("Trigger News Ingestion", use_container_width=True):
            try:
                r = requests.post(f"{API_BASE}/ingest", headers=headers, timeout=10)
                st.success(f"Triggered: {r.json()}")
            except Exception as e:
                st.error(f"Failed: {e}")
    with col_act2:
        if st.button("Check Celery Workers", use_container_width=True):
            try:
                r = requests.get(f"{API_BASE}/celery/workers", headers=headers, timeout=10)
                st.json(r.json())
            except Exception as e:
                st.error(f"Failed: {e}")


# ─────────────────────────── WHATSAPP BOT ────────────────────────────
elif nav == "WhatsApp Bot":
    st.markdown('<div class="section-header">WhatsApp Bot — Evolution API</div>', unsafe_allow_html=True)

    # ── Connection Status ──────────────────────────────────────────────
    st.markdown("#### Connection Status")
    col_stat, col_refresh = st.columns([4, 1])
    with col_refresh:
        refresh_status = st.button("🔄 Refresh", key="refresh_ev_status", use_container_width=True)

    try:
        r_status = requests.get(f"{API_BASE}/users/whatsapp-ev-status", headers=headers, timeout=10)
        if r_status.status_code == 200:
            status_data = r_status.json()
            state = status_data.get("state", "unknown")
            instance = status_data.get("instance", os.getenv("EVOLUTION_INSTANCE", "—"))

            state_color = {
                "open": "#0ecb81",
                "connecting": "#f0b90b",
                "qr": "#f0b90b",
                "close": "#f6465d",
                "not_configured": "#848e9c",
                "error": "#f6465d",
            }.get(state, "#848e9c")

            state_label = {
                "open": "Connected ✅",
                "connecting": "Connecting… ⏳",
                "qr": "Waiting for QR scan 📷",
                "close": "Disconnected ❌",
                "not_configured": "Not Configured ⚙️",
                "error": "Error ⚠️",
            }.get(state, state.capitalize())

            st.markdown(f"""
            <div class="admin-card">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:20px;font-weight:800;color:{state_color};">{state_label}</div>
                        <div style="font-size:13px;color:#848e9c;margin-top:4px;">Instance: <b>{instance}</b></div>
                    </div>
                    <div style="font-size:38px;">{
                        "✅" if state == "open" else
                        "⏳" if state in ("connecting", "qr") else
                        "❌" if state == "close" else "⚙️"
                    }</div>
                </div>
                {"<div style='margin-top:10px;font-size:12px;color:#f6465d;'>" + status_data.get("detail","") + "</div>" if status_data.get("detail") else ""}
            </div>
            """, unsafe_allow_html=True)
        else:
            st.error(f"Status check failed ({r_status.status_code}): {r_status.text[:200]}")
    except Exception as e:
        st.error(f"Could not reach Evolution API status endpoint: {e}")

    st.markdown("---")

    # ── QR Code ───────────────────────────────────────────────────────
    st.markdown("#### Connect via QR Code")
    st.caption("Scan this QR code with the WhatsApp account you want to use as the bot.")

    if st.button("📷 Generate / Refresh QR Code", use_container_width=True):
        with st.spinner("Fetching QR code from Evolution API…"):
            try:
                r_qr = requests.get(f"{API_BASE}/users/whatsapp-qr", headers=headers, timeout=20)
                if r_qr.status_code == 200:
                    qr_data = r_qr.json()
                    if "error" in qr_data:
                        st.error(f"Evolution API error: {qr_data['error']}")
                    else:
                        b64 = qr_data.get("base64", "")
                        code = qr_data.get("code", "")
                        qr_status = qr_data.get("status", "")

                        if b64:
                            img_src = b64 if b64.startswith("data:") else f"data:image/png;base64,{b64}"
                            st.markdown(f"""
                            <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px;">
                                <img src="{img_src}"
                                     style="width:260px;height:260px;border-radius:12px;border:3px solid #f0b90b;background:#fff;padding:8px;" />
                                {"<div style='font-family:monospace;font-size:13px;color:#848e9c;word-break:break-all;text-align:center;max-width:280px;'>Pairing code: <b style=color:#eaecef;>" + code + "</b></div>" if code else ""}
                                <div style='font-size:12px;color:#0ecb81;'>Status: {qr_status}</div>
                            </div>
                            """, unsafe_allow_html=True)
                            st.info("Open WhatsApp on your phone → Linked Devices → Link a Device, then scan the QR above.")
                        else:
                            st.warning("QR code image not returned — the instance may already be connected.")
                            st.json(qr_data)
                else:
                    st.error(f"QR endpoint returned {r_qr.status_code}: {r_qr.text[:300]}")
            except Exception as ex:
                st.error(f"Failed to fetch QR code: {ex}")

    st.markdown("---")
    st.markdown("#### Configuration")
    ev_url = os.getenv("EVOLUTION_API_URL", "Not set")
    ev_inst = os.getenv("EVOLUTION_INSTANCE", "Not set")
    st.markdown(f"""
    <div class="admin-card" style="font-size:13px;color:#848e9c;">
        <div><b style="color:#eaecef;">API URL:</b> {ev_url}</div>
        <div style="margin-top:6px;"><b style="color:#eaecef;">Instance:</b> {ev_inst}</div>
        <div style="margin-top:6px;"><b style="color:#eaecef;">API Key:</b> {"✅ Configured" if os.getenv("EVOLUTION_API_KEY") else "❌ Not set"}</div>
        <div style="margin-top:10px;font-size:11px;color:#4a5568;">
            Evolution API cloned at: <code style="color:#f0b90b;">evolution-api/</code><br>
            Start command: <code style="color:#f0b90b;">cd evolution-api && npm install && npm start</code>
        </div>
    </div>
    """, unsafe_allow_html=True)
