Command Center - panel CC

---

## Claude Code Usage Reports

Modern SQLite-based analytics for Claude Code usage with intelligent caching.

**Inspiration:** The idea and analysis approach were inspired by [cc-wrapped](https://github.com/numman-ali/cc-wrapped).

### Installation

**Option 1: Global installation (recommended)**

```bash
uv tool install -e .
```

After this, you can run `commandcenter` from anywhere without activation.

**Option 2: Local virtual environment**

```bash
uv sync
source .venv/bin/activate
```

### Usage

**After global installation (`uv tool install -e .`):**

```bash
# Generate report for current year
commandcenter --verbose

# Generate report for specific date range
commandcenter --from 2024-01-01 --to 2024-12-31

# Generate report with compact date format
commandcenter --from 20250101 --to 20250131

# Show database statistics
commandcenter --db-stats
```

**With local venv (`uv sync`):**

```bash
# Activate venv first
source .venv/bin/activate

# Then run
commandcenter --verbose
```

**Without installation:**

```bash
uv run commandcenter --verbose
```

### CLI Options

- `--from DATE` - Start date in YYYY-MM-DD or YYYYMMDD format (default: January 1 of current year)
- `--to DATE` - End date in YYYY-MM-DD or YYYYMMDD format (default: today)
- `--verbose` - Show detailed progress and statistics
- `--force-rescan` - Ignore file tracking, rescan all files
- `--rebuild-db` - Delete and rebuild database from scratch
- `--db-stats` - Show database statistics and exit

### How It Works

**First Run**: Imports ALL historical data from all years (~1-2 minutes)
**Subsequent Runs**: Only processes new/modified files (<5 seconds)

Data stored in `~/.claude/db/cc-sessions.db` with hourly aggregation (local time).

### Output

- PNG Image: `cc-usage-report-{date_from}_{date_to}.png`
- Terminal display (Kitty/iTerm2/WezTerm/Ghostty/Konsole/VS Code)

### Requirements

- Python >= 3.10
- Pillow >= 10.0.0
- rich >= 13.0.0
