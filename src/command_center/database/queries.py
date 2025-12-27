"""
SQL query interface for database operations
"""
import sqlite3
from typing import Optional
from datetime import datetime

from command_center.database.models import MessageEntry, UsageStats
from command_center.config import BATCH_INSERT_SIZE


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
                e.cache_write_tokens, e.total_tokens, e.source_file
            )
            for e in batch
        ]

        cursor.executemany("""
            INSERT OR IGNORE INTO message_entries
            (entry_hash, timestamp, timestamp_local, year, date, session_id,
             request_id, message_id, model, cost_usd, input_tokens, output_tokens,
             cache_read_tokens, cache_write_tokens, total_tokens, source_file)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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


def query_daily_stats(conn: sqlite3.Connection, date_from: str, date_to: str) -> dict[str, int]:
    """
    Query daily statistics from hourly aggregates.

    Args:
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)

    Returns:
        Dict mapping date (YYYY-MM-DD) → message_count
    """
    cursor = conn.cursor()
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
