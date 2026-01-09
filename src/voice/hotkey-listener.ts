import { EventEmitter } from 'events';
import * as http from 'http';
import * as readline from 'readline';

const DEFAULT_PORT = 17394; // Voice daemon port

export interface HotkeyListenerEvents {
  'ptt:start': () => void;
  'ptt:end': () => void;
  'speak': (text: string) => void;
}

/**
 * Global hotkey listener for push-to-talk
 * Uses HTTP server to receive commands from Hammerspoon (or other sources)
 * Also supports Enter key to stop recording as fallback
 */
export class HotkeyListener extends EventEmitter {
  private isListening = false;
  private pttActive = false;
  private server: http.Server | null = null;
  private rl: readline.Interface | null = null;
  private port: number;
  private lastTranscription: string = '';

  constructor(port: number = DEFAULT_PORT) {
    super();
    this.port = port;
  }

  /**
   * Set the last transcription (called by daemon after STT completes)
   */
  setTranscription(text: string): void {
    this.lastTranscription = text;
  }

  /**
   * Get and clear the last transcription
   */
  getTranscription(): string {
    const text = this.lastTranscription;
    this.lastTranscription = '';
    return text;
  }

  /**
   * Start listening for hotkey commands
   */
  start(): void {
    if (this.isListening) return;

    // Setup HTTP server for Hammerspoon communication
    this.server = http.createServer((req, res) => {
      // Enable CORS for local requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // GET endpoints
      if (req.method === 'GET') {
        if (req.url === '/transcription') {
          const text = this.getTranscription();
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(text);
        } else if (req.url === '/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ active: this.pttActive }));
        } else {
          res.writeHead(404);
          res.end('not found');
        }
        return;
      }

      // POST endpoints
      if (req.method === 'POST') {
        if (req.url === '/ptt/start') {
          this.handleStart();
          res.writeHead(200);
          res.end('ok');
        } else if (req.url === '/ptt/stop') {
          this.handleStop();
          res.writeHead(200);
          res.end('ok');
        } else if (req.url === '/ptt/toggle') {
          if (this.pttActive) {
            this.handleStop();
          } else {
            this.handleStart();
          }
          res.writeHead(200);
          res.end('ok');
        } else if (req.url === '/speak') {
          // Read body and emit speak event
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            if (body.trim()) {
              console.log(`[TTS] Speaking: ${body.substring(0, 50)}...`);
              this.emit('speak', body);
            }
            res.writeHead(200);
            res.end('ok');
          });
        } else {
          res.writeHead(404);
          res.end('not found');
        }
      } else {
        res.writeHead(405);
        res.end('method not allowed');
      }
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[HotkeyListener] HTTP server listening on port ${this.port}`);
      console.log(`[HotkeyListener] Waiting for Hammerspoon hotkey signals...`);
      console.log(`[HotkeyListener] You can also press ENTER to stop recording\n`);
    });

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[HotkeyListener] Port ${this.port} is already in use. Is another voice daemon running?`);
      } else {
        console.error('[HotkeyListener] Server error:', error);
      }
    });

    // Setup readline for Enter key detection (fallback to stop recording)
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    this.rl.on('line', () => {
      if (this.pttActive) {
        console.log(`[DEBUG] Enter pressed - stopping`);
        this.handleStop();
      }
    });

    this.isListening = true;
  }

  /**
   * Stop listening for hotkeys
   */
  stop(): void {
    if (!this.isListening) return;

    this.server?.close();
    this.server = null;
    this.rl?.close();
    this.rl = null;
    this.isListening = false;
    this.pttActive = false;
  }

  /**
   * Check if PTT is currently active
   */
  isPTTActive(): boolean {
    return this.pttActive;
  }

  private handleStart(): void {
    if (!this.pttActive) {
      console.log(`>>> PTT START (via HTTP)`);
      this.pttActive = true;
      this.emit('ptt:start');
    }
  }

  private handleStop(): void {
    if (this.pttActive) {
      console.log(`>>> PTT STOP (via HTTP)`);
      this.pttActive = false;
      this.emit('ptt:end');
    }
  }
}
