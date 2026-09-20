import type { Command } from 'commander';
import { action, change, writable, type Execute } from '../cli/command.js';
export function registerStart(program: Command, execute: Execute): void {
  writable(change(program.command('start').requiredOption('--goal <text>', 'aligned goal authorized by the user'))).action(action(program, 'start', execute));
}
