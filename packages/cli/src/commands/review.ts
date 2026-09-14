import type { Command } from 'commander'; import { action, receipt, writable, type Execute } from '../cli/command.js';
export function registerReview(program: Command, execute: Execute): void { writable(receipt(program.command('review')).requiredOption('--task <id>')).action(action(program, 'review', execute)); }
