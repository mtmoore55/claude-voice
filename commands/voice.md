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

Check if it's configured:
```bash
cat ~/.claude/voice.json 2>/dev/null || echo "not configured"
```

If not configured, run:
```bash
claude-voice setup
```

### Starting voice mode

Once everything is set up, tell the user:

"Voice mode is ready! Here's how to use it:

1. **Start voice mode:** Run `claude-voice` in your terminal (this will replace the current Claude session with a voice-enabled one)

2. **Or enable in this session:** Run `claude-voice on` to add voice to your current session

3. **To talk:** Hold **Right Option** key, speak, then release

4. **To interrupt:** Press Right Option while Claude is speaking

Would you like me to start voice mode now?"

If the user says yes, explain they need to run `claude-voice` in their terminal to start a voice-enabled session.
