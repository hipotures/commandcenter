## Time Handling & UTC Conversion

### The Timezone Problem

Claude Code stores timestamps in UTC with "Z" suffix:
```
"timestamp": "2025-11-27T02:09:11.551Z"
```

But users think in local time:
- "I used Claude at 6 PM today" → local context
- "My most active hour is 2 PM" → local context
- "I had a session on December 27" → local date

**Solution:** Convert all timestamps to local timezone before aggregation.

### Conversion Pipeline

**Step 1: Parse UTC Timestamp**

```python
def parse_iso_timestamp(timestamp_str):
    # Input: "2025-11-27T02:09:11.551Z"
    # Replace Z with +00:00 for ISO parsing
    ts = timestamp_str.replace('Z', '+00:00')
    dt = datetime.fromisoformat(ts)
    # Output: datetime(2025, 11, 27, 2, 9, 11, 551000, tzinfo=UTC)
    return dt
```

**Step 2: Convert to Local Timezone**

```python
def convert_to_local(dt):
    # Input: datetime with UTC tzinfo
    # Output: datetime with local tzinfo
    return dt.astimezone()
```

**Step 3: Format for Storage**

```python
def format_datetime_hour(dt):
    # Input: datetime in local tz
    # Output: "2025-12-27 14:00:00"
    return dt.strftime('%Y-%m-%d %H:00:00')

def format_date_key(dt):
    # Output: "2025-12-27"
    return dt.strftime('%Y-%m-%d')
```

**Combined Helper:**

```python
def parse_and_convert_to_local(timestamp_str):
    dt_utc = parse_iso_timestamp(timestamp_str)
    dt_local = convert_to_local(dt_utc)
    return dt_local
```

### Example Conversion

**Input (JSONL):**
```json
{
  "timestamp": "2025-11-27T02:09:11.551Z",
  ...
}
```

**Conversion (PST timezone, UTC-8):**
```
UTC:   2025-11-27 02:09:11.551 +00:00
       ↓ astimezone()
Local: 2025-11-26 18:09:11.551 -08:00

Extracted:
- year: 2025
- date: "2025-11-26"  (NOT 11-27!)
- datetime_hour: "2025-11-26 18:00:00"
```

**Storage:**
```sql
INSERT INTO message_entries (
    timestamp,                      -- "2025-11-27T02:09:11.551Z"
    timestamp_local,                -- "2025-11-26T18:09:11.551000-08:00"
    year,                           -- 2025
    date,                           -- "2025-11-26"
    ...
)
```

### Timezone Edge Cases

#### Case 1: Daylight Saving Time Transitions

**Spring Forward (2 AM → 3 AM):**
```
2025-03-09 01:59:59 -08:00 (PST)
2025-03-09 03:00:00 -07:00 (PDT)  # 2 AM doesn't exist!
```

**Handling:** Python's `astimezone()` handles this automatically. No entries will have "02:XX:XX" during spring forward.

**Fall Back (2 AM → 1 AM):**
```
2025-11-02 01:59:59 -07:00 (PDT, first time)
2025-11-02 01:00:00 -08:00 (PST, second time)
```

**Handling:** Entries will have two "01:XX:XX" hours. Hourly aggregates will group both into separate buckets based on full timestamp.

#### Case 2: International Date Line

**User in Hawaii (UTC-10) at 11 PM:**
```
Local:  2025-12-27 23:00:00 -10:00
UTC:    2025-12-28 09:00:00 +00:00
```

**Storage:** Date is `2025-12-27` (local), not `2025-12-28` (UTC).

#### Case 3: Historical Timezone Changes

**Example:** Russia changed timezones in 2014.

**Handling:** Python's `astimezone()` uses the system's timezone database (tzdata), which includes historical changes. Conversion is accurate for all dates.

### Why Store Both UTC and Local?

**UTC timestamp:**
- Original source of truth
- Allows recalculation if user changes timezone
- Comparable across timezones

**Local timestamp:**
- Used for aggregation
- Faster queries (no conversion needed)
- Human-readable in database

**Trade-off:** Slightly more storage (two timestamp columns) for significantly better query performance and debugging.

---

