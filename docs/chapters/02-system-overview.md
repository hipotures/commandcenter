## System Overview

### High-Level Architecture

Command Center follows a classic ETL (Extract, Transform, Load) architecture with an intelligent caching layer:

```
┌─────────────────┐
│  JSONL Files    │ (Source Data)
│  ~/.claude/     │
│  projects/**/   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  File Scanner   │ (Discovery)
│  Recursive walk │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Change         │ (Incremental)
│  Detection      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  JSONL Parser   │ (Transform)
│  UTC → Local    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SQLite DB      │ (Storage)
│  Indexed tables │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Aggregators    │ (Compute)
│  Hourly/Daily   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Visualization  │ (Output)
│  PNG + Terminal │
└─────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Language | Python 3.10+ | Core runtime |
| Database | SQLite 3 | Data persistence |
| Storage | WAL mode | Concurrent access |
| Visualization | Pillow (PIL) | PNG generation |
| UI | Rich | Terminal output |
| Packaging | Hatchling | Build system |
| Dependency Mgmt | uv | Package management |

### Directory Structure

```
command-center/
├── src/command_center/
│   ├── __main__.py              # Entry point & CLI
│   ├── config.py                # Configuration constants
│   ├── tauri_api.py             # JSON API for Tauri desktop app
│   ├── database/
│   │   ├── connection.py        # SQLite connection management
│   │   ├── schema.py            # Schema definitions & migrations
│   │   ├── models.py            # Data models (dataclasses)
│   │   └── queries.py           # SQL query interface
│   ├── collectors/
│   │   ├── file_scanner.py      # JSONL file discovery
│   │   ├── jsonl_parser.py      # Line-by-line parsing
│   │   ├── limit_parser.py      # Session limit event parsing
│   │   └── deduplication.py     # Hash computation
│   ├── cache/
│   │   ├── file_tracker.py      # Change detection
│   │   └── incremental_update.py # Update orchestration
│   ├── aggregators/
│   │   ├── daily_stats.py       # Daily aggregation
│   │   ├── model_stats.py       # Per-model statistics
│   │   └── streak_calculator.py # Streak computation
│   ├── visualization/
│   │   ├── png_generator.py     # Image rendering
│   │   └── terminal_display.py  # Inline display
│   ├── cli/
│   │   └── project_commands.py  # Project management CLI
│   └── utils/
│       ├── date_helpers.py      # Time conversion
│       ├── console_output.py    # Rich tables
│       ├── model_names.py       # Model name formatting
│       ├── pricing.py           # LiteLLM pricing cache
│       ├── project_helpers.py   # Project ID extraction
│       └── project_metadata.py  # JSON metadata management
├── desktop/                     # Tauri desktop application
│   ├── src-tauri/               # Rust backend
│   └── ui/                      # React frontend
├── pyproject.toml               # Package metadata
├── requirements.txt             # Dependencies
└── uv.lock                      # Locked dependencies
```

---

