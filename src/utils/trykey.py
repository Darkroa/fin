import requests
from dotenv import load_dotenv
import os

# Load .env file (won't override keys already in os.environ — i.e. Replit Secrets)
load_dotenv(override=False)

# ==================== API Keys ====================
# Reads from Replit Secrets first, falls back to .env file
KEYS = {
    "GitHub Models":              os.getenv("GITHUB_API_KEY"),
    "Groq Cloud":                 os.getenv("GROQ_API_KEY"),
    "NVIDIA Build (NIM)":         os.getenv("NVIDIA_API_KEY"),
    "Google AI Studio (Gemini)": os.getenv("GEMINI_API_KEY"),
    "OpenRouter":                 os.getenv("OPENROUTER_API_KEY"),
    "DeepSeek":                   os.getenv("DEEPSEEK_API_KEY"),
    "OpenAI":                     os.getenv("OPENAI_API_KEY"),
    "Grok (xAI)":                 os.getenv("GROK_API_KEY"),
    "Alpaca":                     os.getenv("ALPACA_API_KEY"),
    "CoinGecko":                  os.getenv("COINGECKO_API_KEY"),
    "Telegram Bot":               os.getenv("TELEGRAM_BOT_TOKEN"),
    # Email / SMS services
    "SMTP":                       os.getenv("SMTP_USER"),
    "Resend":                     os.getenv("RESEND_API_KEY"),
    "Twilio":                     os.getenv("TWILIO_ACCOUNT_SID"),
}

# ==================== Supabase Env ====================
SUPABASE_VARS = {
    "SUPABASE_URL":    os.getenv("SUPABASE_URL", "").strip(),
    "SUPABASE_KEY":    os.getenv("SUPABASE_KEY", "").strip(),
    "SUPABASE_DB_URL": os.getenv("SUPABASE_DB_URL", "").strip(),
}


# ==================== Test Function ====================

def test_api(name: str, url: str, headers: dict, payload: dict, timeout=8):
    key = KEYS.get(name)
    if not key or key.strip() == "":
        print(f"⏭️  {name}: No key in env / Replit Secrets")
        return False
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=timeout)
        if r.status_code == 200:
            print(f"✅ {name}: OK")
            return True
        elif r.status_code in (401, 403):
            print(f"❌ {name}: Invalid or expired key (HTTP {r.status_code})")
        elif r.status_code == 429:
            print(f"⚠️  {name}: Rate limited")
        else:
            print(f"❌ {name}: Failed (HTTP {r.status_code})")
        return False
    except requests.exceptions.Timeout:
        print(f"⏱  {name}: Timeout")
    except Exception as e:
        print(f"❌ {name}: Error — {e}")
    return False


# ==================== Individual Tests ====================

def test_google_ai_studio():
    key = KEYS.get("Google AI Studio (Gemini)")
    if not key: return False
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": "ping"}]}]}
    return test_api("Google AI Studio (Gemini)", url, headers, payload)


def test_groq():
    key = KEYS.get("Groq Cloud")
    if not key: return False
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": "ping"}], "max_tokens": 10}
    return test_api("Groq Cloud", url, headers, payload)


def test_github_models():
    key = KEYS.get("GitHub Models")
    if not key: return False
    url = "https://models.github.ai/inference/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "ping"}]}
    return test_api("GitHub Models", url, headers, payload)


def test_openrouter():
    key = KEYS.get("OpenRouter")
    if not key: return False
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": "openrouter/auto", "messages": [{"role": "user", "content": "ping"}]}
    return test_api("OpenRouter", url, headers, payload)


def test_nvidia():
    key = KEYS.get("NVIDIA Build (NIM)")
    if not key: return False
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": "meta/llama-3.3-70b-instruct", "messages": [{"role": "user", "content": "ping"}], "max_tokens": 10}
    return test_api("NVIDIA Build (NIM)", url, headers, payload)


def test_deepseek():
    key = KEYS.get("DeepSeek")
    if not key: return False
    url = "https://api.deepseek.com/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": "deepseek-chat", "messages": [{"role": "user", "content": "ping"}], "max_tokens": 10}
    return test_api("DeepSeek", url, headers, payload)


def test_openai():
    key = KEYS.get("OpenAI")
    if not key: return False
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "ping"}], "max_tokens": 10}
    return test_api("OpenAI", url, headers, payload)


def test_grok():
    key = KEYS.get("Grok (xAI)")
    if not key: return False
    url = "https://api.x.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": "grok-3", "messages": [{"role": "user", "content": "ping"}], "max_tokens": 10}
    return test_api("Grok (xAI)", url, headers, payload)


def test_alpaca():
    key = KEYS.get("Alpaca")
    secret = os.getenv("ALPACA_SECRET_KEY")
    if not key or not secret:
        print("⏭️  Alpaca: No key in env / Replit Secrets")
        return False
    url = "https://paper-api.alpaca.markets/v2/account"
    headers = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}
    try:
        r = requests.get(url, headers=headers, timeout=8)
        if r.status_code == 200:
            print("✅ Alpaca: OK")
            return True
        elif r.status_code in (401, 403):
            print(f"❌ Alpaca: Invalid key (HTTP {r.status_code})")
        else:
            print(f"❌ Alpaca: Failed (HTTP {r.status_code})")
        return False
    except Exception as e:
        print(f"❌ Alpaca: Error — {e}")
        return False


def test_coingecko():
    key = KEYS.get("CoinGecko")
    if not key:
        print("⏭️  CoinGecko: No key in env (public endpoint will still work)")
        return False
    url = f"https://api.coingecko.com/api/v3/ping"
    headers = {"x-cg-demo-api-key": key}
    try:
        r = requests.get(url, headers=headers, timeout=8)
        if r.status_code == 200:
            print("✅ CoinGecko: OK")
            return True
        print(f"❌ CoinGecko: Failed (HTTP {r.status_code})")
        return False
    except Exception as e:
        print(f"❌ CoinGecko: Error — {e}")
        return False


def test_telegram():
    token = KEYS.get("Telegram Bot")
    if not token:
        print("⏭️  Telegram Bot: No token in env / Replit Secrets")
        return False
    url = f"https://api.telegram.org/bot{token}/getMe"
    try:
        r = requests.get(url, timeout=8)
        if r.status_code == 200:
            data = r.json().get("result", {})
            print(f"✅ Telegram Bot: OK (@{data.get('username', '?')})")
            return True
        print(f"❌ Telegram Bot: Failed (HTTP {r.status_code})")
        return False
    except Exception as e:
        print(f"❌ Telegram Bot: Error — {e}")
        return False


def test_smtp():
    """Test SMTP connectivity using smtplib (no actual email sent)."""
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not smtp_user or not smtp_pass:
        print("⏭️  SMTP: SMTP_USER / SMTP_PASSWORD not set")
        return False
    try:
        import smtplib
        with smtplib.SMTP(smtp_host, smtp_port, timeout=8) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(smtp_user, smtp_pass)
        print(f"✅ SMTP: OK ({smtp_host}:{smtp_port} as {smtp_user})")
        return True
    except smtplib.SMTPAuthenticationError:
        print(f"❌ SMTP: Authentication failed — check SMTP_USER / SMTP_PASSWORD (or enable App Passwords for Gmail)")
        return False
    except Exception as e:
        print(f"❌ SMTP: Error — {e}")
        return False


def test_resend():
    """Test Resend API key validity via /domains list (no email sent)."""
    key = os.getenv("RESEND_API_KEY", "").strip()
    if not key:
        print("⏭️  Resend: RESEND_API_KEY not set")
        return False
    try:
        r = requests.get(
            "https://api.resend.com/domains",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            timeout=8,
        )
        if r.status_code == 200:
            domains = r.json().get("data", [])
            domain_list = ", ".join(d.get("name", "?") for d in domains) if domains else "(no domains)"
            print(f"✅ Resend: OK — domains: {domain_list}")
            return True
        elif r.status_code in (401, 403):
            print(f"❌ Resend: Invalid or expired API key (HTTP {r.status_code})")
        else:
            print(f"❌ Resend: Failed (HTTP {r.status_code})")
        return False
    except Exception as e:
        print(f"❌ Resend: Error — {e}")
        return False


def send_test_email(
    receiver: str = "addemailhere@gmail.com",
    subject: str = "FinAi Project — Test Email",
    body: str = "It's working! Your email connection is successfully configured.",
):
    """
    Send a test email via SMTP and/or Resend — whichever keys are available.
    Both channels fire independently; succeeds if at least one delivers.
    """
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    resend_from = os.getenv("RESEND_FROM", "FinAi <onboarding@resend.dev>")

    print(f"\n📧 Sending test email to {receiver} ...\n")
    smtp_ok = resend_ok = False

    print("[SMTP]")
    if not smtp_user or not smtp_pass:
        print("  ⚠️  SMTP_USER / SMTP_PASSWORD not set — skipping.")
    else:
        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_user
            msg["To"] = receiver
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as srv:
                srv.starttls()
                srv.login(smtp_user, smtp_pass)
                srv.sendmail(smtp_user, [receiver], msg.as_string())
            print(f"  ✅ SMTP sent ({smtp_host}:{smtp_port})")
            smtp_ok = True
        except Exception as e:
            print(f"  ❌ SMTP failed: {e}")

    print("\n[Resend]")
    if not resend_key:
        print("  ⚠️  RESEND_API_KEY not set — skipping.")
    else:
        try:
            r = requests.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                json={"from": resend_from, "to": [receiver], "subject": subject, "text": body},
                timeout=10,
            )
            if r.status_code in (200, 201):
                print(f"  ✅ Resend sent (id={r.json().get('id')})")
                resend_ok = True
            else:
                print(f"  ❌ Resend API error {r.status_code}: {r.text}")
        except Exception as e:
            print(f"  ❌ Resend failed: {e}")

    print()
    if smtp_ok and resend_ok:
        print("🎉 Both SMTP and Resend delivered the email.")
    elif smtp_ok or resend_ok:
        print(f"✅ Email delivered via {'SMTP' if smtp_ok else 'Resend'}.")
    else:
        print("❌ All providers failed. Set SMTP_USER/SMTP_PASSWORD and/or RESEND_API_KEY.")

    return smtp_ok or resend_ok


def test_twilio():
    """Test Twilio credentials via Account SID lookup (no SMS sent)."""
    sid   = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    if not sid or not token:
        print("⏭️  Twilio: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set")
        return False
    try:
        r = requests.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}.json",
            auth=(sid, token),
            timeout=8,
        )
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Twilio: OK — account: {data.get('friendly_name', sid)} (status: {data.get('status', '?')})")
            return True
        elif r.status_code in (401, 403):
            print(f"❌ Twilio: Invalid credentials (HTTP {r.status_code})")
        else:
            print(f"❌ Twilio: Failed (HTTP {r.status_code})")
        return False
    except Exception as e:
        print(f"❌ Twilio: Error — {e}")
        return False


# ==================== Supabase Env Check ====================

def test_supabase_env():
    """Check Supabase environment variables are present (does NOT test connectivity)."""
    url = SUPABASE_VARS["SUPABASE_URL"]
    key = SUPABASE_VARS["SUPABASE_KEY"]
    db_url = SUPABASE_VARS["SUPABASE_DB_URL"]

    url_ok  = bool(url  and not url.startswith("https://your-project"))
    key_ok  = bool(key  and not key.startswith("your-service"))
    db_ok   = bool(db_url and not db_url.startswith("postgresql://postgres.your"))

    print(f"   {'✅ set' if url_ok  else '❌ missing'}  SUPABASE_URL")
    print(f"   {'✅ set' if key_ok  else '❌ missing'}  SUPABASE_KEY")
    print(f"   {'✅ set' if db_ok   else '❌ missing'}  SUPABASE_DB_URL")

    if url_ok and key_ok:
        print("✅ Supabase: env vars present")
    else:
        print("⏭️  Supabase: not configured (app will use fallback DATABASE_URL)")
    return url_ok and key_ok


# ==================== DB Connection Check ====================

def test_db_connection():
    """
    Verify the active database (Supabase or fallback) is reachable via SQLAlchemy.
    Self-contained — reads env vars directly so it works when the script is run
    standalone (python src/utils/trykey.py) without the src package on sys.path.
    Priority: SUPABASE_DB_URL → DATABASE_URL (fallback).
    Run AFTER AI checks — as the last connectivity check.
    """
    from sqlalchemy import create_engine, text
    import time

    supabase_db_url = SUPABASE_VARS["SUPABASE_DB_URL"]
    fallback_url    = os.getenv("DATABASE_URL", "").strip()

    if supabase_db_url:
        db_url = supabase_db_url
        source = "Supabase PostgreSQL (SUPABASE_DB_URL)"
    elif fallback_url:
        db_url = fallback_url
        source = "Fallback DATABASE_URL"
    else:
        print("❌ Database: no DATABASE_URL or SUPABASE_DB_URL is set")
        return False

    print(f"Connecting to {source}...")
    try:
        engine = create_engine(db_url)
        t0 = time.time()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            row = result.fetchone()
        latency = round((time.time() - t0) * 1000)
        print(f"\n✅ SUCCESS: Connection established!  [{latency} ms]")
        print(f"   Database version: {row[0]}\n")
        engine.dispose()
        return True
    except Exception as e:
        print(f"\n❌ CONNECTION FAILED!")
        print(f"   Error details: {e}\n")
        print("   Troubleshooting checklist:")
        print("   1. Did you change the DB password recently? (Wait 2 min to sync)")
        print("   2. Is port 6543 blocked by your network or VPN?")
        print("   3. Check SUPABASE_DB_URL format: postgresql://postgres.<ref>:<pass>@<host>:6543/postgres")
        return False


# ==================== Run All Tests ====================
# Guarded so this only runs when executed directly:
#   python src/utils/trykey.py
# NOT when the server imports this module.

if __name__ == "__main__":
    print("=" * 50)
    print(" API Key Checker — reading from Replit Secrets / .env")
    print("=" * 50)

    # ── Supabase env vars ─────────────────────────────────
    print("\n🔐 Supabase environment:")
    test_supabase_env()

    # ── AI / service keys present? ────────────────────────
    print("\n📋 AI & service keys found in environment:")
    for name, val in KEYS.items():
        status = "✅ set" if val and val.strip() else "❌ missing"
        print(f"   {status}  {name}")

    # ── Live connectivity tests ───────────────────────────
    testers = {
        # AI providers — priority order matches llm.py chain
        "GitHub Models":             test_github_models,
        "Groq Cloud":                test_groq,
        "NVIDIA Build (NIM)":        test_nvidia,
        "Google AI Studio (Gemini)": test_google_ai_studio,
        "OpenRouter":                test_openrouter,
        "DeepSeek":                  test_deepseek,
        "OpenAI":                    test_openai,
        "Grok (xAI)":               test_grok,
        # Trading / market data
        "Alpaca":                    test_alpaca,
        "CoinGecko":                 test_coingecko,
        # Messaging / notifications
        "Telegram Bot":              test_telegram,
        "SMTP":                      test_smtp,
        "Resend":                    test_resend,
        "Twilio":                    test_twilio,
    }

    print("\n🔍 Testing API connectivity:\n")
    for provider, test_func in testers.items():
        test_func()

    # ── Email send test (SMTP + Resend) ──────────────────
    print("\n📨 Email send test:")
    send_test_email()

    # ── DB connection (runs last) ─────────────────────────
    print("\n🗄️  Testing database connection:\n")
    test_db_connection()

    print("\n" + "=" * 50)
    print(" All checks completed")
    print("=" * 50)
