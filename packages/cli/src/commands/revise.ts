import type { Command } from 'commander';
import { action, change, writable, type Execute } from '../cli/command.js';
export function registerRevise(program: Command, execute: Execute): void {
  writable(change(program.command('revise')))
    .requiredOption('--spec <path>').requiredOption('--plan <path>')
    .option('--constitution <path>').option('--registry <path>').option('--assessment <path>').option('--receipt <path>')
    .action(action(program, 'revise', execute));
}
