import { join, resolve } from 'node:path';
import { assertChangeId } from '../changes/artifacts.js';

export function runtimePaths(repositoryRoot: string, changeId: string) {
  assertChangeId(changeId);
  const root = resolve(repositoryRoot);
  const directory = join(root, '.leo-dev', 'runtime', changeId);
  return { directory, journal: join(directory, 'journal.ndjson'), snapshot: join(directory, 'snapshot.json'), lease: join(directory, 'lease.json') };
}
