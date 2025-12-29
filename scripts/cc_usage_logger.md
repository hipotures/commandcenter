# cc_usage_logger

This logger stores the JSON output from `scripts/cc_usage.sh` into a local
SQLite database. Each run inserts one row into `cc_usage_events`.

## Database schema

Table: `cc_usage_events`

- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `captured_at_utc` TEXT (ISO 8601)
- `captured_at_local` TEXT (ISO 8601)
- `email` TEXT
- `current_session_used_pct` INTEGER (parsed percent)
- `current_session_used_raw` TEXT
- `current_week_used_pct` INTEGER (parsed percent)
- `current_week_used_raw` TEXT
- `current_week_resets_raw` TEXT
- `current_week_resets_local` TEXT (ISO 8601)
- `current_week_resets_utc` TEXT (ISO 8601)
- `current_week_resets_epoch` INTEGER (unix seconds)
- `current_week_resets_tz` TEXT (time zone name, if present)
- `logfile` TEXT
- `raw_json` TEXT (compact JSON payload)

Indexes:
- `idx_cc_usage_events_captured_at_utc` on `captured_at_utc`
- `idx_cc_usage_events_email` on `email`

## Usage

Default behavior is enabled from `scripts/cc_usage.sh`.

Environment variables:

- `CC_USAGE_LOG_DB=0` disables logging
- `CC_USAGE_DB_PATH=/path/to/db.sqlite` overrides the database path
- `CC_USAGE_LOGGER=/path/to/cc_usage_logger.py` overrides logger path
- `VERBOSE=1` prints verbose messages to stderr

Example:

```bash
CC_USAGE_DB_PATH=/home/xai/DEV/command-center/tmp/cc_usage.db \
VERBOSE=1 \
./scripts/cc_usage.sh
```

Direct use of the logger:

```bash
echo '{"current_session":{"used":"0% used"},"current_week_all_models":{"used":"100% used","resets":"Jan 1, 2026, 9:59am (Europe/Warsaw)"},"email":"user@example.com","logfile":"/tmp/claude-stats/usage-20251229-224107.txt"}' \
  | python3 ./scripts/cc_usage_logger.py --db /home/xai/DEV/command-center/tmp/cc_usage.db --verbose
```

You can also pass input directly:

```bash
python3 ./scripts/cc_usage_logger.py --json '{"current_session":{"used":"0% used"}}'
```

Or read from a file:

```bash
python3 ./scripts/cc_usage_logger.py --input /path/to/usage.json
```
