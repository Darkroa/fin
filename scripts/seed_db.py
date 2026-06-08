#!/usr/bin/env python3
"""
seed_db.py — Seed PostgreSQL database from JSON files in data/
Usage: python scripts/seed_db.py [--tables table1,table2] [--truncate]

IMPORTANT: This does NOT wipe existing data by default.
Use --truncate to clear tables before inserting (skips users table by default for safety).
"""
import os, sys, json, argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from psycopg2.extras import execute_values

DATA_DIR = Path(__file__).parent.parent / "data"

# Tables that should never be truncated (safety guard)
SAFE_READONLY = {"users"}

# Table insert order (respects FK constraints)
INSERT_ORDER = [
    "users",
    "api_keys",
    "wallet_configs",
    "notifications",
    "events",
    "trend_analyses",
    "bonuses",
    "ads",
    "transactions",
    "support_tickets",
    "support_messages",
    "trade_logs",
    "user_activity_logs",
]

def get_columns(cur, table: str) -> list:
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table,))
    return [r[0] for r in cur.fetchall()]

def seed_table(cur, table: str, rows: list, truncate: bool) -> int:
    if not rows:
        print(f"  · {table}: no data to seed")
        return 0

    live_cols = get_columns(cur, table)
    if not live_cols:
        print(f"  ⚠ {table}: table not found in DB — skipping")
        return 0

    if truncate and table not in SAFE_READONLY:
        cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
        print(f"  🗑 {table}: truncated")

    # Filter rows to only columns that exist in current schema
    filtered = []
    for row in rows:
        filtered.append({k: v for k, v in row.items() if k in live_cols})

    if not filtered:
        return 0

    cols = list(filtered[0].keys())
    values = [[r.get(c) for c in cols] for r in filtered]

    placeholders = "(" + ", ".join(["%s"] * len(cols)) + ")"
    col_str = ", ".join(f'"{c}"' for c in cols)
    sql = f'INSERT INTO {table} ({col_str}) VALUES {placeholders} ON CONFLICT DO NOTHING'

    inserted = 0
    for val in values:
        try:
            cur.execute(sql, val)
            inserted += 1
        except Exception as e:
            print(f"  ⚠ Row skip in {table}: {e}")
    return inserted

def main():
    parser = argparse.ArgumentParser(description="Seed DB from JSON exports in data/")
    parser.add_argument("--tables", type=str, help="Comma-separated list of tables to seed (default: all)")
    parser.add_argument("--truncate", action="store_true", help="Truncate tables before inserting (skip users for safety)")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    manifest_file = DATA_DIR / "_manifest.json"
    if not manifest_file.exists():
        print("ERROR: data/_manifest.json not found. Run export_db.py first.")
        sys.exit(1)

    with open(manifest_file) as f:
        manifest = json.load(f)

    available_tables = list(manifest.get("tables", {}).keys())
    if args.tables:
        tables_to_seed = [t.strip() for t in args.tables.split(",") if t.strip() in available_tables]
    else:
        # Use INSERT_ORDER for those that exist, then append any remaining
        ordered = [t for t in INSERT_ORDER if t in available_tables]
        rest    = [t for t in available_tables if t not in ordered]
        tables_to_seed = ordered + rest

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    total_rows = 0
    for table in tables_to_seed:
        json_file = DATA_DIR / f"{table}.json"
        if not json_file.exists():
            print(f"  · {table}: no JSON file found")
            continue
        with open(json_file) as f:
            rows = json.load(f)
        try:
            inserted = seed_table(cur, table, rows, truncate=args.truncate)
            conn.commit()
            print(f"  ✓ {table}: {inserted}/{len(rows)} rows inserted")
            total_rows += inserted
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {table}: FAILED — {e}")

    cur.close()
    conn.close()
    print(f"\n✅ Seeding complete. {total_rows} rows inserted.")

if __name__ == "__main__":
    main()
