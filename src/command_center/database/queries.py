"""
SQL query interface for database operations
"""
import sqlite3
from typing import Optional, Literal
from datetime import datetime

from command_center.database.models import MessageEntry, UsageStats, LimitEvent
from command_center.config import BATCH_INSERT_SIZE
from command_center.utils.model_names import format_model_name


def insert_message_entries(conn: sqlite3.Connection, entries: list[MessageEntry]):
    """
    Batch insert message entries into database.

    Uses INSERT OR IGNORE for idempotent operation.
    """
    if not entries:
        return

    cursor = conn.cursor()

    # Process in batches
    for i in range(0, len(entries), BATCH_INSERT_SIZE):
        batch = entries[i:i + BATCH_INSERT_SIZE]

        rows = [
            (
                e.entry_hash, e.timestamp, e.timestamp_local, e.year, e.date,
                e.session_id, e.request_id, e.message_id, e.model, e.cost_usd,
                e.input_tokens, e.output_tokens, e.cache_read_tokens,
                e.cache_write_tokens, e.total_tokens, e.source_file, e.project_id
            )
            for e in batch
        ]

        cursor.executemany("""
            INSERT OR IGNORE INTO message_entries
            (entry_hash, timestamp, timestamp_local, year, date, session_id,
             request_id, message_id, model, cost_usd, input_tokens, output_tokens,
             cache_read_tokens, cache_write_tokens, total_tokens, source_file, project_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)

    conn.commit()


def insert_limit_events(conn: sqlite3.Connection, events: list[LimitEvent]):
    """
    Batch insert limit events into database.

    Uses INSERT OR IGNORE for idempotent operation (deduplication by leaf_uuid).
    """
    if not events:
        return

    cursor = conn.cursor()

    # Process in batches
    for i in range(0, len(events), BATCH_INSERT_SIZE):
        batch = events[i:i + BATCH_INSERT_SIZE]

        rows = [
            (
                e.leaf_uuid, e.limit_type, e.occurred_at, e.occurred_at_local,
                e.year, e.date, e.hour, e.reset_at_local, e.reset_text,
                e.session_id, e.summary_text, e.source_file
            )
            for e in batch
        ]

        cursor.executemany("""
            INSERT OR IGNORE INTO limit_events
            (leaf_uuid, limit_type, occurred_at, occurred_at_local, year, date,
             hour, reset_at_local, reset_text, session_id, summary_text, source_file)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)

    conn.commit()


def update_file_track(conn: sqlite3.Connection, file_path: str, mtime_ns: int,
                      size_bytes: int, entry_count: int):
    """Update file tracking information"""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO file_tracks
        (file_path, mtime_ns, size_bytes, last_scanned, entry_count)
        VALUES (?, ?, ?, datetime('now'), ?)
    """, (file_path, mtime_ns, size_bytes, entry_count))
    conn.commit()


def get_file_tracks(conn: sqlite3.Connection) -> dict[str, tuple[int, int]]:
    """
    Get all tracked files.

    Returns:
        Dict mapping file_path → (mtime_ns, size_bytes)
    """
    cursor = conn.cursor()
    cursor.execute("SELECT file_path, mtime_ns, size_bytes FROM file_tracks")
    return {row[0]: (row[1], row[2]) for row in cursor.fetchall()}


def recompute_hourly_aggregates(conn: sqlite3.Connection, datetime_hours: set[str]):
    """
    Recompute hourly aggregates for specific hours.

    Args:
        datetime_hours: Set of datetime_hour strings (YYYY-MM-DD HH:00:00)
    """
    if not datetime_hours:
        return

    cursor = conn.cursor()

    for datetime_hour in datetime_hours:
        # Delete existing aggregate
        cursor.execute("""
            DELETE FROM hourly_aggregates WHERE datetime_hour = ?
        """, (datetime_hour,))

        # Recompute from message_entries
        # Extract components from datetime_hour parameter
        parts = datetime_hour.split(' ')
        date_part = parts[0]  # YYYY-MM-DD
        hour_part = parts[1][:2]  # HH

        cursor.execute("""
            INSERT INTO hourly_aggregates
            (datetime_hour, year, month, day, hour, date, message_count,
             session_count, total_tokens, total_cost_usd)
            SELECT
                ?,
                year,
                CAST(SUBSTR(?, 6, 2) AS INTEGER) as month,
                CAST(SUBSTR(?, 9, 2) AS INTEGER) as day,
                CAST(? AS INTEGER) as hour,
                ?,
                COUNT(*) as message_count,
                COUNT(DISTINCT session_id) as session_count,
                SUM(total_tokens) as total_tokens,
                SUM(COALESCE(cost_usd, 0)) as total_cost
            FROM message_entries
            WHERE date = ? AND SUBSTR(timestamp_local, 12, 2) = ?
        """, (datetime_hour, datetime_hour, datetime_hour, hour_part, date_part, date_part, hour_part))

    conn.commit()


def recompute_model_aggregates(conn: sqlite3.Connection, year: int):
    """
    Recompute model aggregates for a specific year.
    """
    cursor = conn.cursor()

    # Delete existing aggregates for this year
    cursor.execute("DELETE FROM model_aggregates WHERE year = ?", (year,))

    # Recompute from message_entries
    cursor.execute("""
        INSERT INTO model_aggregates
        (model, year, total_tokens, input_tokens, output_tokens,
         cache_read_tokens, cache_write_tokens, message_count, total_cost_usd)
        SELECT
            model,
            year,
            SUM(total_tokens),
            SUM(input_tokens),
            SUM(output_tokens),
            SUM(cache_read_tokens),
            SUM(cache_write_tokens),
            COUNT(*),
            SUM(COALESCE(cost_usd, 0))
        FROM message_entries
        WHERE year = ? AND model IS NOT NULL
        GROUP BY model, year
    """, (year,))

    conn.commit()


def query_daily_stats(conn: sqlite3.Connection, date_from: str, date_to: str, project_id: Optional[str] = None) -> dict[str, int]:
    """
    Query daily statistics from hourly aggregates.

    Args:
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        project_id: Optional project filter

    Returns:
        Dict mapping date (YYYY-MM-DD) → message_count
    """
    cursor = conn.cursor()

    if project_id:
        # Query from message_entries when filtering by project
        cursor.execute("""
            SELECT date, COUNT(*) as message_count
            FROM message_entries
            WHERE date >= ? AND date <= ? AND project_id = ?
            GROUP BY date
            ORDER BY date
        """, (date_from, date_to, project_id))
    else:
        # Use aggregates for all projects
        cursor.execute("""
            SELECT date, SUM(message_count)
            FROM hourly_aggregates
            WHERE date >= ? AND date <= ?
            GROUP BY date
            ORDER BY date
        """, (date_from, date_to))

    return {row[0]: row[1] for row in cursor.fetchall()}


def query_usage_stats(conn: sqlite3.Connection, date_from: str, date_to: str) -> UsageStats:
    """
    Query all statistics needed for usage report.

    Args:
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)

    Returns:
        UsageStats object with all statistics for the date range
    """
    cursor = conn.cursor()

    # Daily activity
    daily_activity = query_daily_stats(conn, date_from, date_to)

    # Top models (aggregate from message_entries directly for date range)
    cursor.execute("""
        SELECT
            model,
            SUM(total_tokens) as total_tokens,
            COUNT(*) as message_count,
            SUM(COALESCE(cost_usd, 0)) as total_cost
        FROM message_entries
        WHERE date >= ? AND date <= ? AND model IS NOT NULL
        GROUP BY model
        ORDER BY total_tokens DESC
        LIMIT 3
    """, (date_from, date_to))
    top_models = [
        {"model": row[0], "tokens": row[1], "messages": row[2], "cost": row[3]}
        for row in cursor.fetchall()
    ]

    # Totals
    cursor.execute("""
        SELECT
            COUNT(*) as total_messages,
            COUNT(DISTINCT session_id) as total_sessions,
            SUM(total_tokens) as total_tokens,
            SUM(COALESCE(cost_usd, 0)) as total_cost,
            SUM(cache_read_tokens) as cache_read,
            SUM(cache_write_tokens) as cache_write,
            MIN(timestamp) as first_timestamp
        FROM message_entries
        WHERE date >= ? AND date <= ?
    """, (date_from, date_to))
    row = cursor.fetchone()

    first_timestamp = None
    if row[6]:
        try:
            first_timestamp = datetime.fromisoformat(row[6].replace('Z', '+00:00'))
        except:
            pass

    return UsageStats(
        date_from=date_from,
        date_to=date_to,
        daily_activity=daily_activity,
        top_models=top_models,
        total_messages=row[0] or 0,
        total_sessions=row[1] or 0,
        total_tokens=row[2] or 0,
        total_cost=row[3] or 0.0,
        cache_read_tokens=row[4] or 0,
        cache_write_tokens=row[5] or 0,
        first_session_date=first_timestamp
    )


# =============================================================================
# Tauri API query functions
# =============================================================================


def query_timeline_data(
    conn: sqlite3.Connection,
    date_from: str,
    date_to: str,
    granularity: Literal["month", "week", "day", "hour"],
    project_id: Optional[str] = None
) -> list[dict]:
    """
    Query timeline data grouped by month/week/day/hour.

    Args:
        conn: Database connection
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        granularity: Grouping level - 'month', 'week', 'day', or 'hour'
        project_id: Optional project filter

    Returns:
        List of dicts with period, messages, tokens, input_tokens, output_tokens, cost
    """
    cursor = conn.cursor()

    if granularity == "month":
        group_expr_agg = "SUBSTR(date, 1, 7)"  # YYYY-MM
        group_expr_msg = "SUBSTR(date, 1, 7)"
    elif granularity == "week":
        group_expr_agg = "STRFTIME('%Y-W%W', date)"
        group_expr_msg = "STRFTIME('%Y-W%W', date)"
    elif granularity == "hour":
        group_expr_agg = "date || ' ' || PRINTF('%02d', hour)"  # YYYY-MM-DD HH
        group_expr_msg = "date || ' ' || STRFTIME('%H', timestamp_local)"  # Extract hour from timestamp
    else:  # day
        group_expr_agg = "date"
        group_expr_msg = "date"

    if project_id:
        # Query from message_entries when filtering by project
        cursor.execute(f"""
            SELECT
                {group_expr_msg} as period,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE date >= ? AND date <= ? AND project_id = ?
            GROUP BY period
            ORDER BY period
        """, (date_from, date_to, project_id))
    else:
        # Use aggregates for all projects
        cursor.execute(f"""
            SELECT
                {group_expr_agg} as period,
                SUM(message_count) as messages,
                SUM(total_tokens) as tokens,
                SUM(total_cost_usd) as cost
            FROM hourly_aggregates
            WHERE date >= ? AND date <= ?
            GROUP BY period
            ORDER BY period
        """, (date_from, date_to))

    # Need input/output breakdown from message_entries
    # First get the basic aggregates
    basic_data = {row[0]: {"messages": row[1], "tokens": row[2], "cost": row[3]}
                  for row in cursor.fetchall()}

    # Now get input/output breakdown
    if project_id:
        cursor.execute(f"""
            SELECT
                {group_expr_msg} as period,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens
            FROM message_entries
            WHERE date >= ? AND date <= ? AND project_id = ?
            GROUP BY period
        """, (date_from, date_to, project_id))
    else:
        cursor.execute(f"""
            SELECT
                {group_expr_msg} as period,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens
            FROM message_entries
            WHERE date >= ? AND date <= ?
            GROUP BY period
        """, (date_from, date_to))

    token_breakdown = {row[0]: {"input_tokens": row[1] or 0, "output_tokens": row[2] or 0}
                       for row in cursor.fetchall()}

    result = []
    for period in sorted(basic_data.keys()):
        data = basic_data[period]
        breakdown = token_breakdown.get(period, {"input_tokens": 0, "output_tokens": 0})
        result.append({
            "period": period,
            "messages": data["messages"] or 0,
            "tokens": data["tokens"] or 0,
            "input_tokens": breakdown["input_tokens"],
            "output_tokens": breakdown["output_tokens"],
            "cost": round(data["cost"] or 0, 4)
        })

    return result


def query_model_distribution(
    conn: sqlite3.Connection,
    date_from: str,
    date_to: str,
    project_id: Optional[str] = None
) -> list[dict]:
    """
    Query model distribution with input/output breakdown.

    Args:
        conn: Database connection
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        project_id: Optional project filter

    Returns:
        List of dicts with model stats, sorted by tokens descending
    """
    cursor = conn.cursor()

    if project_id:
        cursor.execute("""
            SELECT
                model,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                COUNT(*) as messages,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE date >= ? AND date <= ? AND project_id = ? AND model IS NOT NULL
            GROUP BY model
            ORDER BY tokens DESC
        """, (date_from, date_to, project_id))
    else:
        cursor.execute("""
            SELECT
                model,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                COUNT(*) as messages,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE date >= ? AND date <= ? AND model IS NOT NULL
            GROUP BY model
            ORDER BY tokens DESC
        """, (date_from, date_to))

    rows = cursor.fetchall()
    total_tokens = sum(r[1] or 0 for r in rows) or 1  # Avoid division by zero

    return [
        {
            "model": row[0],
            "display_name": format_model_name(row[0]),
            "tokens": row[1] or 0,
            "input_tokens": row[2] or 0,
            "output_tokens": row[3] or 0,
            "messages": row[4] or 0,
            "cost": round(row[5] or 0, 4),
            "percent": round((row[1] or 0) / total_tokens * 100, 1)
        }
        for row in rows
    ]


def query_hourly_profile(
    conn: sqlite3.Connection,
    date_from: str,
    date_to: str,
    project_id: Optional[str] = None
) -> list[dict]:
    """
    Query hourly activity profile (0-23).

    Args:
        conn: Database connection
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        project_id: Optional project filter

    Returns:
        List of 24 dicts (one per hour) with hour, messages, tokens, input_tokens, output_tokens
    """
    cursor = conn.cursor()

    if project_id:
        # Get basic hourly stats from message_entries when filtering by project
        cursor.execute("""
            SELECT
                CAST(SUBSTR(timestamp_local, 12, 2) AS INTEGER) as hour,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens
            FROM message_entries
            WHERE date >= ? AND date <= ? AND project_id = ?
            GROUP BY hour
            ORDER BY hour
        """, (date_from, date_to, project_id))
    else:
        # Get basic hourly stats from aggregates
        cursor.execute("""
            SELECT
                hour,
                SUM(message_count) as messages,
                SUM(total_tokens) as tokens
            FROM hourly_aggregates
            WHERE date >= ? AND date <= ?
            GROUP BY hour
            ORDER BY hour
        """, (date_from, date_to))

    hourly_basic = {row[0]: {"messages": row[1] or 0, "tokens": row[2] or 0}
                    for row in cursor.fetchall()}

    # Get input/output breakdown from message_entries
    if project_id:
        cursor.execute("""
            SELECT
                CAST(SUBSTR(timestamp_local, 12, 2) AS INTEGER) as hour,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens
            FROM message_entries
            WHERE date >= ? AND date <= ? AND project_id = ?
            GROUP BY hour
        """, (date_from, date_to, project_id))
    else:
        cursor.execute("""
            SELECT
                CAST(SUBSTR(timestamp_local, 12, 2) AS INTEGER) as hour,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens
            FROM message_entries
            WHERE date >= ? AND date <= ?
            GROUP BY hour
        """, (date_from, date_to))

    hourly_breakdown = {row[0]: {"input_tokens": row[1] or 0, "output_tokens": row[2] or 0}
                        for row in cursor.fetchall()}

    # Fill in all 24 hours
    result = []
    for h in range(24):
        basic = hourly_basic.get(h, {"messages": 0, "tokens": 0})
        breakdown = hourly_breakdown.get(h, {"input_tokens": 0, "output_tokens": 0})
        result.append({
            "hour": h,
            "messages": basic["messages"],
            "tokens": basic["tokens"],
            "input_tokens": breakdown["input_tokens"],
            "output_tokens": breakdown["output_tokens"]
        })

    return result


def query_recent_sessions(
    conn: sqlite3.Connection,
    date_from: str,
    date_to: str,
    limit: int = 20,
    project_id: Optional[str] = None
) -> list[dict]:
    """
    Query recent sessions with aggregated stats.

    Args:
        conn: Database connection
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        limit: Maximum number of sessions to return
        project_id: Optional project filter

    Returns:
        List of session dicts, sorted by last_time descending
    """
    cursor = conn.cursor()

    if project_id:
        cursor.execute("""
            SELECT
                session_id,
                model,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as cost,
                MIN(timestamp_local) as first_time,
                MAX(timestamp_local) as last_time
            FROM message_entries
            WHERE date >= ? AND date <= ? AND project_id = ? AND session_id IS NOT NULL
            GROUP BY session_id
            ORDER BY last_time DESC
            LIMIT ?
        """, (date_from, date_to, project_id, limit))
    else:
        cursor.execute("""
            SELECT
                session_id,
                model,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as cost,
                MIN(timestamp_local) as first_time,
                MAX(timestamp_local) as last_time
            FROM message_entries
            WHERE date >= ? AND date <= ? AND session_id IS NOT NULL
            GROUP BY session_id
            ORDER BY last_time DESC
            LIMIT ?
        """, (date_from, date_to, limit))

    return [
        {
            "session_id": row[0],
            "model": row[1],
            "display_name": format_model_name(row[1]) if row[1] else "Unknown",
            "messages": row[2] or 0,
            "tokens": row[3] or 0,
            "input_tokens": row[4] or 0,
            "output_tokens": row[5] or 0,
            "cost": round(row[6] or 0, 4),
            "first_time": row[7],
            "last_time": row[8]
        }
        for row in cursor.fetchall()
    ]


def query_totals(
    conn: sqlite3.Connection,
    date_from: str,
    date_to: str,
    project_id: Optional[str] = None
) -> dict:
    """
    Query total statistics for a date range.

    Args:
        conn: Database connection
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        project_id: Optional project filter

    Returns:
        Dict with all totals including token breakdowns
    """
    cursor = conn.cursor()

    if project_id:
        cursor.execute("""
            SELECT
                COUNT(*) as total_messages,
                COUNT(DISTINCT session_id) as total_sessions,
                SUM(total_tokens) as total_tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as total_cost,
                SUM(cache_read_tokens) as cache_read,
                SUM(cache_write_tokens) as cache_write,
                MIN(timestamp_local) as first_timestamp
            FROM message_entries
            WHERE date >= ? AND date <= ? AND project_id = ?
        """, (date_from, date_to, project_id))
    else:
        cursor.execute("""
            SELECT
                COUNT(*) as total_messages,
                COUNT(DISTINCT session_id) as total_sessions,
                SUM(total_tokens) as total_tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as total_cost,
                SUM(cache_read_tokens) as cache_read,
                SUM(cache_write_tokens) as cache_write,
                MIN(timestamp_local) as first_timestamp
            FROM message_entries
            WHERE date >= ? AND date <= ?
        """, (date_from, date_to))
    row = cursor.fetchone()

    # Parse first timestamp
    first_session_date = None
    if row[8]:
        first_session_date = row[8]

    return {
        "messages": row[0] or 0,
        "sessions": row[1] or 0,
        "tokens": row[2] or 0,
        "input_tokens": row[3] or 0,
        "output_tokens": row[4] or 0,
        "cost": round(row[5] or 0, 4),
        "cache_read": row[6] or 0,
        "cache_write": row[7] or 0,
        "first_session_date": first_session_date
    }


def query_day_details(conn: sqlite3.Connection, date: str, project_id: Optional[str] = None) -> dict:
    """
    Get detailed stats for a specific day.

    Args:
        conn: Database connection
        date: Date (YYYY-MM-DD)
        project_id: Optional project filter

    Returns:
        Dict with hourly breakdown, models, and sessions for the day
    """
    cursor = conn.cursor()

    # Hourly breakdown for this day
    if project_id:
        cursor.execute("""
            SELECT
                CAST(SUBSTR(timestamp_local, 12, 2) AS INTEGER) as hour,
                COUNT(*) as message_count,
                SUM(total_tokens) as total_tokens,
                SUM(COALESCE(cost_usd, 0)) as total_cost_usd
            FROM message_entries
            WHERE date = ? AND project_id = ?
            GROUP BY hour
            ORDER BY hour
        """, (date, project_id))
    else:
        cursor.execute("""
            SELECT hour, message_count, total_tokens, total_cost_usd
            FROM hourly_aggregates
            WHERE date = ?
            ORDER BY hour
        """, (date,))
    hourly = [
        {"hour": r[0], "messages": r[1] or 0, "tokens": r[2] or 0, "cost": round(r[3] or 0, 4)}
        for r in cursor.fetchall()
    ]

    # Model breakdown for this day
    if project_id:
        cursor.execute("""
            SELECT
                model,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE date = ? AND project_id = ? AND model IS NOT NULL
            GROUP BY model
            ORDER BY tokens DESC
        """, (date, project_id))
    else:
        cursor.execute("""
            SELECT
                model,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE date = ? AND model IS NOT NULL
            GROUP BY model
            ORDER BY tokens DESC
        """, (date,))
    models = [
        {
            "model": r[0],
            "display_name": format_model_name(r[0]),
            "messages": r[1] or 0,
            "tokens": r[2] or 0,
            "input_tokens": r[3] or 0,
            "output_tokens": r[4] or 0,
            "cost": round(r[5] or 0, 4)
        }
        for r in cursor.fetchall()
    ]

    # Sessions for this day
    if project_id:
        cursor.execute("""
            SELECT
                session_id, model,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as cost,
                MIN(timestamp_local) as first_time,
                MAX(timestamp_local) as last_time
            FROM message_entries
            WHERE date = ? AND project_id = ? AND session_id IS NOT NULL
            GROUP BY session_id
            ORDER BY first_time
        """, (date, project_id))
    else:
        cursor.execute("""
            SELECT
                session_id, model,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as cost,
                MIN(timestamp_local) as first_time,
                MAX(timestamp_local) as last_time
            FROM message_entries
            WHERE date = ? AND session_id IS NOT NULL
            GROUP BY session_id
            ORDER BY first_time
        """, (date,))
    sessions = [
        {
            "session_id": r[0],
            "model": r[1],
            "display_name": format_model_name(r[1]) if r[1] else "Unknown",
            "messages": r[2] or 0,
            "tokens": r[3] or 0,
            "input_tokens": r[4] or 0,
            "output_tokens": r[5] or 0,
            "cost": round(r[6] or 0, 4),
            "first_time": r[7],
            "last_time": r[8]
        }
        for r in cursor.fetchall()
    ]

    # Day totals
    if project_id:
        cursor.execute("""
            SELECT
                COUNT(*) as messages,
                COUNT(DISTINCT session_id) as sessions,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE date = ? AND project_id = ?
        """, (date, project_id))
    else:
        cursor.execute("""
            SELECT
                COUNT(*) as messages,
                COUNT(DISTINCT session_id) as sessions,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE date = ?
        """, (date,))
    totals_row = cursor.fetchone()

    return {
        "date": date,
        "totals": {
            "messages": totals_row[0] or 0,
            "sessions": totals_row[1] or 0,
            "tokens": totals_row[2] or 0,
            "input_tokens": totals_row[3] or 0,
            "output_tokens": totals_row[4] or 0,
            "cost": round(totals_row[5] or 0, 4)
        },
        "hourly": hourly,
        "models": models,
        "sessions": sessions
    }


def query_model_details(
    conn: sqlite3.Connection,
    model: str,
    date_from: str,
    date_to: str,
    project_id: Optional[str] = None
) -> dict:
    """
    Get detailed stats for a specific model.

    Args:
        conn: Database connection
        model: Model identifier
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        project_id: Optional project filter

    Returns:
        Dict with model totals, daily activity, and top sessions
    """
    cursor = conn.cursor()

    # Daily activity for this model
    if project_id:
        cursor.execute("""
            SELECT date, COUNT(*) as messages, SUM(total_tokens) as tokens
            FROM message_entries
            WHERE model = ? AND date >= ? AND date <= ? AND project_id = ?
            GROUP BY date
            ORDER BY date
        """, (model, date_from, date_to, project_id))
    else:
        cursor.execute("""
            SELECT date, COUNT(*) as messages, SUM(total_tokens) as tokens
            FROM message_entries
            WHERE model = ? AND date >= ? AND date <= ?
            GROUP BY date
            ORDER BY date
        """, (model, date_from, date_to))
    daily_activity = {
        r[0]: {"messages": r[1] or 0, "tokens": r[2] or 0}
        for r in cursor.fetchall()
    }

    # Totals for this model
    if project_id:
        cursor.execute("""
            SELECT
                COUNT(*) as messages,
                COUNT(DISTINCT session_id) as sessions,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(cache_read_tokens) as cache_read,
                SUM(cache_write_tokens) as cache_write,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE model = ? AND date >= ? AND date <= ? AND project_id = ?
        """, (model, date_from, date_to, project_id))
    else:
        cursor.execute("""
            SELECT
                COUNT(*) as messages,
                COUNT(DISTINCT session_id) as sessions,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(cache_read_tokens) as cache_read,
                SUM(cache_write_tokens) as cache_write,
                SUM(COALESCE(cost_usd, 0)) as cost
            FROM message_entries
            WHERE model = ? AND date >= ? AND date <= ?
        """, (model, date_from, date_to))
    row = cursor.fetchone()

    # Top sessions for this model
    if project_id:
        cursor.execute("""
            SELECT
                session_id,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(COALESCE(cost_usd, 0)) as cost,
                MIN(timestamp_local) as first_time,
                MAX(timestamp_local) as last_time
            FROM message_entries
            WHERE model = ? AND date >= ? AND date <= ? AND project_id = ? AND session_id IS NOT NULL
            GROUP BY session_id
            ORDER BY tokens DESC
            LIMIT 10
        """, (model, date_from, date_to, project_id))
    else:
        cursor.execute("""
            SELECT
                session_id,
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(COALESCE(cost_usd, 0)) as cost,
                MIN(timestamp_local) as first_time,
                MAX(timestamp_local) as last_time
            FROM message_entries
            WHERE model = ? AND date >= ? AND date <= ? AND session_id IS NOT NULL
            GROUP BY session_id
            ORDER BY tokens DESC
            LIMIT 10
        """, (model, date_from, date_to))
    sessions = [
        {
            "session_id": r[0],
            "messages": r[1] or 0,
            "tokens": r[2] or 0,
            "cost": round(r[3] or 0, 4),
            "first_time": r[4],
            "last_time": r[5]
        }
        for r in cursor.fetchall()
    ]

    return {
        "model": model,
        "display_name": format_model_name(model),
        "range": {"from": date_from, "to": date_to},
        "totals": {
            "messages": row[0] or 0,
            "sessions": row[1] or 0,
            "tokens": row[2] or 0,
            "input_tokens": row[3] or 0,
            "output_tokens": row[4] or 0,
            "cache_read": row[5] or 0,
            "cache_write": row[6] or 0,
            "cost": round(row[7] or 0, 4)
        },
        "daily_activity": daily_activity,
        "sessions": sessions
    }


def query_session_details(conn: sqlite3.Connection, session_id: str, project_id: Optional[str] = None) -> dict:
    """
    Get detailed stats for a specific session.

    Args:
        conn: Database connection
        session_id: Session identifier
        project_id: Optional project filter (not typically used for sessions, but for consistency)

    Returns:
        Dict with session totals, messages, and metadata
    """
    cursor = conn.cursor()

    # Session messages
    if project_id:
        cursor.execute("""
            SELECT
                timestamp_local, model, input_tokens, output_tokens,
                cache_read_tokens, cache_write_tokens, cost_usd
            FROM message_entries
            WHERE session_id = ? AND project_id = ?
            ORDER BY timestamp_local
        """, (session_id, project_id))
    else:
        cursor.execute("""
            SELECT
                timestamp_local, model, input_tokens, output_tokens,
                cache_read_tokens, cache_write_tokens, cost_usd
            FROM message_entries
            WHERE session_id = ?
            ORDER BY timestamp_local
        """, (session_id,))
    messages = [
        {
            "timestamp": r[0],
            "model": r[1],
            "display_name": format_model_name(r[1]) if r[1] else "Unknown",
            "input_tokens": r[2] or 0,
            "output_tokens": r[3] or 0,
            "cache_read": r[4] or 0,
            "cache_write": r[5] or 0,
            "cost": round(r[6] or 0, 6) if r[6] else 0
        }
        for r in cursor.fetchall()
    ]

    # Session totals
    if project_id:
        cursor.execute("""
            SELECT
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(cache_read_tokens) as cache_read,
                SUM(cache_write_tokens) as cache_write,
                SUM(COALESCE(cost_usd, 0)) as cost,
                MIN(timestamp_local) as first_time,
                MAX(timestamp_local) as last_time,
                MIN(date) as date
            FROM message_entries
            WHERE session_id = ? AND project_id = ?
        """, (session_id, project_id))
    else:
        cursor.execute("""
            SELECT
                COUNT(*) as messages,
                SUM(total_tokens) as tokens,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(cache_read_tokens) as cache_read,
                SUM(cache_write_tokens) as cache_write,
                SUM(COALESCE(cost_usd, 0)) as cost,
                MIN(timestamp_local) as first_time,
                MAX(timestamp_local) as last_time,
                MIN(date) as date
            FROM message_entries
            WHERE session_id = ?
        """, (session_id,))
    row = cursor.fetchone()

    # Determine primary model (most used)
    if project_id:
        cursor.execute("""
            SELECT model, COUNT(*) as cnt
            FROM message_entries
            WHERE session_id = ? AND project_id = ? AND model IS NOT NULL
            GROUP BY model
            ORDER BY cnt DESC
            LIMIT 1
        """, (session_id, project_id))
    else:
        cursor.execute("""
            SELECT model, COUNT(*) as cnt
            FROM message_entries
            WHERE session_id = ? AND model IS NOT NULL
            GROUP BY model
            ORDER BY cnt DESC
            LIMIT 1
        """, (session_id,))
    model_row = cursor.fetchone()
    primary_model = model_row[0] if model_row else None

    return {
        "session_id": session_id,
        "model": primary_model,
        "display_name": format_model_name(primary_model) if primary_model else "Unknown",
        "date": row[9],
        "first_time": row[7],
        "last_time": row[8],
        "totals": {
            "messages": row[0] or 0,
            "tokens": row[1] or 0,
            "input_tokens": row[2] or 0,
            "output_tokens": row[3] or 0,
            "cache_read": row[4] or 0,
            "cache_write": row[5] or 0,
            "cost": round(row[6] or 0, 4)
        },
        "messages": messages
    }


def get_limit_events(conn: sqlite3.Connection, date_from: str, date_to: str) -> list[dict]:
    """
    Get limit reset events for a date range.
    
    Args:
        conn: Database connection
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
    
    Returns:
        List of dicts with limit event data
    """
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            limit_type,
            reset_at_local,
            reset_text,
            summary_text,
            year,
            date
        FROM limit_events
        WHERE date >= ? AND date <= ?
        ORDER BY reset_at_local
    """, (date_from, date_to))
    
    events = []
    for row in cursor.fetchall():
        events.append({
            "limit_type": row[0],
            "reset_at": row[1],  # ISO timestamp kiedy następuje reset
            "reset_text": row[2],
            "summary": row[3],
            "year": row[4],
            "date": row[5]
        })
    
    return events
