/**
 * Voice Mode State Machine States
 */
export enum VoiceState {
  IDLE = 'idle',
  TYPING = 'typing',
  LISTENING = 'listening',
  PROCESSING = 'processing',
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
  INTERRUPT = 'interrupt',
  ERROR = 'error',
}

/**
 * STT Provider configuration
 */
export interface STTConfig {
  provider: 'whisper-cpp';
  language?: string;
  /** Path to whisper.cpp model file */
  modelPath?: string;
}

/**
 * Voice mode configuration
 */
export interface VoiceConfig {
  enabled: boolean;
  stt: STTConfig;
  hotkey: string;
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
}
