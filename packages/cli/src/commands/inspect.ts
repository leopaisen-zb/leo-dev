import type { Command } from 'commander'; import { action, change, type Execute } from '../cli/command.js';
export function registerInspect(program: Command, execute: Execute): void { change(program.command('inspect')).action(action(program, 'inspect', execute)); }
