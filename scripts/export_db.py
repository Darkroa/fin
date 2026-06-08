#!/usr/bin/env python3
"""
export_db.py — Export all PostgreSQL database tables to JSON files in data/
Usage: python scripts/export_db.py
"""
import os, sys, json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from psycopg2.extras import RealDictCursor

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

TABLES = [
    "users",
    "api_keys",
    "transactions",
    "wallet_configs",
    "support_tickets",
    "support_messages",
    "notifications",
    "events",
    "trend_analyses",
    "trade_logs",
    "user_activity_logs",
    "bonuses",
    "ads",
]

def export_table(cur, table: str) -> list:
    try:
        cur.execute(f"SELECT * FROM {table}")
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"  ⚠ Skipping {table}: {e}")
        return []

def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Discover all actual tables
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    actual_tables = [r["table_name"] for r in cur.fetchall()]
    print(f"Found tables: {actual_tables}")

    exported = {}
    for table in actual_tables:
        rows = export_table(cur, table)
        out_file = DATA_DIR / f"{table}.json"
        with open(out_file, "w") as f:
            json.dump(rows, f, indent=2, default=str)
        print(f"  ✓ {table}: {len(rows)} rows → {out_file}")
        exported[table] = len(rows)

    cur.close()
    conn.close()

    # Write manifest
    manifest_file = DATA_DIR / "_manifest.json"
    with open(manifest_file, "w") as f:
        json.dump({"tables": exported}, f, indent=2)
    print(f"\n✅ Export complete. {sum(exported.values())} total rows across {len(exported)} tables.")
    print(f"   Manifest: {manifest_file}")

if __name__ == "__main__":
    main()
