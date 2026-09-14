import type { Command } from 'commander';
import { action, change, writable, type Execute } from '../cli/command.js';

export function registerTeam(program: Command, execute: Execute): void {
  writable(change(program.command('team'))
    .requiredOption('--action <status|record>', 'team action: status or record')
    .option('--input <path>', 'repository-relative JSON or YAML record for action=record'))
    .action(action(program, 'team', execute));
}
