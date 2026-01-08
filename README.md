# claude-voice

Voice mode for Claude Code - talk to Claude with push-to-talk.

## Features

- **Push-to-Talk**: Hold `Cmd+Option` to speak, release to send
- **Natural Voice Output**: Claude responds with ElevenLabs voices
- **Real-time Visualization**: Animated waveform while recording
- **Hybrid Mode**: Voice always available alongside text input
- **Multiple STT Providers**: Choose from Whisper API, Local Whisper, Apple Speech, or Deepgram
- **Configurable Interruption**: Barge-in to stop Claude mid-sentence

## Installation

```bash
# Install from npm (coming soon)
npm install -g claude-voice

# Or clone and build locally
git clone https://github.com/mtmoore55/claude-voice.git
cd claude-voice
npm install
npm run build
npm link
```

### Prerequisites

- **Node.js 18+**
- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **sox** (for microphone recording): `brew install sox`
- **API Keys**: OpenAI (for Whisper STT) and/or ElevenLabs (for TTS)

## Quick Start

```bash
# Run setup wizard to configure STT/TTS providers
claude-voice setup

# Start Claude Code with voice mode
claude-voice

# Test your voice configuration
claude-voice test
```

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `claude-voice` | Start Claude Code with voice mode enabled |
| `claude-voice setup` | Configure STT and TTS providers |
| `claude-voice test` | Test voice input and output |
| `claude-voice --no-voice` | Start Claude without voice (passthrough) |

### Voice Interaction

1. **Start**: Run `claude-voice` to launch Claude Code with voice mode
2. **Speak**: Hold `Cmd+Option` and speak your prompt
3. **Send**: Release the keys to send your voice input to Claude
4. **Listen**: Claude's response plays through your speakers while text displays

### Interruption

If interrupt mode is enabled (configured during setup), you can press `Cmd+Option` while Claude is speaking to stop playback and start a new voice input.

## Configuration

Configuration is stored in `~/.claude/voice.json`:

```json
{
  "enabled": true,
  "stt": {
    "provider": "whisper-api",
    "apiKey": "sk-..."
  },
  "tts": {
    "provider": "elevenlabs",
    "apiKey": "...",
    "voiceId": "21m00Tcm4TlvDq8ikWAM"
  },
  "hotkey": "cmd+option",
  "interruptEnabled": true,
  "showTranscription": true
}
```

### STT Providers

| Provider | Description | Requirements |
|----------|-------------|--------------|
| `whisper-api` | OpenAI Whisper API | OpenAI API key |
| `whisper-local` | Local whisper.cpp | Coming soon |
| `apple-speech` | macOS native | macOS only, coming soon |
| `deepgram` | Deepgram streaming | Coming soon |

### TTS Providers

| Provider | Description | Requirements |
|----------|-------------|--------------|
| `elevenlabs` | ElevenLabs streaming | ElevenLabs API key |

## Architecture

```
claude-voice
     │
     ▼
┌─────────────────────────────────────────────┐
│           claude-voice CLI                   │
│  ┌─────────────────────────────────────┐    │
│  │        Voice Module Manager          │    │
│  │  (hotkeys, audio, STT, TTS, viz)    │    │
│  └───────────────┬─────────────────────┘    │
│                  │                           │
│  ┌───────────────▼─────────────────────┐    │
│  │         PTY Wrapper Layer            │    │
│  │   (spawns claude as child process)   │    │
│  └───────────────┬─────────────────────┘    │
└──────────────────┼──────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   claude CLI    │
         │  (unmodified)   │
         └─────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

## Roadmap

- [ ] Local Whisper support (whisper.cpp)
- [ ] Apple Speech Recognition (macOS native)
- [ ] Deepgram streaming STT
- [ ] Voice activity detection (VAD)
- [ ] Continuous conversation mode
- [ ] Linux and Windows support
- [ ] Custom hotkey configuration

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT

## Credits

Built with Claude Code by [Matt Moore](https://github.com/mtmoore55).
