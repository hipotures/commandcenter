#!/bin/bash
# Development script for Command Center
# Runs Tauri dev with X11 backend to avoid Wayland issues

export GDK_BACKEND=x11
cargo tauri dev
