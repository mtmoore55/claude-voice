import { STTConfig } from '../../types.js';
import { STTProvider } from './provider.js';

/**
 * Deepgram API provider for Speech-to-Text
 */
export class DeepgramProvider implements STTProvider {
  name = 'deepgram';
  private apiKey: string | null = null;
  private audioBuffer: Buffer[] = [];
  private partialCallback: ((text: string) => void) | null = null;

  async initialize(config: STTConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Deepgram API key is required');
    }
    this.apiKey = config.apiKey;
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
    this.partialCallback = callback;
  }

  /**
   * Emit partial transcript if callback is registered
   */
  protected emitPartial(text: string): void {
    this.partialCallback?.(text);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      // Quick API check - get projects
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Deepgram provider not initialized');
    }

    // Convert PCM to WAV for Deepgram
    const wavBuffer = this.pcmToWav(audioBuffer, 16000, 1, 16);

    try {
      const response = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'audio/wav',
          },
          body: wavBuffer,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Deepgram API error: ${response.status} - ${error}`);
      }

      const result = await response.json() as DeepgramResponse;

      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      return transcript;
    } catch (error) {
      throw new Error(`Transcription failed: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    this.apiKey = null;
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

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
      }>;
    }>;
  };
}
