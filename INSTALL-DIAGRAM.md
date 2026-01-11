# Claude Voice - Installation Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    CLAUDE VOICE INSTALLATION FLOW                            │
└──────────────────────────────────────────────────────────────────────────────┘

  USER STARTS HERE
        │
        ▼
┌───────────────────────────────────────┐
│  STEP 1: PREREQUISITES                │
│                                       │
│  brew install sox                     │
│  brew install whisper-cpp             │
│  whisper-cpp --download-model base.en │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  STEP 2: CLAUDE VOICE                 │
│                                       │
│  git clone github.com/mtmoore55/claude-voice  │
│  cd claude-voice                      │
│  npm install && npm run build         │
│  npm link                             │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  STEP 3: SETUP WIZARD                 │
│                                       │
│  claude-voice setup                   │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ Configures whisper-cpp (local)  │  │
│  │ No API keys needed              │  │
│  └─────────────────────────────────┘  │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  STEP 4: HOTKEY SETUP                 │
│                                       │
│  bash scripts/setup-hotkey.sh         │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ Installs Hammerspoon            │  │
│  │ Configures Right Option key     │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ⚠️  GRANT ACCESSIBILITY PERMISSION   │
│  System Settings → Privacy & Security │
│  → Accessibility → Enable Hammerspoon │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  STEP 5: START USING                  │
│                                       │
│  claude-voice                         │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│   ╔═══════════════════════════════════════════════════════════╗   │
│   ║                  ACTIVE VOICE MODE                        ║   │
│   ║                                                           ║   │
│   ║       [Press Cmd+.] → Speak → [Press Cmd+.] → Sent        ║   │
│   ║                                                           ║   │
│   ║   ┌─────────────────────────────────────────────────────┐ ║   │
│   ║   │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ← Waveform        │ ║   │
│   ║   │  "Voice Ready"                   ← Status           │ ║   │
│   ║   │  "3...2...1..."                  ← Countdown        │ ║   │
│   ║   └─────────────────────────────────────────────────────┘ ║   │
│   ║                                                           ║   │
│   ╚═══════════════════════════════════════════════════════════╝   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                          ARCHITECTURE OVERVIEW                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User      │    │  Hammerspoon     │    │  Voice Daemon   │
│   (You)     │    │  (hotkey detect) │    │  (port 17394)   │
└──────┬──────┘    └────────┬─────────┘    └────────┬────────┘
       │                    │                       │
       │ Press Cmd+.        │                       │
       │───────────────────>│                       │
       │                    │  HTTP POST /ptt/start │
       │                    │──────────────────────>│
       │                    │                       │
       │                    │              ┌────────┴────────┐
       │                    │              │ Start Recording │
       │                    │              │ Show Waveform   │
       │                    │              └────────┬────────┘
       │                    │                       │
       │ Press Again        │                       │
       │───────────────────>│                       │
       │                    │  HTTP POST /ptt/stop  │
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
       │                    │
```

## Quick Reference

| What | How |
|------|-----|
| Start voice | `claude-voice` |
| Talk | Press Cmd+., speak, press Cmd+. again |
| Test setup | `claude-voice test` |
| Reconfigure | `claude-voice setup` |
