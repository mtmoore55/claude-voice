/**
 * Terminal Waveform Visualizer
 * Displays animated audio levels in the terminal using Unicode block characters
 * Supports symmetric/mirrored waveform display
 */

// Block characters for waveform bars (bottom-aligned, grow upward)
const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

const BAR_COUNT = 24;
const DECAY_RATE = 0.88;
const SMOOTHING = 0.25;
const SENSITIVITY = 2.5; // Amplify quiet audio

export type VisualizerStyle = 'symmetric' | 'single' | 'meter';

export class Visualizer {
  private levels: number[] = [];
  private smoothedLevels: number[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private isActive = false;
  private lastOutput = '';
  private style: VisualizerStyle = 'symmetric';
  private lineCount = 0;

  constructor(style: VisualizerStyle = 'symmetric') {
    this.style = style;
    this.levels = new Array(BAR_COUNT).fill(0);
    this.smoothedLevels = new Array(BAR_COUNT).fill(0);
  }

  /**
   * Start the visualizer
   */
  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.lineCount = 0;

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
    this.clearDisplay();
    this.levels.fill(0);
    this.smoothedLevels.fill(0);
    this.lastOutput = '';
  }

  /**
   * Update with new audio level (0-1)
   */
  updateLevel(level: number): void {
    // Amplify and clamp
    const amplified = Math.min(1, level * SENSITIVITY);

    // Shift levels to the left
    this.levels.shift();
    this.levels.push(amplified);
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

      // Apply decay when level drops
      if (this.smoothedLevels[i] > this.levels[i]) {
        this.smoothedLevels[i] *= DECAY_RATE;
      }
    }

    let output: string;

    if (this.style === 'symmetric') {
      output = this.renderSymmetric();
    } else if (this.style === 'meter') {
      output = this.renderMeter();
    } else {
      output = this.renderSingle();
    }

    // Only update if changed
    if (output !== this.lastOutput) {
      this.clearDisplay();
      process.stdout.write(output);
      this.lastOutput = output;
    }
  }

  /**
   * Render symmetric/mirrored waveform (bars up and down from center)
   */
  private renderSymmetric(): string {
    const cyan = '\x1b[36m';
    const reset = '\x1b[0m';

    // Build top row (upward bars)
    const topBars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    // Build bottom row (downward bars - mirror of top)
    const bottomBars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    this.lineCount = 2;

    return `  ${cyan}${topBars}${reset}\n  ${cyan}${bottomBars}${reset}`;
  }

  /**
   * Render single-line scrolling waveform
   */
  private renderSingle(): string {
    const cyan = '\x1b[36m';
    const reset = '\x1b[0m';

    const bars = this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');

    this.lineCount = 1;

    return `  ${cyan}${bars}${reset}`;
  }

  /**
   * Render horizontal level meter
   */
  private renderMeter(): string {
    const green = '\x1b[32m';
    const yellow = '\x1b[33m';
    const red = '\x1b[31m';
    const dim = '\x1b[2m';
    const reset = '\x1b[0m';

    // Use peak level
    const peak = Math.max(...this.smoothedLevels);
    const meterWidth = 30;
    const filledCount = Math.floor(peak * meterWidth);

    let meter = '';
    for (let i = 0; i < meterWidth; i++) {
      if (i < filledCount) {
        // Color gradient: green -> yellow -> red
        if (i < meterWidth * 0.6) {
          meter += `${green}█${reset}`;
        } else if (i < meterWidth * 0.85) {
          meter += `${yellow}█${reset}`;
        } else {
          meter += `${red}█${reset}`;
        }
      } else {
        meter += `${dim}░${reset}`;
      }
    }

    this.lineCount = 1;

    return `  ${meter}`;
  }

  /**
   * Clear the display area
   */
  private clearDisplay(): void {
    // Move up and clear each line we've written
    if (this.lineCount > 0) {
      for (let i = 0; i < this.lineCount; i++) {
        process.stdout.write('\x1b[A\x1b[K'); // Move up, clear line
      }
    }
    process.stdout.write('\r\x1b[K'); // Clear current line
  }

  /**
   * Get visualization string without rendering
   */
  getVisualization(): string {
    if (this.style === 'symmetric') {
      const topBars = this.smoothedLevels.map(level => {
        const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
        return BLOCKS[Math.max(0, index)];
      }).join('');

      const bottomBars = this.smoothedLevels.map(level => {
        const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
        return BLOCKS[Math.max(0, index)];
      }).join('');

      return `${topBars}\n${bottomBars}`;
    }

    return this.smoothedLevels.map(level => {
      const index = Math.min(BLOCKS.length - 1, Math.floor(level * BLOCKS.length));
      return BLOCKS[Math.max(0, index)];
    }).join('');
  }

  /**
   * Check if visualizer is running
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Set visualization style
   */
  setStyle(style: VisualizerStyle): void {
    this.style = style;
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
