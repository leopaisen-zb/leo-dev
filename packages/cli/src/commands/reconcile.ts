import type { Command } from 'commander'; import { action, receipt, writable, type Execute } from '../cli/command.js';
export function registerReconcile(program: Command, execute: Execute): void { writable(receipt(program.command('reconcile'))).action(action(program, 'reconcile', execute)); }
