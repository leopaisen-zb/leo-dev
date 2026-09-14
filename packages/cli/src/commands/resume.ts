import type { Command } from 'commander'; import { action, change, writable, type Execute } from '../cli/command.js';
export function registerResume(program: Command, execute: Execute): void {
  writable(change(program.command('resume')))
    .option('--task <id>', 'task identifier for explicit review recovery')
    .option('--recover-review', 'recover an expired submitted candidate for review only')
    .action(action(program, 'resume', execute));
}
