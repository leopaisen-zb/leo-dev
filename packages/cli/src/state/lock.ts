import lockfile from 'proper-lockfile';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';

export class ControllerBusyError extends Error { code = 'CONTROLLER_BUSY' as const; }

export async function withJournalLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(dirname(path), { recursive: true });
  const seed = await open(path, 'a');
  await seed.close();
  let release: () => Promise<void>;
  try { release = await lockfile.lock(path, { realpath: false, retries: { retries: 8, minTimeout: 20, maxTimeout: 80, factor: 1.25 } }); }
  catch (error) { throw new ControllerBusyError(`Controller lock busy: ${path}`); }
  try { return await operation(); } finally { await release(); }
}
