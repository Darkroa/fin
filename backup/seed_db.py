#!/usr/bin/env python3
"""
FinAi — Database Seed / Restore Script
========================================
Reads JSON files from backup/data/ and upserts them into the live DB.
Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING so existing rows
are never overwritten (balances, passwords, etc. stay intact).

Run from the project root:
    python backup/seed_db.py

Options:
    --table users          seed only one table
    --overwrite            UPDATE existing rows instead of skipping them
    --dry-run              print what would happen without touching the DB
"""

import json
import os
import re
import sys
import argparse
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import psycopg2
    import psycopg2.extras
    import psycopg2.extensions
except ImportError:
    sys.exit("psycopg2 not found — run:  pip install psycopg2-binary")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("DATABASE_URL environment variable not set.")

DATA_DIR = Path(__file__).parent / "data"

# Seed order: FK parents before children
SEED_ORDER = [
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


def _parse_pg_array(value: str):
    """
    Convert a PostgreSQL TEXT array literal like ARRAY['read','write']
    or {read,write} into a Python list.
    """
    if not isinstance(value, str):
        return value
    # ARRAY['a', 'b', ...] format
    m = re.match(r"^ARRAY\[(.+)\]$", value.strip(), re.DOTALL)
    if m:
        inner = m.group(1)
        items = [item.strip().strip("'\"") for item in inner.split(",")]
        return [i for i in items if i]
    # {a,b,c} format
    if value.startswith("{") and value.endswith("}"):
        inner = value[1:-1]
        items = [item.strip().strip("'\"") for item in inner.split(",")]
        return [i for i in items if i]
    return value


def coerce_value(val):
    """
    Convert Python dicts/lists to psycopg2.extras.Json so they can be
    inserted into JSONB columns.  Also handles legacy PostgreSQL ARRAY
    string literals from older backup files.
    """
    if isinstance(val, (dict, list)):
        return psycopg2.extras.Json(val)
    if isinstance(val, str):
        parsed = _parse_pg_array(val)
        if isinstance(parsed, list):
            return psycopg2.extras.Json(parsed)
    return val


def load_json(table: str):
    path = DATA_DIR / f"{table}.json"
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_table(cur, table: str, rows: list, overwrite: bool, dry_run: bool) -> tuple[int, int]:
    if not rows:
        return 0, 0

    cols = list(rows[0].keys())
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))

    if overwrite:
        # Upsert: update all non-PK columns on conflict
        non_pk = [c for c in cols if c != "id"]
        update_set = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in non_pk)
        sql = (
            f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) '
            f'ON CONFLICT (id) DO UPDATE SET {update_set}'
        )
    else:
        sql = (
            f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) '
            f'ON CONFLICT DO NOTHING'
        )

    inserted = 0
    skipped = 0
    for row in rows:
        # Coerce each value so dicts/lists → Json, ARRAY strings → Json
        values = [coerce_value(row.get(c)) for c in cols]
        if dry_run:
            inserted += 1
            continue
        try:
            cur.execute(sql, values)
            if cur.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"    ⚠  Row id={row.get('id')} skipped — {e}")
            cur.connection.rollback()
            skipped += 1
        else:
            cur.connection.commit()

    return inserted, skipped


def reset_sequences(cur, tables: list):
    """Sync PK sequences so new inserts don't collide with restored IDs."""
    for table in tables:
        try:
            cur.execute(
                f"SELECT setval(pg_get_serial_sequence('\"{table}\"','id'), "
                f"COALESCE(MAX(id),1)) FROM \"{table}\""
            )
            cur.connection.commit()
        except Exception:
            cur.connection.rollback()


def main():
    parser = argparse.ArgumentParser(description="Seed FinAi DB from backup/data/ JSON files")
    parser.add_argument("--table", help="Seed only this table", default=None)
    parser.add_argument("--overwrite", action="store_true",
                        help="UPDATE existing rows including balances, admin flags, and passwords. "
                             "DESTRUCTIVE — requires --yes-confirm-overwrite to proceed.")
    parser.add_argument("--yes-confirm-overwrite", action="store_true",
                        help="Required acknowledgement for --overwrite. Prevents accidental "
                             "destructive restores.")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true", default=True,
                        help="(default) print what would happen without touching the DB")
    parser.add_argument("--apply", dest="dry_run", action="store_false",
                        help="Actually write changes to the DB")
    parser.add_argument("--dry-run", action="store_true", help="Print counts without writing")
    args = parser.parse_args()

    tables = [args.table] if args.table else SEED_ORDER
    if args.overwrite and not args.yes_confirm_overwrite:
        sys.exit("✗ --overwrite is destructive. Re-run with --yes-confirm-overwrite to proceed.")
    mode = "OVERWRITE (DESTRUCTIVE)" if args.overwrite else ("DRY RUN" if args.dry_run else "APPLY")

    print(f"\n{'='*58}")
    print(f"  FinAi DB Seed  [{mode}]")
    print(f"  Source: {DATA_DIR}")
    print(f"{'='*58}")

    if not DATA_DIR.exists():
        sys.exit(f"  ✗  backup/data/ not found — run export_db.py first")

    manifest_path = DATA_DIR / "_manifest.json"
    if manifest_path.exists():
        m = json.loads(manifest_path.read_text())
        print(f"  Backup from: {m.get('exported_at','?')}  ({m.get('total_rows',0):,} rows)")
        print()

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    seeded_tables = []
    total_in, total_sk = 0, 0

    for table in tables:
        rows = load_json(table)
        if rows is None:
            print(f"  –  {table:<32} (no file)")
            continue
        if not rows:
            print(f"  –  {table:<32} (empty file)")
            continue

        ins, sk = seed_table(cur, table, rows, args.overwrite, args.dry_run)
        total_in += ins
        total_sk += sk
        seeded_tables.append(table)
        tag = "DRY" if args.dry_run else "✓"
        print(f"  {tag}  {table:<32} +{ins:,} inserted, {sk:,} skipped")

    if not args.dry_run and seeded_tables:
        reset_sequences(cur, seeded_tables)
        print(f"\n  ↺  PK sequences reset for {len(seeded_tables)} tables")

    cur.close()
    conn.close()

    print(f"{'='*58}")
    if args.dry_run:
        print(f"  Dry run complete — no changes made")
    else:
        print(f"  Done. {total_in:,} rows inserted, {total_sk:,} skipped")
    print(f"{'='*58}\n")


if __name__ == "__main__":
    main()
