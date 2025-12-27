## Deployment & Configuration

### Installation Methods

#### Method 1: Global Installation (Recommended)

```bash
cd /home/xai/DEV/command-center
uv tool install -e .
```

**Advantages:**
- Available system-wide
- No environment activation needed
- Command: `command-center`

**Location:** Installed in `~/.local/share/uv/tools/`

#### Method 2: Virtual Environment

```bash
cd /home/xai/DEV/command-center
uv sync
source .venv/bin/activate
command-center --verbose
```

**Advantages:**
- Isolated dependencies
- Development-friendly

**Disadvantages:**
- Requires activation

#### Method 3: Direct Execution

```bash
cd /home/xai/DEV/command-center
uv run command-center --verbose
```

**Advantages:**
- No installation needed
- One-off execution

**Disadvantages:**
- Slower startup (uv resolves deps each time)

### Configuration

**File:** `/home/xai/DEV/command-center/src/command_center/config.py`

#### Environment Variables

**None.** All configuration is hardcoded in `config.py`.

**Future Enhancement:** Support `~/.config/command-center/config.toml` for user overrides.

#### Configurable Constants

```python
# Database location
DB_PATH = os.path.join(HOME, ".claude", "db", "command_center.db")

# Claude directories to scan
CLAUDE_DIRS = [
    os.path.join(HOME, ".claude"),
    os.path.join(HOME, ".config", "claude")
]

# Batch insert size
BATCH_INSERT_SIZE = 100

# Canvas size
CANVAS_WIDTH = 1500
CANVAS_HEIGHT = 1400
```

**Customization:**

```python
# To change database location, edit config.py:
DB_PATH = "/custom/path/to/database.db"

# To add more Claude directories:
CLAUDE_DIRS.append("/mnt/backup/.claude")
```

### CLI Usage

```bash
command-center [OPTIONS]
```

**Options:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--from DATE` | String | Jan 1 of current year | Start date (YYYY-MM-DD or YYYYMMDD) |
| `--to DATE` | String | Today | End date (YYYY-MM-DD or YYYYMMDD) |
| `--verbose` | Boolean | False | Show detailed progress |
| `--force-rescan` | Boolean | False | Reprocess all files |
| `--rebuild-db` | Boolean | False | Delete and rebuild database |
| `--db-stats` | Boolean | False | Show database statistics and exit |

**Examples:**

```bash
# Generate report for current year (verbose)
command-center --verbose

# Generate report for specific date range
command-center --from 2024-01-01 --to 2024-12-31

# Force full rescan (useful if files were modified externally)
command-center --force-rescan

# Rebuild database from scratch
command-center --rebuild-db --verbose

# Show database statistics
command-center --db-stats
```

### System Requirements

**Minimum:**
- Python 3.10+
- 100 MB disk space (database + dependencies)
- 100 MB RAM
- Linux/macOS/Windows

**Recommended:**
- Python 3.11+
- SSD (for faster database operations)
- Terminal with inline image support (Kitty, iTerm2, WezTerm, etc.)

### Dependencies

**Runtime Dependencies:**

```
Pillow>=10.0.0    # PNG generation
rich>=13.0.0      # Terminal UI
```

**Build Dependencies:**

```
hatchling         # Build backend
```

**Locked Dependencies:** See `uv.lock` for exact versions.

### Troubleshooting Installation

#### Issue: `uv not found`

**Solution:** Install uv package manager:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

#### Issue: `Pillow installation fails`

**Cause:** Missing system libraries (libjpeg, libpng, etc.)

**Solution (Debian/Ubuntu):**
```bash
sudo apt-get install libjpeg-dev libpng-dev
uv tool install -e .
```

**Solution (macOS):**
```bash
brew install libjpeg libpng
uv tool install -e .
```

#### Issue: `Database locked`

**Cause:** Another process has the database open.

**Solution:**
```bash
# Find process
lsof ~/.claude/db/command_center.db

# Kill process or wait for completion
```

---

