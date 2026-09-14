import type { Command } from 'commander';
import type { CommandOptions, CommandResult } from '../controller/types.js';

export type Execute = (name: string, options: CommandOptions) => Promise<CommandResult>;

export function action(program: Command, name: string, execute: Execute) {
  return async (_options: CommandOptions, command: Command): Promise<void> => {
    const commandResult = await execute(name, command.optsWithGlobals() as CommandOptions);
    program.setOptionValueWithSource('__result', commandResult, 'implied');
  };
}

export function writable(command: Command): Command { return command.option('--dry-run', 'validate and plan without writing or executing'); }
export function change(command: Command): Command { return command.requiredOption('--change <id>', 'change identifier'); }
export function task(command: Command): Command { return change(command).requiredOption('--task <id>', 'task identifier'); }
export function receipt(command: Command): Command { return change(command).requiredOption('--receipt <path>', 'JSON or YAML receipt path'); }
