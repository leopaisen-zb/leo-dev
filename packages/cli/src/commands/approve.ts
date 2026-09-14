import type { Command } from 'commander'; import { action, receipt, writable, type Execute } from '../cli/command.js';
export function registerApprove(program: Command, execute: Execute): void { writable(receipt(program.command('approve'))).action(action(program, 'approve', execute)); }
