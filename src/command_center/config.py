"""
Configuration and constants for Claude Code Wrapped
"""
import os

# Paths
HOME = os.path.expanduser("~")
CLAUDE_DIRS = [
    os.path.join(HOME, ".claude"),
    os.path.join(HOME, ".config", "claude")
]

# Database
DB_PATH = os.path.join(HOME, ".claude", "db", "command_center.db")

# Design tokens - colors from original design-tokens.ts
COLORS = {
    'background': (247, 241, 233),  # #F7F1E9
    'surface': (255, 249, 242),      # #FFF9F2
    'surface_border': (232, 215, 198), # #E8D7C6
    'text_primary': (43, 29, 19),    # #2B1D13
    'text_secondary': (74, 52, 38),  # #4A3426
    'text_tertiary': (107, 81, 66),  # #6B5142
    'text_muted': (138, 114, 100),   # #8A7264
    'accent_primary': (217, 119, 87), # #D97757 - Claude Code orange
    'semantic_success': (34, 197, 94), # #22C55E
    'heatmap': [
        (240, 230, 220),  # 0 - empty #F0E6DC
        (230, 214, 200),  # 1 - level1 #E6D6C8
        (217, 193, 174),  # 2 - level2 #D9C1AE
        (203, 165, 144),  # 3 - level3 #CBA590
        (188, 136, 115),  # 4 - level4 #BC8873
        (174, 110, 91),   # 5 - level5 #AE6E5B
        (154, 86, 71),    # 6 - level6 #9A5647
    ]
}

# Canvas size for PNG
CANVAS_WIDTH = 1500
CANVAS_HEIGHT = 1400

# Font paths (try these in order)
FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]

# Batch processing
BATCH_INSERT_SIZE = 100  # Insert entries in batches of 100
