# Claude Voice - Product Specification

## Overview

Claude Voice adds voice input capability to Claude Code. Users can speak their prompts instead of typing, with visual feedback throughout the process.

## User Flow

### Starting Voice Mode

1. User runs `claude-voice on` (from within Claude Code or any terminal)
2. Status line shows: `🎙️ Voice Ready (⌘.)`
3. User is now ready to record

### Recording

1. User presses **Cmd+.** to start recording
2. **Visual feedback in Claude Code's input area:**
   - Waveform animation appears showing audio levels
   - Example: `🎤 ▁▂▃▅▇▅▃▂▁ Recording...`
3. User speaks their prompt
4. User presses **Cmd+.** again to stop recording

### Processing & Review

1. After recording stops:
   - Brief "Processing..." indicator
   - Whisper transcribes the audio
2. Transcribed text appears in Claude Code's input field
3. **Countdown begins** (shown in Claude Code, not Hammerspoon overlay):
   - `Sending in 3...`
   - `Sending in 2...`
   - `Sending in 1...`
   - Text auto-submits

### Editing During Countdown

During the countdown, the user can:
- **Type/Backspace** to edit the transcribed text (countdown continues)
- **Press Enter** to send immediately
- **Press Escape** to cancel (clears text, returns to ready state)
- **Press Cmd+.** to cancel and re-record

### After Sending

1. Text is submitted to Claude
2. Status returns to: `🎙️ Voice Ready (⌘.)`

---

## Visual Indicators

### Status Line Integration

The status line should show voice status on the second line:

```
📁 ~/Code/project  🌿 main  🤖 Claude Opus 4.5
🧠 Context: 95%  🎙️ Voice Ready (⌘.)
```

States:
| State | Status Line Display |
|-------|---------------------|
| Ready | `🎙️ Voice Ready (⌘.)` |
| Recording | `🎤 Recording... (⌘. to stop)` |
| Processing | `⏳ Processing...` |
| Countdown | `📤 Sending in 3...` |

### Waveform Visualization

During recording, show a waveform that responds to audio input levels:

```
🎤 ▁▂▃▅▇▅▃▂▁ Recording...
```

The bars should animate based on microphone input levels:
- `▁` = silence/very quiet
- `▂▃▄▅▆▇█` = increasing volume levels

### Countdown Display

Show countdown in the terminal/status area, NOT as a Hammerspoon overlay:

```
Your transcribed text here...
📤 Sending in 3... (Backspace to edit, Esc to cancel)
```

---

## Hotkeys

| Hotkey | Context | Action |
|--------|---------|--------|
| **Cmd+.** | Ready state | Start recording |
| **Cmd+.** | Recording | Stop recording, begin transcription |
| **Cmd+.** | Countdown | Cancel, clear text, return to ready |
| **Enter** | Countdown | Send immediately |
| **Escape** | Countdown | Cancel, clear text, return to ready |
| **Backspace** | Countdown | Edit text (normal editing) |

---

## Architecture

### Components

1. **Voice Daemon** (`claude-voice on`)
   - HTTP server for Hammerspoon communication
   - Audio recording via `sox`
   - Speech-to-text via `whisper-cpp`
   - Manages recording state

2. **Hammerspoon Script** (`hammerspoon-init.lua`)
   - Global hotkey listener (Cmd+.)
   - Communicates with daemon via HTTP
   - Types transcribed text into active window

3. **Status Line Script** (`statusline-voice.sh`)
   - Shows voice status in Claude Code's status line
   - Polls daemon for current state

4. **TTY Visualizer** (`tty-visualizer.ts`)
   - Writes waveform directly to terminal
   - Shows recording/countdown status

### Communication Flow

```
User presses Cmd+.
       ↓
Hammerspoon detects hotkey
       ↓
HTTP POST to daemon /ptt/start
       ↓
Daemon starts recording + shows waveform
       ↓
User presses Cmd+. again
       ↓
HTTP POST to daemon /ptt/stop
       ↓
Daemon transcribes audio
       ↓
Hammerspoon fetches /transcription
       ↓
Text typed into Claude Code input
       ↓
Countdown shown in terminal
       ↓
Auto-submit after 3 seconds (or user action)
```

---

## Installation Requirements

1. **Homebrew packages:**
   - `sox` - audio recording
   - `whisper-cpp` - speech-to-text

2. **Hammerspoon:**
   - Installed and running
   - Accessibility permissions granted
   - `init.lua` configured with claude-voice script

3. **Claude Code:**
   - Status line configured to use `statusline-voice.sh`
   - Voice mode plugin installed (optional, can run daemon directly)

---

## Current Gaps (TODO)

- [ ] Waveform not showing in Claude Code terminal (only in daemon's terminal)
- [ ] Countdown shows in Hammerspoon overlay instead of terminal
- [ ] Backspace during countdown cancels instead of allowing edit
- [ ] Status line integration needs setup on each machine

---

## Design Principles

1. **Visual feedback is essential** - User must always know what state voice mode is in
2. **Non-destructive by default** - Countdown gives user chance to review/edit
3. **Keyboard-centric** - All actions accessible via keyboard
4. **Works with existing Claude Code** - Integrates via status line, doesn't require Claude Code changes
