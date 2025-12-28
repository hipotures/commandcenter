"""
Project metadata management with JSON persistence
"""
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from command_center.utils.project_helpers import reconstruct_absolute_path


# Default location for projects metadata JSON
PROJECTS_JSON_PATH = os.path.expanduser("~/.claude/db/command-center-projects.json")


def _get_local_now_iso() -> str:
    """Get current time in local timezone as ISO 8601 string"""
    return datetime.now().astimezone().isoformat()


def load_projects_json(json_path: str = PROJECTS_JSON_PATH) -> dict:
    """
    Load project metadata from JSON file.

    Creates empty file with default structure if it doesn't exist.

    Args:
        json_path: Path to projects JSON file

    Returns:
        Dictionary mapping project_id → metadata dict

    Example:
        {
            "-home-xai-DEV-command-center": {
                "name": "Command Center",
                "description": "Analytics tool",
                "absolute_path": "/home/xai/DEV/command-center",
                "first_seen": "2024-12-27T10:00:00+01:00",
                "last_seen": "2024-12-28T01:44:00+01:00"
            }
        }
    """
    json_path = Path(json_path)

    # Create directory if it doesn't exist
    json_path.parent.mkdir(parents=True, exist_ok=True)

    # Create empty file if it doesn't exist
    if not json_path.exists():
        with open(json_path, 'w') as f:
            json.dump({}, f, indent=2)
        return {}

    # Load existing file
    try:
        with open(json_path, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        # Corrupted file - return empty dict
        return {}


def save_projects_json(projects: dict, json_path: str = PROJECTS_JSON_PATH):
    """
    Save project metadata to JSON file.

    Args:
        projects: Dictionary mapping project_id → metadata
        json_path: Path to projects JSON file
    """
    json_path = Path(json_path)
    json_path.parent.mkdir(parents=True, exist_ok=True)

    with open(json_path, 'w') as f:
        json.dump(projects, f, indent=2, ensure_ascii=False)


def auto_discover_project(
    projects: dict,
    project_id: str,
    json_path: str = PROJECTS_JSON_PATH
) -> dict:
    """
    Add new project to metadata if not exists, update last_seen if exists.

    Args:
        projects: Current projects dictionary
        project_id: Project identifier to discover
        json_path: Path to projects JSON file

    Returns:
        Updated projects dictionary
    """
    if project_id == 'unknown':
        return projects

    now = _get_local_now_iso()

    if project_id in projects:
        # Update last_seen for existing project
        projects[project_id]['last_seen'] = now
    else:
        # Add new project with auto-generated fields
        absolute_path = reconstruct_absolute_path(project_id)

        projects[project_id] = {
            'name': '',  # User will set via UI
            'description': '',
            'absolute_path': absolute_path,
            'first_seen': now,
            'last_seen': now,
            'visible': True  # Default: show in project selector
        }

    return projects


def update_project_metadata(
    project_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    json_path: str = PROJECTS_JSON_PATH
):
    """
    Update project name and/or description via CLI.

    Args:
        project_id: Project identifier
        name: New display name (optional)
        description: New description (optional)
        json_path: Path to projects JSON file

    Raises:
        ValueError: If project_id not found in metadata
    """
    projects = load_projects_json(json_path)

    if project_id not in projects:
        raise ValueError(f"Project not found: {project_id}. Run a scan first to discover projects.")

    if name is not None:
        projects[project_id]['name'] = name

    if description is not None:
        projects[project_id]['description'] = description

    save_projects_json(projects, json_path)


def list_all_projects(json_path: str = PROJECTS_JSON_PATH) -> list[dict]:
    """
    Get all projects sorted by last_seen descending.

    Args:
        json_path: Path to projects JSON file

    Returns:
        List of project dictionaries with 'project_id' key added

    Example:
        [
            {
                'project_id': '-home-xai-DEV-command-center',
                'name': 'Command Center',
                'description': 'Analytics tool',
                'absolute_path': '/home/xai/DEV/command-center',
                'first_seen': '2024-12-27T10:00:00+01:00',
                'last_seen': '2024-12-28T01:44:00+01:00'
            },
            ...
        ]
    """
    projects = load_projects_json(json_path)

    # Convert to list with project_id key
    projects_list = []
    for project_id, metadata in projects.items():
        project_dict = {'project_id': project_id, **metadata}
        projects_list.append(project_dict)

    # Sort by last_seen descending (most recent first)
    projects_list.sort(key=lambda p: p.get('last_seen', ''), reverse=True)

    return projects_list


def update_project_fields(
    project_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    visible: Optional[bool] = None,
    json_path: str = PROJECTS_JSON_PATH
) -> dict:
    """
    Update project fields (name, description, visible) via API.

    Args:
        project_id: Project identifier
        name: New display name (optional)
        description: New description (optional)
        visible: Visibility flag (optional)
        json_path: Path to projects JSON file

    Returns:
        Updated project data dict with project_id included

    Raises:
        ValueError: If project_id not found or validation fails
    """
    projects = load_projects_json(json_path)

    if project_id not in projects:
        raise ValueError(f"Project not found: {project_id}")

    # Validacja name: max 100 znaków
    if name is not None:
        name = name.strip()
        if len(name) > 100:
            raise ValueError("Project name cannot exceed 100 characters")
        projects[project_id]['name'] = name

    # Validacja description: max 500 znaków
    if description is not None:
        description = description.strip()
        if len(description) > 500:
            raise ValueError("Project description cannot exceed 500 characters")
        projects[project_id]['description'] = description

    # Validacja visible: musi być boolean
    if visible is not None:
        if not isinstance(visible, bool):
            raise ValueError("Visible must be a boolean value")
        projects[project_id]['visible'] = visible

    save_projects_json(projects, json_path)

    # Zwróć zaktualizowany projekt z project_id
    return {'project_id': project_id, **projects[project_id]}


def ensure_visible_field(json_path: str = PROJECTS_JSON_PATH) -> int:
    """
    Backward compatibility: Add 'visible: true' to projects missing this field.

    This function is called automatically by get_projects API to ensure
    all projects have the visible field, even if they were created before
    this feature was added.

    Args:
        json_path: Path to projects JSON file

    Returns:
        Number of projects updated
    """
    projects = load_projects_json(json_path)
    updated_count = 0

    for project_id, metadata in projects.items():
        if 'visible' not in metadata:
            metadata['visible'] = True
            updated_count += 1

    if updated_count > 0:
        save_projects_json(projects, json_path)

    return updated_count
