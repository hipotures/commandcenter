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
│   └── ui/                      # React frontend (Vite)
│       ├── eslint.config.js     # Layering guardrails
│       └── src/
│           ├── app/             # Providers, theme sync, app root
│           ├── pages/           # Page-level containers (dashboard)
│           ├── features/        # User actions (date range, export, notices)
│           ├── components/      # Reusable UI building blocks
│           ├── lib/             # Pure utilities (date/time/format/charts)
│           ├── state/           # React Query store + API hooks
│           ├── styles/          # Tokens and global CSS
│           ├── types/           # TypeScript types
│           └── main.tsx         # UI entry point
├── pyproject.toml               # Package metadata
├── requirements.txt             # Dependencies
└── uv.lock                      # Locked dependencies
```

### Desktop UI Architecture (Tauri)

The desktop dashboard UI is organized as a layered frontend with clear dependency direction:
- Runtime layers: `app/` -> `pages/` -> `features/` -> `components/` -> `lib/`
- Shared resources: `styles/` and `types/` are available to all layers
- State access: `state/` is used only by `app/`, `pages/`, and `features/`

**Key layout details:**
- `app/App.tsx` is now a small entry point (~50 lines) that wires providers (React Query, theme sync) and renders the dashboard page.
- `pages/dashboard/` owns the screen composition and view model mapping (`mapApiToViewModel.ts` + `useDashboardViewModel.ts`).
- Dashboard-only UI (header, settings, drawers) is colocated under `pages/dashboard/components/`.
- User-facing interactions are isolated in `features/`:
  - `date-range/`: Date range picker with quick presets (7d, 30d, 90d, YTD) and custom range selection
  - `export-dashboard/`: PNG export via html-to-image with Tauri file dialog (browser fallback included)
  - `range-notice/`: Animated notice when selected range extends beyond available data
- Reusable cards/charts/tables live under `components/`.
- Pure helpers sit in `lib/` for easy testing and reuse (no React dependencies, no state access).

**ViewModel Pattern:**
- `mapApiToViewModel.ts`: Pure function transforming API response to UI-friendly format (fully testable without React)
- `useDashboardViewModel.ts`: Thin hook adapter providing memoization around the pure mapping function

**Guardrails:**
ESLint configuration enforces layer boundaries via `import/no-restricted-paths` and `@typescript-eslint/consistent-type-imports`:
- `lib/` cannot import from React layers or state
- `components/` cannot access state, features, or pages
- `features/` cannot cross-import (each feature is isolated)
- Type imports use explicit `import type` syntax

**Design Decisions:**
- **No barrel files** in `lib/` and `components/` (avoids Vite dev server slowdown from unnecessary module graph traversal)
- **Colocation first**: Components move to shared `components/` only when reused in 2+ places
- **Tauri detection**: Runtime check for `window.__TAURI__` or `window.__TAURI_INTERNALS__` with browser fallback

---
