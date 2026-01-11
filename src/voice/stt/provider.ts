import { STTConfig } from '../../types.js';

/**
 * Base interface for Speech-to-Text providers
 */
export interface STTProvider {
  /** Provider name */
  name: string;

  /** Initialize the provider with configuration */
  initialize(config: STTConfig): Promise<void>;

  /** Start streaming audio for transcription */
  startStream(): Promise<void>;

  /** Process audio data chunk */
  processAudio(audioData: Buffer): Promise<void>;

  /** Stop streaming and get final transcript */
  stopStream(): Promise<string>;

  /** Register callback for partial transcripts */
  onPartialTranscript(callback: (text: string) => void): void;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;

  /** Transcribe a complete audio buffer */
  transcribe(audioBuffer: Buffer): Promise<string>;

  /** Cleanup resources */
  cleanup(): Promise<void>;
}

/**
 * Factory function to create STT provider based on config
 */
export async function createSTTProvider(config: STTConfig): Promise<STTProvider> {
  // Only whisper-cpp is supported (local, no API key needed)
  const { WhisperCppProvider } = await import('./whisper-cpp.js');
  const provider = new WhisperCppProvider();
  await provider.initialize(config);
  return provider;
}
