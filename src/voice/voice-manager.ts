import { EventEmitter } from 'events';
import { VoiceState, VoiceConfig } from '../types.js';
import { HotkeyListener } from './hotkey-listener.js';
import { AudioEngine } from './audio-engine.js';
import { createSTTProvider, STTProvider } from './stt/provider.js';
import { createTTSProvider, TTSProvider } from './tts/provider.js';
import { Visualizer } from './visualizer.js';

/**
 * Voice Module Manager
 * Coordinates all voice features: hotkeys, audio, STT, TTS, and visualization
 */
export class VoiceManager extends EventEmitter {
  private config: VoiceConfig;
  private state: VoiceState = VoiceState.IDLE;
  private hotkeyListener: HotkeyListener;
  private audioEngine: AudioEngine;
  private sttProvider: STTProvider | null = null;
  private ttsProvider: TTSProvider | null = null;
  private visualizer: Visualizer;
  private pendingSpeech: string[] = [];
  private isProcessingTTS = false;

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

    // Initialize TTS provider
    this.ttsProvider = await createTTSProvider(this.config.tts);

    // Setup TTS callbacks
    this.ttsProvider.onStart(() => {
      this.setState(VoiceState.SPEAKING);
    });

    this.ttsProvider.onEnd(() => {
      this.processTTSQueue();
    });

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
   * Queue text for TTS
   */
  speak(text: string): void {
    if (!this.ttsProvider) return;

    // Add to queue
    this.pendingSpeech.push(text);

    // Process if not already processing
    if (!this.isProcessingTTS) {
      this.processTTSQueue();
    }
  }

  /**
   * Process TTS queue
   */
  private async processTTSQueue(): Promise<void> {
    if (!this.ttsProvider || this.pendingSpeech.length === 0) {
      this.isProcessingTTS = false;
      if (this.state === VoiceState.SPEAKING) {
        this.setState(VoiceState.IDLE);
      }
      return;
    }

    this.isProcessingTTS = true;
    const text = this.pendingSpeech.shift()!;

    try {
      await this.ttsProvider.speak(text);
    } catch (error) {
      this.emit('error', error);
    }

    // Continue processing queue
    this.processTTSQueue();
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
   * Test TTS functionality
   */
  async testTTS(): Promise<void> {
    if (!this.ttsProvider) {
      throw new Error('TTS provider not initialized');
    }

    const available = await this.ttsProvider.isAvailable();
    if (!available) {
      throw new Error('TTS provider not available - check API key');
    }

    await this.ttsProvider.speak('Voice mode is working correctly.');
  }

  /**
   * Interrupt current speech
   */
  async interrupt(): Promise<void> {
    if (this.config.interruptEnabled && this.state === VoiceState.SPEAKING) {
      this.pendingSpeech = [];
      await this.ttsProvider?.stop();
      this.setState(VoiceState.IDLE);
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
    await this.ttsProvider?.cleanup();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle push-to-talk start
    this.hotkeyListener.on('ptt:start', async () => {
      if (this.state === VoiceState.SPEAKING) {
        // Interrupt if enabled
        if (this.config.interruptEnabled) {
          await this.interrupt();
        } else {
          return;
        }
      }

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
