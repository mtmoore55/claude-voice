import { EventEmitter } from 'events';
import { uIOhook, UiohookKey } from 'uiohook-napi';

export interface HotkeyListenerEvents {
  'ptt:start': () => void;
  'ptt:end': () => void;
}

/**
 * Global hotkey listener for push-to-talk
 * Detects Cmd+Option being held and released
 */
export class HotkeyListener extends EventEmitter {
  private isListening = false;
  private metaPressed = false;
  private altPressed = false;
  private pttActive = false;

  constructor() {
    super();
  }

  /**
   * Start listening for hotkeys
   */
  start(): void {
    if (this.isListening) return;

    uIOhook.on('keydown', (event) => {
      this.handleKeyDown(event.keycode);
    });

    uIOhook.on('keyup', (event) => {
      this.handleKeyUp(event.keycode);
    });

    uIOhook.start();
    this.isListening = true;
  }

  /**
   * Stop listening for hotkeys
   */
  stop(): void {
    if (!this.isListening) return;

    uIOhook.stop();
    this.isListening = false;
    this.resetState();
  }

  /**
   * Check if PTT is currently active
   */
  isPTTActive(): boolean {
    return this.pttActive;
  }

  private handleKeyDown(keycode: number): void {
    // Check for Meta (Cmd) key
    if (keycode === UiohookKey.Meta || keycode === UiohookKey.MetaRight) {
      this.metaPressed = true;
    }

    // Check for Alt (Option) key
    if (keycode === UiohookKey.Alt || keycode === UiohookKey.AltRight) {
      this.altPressed = true;
    }

    // If both Cmd and Option are held, start PTT
    if (this.metaPressed && this.altPressed && !this.pttActive) {
      this.pttActive = true;
      this.emit('ptt:start');
    }
  }

  private handleKeyUp(keycode: number): void {
    // Check for Meta (Cmd) key release
    if (keycode === UiohookKey.Meta || keycode === UiohookKey.MetaRight) {
      this.metaPressed = false;
    }

    // Check for Alt (Option) key release
    if (keycode === UiohookKey.Alt || keycode === UiohookKey.AltRight) {
      this.altPressed = false;
    }

    // If either key is released and PTT was active, end PTT
    if (this.pttActive && (!this.metaPressed || !this.altPressed)) {
      this.pttActive = false;
      this.emit('ptt:end');
    }
  }

  private resetState(): void {
    this.metaPressed = false;
    this.altPressed = false;
    this.pttActive = false;
  }
}
