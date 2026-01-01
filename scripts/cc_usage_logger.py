#!/usr/bin/env python3
import argparse
import json
import os
import re
import sqlite3
import sys
import warnings
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

warnings.filterwarnings(
    "ignore",
    category=DeprecationWarning,
    message=r"Parsing dates involving a day of month without a year specified.*",
)


def parse_used_percent(raw_value):
    if not raw_value:
        return None
    match = re.search(r"(\d{1,3})\s*%", raw_value)
    if not match:
        return None
    return int(match.group(1))


def parse_resets_timestamp(raw_value, reference_dt):
    if not raw_value:
        return (None, None, None, None)

    text = raw_value.strip()
    tz_name = None
    match = re.match(r"^(.*)\s+\(([^)]+)\)\s*$", text)
    if match:
        text = match.group(1).strip()
        tz_name = match.group(2).strip()

    dt = None
    has_date = False
    has_year = False
    for fmt, fmt_has_date, fmt_has_year in (
        ("%b %d, %Y, %I:%M%p", True, True),
        ("%b %d, %Y, %I%p", True, True),
        ("%b %d, %I:%M%p", True, False),
        ("%b %d, %I%p", True, False),
        ("%I:%M%p", False, False),
        ("%I%p", False, False),
    ):
        try:
            dt = datetime.strptime(text, fmt)
            has_date = fmt_has_date
            has_year = fmt_has_year
            break
        except ValueError:
            continue
    if dt is None:
        return (None, None, None, tz_name)

    if not has_date:
        dt = dt.replace(
            year=reference_dt.year,
            month=reference_dt.month,
            day=reference_dt.day,
        )
    elif not has_year:
        dt = dt.replace(year=reference_dt.year)

    if tz_name:
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = None
        if tz:
            dt = dt.replace(tzinfo=tz)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=reference_dt.tzinfo)

    if not has_date and dt < reference_dt:
        dt = dt + timedelta(days=1)
    elif not has_year and dt < reference_dt:
        dt = dt.replace(year=reference_dt.year + 1)

    dt = (dt + timedelta(minutes=30)).replace(minute=0, second=0, microsecond=0)

    dt_utc = dt.astimezone(timezone.utc)
    return (dt.isoformat(), dt_utc.isoformat(), int(dt_utc.timestamp()), tz_name)


def ensure_column(conn, table, column, definition):
    columns = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")



def build_usage_snapshot_key(
    email,
    session_used_pct,
    session_used_raw,
    week_used_pct,
    week_used_raw,
):
    if not email:
        return None

    def normalize(value, raw_value):
        if value is not None:
            return str(value)
        if raw_value:
            return raw_value.strip()
        return ""

    session_key = normalize(session_used_pct, session_used_raw)
    week_key = normalize(week_used_pct, week_used_raw)
    return f"{email}|{session_key}|{week_key}"


def ensure_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS cc_usage_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            captured_at_utc TEXT NOT NULL,
            captured_at_local TEXT NOT NULL,
            email TEXT,
            usage_snapshot_key TEXT,
            current_session_used_pct INTEGER,
            current_session_used_raw TEXT,
            current_session_resets_raw TEXT,
            current_session_resets_local TEXT,
            current_session_resets_utc TEXT,
            current_session_resets_epoch INTEGER,
            current_session_resets_tz TEXT,
            current_week_used_pct INTEGER,
            current_week_used_raw TEXT,
            current_week_resets_raw TEXT,
            current_week_resets_local TEXT,
            current_week_resets_utc TEXT,
            current_week_resets_epoch INTEGER,
            current_week_resets_tz TEXT,
            logfile TEXT,
            raw_json TEXT
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_cc_usage_events_captured_at_utc "
        "ON cc_usage_events(captured_at_utc)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_cc_usage_events_email "
        "ON cc_usage_events(email)"
    )
    ensure_column(conn, "cc_usage_events", "current_session_resets_raw", "TEXT")
    ensure_column(conn, "cc_usage_events", "current_session_resets_local", "TEXT")
    ensure_column(conn, "cc_usage_events", "current_session_resets_utc", "TEXT")
    ensure_column(conn, "cc_usage_events", "current_session_resets_epoch", "INTEGER")
    ensure_column(conn, "cc_usage_events", "current_session_resets_tz", "TEXT")
    ensure_column(conn, "cc_usage_events", "usage_snapshot_key", "TEXT")
    try:
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_usage_events_usage_snapshot ON cc_usage_events(usage_snapshot_key)")
    except sqlite3.IntegrityError:
        pass
    conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Log cc_usage JSON to SQLite.")
    parser.add_argument(
        "--db",
        default=os.environ.get(
            "CC_USAGE_DB_PATH",
            os.path.join(os.path.expanduser("~"), ".claude", "db", "cc_usage.db"),
        ),
        help="SQLite database path",
    )
    parser.add_argument("--input", help="Read JSON from a file path")
    parser.add_argument("--json", help="Read JSON from a literal string")
    parser.add_argument("--verbose", action="store_true", help="Verbose logging")
    args = parser.parse_args()

    payload = None
    if args.json:
        try:
            payload = json.loads(args.json)
        except json.JSONDecodeError as exc:
            print(f"Invalid JSON input: {exc}", file=sys.stderr)
            return 2
    elif args.input:
        try:
            with open(args.input, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError) as exc:
            print(f"Invalid JSON input: {exc}", file=sys.stderr)
            return 2
    else:
        if sys.stdin.isatty():
            print(
                "No JSON input provided. Use stdin, --input, or --json.",
                file=sys.stderr,
            )
            return 2
        data = sys.stdin.read()
        if not data.strip():
            print("Empty JSON input on stdin.", file=sys.stderr)
            return 2
        try:
            payload = json.loads(data)
        except json.JSONDecodeError as exc:
            print(f"Invalid JSON input: {exc}", file=sys.stderr)
            return 2

    now_local = datetime.now().astimezone()
    now_utc = now_local.astimezone(timezone.utc)

    email = payload.get("email")
    logfile = payload.get("logfile")

    current_session_used_raw = (
        payload.get("current_session", {}) or {}
    ).get("used")
    current_session_resets_raw = (
        payload.get("current_session", {}) or {}
    ).get("resets")
    current_week_used_raw = (
        payload.get("current_week_all_models", {}) or {}
    ).get("used")
    current_week_resets_raw = (
        payload.get("current_week_all_models", {}) or {}
    ).get("resets")

    current_session_used_pct = parse_used_percent(current_session_used_raw)
    current_week_used_pct = parse_used_percent(current_week_used_raw)
    (
        current_session_resets_local,
        current_session_resets_utc,
        current_session_resets_epoch,
        current_session_resets_tz,
    ) = parse_resets_timestamp(current_session_resets_raw, now_local)
    (
        current_week_resets_local,
        current_week_resets_utc,
        current_week_resets_epoch,
        current_week_resets_tz,
    ) = parse_resets_timestamp(current_week_resets_raw, now_local)

    usage_snapshot_key = build_usage_snapshot_key(
        email,
        current_session_used_pct,
        current_session_used_raw,
        current_week_used_pct,
        current_week_used_raw,
    )

    raw_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)

    db_dir = os.path.dirname(os.path.abspath(args.db))
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    with sqlite3.connect(args.db) as conn:
        ensure_schema(conn)
        conn.execute(
            """
            INSERT OR IGNORE INTO cc_usage_events (
                captured_at_utc,
                captured_at_local,
                email,
                current_session_used_pct,
                current_session_used_raw,
                current_session_resets_raw,
                current_session_resets_local,
                current_session_resets_utc,
                current_session_resets_epoch,
                current_session_resets_tz,
                current_week_used_pct,
                current_week_used_raw,
                current_week_resets_raw,
                current_week_resets_local,
                current_week_resets_utc,
                current_week_resets_epoch,
                current_week_resets_tz,
                usage_snapshot_key,
                logfile,
                raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now_utc.isoformat(),
                now_local.isoformat(),
                email,
                current_session_used_pct,
                current_session_used_raw,
                current_session_resets_raw,
                current_session_resets_local,
                current_session_resets_utc,
                current_session_resets_epoch,
                current_session_resets_tz,
                current_week_used_pct,
                current_week_used_raw,
                current_week_resets_raw,
                current_week_resets_local,
                current_week_resets_utc,
                current_week_resets_epoch,
                current_week_resets_tz,
                usage_snapshot_key,
                logfile,
                raw_json,
            ),
        )
        conn.commit()

    if args.verbose:
        print(
            f"Logged usage for {email or 'unknown'} at {now_utc.isoformat()}",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
