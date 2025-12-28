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
from datetime import datetime, timedelta
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
    get_limit_events,
    query_usage_stats,
)
from command_center.cache.incremental_update import perform_incremental_update
from command_center.aggregators.streak_calculator import calculate_streaks
from command_center.visualization.png_generator import generate_usage_report_png
import base64


def calculate_trend(current: float, previous: float) -> float:
    """
    Calculate percentage change between current and previous values.

    Returns:
        Percentage change (e.g., 15.5 means +15.5%, -3.2 means -3.2%)
        Returns 0 if previous is 0 or invalid
    """
    if previous == 0 or not isinstance(previous, (int, float)) or not isinstance(current, (int, float)):
        return 0.0

    change = ((current - previous) / previous) * 100
    return round(change, 1)


def get_previous_period(date_from: str, date_to: str) -> tuple[str, str]:
    """
    Calculate the previous period with same duration as current period.

    Args:
        date_from: Current period start (YYYY-MM-DD)
        date_to: Current period end (YYYY-MM-DD)

    Returns:
        Tuple of (previous_from, previous_to) in YYYY-MM-DD format
    """
    start = datetime.strptime(date_from, '%Y-%m-%d')
    end = datetime.strptime(date_to, '%Y-%m-%d')

    # Calculate period duration
    duration = (end - start).days + 1  # +1 to include both start and end day

    # Previous period ends one day before current period starts
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=duration - 1)

    return (
        prev_start.strftime('%Y-%m-%d'),
        prev_end.strftime('%Y-%m-%d')
    )


def get_dashboard_bundle(
    date_from: str,
    date_to: str,
    refresh: bool,
    granularity: Literal["month", "week", "day", "hour"]
) -> dict:
    """
    Generate complete dashboard JSON bundle.

    Args:
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        refresh: If True, perform incremental update before querying
        granularity: Timeline grouping - 'month', 'week', 'day', or 'hour'

    Returns:
        Complete dashboard data bundle as dict
    """
    with get_db_connection() as conn:
        init_database(conn)

        # Optionally refresh data
        updated_files = 0
        if refresh:
            updated_files = perform_incremental_update(conn, force_rescan=False, verbose=False)

        # Query all data for current period
        totals = query_totals(conn, date_from, date_to)
        daily_activity = query_daily_stats(conn, date_from, date_to)
        timeline_data = query_timeline_data(conn, date_from, date_to, granularity)
        model_distribution = query_model_distribution(conn, date_from, date_to)
        hourly_profile = query_hourly_profile(conn, date_from, date_to)
        recent_sessions = query_recent_sessions(conn, date_from, date_to, limit=20)

        # Calculate streaks
        max_streak, current_streak = calculate_streaks(daily_activity)

        # Query previous period for trend calculation
        prev_from, prev_to = get_previous_period(date_from, date_to)
        prev_totals = query_totals(conn, prev_from, prev_to)

        # Calculate trends
        trends = {
            "messages": calculate_trend(totals["messages"], prev_totals["messages"]),
            "sessions": calculate_trend(totals["sessions"], prev_totals["sessions"]),
            "tokens": calculate_trend(totals["tokens"], prev_totals["tokens"]),
            "cost": calculate_trend(totals["cost"], prev_totals["cost"]),
        }

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
            "trends": trends,
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


def get_limit_resets(date_from: str, date_to: str) -> list[dict]:
    """
    Get limit reset events for a date range.

    Args:
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)

    Returns:
        List of limit reset events with timestamps
    """
    with get_db_connection() as conn:
        init_database(conn)
        return get_limit_events(conn, date_from, date_to)


def export_png_report(date_from: str, date_to: str) -> dict:
    """
    Generate PNG usage report and return as base64-encoded string.

    Args:
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)

    Returns:
        Dict with base64-encoded PNG data and filename
    """
    with get_db_connection() as conn:
        init_database(conn)

        # Query usage stats
        stats = query_usage_stats(conn, date_from, date_to)

        # Generate PNG
        png_bytes = generate_usage_report_png(stats)

        # Encode to base64
        png_base64 = base64.b64encode(png_bytes).decode('utf-8')

        # Generate filename
        filename = f"cc-usage-report-{date_from}_{date_to}.png"

        return {
            "filename": filename,
            "data": png_base64,
            "size": len(png_bytes),
            "mime_type": "image/png"
        }


def get_projects() -> dict:
    """
    Get all projects with metadata.

    Returns:
        {
            "projects": [
                {
                    "project_id": "-home-xai-DEV-command-center",
                    "name": "Command Center",
                    "description": "Analytics tool",
                    "absolute_path": "/home/xai/DEV/command-center",
                    "first_seen": "2024-12-27T10:00:00+01:00",
                    "last_seen": "2024-12-28T01:44:00+01:00",
                    "visible": true
                },
                ...
            ]
        }
    """
    from command_center.utils.project_metadata import (
        list_all_projects,
        ensure_visible_field,
        PROJECTS_JSON_PATH
    )

    # Backward compatibility: ensure all projects have visible field
    ensure_visible_field(PROJECTS_JSON_PATH)

    # Get all projects
    projects = list_all_projects(PROJECTS_JSON_PATH)

    return {"projects": projects}


def update_project(
    project_id: str,
    name: str | None = None,
    description: str | None = None,
    visible: bool | None = None
) -> dict:
    """
    Update project metadata fields.

    Args:
        project_id: Project identifier
        name: New display name (optional)
        description: New description (optional)
        visible: Visibility flag (optional)

    Returns:
        {
            "project": {
                "project_id": "...",
                "name": "...",
                "description": "...",
                "visible": true,
                ...
            }
        }

    Raises:
        ValueError: If project not found or validation fails
    """
    from command_center.utils.project_metadata import (
        update_project_fields,
        PROJECTS_JSON_PATH
    )

    # Call validation and update function
    updated_project = update_project_fields(
        project_id=project_id,
        name=name,
        description=description,
        visible=visible,
        json_path=PROJECTS_JSON_PATH
    )

    return {"project": updated_project}


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
        choices=["month", "week", "day", "hour"],
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

    # limits subcommand
    limits_parser = subparsers.add_parser(
        "limits",
        help="Get limit reset events"
    )
    limits_parser.add_argument(
        "--from", dest="date_from", required=True,
        help="Start date (YYYY-MM-DD)"
    )
    limits_parser.add_argument(
        "--to", dest="date_to", required=True,
        help="End date (YYYY-MM-DD)"
    )

    # export-png subcommand
    png_parser = subparsers.add_parser(
        "export-png",
        help="Export PNG usage report"
    )
    png_parser.add_argument(
        "--from", dest="date_from", required=True,
        help="Start date (YYYY-MM-DD)"
    )
    png_parser.add_argument(
        "--to", dest="date_to", required=True,
        help="End date (YYYY-MM-DD)"
    )

    # projects subcommand
    projects_parser = subparsers.add_parser(
        "projects",
        help="Get all projects with metadata"
    )

    # update-project subcommand
    update_project_parser = subparsers.add_parser(
        "update-project",
        help="Update project metadata"
    )
    update_project_parser.add_argument(
        "--project-id", required=True,
        help="Project identifier"
    )
    update_project_parser.add_argument(
        "--name", required=False,
        help="Display name"
    )
    update_project_parser.add_argument(
        "--description", required=False,
        help="Description"
    )
    update_project_parser.add_argument(
        "--visible", type=int, choices=[0, 1], required=False,
        help="Visibility flag (0 or 1)"
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
        elif args.command == "limits":
            result = get_limit_resets(args.date_from, args.date_to)
        elif args.command == "export-png":
            result = export_png_report(args.date_from, args.date_to)
        elif args.command == "projects":
            result = get_projects()
        elif args.command == "update-project":
            # Convert visible from int (0/1) to bool if provided
            visible = bool(args.visible) if args.visible is not None else None
            result = update_project(
                args.project_id,
                args.name,
                args.description,
                visible
            )
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
