## Deduplication Strategy

### The Duplication Problem

**Sources of Duplicates:**

1. **Multiple files:** Same message appears in different JSONL files
2. **File rewrites:** Claude Code may rewrite session files
3. **Backup restores:** User restores old backup with duplicate data
4. **Force rescan:** Processing all files again

**Without deduplication:** Database would have 2x-10x more rows than actual messages.

### Hash-Based Deduplication

**Key Insight:** Each message has a unique composite identifier.

**Hash Computation:**
```python
def compute_entry_hash(entry):
    message_id = entry['message']['id']  # UUID from Claude
    request_id = entry['requestId']      # UUID from Claude

    if not message_id or not request_id:
        return None

    return f"{message_id}:{request_id}"
```

**Example Hash:**
```
"msg_01AbCd123456:req_98ZyXw789012"
```

### Hash Properties

**1. Uniqueness**

Each Claude Code message has:
- `message.id`: Unique per API response
- `requestId`: Unique per API request

Composite key eliminates collisions:
- Probability of UUID collision: ~10^-36
- Composite collision: ~10^-72 (astronomically impossible)

**2. Determinism**

Same input always produces same hash:
```python
entry1 = {...}  # Message from file A
entry2 = {...}  # Same message from file B
compute_entry_hash(entry1) == compute_entry_hash(entry2)  # True
```

**3. Human-Readable**

String format aids debugging:
```sql
SELECT * FROM message_entries
WHERE entry_hash LIKE 'msg_01AbCd%';
```

**4. Cross-File**

Hash works across all JSONL files:
```
~/.claude/projects/project1/session1.jsonl → hash1
~/.claude/projects/project2/session2.jsonl → hash1 (duplicate!)
```

### Database Enforcement

**Primary Key Constraint:**
```sql
CREATE TABLE message_entries (
    entry_hash TEXT PRIMARY KEY,
    ...
);
```

**Insert Logic:**
```python
cursor.executemany("""
    INSERT OR IGNORE INTO message_entries
    (entry_hash, ...)
    VALUES (?, ...)
""", rows)
```

**Behavior:**
- First insert: Succeeds, row created
- Duplicate insert: Silently ignored (no error)
- Idempotent: Running N times = running once

### Edge Cases

#### Case 1: Hash Collision (Theoretical)

**Scenario:** Two different messages produce same hash.

**Probability:** ~10^-72 (impossible in practice)

**Handling:** Second message silently skipped (acceptable loss given probability).

**Mitigation:** Could add timestamp or sequence number to hash, but unnecessary.

#### Case 2: Missing IDs

**Scenario:** JSONL entry lacks `message.id` or `requestId`.

**Handling:**
```python
def compute_entry_hash(entry):
    message_id = entry.get('message', {}).get('id')
    request_id = entry.get('requestId')

    if not message_id or not request_id:
        return None  # Skip this entry
```

**Result:** Entry is not processed (logged as invalid).

#### Case 3: Partial File Processing

**Scenario:** File processing interrupted mid-way.

**Handling:**
1. Partial inserts are committed (atomicity per batch)
2. File tracking not updated (file still marked as "new")
3. Next run re-processes entire file
4. `INSERT OR IGNORE` prevents duplicates

**Result:** No data loss, no duplicates.

### Performance Implications

**Hash Computation:** O(1) per entry (string concatenation)

**Database Lookup:** O(log n) per insert (B-tree index on primary key)

**Comparison:**
- Sequential ID: O(1) insert (append-only)
- Hash-based ID: O(log n) insert (index lookup)

**Trade-off:** Slightly slower inserts (~10%) for guaranteed deduplication.

**Optimization:** Batch inserts amortize lookup cost.

---

