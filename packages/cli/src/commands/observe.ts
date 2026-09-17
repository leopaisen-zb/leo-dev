import type { Command } from 'commander';
import { action, change, type Execute } from '../cli/command.js';

export function registerObserve(program: Command, execute: Execute): void {
  change(program.command('observe')).action(action(program, 'observe', execute));
}
