import { lstat, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export function assertChangeId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(id)) throw new Error('Invalid change id');
}

export async function assertContained(root: string, candidate: string): Promise<void> {
  const absoluteRoot = await realpath(root);
  const absoluteCandidate = resolve(candidate);
  if (absoluteCandidate !== absoluteRoot && !absoluteCandidate.startsWith(`${absoluteRoot}${sep}`)) throw new Error('Path escapes repository');
  let probe = absoluteCandidate;
  while (probe.startsWith(absoluteRoot)) {
    try {
      const info = await lstat(probe);
      if (info.isSymbolicLink()) throw new Error(`Symlink escapes repository: ${probe}`);
      if (probe === absoluteRoot) return;
      probe = dirname(probe);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (probe === absoluteRoot) throw error;
      probe = dirname(probe);
    }
  }
  throw new Error('Path escapes repository');
}
