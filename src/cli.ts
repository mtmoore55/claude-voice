#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { VoiceManager } from './voice/voice-manager.js';
import { PTYWrapper } from './standalone/pty-wrapper.js';
import { loadConfig, runSetupWizard } from './voice/config.js';
import { VoiceState } from './types.js';

const program = new Command();

program
  .name('claude-voice')
  .description('Voice mode for Claude Code - talk to Claude with push-to-talk')
  .version('0.1.0');

program
  .command('start', { isDefault: true })
  .description('Start Claude Code with voice mode enabled')
  .option('--no-voice', 'Start without voice mode (passthrough to claude)')
  .action(async (options) => {
    console.log(chalk.cyan.bold('\n  Claude Voice Mode\n'));

    if (!options.voice) {
      console.log(chalk.dim('  Voice mode disabled, starting claude normally...\n'));
      const pty = new PTYWrapper();
      await pty.start();
      return;
    }

    const config = await loadConfig();

    if (!config) {
      console.log(chalk.yellow('  Voice mode not configured. Running setup...\n'));
      await runSetupWizard();
      return;
    }

    console.log(chalk.dim('  Hold ') + chalk.bold('Cmd+Option') + chalk.dim(' to talk\n'));
    console.log(chalk.dim('  Voice: ') + chalk.cyan(config.tts.provider));
    console.log(chalk.dim('  STT: ') + chalk.cyan(config.stt.provider));
    console.log();

    const voiceManager = new VoiceManager(config);
    const pty = new PTYWrapper();

    voiceManager.on('stateChange', (state: VoiceState) => {
      switch (state) {
        case VoiceState.LISTENING:
          process.stdout.write(chalk.green('\n  [Listening...] '));
          break;
        case VoiceState.PROCESSING:
          process.stdout.write(chalk.yellow('\n  [Processing...]\n'));
          break;
        case VoiceState.SPEAKING:
          process.stdout.write(chalk.blue('\n  [Speaking...]\n'));
          break;
      }
    });

    voiceManager.on('transcription', (text: string, partial: boolean) => {
      if (partial) {
        process.stdout.write(`\r  ${chalk.dim(text)}`);
      } else {
        console.log(`\n  ${chalk.white(text)}\n`);
        pty.sendInput(text + '\n');
      }
    });

    voiceManager.on('error', (error: Error) => {
      console.error(chalk.red(`\n  Error: ${error.message}\n`));
    });

    try {
      await voiceManager.initialize();
      await pty.start({
        onOutput: (data: string) => {
          if (config.tts.provider && voiceManager.getState() !== VoiceState.LISTENING) {
            voiceManager.speak(data);
          }
        }
      });
    } catch (error) {
      console.error(chalk.red('Failed to initialize voice mode:'), error);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Configure voice mode settings')
  .action(async () => {
    await runSetupWizard();
  });

program
  .command('test')
  .description('Test voice input and output')
  .action(async () => {
    console.log(chalk.cyan('\n  Voice Test Mode\n'));

    const config = await loadConfig();
    if (!config) {
      console.log(chalk.yellow('  Please run setup first: claude-voice setup\n'));
      process.exit(1);
    }

    const voiceManager = new VoiceManager(config);

    console.log(chalk.dim('  Testing STT...'));
    try {
      await voiceManager.testSTT();
      console.log(chalk.green('  STT: OK\n'));
    } catch (error) {
      console.log(chalk.red(`  STT: Failed - ${error}\n`));
    }

    console.log(chalk.dim('  Testing TTS...'));
    try {
      await voiceManager.testTTS();
      console.log(chalk.green('  TTS: OK\n'));
    } catch (error) {
      console.log(chalk.red(`  TTS: Failed - ${error}\n`));
    }

    process.exit(0);
  });

program.parse();
