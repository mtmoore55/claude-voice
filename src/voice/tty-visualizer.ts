/**
 * TTY Waveform Visualizer
 * Writes voice UI directly to a specified terminal TTY
 * Supports multiple states: ready, recording, countdown, sent
 */

import * as fs from 'fs';
import { spawn } from 'child_process';

const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const BAR_COUNT = 24;
const DECAY_RATE = 0.85;
const SMOOTHING = 0.3;
const SENSITIVITY = 50; // Increased for low mic levels

export type VoiceUIState = 'ready' | 'recording' | 'countdown' | 'sent' | 'hidden';

export class TTYVisualizer {
  private levels: number[] = [];
  private smoothedLevels: number[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private countdownIntervalId: NodeJS.Timeout | null = null;
  private isActive = false;
  private _ttyPath: string | null = null;
  private ttyFd: number | null = null;
  private state: VoiceUIState = 'hidden';
  private countdownValue = 3;
  private transcriptionPreview = '';
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
      } catch (error) {
        // TTY might have closed
      }
    }
  }

  /**
   * Show ready state
   */
  showReady(): void {
    this.state = 'ready';
    this.renderState();
  }

  /**
   * Start recording state with waveform
   */
  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.state = 'recording';

    this.playSound('start');

    // Update display at 30fps
    this.intervalId = setInterval(() => {
      this.renderRecording();
    }, 33);
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
  }

  /**
   * Start countdown with transcription preview
   */
  startCountdown(transcription: string, seconds: number = 3): void {
    this.state = 'countdown';
    this.countdownValue = seconds;
    this.transcriptionPreview = transcription;

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
   * Show sent confirmation
   */
  showSent(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.state = 'sent';
    this.renderState();

    // Hide after 1 second
    setTimeout(() => {
      this.state = 'hidden';
      this.clearLine();
    }, 1000);
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
        line = `${cyan}🎙️ Voice Ready${reset} ${dim}(Hold Right ⌥ to talk)${reset}`;
        break;

      case 'countdown':
        const preview = this.transcriptionPreview.length > 30
          ? this.transcriptionPreview.substring(0, 30) + '...'
          : this.transcriptionPreview;
        const countdownStr = this.countdownValue > 0 ? `${this.countdownValue}...` : 'Sending...';
        line = `${yellow}📤${reset} "${preview}" ${bold}${countdownStr}${reset} ${dim}(↵=send, type to edit)${reset}`;
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
   */
  private renderRecording(): void {
    if (this.ttyFd === null || this.state !== 'recording') return;

    // Apply smoothing and decay
    for (let i = 0; i < BAR_COUNT; i++) {
      const target = this.levels[i];
      this.smoothedLevels[i] = this.smoothedLevels[i] * SMOOTHING + target * (1 - SMOOTHING);
      if (this.smoothedLevels[i] > this.levels[i]) {
        this.smoothedLevels[i] *= DECAY_RATE;
      }
    }

    const cyan = '\x1b[36m';
    const red = '\x1b[31m';
    const dim = '\x1b[2m';
    const reset = '\x1b[0m';

    // Build waveform bars
    const bars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    const line = `${red}🎤${reset} ${cyan}${bars}${reset} ${dim}(release ⌥ to send)${reset}`;
    this.writeLineToTTY(line);
  }

  /**
   * Write to the Voice Ready area in Claude Code's status line
   * Positions at column 46 on the Context Remaining line
   */
  private writeLineToTTY(line: string): void {
    if (line === this.lastRenderedLine) return;

    // Save cursor, move to status line, position at Voice Ready column
    this.writeTTY('\x1b7');           // Save cursor position
    this.writeTTY('\x1b[999;1H');     // Move to bottom
    this.writeTTY('\x1b[3A');         // Move up 3 lines (Context Remaining line)
    this.writeTTY('\x1b[43G');        // Move to column 46 (where Voice Ready starts)
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
    this.writeTTY('\x1b[3A');         // Move up 3 lines
    this.writeTTY('\x1b[43G');        // Move to column 46
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
    if (this.ttyFd !== null) {
      try {
        fs.closeSync(this.ttyFd);
      } catch {}
      this.ttyFd = null;
    }
    this._ttyPath = null;
  }
}
