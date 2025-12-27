## Appendices

### Appendix A: Database Schema Diagram

```
┌─────────────────────┐
│  schema_version     │
├─────────────────────┤
│ version (PK)        │
│ applied_at          │
└─────────────────────┘

┌─────────────────────┐
│  file_tracks        │
├─────────────────────┤
│ file_path (PK)      │
│ mtime_ns            │
│ size_bytes          │
│ last_scanned        │
│ entry_count         │
└─────────────────────┘

┌─────────────────────┐
│  message_entries    │
├─────────────────────┤
│ entry_hash (PK)     │────┐
│ timestamp           │    │
│ timestamp_local     │    │  Used to compute
│ year                │    │  aggregates
│ date                │    │
│ session_id          │    │
│ request_id          │    │
│ message_id          │    │
│ model               │    │
│ cost_usd            │    │
│ input_tokens        │    │
│ output_tokens       │    │
│ cache_read_tokens   │    │
│ cache_write_tokens  │    │
│ total_tokens        │    │
│ source_file         │    │
└─────────────────────┘    │
                           │
        ┌──────────────────┘
        │
        ▼
┌─────────────────────┐
│  hourly_aggregates  │
├─────────────────────┤
│ datetime_hour (PK)  │
│ year                │
│ month               │
│ day                 │
│ hour                │
│ date                │
│ message_count       │
│ session_count       │
│ total_tokens        │
│ total_cost_usd      │
└─────────────────────┘

        ┌──────────────────┐
        │
        ▼
┌─────────────────────┐
│  model_aggregates   │
├─────────────────────┤
│ model (PK)          │
│ year (PK)           │
│ total_tokens        │
│ input_tokens        │
│ output_tokens       │
│ cache_read_tokens   │
│ cache_write_tokens  │
│ message_count       │
│ total_cost_usd      │
└─────────────────────┘
```

### Appendix B: JSONL Format Specification

**Example Entry:**
```json
{
  "timestamp": "2025-11-27T02:09:11.551Z",
  "sessionId": "01234567-89ab-cdef-0123-456789abcdef",
  "requestId": "fedcba98-7654-3210-fedc-ba9876543210",
  "message": {
    "id": "msg_01AbCdEfGhIjKlMnOpQrStUv",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-5-20250929",
    "content": [...],
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 1500,
      "output_tokens": 800,
      "cache_read_input_tokens": 5000,
      "cache_creation_input_tokens": 1200
    }
  },
  "costUSD": 0.023456
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | String | Yes | ISO 8601 UTC timestamp with Z suffix |
| `sessionId` | String | No | UUID identifying session |
| `requestId` | String | Yes | UUID identifying API request |
| `message.id` | String | Yes | Message ID (starts with "msg_") |
| `message.model` | String | No | Model name (e.g., "claude-sonnet-4-5-20250929") |
| `message.usage.input_tokens` | Integer | No | Input tokens (default 0) |
| `message.usage.output_tokens` | Integer | No | Output tokens (default 0) |
| `message.usage.cache_read_input_tokens` | Integer | No | Cache read tokens (default 0) |
| `message.usage.cache_creation_input_tokens` | Integer | No | Cache write tokens (default 0) |
| `costUSD` | Float | No | Cost in USD |

### Appendix C: Glossary

**Aggregate:** Pre-computed summary statistics (hourly, daily, model-based)

**Cache Hit Rate:** Ratio of cache reads to total cache operations (read + write)

**Deduplication:** Process of eliminating duplicate entries using hash-based keys

**Entry Hash:** Unique identifier for message entry (`message.id:requestId`)

**File Tracking:** Mechanism to detect changed files using mtime and size

**Hourly Bucket:** Time range rounded to hour (e.g., 14:00:00 - 14:59:59 → 14:00:00)

**Incremental Update:** Processing only new/modified files instead of all files

**JSONL:** JSON Lines format (one JSON object per line)

**Local Time:** Timezone-aware timestamp in user's local timezone

**Message Entry:** Single API request/response record from Claude Code

**Model Aggregate:** Statistics grouped by model and year

**Session:** Series of related API requests sharing a session ID

**UTC:** Coordinated Universal Time (timezone-agnostic reference time)

**Usage Report:** Visual summary of Claude Code activity for a specified date range

**WAL Mode:** Write-Ahead Logging (SQLite journaling mode for concurrent access)

### Appendix D: References

**SQLite Documentation:**
- https://www.sqlite.org/wal.html (WAL mode)
- https://www.sqlite.org/pragma.html (PRAGMA commands)
- https://www.sqlite.org/optoverview.html (Query optimization)

**Python Libraries:**
- https://pillow.readthedocs.io/ (Pillow/PIL)
- https://rich.readthedocs.io/ (Rich terminal UI)
- https://docs.astral.sh/uv/ (uv package manager)

**Terminal Protocols:**
- https://sw.kovidgoyal.net/kitty/graphics-protocol/ (Kitty Graphics Protocol)
- https://iterm2.com/documentation-images.html (iTerm2 Inline Images)

**Claude Code:**
- https://claude.ai/code (Official documentation)

### Appendix E: Future Enhancements

**Potential Features:**

1. **Web Dashboard:** Interactive web UI for exploring stats
2. **Export Formats:** JSON, CSV, Excel export
3. **Custom Date Ranges:** Analyze arbitrary date ranges, not just years
4. **Project Tagging:** Track which projects used most tokens
5. **Cost Alerts:** Notify when usage exceeds budget
6. **Performance Optimization:** Use `ujson`/`orjson` for faster parsing
7. **Configuration File:** Support `~/.config/command-center/config.toml`
8. **API Server:** Expose statistics via HTTP API
9. **Real-time Monitoring:** Watch JSONL files for live updates
10. **Multi-user Support:** Separate databases per user on shared systems

**Database Migrations:**

Future schema changes will use version-based migrations:

```python
def run_migrations(conn, from_version, to_version):
    if from_version < 2 and to_version >= 2:
        migrate_to_v2(conn)  # Add new columns/tables
        set_schema_version(conn, 2)

    if from_version < 3 and to_version >= 3:
        migrate_to_v3(conn)  # Refactor indexes
        set_schema_version(conn, 3)
```

---

