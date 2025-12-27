"""
File scanning - discover .jsonl files
"""
import os
from typing import List

from commandcenter.config import CLAUDE_DIRS


def scan_jsonl_files() -> List[str]:
    """
    Scan for all .jsonl files in Claude project directories.

    Returns:
        List of absolute file paths to .jsonl files
    """
    jsonl_files = []

    for base_dir in CLAUDE_DIRS:
        projects_dir = os.path.join(base_dir, "projects")

        if not os.path.isdir(projects_dir):
            continue

        # Recursively walk project directories
        for root, dirs, files in os.walk(projects_dir):
            for filename in files:
                if filename.endswith(".jsonl"):
                    full_path = os.path.join(root, filename)
                    jsonl_files.append(full_path)

    return jsonl_files
