## Aggregation Layer

### Why Pre-Aggregate?

**Query Performance:**

| Operation | Without Aggregates | With Aggregates | Speedup |
|-----------|-------------------|-----------------|---------|
| Daily activity (365 days) | 5-10s | 50-100ms | 100x |
| Top models | 2-5s | 10-20ms | 200x |
| Hourly heatmap | 10-15s | 100-200ms | 75x |

**Storage Overhead:**
- Message entries: ~50 MB (500K rows)
- Hourly aggregates: ~500 KB (8760 hours/year)
- Model aggregates: ~1 KB (10 models/year)
- Overhead: ~1% of total size

**Conclusion:** Massive performance gains for negligible storage cost.

### Aggregation Types

#### 1. Hourly Aggregation

**Input:** Raw message entries
**Output:** One row per hour in local timezone

**Computation:**
```sql
INSERT INTO hourly_aggregates
(datetime_hour, year, month, day, hour, date,
 message_count, session_count, total_tokens, total_cost_usd)
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
    SUM(COALESCE(cost_usd, 0)) as total_cost_usd
FROM message_entries
WHERE date = '2025-12-27'
  AND SUBSTR(timestamp_local, 12, 2) = '14'
GROUP BY date, SUBSTR(timestamp_local, 12, 2);
```

**Use Cases:**
- Daily activity heatmap (roll up hours → days)
- Hour-of-day analysis (when am I most active?)
- Monthly trends (roll up hours → months)

#### 2. Daily Aggregation

**Input:** Hourly aggregates
**Output:** One row per day

**Computation:**
```sql
SELECT date, SUM(message_count)
FROM hourly_aggregates
WHERE year = 2025
GROUP BY date;
```

**Use Cases:**
- GitHub-style contribution graph
- Streak calculation
- Monthly summaries

#### 3. Model Aggregation

**Input:** Raw message entries
**Output:** One row per (model, year) combination

**Computation:**
```sql
INSERT INTO model_aggregates
(model, year, total_tokens, input_tokens, output_tokens,
 cache_read_tokens, cache_write_tokens, message_count, total_cost_usd)
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

**Use Cases:**
- Top models leaderboard
- Token distribution by model
- Cost analysis per model

### Incremental Recomputation

**Challenge:** Recomputing all aggregates after every insert is too slow.

**Solution:** Track affected hours/years and recompute only those.

**Algorithm:**
```python
def process_file(conn, file_path):
    affected_hours = set()
    affected_years = set()

    entries = parse_jsonl_file(file_path)

    for entry in entries:
        # Extract hour and year
        dt_local = parse_and_convert_to_local(entry.timestamp)
        datetime_hour = format_datetime_hour(dt_local)
        year = dt_local.year

        affected_hours.add(datetime_hour)
        affected_years.add(year)

    # Insert entries (batched)
    insert_message_entries(conn, entries)

    # Recompute only affected aggregates
    recompute_hourly_aggregates(conn, affected_hours)
    for year in affected_years:
        recompute_model_aggregates(conn, year)
```

**Example:**

Processing a file with 100 entries from December 27, 2025:
- Affected hours: `["2025-12-27 10:00:00", "2025-12-27 14:00:00", ...]` (maybe 5-10 hours)
- Affected years: `[2025]`
- Recomputation: 5-10 hour aggregates + 1 year of model aggregates
- Time: ~50-100ms

### Aggregate Consistency

**Guarantee:** Aggregates always reflect current state of message_entries.

**Mechanism:**
1. Delete old aggregate
2. Recompute from raw data
3. Atomic transaction (both or neither)

**Example:**
```python
def recompute_hourly_aggregates(conn, datetime_hours):
    for datetime_hour in datetime_hours:
        cursor.execute(
            "DELETE FROM hourly_aggregates WHERE datetime_hour = ?",
            (datetime_hour,)
        )
        cursor.execute("""
            INSERT INTO hourly_aggregates
            SELECT ... FROM message_entries
            WHERE datetime_hour = ?
        """, (datetime_hour,))

    conn.commit()  # Atomic
```

**Why Not Use Triggers?**
- SQLite triggers add overhead
- Batched updates more efficient
- Explicit control over recomputation timing

---

