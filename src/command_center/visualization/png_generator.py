"""
PNG generation for usage report

Ported from original cc_wrapped.py
"""
import os
import datetime
from io import BytesIO
from typing import Optional

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow not installed. Run: pip install pillow")
    raise

from command_center.config import COLORS, CANVAS_WIDTH, CANVAS_HEIGHT, FONT_PATHS
from command_center.database.models import UsageStats
from command_center.aggregators.streak_calculator import calculate_streaks


def load_font(size: int):
    """Load font with fallback"""
    for path in FONT_PATHS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                pass
    return ImageFont.load_default()


def draw_rounded_rectangle(draw, xy, radius, fill, outline=None, width=1):
    """Draw a rounded rectangle"""
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def format_model_name(model: str) -> str:
    """Format model name for display"""
    display_name = model.replace("claude-", "")
    display_name = display_name.replace("-20250514", "").replace("-20250929", "").replace("-20250805", "").replace("-20251101", "")
    display_name = display_name.replace("sonnet-4-5", "Sonnet 4.5")
    display_name = display_name.replace("sonnet-4", "Sonnet 4")
    display_name = display_name.replace("opus-4-5", "Opus 4.5")
    display_name = display_name.replace("opus-4-1", "Opus 4.1")
    display_name = display_name.replace("haiku-4-5", "Haiku 4.5")
    return display_name


def format_tokens(count: int) -> str:
    """Format token count"""
    if count >= 1e9:
        return f"{count/1e9:.1f}B"
    elif count >= 1e6:
        return f"{count/1e6:.0f}M"
    else:
        return f"{count:,}"


def format_large_num(num: int) -> str:
    """Format large numbers"""
    if num >= 1e9:
        return f"{num/1e9:.1f}B"
    elif num >= 1e6:
        return f"{num/1e6:.1f}M"
    else:
        return f"{num:,}"


def generate_usage_report_png(stats: UsageStats) -> bytes:
    """
    Generate PNG image of the usage report.

    Args:
        stats: UsageStats object with all data

    Returns:
        PNG bytes
    """
    # Create canvas with background color
    img = Image.new('RGB', (CANVAS_WIDTH, CANVAS_HEIGHT), COLORS['background'])
    draw = ImageDraw.Draw(img)

    # Fonts
    font_large = load_font(48)
    font_title = load_font(48)
    font_medium = load_font(32)
    font_small = load_font(24)
    font_tiny = load_font(18)

    y_offset = 80

    # === HEADER ===
    header_text = "CLAUDE CODE USAGE REPORT"
    bbox = draw.textbbox((0, 0), header_text, font=font_large)
    text_width = bbox[2] - bbox[0]
    x_center = (CANVAS_WIDTH - text_width) // 2
    draw.text((x_center, y_offset), header_text, fill=COLORS['accent_primary'], font=font_large)

    y_offset += 60

    # Date range subtitle
    date_range_text = f"{stats.date_from} to {stats.date_to}"
    bbox = draw.textbbox((0, 0), date_range_text, font=font_medium)
    text_width = bbox[2] - bbox[0]
    x_center = (CANVAS_WIDTH - text_width) // 2
    draw.text((x_center, y_offset), date_range_text, fill=COLORS['text_secondary'], font=font_medium)

    y_offset += 90

    # === HERO STATS ===
    # Calculate stats
    first_session = stats.first_session_date.strftime('%Y-%m-%d') if stats.first_session_date else 'N/A'
    if stats.first_session_date:
        first_date_naive = stats.first_session_date.replace(tzinfo=None) if stats.first_session_date.tzinfo else stats.first_session_date
        days_ago = (datetime.datetime.now() - first_date_naive).days
    else:
        days_ago = 0

    most_active_day_str = "N/A"
    most_active_count = 0
    if stats.daily_activity:
        best_day = max(stats.daily_activity.items(), key=lambda x: x[1])
        most_active_day_str = datetime.datetime.strptime(best_day[0], "%Y-%m-%d").strftime("%b %d")
        most_active_count = best_day[1]

    # Draw hero panels
    panel_width = 500
    panel_height = 140
    panel_gap = 100
    panel_x1 = 150
    panel_x2 = panel_x1 + panel_width + panel_gap

    # Started panel
    draw_rounded_rectangle(draw, [panel_x1, y_offset, panel_x1 + panel_width, y_offset + panel_height],
                          15, fill=COLORS['background'], outline=COLORS['surface_border'], width=2)
    draw.text((panel_x1 + 20, y_offset + 15), "STARTED", fill=COLORS['text_muted'], font=font_small)
    draw.text((panel_x1 + 20, y_offset + 50), first_session, fill=COLORS['text_primary'], font=font_medium)
    draw.text((panel_x1 + 20, y_offset + 95), f"{days_ago} Days Ago", fill=COLORS['text_muted'], font=font_tiny)

    # Most active day panel
    draw_rounded_rectangle(draw, [panel_x2, y_offset, panel_x2 + panel_width, y_offset + panel_height],
                          15, fill=COLORS['background'], outline=COLORS['surface_border'], width=2)
    draw.text((panel_x2 + 20, y_offset + 15), "MOST ACTIVE DAY", fill=COLORS['text_muted'], font=font_small)
    draw.text((panel_x2 + 20, y_offset + 50), most_active_day_str, fill=COLORS['text_primary'], font=font_medium)
    draw.text((panel_x2 + 20, y_offset + 95), f"{most_active_count:,} messages", fill=COLORS['text_muted'], font=font_tiny)

    y_offset += panel_height + 60

    # === ACTIVITY HEATMAP ===
    # Build heatmap data based on date range
    # Always generate 53 weeks for visual consistency, but show data only in range
    date_from = datetime.datetime.strptime(stats.date_from, "%Y-%m-%d")
    date_to = datetime.datetime.strptime(stats.date_to, "%Y-%m-%d")

    # Start from beginning of year containing date_from
    year_start = datetime.datetime(date_from.year, 1, 1)
    current_date = year_start - datetime.timedelta(days=year_start.weekday() + 1)

    weeks = []
    week_first_days = []

    for _ in range(53):  # Always 53 weeks for full width heatmap
        week = []
        week_first_days.append(current_date)
        for _ in range(7):
            date_str = current_date.strftime("%Y-%m-%d")
            # Only show counts within the actual date range
            count = stats.daily_activity.get(date_str, 0) if date_from <= current_date <= date_to else 0
            week.append(count)
            current_date += datetime.timedelta(days=1)
        weeks.append(week)

    # Calculate intensity levels
    all_counts = [count for week in weeks for count in week if count > 0]
    max_count = max(all_counts) if all_counts else 1

    def get_heat_level(count):
        """Map count to intensity level (0-6)"""
        if count == 0:
            return 0
        if max_count == 0:
            return 0

        ratio = count / max_count

        if ratio <= 0.1:
            return 1
        elif ratio <= 0.25:
            return 2
        elif ratio <= 0.4:
            return 3
        elif ratio <= 0.6:
            return 4
        elif ratio <= 0.8:
            return 5
        else:
            return 6

    # Draw heatmap - calculate cell size to fit panel width
    # Heatmap should end at same vertical line as right edge of panels (panel_x2 + panel_width)
    heatmap_start_x = panel_x1
    heatmap_max_width = panel_width * 2 + panel_gap  # 1100px total
    weeks_count = 53
    cell_total_size = heatmap_max_width // weeks_count  # ~20.75, use 20
    cell_size = 18
    cell_gap = 2  # cell_size + cell_gap = 20

    # Align heatmap - slight offset to match panel alignment
    actual_heatmap_width = weeks_count * (cell_size + cell_gap)
    heatmap_x = heatmap_start_x + (heatmap_max_width - actual_heatmap_width) // 2 + 20
    heatmap_y = y_offset

    # Month labels
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    last_month = None
    for week_idx, week_start in enumerate(week_first_days):
        if date_from <= week_start <= date_to:
            current_month = week_start.month
            if current_month != last_month:
                x = heatmap_x + week_idx * (cell_size + cell_gap)
                draw.text((x, heatmap_y), month_names[current_month - 1], fill=COLORS['text_muted'], font=font_tiny)
                last_month = current_month

    heatmap_y += 30

    # Draw cells
    weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    for day_idx in range(7):
        # Weekday label
        draw.text((heatmap_x - 40, heatmap_y + day_idx * (cell_size + cell_gap)),
                 weekdays[day_idx], fill=COLORS['text_muted'], font=font_tiny)

        for week_idx, week in enumerate(weeks):
            x = heatmap_x + week_idx * (cell_size + cell_gap)
            y = heatmap_y + day_idx * (cell_size + cell_gap)
            level = get_heat_level(week[day_idx])
            color = COLORS['heatmap'][level]
            draw.rectangle([x, y, x + cell_size, y + cell_size], fill=color, outline=COLORS['surface_border'], width=1)

    # Legend
    legend_y = heatmap_y + 7 * (cell_size + cell_gap) + 10
    legend_x = heatmap_x

    draw.text((legend_x, legend_y), "Less", fill=COLORS['text_muted'], font=font_tiny)
    legend_x += 45

    legend_cell_size = 14
    legend_gap = 3
    for level in range(7):
        color = COLORS['heatmap'][level]
        draw.rounded_rectangle(
            [legend_x, legend_y + 2, legend_x + legend_cell_size, legend_y + 2 + legend_cell_size],
            radius=3, fill=color
        )
        legend_x += legend_cell_size + legend_gap

    legend_x += 5
    draw.text((legend_x, legend_y), "More", fill=COLORS['text_muted'], font=font_tiny)

    y_offset = legend_y + 50

    # === TOP MODELS + CACHE EFFICIENCY ===
    panel_y = y_offset
    panel_height = 250

    # Top Models (using same dimensions as top panels)
    panel_x1 = 150
    panel_width = 500
    panel_gap = 100
    panel_x2 = panel_x1 + panel_width + panel_gap

    draw_rounded_rectangle(draw, [panel_x1, panel_y, panel_x1 + panel_width, panel_y + panel_height],
                          15, fill=COLORS['background'], outline=COLORS['surface_border'], width=2)
    draw.text((panel_x1 + 20, panel_y + 20), "TOP MODELS", fill=COLORS['text_primary'], font=font_medium)

    model_y = panel_y + 80
    model_label_x = panel_x1 + 20
    model_value_x = panel_x1 + 320
    for i, model_data in enumerate(stats.top_models, 1):
        display_name = format_model_name(model_data['model'])
        token_str = format_tokens(model_data['tokens'])

        draw.text((model_label_x, model_y), f"{i}. {display_name}", fill=COLORS['text_primary'], font=font_small)
        draw.text((model_value_x, model_y), token_str, fill=COLORS['accent_primary'], font=font_small)
        model_y += 45

    # Cache Efficiency (using same dimensions as top panels)
    draw_rounded_rectangle(draw, [panel_x2, panel_y, panel_x2 + panel_width, panel_y + panel_height],
                          15, fill=COLORS['background'], outline=COLORS['surface_border'], width=2)
    draw.text((panel_x2 + 20, panel_y + 20), "CACHE EFFICIENCY", fill=COLORS['text_primary'], font=font_medium)

    cache_read = stats.cache_read_tokens
    cache_write = stats.cache_write_tokens
    hit_rate = (cache_read / (cache_read + cache_write) * 100) if (cache_read + cache_write) > 0 else 0

    cache_y = panel_y + 80
    cache_label_x = panel_x2 + 20
    cache_value_x = panel_x2 + 250
    draw.text((cache_label_x, cache_y), "Cache Read:", fill=COLORS['text_muted'], font=font_small)
    draw.text((cache_value_x, cache_y), f"{format_tokens(cache_read)} tok", fill=COLORS['accent_primary'], font=font_small)
    cache_y += 45
    draw.text((cache_label_x, cache_y), "Cache Write:", fill=COLORS['text_muted'], font=font_small)
    draw.text((cache_value_x, cache_y), f"{format_tokens(cache_write)} tok", fill=COLORS['accent_primary'], font=font_small)
    cache_y += 45
    draw.text((cache_label_x, cache_y), "Hit Rate:", fill=COLORS['text_muted'], font=font_small)
    draw.text((cache_value_x, cache_y), f"{hit_rate:.1f}%", fill=COLORS['semantic_success'], font=font_small)

    y_offset = panel_y + panel_height + 60

    # === STATS GRID ===
    max_streak, curr_streak = calculate_streaks(stats.daily_activity)

    grid_panel_height = 200
    grid_panel_width = panel_width * 2 + panel_gap  # Same total width as two panels above
    draw_rounded_rectangle(draw, [panel_x1, y_offset, panel_x1 + grid_panel_width, y_offset + grid_panel_height],
                          15, fill=COLORS['background'], outline=COLORS['surface_border'], width=2)

    stat_y1 = y_offset + 30
    stat_y2 = y_offset + 120

    # Calculate positions for 3 columns
    stat_col_width = grid_panel_width // 3
    stat_x1 = panel_x1 + 20
    stat_x2 = panel_x1 + stat_col_width + 20
    stat_x3 = panel_x1 + stat_col_width * 2 + 20

    stat_list = [
        ("SESSIONS", f"{stats.total_sessions:,}", stat_x1),
        ("MESSAGES", f"{stats.total_messages:,}", stat_x2),
        ("TOTAL TOKENS", format_large_num(stats.total_tokens), stat_x3),
        ("PROJECTS", "N/A", stat_x1),  # Projects not tracked in new version
        ("STREAK", f"{max_streak}d", stat_x2),
        ("USAGE COST", f"${stats.total_cost:,.2f}" if stats.total_cost > 0 else "N/A", stat_x3),
    ]

    for i, (label, value, x_pos) in enumerate(stat_list):
        y_pos = stat_y1 if i < 3 else stat_y2
        draw.text((x_pos, y_pos), label, fill=COLORS['text_muted'], font=font_tiny)
        draw.text((x_pos, y_pos + 30), value, fill=COLORS['accent_primary'], font=font_medium)

    # Footer
    footer_text = "claude.ai/code"
    bbox = draw.textbbox((0, 0), footer_text, font=font_small)
    text_width = bbox[2] - bbox[0]
    x_center = (CANVAS_WIDTH - text_width) // 2
    draw.text((x_center, CANVAS_HEIGHT - 60), footer_text, fill=COLORS['text_muted'], font=font_small)

    # Convert to bytes
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()
