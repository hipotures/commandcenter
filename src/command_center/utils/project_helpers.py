"""
Project ID extraction and path reconstruction utilities
"""
from pathlib import Path
from typing import Optional


def extract_project_id(file_path: str | Path) -> str:
    """
    Extract project_id from file path in ~/.claude/projects/ structure.

    Pattern: ~/.claude/projects/{project_id}/{session}.jsonl

    The project_id is derived from the absolute path by replacing '/' with '-'.
    For example:
        /home/xai/DEV/command-center → -home-xai-DEV-command-center

    Args:
        file_path: Absolute or relative path to a .jsonl file

    Returns:
        project_id if path matches pattern, otherwise 'unknown'

    Examples:
        >>> extract_project_id("/home/xai/.claude/projects/-home-xai-DEV-command-center/session.jsonl")
        '-home-xai-DEV-command-center'

        >>> extract_project_id("/home/xai/.claude/sessions/session.jsonl")
        'unknown'

        >>> extract_project_id("/home/xai/.claude/projects/-home-xai-DEV-command-center/uuid/tool-results/file.txt")
        '-home-xai-DEV-command-center'
    """
    path = Path(file_path).resolve()
    parts = path.parts

    try:
        # Find '.claude' directory in path
        claude_idx = None
        for i, part in enumerate(parts):
            if part == '.claude':
                claude_idx = i
                break

        if claude_idx is None:
            return 'unknown'

        # Check if next part is 'projects'
        if claude_idx + 1 < len(parts) and parts[claude_idx + 1] == 'projects':
            # Next part after 'projects' is the project_id
            if claude_idx + 2 < len(parts):
                return parts[claude_idx + 2]

    except (ValueError, IndexError):
        pass

    return 'unknown'


def reconstruct_absolute_path(project_id: str) -> Optional[str]:
    """
    Reverse transformation: Convert project_id back to absolute path.

    The project_id uses '-' to represent '/' in the absolute path.
    The leading '-' is stripped and remaining '-' are replaced with '/'.

    Args:
        project_id: Project identifier (e.g., '-home-xai-DEV-command-center')

    Returns:
        Reconstructed absolute path or None if invalid

    Examples:
        >>> reconstruct_absolute_path('-home-xai-DEV-command-center')
        '/home/xai/DEV/command-center'

        >>> reconstruct_absolute_path('unknown')
        None

        >>> reconstruct_absolute_path('-mnt-ml-kaggle')
        '/mnt/ml/kaggle'
    """
    if project_id == 'unknown' or not project_id:
        return None

    # Must start with '-'
    if not project_id.startswith('-'):
        return None

    # Remove leading dash and replace remaining dashes with slashes
    # Be careful: consecutive dashes like '--' represent '/.'
    path = project_id[1:].replace('-', '/')

    return '/' + path
