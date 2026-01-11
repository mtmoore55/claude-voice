---
description: Start voice mode - talk to Claude with push-to-talk
---

# Voice Mode

You are helping the user start voice mode for Claude Code.

## First, check if voice mode is set up

Run this command to check if claude-voice is installed:
```bash
which claude-voice
```

### If claude-voice is NOT installed:

Guide the user through installation:

1. **Install dependencies:**
```bash
brew install sox whisper-cpp
```

2. **Download the Whisper model** (one-time, ~150MB):
```bash
whisper-cpp --download-model base.en
```

3. **Install claude-voice:**
```bash
git clone https://github.com/mtmoore55/claude-voice.git ~/claude-voice
cd ~/claude-voice && npm install && npm run build && npm link
```

4. **Run setup wizard:**
```bash
claude-voice setup
```

5. **Configure hotkey:**
```bash
bash ~/claude-voice/scripts/setup-hotkey.sh
```

Tell the user they need to grant Accessibility permission to Hammerspoon:
- Open System Settings
- Go to Privacy & Security → Accessibility
- Enable Hammerspoon

### If claude-voice IS installed:

Tell the user voice mode is ready and explain how to use it:

"Voice mode is ready! Here's how to use it:

1. **Start voice mode:** Run `claude-voice` in your terminal
2. **To talk:** Press **Cmd+.** (Command + Period) to start recording, speak, then press **Cmd+.** again to stop and send.

Would you like me to help you start voice mode now?"

If the user says yes, explain they need to run `claude-voice` in their terminal to start a voice-enabled session.
