#!/bin/bash
# Claude Voice - Hotkey Setup Script
# Sets up Hammerspoon for push-to-talk hotkey support

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HAMMERSPOON_CONFIG_DIR="$HOME/.hammerspoon"
VOICE_LUA_SOURCE="$SCRIPT_DIR/claude-voice.lua"

echo ""
echo "  Claude Voice - Hotkey Setup"
echo "  =============================="
echo ""

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "Error: Homebrew is required but not installed."
    echo "Install it from: https://brew.sh"
    exit 1
fi

# Check if Hammerspoon is installed
if ! ls /Applications/Hammerspoon.app &> /dev/null 2>&1; then
    echo "Installing Hammerspoon..."
    brew install --cask hammerspoon
    echo "Hammerspoon installed."
    echo ""
fi

# Create Hammerspoon config directory
mkdir -p "$HAMMERSPOON_CONFIG_DIR"

# Check if init.lua exists
if [ -f "$HAMMERSPOON_CONFIG_DIR/init.lua" ]; then
    # Check if our config is already included
    if grep -q "Claude Voice" "$HAMMERSPOON_CONFIG_DIR/init.lua"; then
        echo "Claude Voice hotkey already configured in Hammerspoon."
    else
        echo "Existing Hammerspoon config found."
        echo "Adding Claude Voice hotkey to your config..."
        echo "" >> "$HAMMERSPOON_CONFIG_DIR/init.lua"
        echo "-- Load Claude Voice hotkey" >> "$HAMMERSPOON_CONFIG_DIR/init.lua"
        echo "require('claude-voice')" >> "$HAMMERSPOON_CONFIG_DIR/init.lua"

        # Copy the module file
        cp "$SCRIPT_DIR/claude-voice.lua" "$HAMMERSPOON_CONFIG_DIR/"
        echo "Added Claude Voice module."
    fi
else
    # No existing config, copy our full config
    cp "$SCRIPT_DIR/claude-voice-init.lua" "$HAMMERSPOON_CONFIG_DIR/init.lua"
    echo "Created Hammerspoon config with Claude Voice hotkey."
fi

# Check if Hammerspoon is running
if pgrep -x "Hammerspoon" > /dev/null; then
    echo ""
    echo "Reloading Hammerspoon config..."
    # Use AppleScript to reload Hammerspoon
    osascript -e 'tell application "Hammerspoon" to execute lua code "hs.reload()"' 2>/dev/null || true
else
    echo ""
    echo "Starting Hammerspoon..."
    open -a Hammerspoon
fi

echo ""
echo "Setup complete!"
echo ""
echo "IMPORTANT: Grant Accessibility permissions to Hammerspoon"
echo "  1. Open System Settings"
echo "  2. Go to Privacy & Security → Accessibility"
echo "  3. Enable Hammerspoon in the list"
echo ""
echo "How to use:"
echo "  1. Run 'claude-voice on' in a terminal"
echo "  2. Press Cmd+. to start recording"
echo "  3. Press Cmd+. again to stop and send"
echo ""
