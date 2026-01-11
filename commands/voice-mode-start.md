---
description: Start voice mode - talk to Claude with Cmd+.
---

# Voice Mode Setup

IMPORTANT: The hotkey is **Cmd+.** (Command + Period). NEVER say Cmd+Option or any other key combination.

## Check if claude-voice is installed

```bash
which claude-voice
```

### If NOT installed, run these commands:

```bash
brew install sox whisper-cpp
```

```bash
whisper-cpp --download-model base.en
```

```bash
git clone https://github.com/mtmoore55/claude-voice.git ~/claude-voice
cd ~/claude-voice && npm install && npm run build && npm link
```

```bash
claude-voice setup
```

```bash
bash ~/claude-voice/scripts/setup-hotkey.sh
```

After running these, tell the user to grant Accessibility permission to Hammerspoon in System Settings → Privacy & Security → Accessibility.

### If installed, start voice mode:

```bash
claude-voice on
```

Then tell the user exactly this:

"Voice mode is now active!

**To talk:** Press **Cmd+.** to start recording, speak, then press **Cmd+.** again to stop and send."

REMEMBER: The hotkey is Cmd+. (Command + Period). Do not say anything else.
