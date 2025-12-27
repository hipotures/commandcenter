"""
JSONL parsing with UTC to local time conversion
"""
import json
from typing import Optional

from command_center.database.models import MessageEntry
from command_center.utils.date_helpers import parse_and_convert_to_local, format_datetime_hour, format_date_key
from command_center.collectors.deduplication import compute_entry_hash


def parse_jsonl_line(line: str, source_file: str) -> Optional[MessageEntry]:
    """
    Parse a single JSONL line into MessageEntry.

    Converts UTC timestamp to local time for aggregation.

    Args:
        line: Raw JSONL line
        source_file: Path to source .jsonl file

    Returns:
        MessageEntry or None if invalid/malformed
    """
    line = line.strip()
    if not line:
        return None

    try:
        entry = json.loads(line)
    except json.JSONDecodeError:
        return None

    # Compute hash for deduplication
    entry_hash = compute_entry_hash(entry)
    if not entry_hash:
        return None

    # Parse timestamp (UTC)
    timestamp = entry.get('timestamp')
    if not timestamp:
        return None

    # Convert to local time
    dt_local = parse_and_convert_to_local(timestamp)
    if dt_local is None:
        return None

    # Extract year and date from local time
    year = dt_local.year
    date = format_date_key(dt_local)
    timestamp_local = dt_local.isoformat()

    # Extract tokens
    usage = entry.get('message', {}).get('usage', {})
    input_tokens = usage.get('input_tokens', 0) or 0
    output_tokens = usage.get('output_tokens', 0) or 0
    cache_read = usage.get('cache_read_input_tokens', 0) or 0
    cache_write = usage.get('cache_creation_input_tokens', 0) or 0
    total_tokens = input_tokens + output_tokens + cache_read + cache_write

    # Build MessageEntry
    return MessageEntry(
        entry_hash=entry_hash,
        timestamp=timestamp,
        timestamp_local=timestamp_local,
        year=year,
        date=date,
        session_id=entry.get('sessionId'),
        request_id=entry.get('requestId'),
        message_id=entry.get('message', {}).get('id'),
        model=entry.get('message', {}).get('model'),
        cost_usd=entry.get('costUSD'),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_tokens=cache_read,
        cache_write_tokens=cache_write,
        total_tokens=total_tokens,
        source_file=source_file
    )
