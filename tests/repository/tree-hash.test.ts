import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { captureBaseline } from '../../packages/cli/src/repository/baseline.js';
import { canonicalTreeHash } from '../../packages/cli/src/repository/tree-hash.js';
import { writeSurface } from '../../packages/cli/src/security/paths.js';

describe('canonical repository identity', () => {
  test('hashes normalized relative names, modes, and content deterministically', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-tree-'));
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'nested/a.txt'), 'alpha');
    await writeFile(join(root, 'b.txt'), 'bravo');
    const first = await canonicalTreeHash(root);
    const second = await canonicalTreeHash(root);
    expect(second).toEqual(first);
    await writeFile(join(root, 'b.txt'), 'changed');
    expect((await canonicalTreeHash(root)).hash).not.toBe(first.hash);
  });

  test('rejects symlinks that resolve outside the repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-tree-'));
    await symlink('/etc/hosts', join(root, 'escape'));
    await expect(canonicalTreeHash(root)).rejects.toThrow(/symlink.*escape/i);
  });

  test('uses byte-stable ordering and rejects every symlink, including an internal one', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-tree-'));
    await writeFile(join(root, 'ä.txt'), 'utf8');
    await writeFile(join(root, 'z.txt'), 'ascii');
    expect((await canonicalTreeHash(root)).entries.map((entry) => entry.split('\0')[0])).toEqual(['z.txt', 'ä.txt']);
    await symlink(join(root, 'z.txt'), join(root, 'internal-link'));
    await expect(canonicalTreeHash(root)).rejects.toThrow(/symlink/i);
  });

  test('does not let generated or runtime-only paths change the relevant tree identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-tree-'));
    await mkdir(join(root, 'nested/node_modules'), { recursive: true });
    await writeFile(join(root, 'source.txt'), 'source');
    const before = await canonicalTreeHash(root);
    await writeFile(join(root, 'nested/node_modules/generated.js'), 'generated');
    await mkdir(join(root, '.leo-dev/runtime/change'), { recursive: true });
    await writeFile(join(root, '.leo-dev/runtime/change/journal.ndjson'), 'runtime');
    expect((await canonicalTreeHash(root)).hash).toBe(before.hash);
  });

  test('reports unavailable Git explicitly rather than inventing untracked ownership', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-tree-'));
    await writeFile(join(root, 'new.txt'), 'untracked');
    const baseline = await captureBaseline(root);
    expect(baseline.git.available).toBe(false);
    expect(baseline.untracked).toEqual([]);
    expect(baseline.treeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('parses nul-delimited Git status without losing spaces or staged ownership', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-tree-'));
    const git = promisify(execFile);
    await git('git', ['init', '-q'], { cwd: root });
    await git('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await git('git', ['config', 'user.name', 'Test'], { cwd: root });
    await writeFile(join(root, 'space name.txt'), 'one');
    await git('git', ['add', '.'], { cwd: root });
    await git('git', ['commit', '-qm', 'initial'], { cwd: root });
    await writeFile(join(root, 'space name.txt'), 'two');
    await writeFile(join(root, 'new file.txt'), 'three');
    const baseline = await captureBaseline(root);
    expect(baseline.git.available).toBe(true);
    expect(baseline.dirty).toEqual(['space name.txt']);
    expect(baseline.untracked).toEqual(['new file.txt']);
  });

  test('restarts the whole write-surface scan when an enumerated transient entry disappears', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-surface-race-'));
    const slow = join(root, 'a-slow');
    const transient = join(root, 'z-transient');
    await mkdir(slow);
    await Promise.all(Array.from({ length: 1_000 }, (_, index) => writeFile(join(slow, `${String(index).padStart(4, '0')}.txt`), 'stable')));
    await mkdir(transient);

    const scanning = writeSurface(root);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await rm(transient, { recursive: true });

    const surface = await scanning;
    expect(surface.entries.some((entry) => entry.includes('z-transient'))).toBe(false);
    expect(await writeSurface(root)).toEqual(surface);
  }, 60_000);
});
