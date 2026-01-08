import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { TTSConfig } from '../../types.js';
import { TTSProvider, Voice } from './provider.js';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_WS = 'wss://api.elevenlabs.io/v1/text-to-speech';

/**
 * ElevenLabs TTS Provider
 * Uses WebSocket streaming for low-latency audio generation
 */
export class ElevenLabsProvider implements TTSProvider {
  name = 'elevenlabs';
  private config: TTSConfig | null = null;
  private ws: WebSocket | null = null;
  private player: ChildProcess | null = null;
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private isSpeaking = false;

  async initialize(config: TTSConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
    if (!config.voiceId) {
      throw new Error('ElevenLabs voice ID is required');
    }
    this.config = config;
  }

  async speak(text: string): Promise<void> {
    if (!this.config) {
      throw new Error('ElevenLabs provider not initialized');
    }

    // Clean text for TTS (remove markdown, code blocks, etc.)
    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText.trim()) return;

    return new Promise((resolve, reject) => {
      const modelId = this.config!.modelId || 'eleven_turbo_v2';
      const voiceId = this.config!.voiceId;

      const wsUrl = `${ELEVENLABS_WS}/${voiceId}/stream-input?model_id=${modelId}`;

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'xi-api-key': this.config!.apiKey,
        },
      });

      let audioChunks: Buffer[] = [];

      this.ws.on('open', () => {
        this.isSpeaking = true;
        this.onStartCallback?.();

        // Send initial configuration
        this.ws!.send(JSON.stringify({
          text: ' ',
          voice_settings: {
            stability: this.config!.stability ?? 0.5,
            similarity_boost: this.config!.similarityBoost ?? 0.75,
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290],
          },
        }));

        // Send the actual text
        this.ws!.send(JSON.stringify({
          text: cleanText,
          try_trigger_generation: true,
        }));

        // Signal end of input
        this.ws!.send(JSON.stringify({
          text: '',
        }));
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.audio) {
            // Decode base64 audio chunk
            const audioBuffer = Buffer.from(message.audio, 'base64');
            audioChunks.push(audioBuffer);
          }

          if (message.isFinal) {
            // All audio received, play it
            this.playAudio(Buffer.concat(audioChunks))
              .then(() => {
                this.isSpeaking = false;
                this.onEndCallback?.();
                resolve();
              })
              .catch(reject);
          }
        } catch (error) {
          // Non-JSON message, ignore
        }
      });

      this.ws.on('error', (error) => {
        this.isSpeaking = false;
        reject(new Error(`ElevenLabs WebSocket error: ${error.message}`));
      });

      this.ws.on('close', () => {
        this.ws = null;
      });
    });
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.player) {
      this.player.kill();
      this.player = null;
    }
    this.isSpeaking = false;
  }

  onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  /**
   * Check if currently speaking
   */
  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config?.apiKey) return false;

    try {
      const response = await fetch(`${ELEVENLABS_API}/voices`, {
        headers: {
          'xi-api-key': this.config.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getVoices(): Promise<Voice[]> {
    if (!this.config?.apiKey) {
      throw new Error('ElevenLabs API key required');
    }

    const response = await fetch(`${ELEVENLABS_API}/voices`, {
      headers: {
        'xi-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.statusText}`);
    }

    const data = await response.json() as { voices: Voice[] };
    return data.voices.map(v => ({
      id: v.id,
      name: v.name,
      preview_url: v.preview_url,
      labels: v.labels,
    }));
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.config = null;
  }

  /**
   * Play audio using system player
   */
  private playAudio(audioBuffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use afplay on macOS for MP3 playback
      this.player = spawn('afplay', ['-'], {
        stdio: ['pipe', 'ignore', 'ignore'],
      });

      this.player.stdin?.write(audioBuffer);
      this.player.stdin?.end();

      this.player.on('exit', () => {
        this.player = null;
        resolve();
      });

      this.player.on('error', (error) => {
        this.player = null;
        reject(error);
      });
    });
  }

  /**
   * Clean text for speech synthesis
   * Removes markdown, code blocks, and other non-speech elements
   */
  private cleanTextForSpeech(text: string): string {
    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove markdown headers
      .replace(/^#+\s+/gm, '')
      // Remove markdown bold/italic
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}
