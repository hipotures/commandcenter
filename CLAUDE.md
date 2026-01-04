# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Command Center is a SQLite-based analytics tool for Claude Code usage data. It processes JSONL session logs from `~/.claude/projects/` or `~/.config/claude/projects/`, performs intelligent incremental updates, and generates usage reports (PNG + terminal display) for specified date ranges.

## Development Commands

### Installation & Setup

```bash
# Global installation (recommended for production use)
uv tool install -e .

# Local development with virtual environment
uv sync
source .venv/bin/activate
```

### Running the Tool

```bash
# Generate report for current year
command-center --verbose

# Generate report for specific date range
command-center --from 2024-01-01 --to 2024-12-31

# Generate report with compact date format
command-center --from 20250101 --to 20250228

# Show database statistics
command-center --db-stats

# Force full rescan (ignore file tracking cache)
command-center --force-rescan

# Rebuild database from scratch
command-center --rebuild-db

# Update pricing cache from LiteLLM
command-center --update-pricing

# List all discovered projects
command-center --list-projects

# Update project metadata
command-center --update-project PROJECT_ID "Project Name" "Description"
```

### Tauri API (for desktop dashboard)

```bash
# Dashboard data (JSON output)
python -m command_center.tauri_api dashboard --from 2025-01-01 --to 2025-12-31 --refresh 0 --granularity month --project-id PROJECT_ID

# Day details
python -m command_center.tauri_api day --date 2025-06-15 --project-id PROJECT_ID

# Model details
python -m command_center.tauri_api model --model claude-sonnet-4-20250514 --from 2025-01-01 --to 2025-12-31 --project-id PROJECT_ID

# Session details
python -m command_center.tauri_api session --id SESSION_UUID --project-id PROJECT_ID

# Limit reset events
python -m command_center.tauri_api limits --from 2025-01-01 --to 2025-12-31

# Export PNG report (base64 output)
python -m command_center.tauri_api export-png --from 2025-01-01 --to 2025-12-31

# List all projects
python -m command_center.tauri_api projects

# Update project metadata
python -m command_center.tauri_api update-project --project-id PROJECT_ID --name "Project Name" --description "Description" --visible 1
```

### Without Installation

```bash
uv run command-center --verbose
```

## Architecture

### Data Pipeline Flow

1. **File Discovery** (`collectors/file_scanner.py`)
   - Scans `~/.claude/projects/**/*.jsonl` and `~/.config/claude/projects/**/*.jsonl`
   - Returns list of discovered JSONL files

2. **Change Detection** (`cache/file_tracker.py`)
   - Compares discovered files against `file_tracks` table
   - Uses `mtime_ns` and `size_bytes` to detect changes
   - Returns files with status: `new`, `modified`, or `unchanged`

3. **Incremental Processing** (`cache/incremental_update.py`)
   - Orchestrates the entire update pipeline
   - Only processes new/modified files (unless `--force-rescan`)
   - Tracks affected hours and years for aggregate recomputation

4. **JSONL Parsing** (`collectors/jsonl_parser.py`)
   - **Critical**: Converts UTC timestamps to local time
   - Extracts tokens (input, output, cache read/write)
   - Computes deduplication hash: `{message.id}:{requestId}`

5. **Database Insertion** (`database/queries.py`)
   - Batch inserts to `message_entries` (100 entries at a time)
   - Uses `INSERT OR IGNORE` for deduplication

6. **Aggregate Recomputation** (`aggregators/`)
   - `hourly_aggregates`: Pre-computed stats per hour (local time)
   - `model_aggregates`: Per-model statistics per year
   - Only recomputes affected hours/years after incremental update

7. **Visualization** (`visualization/`)
   - Queries aggregated data via `database/queries.py`
   - Generates PNG with Pillow (`png_generator.py`)
   - Displays in terminal with iTerm2/Kitty inline protocol (`terminal_display.py`)

### Database Schema

**Current schema version: 3**

**Core Tables:**
- `message_entries`: Individual messages with deduplication via `entry_hash` (PRIMARY KEY)
  - Includes `project_id` field for project-level filtering (added in v3)
- `file_tracks`: Tracks processed files by `mtime_ns` and `size_bytes`
- `hourly_aggregates`: Pre-computed hourly stats (indexed by `year`, `date`, `hour`)
- `model_aggregates`: Per-model totals (composite PRIMARY KEY: `model`, `year`)
- `limit_events`: Session limit tracking (5-hour, spending cap, context) - added in v2
- `schema_version`: Migration tracking

**Key Indexes:**
- `message_entries`: `year`, `date`, `session_id`, `model`, `project_id`
- `hourly_aggregates`: `year`, `date`, `hour`
- `file_tracks`: `last_scanned`
- `limit_events`: `(year, date)`, `(limit_type, year)`, `occurred_at_local`

### Time Handling

**Critical Design Decision**: All timestamps are stored in **local time** after conversion from UTC.

- Input: UTC timestamps from JSONL files
- Conversion: `utils/date_helpers.py` → `parse_and_convert_to_local()`
- Storage: `timestamp_local` (ISO 8601), `year`, `date` (YYYY-MM-DD)
- Aggregation: All hourly/daily stats use local time

This ensures usage reports match user's actual working hours.

### Deduplication Strategy

Uses composite hash: `{message.id}:{requestId}` (see `collectors/deduplication.py`)

- Hash stored as `entry_hash` (PRIMARY KEY in `message_entries`)
- `INSERT OR IGNORE` prevents duplicate processing
- Allows safe re-processing of files without data duplication

### Incremental Update Design

The tool is optimized for speed on subsequent runs:

- **First run**: ~1-2 minutes (processes all historical data)
- **Subsequent runs**: ~5 seconds (only new/modified files)

**How it works:**
1. Scan filesystem for all `messages.jsonl` files
2. Compare against `file_tracks` table (mtime + size)
3. Only parse/insert entries from changed files
4. Recompute only affected hourly/model aggregates
5. Update file tracking metadata

**Force rescan**: `--force-rescan` bypasses tracking, reprocesses everything (useful after schema changes)

## Configuration

All configuration is in `config.py`:
- Database path: `~/.claude/db/command_center.db`
- Session paths: `~/.claude/projects/` or `~/.config/claude/projects/`
- Canvas size: 1500×1400px
- Color scheme: Defined in `COLORS` dict
- Batch insert size: 100 entries

## Data Models

Key dataclasses in `database/models.py`:
- `MessageEntry`: Individual message with tokens, cost, and `project_id`
- `HourlyAggregate`: Pre-computed hourly stats
- `ModelAggregate`: Per-model statistics
- `LimitEvent`: Session limit events (5-hour, spending cap, context)
- `UsageStats`: Final output for visualization (with date_from, date_to)
- `FileTrack`: File processing metadata
- `FileStatus`: Change detection status (new, modified, unchanged)

## Project Tracking

**New in v3**: Command Center automatically tracks which Git repository/project each session belongs to.

- Project IDs are derived from session file paths (e.g., `/home/user/dev/project` → `-home-user-dev-project`)
- Metadata stored in `~/.claude/db/command-center-projects.json`
- Each project has: `name`, `description`, `absolute_path`, `first_seen`, `last_seen`
- Use `--list-projects` to see all discovered projects
- Use `--update-project` to set friendly names and descriptions
- Sessions with unknown projects are marked as `project_id = "unknown"`

**Note**: After adding `project_id` support (schema v3), run `--rebuild-db` to populate project IDs for existing data.

## Session Limit Tracking

Automatically parses and stores session limit events.

- Tracks when users hit 5-hour limits, spending caps, or context limits
- Parses reset times from summary messages (e.g., "resets 12am", "resets 6pm")
- Data used by Tauri dashboard for limit insights
- Stored in `limit_events` table with deduplication via `leaf_uuid`

## Tauri Desktop Dashboard

The `tauri_api.py` module provides a JSON API for the desktop dashboard:

- **Dashboard endpoint**: Returns daily stats, timeline data, model distribution, hourly profile, recent sessions
- **Day endpoint**: Detailed statistics for a specific day
- **Model endpoint**: Per-model usage statistics
- **Session endpoint**: Individual session details

All endpoints output JSON to stdout for consumption by the Tauri app.

## Important Constraints

1. **Never modify `entry_hash` computation** - would break deduplication across schema versions
2. **Always use local time** for aggregations - matches user's working hours
3. **Recompute aggregates** after any direct `message_entries` modifications
4. **Use batch inserts** (BATCH_INSERT_SIZE=100) for performance
5. **Database location** is fixed at `~/.claude/db/command_center.db` (not configurable)
6. **After schema migrations** that add computed fields (like `project_id`), run `--rebuild-db` to backfill data
