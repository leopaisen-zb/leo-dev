import type { Command } from 'commander'; import { action, task, writable, type Execute } from '../cli/command.js';
export function registerRunGates(program: Command, execute: Execute): void { writable(task(program.command('run-gates')).option('--run <run-id>').option('--max-output-bytes <bytes>').option('--approval-receipt <path>')).action(action(program, 'run-gates', execute)); }
