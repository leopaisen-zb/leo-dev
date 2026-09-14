import type { Command } from 'commander'; import { action, receipt, writable, type Execute } from '../cli/command.js';
export function registerWaive(program: Command, execute: Execute): void { writable(receipt(program.command('waive'))).action(action(program, 'waive', execute)); }
