#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { registerApprove } from './commands/approve.js'; import { registerClaim } from './commands/claim.js'; import { registerDoctor } from './commands/doctor.js'; import { registerInit } from './commands/init.js'; import { registerInspect } from './commands/inspect.js'; import { registerReconcile } from './commands/reconcile.js'; import { registerResolve } from './commands/resolve.js'; import { registerResume } from './commands/resume.js'; import { registerRevise } from './commands/revise.js'; import { registerReview } from './commands/review.js'; import { registerRoute } from './commands/route.js'; import { registerRunGates } from './commands/run-gates.js'; import { registerStatus } from './commands/status.js'; import { registerSubmit } from './commands/submit.js'; import { registerTeam } from './commands/team.js'; import { registerTransition } from './commands/transition.js'; import { registerWaive } from './commands/waive.js';
import { Controller } from './controller/controller.js';
import { ControllerError, failure, result, type CommandOptions, type CommandResult } from './controller/types.js';

const commandNames = ['init', 'inspect', 'route', 'revise', 'status', 'transition', 'claim', 'run-gates', 'submit', 'review', 'approve', 'waive', 'resolve', 'reconcile', 'resume', 'team', 'doctor'];
const program = new Command(); const controller = new Controller(); let commandResult: CommandResult | undefined;
program.name('leo-dev').description('Leo Dev v1 local controller CLI').option('--repo <path>', 'repository root', process.cwd()).option('--json', 'emit stable JSON').helpOption(false).addHelpCommand(false).allowExcessArguments(false).showSuggestionAfterError(false).showHelpAfterError(false).exitOverride().configureOutput({ writeOut: () => undefined, writeErr: () => undefined });
const execute = async (name: string, options: CommandOptions): Promise<CommandResult> => { const value = await controller.execute(name, options); commandResult = value; return value; };
registerInit(program, execute); registerInspect(program, execute); registerRoute(program, execute); registerRevise(program, execute); registerStatus(program, execute); registerTransition(program, execute); registerClaim(program, execute); registerRunGates(program, execute); registerSubmit(program, execute); registerReview(program, execute); registerApprove(program, execute); registerWaive(program, execute); registerResolve(program, execute); registerReconcile(program, execute); registerResume(program, execute); registerTeam(program, execute); registerDoctor(program, execute);

function helpState(argv: string[]): object {
  const options = [...program.options, ...program.commands.flatMap((command) => command.options)];
  let commandName: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (value === '--') break;
    if (value.startsWith('-')) {
      const option = options.find((candidate) => candidate.flags.split(/[ ,|]+/).includes(value) || value.startsWith(`${candidate.long}=`));
      if (option && (option.required || option.optional) && !value.includes('=')) index += 1;
      continue;
    }
    if (commandNames.includes(value)) { commandName = value; break; }
  }
  if (!commandName) return { commands: commandNames };
  const command = program.commands.find((candidate) => candidate.name() === commandName);
  return {
    commands: commandNames,
    command: commandName,
    options: [...program.options, ...(command?.options ?? [])].map((option) => option.flags),
  };
}

async function main(): Promise<void> {
  try {
    if (process.argv.slice(2).includes('--help') || process.argv.length === 2) commandResult = result('HELP', helpState(process.argv.slice(2)));
    else await program.parseAsync(process.argv);
    commandResult ??= program.getOptionValue('__result') as CommandResult | undefined;
    commandResult ??= result('HELP', { commands: commandNames });
  } catch (error: unknown) {
    if (error instanceof ControllerError || (error && typeof error === 'object' && 'exitCode' in error && 'publicCode' in error)) commandResult = failure(error as ControllerError);
    else if (error instanceof CommanderError) commandResult = error.exitCode === 0 ? result('HELP', { commands: commandNames }) : failure(new ControllerError(2, 'VALIDATION_ERROR', error.message));
    else commandResult = failure(new ControllerError(9, 'INTERNAL_ERROR', error instanceof Error ? error.message : String(error)));
  }
  process.stdout.write(`${JSON.stringify(commandResult.envelope)}\n`); process.exitCode = commandResult.exitCode;
}
await main();
