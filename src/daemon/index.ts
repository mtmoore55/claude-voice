import { EventEmitter } from 'events';
import { VoiceConfig, VoiceState } from '../types.js';
import { HotkeyListener } from '../voice/hotkey-listener.js';
import { AudioEngine } from '../voice/audio-engine.js';
import { createSTTProvider, STTProvider } from '../voice/stt/provider.js';
import { TTYVisualizer } from '../voice/tty-visualizer.js';

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
  private visualizer: TTYVisualizer;
  private isRunning = false;
  private ttyPath: string | null;

  constructor(config: VoiceConfig, port: number = 17394, ttyPath: string | null = null) {
    super();
    this.config = config;
    this.ttyPath = ttyPath;
    this.hotkeyListener = new HotkeyListener(port);
    this.audioEngine = new AudioEngine();
    this.visualizer = new TTYVisualizer();
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

    // Set TTY for visualizer if we have one
    if (this.ttyPath) {
      console.log(`Setting TTY for visualizer: ${this.ttyPath}`);
      this.visualizer.setTTY(this.ttyPath);
      // Show ready indicator on startup
      this.visualizer.showReady();
    }

    // Start listening for hotkeys
    console.log('Starting hotkey listener...');
    this.hotkeyListener.start();
    console.log('Hotkey listener started.');

    this.isRunning = true;

    console.log('\nVoice daemon started. Press Cmd+. to speak.');
    console.log('Press Ctrl+C to stop.');
    console.log('\nNote: Terminal needs Accessibility permissions in System Settings.\n');
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.hotkeyListener.stop();
    this.visualizer.cleanup();
    this.audioEngine.cleanup();
    await this.sttProvider?.cleanup();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle push-to-talk start
    this.hotkeyListener.on('ptt:start', async () => {
      console.log('\n>>> PTT START detected');

      // Clear any pending transcription from previous recording
      this.hotkeyListener.clearTranscription();

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
    let levelLogCount = 0;
    this.audioEngine.on('level', (level: number) => {
      if (levelLogCount < 5) {
        console.log(`[Audio Level] ${level.toFixed(4)}`);
        levelLogCount++;
      }
      this.visualizer.updateLevel(level);
    });

    // Handle TTY setting for waveform display
    this.hotkeyListener.on('tty', (ttyPath: string) => {
      console.log(`[Daemon] Setting TTY for waveform: ${ttyPath}`);
      this.visualizer.setTTY(ttyPath);
    });

    // Handle countdown events
    this.hotkeyListener.on('countdown:start', (transcription: string) => {
      this.visualizer.startCountdown(transcription, 3);
    });

    this.hotkeyListener.on('countdown:cancel', () => {
      this.visualizer.cancelCountdown();
      // Restore ready indicator after cancel
      setTimeout(() => this.visualizer.showReady(), 100);
    });

    this.hotkeyListener.on('countdown:send', () => {
      this.visualizer.showSent();
      // Restore ready indicator after "Sent!" display (showSent has 1s delay)
      setTimeout(() => this.visualizer.showReady(), 1200);
    });

    // Handle state events
    this.hotkeyListener.on('state:ready', () => {
      this.visualizer.showReady();
    });
  }
}
