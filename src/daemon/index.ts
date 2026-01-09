import { EventEmitter } from 'events';
import { VoiceConfig, VoiceState } from '../types.js';
import { HotkeyListener } from '../voice/hotkey-listener.js';
import { AudioEngine } from '../voice/audio-engine.js';
import { createSTTProvider, STTProvider } from '../voice/stt/provider.js';
import { createTTSProvider, TTSProvider } from '../voice/tts/provider.js';
import { Visualizer } from '../voice/visualizer.js';

/**
 * Voice Daemon - runs in background, injects text into active terminal
 * This allows voice mode to work within an existing Claude Code session
 */
export class VoiceDaemon extends EventEmitter {
  private config: VoiceConfig;
  private state: VoiceState = VoiceState.IDLE;
  private hotkeyListener: HotkeyListener;
  private audioEngine: AudioEngine;
  private sttProvider: STTProvider | null = null;
  private ttsProvider: TTSProvider | null = null;
  private visualizer: Visualizer;
  private isRunning = false;

  constructor(config: VoiceConfig) {
    super();
    this.config = config;
    this.hotkeyListener = new HotkeyListener();
    this.audioEngine = new AudioEngine();
    this.visualizer = new Visualizer();
    this.setupEventHandlers();
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    // Initialize STT provider
    console.log('Initializing STT provider...');
    this.sttProvider = await createSTTProvider(this.config.stt);
    console.log('STT provider ready.');

    // Initialize TTS provider
    console.log('Initializing TTS provider...');
    this.ttsProvider = await createTTSProvider(this.config.tts);
    console.log('TTS provider ready.');

    // Start listening for hotkeys
    console.log('Starting hotkey listener...');
    this.hotkeyListener.start();
    console.log('Hotkey listener started.');

    this.isRunning = true;

    console.log('\nVoice daemon started. Hold Cmd+Option to speak.');
    console.log('Press Ctrl+C to stop.');
    console.log('\nNote: Terminal needs Accessibility permissions in System Settings.\n');
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.hotkeyListener.stop();
    this.visualizer.stop();
    this.audioEngine.cleanup();
    await this.sttProvider?.cleanup();
    await this.ttsProvider?.cleanup();
  }

  /**
   * Speak text via TTS
   */
  async speak(text: string): Promise<void> {
    if (!this.ttsProvider || !text.trim()) return;

    try {
      await this.ttsProvider.speak(text);
    } catch (error) {
      console.error('TTS error:', error);
    }
  }


  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle push-to-talk start
    this.hotkeyListener.on('ptt:start', async () => {
      console.log('\n>>> PTT START detected');

      if (this.state === VoiceState.SPEAKING && this.config.interruptEnabled) {
        await this.ttsProvider?.stop();
      }

      this.state = VoiceState.LISTENING;
      this.visualizer.start();
      console.log('[Recording...]');

      // Start recording
      this.audioEngine.startRecording();
      await this.sttProvider?.startStream();
    });

    // Handle push-to-talk end
    this.hotkeyListener.on('ptt:end', async () => {
      console.log('>>> PTT END detected');

      if (this.state !== VoiceState.LISTENING) return;

      this.visualizer.stop();
      this.state = VoiceState.PROCESSING;
      console.log('[Processing...]');

      // Stop recording and get audio
      const audioBuffer = this.audioEngine.stopRecording();

      // Get transcription
      try {
        await this.sttProvider?.processAudio(audioBuffer);
        const transcript = await this.sttProvider?.stopStream();

        if (transcript && transcript.trim()) {
          console.log(`[Transcribed]: ${transcript}`);

          // Store transcription for Hammerspoon to fetch and type
          this.hotkeyListener.setTranscription(transcript);
        }
      } catch (error) {
        console.error('Transcription error:', error);
      }

      this.state = VoiceState.IDLE;
    });

    // Handle audio level updates for visualization
    this.audioEngine.on('level', (level: number) => {
      this.visualizer.updateLevel(level);
    });

    // Handle speak requests from HTTP endpoint
    this.hotkeyListener.on('speak', async (text: string) => {
      await this.speak(text);
    });
  }
}
