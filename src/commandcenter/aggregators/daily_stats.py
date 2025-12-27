"""
Daily statistics computation
"""
import sqlite3

from commandcenter.database.queries import query_daily_stats


def compute_daily_stats(conn: sqlite3.Connection, year: int) -> dict[str, int]:
    """
    Compute daily statistics for a year.

    Queries hourly_aggregates table and groups by date.

    Args:
        conn: Database connection
        year: Year to query

    Returns:
        Dict mapping date (YYYY-MM-DD) → message_count
    """
    return query_daily_stats(conn, year)
