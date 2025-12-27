"""
Parser for session limit events from JSONL summary entries
"""
import json
import re
from datetime import datetime, timedelta
from typing import Optional

from command_center.database.models import LimitEvent
from command_center.utils.date_helpers import parse_and_convert_to_local, format_date_key


def parse_reset_time(occurred_at_local: datetime, reset_text: str) -> datetime:
    """
    Parse reset time from text like 'resets 12am' or 'resets 6pm'.

    Handles midnight crossing intelligently:
    - If reset hour > current hour: reset today
    - If reset hour <= current hour: reset tomorrow

    Args:
        occurred_at_local: When the limit was reached (local time)
        reset_text: Text like "resets 12am", "resets 6pm", "resets Dec 12, 1pm"

    Returns:
        datetime: When the limit will reset (local time)
    """
    # Try pattern: "resets HH{am|pm}" with optional timezone in parentheses
    # Examples: "resets 1am", "resets 1am (Europe/Warsaw)", "resets 12pm (UTC)"
    match = re.search(r'resets (\d+)(am|pm)(?:\s*\([^)]+\))?', reset_text, re.IGNORECASE)
    if match:
        hour_12 = int(match.group(1))
        period = match.group(2).lower()

        # Convert to 24-hour format
        if period == 'am':
            reset_hour = 0 if hour_12 == 12 else hour_12
        else:  # pm
            reset_hour = 12 if hour_12 == 12 else hour_12 + 12

        # Build reset datetime for today (preserve timezone from occurred_at_local)
        reset_date = occurred_at_local.date()
        reset_time = datetime.min.time().replace(hour=reset_hour)
        reset_dt = datetime.combine(reset_date, reset_time)

        # Add timezone info if occurred_at_local has it
        if occurred_at_local.tzinfo is not None:
            reset_dt = reset_dt.replace(tzinfo=occurred_at_local.tzinfo)

        # If reset is in the past, it means next day
        if reset_dt <= occurred_at_local:
            reset_dt += timedelta(days=1)

        return reset_dt

    # Try pattern: "resets Dec 12, 1pm" (spending cap format)
    match = re.search(r'resets ([A-Za-z]+) (\d+),?\s*(\d+)(am|pm)', reset_text, re.IGNORECASE)
    if match:
        month_name = match.group(1)
        day = int(match.group(2))
        hour_12 = int(match.group(3))
        period = match.group(4).lower()

        # Convert to 24-hour format
        if period == 'am':
            reset_hour = 0 if hour_12 == 12 else hour_12
        else:  # pm
            reset_hour = 12 if hour_12 == 12 else hour_12 + 12

        # Parse month name
        month_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }
        month = month_map.get(month_name.lower()[:3], occurred_at_local.month)

        # Determine year (might be next year if month/day already passed)
        year = occurred_at_local.year
        reset_dt = datetime(year, month, day, reset_hour, 0, 0)

        # Add timezone info if occurred_at_local has it
        if occurred_at_local.tzinfo is not None:
            reset_dt = reset_dt.replace(tzinfo=occurred_at_local.tzinfo)

        # If reset date is in the past, try next year
        if reset_dt <= occurred_at_local:
            reset_dt = datetime(year + 1, month, day, reset_hour, 0, 0)
            if occurred_at_local.tzinfo is not None:
                reset_dt = reset_dt.replace(tzinfo=occurred_at_local.tzinfo)

        return reset_dt

    # Fallback: assume 24 hours from now (preserves timezone)
    return occurred_at_local + timedelta(hours=24)


def classify_limit_type(summary_text: str) -> Optional[str]:
    """
    Classify the type of limit from summary text.

    Returns:
        '5-hour', 'session', 'spending_cap', 'context', or None
    """
    text_lower = summary_text.lower()

    if '5-hour limit' in text_lower:
        return '5-hour'
    elif 'session limit' in text_lower:
        return 'session'
    elif 'spending cap' in text_lower:
        return 'spending_cap'
    elif 'context limit' in text_lower or 'api context limit' in text_lower:
        return 'context'
    else:
        return None


def parse_limit_event(line: str, source_file: str) -> Optional[LimitEvent]:
    """
    Parse a JSONL line for limit event (summary or error message entries).

    Supports two formats:
    1. Old format: type="summary" with summary field
    2. New format: type="assistant" with error="rate_limit" and message.content[].text

    Args:
        line: Raw JSONL line
        source_file: Path to source .jsonl file

    Returns:
        LimitEvent or None if not a limit event
    """
    line = line.strip()
    if not line:
        return None

    try:
        entry = json.loads(line)
    except json.JSONDecodeError:
        return None

    # Check for OLD format: summary entry with limit information
    if entry.get('type') == 'summary':
        summary_text = entry.get('summary', '')
        if not summary_text:
            return None

        # Classify limit type
        limit_type = classify_limit_type(summary_text)
        if not limit_type:
            return None

        # Get leaf_uuid for deduplication
        leaf_uuid = entry.get('leafUuid')
        if not leaf_uuid:
            return None

        # Extract reset text
        reset_match = re.search(r'resets [^∙]+', summary_text, re.IGNORECASE)
        reset_text = reset_match.group(0) if reset_match else None

        # Return partial event (timestamp will be filled by pipeline)
        return LimitEvent(
            leaf_uuid=leaf_uuid,
            limit_type=limit_type,
            occurred_at='',  # To be filled by pipeline
            occurred_at_local='',  # To be filled by pipeline
            year=0,  # To be filled by pipeline
            date='',  # To be filled by pipeline
            hour=0,  # To be filled by pipeline
            reset_at_local='',  # To be filled by pipeline
            reset_text=reset_text,
            session_id=None,  # To be filled by pipeline
            summary_text=summary_text,
            source_file=source_file
        )

    # Check for NEW format: assistant message with rate_limit error
    if entry.get('type') == 'assistant' and entry.get('error') == 'rate_limit':
        # Extract message text from message.content[].text
        message = entry.get('message', {})
        content = message.get('content', [])

        summary_text = None
        for item in content:
            if item.get('type') == 'text':
                summary_text = item.get('text', '')
                break

        if not summary_text:
            return None

        # For new format, we can classify based on the text pattern
        # "You've hit your limit" doesn't specify which type, so we'll use generic classification
        # Check if it mentions specific limit types in the text
        limit_type = classify_limit_type(summary_text)
        if not limit_type:
            # Default to session limit for "You've hit your limit" messages
            limit_type = 'session'

        # Use uuid as leaf_uuid for deduplication
        leaf_uuid = entry.get('uuid')
        if not leaf_uuid:
            return None

        # Extract reset text (e.g., "resets 1am (Europe/Warsaw)")
        reset_match = re.search(r'resets [^·]+', summary_text, re.IGNORECASE)
        reset_text = reset_match.group(0).strip() if reset_match else None

        # For new format, timestamp is in the same entry!
        timestamp = entry.get('timestamp')
        session_id = entry.get('sessionId')

        if timestamp:
            # We have timestamp, so complete the event immediately
            try:
                return complete_limit_event(
                    LimitEvent(
                        leaf_uuid=leaf_uuid,
                        limit_type=limit_type,
                        occurred_at='',
                        occurred_at_local='',
                        year=0,
                        date='',
                        hour=0,
                        reset_at_local='',
                        reset_text=reset_text,
                        session_id=None,
                        summary_text=summary_text,
                        source_file=source_file
                    ),
                    timestamp,
                    session_id
                )
            except:
                return None
        else:
            # No timestamp - return partial event
            return LimitEvent(
                leaf_uuid=leaf_uuid,
                limit_type=limit_type,
                occurred_at='',
                occurred_at_local='',
                year=0,
                date='',
                hour=0,
                reset_at_local='',
                reset_text=reset_text,
                session_id=None,
                summary_text=summary_text,
                source_file=source_file
            )

    return None


def complete_limit_event(
    partial_event: LimitEvent,
    occurred_at_utc: str,
    session_id: Optional[str] = None
) -> LimitEvent:
    """
    Complete a partial LimitEvent with timestamp information.

    Args:
        partial_event: Partially filled LimitEvent
        occurred_at_utc: UTC timestamp when limit occurred
        session_id: Optional session ID

    Returns:
        Completed LimitEvent with all fields filled
    """
    # Convert UTC to local time
    dt_local = parse_and_convert_to_local(occurred_at_utc)
    if dt_local is None:
        raise ValueError(f"Invalid timestamp: {occurred_at_utc}")

    # Parse reset time
    reset_dt_local = None
    if partial_event.reset_text:
        reset_dt_local = parse_reset_time(dt_local, partial_event.reset_text)
    else:
        # Default: 24 hours from now
        reset_dt_local = dt_local + timedelta(hours=24)

    # Fill in all fields
    return LimitEvent(
        leaf_uuid=partial_event.leaf_uuid,
        limit_type=partial_event.limit_type,
        occurred_at=occurred_at_utc,
        occurred_at_local=dt_local.isoformat(),
        year=dt_local.year,
        date=format_date_key(dt_local),
        hour=dt_local.hour,
        reset_at_local=reset_dt_local.isoformat(),
        reset_text=partial_event.reset_text,
        session_id=session_id,
        summary_text=partial_event.summary_text,
        source_file=partial_event.source_file
    )
