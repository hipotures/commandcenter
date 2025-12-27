"""
Database schema definitions and migrations
"""
import sqlite3
from typing import Optional


CURRENT_SCHEMA_VERSION = 1


def get_schema_version(conn: sqlite3.Connection) -> int:
    """Get current schema version from database"""
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
        row = cursor.fetchone()
        return row[0] if row else 0
    except sqlite3.OperationalError:
        # Table doesn't exist yet
        return 0


def set_schema_version(conn: sqlite3.Connection, version: int):
    """Set schema version in database"""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO schema_version (version, applied_at)
        VALUES (?, datetime('now'))
    """, (version,))
    conn.commit()


def create_schema_version_table(conn: sqlite3.Connection):
    """Create schema_version table for tracking migrations"""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.commit()


def create_file_tracks_table(conn: sqlite3.Connection):
    """Create file_tracks table"""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS file_tracks (
            file_path TEXT PRIMARY KEY,
            mtime_ns INTEGER NOT NULL,
            size_bytes INTEGER NOT NULL,
            last_scanned TEXT NOT NULL,
            entry_count INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_file_tracks_last_scanned
        ON file_tracks(last_scanned)
    """)
    conn.commit()


def create_message_entries_table(conn: sqlite3.Connection):
    """Create message_entries table"""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS message_entries (
            entry_hash TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            timestamp_local TEXT NOT NULL,
            year INTEGER NOT NULL,
            date TEXT NOT NULL,
            session_id TEXT,
            request_id TEXT,
            message_id TEXT,
            model TEXT,
            cost_usd REAL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            cache_read_tokens INTEGER DEFAULT 0,
            cache_write_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            source_file TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_entries_year
        ON message_entries(year)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_entries_date
        ON message_entries(date)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_entries_session
        ON message_entries(session_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_entries_model
        ON message_entries(model)
    """)
    conn.commit()


def create_hourly_aggregates_table(conn: sqlite3.Connection):
    """Create hourly_aggregates table"""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hourly_aggregates (
            datetime_hour TEXT PRIMARY KEY,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            day INTEGER NOT NULL,
            hour INTEGER NOT NULL,
            date TEXT NOT NULL,
            message_count INTEGER DEFAULT 0,
            session_count INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            total_cost_usd REAL DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_hourly_year
        ON hourly_aggregates(year)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_hourly_date
        ON hourly_aggregates(date)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_hourly_hour
        ON hourly_aggregates(hour)
    """)
    conn.commit()


def create_model_aggregates_table(conn: sqlite3.Connection):
    """Create model_aggregates table"""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS model_aggregates (
            model TEXT NOT NULL,
            year INTEGER NOT NULL,
            total_tokens INTEGER DEFAULT 0,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            cache_read_tokens INTEGER DEFAULT 0,
            cache_write_tokens INTEGER DEFAULT 0,
            message_count INTEGER DEFAULT 0,
            total_cost_usd REAL DEFAULT 0,
            PRIMARY KEY (model, year)
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_model_year
        ON model_aggregates(year)
    """)
    conn.commit()


def init_database(conn: sqlite3.Connection):
    """
    Initialize database schema.

    Creates all tables if they don't exist and runs any pending migrations.
    """
    # Create schema version table first
    create_schema_version_table(conn)

    current_version = get_schema_version(conn)

    if current_version == 0:
        # Fresh database - create all tables
        create_file_tracks_table(conn)
        create_message_entries_table(conn)
        create_hourly_aggregates_table(conn)
        create_model_aggregates_table(conn)
        set_schema_version(conn, CURRENT_SCHEMA_VERSION)
    elif current_version < CURRENT_SCHEMA_VERSION:
        # Run migrations
        run_migrations(conn, current_version, CURRENT_SCHEMA_VERSION)


def run_migrations(conn: sqlite3.Connection, from_version: int, to_version: int):
    """
    Run database migrations from one version to another.

    Args:
        conn: Database connection
        from_version: Current schema version
        to_version: Target schema version
    """
    # Future migrations will go here
    # Example:
    # if from_version < 2 and to_version >= 2:
    #     migrate_to_v2(conn)
    #     set_schema_version(conn, 2)
    pass


def check_integrity(conn: sqlite3.Connection) -> bool:
    """
    Check database integrity.

    Returns:
        True if database is OK, False if corrupted
    """
    cursor = conn.cursor()
    cursor.execute("PRAGMA integrity_check")
    result = cursor.fetchone()
    return result and result[0] == "ok"
