# Claude Voice - Installation Guide

Get voice input for Claude Code in about 5 minutes.

---

## What You'll Need

- **macOS** (Sonoma 14+ recommended)
- **Node.js 18+** ([download](https://nodejs.org/))
- **Claude Code** installed and working

---

## Step 1: Install Prerequisites

Open Terminal and run these commands:

```bash
# Install Homebrew (if you don't have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install sox (for microphone recording)
brew install sox

# Install whisper-cpp (for local speech-to-text)
brew install whisper-cpp

# Download the whisper model (one-time, ~150MB)
whisper-cpp --download-model base.en
```

---

## Step 2: Install Claude Voice

```bash
# Clone the repository
git clone https://github.com/mtmoore55/claude-voice.git ~/claude-voice
cd ~/claude-voice

# Install dependencies
npm install

# Build the project
npm run build

# Link it globally (makes 'claude-voice' command available)
npm link
```

---

## Step 3: Run Setup

```bash
claude-voice setup
```

The setup wizard will configure speech-to-text with whisper-cpp.

---

## Step 4: Set Up Hotkey (Hammerspoon)

Claude Voice uses **Cmd+.** (Command + Period) as the hotkey. This requires Hammerspoon:

```bash
bash ~/claude-voice/scripts/setup-hotkey.sh
```

### Grant Accessibility Permission

**Important!** macOS will ask for permission:

1. Open **System Settings**
2. Go to **Privacy & Security → Accessibility**
3. Find **Hammerspoon** and toggle it **ON**

If Hammerspoon isn't in the list, open Hammerspoon once from Applications, then check again.

---

## Step 5: Start Using Voice

In Claude Code, run:
```
/voice-mode-start
```

### How to Talk to Claude

1. **Press Cmd+.** - starts recording (you'll see a waveform)
2. **Speak** - say your prompt naturally
3. **Press Cmd+. again** - stops recording, transcribes, and sends to Claude
4. **Read** - Claude's response appears as text

---

## Troubleshooting

### "whisper-cpp: command not found"

```bash
brew install whisper-cpp
whisper-cpp --download-model base.en
```

### "Permission denied" for microphone

Go to **System Settings → Privacy & Security → Microphone** and enable Terminal (or your terminal app).

### Hotkey not working

1. Make sure Hammerspoon is running (check menu bar)
2. Verify Accessibility permission is granted
3. Try restarting Hammerspoon

### "ECONNREFUSED" errors

The voice daemon isn't running. Run `/voice-mode-start` in Claude Code to enable voice mode.

---

## Commands Reference

| Command | What it does |
|---------|--------------|
| `/voice-mode-start` | Start voice mode in Claude Code |
| `claude-voice setup` | Configure voice settings (run once during setup) |
| `claude-voice test` | Test your setup |

---

## Updating

```bash
cd ~/claude-voice
git pull
npm install
npm run build
```

---

## Need Help?

Open an issue at: https://github.com/mtmoore55/claude-voice/issues
