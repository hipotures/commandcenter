"""
Rich-based console output
"""
import sqlite3
from rich.console import Console
from rich.table import Table


def show_db_stats(conn: sqlite3.Connection):
    """
    Display database statistics using Rich tables.

    Args:
        conn: Database connection
    """
    console = Console()
    cursor = conn.cursor()

    # Get counts
    cursor.execute("SELECT COUNT(*) FROM message_entries")
    total_entries = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM file_tracks")
    total_files = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT year) FROM message_entries")
    total_years = cursor.fetchone()[0]

    # Database size
    cursor.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
    db_size = cursor.fetchone()[0]

    # Create table
    table = Table(title="Database Statistics")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="magenta", justify="right")

    table.add_row("Total Entries", f"{total_entries:,}")
    table.add_row("Tracked Files", f"{total_files:,}")
    table.add_row("Years Covered", str(total_years))
    table.add_row("Database Size", f"{db_size / 1024 / 1024:.1f} MB")

    console.print(table)
