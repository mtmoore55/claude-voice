/**
 * Voice Mode State Machine States
 */
export enum VoiceState {
  IDLE = 'idle',
  TYPING = 'typing',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
}

/**
 * Voice mode events
 */
export enum VoiceEvent {
  PTT_START = 'ptt:start',
  PTT_END = 'ptt:end',
  TEXT_INPUT = 'text:input',
  TRANSCRIPTION_COMPLETE = 'transcription:complete',
  RESPONSE_START = 'response:start',
  RESPONSE_END = 'response:end',
  SPEECH_COMPLETE = 'speech:complete',
  INTERRUPT = 'interrupt',
  ERROR = 'error',
}

/**
 * STT Provider configuration
 */
export interface STTConfig {
  provider: 'whisper-api' | 'whisper-local' | 'apple-speech' | 'deepgram';
  apiKey?: string;
  model?: string;
  language?: string;
}

/**
 * TTS Provider configuration
 */
export interface TTSConfig {
  provider: 'elevenlabs';
  apiKey: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

/**
 * Voice mode configuration
 */
export interface VoiceConfig {
  enabled: boolean;
  stt: STTConfig;
  tts: TTSConfig;
  hotkey: string;
  interruptEnabled: boolean;
  showTranscription: boolean;
}

/**
 * STT Provider interface
 */
export interface STTProvider {
  name: string;
  initialize(config: STTConfig): Promise<void>;
  startStream(): Promise<void>;
  stopStream(): Promise<string>;
  onPartialTranscript?(callback: (text: string) => void): void;
  isAvailable(): Promise<boolean>;
  cleanup(): Promise<void>;
}

/**
 * TTS Provider interface
 */
export interface TTSProvider {
  name: string;
  initialize(config: TTSConfig): Promise<void>;
  speak(text: string): Promise<void>;
  stop(): Promise<void>;
  onStart?(callback: () => void): void;
  onEnd?(callback: () => void): void;
  isAvailable(): Promise<boolean>;
  cleanup(): Promise<void>;
}

/**
 * Audio level callback for visualization
 */
export type AudioLevelCallback = (level: number) => void;

/**
 * Hotkey event
 */
export interface HotkeyEvent {
  type: 'keydown' | 'keyup';
  key: string;
  modifiers: {
    meta: boolean;
    alt: boolean;
    ctrl: boolean;
    shift: boolean;
  };
}

/**
 * Voice manager events
 */
export interface VoiceManagerEvents {
  stateChange: (state: VoiceState) => void;
  transcription: (text: string, partial: boolean) => void;
  audioLevel: (level: number) => void;
  error: (error: Error) => void;
  speaking: (text: string) => void;
}
