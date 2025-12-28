## API Reference

### Module: `command_center.database.connection`

#### `get_db_connection()`

**Type:** Context manager

**Purpose:** Get a configured SQLite connection with WAL mode and optimizations.

**Returns:** `Generator[sqlite3.Connection, None, None]`

**Usage:**
```python
from command-center.database.connection import get_db_connection

with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM message_entries LIMIT 10")
    rows = cursor.fetchall()
```

**Configuration:**
- `PRAGMA journal_mode=WAL`: Write-Ahead Logging for concurrent access
- `PRAGMA synchronous=NORMAL`: Balanced durability/performance
- `PRAGMA foreign_keys=ON`: Enable foreign key constraints

**Thread Safety:** Each thread should open its own connection.

---

### Module: `command_center.database.schema`

#### `init_database(conn: sqlite3.Connection)`

**Purpose:** Initialize database schema, create tables if missing, run migrations.

**Parameters:**
- `conn`: Active database connection

**Returns:** `None`

**Side Effects:**
- Creates `schema_version` table
- Creates all data tables if missing
- Runs pending migrations
- Updates schema version

**Usage:**
```python
with get_db_connection() as conn:
    init_database(conn)
```

#### `check_integrity(conn: sqlite3.Connection) -> bool`

**Purpose:** Verify database integrity using SQLite's built-in check.

**Parameters:**
- `conn`: Active database connection

**Returns:** `True` if OK, `False` if corrupted

**Usage:**
```python
if not check_integrity(conn):
    print("Database corrupted! Run --rebuild-db")
```

---

### Module: `command_center.database.queries`

#### `insert_message_entries(conn: sqlite3.Connection, entries: list[MessageEntry])`

**Purpose:** Batch insert message entries with deduplication.

**Parameters:**
- `conn`: Active database connection
- `entries`: List of `MessageEntry` objects

**Returns:** `None`

**Side Effects:**
- Inserts entries in batches of 100
- Skips duplicates (based on `entry_hash`)
- Commits transaction

**Usage:**
```python
entries = [MessageEntry(...), MessageEntry(...)]
insert_message_entries(conn, entries)
```

**Performance:** O(n log n) where n = number of entries (due to index lookups)

#### `query_usage_stats(conn: sqlite3.Connection, date_from: str, date_to: str) -> UsageStats`

**Purpose:** Query all statistics needed for usage report.

**Parameters:**
- `conn`: Active database connection
- `date_from`: Start date (YYYY-MM-DD format)
- `date_to`: End date (YYYY-MM-DD format)

**Returns:** `UsageStats` object with:
- `daily_activity`: Dict[str, int] mapping date → message count
- `top_models`: List of top 3 models by tokens
- `total_messages`, `total_sessions`, `total_tokens`, `total_cost`
- `cache_read_tokens`, `cache_write_tokens`
- `first_session_date`: DateTime of first session
- `date_from`, `date_to`: Date range strings

**Usage:**
```python
stats = query_usage_stats(conn, "2025-01-01", "2025-12-31")
print(f"Total messages: {stats.total_messages}")
```

**Performance:** O(1) - queries pre-computed aggregates

#### `recompute_hourly_aggregates(conn: sqlite3.Connection, datetime_hours: set[str])`

**Purpose:** Recompute hourly aggregates for specific hours.

**Parameters:**
- `conn`: Active database connection
- `datetime_hours`: Set of hour strings (e.g., `{"2025-12-27 14:00:00"}`)

**Returns:** `None`

**Side Effects:**
- Deletes old aggregates for specified hours
- Recomputes from `message_entries`
- Commits transaction

**Usage:**
```python
affected_hours = {"2025-12-27 14:00:00", "2025-12-27 15:00:00"}
recompute_hourly_aggregates(conn, affected_hours)
```

**Performance:** O(k * m) where k = number of hours, m = avg messages per hour

---

### Module: `command_center.collectors.file_scanner`

#### `scan_jsonl_files() -> List[str]`

**Purpose:** Recursively scan for all .jsonl files in Claude directories.

**Parameters:** None

**Returns:** List of absolute file paths

**Scanned Directories:**
- `~/.claude/projects/**/*.jsonl`
- `~/.config/claude/projects/**/*.jsonl`

**Usage:**
```python
from command-center.collectors.file_scanner import scan_jsonl_files

files = scan_jsonl_files()
print(f"Found {len(files)} JSONL files")
```

**Performance:** O(n) where n = total files in directories

---

### Module: `command_center.collectors.jsonl_parser`

#### `parse_jsonl_line(line: str, source_file: str) -> Optional[MessageEntry]`

**Purpose:** Parse single JSONL line into MessageEntry with timezone conversion.

**Parameters:**
- `line`: Raw JSONL line (string)
- `source_file`: Path to source file (for debugging)

**Returns:** `MessageEntry` object or `None` if invalid

**Invalid Cases:**
- Empty line
- Malformed JSON
- Missing `message.id` or `requestId`
- Invalid timestamp

**Usage:**
```python
with open("session.jsonl") as f:
    for line in f:
        entry = parse_jsonl_line(line, "session.jsonl")
        if entry:
            print(f"Parsed: {entry.entry_hash}")
```

**Performance:** O(1) per line

---

### Module: `command_center.collectors.deduplication`

#### `compute_entry_hash(entry: dict) -> Optional[str]`

**Purpose:** Compute unique hash for deduplication.

**Parameters:**
- `entry`: Parsed JSONL entry (dict)

**Returns:** Hash string (e.g., `"msg_123:req_456"`) or `None` if missing fields

**Usage:**
```python
entry = {"message": {"id": "msg_123"}, "requestId": "req_456"}
hash_value = compute_entry_hash(entry)
# Returns: "msg_123:req_456"
```

---

### Module: `command_center.utils.date_helpers`

#### `parse_and_convert_to_local(timestamp_str: str) -> Optional[datetime]`

**Purpose:** Parse ISO timestamp and convert UTC → local timezone.

**Parameters:**
- `timestamp_str`: ISO 8601 timestamp with Z suffix (e.g., `"2025-11-27T02:09:11.551Z"`)

**Returns:** `datetime` in local timezone or `None` if invalid

**Usage:**
```python
from command-center.utils.date_helpers import parse_and_convert_to_local

dt_local = parse_and_convert_to_local("2025-11-27T02:09:11.551Z")
print(dt_local.strftime("%Y-%m-%d %H:%M:%S %Z"))
# Output: "2025-11-26 18:09:11 PST" (if you're in PST timezone)
```

#### `format_datetime_hour(dt: datetime) -> str`

**Purpose:** Format datetime as hourly bucket (YYYY-MM-DD HH:00:00).

**Parameters:**
- `dt`: datetime object

**Returns:** String like `"2025-12-27 14:00:00"`

**Usage:**
```python
from datetime import datetime

dt = datetime(2025, 12, 27, 14, 30, 45)
hour_str = format_datetime_hour(dt)
# Returns: "2025-12-27 14:00:00"
```

#### `format_date_key(dt: datetime) -> str`

**Purpose:** Format datetime as date key (YYYY-MM-DD).

**Parameters:**
- `dt`: datetime object

**Returns:** String like `"2025-12-27"`

**Usage:**
```python
date_key = format_date_key(datetime.now())
# Returns: "2025-12-27"
```

---

### Module: `command_center.visualization.png_generator`

#### `generate_usage_report_png(stats: UsageStats) -> bytes`

**Purpose:** Generate PNG image of usage report.

**Parameters:**
- `stats`: `UsageStats` object with all data

**Returns:** PNG bytes (can be written to file or displayed)

**Usage:**
```python
from command-center.visualization.png_generator import generate_usage_report_png

stats = query_usage_stats(conn, "2025-01-01", "2025-12-31")
png_bytes = generate_usage_report_png(stats)

with open("cc-usage-report-2025-01-01_2025-12-31.png", "wb") as f:
    f.write(png_bytes)
```

**Performance:** ~200-500ms (depends on font loading and image rendering)

---

### Module: `command_center.visualization.terminal_display`

#### `display_png_in_terminal(png_bytes: bytes)`

**Purpose:** Display PNG in terminal using appropriate protocol.

**Parameters:**
- `png_bytes`: PNG image bytes

**Returns:** `None`

**Side Effects:**
- Writes escape sequences to stdout
- Displays image inline (if terminal supports it)

**Supported Terminals:**
- Kitty, WezTerm, Ghostty, Konsole → Kitty Graphics Protocol
- iTerm2, VS Code → iTerm2 Inline Images Protocol

**Usage:**
```python
from command_center.visualization.terminal_display import display_png_in_terminal

display_png_in_terminal(png_bytes)
```

---

### Module: `command_center.tauri_api` (NEW in v2.0+)

**Purpose:** JSON API bridge for Tauri desktop application

The `tauri_api` module provides a command-line interface that outputs JSON for consumption by the Tauri desktop app. All functions write JSON to stdout.

#### CLI Commands

**Dashboard Endpoint:**
```bash
python -m command_center.tauri_api dashboard \
  --from 2025-01-01 \
  --to 2025-12-31 \
  --refresh 0 \
  --granularity month \
  --project PROJECT_ID  # Optional (v3)
```

**Returns:**
- `daily_stats`: Array of daily activity data
- `timeline`: Timeline data (month/week/day granularity)
- `model_distribution`: Per-model token distribution
- `hourly_profile`: 24-hour activity profile
- `recent_sessions`: Last 10 sessions
- `totals`: Aggregate statistics
- `limit_events`: Session limit events (v2)
- `png_base64`: Base64-encoded PNG report

**Day Details Endpoint:**
```bash
python -m command_center.tauri_api day \
  --date 2025-06-15 \
  --project PROJECT_ID  # Optional (v3)
```

**Returns:**
- `date`: Query date
- `total_messages`: Message count
- `total_sessions`: Session count
- `total_tokens`: Token total
- `hourly_breakdown`: Per-hour statistics
- `top_models`: Model usage for this day
- `sessions`: Session details

**Model Details Endpoint:**
```bash
python -m command_center.tauri_api model \
  --model claude-sonnet-4-20250514 \
  --from 2025-01-01 \
  --to 2025-12-31 \
  --project PROJECT_ID  # Optional (v3)
```

**Returns:**
- `model`: Model name (formatted)
- `total_tokens`: Total tokens
- `daily_usage`: Daily breakdown
- `hourly_profile`: 24-hour profile

**Session Details Endpoint:**
```bash
python -m command_center.tauri_api session --id SESSION_UUID
```

**Returns:**
- `session_id`: Session UUID
- `messages`: Array of messages
- `total_tokens`: Session total
- `model`: Model used

#### Query Functions (NEW in v2.0+)

**`query_timeline_data(conn, date_from, date_to, granularity, project_id=None)`**

Returns timeline data for charts (month/week/day).

**`query_model_distribution(conn, date_from, date_to, project_id=None)`**

Returns per-model token distribution.

**`query_hourly_profile(conn, date_from, date_to, project_id=None)`**

Returns 24-hour activity profile (0-23).

**`query_recent_sessions(conn, limit=10, project_id=None)`**

Returns most recent sessions.

**`query_totals(conn, date_from, date_to, project_id=None)`**

Returns aggregate statistics.

**`query_day_details(conn, date, project_id=None)`**

Returns detailed breakdown for a specific day.

**`query_model_details(conn, model, date_from, date_to, project_id=None)`**

Returns model-specific analytics.

**`query_session_details(conn, session_id)`**

Returns full session message list.

**Project Filtering (v3):**
All query functions support optional `project_id` parameter for filtering by project:
```python
query_totals(conn, "2025-01-01", "2025-12-31", project_id="-home-user-dev-myproject")
```

---

