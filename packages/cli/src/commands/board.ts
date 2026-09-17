import type { Command } from 'commander';
import { createBoardServer } from '../board/server.js';
import type { BoardObservation } from '../board/types.js';
import { ControllerError, result, type CommandOptions } from '../controller/types.js';
import { change, type Execute } from '../cli/command.js';

function isBoardObservation(value: unknown): value is BoardObservation {
  return !!value && typeof value === 'object'
    && (value as { schemaVersion?: unknown }).schemaVersion === 1
    && typeof (value as { repositoryRoot?: unknown }).repositoryRoot === 'string'
    && typeof (value as { changeId?: unknown }).changeId === 'string'
    && ((value as { availability?: unknown }).availability === 'available' || (value as { availability?: unknown }).availability === 'unavailable');
}

export function registerBoard(program: Command, execute: Execute): void {
  change(program.command('board')).action(async (_options: CommandOptions, command: Command): Promise<void> => {
    const options = command.optsWithGlobals() as CommandOptions;
    const first = await execute('observe', options);
    if (!first.envelope.ok || !isBoardObservation(first.envelope.state)) {
      throw new ControllerError(8, 'PREREQUISITE_FAILED', 'Board requires a bound local observation');
    }
    const initial = first.envelope.state;
    const server = createBoardServer({
      repositoryRoot: initial.repositoryRoot,
      changeId: initial.changeId,
      observe: async () => {
        const refreshed = await execute('observe', options);
        if (!isBoardObservation(refreshed.envelope.state)) throw new Error('Observe command did not return a board observation');
        return refreshed.envelope.state;
      },
    });
    const listener = await server.listen();
    process.stdout.write(options.json === true
      ? `${JSON.stringify({ event: 'BOARD_LISTENING', url: listener.url, repositoryRoot: initial.repositoryRoot, changeId: initial.changeId })}\n`
      : `${listener.url} repository=${initial.repositoryRoot} change=${initial.changeId}\n`);
    await new Promise<void>((resolve) => process.once('SIGINT', resolve));
    await server.close();
    program.setOptionValueWithSource('__result', result('BOARD_CLOSED', { url: listener.url, repositoryRoot: initial.repositoryRoot, changeId: initial.changeId }), 'implied');
  });
}
