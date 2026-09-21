import type { Command } from 'commander';
import { action, change, writable, type Execute } from '../cli/command.js';
export function registerCommit(program: Command, execute: Execute): void {
  writable(change(program.command('commit').requiredOption('--message <text>', 'local commit message'))).action(action(program, 'commit', execute));
}
