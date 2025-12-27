"""
Date and time utility functions

Handles UTC to local time conversion for hourly aggregation.
"""
from datetime import datetime
from typing import Optional


def parse_iso_timestamp(timestamp_str: str) -> Optional[datetime]:
    """
    Parse ISO 8601 timestamp string (UTC with Z suffix).

    Args:
        timestamp_str: ISO timestamp like "2025-11-27T02:09:11.551Z"

    Returns:
        datetime object (timezone-aware) or None if invalid
    """
    if not timestamp_str:
        return None

    try:
        # Replace Z with +00:00 for proper UTC parsing
        ts = timestamp_str.replace('Z', '+00:00')
        dt = datetime.fromisoformat(ts)
        return dt
    except (ValueError, AttributeError):
        return None


def convert_to_local(dt: datetime) -> datetime:
    """
    Convert UTC datetime to local timezone.

    Args:
        dt: Timezone-aware datetime object

    Returns:
        datetime in local timezone
    """
    if dt.tzinfo is None:
        # Assume UTC if no timezone info
        dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)

    # Convert to local timezone
    return dt.astimezone()


def format_datetime_hour(dt: datetime) -> str:
    """
    Format datetime as hourly bucket (YYYY-MM-DD HH:00:00).

    Args:
        dt: datetime object (should be in local timezone)

    Returns:
        String like "2025-12-27 14:00:00"
    """
    return dt.strftime('%Y-%m-%d %H:00:00')


def format_date_key(dt: datetime) -> str:
    """
    Format datetime as date key (YYYY-MM-DD).

    Args:
        dt: datetime object

    Returns:
        String like "2025-12-27"
    """
    return dt.strftime('%Y-%m-%d')


def parse_and_convert_to_local(timestamp_str: str) -> Optional[datetime]:
    """
    Parse ISO timestamp and convert to local time in one step.

    Args:
        timestamp_str: ISO timestamp like "2025-11-27T02:09:11.551Z"

    Returns:
        datetime in local timezone or None if invalid
    """
    dt_utc = parse_iso_timestamp(timestamp_str)
    if dt_utc is None:
        return None
    return convert_to_local(dt_utc)
