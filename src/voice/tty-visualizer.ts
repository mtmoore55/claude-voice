/**
 * TTY Waveform Visualizer
 * Writes voice UI directly to a specified terminal TTY
 * Supports multiple states: ready, recording, countdown, sent
 */

import * as fs from 'fs';
import { spawn } from 'child_process';

const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const BAR_COUNT = 16;
const DECAY_RATE = 0.85;
const SMOOTHING = 0.3;
const SENSITIVITY = 50;

export type VoiceUIState = 'ready' | 'recording' | 'countdown' | 'sent' | 'hidden';

export class TTYVisualizer {
  private levels: number[] = [];
  private smoothedLevels: number[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private countdownIntervalId: NodeJS.Timeout | null = null;
  private readyIntervalId: NodeJS.Timeout | null = null;
  private isActive = false;
  private _ttyPath: string | null = null;
  private ttyFd: number | null = null;
  private state: VoiceUIState = 'hidden';
  private countdownValue = 3;
  private lastRenderedLine = '';

  constructor() {
    this.levels = new Array(BAR_COUNT).fill(0);
    this.smoothedLevels = new Array(BAR_COUNT).fill(0);
  }

  /**
   * Set the target TTY to write to
   */
  setTTY(ttyPath: string): boolean {
    try {
      if (this.ttyFd !== null) {
        fs.closeSync(this.ttyFd);
        this.ttyFd = null;
      }

      this.ttyFd = fs.openSync(ttyPath, 'w');
      this._ttyPath = ttyPath;
      return true;
    } catch (error) {
      console.error(`Failed to open TTY ${ttyPath}:`, error);
      return false;
    }
  }

  /**
   * Write directly to the TTY
   */
  private writeTTY(data: string): void {
    if (this.ttyFd !== null) {
      try {
        fs.writeSync(this.ttyFd, data);
      } catch {
        // TTY might have closed
      }
    }
  }

  /**
   * Show ready state - sets internal state only
   * The actual "Voice Ready" indicator is shown by statusline.sh to avoid flashing
   * Direct TTY writes conflict with Claude Code's TUI redraws and cause flickering
   */
  showReady(): void {
    // Stop any existing ready interval
    if (this.readyIntervalId) {
      clearInterval(this.readyIntervalId);
      this.readyIntervalId = null;
    }

    this.state = 'ready';

    // Don't write directly to TTY - let statusline.sh handle the "Voice Ready" indicator
    // This prevents flashing that occurs when direct TTY writes conflict with TUI redraws
  }

  /**
   * Stop the ready indicator refresh
   */
  private stopReadyIndicator(): void {
    if (this.readyIntervalId) {
      clearInterval(this.readyIntervalId);
      this.readyIntervalId = null;
    }
  }

  /**
   * Start recording state with waveform
   */
  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.state = 'recording';

    // Stop ready indicator when recording starts
    this.stopReadyIndicator();

    this.playSound('start');

    // Update waveform display at 10fps (reduced from 30fps to minimize flickering)
    this.intervalId = setInterval(() => {
      this.renderRecording();
    }, 100);
  }

  /**
   * Stop recording
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
    this.playSound('stop');
    this.levels.fill(0);
    this.smoothedLevels.fill(0);

    // Clear the REC indicator from the TTY
    if (this.ttyFd !== null) {
      try {
        // Save cursor, move to bottom, clear line, restore cursor
        fs.writeSync(this.ttyFd, '\x1b7\x1b[999;1H\x1b[2K\x1b8');
      } catch {
        // Ignore errors
      }
    }

    // Remove waveform file so statusline shows "Voice Ready" again
    try {
      fs.unlinkSync('/tmp/claude-voice-waveform');
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Start countdown (transcription parameter kept for API compatibility)
   */
  startCountdown(_transcription: string, seconds: number = 3): void {
    this.state = 'countdown';
    this.countdownValue = seconds;

    this.renderState();

    this.countdownIntervalId = setInterval(() => {
      this.countdownValue--;
      if (this.countdownValue >= 0) {
        this.renderState();
      }
    }, 1000);
  }

  /**
   * Cancel countdown
   */
  cancelCountdown(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.state = 'hidden';
    this.clearLine();
  }

  /**
   * Get current countdown value
   */
  getCountdownValue(): number {
    return this.countdownValue;
  }

  /**
   * Show sent confirmation (showReady will be called by daemon after this)
   */
  showSent(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.state = 'sent';
    this.renderState();
    // Don't auto-hide - let showReady() handle the transition
  }

  /**
   * Update with new audio level (0-1)
   */
  updateLevel(level: number): void {
    const amplified = Math.min(1, level * SENSITIVITY);
    this.levels.shift();
    this.levels.push(amplified);
  }

  /**
   * Render based on current state
   */
  private renderState(): void {
    if (this.ttyFd === null) return;

    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const yellow = '\x1b[33m';
    const dim = '\x1b[2m';
    const bold = '\x1b[1m';
    const reset = '\x1b[0m';

    let line = '';

    switch (this.state) {
      case 'ready':
        line = `${cyan}🎙️ Voice Ready${reset} ${dim}(⌘. to talk)${reset}`;
        break;

      case 'countdown':
        // Just show countdown number, no duplicate text preview
        const countdownStr = this.countdownValue > 0 ? `${this.countdownValue}...` : 'Sending...';
        line = `${yellow}📤${reset} ${bold}${countdownStr}${reset} ${dim}(↵=send, type to edit)${reset}`;
        break;

      case 'sent':
        line = `${green}✓ Sent!${reset}`;
        break;

      case 'hidden':
        line = '';
        break;
    }

    this.writeLineToTTY(line);
  }

  /**
   * Render recording state with waveform
   * Writes waveform to file for statusline.sh to read
   */
  private renderRecording(): void {
    if (this.state !== 'recording') return;

    // Apply smoothing and decay
    for (let i = 0; i < BAR_COUNT; i++) {
      const target = this.levels[i];
      this.smoothedLevels[i] = this.smoothedLevels[i] * SMOOTHING + target * (1 - SMOOTHING);
      if (this.smoothedLevels[i] > this.levels[i]) {
        this.smoothedLevels[i] *= DECAY_RATE;
      }
    }

    // Build waveform bars
    const bars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    // Write to file for statusline.sh to read
    try {
      fs.writeFileSync('/tmp/claude-voice-waveform', bars);
    } catch {
      // Ignore write errors
    }

    // Also write directly to TTY at high frequency - positioned at bottom of screen
    // Use save/restore cursor to avoid disrupting user input
    if (this.ttyFd !== null) {
      const cyan = '\x1b[38;5;81m';
      const red = '\x1b[38;5;196m';
      const reset = '\x1b[0m';
      const indicator = `${red}●${reset} ${cyan}REC ${bars}${reset}`;

      // Position at absolute bottom-right, then restore cursor
      const output = `\x1b7\x1b[999;1H\x1b[2K${indicator}\x1b8`;
      try {
        fs.writeSync(this.ttyFd, output);
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Write to the right side of the input line (❯ prompt line)
   * The input is ~5 lines up from the bottom in Claude Code's layout
   */
  private writeLineToTTY(line: string): void {
    if (line === this.lastRenderedLine) return;

    // Position: save cursor, move to bottom, up 5 lines (input line), column 60, write, restore
    this.writeTTY('\x1b7');           // Save cursor position
    this.writeTTY('\x1b[999;1H');     // Move to bottom of screen
    this.writeTTY('\x1b[5A');         // Move up 5 lines (to input prompt line)
    this.writeTTY('\x1b[60G');        // Move to column 60 (right side)
    this.writeTTY('\x1b[K');          // Clear from cursor to end of line
    this.writeTTY(line);
    this.writeTTY('\x1b8');           // Restore cursor position

    this.lastRenderedLine = line;
  }

  /**
   * Clear the voice UI area
   */
  private clearLine(): void {
    this.writeTTY('\x1b7');           // Save cursor
    this.writeTTY('\x1b[999;1H');     // Move to bottom
    this.writeTTY('\x1b[5A');         // Move up 5 lines (input line)
    this.writeTTY('\x1b[60G');        // Move to column 60
    this.writeTTY('\x1b[K');          // Clear to end of line
    this.writeTTY('\x1b8');           // Restore cursor
    this.lastRenderedLine = '';
  }

  /**
   * Play audio feedback sounds
   */
  private playSound(type: 'start' | 'stop'): void {
    const sounds: Record<string, string> = {
      start: '/System/Library/Sounds/Tink.aiff',
      stop: '/System/Library/Sounds/Pop.aiff',
    };

    const soundFile = sounds[type];
    if (soundFile) {
      spawn('afplay', [soundFile], { stdio: 'ignore', detached: true }).unref();
    }
  }

  /**
   * Check if visualizer is running
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get current TTY path
   */
  getTTYPath(): string | null {
    return this._ttyPath;
  }

  /**
   * Get current state
   */
  getState(): VoiceUIState {
    return this.state;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stop();
    this.cancelCountdown();
    this.stopReadyIndicator();
    if (this.ttyFd !== null) {
      try {
        fs.closeSync(this.ttyFd);
      } catch {}
      this.ttyFd = null;
    }
    this._ttyPath = null;
  }
}
