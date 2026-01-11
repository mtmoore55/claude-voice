import { TTSConfig } from '../../types.js';

/**
 * Base interface for Text-to-Speech providers
 */
export interface TTSProvider {
  /** Provider name */
  name: string;

  /** Initialize the provider with configuration */
  initialize(config: TTSConfig): Promise<void>;

  /** Speak the given text */
  speak(text: string): Promise<void>;

  /** Stop current speech */
  stop(): Promise<void>;

  /** Register callback for speech start */
  onStart(callback: () => void): void;

  /** Register callback for speech end */
  onEnd(callback: () => void): void;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;

  /** Get available voices */
  getVoices(): Promise<Voice[]>;

  /** Cleanup resources */
  cleanup(): Promise<void>;
}

export interface Voice {
  id: string;
  name: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

/**
 * No-op TTS provider for when TTS is disabled
 */
class NoOpTTSProvider implements TTSProvider {
  name = 'disabled';
  async initialize(): Promise<void> {}
  async speak(): Promise<void> {}
  async stop(): Promise<void> {}
  onStart(): void {}
  onEnd(): void {}
  async isAvailable(): Promise<boolean> { return false; }
  async getVoices(): Promise<Voice[]> { return []; }
  async cleanup(): Promise<void> {}
}

/**
 * Factory function to create TTS provider based on config
 */
export async function createTTSProvider(config: TTSConfig): Promise<TTSProvider> {
  // Return no-op provider if TTS is disabled
  if (config.enabled === false) {
    return new NoOpTTSProvider();
  }

  switch (config.provider) {
    case 'elevenlabs': {
      const { ElevenLabsProvider } = await import('./elevenlabs.js');
      const provider = new ElevenLabsProvider();
      await provider.initialize(config);
      return provider;
    }
    default:
      throw new Error(`Unknown TTS provider: ${config.provider}`);
  }
}
