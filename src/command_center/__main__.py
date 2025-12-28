"""
Claude Code Usage Reports - Main entry point

Modern SQLite-based analytics with intelligent caching.
"""
import argparse
import sys
from datetime import datetime
from rich.console import Console
from rich.spinner import Spinner
from rich.live import Live

from command_center import __version__
from command_center.database.connection import get_db_connection
from command_center.database.schema import init_database, check_integrity
from command_center.database.queries import query_usage_stats
from command_center.cache.incremental_update import perform_incremental_update
from command_center.visualization.png_generator import generate_usage_report_png
from command_center.visualization.terminal_display import display_png_in_terminal
from command_center.utils.console_output import show_db_stats
from command_center.utils.pricing import update_pricing_cache
from command_center.cli.project_commands import list_projects_command, update_project_command


console = Console()


def parse_date(date_str):
    """
    Parse date string in YYYY-MM-DD or YYYYMMDD format.

    Args:
        date_str: Date string to parse

    Returns:
        Date string in YYYY-MM-DD format

    Raises:
        ValueError: If date format is invalid
    """
    date_str = date_str.strip()

    # Try YYYY-MM-DD format
    if len(date_str) == 10 and date_str[4] == '-' and date_str[7] == '-':
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
            return date_str
        except ValueError:
            raise ValueError(f"Invalid date: {date_str}. Use YYYY-MM-DD or YYYYMMDD format")

    # Try YYYYMMDD format
    if len(date_str) == 8 and date_str.isdigit():
        try:
            dt = datetime.strptime(date_str, '%Y%m%d')
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date: {date_str}. Use YYYY-MM-DD or YYYYMMDD format")

    raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD or YYYYMMDD format")


def parse_args():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description="Claude Code Usage Reports - Analyze your Claude Code usage"
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"command-center {__version__}"
    )

    # Default dates
    now = datetime.now()
    default_from = f"{now.year}-01-01"
    default_to = now.strftime('%Y-%m-%d')

    parser.add_argument(
        "--from",
        dest="date_from",
        type=str,
        default=default_from,
        help=f"Start date in YYYY-MM-DD or YYYYMMDD format (default: {default_from})"
    )
    parser.add_argument(
        "--to",
        dest="date_to",
        type=str,
        default=default_to,
        help=f"End date in YYYY-MM-DD or YYYYMMDD format (default: today)"
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
    parser.add_argument(
        "--update-pricing",
        action="store_true",
        help="Update pricing cache from LiteLLM and exit"
    )

    # Project management commands
    parser.add_argument(
        "--list-projects",
        action="store_true",
        help="List all discovered projects with metadata"
    )
    parser.add_argument(
        "--update-project",
        nargs=3,
        metavar=("PROJECT_ID", "NAME", "DESCRIPTION"),
        help="Update project: PROJECT_ID 'name' 'description'"
    )

    args = parser.parse_args()

    # Parse and validate dates
    try:
        args.date_from = parse_date(args.date_from)
        args.date_to = parse_date(args.date_to)
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)

    # Validate date range
    if args.date_from > args.date_to:
        console.print(f"[red]Error: Start date ({args.date_from}) must be before end date ({args.date_to})[/red]")
        sys.exit(1)

    return args


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

    # Handle project management commands
    if args.list_projects:
        list_projects_command()
        return

    if args.update_project:
        project_id, name, description = args.update_project
        update_project_command(project_id, name=name, description=description)
        return

    # Update pricing cache and exit
    if args.update_pricing:
        success = update_pricing_cache()
        sys.exit(0 if success else 1)

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
        updated_count = perform_incremental_update(
            conn,
            force_rescan=args.force_rescan,
            verbose=args.verbose
        )

        if updated_count > 0:
            console.print(f"[green]✓ Processed {updated_count} new/modified files[/green]\n")
        else:
            console.print("[green]✓ All files up to date (using cached data)[/green]\n")

        # Query stats for date range
        with Live(Spinner("dots", text=f"[bold blue]Querying data for {args.date_from} to {args.date_to}...[/bold blue]"), console=console, refresh_per_second=10):
            stats = query_usage_stats(conn, args.date_from, args.date_to)

        if not stats.daily_activity:
            console.print(f"[red]No activity found for date range {args.date_from} to {args.date_to}[/red]")
            sys.exit(1)

        # Generate PNG
        with Live(Spinner("dots", text="[bold blue]Generating PNG image...[/bold blue]"), console=console, refresh_per_second=10):
            png_bytes = generate_usage_report_png(stats)

        # Display in terminal
        display_png_in_terminal(png_bytes)

        # Save to file
        filename = f"cc-usage-report-{args.date_from}_{args.date_to}.png"
        with open(filename, 'wb') as f:
            f.write(png_bytes)

        console.print(f"\n[green]Saved to: {filename}[/green]")


if __name__ == "__main__":
    main()
