"""
Streak calculation logic
"""
from datetime import datetime, timedelta
from typing import Tuple


def calculate_streaks(daily_activity: dict[str, int]) -> Tuple[int, int]:
    """
    Calculate max streak and current streak from daily activity.

    Args:
        daily_activity: Dict mapping date (YYYY-MM-DD) → message_count

    Returns:
        (max_streak, current_streak)
    """
    if not daily_activity:
        return 0, 0

    # Parse and sort dates
    dates = sorted([datetime.strptime(d, "%Y-%m-%d") for d in daily_activity.keys()])

    # Calculate max streak
    max_streak = 0
    temp_streak = 0

    for i in range(len(dates)):
        if i == 0:
            temp_streak = 1
        else:
            delta = dates[i] - dates[i-1]
            if delta.days == 1:
                temp_streak += 1
            elif delta.days > 1:
                temp_streak = 1
        max_streak = max(max_streak, temp_streak)

    # Calculate current streak
    active_date_strs = set(daily_activity.keys())
    current_streak = 0
    curr = datetime.now()
    curr_str = curr.strftime("%Y-%m-%d")

    # If not active today, check yesterday
    if curr_str not in active_date_strs:
        curr = curr - timedelta(days=1)
        curr_str = curr.strftime("%Y-%m-%d")
        if curr_str not in active_date_strs:
            return max_streak, 0

    # Count backwards
    while curr_str in active_date_strs:
        current_streak += 1
        curr = curr - timedelta(days=1)
        curr_str = curr.strftime("%Y-%m-%d")

    return max_streak, current_streak
