"""
JSON API bridge for Tauri desktop application.

This module provides a CLI interface for the Tauri desktop app to query
usage statistics from the SQLite database. All output is JSON to stdout.

Usage:
    python -m command_center.tauri_api dashboard --from 2025-01-01 --to 2025-12-31 --refresh 0 --granularity month
    python -m command_center.tauri_api day --date 2025-06-15
    python -m command_center.tauri_api model --model claude-sonnet-4-20250514 --from 2025-01-01 --to 2025-12-31
    python -m command_center.tauri_api session --id SESSION_UUID
"""
import argparse
import json
import sys
from datetime import datetime
from typing import Literal

from command_center.database.connection import get_db_connection
from command_center.database.schema import init_database
from command_center.database.queries import (
    query_daily_stats,
    query_timeline_data,
    query_model_distribution,
    query_hourly_profile,
    query_recent_sessions,
    query_totals,
    query_day_details,
    query_model_details,
    query_session_details,
)
from command_center.cache.incremental_update import perform_incremental_update
from command_center.aggregators.streak_calculator import calculate_streaks


def get_dashboard_bundle(
    date_from: str,
    date_to: str,
    refresh: bool,
    granularity: Literal["month", "week", "day"]
) -> dict:
    """
    Generate complete dashboard JSON bundle.

    Args:
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        refresh: If True, perform incremental update before querying
        granularity: Timeline grouping - 'month', 'week', or 'day'

    Returns:
        Complete dashboard data bundle as dict
    """
    with get_db_connection() as conn:
        init_database(conn)

        # Optionally refresh data
        updated_files = 0
        if refresh:
            updated_files = perform_incremental_update(conn, force_rescan=False, verbose=False)

        # Query all data
        totals = query_totals(conn, date_from, date_to)
        daily_activity = query_daily_stats(conn, date_from, date_to)
        timeline_data = query_timeline_data(conn, date_from, date_to, granularity)
        model_distribution = query_model_distribution(conn, date_from, date_to)
        hourly_profile = query_hourly_profile(conn, date_from, date_to)
        recent_sessions = query_recent_sessions(conn, date_from, date_to, limit=20)

        # Calculate streaks
        max_streak, current_streak = calculate_streaks(daily_activity)

        # Build response
        return {
            "range": {
                "from": date_from,
                "to": date_to
            },
            "totals": {
                "messages": totals["messages"],
                "sessions": totals["sessions"],
                "tokens": totals["tokens"],
                "input_tokens": totals["input_tokens"],
                "output_tokens": totals["output_tokens"],
                "cost": totals["cost"],
                "cache_read": totals["cache_read"],
                "cache_write": totals["cache_write"],
                "current_streak": current_streak,
                "max_streak": max_streak,
                "first_session_date": totals["first_session_date"]
            },
            "daily_activity": daily_activity,
            "timeline": {
                "granularity": granularity,
                "data": timeline_data
            },
            "model_distribution": model_distribution,
            "hourly_profile": hourly_profile,
            "recent_sessions": recent_sessions,
            "meta": {
                "updated_files": updated_files,
                "generated_at": datetime.now().isoformat()
            }
        }


def get_day_details(date: str) -> dict:
    """
    Get detailed stats for a specific day.

    Args:
        date: Date (YYYY-MM-DD)

    Returns:
        Day details with hourly breakdown, models, and sessions
    """
    with get_db_connection() as conn:
        init_database(conn)
        return query_day_details(conn, date)


def get_model_details(model: str, date_from: str, date_to: str) -> dict:
    """
    Get detailed stats for a specific model.

    Args:
        model: Model identifier
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)

    Returns:
        Model details with daily activity and top sessions
    """
    with get_db_connection() as conn:
        init_database(conn)
        return query_model_details(conn, model, date_from, date_to)


def get_session_details(session_id: str) -> dict:
    """
    Get detailed stats for a specific session.

    Args:
        session_id: Session identifier

    Returns:
        Session details with messages and totals
    """
    with get_db_connection() as conn:
        init_database(conn)
        return query_session_details(conn, session_id)


def main():
    """CLI entry point for Tauri API."""
    parser = argparse.ArgumentParser(
        prog="command_center.tauri_api",
        description="JSON API for Tauri desktop dashboard"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # dashboard subcommand
    dash_parser = subparsers.add_parser(
        "dashboard",
        help="Get complete dashboard bundle"
    )
    dash_parser.add_argument(
        "--from", dest="date_from", required=True,
        help="Start date (YYYY-MM-DD)"
    )
    dash_parser.add_argument(
        "--to", dest="date_to", required=True,
        help="End date (YYYY-MM-DD)"
    )
    dash_parser.add_argument(
        "--refresh", type=int, default=0,
        help="Perform incremental update (0 or 1)"
    )
    dash_parser.add_argument(
        "--granularity", default="month",
        choices=["month", "week", "day"],
        help="Timeline granularity"
    )

    # day subcommand
    day_parser = subparsers.add_parser(
        "day",
        help="Get day details"
    )
    day_parser.add_argument(
        "--date", required=True,
        help="Date (YYYY-MM-DD)"
    )

    # model subcommand
    model_parser = subparsers.add_parser(
        "model",
        help="Get model details"
    )
    model_parser.add_argument(
        "--model", required=True,
        help="Model identifier"
    )
    model_parser.add_argument(
        "--from", dest="date_from", required=True,
        help="Start date (YYYY-MM-DD)"
    )
    model_parser.add_argument(
        "--to", dest="date_to", required=True,
        help="End date (YYYY-MM-DD)"
    )

    # session subcommand
    session_parser = subparsers.add_parser(
        "session",
        help="Get session details"
    )
    session_parser.add_argument(
        "--id", dest="session_id", required=True,
        help="Session identifier"
    )

    args = parser.parse_args()

    try:
        if args.command == "dashboard":
            result = get_dashboard_bundle(
                args.date_from,
                args.date_to,
                bool(args.refresh),
                args.granularity
            )
        elif args.command == "day":
            result = get_day_details(args.date)
        elif args.command == "model":
            result = get_model_details(args.model, args.date_from, args.date_to)
        elif args.command == "session":
            result = get_session_details(args.session_id)
        else:
            result = {"error": f"Unknown command: {args.command}"}

        # Output JSON to stdout
        print(json.dumps(result, ensure_ascii=False, indent=None))

    except Exception as e:
        # Output error as JSON to stderr
        error_response = {
            "error": str(e),
            "type": type(e).__name__
        }
        print(json.dumps(error_response), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
