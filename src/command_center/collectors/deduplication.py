"""
Deduplication logic for message entries
"""
from typing import Optional


def compute_entry_hash(entry: dict) -> Optional[str]:
    """
    Compute unique hash for a JSONL entry.

    Uses message.id:requestId as the deduplication key.

    Args:
        entry: Parsed JSONL entry (dict)

    Returns:
        Hash string or None if missing required fields
    """
    message = entry.get('message', {})
    message_id = message.get('id')
    request_id = entry.get('requestId')

    if not message_id or not request_id:
        return None

    return f"{message_id}:{request_id}"
