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
│  STEP 2: CLAUDE CODE                  │
│                                       │
│  npm install -g @anthropic-ai/claude-code  │
│  claude  ← (authenticates via browser)│
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  STEP 3: CLAUDE VOICE                 │
│                                       │
│  git clone github.com/mtmoore55/claude-voice  │
│  cd claude-voice                      │
│  npm install && npm run build         │
│  npm link                             │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  STEP 4: GET API KEY                  │
│                                       │
│  → elevenlabs.io                      │
│  → Create account (free tier)         │
│  → Copy API key (sk_...)              │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  STEP 5: SETUP WIZARD                 │
│                                       │
│  claude-voice setup                   │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ Choose STT: whisper-cpp (local) │  │
│  │ Enable TTS: Yes                 │  │
│  │ ElevenLabs key: [paste]         │  │
│  │ Voice: Rachel                   │  │
│  │ Interruption: Yes               │  │
│  └─────────────────────────────────┘  │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  STEP 6: HOTKEY SETUP                 │
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
│  STEP 7: START USING                  │
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
│   ║   [Hold Right Option] → Speak → [Release] → Claude responds   ║
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
       │ Hold Right Option  │                       │
       │───────────────────>│                       │
       │                    │  HTTP POST /ptt/start │
       │                    │──────────────────────>│
       │                    │                       │
       │                    │              ┌────────┴────────┐
       │                    │              │ Start Recording │
       │                    │              │ Show Waveform   │
       │                    │              └────────┬────────┘
       │                    │                       │
       │ Release Key        │                       │
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
       │                    │              │ Get Response    │
       │                    │              └────────┬────────┘
       │                    │                       │
       │                    │              ┌────────┴────────┐
       │                    │              │ TTS (ElevenLabs)│
       │   Audio Output     │              │ Play Audio      │
       │<───────────────────┼──────────────┴─────────────────┘
       │                    │
```

## Quick Reference

| What | How |
|------|-----|
| Start voice | `claude-voice` |
| Talk | Hold Right Option, speak, release |
| Interrupt | Press Right Option while Claude speaks |
| Test setup | `claude-voice test` |
| Reconfigure | `claude-voice setup` |
