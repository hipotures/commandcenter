## Incremental Update Mechanism

### The Performance Problem

**Full Scan:**
- Scan 500 JSONL files
- Parse 500K lines
- Process 500K entries
- Time: 1-2 minutes

**Daily Usage:**
- New files: 1-5
- New lines: 100-500
- Wasted work: 99.9%

**Solution:** Track processed files and skip unchanged ones.

### Incremental Update Algorithm

```python
def perform_incremental_update(conn, force_rescan=False):
    # 1. Discover all JSONL files
    discovered_files = scan_jsonl_files()

    # 2. Detect changes
    if force_rescan:
        files_to_process = discovered_files
    else:
        tracked = get_file_tracks(conn)  # {path: (mtime, size)}
        statuses = detect_file_changes(discovered_files, tracked)
        files_to_process = [
            fs.path for fs in statuses
            if fs.status in ("new", "modified")
        ]

    # 3. Track affected aggregates
    affected_hours = set()
    affected_years = set()

    # 4. Process each file
    for file_path in files_to_process:
        entries = parse_file(file_path)
        insert_message_entries(conn, entries)

        # Collect affected hours/years
        for entry in entries:
            affected_hours.add(entry.datetime_hour)
            affected_years.add(entry.year)

        # Update file tracking
        update_file_track(conn, file_path, mtime, size, len(entries))

    # 5. Recompute only affected aggregates
    recompute_hourly_aggregates(conn, affected_hours)
    for year in affected_years:
        recompute_model_aggregates(conn, year)

    return len(files_to_process)
```

### Change Detection Logic

**File Fingerprint:**
```python
def get_file_fingerprint(file_path):
    stat = os.stat(file_path)
    return (stat.st_mtime_ns, stat.st_size)
```

**Why `mtime_ns` Instead of `mtime`?**
- Higher precision: Nanoseconds vs. seconds
- Detects rapid changes: Multiple edits within same second
- Platform-consistent: All modern filesystems support nanosecond precision

**Change Detection:**
```python
def detect_file_changes(discovered, tracked):
    for file_path in discovered:
        current = get_file_fingerprint(file_path)
        cached = tracked.get(file_path)

        if cached is None:
            status = "new"
        elif current != cached:
            status = "modified"
        else:
            status = "unchanged"

        yield FileStatus(path, status, current)
```

### Selective Aggregate Recomputation

**Problem:** Recomputing all aggregates is expensive.

**Solution:** Track which hours/years received new data, recompute only those.

**Example:**

```python
# New entry arrives
entry = MessageEntry(
    timestamp_local="2025-12-27T14:30:00-08:00",
    year=2025,
    ...
)

# Extract affected aggregates
datetime_hour = "2025-12-27 14:00:00"  # Hour bucket
year = 2025

affected_hours.add(datetime_hour)
affected_years.add(year)

# After processing all files, recompute
recompute_hourly_aggregates(conn, affected_hours)  # Only this hour
recompute_model_aggregates(conn, year)             # Only this year
```

**Recomputation Strategy:**

```python
def recompute_hourly_aggregates(conn, datetime_hours):
    for datetime_hour in datetime_hours:
        # Delete old aggregate
        DELETE FROM hourly_aggregates WHERE datetime_hour = ?

        # Recompute from raw data
        INSERT INTO hourly_aggregates
        SELECT ... FROM message_entries
        WHERE datetime_hour = ?
```

**Why Delete-Then-Insert vs. Update?**
- **Simpler:** No need to handle non-existent rows
- **Atomic:** Single transaction ensures consistency
- **Idempotent:** Running twice produces same result

### Force Rescan Mode

**Use Case:** Database corruption or manual reset.

**Usage:**
```bash
command-center --force-rescan
```

**Behavior:**
- Ignores file tracking
- Processes all files
- Relies on `INSERT OR IGNORE` for deduplication
- Updates file tracking for all files

**Performance:** Same as first run (1-2 minutes).

---

