import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { VoiceConfig, STTConfig } from '../types.js';

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
 * Create readline interface for prompts
 */
function createPrompt(): { question: (q: string) => Promise<string>; close: () => void } {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    question: (q: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(q, (answer) => {
          resolve(answer);
        });
      });
    },
    close: () => rl.close(),
  };
}

/**
 * Run the setup wizard
 */
export async function runSetupWizard(): Promise<VoiceConfig> {
  const prompt = createPrompt();

  console.log(chalk.cyan.bold('\n  Voice Mode Setup\n'));
  console.log(chalk.dim('  Configure voice input for Claude Code.\n'));

  // STT Provider Selection
  console.log(chalk.white('  Speech-to-Text Provider:\n'));
  console.log(chalk.green('  1. Whisper.cpp (Local) - No API key, runs locally, recommended'));
  console.log(chalk.dim('  2. Deepgram - Fast streaming, real-time (requires API key)'));
  console.log(chalk.dim('  3. Whisper API (OpenAI) - Cloud-based (requires API key)'));
  console.log();

  let sttChoice = '';
  while (!['1', '2', '3'].includes(sttChoice)) {
    sttChoice = await prompt.question(chalk.white('  Select STT provider (1-3) [default: 1]: ')) || '1';
  }

  const sttProviders: Record<string, STTConfig['provider']> = {
    '1': 'whisper-cpp',
    '2': 'deepgram',
    '3': 'whisper-api',
  };

  const sttConfig: STTConfig = {
    provider: sttProviders[sttChoice],
  };

  // Get API key for cloud providers
  if (sttConfig.provider === 'whisper-api') {
    console.log();
    const apiKey = await prompt.question(chalk.white('  Enter OpenAI API key: '));
    sttConfig.apiKey = apiKey.trim();
  } else if (sttConfig.provider === 'deepgram') {
    console.log();
    const apiKey = await prompt.question(chalk.white('  Enter Deepgram API key: '));
    sttConfig.apiKey = apiKey.trim();
  } else if (sttConfig.provider === 'whisper-cpp') {
    console.log(chalk.dim('\n  Whisper.cpp will download the model on first use (~142MB)'));
  }

  const config: VoiceConfig = {
    enabled: true,
    stt: sttConfig,
    hotkey: 'cmd-.',
    showTranscription: true,
  };

  // Save config
  await saveConfig(config);

  console.log(chalk.green('\n  Configuration saved!\n'));
  console.log(chalk.dim('  Press ') + chalk.white('Cmd+.') + chalk.dim(' to start recording, press again to send.\n'));

  prompt.close();

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
