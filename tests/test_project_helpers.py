"""
Unit tests for project_helpers module
"""
import pytest
from pathlib import Path

from command_center.utils.project_helpers import extract_project_id, reconstruct_absolute_path


class TestExtractProjectId:
    """Tests for extract_project_id function"""

    def test_extract_from_projects_path(self):
        """Extract project_id from standard projects structure"""
        path = "/home/xai/.claude/projects/-home-xai-DEV-command-center/session.jsonl"
        assert extract_project_id(path) == "-home-xai-DEV-command-center"

    def test_extract_from_nested_session_path(self):
        """Extract project_id from session with tool-results subdirectory"""
        path = "/home/xai/.claude/projects/-home-xai-DEV-scriptoza/uuid/tool-results/file.txt"
        assert extract_project_id(path) == "-home-xai-DEV-scriptoza"

    def test_extract_from_different_mount(self):
        """Extract project_id from different filesystem mount"""
        path = "/home/xai/.claude/projects/-mnt-ml-kaggle/session.jsonl"
        assert extract_project_id(path) == "-mnt-ml-kaggle"

    def test_extract_returns_unknown_for_non_projects_path(self):
        """Return 'unknown' for paths not in projects structure"""
        # Legacy sessions path (doesn't exist but could in other architectures)
        path = "/home/xai/.claude/sessions/session.jsonl"
        assert extract_project_id(path) == "unknown"

    def test_extract_returns_unknown_for_random_path(self):
        """Return 'unknown' for arbitrary paths"""
        path = "/var/log/some.jsonl"
        assert extract_project_id(path) == "unknown"

    def test_extract_with_path_object(self):
        """Accept Path objects as input"""
        path = Path("/home/xai/.claude/projects/-home-xai-DEV-command-center/session.jsonl")
        assert extract_project_id(path) == "-home-xai-DEV-command-center"

    def test_extract_from_relative_path(self):
        """Handle relative paths (should resolve to absolute)"""
        # This test assumes we're not in .claude/projects directory
        path = "some/relative/path.jsonl"
        assert extract_project_id(path) == "unknown"

    def test_extract_with_double_dash(self):
        """Handle project with hidden directory (double dash in ID)"""
        path = "/home/xai/.claude/projects/-home-xai--local-bin/session.jsonl"
        assert extract_project_id(path) == "-home-xai--local-bin"


class TestReconstructAbsolutePath:
    """Tests for reconstruct_absolute_path function"""

    def test_reconstruct_standard_project(self):
        """Reconstruct path from standard project_id"""
        project_id = "-home-xai-DEV-command-center"
        assert reconstruct_absolute_path(project_id) == "/home/xai/DEV/command-center"

    def test_reconstruct_with_mount_point(self):
        """Reconstruct path from mount point project"""
        project_id = "-mnt-ml-kaggle"
        assert reconstruct_absolute_path(project_id) == "/mnt/ml/kaggle"

    def test_reconstruct_with_double_dash(self):
        """Reconstruct path with hidden directory (consecutive dashes)"""
        project_id = "-home-xai--local-bin"
        assert reconstruct_absolute_path(project_id) == "/home/xai/.local/bin"

    def test_reconstruct_returns_none_for_unknown(self):
        """Return None for 'unknown' sentinel value"""
        assert reconstruct_absolute_path("unknown") is None

    def test_reconstruct_returns_none_for_empty(self):
        """Return None for empty string"""
        assert reconstruct_absolute_path("") is None

    def test_reconstruct_returns_none_without_leading_dash(self):
        """Return None if project_id doesn't start with dash"""
        assert reconstruct_absolute_path("invalid-project-id") is None

    def test_roundtrip_consistency(self):
        """Verify extract and reconstruct are inverse operations"""
        # Note: This only works for projects structure, not arbitrary paths
        original_path = "/home/xai/DEV/command-center"
        project_id = "-home-xai-DEV-command-center"

        # Reconstruct from project_id
        reconstructed = reconstruct_absolute_path(project_id)
        assert reconstructed == original_path

        # Extract from file in projects structure
        file_path = f"/home/xai/.claude/projects/{project_id}/session.jsonl"
        extracted_id = extract_project_id(file_path)
        assert extracted_id == project_id
