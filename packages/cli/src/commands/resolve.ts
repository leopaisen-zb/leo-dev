import type { Command } from 'commander'; import { action, receipt, writable, type Execute } from '../cli/command.js';
export function registerResolve(program: Command, execute: Execute): void { writable(receipt(program.command('resolve'))).action(action(program, 'resolve', execute)); }
