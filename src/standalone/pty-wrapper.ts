import { spawn, ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';

export interface PTYWrapperOptions {
  onOutput?: (data: string) => void;
  onExit?: (code: number) => void;
}

/**
 * Process Wrapper - spawns claude CLI with inherited stdio
 * Voice input is handled externally via Hammerspoon typing
 */
export class PTYWrapper extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer: string = '';

  constructor() {
    super();
  }

  /**
   * Start the claude CLI process with full terminal passthrough
   */
  async start(options: PTYWrapperOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Find claude path
        let claudePath = '/opt/homebrew/bin/claude';
        try {
          claudePath = execSync('which claude', { encoding: 'utf8' }).trim();
        } catch {
          // Use default
        }

        // Spawn claude with inherited stdio for full terminal passthrough
        this.process = spawn(claudePath, [], {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit', // Direct terminal access
        });

        // Handle exit
        this.process.on('exit', (code) => {
          const exitCode = code ?? 0;
          this.emit('exit', exitCode);
          options.onExit?.(exitCode);
          process.exit(exitCode);
        });

        this.process.on('error', (error) => {
          reject(error);
        });

        // Handle process signals
        process.on('SIGINT', () => {
          this.process?.kill('SIGINT');
        });

        process.on('SIGTERM', () => {
          this.process?.kill('SIGTERM');
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send input - not available in inherit mode, use Hammerspoon typing instead
   */
  sendInput(text: string): void {
    // In inherit mode, we can't write to stdin directly
    // Voice input should be typed via Hammerspoon/AppleScript
    console.log(`[Voice Input]: ${text}`);
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
   * Kill the process
   */
  kill(): void {
    this.process?.kill();
    this.process = null;
  }

}
