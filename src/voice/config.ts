import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';
import { VoiceConfig } from '../types.js';

const CONFIG_DIR = join(homedir(), '.claude');
const CONFIG_FILE = join(CONFIG_DIR, 'voice.json');

/**
 * Load voice configuration from disk
 */
export async function loadConfig(): Promise<VoiceConfig | null> {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return null;
    }
    const data = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as VoiceConfig;
  } catch {
    return null;
  }
}

/**
 * Save voice configuration to disk
 */
export async function saveConfig(config: VoiceConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Run the setup wizard
 */
export async function runSetupWizard(): Promise<VoiceConfig> {
  console.log(chalk.cyan.bold('\n  Voice Mode Setup\n'));
  console.log(chalk.dim('  Using whisper-cpp for local speech-to-text (no API key needed)\n'));
  console.log(chalk.dim('  The model will download on first use (~142MB)\n'));

  const config: VoiceConfig = {
    enabled: true,
    stt: {
      provider: 'whisper-cpp',
    },
    hotkey: 'cmd-.',
    showTranscription: true,
  };

  // Save config
  await saveConfig(config);

  console.log(chalk.green('  Configuration saved!\n'));
  console.log(chalk.dim('  Press ') + chalk.white('Cmd+.') + chalk.dim(' to start recording, press again to send.\n'));

  return config;
}

/**
 * Reset configuration
 */
export async function resetConfig(): Promise<void> {
  try {
    if (existsSync(CONFIG_FILE)) {
      const { unlink } = await import('fs/promises');
      await unlink(CONFIG_FILE);
    }
  } catch {
    // Ignore errors
  }
}
