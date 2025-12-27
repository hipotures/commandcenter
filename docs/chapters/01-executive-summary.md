# Command Center: Technical Documentation

**Version:** 2.0.0
**Last Updated:** 2025-12-27
**Author:** Technical Documentation Team

---


---

## Executive Summary

Command Center is a SQLite-based analytics platform designed to process, analyze, and visualize Claude Code usage data. The system transforms raw JSONL session files into meaningful insights through a sophisticated data pipeline featuring intelligent caching, UTC-to-local time conversion, and pre-computed aggregations.

**Key Capabilities:**
- Processes historical Claude Code session data from multiple years
- Intelligent incremental updates (5 seconds for new data vs. 1-2 minutes for full scan)
- Hourly aggregation with local timezone awareness
- Multi-year analytics with model-specific statistics
- Visual usage reports with activity heatmaps

**Primary Use Cases:**
- Usage reports for Claude Code activity
- Usage pattern analysis across time zones
- Token consumption tracking and cost analysis
- Model comparison and performance metrics

---

