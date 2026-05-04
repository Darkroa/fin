import streamlit as st
import requests
import jwt  # PyJWT
from datetime import datetime

st.set_page_config(page_title="FinAi - Login", layout="centered", page_icon="📈")

import os
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000/api")

# Initialize session state
if "jwt_token" not in st.session_state:
    st.session_state.jwt_token = None
if "user" not in st.session_state:          # Store full user info
    st.session_state.user = None

def login_user(email: str, password: str):
    try:
        resp = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            token = data["access_token"]
            
            # Decode without verifying signature (safe here because we trust our backend)
            # In production, you can verify with SECRET_KEY if you want extra checks
            decoded = jwt.decode(token, options={"verify_signature": False})
            
            st.session_state.jwt_token = token
            st.session_state.user = {
                "email": decoded.get("sub"),
                "exp": datetime.fromtimestamp(decoded.get("exp")) if decoded.get("exp") else None
            }
            
            st.success("✅ Login successful! Redirecting...")
            st.rerun()
        else:
            error_detail = resp.json().get("detail", "Invalid email or password")
            st.error(f"❌ {error_detail}")
    except requests.exceptions.ConnectionError:
        st.error("❌ Cannot connect to backend. Is the FastAPI server running?")
    except Exception as e:
        st.error(f"Login failed: {str(e)}")


def signup_user(email: str, password: str, full_name: str):
    try:
        resp = requests.post(
            f"{API_BASE}/auth/signup",
            json={"email": email, "password": password, "full_name": full_name}
        )
        if resp.status_code == 200:
            st.success("✅ Account created! You can now log in.")
            st.session_state.show_login = True
            st.rerun()
        else:
            detail = resp.json().get("detail", "Signup failed")
            st.error(f"❌ {detail}")
    except Exception as e:
        st.error(f"Signup error: {str(e)}")


def logout():
    st.session_state.jwt_token = None
    st.session_state.user = None
    st.success("Logged out successfully")
    st.rerun()


# ===================== UI =====================
st.title("🔐 FinAi")
st.markdown("### AI-Powered Financial News & Automated Trading")

if st.session_state.jwt_token:
    st.success(f"Logged in as **{st.session_state.user['email']}**")
    if st.button("Logout", type="secondary"):
        logout()
    st.stop()  # Stop here and show main dashboard in another page

tab1, tab2 = st.tabs(["Sign In", "Create Account"])

with tab1:
    with st.form("login_form"):
        st.subheader("Sign In")
        email = st.text_input("Email Address", placeholder="you@example.com")
        password = st.text_input("Password", type="password")
        if st.form_submit_button("Login", use_container_width=True):
            if email and password:
                login_user(email, password)
            else:
                st.warning("Please enter email and password")

with tab2:
    with st.form("signup_form"):
        st.subheader("Create New Account")
        full_name = st.text_input("Full Name")
        email = st.text_input("Email Address", placeholder="you@example.com")
        password = st.text_input("Password", type="password")
        password_confirm = st.text_input("Confirm Password", type="password")

        if st.form_submit_button("Create Account", use_container_width=True):
            if password != password_confirm:
                st.error("Passwords do not match")
            elif len(password) < 8:
                st.error("Password must be at least 8 characters")
            else:
                signup_user(email, password, full_name)

st.divider()
st.caption("Demo: Use any email + password (signup first). Admin features require is_admin=True in DB.")