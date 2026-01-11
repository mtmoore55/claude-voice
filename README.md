# Claude Voice

Talk to Claude with push-to-talk voice interaction.

## Quick Install (Claude Code Plugin)

Already using Claude Code? Install in seconds:

```
/plugin marketplace add mtmoore55/claude-voice
/plugin install voice-mode
/voice
```

That's it. The `/voice` command will guide you through setup.

---

## Features

- **Push-to-Talk**: Hold Right Option to speak, release to send
- **Natural Voice Output**: Claude responds with ElevenLabs voices
- **Real-time Visualization**: Animated waveform while recording
- **Local Speech-to-Text**: Uses whisper.cpp (no API key needed)
- **Configurable Interruption**: Barge-in to stop Claude mid-sentence

## How It Works

1. **Hold Right Option** - starts recording (you'll see a waveform)
2. **Speak** - say your prompt naturally
3. **Release** - stops recording, transcribes, and sends to Claude
4. **Listen** - Claude's response plays through your speakers

## Requirements

- macOS (Sonoma 14+ recommended)
- Claude Code installed
- ElevenLabs API key (free tier works) for voice output

## Manual Installation

If you prefer to install manually instead of using the plugin:

```bash
# Install dependencies
brew install sox whisper-cpp
whisper-cpp --download-model base.en

# Clone and build
git clone https://github.com/mtmoore55/claude-voice.git ~/claude-voice
cd ~/claude-voice
npm install && npm run build && npm link

# Configure
claude-voice setup

# Set up hotkey
bash scripts/setup-hotkey.sh
```

Then grant Accessibility permission to Hammerspoon in System Settings.

## Commands

| Command | Description |
|---------|-------------|
| `claude-voice` | Start Claude with voice mode |
| `claude-voice setup` | Configure voice settings |
| `claude-voice test` | Test your configuration |
| `claude-voice on` | Enable voice in current session |

## Configuration

Settings are stored in `~/.claude/voice.json`:

```json
{
  "enabled": true,
  "stt": {
    "provider": "whisper-cpp"
  },
  "tts": {
    "enabled": true,
    "provider": "elevenlabs",
    "voiceId": "21m00Tcm4TlvDq8ikWAM"
  },
  "hotkey": "right-option",
  "interruptEnabled": true
}
```

## Troubleshooting

**Hotkey not working?**
- Check Hammerspoon is running (look for icon in menu bar)
- Verify Accessibility permission in System Settings

**No audio output?**
- Run `claude-voice test` to verify TTS
- Check your ElevenLabs API key is valid

**Transcription issues?**
- Ensure whisper-cpp model is downloaded: `whisper-cpp --download-model base.en`

## License

MIT

## Credits

Built by [Matt Moore](https://github.com/mtmoore55) with Claude Code.
