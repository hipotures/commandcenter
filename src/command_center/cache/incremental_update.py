"""
Incremental update orchestration
"""
import os
import sqlite3
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn

from command_center.collectors.file_scanner import scan_jsonl_files
from command_center.collectors.jsonl_parser import parse_jsonl_line
from command_center.collectors.limit_parser import parse_limit_event, complete_limit_event
from command_center.database.queries import (
    get_file_tracks, insert_message_entries, insert_limit_events, update_file_track,
    recompute_hourly_aggregates, recompute_model_aggregates
)
from command_center.cache.file_tracker import detect_file_changes
from command_center.utils.date_helpers import format_datetime_hour, parse_and_convert_to_local
from command_center.utils.project_metadata import (
    load_projects_json, save_projects_json, auto_discover_project
)


def perform_incremental_update(conn: sqlite3.Connection,
                               force_rescan: bool = False,
                               verbose: bool = False) -> int:
    """
    Perform incremental update of database.

    Scans filesystem, detects new/modified files, and processes them.

    Args:
        conn: Database connection
        force_rescan: If True, reprocess all files regardless of tracking
        verbose: Show progress bars and details

    Returns:
        Number of files processed
    """
    # Scan filesystem
    discovered_files = scan_jsonl_files()

    if not discovered_files:
        return 0

    # Detect changes
    if force_rescan:
        # Treat all files as new
        files_to_process = discovered_files
    else:
        tracked = get_file_tracks(conn)
        file_statuses = detect_file_changes(discovered_files, tracked)
        files_to_process = [
            fs.path for fs in file_statuses
            if fs.status in ("new", "modified")
        ]

    if not files_to_process:
        return 0

    # Load project metadata at start
    projects = load_projects_json()

    # Track affected hours, years, and discovered projects
    affected_hours = set()
    affected_years = set()
    discovered_project_ids = set()

    # Process files with progress bar (always shown)
    with Progress(
        TextColumn("[bold blue]Processing files..."),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
    ) as progress:
        task = progress.add_task("Processing", total=len(files_to_process))

        for file_path in files_to_process:
            entry_count = process_file(
                conn, file_path, affected_hours, affected_years, discovered_project_ids
            )
            progress.update(task, advance=1)

            # Verbose: show details for each file
            if verbose and entry_count > 0:
                progress.console.print(f"  [dim]Processed {entry_count} entries from {os.path.basename(file_path)}[/dim]")

    # Recompute aggregates for affected hours/years
    if affected_hours:
        if verbose:
            from rich.console import Console
            Console().print(f"[dim]Recomputing hourly aggregates for {len(affected_hours)} hours...[/dim]")
        recompute_hourly_aggregates(conn, affected_hours)

    if affected_years:
        if verbose:
            from rich.console import Console
            Console().print(f"[dim]Recomputing model aggregates for years: {sorted(affected_years)}[/dim]")
        for year in affected_years:
            recompute_model_aggregates(conn, year)

    # Auto-discover new projects and save metadata
    if discovered_project_ids:
        for project_id in discovered_project_ids:
            projects = auto_discover_project(projects, project_id)
        save_projects_json(projects)

        if verbose:
            from rich.console import Console
            Console().print(f"[dim]Discovered {len(discovered_project_ids)} projects[/dim]")

    return len(files_to_process)


def process_file(conn: sqlite3.Connection, file_path: str,
                affected_hours: set[str], affected_years: set[int],
                discovered_project_ids: set[str]) -> int:
    """
    Process a single .jsonl file.

    Collects both message entries and limit events from the file.

    Args:
        conn: Database connection
        file_path: Path to .jsonl file
        affected_hours: Set to collect affected datetime_hours
        affected_years: Set to collect affected years
        discovered_project_ids: Set to collect discovered project IDs

    Returns:
        Number of valid entries processed
    """
    import json

    entries = []
    all_lines = []  # Store all parsed lines for limit processing
    entry_count = 0

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line_stripped = line.strip()
                if not line_stripped:
                    continue

                try:
                    data = json.loads(line_stripped)
                    all_lines.append(data)
                except:
                    continue

                # Try to parse as message entry
                entry = parse_jsonl_line(line, file_path)
                if entry:
                    entries.append(entry)
                    entry_count += 1

                    # Track affected hour and year
                    dt_local = parse_and_convert_to_local(entry.timestamp)
                    if dt_local:
                        datetime_hour = format_datetime_hour(dt_local)
                        affected_hours.add(datetime_hour)
                        affected_years.add(entry.year)

                    # Track discovered project
                    if entry.project_id and entry.project_id != 'unknown':
                        discovered_project_ids.add(entry.project_id)
    except Exception:
        # File read error - skip
        return 0

    # Insert message entries
    if entries:
        insert_message_entries(conn, entries)

    # Process limit events from summary entries OR assistant error messages
    completed_limits = []

    for i, data in enumerate(all_lines):
        # Check if this is a limit event (old summary format OR new error format)
        is_old_format = data.get('type') == 'summary'
        is_new_format = (data.get('type') == 'assistant' and data.get('error') == 'rate_limit')

        if is_old_format or is_new_format:
            limit_event = parse_limit_event(json.dumps(data), file_path)
            if limit_event:
                # For new format, parse_limit_event already completed the event
                # (timestamp is in the same entry)
                if is_new_format and limit_event.occurred_at:
                    # Event already completed
                    completed_limits.append(limit_event)
                    continue

                # For old format, find the NEXT message entry with timestamp
                timestamp = None
                session_id = None

                for j in range(i + 1, min(i + 10, len(all_lines))):
                    next_data = all_lines[j]
                    if next_data.get('timestamp'):
                        timestamp = next_data.get('timestamp')
                        session_id = next_data.get('sessionId')
                        break

                # If no next entry, use previous entry
                if not timestamp:
                    for j in range(max(0, i - 10), i):
                        prev_data = all_lines[j]
                        if prev_data.get('timestamp'):
                            timestamp = prev_data.get('timestamp')
                            session_id = prev_data.get('sessionId')

                if timestamp:
                    try:
                        completed = complete_limit_event(
                            limit_event,
                            timestamp,
                            session_id
                        )
                        completed_limits.append(completed)
                    except Exception as e:
                        # Skip invalid limit events
                        pass

    if completed_limits:
        insert_limit_events(conn, completed_limits)

    # Update file tracking
    try:
        stat = os.stat(file_path)
        update_file_track(conn, file_path, stat.st_mtime_ns, stat.st_size, entry_count)
    except OSError:
        pass

    return entry_count
