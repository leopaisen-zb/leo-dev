import type { Command } from 'commander'; import { action, task, writable, type Execute } from '../cli/command.js';
export function registerSubmit(program: Command, execute: Execute): void { writable(task(program.command('submit'))).action(action(program, 'submit', execute)); }
