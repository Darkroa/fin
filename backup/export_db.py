#!/usr/bin/env python3
"""
FinAi — Database Export Script
================================
Exports every table from the live PostgreSQL DB to JSON files in backup/data/.
Run from the project root:
    python backup/export_db.py

The backup/data/ folder is git-ignored (local only).
"""

import json
import os
import sys
from datetime import datetime, date
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("psycopg2 not found — run:  pip install psycopg2-binary")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("DATABASE_URL environment variable not set.")

OUT_DIR = Path(__file__).parent / "data"
OUT_DIR.mkdir(exist_ok=True)

# Tables in safe export order (FK parents first)
TABLES = [
    "users",
    "wallet_config",
    "api_keys",
    "transactions",
    "user_money",
    "trade_logs",
    "notifications",
    "support_tickets",
    "support_messages",
    "subscription_requests",
    "price_alerts",
    "ads",
    "testimonials",
    "bonuses",
    "user_bonus_claims",
    "events",
    "trend_analyses",
    # Additional tables created via startup migrations
    "user_activity_logs",
    "referrals",
    "subscriptions",
]


# Columns that contain credential material and MUST be redacted from any
# export. If a future contributor adds another column (e.g. a new API
# secret), they should add it here so it never ends up on disk in plaintext.
_SENSITIVE_COLUMNS = {
    "hashed_password",
    "transfer_pin",
    "alpaca_api_key",
    "alpaca_secret_key",
    "two_factor_secret",
    "email_verify_code",
    "two_factor_code",
    "password_reset_code",
    "api_secret",  # exchange_connections JSON
}


def _redact_sensitive(table: str, row: dict) -> dict:
    """Replace any known-credential value with 'REDACTED' before writing."""
    out = dict(row)
    for col in list(out.keys()):
        if col in _SENSITIVE_COLUMNS:
            out[col] = "REDACTED"
        elif col == "exchange_connections" and isinstance(out[col], list):
            # Mask api_key/api_secret inside the JSON list.
            masked = []
            for conn in out[col]:
                if isinstance(conn, dict):
                    c = dict(conn)
                    c["api_key"] = "REDACTED"
                    c["api_secret"] = "REDACTED"
                    masked.append(c)
                else:
                    masked.append(conn)
            out[col] = masked
        elif col == "notification_preferences" and isinstance(out[col], dict):
            # Telegram linking codes should never be exported.
            prefs = dict(out[col])
            for k in ("tfa_pending_code", "tfa_code_expires", "telegram_link_code"):
                prefs.pop(k, None)
            out[col] = prefs
    return out


def _serialize(val):
    """Recursively serialize values to JSON-safe types."""
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, dict):
        return {k: _serialize(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_serialize(v) for v in val]
    return val


def export_table(cur, table: str) -> int:
    try:
        cur.execute(f"SELECT * FROM {table}")
    except Exception as e:
        print(f"  ⚠  Skipped {table}: {e}")
        return 0

    cols = [desc[0] for desc in cur.description]
    rows = []
    for row in cur.fetchall():
        serialized = {col: _serialize(val) for col, val in zip(cols, row)}
        rows.append(_redact_sensitive(table, serialized))

    out_path = OUT_DIR / f"{table}.json"
    # Write atomically (tmp + rename) so a partial export can't leave a
    # half-written file in place.
    tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, default=str)
    os.replace(tmp_path, out_path)
    return len(rows)


def main():
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"\n{'='*55}")
    print(f"  FinAi DB Export — {timestamp}")
    print(f"  Output: {OUT_DIR}")
    print(f"{'='*55}")

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    # Single transaction so a connection drop mid-export either succeeds or
    # leaves no files behind. Autocommit=False is the default.
    conn.autocommit = False
    cur = conn.cursor()
    try:
        # REPEATABLE READ so concurrent writes don't change row content
        # mid-export (atomic snapshot for the whole transaction).
        cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
    except Exception as e:
        # If we can't set isolation, fall through — the export still runs.
        print(f"  �  Could not set REPEATABLE READ isolation: {e}")

    total_rows = 0
    for table in TABLES:
        count = export_table(cur, table)
        total_rows += count
        status = f"{count:>6,} rows" if count > 0 else "  (empty)"
        print(f"  ✓  {table:<30} {status}")

    cur.execute("COMMIT")
    cur.close()
    conn.close()

    # Write a manifest
    manifest = {
        "exported_at": timestamp,
        "tables": TABLES,
        "total_rows": total_rows,
    }
    (OUT_DIR / "_manifest.json").write_text(json.dumps(manifest, indent=2))

    print(f"{'='*55}")
    print(f"  Done. {total_rows:,} total rows → backup/data/")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()
