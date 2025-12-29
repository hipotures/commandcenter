"""
Claude Code Wrapped - Modern SQLite-based analytics

A modular Python application for analyzing Claude Code usage with intelligent caching.
"""

try:
    from importlib.metadata import version
    __version__ = version("command-center")
    if not __version__:
        raise RuntimeError("Missing package version metadata")
except Exception:
    # Fallback for development mode
    __version__ = "2.5.0-dev"

__author__ = "Claude Code"
