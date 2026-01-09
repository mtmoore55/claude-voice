import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { STTConfig } from '../../types.js';
import { STTProvider } from './provider.js';

const DEFAULT_MODEL = 'ggml-base.en.bin';
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';

/**
 * Whisper.cpp local provider for Speech-to-Text
 * Runs entirely locally - no API key needed
 */
export class WhisperCppProvider implements STTProvider {
  name = 'whisper-cpp';
  private modelPath: string | null = null;
  private whisperPath: string | null = null;
  private audioBuffer: Buffer[] = [];
  private modelsDir: string;

  constructor() {
    // Store models in ~/.claude-voice/models
    this.modelsDir = path.join(os.homedir(), '.claude-voice', 'models');
  }

  async initialize(config: STTConfig): Promise<void> {
    // Find whisper-cpp binary
    this.whisperPath = await this.findWhisperBinary();
    if (!this.whisperPath) {
      throw new Error(
        'whisper.cpp not found. Install with: brew install whisper-cpp'
      );
    }
    console.log(`Using whisper binary: ${this.whisperPath}`);

    // Set up model path
    if (config.modelPath) {
      this.modelPath = config.modelPath;
    } else {
      // Use default model location
      this.modelPath = path.join(this.modelsDir, DEFAULT_MODEL);
    }

    // Download model if not present
    if (!fs.existsSync(this.modelPath)) {
      await this.downloadModel();
    }
  }

  /**
   * Find the whisper-cpp binary
   */
  private async findWhisperBinary(): Promise<string | null> {
    const possiblePaths = [
      '/opt/homebrew/bin/whisper-cli',
      '/usr/local/bin/whisper-cli',
      '/opt/homebrew/bin/whisper-cpp',
      '/usr/local/bin/whisper-cpp',
      '/opt/homebrew/bin/whisper',
      '/usr/local/bin/whisper',
    ];

    // Check common paths first
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Try to find via which
    try {
      const result = execSync('which whisper-cli 2>/dev/null || which whisper-cpp 2>/dev/null || which whisper 2>/dev/null', {
        encoding: 'utf-8',
      }).trim();
      if (result && fs.existsSync(result)) {
        return result;
      }
    } catch {
      // Not found via which
    }

    return null;
  }

  /**
   * Download the whisper model
   */
  private async downloadModel(): Promise<void> {
    // Ensure models directory exists
    fs.mkdirSync(this.modelsDir, { recursive: true });

    console.log(`Downloading whisper model to ${this.modelPath}...`);
    console.log('This is a one-time download (~142MB for base.en model)');

    return new Promise((resolve, reject) => {
      const curlArgs = [
        '-L',
        '-o', this.modelPath!,
        '--progress-bar',
        MODEL_URL,
      ];

      const curl = spawn('curl', curlArgs, {
        stdio: ['ignore', 'inherit', 'inherit'],
      });

      curl.on('close', (code) => {
        if (code === 0) {
          console.log('Model downloaded successfully!');
          resolve();
        } else {
          reject(new Error(`Failed to download model (exit code ${code})`));
        }
      });

      curl.on('error', (err) => {
        reject(new Error(`Failed to download model: ${err.message}`));
      });
    });
  }

  async startStream(): Promise<void> {
    this.audioBuffer = [];
  }

  async processAudio(audioData: Buffer): Promise<void> {
    this.audioBuffer.push(audioData);
  }

  async stopStream(): Promise<string> {
    const fullAudio = Buffer.concat(this.audioBuffer);
    return this.transcribe(fullAudio);
  }

  onPartialTranscript(_callback: (text: string) => void): void {
    // Whisper.cpp doesn't support streaming partial transcripts
    // This is a no-op but required by the interface
  }

  async isAvailable(): Promise<boolean> {
    return this.whisperPath !== null && this.modelPath !== null && fs.existsSync(this.modelPath);
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    if (!this.whisperPath || !this.modelPath) {
      throw new Error('Whisper.cpp provider not initialized');
    }

    // Convert PCM to WAV
    const wavBuffer = this.pcmToWav(audioBuffer, 16000, 1, 16);

    // Write to temp file
    const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.wav`);
    fs.writeFileSync(tempFile, wavBuffer);

    try {
      const transcript = await this.runWhisper(tempFile);
      return transcript.trim();
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Run whisper-cpp on an audio file
   */
  private runWhisper(audioFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', this.modelPath!,
        '-f', audioFile,
        '--no-timestamps',
        '-nt',  // No timestamps in output
      ];

      const whisper = spawn(this.whisperPath!, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      whisper.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      whisper.on('close', (code) => {
        if (code === 0) {
          // Parse whisper output - it outputs transcription to stdout
          // Remove any leading/trailing whitespace and filter empty lines
          const lines = stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

          // Join all lines as the transcription
          const transcript = lines.join(' ');
          resolve(transcript);
        } else {
          reject(new Error(`Whisper failed (code ${code}): ${stderr}`));
        }
      });

      whisper.on('error', (err) => {
        reject(new Error(`Failed to run whisper: ${err.message}`));
      });
    });
  }

  async cleanup(): Promise<void> {
    this.audioBuffer = [];
  }

  /**
   * Convert PCM to WAV format
   */
  private pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = pcmData.length;

    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }
}
