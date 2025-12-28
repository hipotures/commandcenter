"""
Data models for database entities
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Literal


@dataclass
class FileTrack:
    """Tracks which files have been processed"""
    file_path: str
    mtime_ns: int
    size_bytes: int
    last_scanned: str  # ISO 8601 timestamp
    entry_count: int = 0


@dataclass
class MessageEntry:
    """Individual message entry from JSONL files"""
    entry_hash: str  # message.id:requestId
    timestamp: str  # ISO 8601 UTC
    timestamp_local: str  # ISO 8601 local time
    year: int  # Local year
    date: str  # YYYY-MM-DD local date
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    message_id: Optional[str] = None
    model: Optional[str] = None
    cost_usd: Optional[float] = None
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    total_tokens: int = 0
    source_file: str = ""
    project_id: str = "unknown"


@dataclass
class HourlyAggregate:
    """Pre-computed hourly statistics (local time)"""
    datetime_hour: str  # YYYY-MM-DD HH:00:00 (local)
    year: int
    month: int
    day: int
    hour: int  # 0-23
    date: str  # YYYY-MM-DD
    message_count: int = 0
    session_count: int = 0
    total_tokens: int = 0
    total_cost_usd: float = 0.0


@dataclass
class ModelAggregate:
    """Pre-computed per-model statistics"""
    model: str
    year: int
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    message_count: int = 0
    total_cost_usd: float = 0.0


@dataclass
class FileStatus:
    """Status of a file during change detection"""
    path: str
    status: Literal["new", "modified", "unchanged"]
    mtime_ns: int
    size_bytes: int


@dataclass
class LimitEvent:
    """Session limit event (5-hour limit, spending cap, etc.)"""
    leaf_uuid: str  # Unique identifier for deduplication
    limit_type: str  # '5-hour', 'session', 'spending_cap', 'context'
    occurred_at: str  # ISO 8601 UTC timestamp
    occurred_at_local: str  # ISO 8601 local timestamp
    year: int  # Local year
    date: str  # YYYY-MM-DD local date
    hour: int  # 0-23 local hour
    reset_at_local: str  # ISO 8601 local timestamp when limit resets
    reset_text: Optional[str] = None  # Original text like "resets 12am"
    session_id: Optional[str] = None
    summary_text: Optional[str] = None  # Full summary text
    source_file: str = ""


@dataclass
class UsageStats:
    """Statistics for usage report generation"""
    date_from: str  # YYYY-MM-DD
    date_to: str  # YYYY-MM-DD
    daily_activity: dict[str, int]  # date → message_count
    top_models: list[dict]  # [{model, tokens, messages, cost}, ...]
    total_messages: int
    total_sessions: int
    total_tokens: int
    total_cost: float
    cache_read_tokens: int
    cache_write_tokens: int
    first_session_date: Optional[datetime] = None
