"""
Incremental update orchestration
"""
import os
import sqlite3
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn

from command_center.collectors.file_scanner import scan_jsonl_files
from command_center.collectors.jsonl_parser import parse_jsonl_line
from command_center.database.queries import (
    get_file_tracks, insert_message_entries, update_file_track,
    recompute_hourly_aggregates, recompute_model_aggregates
)
from command_center.cache.file_tracker import detect_file_changes
from command_center.utils.date_helpers import format_datetime_hour, parse_and_convert_to_local


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

    # Track affected hours and years for aggregate recomputation
    affected_hours = set()
    affected_years = set()

    # Process files
    if verbose:
        with Progress(
            TextColumn("[bold blue]Processing files..."),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
        ) as progress:
            task = progress.add_task("Processing", total=len(files_to_process))

            for file_path in files_to_process:
                entry_count = process_file(
                    conn, file_path, affected_hours, affected_years
                )
                progress.update(task, advance=1)
    else:
        for file_path in files_to_process:
            process_file(conn, file_path, affected_hours, affected_years)

    # Recompute aggregates for affected hours/years
    if affected_hours:
        recompute_hourly_aggregates(conn, affected_hours)

    for year in affected_years:
        recompute_model_aggregates(conn, year)

    return len(files_to_process)


def process_file(conn: sqlite3.Connection, file_path: str,
                affected_hours: set[str], affected_years: set[int]) -> int:
    """
    Process a single .jsonl file.

    Args:
        conn: Database connection
        file_path: Path to .jsonl file
        affected_hours: Set to collect affected datetime_hours
        affected_years: Set to collect affected years

    Returns:
        Number of valid entries processed
    """
    entries = []
    entry_count = 0

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
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
    except Exception:
        # File read error - skip
        return 0

    # Insert entries
    if entries:
        insert_message_entries(conn, entries)

    # Update file tracking
    try:
        stat = os.stat(file_path)
        update_file_track(conn, file_path, stat.st_mtime_ns, stat.st_size, entry_count)
    except OSError:
        pass

    return entry_count
