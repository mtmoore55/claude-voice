#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { VoiceManager } from './voice/voice-manager.js';
import { PTYWrapper } from './standalone/pty-wrapper.js';
import { VoiceDaemon } from './daemon/index.js';
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

    console.log(chalk.dim('  Press ') + chalk.bold('Cmd+.') + chalk.dim(' to talk\n'));
    console.log(chalk.dim('  STT: ') + chalk.cyan(config.stt.provider));
    console.log();

    const voiceManager = new VoiceManager(config);
    const pty = new PTYWrapper();

    voiceManager.on('stateChange', (state: VoiceState) => {
      switch (state) {
        case VoiceState.LISTENING:
          // Print newlines to make room for the 2-line waveform visualizer
          process.stdout.write('\n\n');
          break;
        case VoiceState.PROCESSING:
          process.stdout.write(chalk.yellow('  [Processing...]\n'));
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
      await pty.start();
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
  .description('Test voice input')
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

    process.exit(0);
  });

program
  .command('on')
  .description('Enable voice mode in current session (runs as background daemon)')
  .option('--port <port>', 'Port to listen on (default: derived from TTY)')
  .option('--tty <path>', 'TTY path for this session (default: auto-detect)')
  .action(async (options) => {
    console.log(chalk.cyan('\n  Starting Voice Daemon\n'));

    const config = await loadConfig();
    if (!config) {
      console.log(chalk.yellow('  Please run setup first: claude-voice setup\n'));
      process.exit(1);
    }

    // Auto-detect TTY if not provided
    let ttyPath = options.tty;
    if (!ttyPath) {
      const { execSync } = await import('child_process');

      // First try direct tty command
      try {
        const directTty = execSync('tty', { encoding: 'utf-8' }).trim();
        if (directTty && !directTty.includes('not a tty')) {
          ttyPath = directTty;
        }
      } catch {
        // Ignore
      }

      // If that fails, walk up process tree to find parent terminal's TTY
      if (!ttyPath) {
        try {
          // Walk up the process tree from this Node process until we find one with a real TTY
          const nodePid = process.pid;
          const script = `
            pid=${nodePid}
            for i in 1 2 3 4 5 6 7 8 9 10; do
              tty=$(ps -o tty= -p $pid 2>/dev/null | tr -d ' ')
              if [ -n "$tty" ] && [ "$tty" != "??" ]; then
                echo "$tty"
                exit 0
              fi
              ppid=$(ps -o ppid= -p $pid 2>/dev/null | tr -d ' ')
              if [ -z "$ppid" ] || [ "$ppid" = "1" ]; then break; fi
              pid=$ppid
            done
          `;
          const parentTty = execSync(script, { encoding: 'utf-8', shell: '/bin/bash' }).trim();

          if (parentTty && parentTty !== '??' && parentTty !== '') {
            // Normalize TTY path
            if (parentTty.startsWith('/dev/')) {
              ttyPath = parentTty;
            } else if (parentTty.match(/^ttys?\d+$/)) {
              ttyPath = '/dev/' + parentTty;
            } else if (parentTty.match(/^s\d+$/)) {
              ttyPath = '/dev/tty' + parentTty;
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    // Calculate port from TTY or use provided/default
    let port = options.port ? parseInt(options.port, 10) : 17394;
    let portFile: string | null = null;

    if (ttyPath) {
      // Extract TTY name (e.g., /dev/ttys002 -> ttys002)
      const ttyName = ttyPath.replace('/dev/', '');

      // If no explicit port, derive from TTY name
      if (!options.port) {
        // Hash TTY name to get a port in range 17400-17499
        let hash = 0;
        for (let i = 0; i < ttyName.length; i++) {
          hash = ((hash << 5) - hash) + ttyName.charCodeAt(i);
          hash = hash & hash;
        }
        port = 17400 + (Math.abs(hash) % 100);
      }

      // Write port file for Hammerspoon discovery
      const fs = await import('fs');
      portFile = `/tmp/claude-voice-${ttyName}.port`;
      fs.writeFileSync(portFile, port.toString());
      console.log(`Port file: ${portFile}`);
    }

    console.log(`TTY: ${ttyPath || 'unknown'}`);
    console.log(`Port: ${port}`);

    const daemon = new VoiceDaemon(config, port, ttyPath);

    // Handle shutdown - clean up port file
    const cleanup = async () => {
      console.log('\n  Stopping voice daemon...');
      if (portFile) {
        const fs = await import('fs');
        try { fs.unlinkSync(portFile); } catch {}
      }
      await daemon.stop();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
      await daemon.start();
      // Keep process running
    } catch (error) {
      console.error(chalk.red('Failed to start voice daemon:'), error);
      if (portFile) {
        const fs = await import('fs');
        try { fs.unlinkSync(portFile); } catch {}
      }
      process.exit(1);
    }
  });

program.parse();
