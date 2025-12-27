## Troubleshooting Guide

### Common Issues

#### 1. No Activity Found for Year

**Symptom:**
```
No activity found for 2025
```

**Causes:**
- No JSONL files for that year
- Files exist but not in scanned directories
- All entries have invalid timestamps

**Diagnosis:**
```bash
# Check for JSONL files
find ~/.claude/projects -name "*.jsonl" -ls

# Check database
command-center --db-stats
```

**Solution:**
```bash
# Force rescan
command-center --force-rescan --verbose

# Check specific year
command-center --year 2024
```

#### 2. Database Integrity Check Failed

**Symptom:**
```
Database integrity check failed!
Run with --rebuild-db to fix
```

**Causes:**
- Disk corruption
- Interrupted write operation
- File system errors

**Solution:**
```bash
# Backup current database
cp ~/.claude/db/command_center.db ~/command-center-backup.db

# Rebuild from scratch
command-center --rebuild-db --verbose
```

#### 3. PNG Not Displaying in Terminal

**Symptom:** No image shown, or text instead of image.

**Causes:**
- Terminal doesn't support inline images
- Incorrect terminal detection
- Image data corrupted

**Diagnosis:**
```bash
# Check terminal environment
echo "TERM: $TERM"
echo "TERM_PROGRAM: $TERM_PROGRAM"
echo "KITTY_WINDOW_ID: $KITTY_WINDOW_ID"
```

**Solution:**
```bash
# Use supported terminal (Kitty, iTerm2, WezTerm, etc.)
# Or view saved PNG file
open cc-usage-report-*.png
```

#### 4. Slow Performance on Incremental Update

**Symptom:** Incremental update takes 30+ seconds.

**Causes:**
- Many modified files
- Large files
- Slow disk I/O

**Diagnosis:**
```bash
# Run with verbose mode
command-center --verbose

# Check database size
ls -lh ~/.claude/db/command_center.db
```

**Solution:**
```bash
# Rebuild database to optimize
command-center --rebuild-db

# Check disk health
df -h
```

#### 5. Memory Error During First Run

**Symptom:**
```
MemoryError: Unable to allocate...
```

**Causes:**
- Very large JSONL files (100+ MB)
- Insufficient RAM
- Memory leak (bug)

**Solution:**
```bash
# Reduce batch size in config.py
BATCH_INSERT_SIZE = 50  # Instead of 100

# Run on machine with more RAM
# Or split large JSONL files manually
```

### Debugging Techniques

#### Enable Verbose Mode

```bash
command-center --verbose
```

**Output:**
- File processing progress bar
- Entry counts per file
- Aggregate recomputation status

#### Check Database Statistics

```bash
command-center --db-stats
```

**Output:**
```
┌──────────────────────┬───────────┐
│ Metric               │ Value     │
├──────────────────────┼───────────┤
│ Total Entries        │ 500,234   │
│ Tracked Files        │ 342       │
│ Years Covered        │ 3         │
│ Database Size        │ 52.3 MB   │
└──────────────────────┴───────────┘
```

#### Inspect Database Manually

```bash
sqlite3 ~/.claude/db/command_center.db
```

```sql
-- Check schema version
SELECT * FROM schema_version;

-- Count entries by year
SELECT year, COUNT(*) FROM message_entries GROUP BY year;

-- Check file tracking
SELECT COUNT(*), SUM(entry_count) FROM file_tracks;

-- Find largest sessions
SELECT session_id, COUNT(*) as msg_count
FROM message_entries
GROUP BY session_id
ORDER BY msg_count DESC
LIMIT 10;
```

#### Validate JSONL Files

```python
import json

with open("session.jsonl") as f:
    for i, line in enumerate(f, 1):
        try:
            entry = json.loads(line)
            assert "message" in entry
            assert "id" in entry["message"]
            assert "requestId" in entry
        except Exception as e:
            print(f"Line {i}: {e}")
```

### Performance Profiling

#### Time Individual Operations

```bash
# Time full run
time command-center --rebuild-db --verbose

# Time incremental update
time command-center --verbose

# Time query only
time command-center --year 2025
```

#### Profile with cProfile

```bash
python -m cProfile -o profile.stats -m command-center --verbose
```

```python
import pstats
p = pstats.Stats('profile.stats')
p.sort_stats('cumulative').print_stats(20)
```

---

