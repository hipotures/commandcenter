"""
Database connection management
"""
import sqlite3
import os
from contextlib import contextmanager
from typing import Generator

from command_center.config import DB_PATH


def ensure_db_directory():
    """Ensure database directory exists"""
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)


@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """
    Get a database connection with proper configuration.

    Yields:
        sqlite3.Connection with optimized settings

    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM ...")
    """
    ensure_db_directory()

    conn = sqlite3.connect(DB_PATH)

    # Enable WAL mode for better concurrent access
    conn.execute("PRAGMA journal_mode=WAL")

    # Normal synchronous mode (faster, still safe)
    conn.execute("PRAGMA synchronous=NORMAL")

    # Enable foreign keys (if we add them in future)
    conn.execute("PRAGMA foreign_keys=ON")

    try:
        yield conn
    finally:
        conn.close()


def get_db_connection_no_context() -> sqlite3.Connection:
    """
    Get a database connection without context manager.

    Use this only when you need to manage the connection lifetime manually.
    Prefer get_db_connection() context manager when possible.

    Returns:
        sqlite3.Connection with optimized settings
    """
    ensure_db_directory()

    conn = sqlite3.Connection(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")

    return conn
