import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { VoiceConfig, STTConfig, TTSConfig } from '../types.js';
import { createTTSProvider } from './tts/provider.js';

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
  console.log(chalk.dim('  Configure your voice input and output preferences.\n'));

  // STT Provider Selection
  console.log(chalk.white('  Speech-to-Text Provider:\n'));
  console.log(chalk.dim('  1. Whisper API (OpenAI) - High accuracy, cloud-based'));
  console.log(chalk.dim('  2. Local Whisper - Privacy-focused, runs locally'));
  console.log(chalk.dim('  3. Apple Speech - macOS native, free'));
  console.log(chalk.dim('  4. Deepgram - Fast streaming, real-time'));
  console.log();

  let sttChoice = '';
  while (!['1', '2', '3', '4'].includes(sttChoice)) {
    sttChoice = await prompt.question(chalk.white('  Select STT provider (1-4): '));
  }

  const sttProviders: Record<string, STTConfig['provider']> = {
    '1': 'whisper-api',
    '2': 'whisper-local',
    '3': 'apple-speech',
    '4': 'deepgram',
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
  }

  // TTS Configuration
  console.log(chalk.white('\n  Text-to-Speech (ElevenLabs)\n'));

  const elevenLabsKey = await prompt.question(chalk.white('  Enter ElevenLabs API key: '));

  const ttsConfig: TTSConfig = {
    provider: 'elevenlabs',
    apiKey: elevenLabsKey.trim(),
    voiceId: '',
  };

  // Fetch and display voices
  console.log(chalk.dim('\n  Fetching available voices...'));

  try {
    const provider = await createTTSProvider(ttsConfig);
    const voices = await provider.getVoices();

    console.log(chalk.white('\n  Available Voices:\n'));
    voices.slice(0, 10).forEach((voice, i) => {
      const labels = voice.labels ? ` (${Object.values(voice.labels).join(', ')})` : '';
      console.log(chalk.dim(`  ${i + 1}. ${voice.name}${labels}`));
    });
    console.log();

    let voiceChoice = '';
    while (!voiceChoice || isNaN(parseInt(voiceChoice)) || parseInt(voiceChoice) < 1 || parseInt(voiceChoice) > Math.min(10, voices.length)) {
      voiceChoice = await prompt.question(chalk.white(`  Select voice (1-${Math.min(10, voices.length)}): `));
    }

    ttsConfig.voiceId = voices[parseInt(voiceChoice) - 1].id;

    await provider.cleanup();
  } catch (error) {
    console.log(chalk.yellow(`\n  Could not fetch voices: ${error}`));
    const voiceId = await prompt.question(chalk.white('  Enter voice ID manually: '));
    ttsConfig.voiceId = voiceId.trim();
  }

  // Additional settings
  console.log(chalk.white('\n  Additional Settings\n'));

  const interruptChoice = await prompt.question(chalk.white('  Enable interrupt (barge-in)? (y/n): '));

  const config: VoiceConfig = {
    enabled: true,
    stt: sttConfig,
    tts: ttsConfig,
    hotkey: 'right-option',
    interruptEnabled: interruptChoice.toLowerCase() === 'y',
    showTranscription: true,
  };

  // Save config
  await saveConfig(config);

  console.log(chalk.green('\n  Configuration saved!\n'));
  console.log(chalk.dim('  Run ') + chalk.white('claude-voice') + chalk.dim(' to start with voice mode.\n'));

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
