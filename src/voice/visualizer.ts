/**
 * Terminal Waveform Visualizer
 * Displays animated audio levels in the terminal using Unicode block characters
 */

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const BAR_COUNT = 20;
const DECAY_RATE = 0.85;
const SMOOTHING = 0.3;

export class Visualizer {
  private levels: number[] = [];
  private smoothedLevels: number[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private isActive = false;
  private lastLine = '';

  constructor() {
    this.levels = new Array(BAR_COUNT).fill(0);
    this.smoothedLevels = new Array(BAR_COUNT).fill(0);
  }

  /**
   * Start the visualizer
   */
  start(): void {
    if (this.isActive) return;
    this.isActive = true;

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
    this.isActive = false;
    this.clearLine();
    this.levels.fill(0);
    this.smoothedLevels.fill(0);
  }

  /**
   * Update with new audio level (0-1)
   */
  updateLevel(level: number): void {
    // Shift levels to the left
    this.levels.shift();
    this.levels.push(level);
  }

  /**
   * Render the waveform to terminal
   */
  private render(): void {
    if (!this.isActive) return;

    // Apply smoothing and decay
    for (let i = 0; i < BAR_COUNT; i++) {
      const target = this.levels[i];
      this.smoothedLevels[i] = this.smoothedLevels[i] * SMOOTHING + target * (1 - SMOOTHING);

      // Apply decay
      if (this.smoothedLevels[i] > this.levels[i]) {
        this.smoothedLevels[i] *= DECAY_RATE;
      }
    }

    // Build the visualization string
    const bars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    const line = `  \x1b[36m${bars}\x1b[0m`;

    // Only update if changed
    if (line !== this.lastLine) {
      this.clearLine();
      process.stdout.write(line);
      this.lastLine = line;
    }
  }

  /**
   * Clear the current line
   */
  private clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  /**
   * Get visualization string without rendering
   */
  getVisualization(): string {
    const bars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    return bars;
  }

  /**
   * Check if visualizer is running
   */
  isRunning(): boolean {
    return this.isActive;
  }
}

/**
 * Create a simple pulsing animation for status indicators
 */
export function createPulse(text: string, color: string = 'cyan'): () => void {
  const colors: Record<string, string> = {
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
  };

  const colorCode = colors[color] || colors.cyan;
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  let frame = 0;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  const intervalId = setInterval(() => {
    const spinner = frames[frame % frames.length];
    process.stdout.write(`\r${colorCode}${spinner}${reset} ${dim}${text}${reset}`);
    frame++;
  }, 80);

  return () => {
    clearInterval(intervalId);
    process.stdout.write('\r\x1b[K');
  };
}
