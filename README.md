# Claude Voice

Talk to Claude Code using your voice. Press **Cmd+.** to record, press again to send.

## Installation

In Claude Code, run:

```
/plugin marketplace add mtmoore55/claude-voice
/plugin install voice-mode
/voice-mode-start
```

The setup will install dependencies and configure everything automatically. You'll need to grant Accessibility permission to Hammerspoon when prompted.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   [Press Cmd+.] → Speak → [Press Cmd+.] → Sent to Claude        │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ← Waveform            │   │
│   │  "Voice Ready"                   ← Status               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

1. **Press Cmd+.** — starts recording, waveform appears
2. **Speak** — say your prompt naturally
3. **Press Cmd+.** — stops recording, transcribes your speech, sends to Claude
4. **Read** — Claude's response appears as text

## Dependencies

The setup installs these automatically:

| Dependency | Purpose |
|------------|---------|
| **sox** | Records audio from your microphone |
| **whisper-cpp** | Transcribes speech to text locally (no API key needed) |
| **Hammerspoon** | Listens for the Cmd+. hotkey globally |

### Why these choices?

- **Local transcription** — whisper-cpp runs on your Mac, so your voice never leaves your computer
- **No API keys** — everything works offline after initial setup
- **System-wide hotkey** — Hammerspoon captures Cmd+. even when Claude Code is in the background

## Requirements

- macOS (Sonoma 14+ recommended)
- Claude Code installed
- ~500MB disk space (for Whisper model)

## Configuration

Settings are stored in `~/.claude/voice.json`:

```json
{
  "enabled": true,
  "stt": {
    "provider": "whisper-cpp"
  },
  "hotkey": "cmd+period"
}
```

## Troubleshooting

**Hotkey not working?**
- Check Hammerspoon is running (look for icon in menu bar)
- Grant Accessibility permission: System Settings → Privacy & Security → Accessibility → Enable Hammerspoon

**Transcription not working?**
- Ensure Whisper model is downloaded: `whisper-cpp --download-model base.en`
- Check microphone permissions: System Settings → Privacy & Security → Microphone

**"command not found" errors?**
- Run `/voice-mode-start` again to reinstall dependencies

## Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   You       │    │  Hammerspoon     │    │  Voice Daemon   │
│             │    │  (hotkey)        │    │  (port 17394)   │
└──────┬──────┘    └────────┬─────────┘    └────────┬────────┘
       │                    │                       │
       │ Press Cmd+.        │                       │
       │───────────────────>│  HTTP /ptt/start      │
       │                    │──────────────────────>│
       │                    │                       │
       │                    │              ┌────────┴────────┐
       │                    │              │ Start Recording │
       │                    │              │ Show Waveform   │
       │                    │              └────────┬────────┘
       │                    │                       │
       │ Press Cmd+.        │                       │
       │───────────────────>│  HTTP /ptt/stop       │
       │                    │──────────────────────>│
       │                    │                       │
       │                    │              ┌────────┴────────┐
       │                    │              │ Stop Recording  │
       │                    │              │ Transcribe      │
       │                    │              │ (whisper-cpp)   │
       │                    │              └────────┬────────┘
       │                    │                       │
       │                    │              ┌────────┴────────┐
       │                    │              │ Send to Claude  │
       │   Text Response    │              │ Display Response│
       │<───────────────────┼──────────────┴─────────────────┘
```

## License

MIT

## Credits

Built by [Matt Moore](https://github.com/mtmoore55) with Claude Code.
