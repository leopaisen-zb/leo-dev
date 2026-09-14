import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { LeaseManager } from '../../packages/cli/src/state/lease.js';

describe('fenced leases', () => {
  test('rejects a stale worker after a newer persisted lease generation is issued', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-lease-'));
    const leases = new LeaseManager(new Journal(join(root, '.leo-dev/runtime/change/journal.ndjson')), root);
    const first = await leases.claimPersistent('task', 3, 1, new Date(0));
    const second = await leases.claimPersistent('task', 3, 60_000, new Date(2));
    expect(second.generation).toBe(first.generation + 1);
    expect(await leases.assertCurrentPersistent({ taskId: 'task', taskRevision: 3, generation: first.generation, inputTreeHash: first.inputTreeHash }, new Date(2))).toMatchObject({ ok: false, code: 'STALE_LEASE' });
    expect((await leases.assertCurrentPersistent({ taskId: 'task', taskRevision: 3, generation: second.generation, inputTreeHash: second.inputTreeHash }, new Date(2))).ok).toBe(true);
  });

  test('rejects task revision and input tree mismatches by persistent CAS', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-lease-'));
    const leases = new LeaseManager(new Journal(join(root, '.leo-dev/runtime/change/journal.ndjson')), root);
    const lease = await leases.claimPersistent('task', 3, 60_000);
    expect((await leases.assertCurrentPersistent({ taskId: 'task', taskRevision: 4, generation: lease.generation, inputTreeHash: lease.inputTreeHash })).code).toBe('STALE_REVISION');
    expect((await leases.assertCurrentPersistent({ taskId: 'task', taskRevision: 3, generation: lease.generation, inputTreeHash: 'b'.repeat(64) })).code).toBe('STALE_TREE');
  });

  test('persists generation and rejects a second active claim after process restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-lease-'));
    const journal = new Journal(join(root, '.leo-dev/runtime/change/journal.ndjson'));
    const first = new LeaseManager(journal, root);
    const lease = await first.claimPersistent('task', 1, 60_000);
    const restarted = new LeaseManager(journal, root);
    await expect(restarted.claimPersistent('task', 1, 60_000)).rejects.toMatchObject({ code: 'ACTIVE_LEASE' });
    expect((await restarted.assertCurrentPersistent({ taskId: 'task', taskRevision: 1, generation: lease.generation, inputTreeHash: lease.inputTreeHash })).ok).toBe(true);
  });

  test('serializes concurrent claims, advances after expiry, and fences tree drift', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-lease-'));
    const journal = new Journal(join(root, '.leo-dev/runtime/change/journal.ndjson'));
    const leases = new LeaseManager(journal, root);
    const results = await Promise.allSettled([leases.claimPersistent('task', 1, 1, new Date(0)), leases.claimPersistent('task', 1, 1, new Date(0))]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const next = await leases.claimPersistent('task', 1, 10_000, new Date(2));
    expect(next.generation).toBe(2);
    await writeFile(join(root, 'source.txt'), 'changed after claim');
    expect((await leases.assertCurrentPersistent({ taskId: 'task', taskRevision: 1, generation: next.generation, inputTreeHash: next.inputTreeHash }, new Date(3))).code).toBe('STALE_TREE');
  });

  test('uses identical persistent CAS for review submissions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-lease-'));
    const journal = new Journal(join(root, '.leo-dev/runtime/change/journal.ndjson'));
    const leases = new LeaseManager(journal, root);
    const lease = await leases.claimPersistent('task', 2, 10_000);
    expect((await leases.assertReviewPersistent({ taskId: 'task', taskRevision: 1, generation: lease.generation, inputTreeHash: lease.inputTreeHash })).code).toBe('STALE_REVISION');
  });
});
