/**
 * TTY Waveform Visualizer
 * Writes animated waveform directly to a specified terminal TTY
 * Positions at the bottom of the terminal window
 */

import * as fs from 'fs';

const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const BAR_COUNT = 32;
const DECAY_RATE = 0.85;
const SMOOTHING = 0.3;
const SENSITIVITY = 2.5;

export class TTYVisualizer {
  private levels: number[] = [];
  private smoothedLevels: number[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private isActive = false;
  private _ttyPath: string | null = null;
  private ttyFd: number | null = null;
  private savedCursorPos = false;

  constructor() {
    this.levels = new Array(BAR_COUNT).fill(0);
    this.smoothedLevels = new Array(BAR_COUNT).fill(0);
  }

  /**
   * Set the target TTY to write to
   */
  setTTY(ttyPath: string): boolean {
    try {
      // Close existing TTY if open
      if (this.ttyFd !== null) {
        fs.closeSync(this.ttyFd);
        this.ttyFd = null;
      }

      // Open the TTY for writing
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
        console.error('TTY write error:', error);
      }
    }
  }

  /**
   * Start the visualizer
   */
  start(): void {
    if (this.isActive || this.ttyFd === null) return;
    this.isActive = true;

    // Save cursor position and move to bottom
    this.writeTTY('\x1b7'); // Save cursor
    this.savedCursorPos = true;

    // Get terminal size and position at bottom
    this.positionAtBottom();

    // Play start sound
    this.playSound('start');

    // Update display at 30fps
    this.intervalId = setInterval(() => {
      this.render();
    }, 33);
  }

  /**
   * Stop the visualizer
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.isActive && this.ttyFd !== null) {
      // Clear the waveform area
      this.clearWaveform();

      // Restore cursor position
      if (this.savedCursorPos) {
        this.writeTTY('\x1b8'); // Restore cursor
        this.savedCursorPos = false;
      }

      // Play stop sound
      this.playSound('stop');
    }

    this.isActive = false;
    this.levels.fill(0);
    this.smoothedLevels.fill(0);
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
   * Position cursor at bottom of terminal
   */
  private positionAtBottom(): void {
    // Move to bottom-left, leaving room for 3 lines
    this.writeTTY('\x1b[999;1H'); // Move to row 999 (will clamp to bottom)
    this.writeTTY('\x1b[3A');     // Move up 3 lines
  }

  /**
   * Render the waveform
   */
  private render(): void {
    if (!this.isActive || this.ttyFd === null) return;

    // Apply smoothing and decay
    for (let i = 0; i < BAR_COUNT; i++) {
      const target = this.levels[i];
      this.smoothedLevels[i] = this.smoothedLevels[i] * SMOOTHING + target * (1 - SMOOTHING);
      if (this.smoothedLevels[i] > this.levels[i]) {
        this.smoothedLevels[i] *= DECAY_RATE;
      }
    }

    const cyan = '\x1b[36m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    // Build waveform bars
    const bars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    // Mirror for symmetric effect
    const mirrorBars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    // Position at bottom and draw
    this.writeTTY('\x1b7'); // Save current cursor
    this.positionAtBottom();

    // Draw header
    this.writeTTY(`\x1b[K${bold}${cyan}🎤 Recording...${reset}\n`);
    // Draw top bars
    this.writeTTY(`\x1b[K  ${cyan}${bars}${reset}\n`);
    // Draw bottom bars (mirrored)
    this.writeTTY(`\x1b[K  ${cyan}${mirrorBars}${reset}`);

    this.writeTTY('\x1b8'); // Restore cursor
  }

  /**
   * Clear the waveform display
   */
  private clearWaveform(): void {
    this.writeTTY('\x1b7'); // Save cursor
    this.positionAtBottom();
    this.writeTTY('\x1b[K\n\x1b[K\n\x1b[K'); // Clear 3 lines
    this.writeTTY('\x1b8'); // Restore cursor
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
      // Play asynchronously
      const { spawn } = require('child_process');
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
   * Cleanup resources
   */
  cleanup(): void {
    this.stop();
    if (this.ttyFd !== null) {
      try {
        fs.closeSync(this.ttyFd);
      } catch {}
      this.ttyFd = null;
    }
    this._ttyPath = null;
  }
}
