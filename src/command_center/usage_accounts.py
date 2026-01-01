"""
Read latest cc_usage_events per account from the cc_usage SQLite database.
"""
from __future__ import annotations

import os
import re
import sqlite3
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo


DEFAULT_CC_USAGE_DB_PATH = os.path.join(
    os.path.expanduser("~"),
    ".claude",
    "db",
    "cc_usage.db",
)


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    return cursor.fetchone() is not None


def _get_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}


def _round_to_nearest_hour(value: datetime) -> datetime:
    return (value + timedelta(minutes=30)).replace(minute=0, second=0, microsecond=0)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _parse_resets_raw(
    raw_value: str | None,
    reference: datetime | None = None,
) -> str | None:
    if not raw_value:
        return None

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
        return None

    reference_dt = reference or datetime.now().astimezone()
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

    dt = _round_to_nearest_hour(dt)

    return dt.astimezone().isoformat()


def _get_candidate_paths() -> list[str]:
    env_path = os.environ.get("CC_USAGE_DB_PATH")
    if env_path:
        return [os.path.expanduser(env_path)]

    home = os.path.expanduser("~")
    return [
        os.path.join(home, ".claude", "db", "cc_usage.db"),
        os.path.join(home, ".config", "claude", "db", "cc_usage.db"),
        os.path.join(home, ".claude", "db", "command_center.db"),
        os.path.join(home, ".config", "claude", "db", "command_center.db"),
    ]


def _fetch_latest_from_path(db_path: str) -> list[dict[str, Any]]:
    """
    Return the latest usage row per email from cc_usage_events.

    Args:
        db_path: Path to cc_usage SQLite DB.

    Returns:
        List of dicts keyed by email with latest usage fields.
    """
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row

            if not _table_exists(conn, "cc_usage_events"):
                return []

            columns = _get_columns(conn, "cc_usage_events")

            def select_column(name: str) -> str:
                return name if name in columns else f"NULL AS {name}"

            rows = conn.execute(
                f"""
                SELECT
                    id,
                    email,
                    captured_at_local,
                    {select_column("current_session_used_pct")},
                    {select_column("current_session_used_raw")},
                    {select_column("current_session_resets_local")},
                    {select_column("current_session_resets_raw")},
                    {select_column("current_week_used_pct")},
                    {select_column("current_week_used_raw")},
                    {select_column("current_week_resets_local")},
                    {select_column("current_week_resets_raw")}
                FROM cc_usage_events
                WHERE email IS NOT NULL AND email != ''
                AND id IN (
                    SELECT MAX(id)
                    FROM cc_usage_events
                    WHERE email IS NOT NULL AND email != ''
                    GROUP BY email
                )
                ORDER BY email
                """
            ).fetchall()

            accounts: list[dict[str, Any]] = []
            for row in rows:
                captured_at = _parse_iso(row["captured_at_local"])
                week_resets_local = row["current_week_resets_local"]
                if not week_resets_local:
                    week_resets_local = _parse_resets_raw(
                        row["current_week_resets_raw"],
                        captured_at,
                    )
                session_resets_local = row["current_session_resets_local"]
                if not session_resets_local:
                    session_resets_local = _parse_resets_raw(
                        row["current_session_resets_raw"],
                        captured_at,
                    )
                accounts.append(
                    {
                        "email": row["email"],
                        "captured_at_local": row["captured_at_local"],
                        "current_session_used_pct": row["current_session_used_pct"],
                        "current_session_used_raw": row["current_session_used_raw"],
                        "current_session_resets_local": session_resets_local,
                        "current_session_resets_raw": row["current_session_resets_raw"],
                        "current_week_used_pct": row["current_week_used_pct"],
                        "current_week_used_raw": row["current_week_used_raw"],
                        "current_week_resets_local": week_resets_local,
                        "current_week_resets_raw": row["current_week_resets_raw"],
                    }
                )
            return accounts
    except sqlite3.Error:
        return []


def fetch_latest_usage_accounts(
    db_path: str | None = None,
) -> list[dict[str, Any]]:
    """
    Return the latest usage row per email from cc_usage_events.

    Args:
        db_path: Optional explicit path to cc_usage SQLite DB.

    Returns:
        List of dicts keyed by email with latest usage fields.
    """
    candidate_paths = [db_path] if db_path else _get_candidate_paths()
    accounts_by_email: dict[str, dict[str, Any]] = {}

    for path in candidate_paths:
        if not path or not os.path.exists(path):
            continue
        for account in _fetch_latest_from_path(path):
            email = account.get("email")
            if not email:
                continue
            existing = accounts_by_email.get(email)
            if not existing:
                accounts_by_email[email] = account
                continue
            existing_ts = _parse_iso(existing.get("captured_at_local"))
            incoming_ts = _parse_iso(account.get("captured_at_local"))
            if incoming_ts and (not existing_ts or incoming_ts > existing_ts):
                accounts_by_email[email] = account

    return sorted(accounts_by_email.values(), key=lambda item: item.get("email", ""))
