"""
File change detection
"""
import os
from typing import List

from command_center.database.models import FileStatus


def detect_file_changes(discovered_files: List[str],
                       tracked: dict[str, tuple[int, int]]) -> List[FileStatus]:
    """
    Detect which files are new, modified, or unchanged.

    Args:
        discovered_files: List of file paths found on filesystem
        tracked: Dict mapping file_path → (mtime_ns, size_bytes) from database

    Returns:
        List of FileStatus objects
    """
    statuses = []

    for file_path in discovered_files:
        try:
            stat = os.stat(file_path)
        except OSError:
            # File no longer exists or not accessible
            continue

        mtime_ns = stat.st_mtime_ns
        size_bytes = stat.st_size

        if file_path not in tracked:
            status = "new"
        elif tracked[file_path] != (mtime_ns, size_bytes):
            status = "modified"
        else:
            status = "unchanged"

        statuses.append(FileStatus(
            path=file_path,
            status=status,
            mtime_ns=mtime_ns,
            size_bytes=size_bytes
        ))

    return statuses
