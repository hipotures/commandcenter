"""
Terminal display protocols (Kitty, iTerm2)
"""
import os
import sys
import base64


def display_kitty_protocol(png_bytes: bytes):
    """Display PNG using Kitty Graphics Protocol"""
    b64_data = base64.b64encode(png_bytes).decode('ascii')
    chunk_size = 4096
    chunks = [b64_data[i:i+chunk_size] for i in range(0, len(b64_data), chunk_size)]

    for i, chunk in enumerate(chunks):
        is_last = (i == len(chunks) - 1)
        if i == 0:
            sys.stdout.write(f"\x1b_Ga=T,f=100,m={0 if is_last else 1};{chunk}\x1b\\")
        else:
            sys.stdout.write(f"\x1b_Gm={0 if is_last else 1};{chunk}\x1b\\")

    sys.stdout.write("\n")
    sys.stdout.flush()


def display_iterm2_protocol(png_bytes: bytes):
    """Display PNG using iTerm2 Inline Images Protocol"""
    b64_data = base64.b64encode(png_bytes).decode('ascii')
    filename = base64.b64encode(b"cc-usage-report.png").decode('ascii')

    # OSC 1337 ; File=[args] : base64data ST
    sys.stdout.write(f"\x1b]1337;File=name={filename};size={len(png_bytes)};inline=1:{b64_data}\x07\n")
    sys.stdout.flush()


def display_png_in_terminal(png_bytes: bytes):
    """
    Display PNG in terminal using appropriate protocol.

    Detects terminal type and uses Kitty or iTerm2 protocol.
    """
    term = os.environ.get('TERM', '')
    term_program = os.environ.get('TERM_PROGRAM', '')
    kitty_window = os.environ.get('KITTY_WINDOW_ID', '')
    konsole_version = os.environ.get('KONSOLE_VERSION', '')

    # Check for Kitty protocol support
    supports_kitty = (
        'kitty' in term.lower() or
        'ghostty' in term.lower() or
        kitty_window or
        konsole_version or
        term_program in ['WezTerm', 'WarpTerminal', 'konsole']
    )

    # Check for iTerm2 protocol support
    supports_iterm2 = term_program in ['iTerm.app', 'WezTerm', 'vscode']

    if supports_kitty:
        print("Displaying in terminal (Kitty protocol)...\n")
        display_kitty_protocol(png_bytes)
    elif supports_iterm2:
        print("Displaying in terminal (iTerm2 protocol)...\n")
        display_iterm2_protocol(png_bytes)
    else:
        print(f"Your terminal ({term or term_program}) may not support inline images.")
        print("Supported terminals: Kitty, WezTerm, Ghostty, Konsole, iTerm2, VS Code\n")
