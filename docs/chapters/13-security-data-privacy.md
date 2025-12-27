## Security & Data Privacy

### Threat Model

**Assumptions:**
- User has physical access to their own machine
- User trusts local processes
- No network adversaries (no network operations)

**Out of Scope:**
- Multi-user systems (not designed for shared environments)
- Remote attackers (no network surface)
- Hardware attacks (physical security)

### Data Privacy

#### What Data is Collected?

**Stored in Database:**
- Session IDs (UUIDs)
- Request IDs (UUIDs)
- Message IDs (UUIDs)
- Timestamps (UTC and local)
- Model names
- Token counts
- Costs (USD)
- Source file paths

**NOT Stored:**
- Message content (prompts or responses)
- User identifiers (names, emails)
- Project names or paths (beyond JSONL locations)
- API keys or credentials

#### Where is Data Stored?

**Database Location:** `~/.claude/db/cc-sessions.db`

**File Permissions:** Default (user-only read/write on Unix-like systems)

**Encryption:** None (data is local, OS-level encryption recommended)

#### Data Retention

**Retention Policy:** Indefinite (user controls deletion)

**Deletion:**
```bash
# Remove database
rm ~/.claude/db/cc-sessions.db

# Remove PNG outputs
rm cc-usage-report-*.png
```

**Selective Deletion:**
```sql
-- Delete entries older than 2 years
DELETE FROM message_entries WHERE year < 2023;

-- Vacuum to reclaim space
VACUUM;
```

### Security Best Practices

#### 1. File Permissions

**Recommendation:** Restrict database to user-only access.

```bash
chmod 600 ~/.claude/db/cc-sessions.db
```

#### 2. Backup Strategy

**Recommendation:** Regular backups to encrypted storage.

```bash
# Backup database
cp ~/.claude/db/cc-sessions.db ~/backups/cc-sessions-$(date +%Y%m%d).db

# Encrypt backup
gpg -e ~/backups/cc-sessions-20251227.db
```

#### 3. Multi-User Systems

**Warning:** Command Center is NOT designed for shared systems.

**Mitigation:**
- Use per-user installations
- Restrict `~/.claude/` directory permissions
- Consider separate user accounts

#### 4. Cloud Sync

**Warning:** Do NOT sync database to cloud storage (Dropbox, Google Drive, etc.).

**Rationale:**
- SQLite doesn't handle concurrent writes from multiple machines
- Database corruption risk
- Privacy exposure

**Alternative:** Export statistics as JSON/CSV for sharing.

---

