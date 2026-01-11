/**
 * Claude Voice - Voice mode for Claude Code
 *
 * This module provides voice input capabilities for the Claude Code CLI.
 *
 * @example
 * ```typescript
 * import { VoiceManager, loadConfig } from 'claude-voice';
 *
 * const config = await loadConfig();
 * const voiceManager = new VoiceManager(config);
 * await voiceManager.initialize();
 * ```
 */

// Re-export types
export {
  VoiceState,
  VoiceEvent,
  VoiceConfig,
  STTConfig,
  AudioLevelCallback,
  HotkeyEvent,
  VoiceManagerEvents,
} from './types.js';

// Re-export voice module
export * from './voice/index.js';

// Re-export standalone module
export { PTYWrapper } from './standalone/pty-wrapper.js';
