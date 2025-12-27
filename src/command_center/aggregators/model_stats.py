"""
Model statistics computation
"""
import sqlite3
from typing import List


def get_top_models(conn: sqlite3.Connection, year: int, limit: int = 3) -> List[dict]:
    """
    Get top models by token count for a year.

    Args:
        conn: Database connection
        year: Year to query
        limit: Number of top models to return

    Returns:
        List of dicts with model info: [{model, tokens, messages, cost}, ...]
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT model, total_tokens, message_count, total_cost_usd
        FROM model_aggregates
        WHERE year = ?
        ORDER BY total_tokens DESC
        LIMIT ?
    """, (year, limit))

    return [
        {
            "model": row[0],
            "tokens": row[1],
            "messages": row[2],
            "cost": row[3]
        }
        for row in cursor.fetchall()
    ]
