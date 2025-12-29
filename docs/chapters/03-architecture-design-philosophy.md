## Architecture & Design Philosophy

### Core Design Principles

#### 1. Idempotency First

All data operations are idempotent by design:
- `INSERT OR IGNORE` for message entries (hash-based deduplication)
- `INSERT OR REPLACE` for file tracking
- `DELETE + INSERT` for aggregate recomputation

**Rationale:** Users can re-run the tool multiple times without data corruption. Failed operations can be retried safely.

#### 2. Local Time Priority

Despite UTC storage in source files, all aggregations use local timezone:
- Hourly buckets: `2025-12-27 14:00:00` (local)
- Date keys: `2025-12-27` (local)
- Year extraction: from local timestamp

**Rationale:** Users care about "when did I use Claude today" in their local context, not UTC context. A session at 11 PM PST should count for December 27, not December 28 UTC.

#### 3. Aggressive Pre-Computation

Statistics are pre-computed and stored in aggregate tables:
- `hourly_aggregates`: Per-hour metrics for all time
- `model_aggregates`: Per-model totals by year

**Rationale:** Query time is critical for user experience. Aggregating on-the-fly from millions of rows is too slow. Pre-computation trades storage space (minimal) for query speed (10-100x improvement).

#### 4. Incremental Everything

The system tracks metadata to minimize redundant work:
- File tracking: `mtime_ns` + `size_bytes` for change detection
- Hash-based deduplication: Skip duplicate entries across files
- Selective recomputation: Only recompute affected aggregates

**Rationale:** First run processes all historical data (~1-2 minutes). Subsequent runs process only new data (~5 seconds). This makes the tool practical for daily use.

#### 5. Layered Frontend Architecture (Tauri UI)

The desktop UI follows a five-layer runtime stack with dependencies flowing downward:
- `app/` -> `pages/` -> `features/` -> `components/` -> `lib/`
- `styles/` and `types/` are shared across layers
- `state/` is limited to `app/`, `pages/`, and `features/`

**Layer Responsibilities:**
- **`app/`**: Bootstrap layer (QueryClient provider, theme synchronization, global effects)
- **`pages/`**: Complete views with screen composition, data fetching, and view model transformation
- **`features/`**: User-facing interactions as isolated modules (hooks + minimal UI)
  - Each feature is self-contained and cannot import from other features
  - Examples: date range selection, PNG export with Tauri file dialog, data range notices
- **`components/`**: Reusable UI building blocks (cards, charts, tables)
  - No state access, no feature dependencies (pure presentation)
  - Promotion rule: Move from `pages/*/components/` only when reused in 2+ places
- **`lib/`**: Pure utility functions (no React, no state, no side effects)
  - Fully testable without React test environment
  - Examples: date formatters, token formatters, chart tick calculators

**Guardrails:** `desktop/ui/eslint.config.js` enforces the boundaries with `import/no-restricted-paths` and type-only imports via `@typescript-eslint/consistent-type-imports`, including explicit blocks on cross-feature imports between `features/date-range`, `features/export-dashboard`, and `features/range-notice`.

**ViewModel Pattern:**
Separation of data transformation from React rendering:
- Pure mapping functions (`mapApiToViewModel.ts`) transform API responses into view-friendly shapes
- Thin hook adapters (`useDashboardViewModel.ts`) provide memoization
- Benefits: Unit testable without React, predictable transformations, no "transform-in-render" performance issues

**No Barrel Files Policy:**
- `lib/` and `components/` use direct imports (`import { formatNumber } from '@/lib/format'`)
- Avoids Vite dev server loading entire module graphs for single-symbol imports
- Exception: `types/` can use barrel files (type elision removes them at runtime)

**Rationale:** Breaking the former monolithic `App.tsx` (~2,770 lines) into a layered structure improves testability, reuse, and long-term maintainability without changing runtime behavior. The guardrails prevent architectural erosion over time.

### Architectural Decisions

#### Why SQLite Instead of PostgreSQL/MySQL?

**Decision:** Use SQLite with WAL mode

**Rationale:**
- **Single-user workload:** Claude Code is a desktop tool with one user
- **Embedded deployment:** No separate database server to manage
- **Performance:** SQLite can handle millions of rows with proper indexing
- **Portability:** Database is a single file (~10-50 MB)
- **WAL mode:** Allows concurrent readers during writes

**Trade-offs:**
- Limited concurrent write throughput (not needed for this use case)
- No network access (not needed for this use case)

#### Why Pre-Aggregate Instead of Views?

**Decision:** Materialized aggregates in dedicated tables

**Rationale:**
- **Query performance:** Aggregating 500K+ message entries on-the-fly takes 5-10 seconds
- **Repeated queries:** Usage reports make multiple aggregate queries
- **Incremental updates:** Only recompute affected hours/years, not all data
- **Disk space:** Aggregate tables are tiny (~1% of total size)

**Trade-offs:**
- Complexity: Must maintain aggregate consistency
- Write amplification: Each new entry triggers aggregate updates

#### Why Hash-Based Deduplication?

**Decision:** Use `message.id:requestId` as composite key

**Rationale:**
- **Natural uniqueness:** Message IDs are UUIDs, request IDs are unique per session
- **Collision resistance:** Composite key eliminates practical collision risk
- **No sequential IDs:** Hash allows out-of-order processing
- **Cross-file dedup:** Same message in multiple files is detected

**Trade-offs:**
- String comparison (slower than integer PKs, but negligible for this scale)

---
