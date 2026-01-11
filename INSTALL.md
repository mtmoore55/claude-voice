# Claude Voice - Installation Guide

Get voice interaction with Claude Code in about 10 minutes.

---

## What You'll Need

- **macOS** (Sonoma 14+ recommended)
- **Node.js 18+** ([download](https://nodejs.org/))
- **An Anthropic account** (for Claude Code)
- **An ElevenLabs account** (free tier works) - for text-to-speech

---

## Step 1: Install Prerequisites

Open Terminal and run these commands:

```bash
# Install Homebrew (if you don't have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install sox (for microphone recording)
brew install sox

# Install whisper-cpp (for local speech-to-text, no API key needed)
brew install whisper-cpp

# Download the whisper model (one-time, ~150MB)
whisper-cpp --download-model base.en
```

---

## Step 2: Install Claude Code

```bash
# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Run it once to authenticate (opens browser)
claude
```

Follow the prompts to sign in with your Anthropic account. Once you see the Claude prompt, type `/exit` to quit.

---

## Step 3: Install Claude Voice

```bash
# Clone the repository
git clone https://github.com/mtmoore55/claude-voice.git
cd claude-voice

# Install dependencies
npm install

# Build the project
npm run build

# Link it globally (makes 'claude-voice' command available)
npm link
```

---

## Step 4: Get Your ElevenLabs API Key

1. Go to [elevenlabs.io](https://elevenlabs.io) and create a free account
2. Click your profile icon → **Profile + API key**
3. Copy your API key (starts with `sk_`)

---

## Step 5: Run Setup

```bash
claude-voice setup
```

The setup wizard will ask you:

1. **Speech-to-Text provider**: Choose `whisper-cpp` (local, no API key needed)
2. **Enable Text-to-Speech?**: Yes
3. **ElevenLabs API key**: Paste your key from Step 4
4. **Voice**: Pick one (Rachel is a good default)
5. **Enable interruption?**: Yes (lets you interrupt Claude while speaking)

---

## Step 6: Set Up Hotkey (Hammerspoon)

Claude Voice uses **Right Option** as the push-to-talk key. This requires Hammerspoon:

```bash
# Run the setup script
cd ~/claude-voice  # or wherever you cloned it
bash scripts/setup-hotkey.sh
```

### Grant Accessibility Permission

**Important!** macOS will ask for permission:

1. Open **System Settings**
2. Go to **Privacy & Security → Accessibility**
3. Find **Hammerspoon** and toggle it **ON**

If Hammerspoon isn't in the list, open Hammerspoon once from Applications, then check again.

---

## Step 7: Start Using Voice

```bash
# Start Claude with voice mode
claude-voice
```

### How to Talk to Claude

1. **Hold Right Option** - starts recording (you'll see a waveform)
2. **Speak** - say your prompt naturally
3. **Release Right Option** - stops recording, transcribes, and sends
4. **Listen** - Claude's response plays through your speakers

### Tips

- Speak clearly and at a normal pace
- Wait for the "Voice Ready" indicator before speaking
- Press Right Option again while Claude is speaking to interrupt

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

### No audio output

1. Check your system volume
2. Verify ElevenLabs API key is correct: `claude-voice test`
3. Check that TTS is enabled in `~/.claude/voice.json`

### "ECONNREFUSED" errors

The voice daemon isn't running. Make sure you started with `claude-voice` (not just `claude`).

---

## Commands Reference

| Command | What it does |
|---------|--------------|
| `claude-voice` | Start Claude with voice mode |
| `claude-voice setup` | Configure voice settings |
| `claude-voice test` | Test your STT and TTS setup |
| `claude-voice on` | Enable voice in existing Claude session |

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

---

Happy talking! 🎙️
