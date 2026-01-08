import * as pty from 'node-pty';
import { EventEmitter } from 'events';

export interface PTYWrapperOptions {
  onOutput?: (data: string) => void;
  onExit?: (code: number) => void;
}

/**
 * PTY Wrapper - spawns claude CLI in a pseudo-terminal
 * This allows claude-voice to intercept and augment I/O
 */
export class PTYWrapper extends EventEmitter {
  private ptyProcess: pty.IPty | null = null;
  private buffer: string = '';

  constructor() {
    super();
  }

  /**
   * Start the claude CLI process
   */
  async start(options: PTYWrapperOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Spawn claude in a PTY
        this.ptyProcess = pty.spawn('claude', [], {
          name: 'xterm-256color',
          cols: process.stdout.columns || 80,
          rows: process.stdout.rows || 24,
          cwd: process.cwd(),
          env: process.env as { [key: string]: string },
        });

        // Handle output from claude
        this.ptyProcess.onData((data: string) => {
          // Pass through to stdout
          process.stdout.write(data);

          // Buffer for TTS processing (strip ANSI codes)
          const cleanData = this.stripAnsi(data);
          if (cleanData.trim()) {
            this.buffer += cleanData;
            this.emit('output', cleanData);
            options.onOutput?.(cleanData);
          }
        });

        // Handle exit
        this.ptyProcess.onExit(({ exitCode }) => {
          this.emit('exit', exitCode);
          options.onExit?.(exitCode);
          process.exit(exitCode);
        });

        // Forward stdin to PTY
        process.stdin.setRawMode?.(true);
        process.stdin.resume();
        process.stdin.on('data', (data: Buffer) => {
          this.ptyProcess?.write(data.toString());
        });

        // Handle terminal resize
        process.stdout.on('resize', () => {
          this.ptyProcess?.resize(
            process.stdout.columns || 80,
            process.stdout.rows || 24
          );
        });

        // Handle process signals
        process.on('SIGINT', () => {
          this.ptyProcess?.kill();
        });

        process.on('SIGTERM', () => {
          this.ptyProcess?.kill();
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send input to the claude process
   */
  sendInput(text: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(text);
    }
  }

  /**
   * Get buffered output and clear buffer
   */
  flushBuffer(): string {
    const content = this.buffer;
    this.buffer = '';
    return content;
  }

  /**
   * Kill the PTY process
   */
  kill(): void {
    this.ptyProcess?.kill();
    this.ptyProcess = null;
  }

  /**
   * Strip ANSI escape codes from text
   */
  private stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
  }
}
