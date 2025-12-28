## Visualization System

### PNG Generation Architecture

**Module:** `src/command_center/visualization/png_generator.py`

**Technology:** Pillow (PIL) - Python Imaging Library

**Canvas:**
- Size: 1500x1400 pixels
- Format: RGB (no alpha channel)
- Background: #F7F1E9 (warm beige)

### Design System

**Color Palette (from design-tokens.ts):**

```python
COLORS = {
    'background': (247, 241, 233),       # #F7F1E9 - Canvas background
    'surface': (255, 249, 242),          # #FFF9F2 - Panel background
    'surface_border': (232, 215, 198),   # #E8D7C6 - Panel borders
    'text_primary': (43, 29, 19),        # #2B1D13 - Headers
    'text_secondary': (74, 52, 38),      # #4A3426 - Body text
    'text_tertiary': (107, 81, 66),      # #6B5142 - Subtext
    'text_muted': (138, 114, 100),       # #8A7264 - Labels
    'accent_primary': (217, 119, 87),    # #D97757 - Claude Code orange
    'semantic_success': (34, 197, 94),   # #22C55E - Cache hit rate
    'heatmap': [
        (240, 230, 220),  # Level 0 - Empty
        (230, 214, 200),  # Level 1 - Minimal
        (217, 193, 174),  # Level 2 - Low
        (203, 165, 144),  # Level 3 - Medium
        (188, 136, 115),  # Level 4 - High
        (174, 110, 91),   # Level 5 - Very High
        (154, 86, 71),    # Level 6 - Maximum
    ]
}
```

**Typography:**
- Font: DejaVu Sans Bold (fallback to Liberation Sans or Helvetica)
- Sizes: 72px (header), 48px (title), 32px (medium), 24px (small), 18px (tiny)

### Visual Components

#### 1. Header

```
┌────────────────────────────────────────┐
│     CLAUDE CODE USAGE REPORT           │
│     2025-01-01 to 2025-12-31           │
│          (48px/32px, Orange)           │
└────────────────────────────────────────┘
```

**Rendering:**
```python
header_text = "CLAUDE CODE USAGE REPORT"
date_range_text = f"{stats.date_from} to {stats.date_to}"
bbox = draw.textbbox((0, 0), header_text, font=font_large)
text_width = bbox[2] - bbox[0]
x_center = (CANVAS_WIDTH - text_width) // 2
draw.text((x_center, 80), header_text, fill=COLORS['accent_primary'], font=font_large)
draw.text((x_center, 130), date_range_text, fill=COLORS['text_secondary'], font=font_medium)
```

#### 2. Hero Panels

```
┌─────────────────────┐  ┌─────────────────────┐
│ STARTED             │  │ MOST ACTIVE DAY     │
│ 2025-01-15          │  │ Dec 27              │
│ 347 Days Ago        │  │ 156 messages        │
└─────────────────────┘  └─────────────────────┘
```

**Logic:**
```python
first_session = stats.first_session_date.strftime('%Y-%m-%d')
days_ago = (datetime.now() - stats.first_session_date).days

best_day = max(stats.daily_activity.items(), key=lambda x: x[1])
most_active_day = datetime.strptime(best_day[0], "%Y-%m-%d").strftime("%b %d")
most_active_count = best_day[1]
```

#### 3. Activity Heatmap

**Layout:**
- 53 weeks × 7 days = 371 cells
- Cell size: 20x20 pixels
- Gap: 3 pixels
- Month labels at top
- Weekday labels on left

**Algorithm:**
```python
# Build 53-week grid
year_start = datetime(stats.year, 1, 1)
current_date = year_start - timedelta(days=year_start.weekday() + 1)

weeks = []
for week in range(53):
    week_data = []
    for day in range(7):
        date_str = current_date.strftime("%Y-%m-%d")
        count = stats.daily_activity.get(date_str, 0)
        week_data.append(count)
        current_date += timedelta(days=1)
    weeks.append(week_data)
```

**Intensity Mapping:**
```python
def get_heat_level(count):
    if count == 0:
        return 0

    ratio = count / max_count

    if ratio <= 0.1:  return 1
    elif ratio <= 0.25:  return 2
    elif ratio <= 0.4:  return 3
    elif ratio <= 0.6:  return 4
    elif ratio <= 0.8:  return 5
    else:  return 6
```

**Rendering:**
```python
for day_idx in range(7):
    for week_idx, week in enumerate(weeks):
        x = heatmap_x + week_idx * (cell_size + gap)
        y = heatmap_y + day_idx * (cell_size + gap)
        level = get_heat_level(week[day_idx])
        color = COLORS['heatmap'][level]
        draw.rectangle([x, y, x+20, y+20], fill=color, outline=border)
```

#### 4. Top Models Panel

```
┌─────────────────────────────┐
│ TOP MODELS                  │
│                             │
│ 1. Sonnet 4.5     45.2M tok │
│ 2. Opus 4.5       12.8M tok │
│ 3. Haiku 4.5       3.1M tok │
└─────────────────────────────┘
```

**Model Name Formatting:**
```python
def format_model_name(model):
    # Input: "claude-sonnet-4-5-20250929"
    display_name = model.replace("claude-", "")
    display_name = display_name.replace("-20250929", "")
    display_name = display_name.replace("sonnet-4-5", "Sonnet 4.5")
    # Output: "Sonnet 4.5"
    return display_name
```

**Token Formatting:**
```python
def format_tokens(count):
    if count >= 1e9:
        return f"{count/1e9:.1f}B"
    elif count >= 1e6:
        return f"{count/1e6:.0f}M"
    else:
        return f"{count:,}"
```

#### 5. Cache Efficiency Panel

```
┌─────────────────────────────┐
│ CACHE EFFICIENCY            │
│                             │
│ Cache Read:    45.2M tok    │
│ Cache Write:   12.8M tok    │
│ Hit Rate:      77.9%        │
└─────────────────────────────┘
```

**Calculation:**
```python
cache_read = stats.cache_read_tokens
cache_write = stats.cache_write_tokens
hit_rate = (cache_read / (cache_read + cache_write) * 100) if (cache_read + cache_write) > 0 else 0
```

#### 6. Stats Grid

```
┌────────────────────────────────────────┐
│ SESSIONS    MESSAGES    TOTAL TOKENS   │
│   1,234       45,678       123.4M      │
│                                        │
│ PROJECTS    STREAK         USAGE COST  │
│    N/A        47d           $234.56    │
└────────────────────────────────────────┘
```

**Streak Calculation:**
```python
from command_center.aggregators.streak_calculator import calculate_streaks

max_streak, current_streak = calculate_streaks(stats.daily_activity)
```

### Terminal Display Protocols

**Module:** `src/command_center/visualization/terminal_display.py`

**Supported Terminals:**
- Kitty (Kitty Graphics Protocol)
- iTerm2 (Inline Images Protocol)
- WezTerm (both protocols)
- Ghostty (Kitty protocol)
- Konsole (Kitty protocol)
- VS Code (iTerm2 protocol)

#### Kitty Graphics Protocol

**Specification:** https://sw.kovidgoyal.net/kitty/graphics-protocol/

**Implementation:**
```python
def display_kitty_protocol(png_bytes):
    b64_data = base64.b64encode(png_bytes).decode('ascii')
    chunk_size = 4096
    chunks = [b64_data[i:i+chunk_size] for i in range(0, len(b64_data), chunk_size)]

    for i, chunk in enumerate(chunks):
        is_last = (i == len(chunks) - 1)
        if i == 0:
            # First chunk: a=T (transmit), f=100 (PNG), m=1 (more chunks)
            sys.stdout.write(f"\x1b_Ga=T,f=100,m={0 if is_last else 1};{chunk}\x1b\\")
        else:
            # Subsequent chunks: m=1 (more) or m=0 (last)
            sys.stdout.write(f"\x1b_Gm={0 if is_last else 1};{chunk}\x1b\\")

    sys.stdout.flush()
```

**Protocol:**
- `\x1b_G`: Start graphics command
- `a=T`: Action = transmit
- `f=100`: Format = PNG
- `m=1`: More chunks follow
- `;{data}`: Base64 payload
- `\x1b\\`: End graphics command

#### iTerm2 Inline Images Protocol

**Specification:** https://iterm2.com/documentation-images.html

**Implementation:**
```python
def display_iterm2_protocol(png_bytes):
    b64_data = base64.b64encode(png_bytes).decode('ascii')
    filename = base64.b64encode(b"cc-usage-report.png").decode('ascii')

    # OSC 1337 ; File=[args] : base64data ST
    sys.stdout.write(
        f"\x1b]1337;File=name={filename};size={len(png_bytes)};inline=1:{b64_data}\x07\n"
    )
    sys.stdout.flush()
```

**Protocol:**
- `\x1b]1337`: OSC (Operating System Command) 1337
- `File=`: File transfer command
- `name={filename}`: Base64-encoded filename
- `size={size}`: Size in bytes
- `inline=1`: Display inline
- `:{data}`: Base64 payload
- `\x07`: Bell (end command)

---
