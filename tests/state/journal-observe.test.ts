import { appendFile, mkdtemp, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { Journal } from '../../packages/cli/src/state/journal.js';

describe('journal observation', () => {
  test('reads an existing committed journal without creating a lock or changing bytes or metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'leo-dev-observe-'));
    const path = join(directory, 'journal.ndjson');
    const journal = new Journal(path);
    await journal.append({ changeId: 'observe', type: 'controller.initialized' });
    const before = { names: await readdir(directory), bytes: await readFile(path), stat: await stat(path) };

    const observation = await journal.observe();

    const after = { names: await readdir(directory), bytes: await readFile(path), stat: await stat(path) };
    expect(observation.events).toHaveLength(1);
    expect(observation.discardedIncompleteTail).toBe(false);
    expect(observation.identity.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(after.names).toEqual(before.names);
    expect(after.bytes).toEqual(before.bytes);
    expect(after.stat.ino).toBe(before.stat.ino);
    expect(after.stat.mtimeMs).toBe(before.stat.mtimeMs);
  });

  test('reports an incomplete tail without truncating it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'leo-dev-observe-'));
    const path = join(directory, 'journal.ndjson');
    const journal = new Journal(path);
    await journal.append({ changeId: 'observe', type: 'controller.initialized' });
    await appendFile(path, '{"sequence":2');
    const before = await readFile(path);

    const observation = await journal.observe();

    expect(observation.discardedIncompleteTail).toBe(true);
    expect(await readFile(path)).toEqual(before);
  });

  test('keeps replay recovery order: truncate an incomplete tail before reporting a committed corrupt frame', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'leo-dev-observe-'));
    const path = join(directory, 'journal.ndjson');
    const journal = new Journal(path);
    await journal.append({ changeId: 'observe', type: 'controller.initialized' });
    const committed = (await readFile(path, 'utf8')).replace('controller.initialized', 'controller.corrupted');
    await writeFile(path, `${committed}{"sequence":2`);

    await expect(journal.replay()).rejects.toMatchObject({ code: 'JOURNAL_CORRUPT' });

    expect(await readFile(path, 'utf8')).toBe(committed);
  });

  test('rejects a journal symlink before reading its target', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'leo-dev-observe-'));
    const target = join(directory, 'target.ndjson');
    const link = join(directory, 'journal.ndjson');
    const journal = new Journal(target);
    await journal.append({ changeId: 'observe', type: 'controller.initialized' });
    const before = await readFile(target);
    await symlink(target, link);

    await expect(new Journal(link).observe()).rejects.toMatchObject({ code: 'JOURNAL_CORRUPT' });
    expect(await readFile(target)).toEqual(before);
  });
});
