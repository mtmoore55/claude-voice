#!/bin/bash
# Claude Voice - Quick Install Script
# Run with: curl -fsSL https://raw.githubusercontent.com/mtmoore55/claude-voice/main/scripts/quick-install.sh | bash

set -e

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║     Claude Voice - Quick Install          ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: Claude Voice currently only supports macOS${NC}"
    exit 1
fi

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}Installing Homebrew...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    brew install node
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required. You have $(node -v)${NC}"
    echo "Run: brew upgrade node"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Install sox
if ! command -v sox &> /dev/null; then
    echo -e "${YELLOW}Installing sox (audio recording)...${NC}"
    brew install sox
fi
echo -e "${GREEN}✓${NC} sox installed"

# Install whisper-cpp
if ! command -v whisper-cpp &> /dev/null; then
    echo -e "${YELLOW}Installing whisper-cpp (speech-to-text)...${NC}"
    brew install whisper-cpp
fi
echo -e "${GREEN}✓${NC} whisper-cpp installed"

# Download whisper model if needed
WHISPER_MODEL_PATH="$HOME/.cache/whisper-cpp/ggml-base.en.bin"
if [ ! -f "$WHISPER_MODEL_PATH" ]; then
    echo -e "${YELLOW}Downloading Whisper model (one-time, ~150MB)...${NC}"
    whisper-cpp --download-model base.en 2>/dev/null || true
fi
echo -e "${GREEN}✓${NC} Whisper model ready"

# Check for Claude Code
if ! command -v claude &> /dev/null; then
    echo ""
    echo -e "${YELLOW}Installing Claude Code...${NC}"
    npm install -g @anthropic-ai/claude-code
    echo ""
    echo -e "${YELLOW}You need to authenticate Claude Code.${NC}"
    echo "Run 'claude' and sign in, then run this script again."
    exit 0
fi
echo -e "${GREEN}✓${NC} Claude Code installed"

# Clone and install claude-voice
INSTALL_DIR="$HOME/claude-voice"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Updating claude-voice...${NC}"
    cd "$INSTALL_DIR"
    git pull
else
    echo -e "${YELLOW}Cloning claude-voice...${NC}"
    git clone https://github.com/mtmoore55/claude-voice.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}Building...${NC}"
npm run build

echo -e "${YELLOW}Linking globally...${NC}"
npm link 2>/dev/null || sudo npm link

echo -e "${GREEN}✓${NC} claude-voice installed"

# Setup hotkey
echo ""
echo -e "${YELLOW}Setting up hotkey (Hammerspoon)...${NC}"
bash scripts/setup-hotkey.sh

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║         Installation Complete!            ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Grant Accessibility permission to Hammerspoon:"
echo "     → System Settings → Privacy & Security → Accessibility"
echo "     → Enable Hammerspoon"
echo ""
echo "  2. Run setup wizard:"
echo "     ${GREEN}claude-voice setup${NC}"
echo ""
echo "  3. Start using voice:"
echo "     ${GREEN}claude-voice${NC}"
echo ""
echo "  Hold Right Option to speak, release to send."
echo ""
