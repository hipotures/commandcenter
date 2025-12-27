## Database Schema & Design

### Schema Version Management

**Current Version:** 1
**Migration System:** Version-based with rollback support

```python
# Schema versioning
CURRENT_SCHEMA_VERSION = 1

def init_database(conn):
    create_schema_version_table(conn)
    current_version = get_schema_version(conn)

    if current_version == 0:
        create_all_tables(conn)
        set_schema_version(conn, 1)
    elif current_version < CURRENT_SCHEMA_VERSION:
        run_migrations(conn, current_version, CURRENT_SCHEMA_VERSION)
```

### Table Definitions

#### 1. `schema_version`

**Purpose:** Track database schema version for migrations.

```sql
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Fields:**
- `version`: Schema version number (1, 2, 3, ...)
- `applied_at`: UTC timestamp of migration

**Usage:** Query before running migrations to determine current version.

#### 2. `file_tracks`

**Purpose:** Track which files have been processed and their state.

```sql
CREATE TABLE file_tracks (
    file_path TEXT PRIMARY KEY,
    mtime_ns INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    last_scanned TEXT NOT NULL,
    entry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_file_tracks_last_scanned
ON file_tracks(last_scanned);
```

**Fields:**
- `file_path`: Absolute path to JSONL file (primary key)
- `mtime_ns`: File modification time in nanoseconds
- `size_bytes`: File size in bytes
- `last_scanned`: ISO 8601 timestamp of last scan
- `entry_count`: Number of valid entries parsed from file

**Indexes:**
- Primary key on `file_path` (B-tree)
- Secondary index on `last_scanned` (for cleanup queries)

**Change Detection Logic:**
```python
current_fingerprint = (os.stat(file).st_mtime_ns, os.stat(file).st_size)
cached_fingerprint = (row.mtime_ns, row.size_bytes)

if current_fingerprint != cached_fingerprint:
    process_file()
```

#### 3. `message_entries`

**Purpose:** Store individual message records with UTC and local timestamps.

```sql
CREATE TABLE message_entries (
    entry_hash TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,           -- UTC
    timestamp_local TEXT NOT NULL,     -- Local
    year INTEGER NOT NULL,             -- Local
    date TEXT NOT NULL,                -- Local YYYY-MM-DD
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
);

CREATE INDEX idx_entries_year ON message_entries(year);
CREATE INDEX idx_entries_date ON message_entries(date);
CREATE INDEX idx_entries_session ON message_entries(session_id);
CREATE INDEX idx_entries_model ON message_entries(model);
```

**Fields:**
- `entry_hash`: Composite key `message.id:requestId` (primary key)
- `timestamp`: Original UTC timestamp from JSONL
- `timestamp_local`: Converted local timestamp (ISO 8601)
- `year`: Extracted from local timestamp
- `date`: Local date in YYYY-MM-DD format
- `session_id`, `request_id`, `message_id`: UUID identifiers
- `model`: Model name (e.g., "claude-sonnet-4-5-20250929")
- `cost_usd`: Cost in USD (can be NULL)
- `*_tokens`: Token counts from usage object
- `source_file`: Originating JSONL file (for debugging)

**Indexes:**
- `idx_entries_year`: Enables fast year filtering
- `idx_entries_date`: Enables fast date range queries
- `idx_entries_session`: Groups by session for session analysis
- `idx_entries_model`: Enables fast model filtering

**Index Selection Rationale:**
- Year queries are common (usage reports)
- Date queries are common (daily activity heatmaps)
- Session queries support future "session detail" views
- Model queries support model comparison features

#### 4. `hourly_aggregates`

**Purpose:** Pre-computed hourly statistics in local timezone.

```sql
CREATE TABLE hourly_aggregates (
    datetime_hour TEXT PRIMARY KEY,    -- YYYY-MM-DD HH:00:00
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    hour INTEGER NOT NULL,             -- 0-23
    date TEXT NOT NULL,                -- YYYY-MM-DD
    message_count INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd REAL DEFAULT 0
);

CREATE INDEX idx_hourly_year ON hourly_aggregates(year);
CREATE INDEX idx_hourly_date ON hourly_aggregates(date);
CREATE INDEX idx_hourly_hour ON hourly_aggregates(hour);
```

**Fields:**
- `datetime_hour`: Hourly bucket (e.g., "2025-12-27 14:00:00") - primary key
- `year`, `month`, `day`, `hour`: Extracted components for filtering
- `date`: Date portion (YYYY-MM-DD)
- `message_count`: Number of messages in this hour
- `session_count`: Distinct sessions in this hour
- `total_tokens`: Sum of all tokens
- `total_cost_usd`: Sum of costs

**Computation Example:**
```sql
-- Input: message_entries for 2025-12-27 14:00-14:59
-- Output: Single row in hourly_aggregates

INSERT INTO hourly_aggregates
SELECT
    '2025-12-27 14:00:00' as datetime_hour,
    2025 as year,
    12 as month,
    27 as day,
    14 as hour,
    '2025-12-27' as date,
    COUNT(*) as message_count,
    COUNT(DISTINCT session_id) as session_count,
    SUM(total_tokens) as total_tokens,
    SUM(cost_usd) as total_cost_usd
FROM message_entries
WHERE date = '2025-12-27'
  AND SUBSTR(timestamp_local, 12, 2) = '14';
```

**Why Denormalize Date Components?**
- Faster filtering: `WHERE year = 2025` vs. `WHERE SUBSTR(datetime_hour, 1, 4) = '2025'`
- Index-friendly: Integer comparisons are faster than string parsing
- Query clarity: Explicit columns are self-documenting

#### 5. `model_aggregates`

**Purpose:** Pre-computed per-model statistics by year.

```sql
CREATE TABLE model_aggregates (
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
);

CREATE INDEX idx_model_year ON model_aggregates(year);
```

**Fields:**
- `model`, `year`: Composite primary key
- `*_tokens`: Aggregated token counts by type
- `message_count`: Total messages for this model/year
- `total_cost_usd`: Sum of costs

**Computation Example:**
```sql
INSERT INTO model_aggregates
SELECT
    model,
    year,
    SUM(total_tokens),
    SUM(input_tokens),
    SUM(output_tokens),
    SUM(cache_read_tokens),
    SUM(cache_write_tokens),
    COUNT(*),
    SUM(COALESCE(cost_usd, 0))
FROM message_entries
WHERE year = 2025 AND model IS NOT NULL
GROUP BY model, year;
```

**Top Models Query:**
```sql
SELECT model, total_tokens, message_count, total_cost_usd
FROM model_aggregates
WHERE year = 2025
ORDER BY total_tokens DESC
LIMIT 3;
```

### Index Strategy

**Indexing Philosophy:**
1. **Primary Keys:** Always indexed (B-tree)
2. **Foreign Keys:** Index join columns (if we had FKs)
3. **Filter Columns:** Index columns in WHERE clauses
4. **Sort Columns:** Index columns in ORDER BY clauses
5. **Avoid Over-Indexing:** Don't index rarely-queried columns

**Current Indexes:**

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| file_tracks | PRIMARY | file_path | Unique file lookup |
| file_tracks | idx_file_tracks_last_scanned | last_scanned | Cleanup queries |
| message_entries | PRIMARY | entry_hash | Deduplication |
| message_entries | idx_entries_year | year | Year filtering |
| message_entries | idx_entries_date | date | Date range queries |
| message_entries | idx_entries_session | session_id | Session grouping |
| message_entries | idx_entries_model | model | Model filtering |
| hourly_aggregates | PRIMARY | datetime_hour | Unique hour lookup |
| hourly_aggregates | idx_hourly_year | year | Year filtering |
| hourly_aggregates | idx_hourly_date | date | Date filtering |
| hourly_aggregates | idx_hourly_hour | hour | Hour-of-day analysis |
| model_aggregates | PRIMARY | (model, year) | Unique model/year |
| model_aggregates | idx_model_year | year | Year filtering |

**Index Cardinality:**
- High cardinality (good for indexing): `entry_hash`, `session_id`, `date`
- Medium cardinality: `year`, `model`, `hour`
- Low cardinality (poor for indexing): `month`, `day`

### Data Integrity

**Constraints:**
- `PRIMARY KEY`: Enforces uniqueness
- `NOT NULL`: Prevents NULL in critical columns
- `DEFAULT`: Ensures sensible defaults

**No Foreign Keys:** SQLite supports FKs, but we don't use them because:
- Tables are loosely coupled
- No cascading deletes needed
- Simplifies rebuild operations

**ACID Properties:**
- **Atomicity:** Transactions are all-or-nothing
- **Consistency:** Constraints enforced
- **Isolation:** WAL mode provides snapshot isolation
- **Durability:** Changes persisted to disk

---

