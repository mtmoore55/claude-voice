import OpenAI from 'openai';
import { STTConfig } from '../../types.js';
import { STTProvider } from './provider.js';

/**
 * OpenAI Whisper API provider for Speech-to-Text
 */
export class WhisperAPIProvider implements STTProvider {
  name = 'whisper-api';
  private client: OpenAI | null = null;
  private config: STTConfig | null = null;
  private audioBuffer: Buffer[] = [];
  private _partialCallback: ((text: string) => void) | null = null;

  async initialize(config: STTConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required for Whisper API');
    }

    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
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

  onPartialTranscript(callback: (text: string) => void): void {
    this._partialCallback = callback;
  }

  /**
   * Emit partial transcript if callback is registered
   */
  protected emitPartial(text: string): void {
    this._partialCallback?.(text);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;

    try {
      // Quick API check - list models
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    if (!this.client) {
      throw new Error('Whisper provider not initialized');
    }

    // Create WAV file from PCM buffer
    const wavBuffer = this.pcmToWav(audioBuffer, 16000, 1, 16);

    // Create a File-like object from the buffer
    const audioFile = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' });

    try {
      const transcription = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: this.config?.model || 'whisper-1',
        language: this.config?.language || 'en',
        response_format: 'text',
      });

      return transcription as unknown as string;
    } catch (error) {
      throw new Error(`Transcription failed: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    this.client = null;
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
