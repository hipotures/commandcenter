Command Center - panel CC

---

## Claude Code Wrapped

Modern SQLite-based analytics for Claude Code usage with intelligent caching.

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
# Generate wrapped for current year
commandcenter --verbose

# Generate wrapped for specific year
commandcenter --year 2024

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

- `--year YEAR` - Year to analyze (default: current year)
- `--verbose` - Show detailed progress and statistics
- `--force-rescan` - Ignore file tracking, rescan all files
- `--rebuild-db` - Delete and rebuild database from scratch
- `--db-stats` - Show database statistics and exit

### How It Works

**First Run**: Imports ALL historical data from all years (~1-2 minutes)
**Subsequent Runs**: Only processes new/modified files (<5 seconds)

Data stored in `~/.claude/db/cc-wrapped.db` with hourly aggregation (local time).

### Output

- PNG Image: `cc-wrapped-{year}.png`
- Terminal display (Kitty/iTerm2/WezTerm/Ghostty/Konsole/VS Code)

### Requirements

- Python >= 3.10
- Pillow >= 10.0.0
- rich >= 13.0.0
