#!/bin/bash
# Development script for Command Center
# Runs Tauri dev with X11 backend and software rendering to avoid GPU issues

export GDK_BACKEND=x11
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export LIBGL_ALWAYS_SOFTWARE=1

cargo tauri dev
