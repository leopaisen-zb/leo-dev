import type { Command } from 'commander'; import { action, type Execute } from '../cli/command.js';
export function registerDoctor(program: Command, execute: Execute): void { program.command('doctor').option('--registry <path>').action(action(program, 'doctor', execute)); }
