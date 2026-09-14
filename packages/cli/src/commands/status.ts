import type { Command } from 'commander'; import { action, change, type Execute } from '../cli/command.js';
export function registerStatus(program: Command, execute: Execute): void { change(program.command('status')).action(action(program, 'status', execute)); }
