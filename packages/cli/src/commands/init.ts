import type { Command } from 'commander'; import { action, writable, type Execute } from '../cli/command.js';
export function registerInit(program: Command, execute: Execute): void { writable(program.command('init').requiredOption('--change <id>').requiredOption('--spec <path>')).action(action(program, 'init', execute)); }
