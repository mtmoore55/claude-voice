import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import Speaker from 'speaker';
import { Readable } from 'stream';

export interface AudioEngineEvents {
  'level': (level: number) => void;
  'data': (buffer: Buffer) => void;
  'error': (error: Error) => void;
}

/**
 * Audio Engine - handles microphone capture and speaker playback
 * Uses native macOS tools for audio capture
 */
export class AudioEngine extends EventEmitter {
  private recordingProcess: ChildProcess | null = null;
  private audioBuffer: Buffer[] = [];
  private isRecording = false;
  private speaker: Speaker | null = null;

  constructor() {
    super();
  }

  /**
   * Start recording from microphone
   * Uses sox/rec on macOS for high-quality audio capture
   */
  startRecording(): void {
    if (this.isRecording) return;

    this.audioBuffer = [];
    this.isRecording = true;

    // Use rec (from sox) for recording - available via brew install sox
    // Format: 16-bit PCM, 16kHz, mono (optimal for speech recognition)
    this.recordingProcess = spawn('rec', [
      '-q',           // Quiet mode
      '-t', 'raw',    // Raw PCM output
      '-b', '16',     // 16-bit
      '-r', '16000',  // 16kHz sample rate
      '-c', '1',      // Mono
      '-e', 'signed', // Signed integer encoding
      '-',            // Output to stdout
    ], {
      stdio: ['ignore', 'pipe', 'ignore']
    });

    this.recordingProcess.stdout?.on('data', (chunk: Buffer) => {
      this.audioBuffer.push(chunk);
      this.emit('data', chunk);

      // Calculate audio level for visualization
      const level = this.calculateLevel(chunk);
      this.emit('level', level);
    });

    this.recordingProcess.on('error', (error) => {
      this.emit('error', new Error(`Recording failed: ${error.message}. Make sure sox is installed (brew install sox)`));
      this.isRecording = false;
    });

    this.recordingProcess.on('exit', () => {
      this.isRecording = false;
    });
  }

  /**
   * Stop recording and return captured audio
   */
  stopRecording(): Buffer {
    if (this.recordingProcess) {
      this.recordingProcess.kill('SIGTERM');
      this.recordingProcess = null;
    }
    this.isRecording = false;

    // Concatenate all audio buffers
    return Buffer.concat(this.audioBuffer);
  }

  /**
   * Get audio as WAV file buffer (with header)
   */
  getWavBuffer(): Buffer {
    const pcmData = Buffer.concat(this.audioBuffer);
    return this.pcmToWav(pcmData, 16000, 1, 16);
  }

  /**
   * Play audio through speakers
   */
  playAudio(audioData: Buffer | Readable, format: 'mp3' | 'pcm' = 'mp3'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (format === 'mp3') {
          // Decode MP3 using ffmpeg/afplay on macOS
          const player = spawn('afplay', ['-'], {
            stdio: ['pipe', 'ignore', 'ignore']
          });

          if (Buffer.isBuffer(audioData)) {
            player.stdin?.write(audioData);
            player.stdin?.end();
          } else {
            audioData.pipe(player.stdin!);
          }

          player.on('exit', () => resolve());
          player.on('error', reject);
        } else {
          // Play raw PCM through speaker module
          this.speaker = new Speaker({
            channels: 1,
            bitDepth: 16,
            sampleRate: 16000,
          });

          this.speaker.on('close', () => {
            this.speaker = null;
            resolve();
          });

          this.speaker.on('error', reject);

          if (Buffer.isBuffer(audioData)) {
            this.speaker.write(audioData);
            this.speaker.end();
          } else {
            audioData.pipe(this.speaker);
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop any currently playing audio
   */
  stopPlayback(): void {
    if (this.speaker) {
      this.speaker.end();
      this.speaker = null;
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Calculate audio level (0-1) from PCM buffer
   */
  private calculateLevel(buffer: Buffer): number {
    let sum = 0;
    const samples = buffer.length / 2; // 16-bit samples

    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / samples);
    const normalized = Math.min(1, rms / 32768);

    return normalized;
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
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // AudioFormat (PCM)
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

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.recordingProcess) {
      this.recordingProcess.kill();
      this.recordingProcess = null;
    }
    this.stopPlayback();
  }
}
