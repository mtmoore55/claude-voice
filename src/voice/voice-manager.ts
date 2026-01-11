import { EventEmitter } from 'events';
import { VoiceState, VoiceConfig } from '../types.js';
import { HotkeyListener } from './hotkey-listener.js';
import { AudioEngine } from './audio-engine.js';
import { createSTTProvider, STTProvider } from './stt/provider.js';
import { Visualizer } from './visualizer.js';

/**
 * Voice Module Manager
 * Coordinates all voice features: hotkeys, audio, STT, and visualization
 */
export class VoiceManager extends EventEmitter {
  private config: VoiceConfig;
  private state: VoiceState = VoiceState.IDLE;
  private hotkeyListener: HotkeyListener;
  private audioEngine: AudioEngine;
  private sttProvider: STTProvider | null = null;
  private visualizer: Visualizer;

  constructor(config: VoiceConfig) {
    super();
    this.config = config;
    this.hotkeyListener = new HotkeyListener();
    this.audioEngine = new AudioEngine();
    this.visualizer = new Visualizer();

    this.setupEventHandlers();
  }

  /**
   * Initialize all voice components
   */
  async initialize(): Promise<void> {
    // Initialize STT provider
    this.sttProvider = await createSTTProvider(this.config.stt);

    // Start listening for hotkeys
    this.hotkeyListener.start();

    console.log('  Voice mode initialized\n');
  }

  /**
   * Get current state
   */
  getState(): VoiceState {
    return this.state;
  }

  /**
   * Test STT functionality
   */
  async testSTT(): Promise<void> {
    if (!this.sttProvider) {
      throw new Error('STT provider not initialized');
    }

    const available = await this.sttProvider.isAvailable();
    if (!available) {
      throw new Error('STT provider not available - check API key');
    }
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    this.hotkeyListener.stop();
    this.visualizer.stop();
    this.audioEngine.cleanup();
    await this.sttProvider?.cleanup();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle push-to-talk start
    this.hotkeyListener.on('ptt:start', async () => {
      this.setState(VoiceState.LISTENING);
      this.visualizer.start();

      // Start recording
      this.audioEngine.startRecording();
      await this.sttProvider?.startStream();
    });

    // Handle push-to-talk end
    this.hotkeyListener.on('ptt:end', async () => {
      if (this.state !== VoiceState.LISTENING) return;

      this.visualizer.stop();
      this.setState(VoiceState.PROCESSING);

      // Stop recording and get audio
      const audioBuffer = this.audioEngine.stopRecording();

      // Get transcription
      try {
        await this.sttProvider?.processAudio(audioBuffer);
        const transcript = await this.sttProvider?.stopStream();

        if (transcript && transcript.trim()) {
          // Store for Hammerspoon to fetch
          this.hotkeyListener.setTranscription(transcript);
          this.emit('transcription', transcript, false);
        } else {
          this.setState(VoiceState.IDLE);
        }
      } catch (error) {
        this.emit('error', error);
        this.setState(VoiceState.IDLE);
      }
    });

    // Handle audio level updates for visualization
    this.audioEngine.on('level', (level: number) => {
      this.visualizer.updateLevel(level);
      this.emit('audioLevel', level);
    });

    // Handle audio engine errors
    this.audioEngine.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Set state and emit event
   */
  private setState(state: VoiceState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChange', state);
    }
  }
}
