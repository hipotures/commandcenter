"""
Claude Code Wrapped - Main entry point

Modern SQLite-based analytics with intelligent caching.
"""
import argparse
import sys
from datetime import datetime
from rich.console import Console

from commandcenter.database.connection import get_db_connection
from commandcenter.database.schema import init_database, check_integrity
from commandcenter.database.queries import query_wrapped_stats
from commandcenter.cache.incremental_update import perform_incremental_update
from commandcenter.visualization.png_generator import generate_wrapped_png
from commandcenter.visualization.terminal_display import display_png_in_terminal
from commandcenter.utils.console_output import show_db_stats


console = Console()


def parse_args():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description="Claude Code Wrapped - Analyze your Claude Code usage"
    )
    parser.add_argument(
        "--year",
        type=int,
        default=datetime.now().year,
        help="Year to analyze (default: current year)"
    )
    parser.add_argument(
        "--force-rescan",
        action="store_true",
        help="Ignore file tracking and rescan all files"
    )
    parser.add_argument(
        "--rebuild-db",
        action="store_true",
        help="Delete and rebuild database from scratch"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed progress and statistics"
    )
    parser.add_argument(
        "--db-stats",
        action="store_true",
        help="Show database statistics and exit"
    )
    return parser.parse_args()


def rebuild_database(conn):
    """Rebuild database from scratch"""
    cursor = conn.cursor()

    # Drop all tables
    cursor.execute("DROP TABLE IF EXISTS file_tracks")
    cursor.execute("DROP TABLE IF EXISTS message_entries")
    cursor.execute("DROP TABLE IF EXISTS hourly_aggregates")
    cursor.execute("DROP TABLE IF EXISTS model_aggregates")
    cursor.execute("DROP TABLE IF EXISTS schema_version")

    conn.commit()

    # Recreate schema
    init_database(conn)


def main():
    """Main entry point"""
    args = parse_args()

    # Connect to database
    with get_db_connection() as conn:
        # Rebuild database if requested
        if args.rebuild_db:
            console.print("[yellow]Rebuilding database from scratch...[/yellow]")
            rebuild_database(conn)
            console.print("[green]Database rebuilt successfully[/green]\n")

        # Initialize database (creates tables if missing)
        init_database(conn)

        # Check database integrity
        if not check_integrity(conn):
            console.print("[red]Database integrity check failed![/red]")
            console.print("[yellow]Run with --rebuild-db to fix[/yellow]")
            sys.exit(1)

        # Show database stats and exit
        if args.db_stats:
            show_db_stats(conn)
            return

        # Perform incremental update
        console.print(f"[bold blue]Scanning for new/modified files...[/bold blue]")
        updated_count = perform_incremental_update(
            conn,
            force_rescan=args.force_rescan,
            verbose=args.verbose
        )

        if updated_count > 0:
            console.print(f"[green]Processed {updated_count} new/modified files[/green]\n")
        else:
            console.print("[green]All files up to date (using cached data)[/green]\n")

        # Query stats for year
        console.print(f"[bold]Generating wrapped for {args.year}...[/bold]")
        stats = query_wrapped_stats(conn, args.year)

        if not stats.daily_activity:
            console.print(f"[red]No activity found for {args.year}[/red]")
            sys.exit(1)

        # Generate PNG
        console.print("Generating PNG image...")
        png_bytes = generate_wrapped_png(stats)

        # Display in terminal
        display_png_in_terminal(png_bytes)

        # Save to file
        filename = f"cc-wrapped-{args.year}.png"
        with open(filename, 'wb') as f:
            f.write(png_bytes)

        console.print(f"\n[green]Saved to: {filename}[/green]")


if __name__ == "__main__":
    main()
