"""
Model name formatting utilities.

Shared between PNG generator and Tauri API.
"""


def format_model_name(model: str | None) -> str:
    """
    Format model name for display.

    Converts internal model identifiers to human-readable names.
    E.g., "claude-sonnet-4-20250514" -> "Sonnet 4"

    Args:
        model: Internal model identifier (e.g., "claude-sonnet-4-5-20251101")

    Returns:
        Human-readable model name
    """
    if not model:
        return "Unknown"

    display_name = model.replace("claude-", "")

    # Remove date suffixes
    date_suffixes = ["-20250514", "-20250929", "-20250805", "-20251101", "-20241022"]
    for suffix in date_suffixes:
        display_name = display_name.replace(suffix, "")

    # Format model variants
    replacements = [
        ("sonnet-4-5", "Sonnet 4.5"),
        ("sonnet-4", "Sonnet 4"),
        ("opus-4-5", "Opus 4.5"),
        ("opus-4-1", "Opus 4.1"),
        ("opus-4", "Opus 4"),
        ("haiku-4-5", "Haiku 4.5"),
        ("haiku-4", "Haiku 4"),
        ("haiku-3-5", "Haiku 3.5"),
        ("3-5-sonnet", "3.5 Sonnet"),
        ("3-opus", "3 Opus"),
    ]

    for old, new in replacements:
        display_name = display_name.replace(old, new)

    return display_name


def format_tokens(count: int) -> str:
    """
    Format token count for display.

    Args:
        count: Number of tokens

    Returns:
        Formatted string (e.g., "1.5M", "500K", "1,234")
    """
    if count >= 1e9:
        return f"{count / 1e9:.1f}B"
    elif count >= 1e6:
        return f"{count / 1e6:.1f}M"
    elif count >= 1e3:
        return f"{count / 1e3:.1f}K"
    else:
        return f"{count:,}"


def format_cost(cost: float) -> str:
    """
    Format cost for display.

    Args:
        cost: Cost in USD

    Returns:
        Formatted string (e.g., "$1,234.56", "$0.12")
    """
    if cost >= 1000:
        return f"${cost:,.0f}"
    elif cost >= 1:
        return f"${cost:.2f}"
    else:
        return f"${cost:.4f}"
