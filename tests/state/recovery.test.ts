import { appendFile, mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { Journal, recoverJournal } from '../../packages/cli/src/state/journal.js';
import { recoverSnapshot } from '../../packages/cli/src/state/snapshot.js';
import { reduceJournal } from '../../packages/cli/src/state/snapshot.js';
import { withJournalLock } from '../../packages/cli/src/state/lock.js';

describe('journal recovery', () => {
  test('replays fsynced hash-chained events and discards only an incomplete tail', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const journal = new Journal(join(dir, 'journal.ndjson'));
    await journal.append({ changeId: 'c', type: 'initialized' });
    await appendFile(join(dir, 'journal.ndjson'), '{"sequence":2');
    const replay = await journal.replay();
    expect(replay.events).toHaveLength(1);
    expect(replay.discardedIncompleteTail).toBe(true);
    expect((await readFile(join(dir, 'journal.ndjson'), 'utf8')).endsWith('\n')).toBe(true);
  });

  test('strict replay reports an incomplete tail without repairing its bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson');
    const journal = new Journal(path);
    await journal.append({ changeId: 'c', type: 'initialized' });
    await appendFile(path, '{"sequence":2');
    const before = await readFile(path);

    const replay = await (journal as Journal & { replayStrict(): ReturnType<Journal['replay']> }).replayStrict();

    expect(replay.events).toHaveLength(1);
    expect(replay.discardedIncompleteTail).toBe(true);
    expect(await readFile(path)).toEqual(before);
  });

  test('refuses a hash-invalid committed event instead of truncating it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson');
    const journal = new Journal(path);
    await journal.append({ changeId: 'c', type: 'initialized' });
    const line = await readFile(path, 'utf8');
    await appendFile(path, line.replace('initialized', 'tampered'));
    await expect(journal.replay()).rejects.toMatchObject({ code: 'JOURNAL_CORRUPT' });
  });

  test('maps committed corruption to blocked controller recovery without appending another event', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson'); const journal = new Journal(path);
    await journal.append({ changeId: 'c', type: 'initialized' });
    const before = await readFile(path, 'utf8'); await appendFile(path, before.replace('initialized', 'tampered'));
    expect(await recoverJournal(journal)).toMatchObject({ ok: false, changeState: 'blocked', taskState: 'blocked', code: 'JOURNAL_CORRUPT' });
    expect(await readFile(path, 'utf8')).toContain('tampered');
  });

  test('rejects invalid prospective frames before they are fsynced', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-')); const journal = new Journal(join(dir, 'journal.ndjson'));
    await expect(journal.append({ changeId: '', type: 'bad', taskRevision: 0 } as never)).rejects.toMatchObject({ code: 'JOURNAL_EVENT_INVALID' });
    expect(await readFile(join(dir, 'journal.ndjson'), 'utf8')).toBe('');
  });

  test('replays the journal when a replaceable snapshot disagrees with its committed event', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const journal = new Journal(join(dir, 'journal.ndjson'));
    const event = await journal.append({ changeId: 'c', type: 'initialized', payload: { state: 'triage' } });
    await writeFile(join(dir, 'snapshot.json'), JSON.stringify({ lastSequence: 77, lastEventHash: 'wrong', state: {} }));
    const recovery = await recoverSnapshot(join(dir, 'snapshot.json'), journal);
    expect(recovery.replayed).toBe(true);
    expect(recovery.events).toEqual([event]);
  });

  test('does not accept a structurally incomplete but hash-shaped committed frame', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson');
    await writeFile(path, `${JSON.stringify({ sequence: 1, previousEventHash: '0'.repeat(64), payloadHash: '0'.repeat(64), eventHash: '0'.repeat(64) })}\n`);
    await expect(new Journal(path).replay()).rejects.toMatchObject({ code: 'JOURNAL_CORRUPT' });
  });

  test('serializes concurrent append with a concurrent incomplete-tail recovery', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson');
    const journal = new Journal(path);
    await journal.append({ changeId: 'c', type: 'initialized' });
    await appendFile(path, '{"sequence":2');
    await Promise.all([journal.replay(), journal.append({ changeId: 'c', type: 'continued' })]);
    expect((await journal.replay()).events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  test('rejects a compare-and-append when the journal was removed after its expected tail was observed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson'); const journal = new Journal(path);
    const prior = await journal.append({ changeId: 'c', type: 'initialized' });
    await unlink(path);
    await expect(journal.appendIfTail({ changeId: 'c', type: 'continued' }, prior.eventHash)).rejects.toMatchObject({ code: 'JOURNAL_TAIL_MISMATCH' });
    expect(await readFile(path, 'utf8')).toBe('');
  });

  test('appends a hash-chained event when the expected tail still matches', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const journal = new Journal(join(dir, 'journal.ndjson'));
    const prior = await journal.append({ changeId: 'c', type: 'initialized' });
    const appended = await journal.appendIfTail({ changeId: 'c', type: 'continued' }, prior.eventHash);
    expect(appended).toMatchObject({ sequence: 2, previousEventHash: prior.eventHash, type: 'continued' });
  });

  test('rejects compare-and-append without repairing an incomplete tail after the expected event', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson'); const journal = new Journal(path);
    const prior = await journal.append({ changeId: 'c', type: 'initialized' });
    await appendFile(path, '{"sequence":2');
    const before = await readFile(path, 'utf8');
    await expect(journal.appendIfTail({ changeId: 'c', type: 'continued' }, prior.eventHash)).rejects.toMatchObject({ code: 'JOURNAL_TAIL_MISMATCH' });
    expect(await readFile(path, 'utf8')).toBe(before);
  });

  test('rejects a compare-and-append when the journal was truncated after its expected tail was observed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson'); const journal = new Journal(path);
    await journal.append({ changeId: 'c', type: 'initialized' });
    const prior = await journal.append({ changeId: 'c', type: 'prepared' });
    const firstFrame = (await readFile(path, 'utf8')).split('\n')[0];
    await writeFile(path, `${firstFrame}\n`);
    await expect(journal.appendIfTail({ changeId: 'c', type: 'continued' }, prior.eventHash)).rejects.toMatchObject({ code: 'JOURNAL_TAIL_MISMATCH' });
    expect((await journal.replay()).events).toHaveLength(1);
  });

  test('rejects a compare-and-append when the journal was replaced with another valid chain', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson'); const journal = new Journal(path);
    const prior = await journal.append({ changeId: 'c', type: 'initialized' });
    const replacement = new Journal(join(dir, 'replacement.ndjson'));
    await replacement.append({ changeId: 'other', type: 'initialized' });
    await writeFile(path, await readFile(join(dir, 'replacement.ndjson'), 'utf8'));
    await expect(journal.appendIfTail({ changeId: 'c', type: 'continued' }, prior.eventHash)).rejects.toMatchObject({ code: 'JOURNAL_TAIL_MISMATCH' });
    expect((await journal.replay()).events.map((event) => event.changeId)).toEqual(['other']);
  });

  test('rejects a compare-and-append when a concurrent append advances the expected tail first', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const path = join(dir, 'journal.ndjson'); const journal = new Journal(path);
    const prior = await journal.append({ changeId: 'c', type: 'initialized' });
    let advanced!: () => void; let release!: () => void;
    const advancedTail = new Promise<void>((resolve) => { advanced = resolve; });
    const releaseTransaction = new Promise<void>((resolve) => { release = resolve; });
    const competingAppend = journal.withExclusive(async (transaction) => {
      await transaction.append({ changeId: 'c', type: 'competing' });
      advanced();
      await releaseTransaction;
    });
    await advancedTail;
    const comparedAppend = journal.appendIfTail({ changeId: 'c', type: 'continued' }, prior.eventHash);
    release();
    await competingAppend;
    await expect(comparedAppend).rejects.toMatchObject({ code: 'JOURNAL_TAIL_MISMATCH' });
    expect((await journal.replay()).events.map((event) => event.type)).toEqual(['initialized', 'competing']);
  });

  test('replays rather than trusting a forged archived snapshot', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const journal = new Journal(join(dir, 'journal.ndjson'));
    await journal.append({ changeId: 'c', type: 'initialized' });
    await writeFile(join(dir, 'snapshot.json'), JSON.stringify({ lastSequence: 1, lastEventHash: (await journal.replay()).events[0].eventHash, state: { changeId: 'c', lastType: 'archived', eventCount: 1 }, stateDigest: '0'.repeat(64) }));
    const recovery = await recoverSnapshot(join(dir, 'snapshot.json'), journal);
    expect(recovery.replayed).toBe(true);
    expect(recovery.snapshot).toBeUndefined();
  });

  test('reduces typed journal events into lifecycle rather than last-event text', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-')); const journal = new Journal(join(dir, 'journal.ndjson'));
    await journal.append({ changeId: 'c', type: 'change.transition', payload: { to: 'executing' } });
    await journal.append({ changeId: 'c', taskId: 't', taskRevision: 1, leaseGeneration: 2, type: 'lease.claimed', payload: {} });
    await journal.append({ changeId: 'c', taskId: 't', taskRevision: 1, leaseGeneration: 2, type: 'blocker.recorded', payload: { blockerId: 'b' } });
    expect(reduceJournal((await journal.replay()).events)).toMatchObject({ changeId: 'c', changeState: 'executing', leases: { t: { generation: 2, active: true } }, blockers: ['b'] });
  });

  test('projects a controller batch only after one adjacent hash-bound commit while retaining legacy direct events', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const journal = new Journal(join(dir, 'journal.ndjson'));
    await journal.append({ changeId: 'c', type: 'change.transition', payload: { from: 'triage', to: 'discovery' } });
    const prepared = await journal.append({ changeId: 'c', type: 'controller.batch.prepared', payload: {
      version: 1, batchId: 'batch-1', kind: 'transition', projections: [],
      operations: [{ type: 'change.transition', payload: { from: 'discovery', to: 'spec-review' } }],
    } });
    expect(reduceJournal((await journal.replayStrict()).events).changeState).toBe('discovery');
    await journal.appendIfTail({ changeId: 'c', type: 'controller.batch.committed', payload: { version: 1, batchId: 'batch-1', preparedEventHash: prepared.eventHash } }, prepared.eventHash);
    expect(reduceJournal((await journal.replayStrict()).events).changeState).toBe('spec-review');
  });

  test('fails closed for non-adjacent, duplicate, or hash-mismatched controller batch commits', async () => {
    for (const fault of ['non-adjacent', 'duplicate', 'hash-mismatch'] as const) {
      const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
      const journal = new Journal(join(dir, 'journal.ndjson'));
      const prepared = await journal.append({ changeId: 'c', type: 'controller.batch.prepared', payload: {
        version: 1, batchId: 'batch-bad', kind: 'transition', projections: [],
        operations: [{ type: 'change.transition', payload: { from: 'triage', to: 'discovery' } }],
      } });
      if (fault === 'non-adjacent') await journal.append({ changeId: 'c', type: 'unrelated' });
      const commit = await journal.append({ changeId: 'c', type: 'controller.batch.committed', payload: { version: 1, batchId: 'batch-bad', preparedEventHash: fault === 'hash-mismatch' ? '0'.repeat(64) : prepared.eventHash } });
      if (fault === 'duplicate') await journal.append({ changeId: 'c', type: 'controller.batch.committed', payload: { version: 1, batchId: 'batch-bad', preparedEventHash: prepared.eventHash, duplicateOf: commit.eventHash } });
      const events = (await journal.replayStrict()).events;
      expect(() => reduceJournal(events), fault).toThrow(/batch/i);
    }
  });

  test('fails closed when a committed projection hash does not match its serialized desired value', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-journal-'));
    const journal = new Journal(join(dir, 'journal.ndjson'));
    const prepared = await journal.append({ changeId: 'c', type: 'controller.batch.prepared', payload: {
      version: 1, batchId: 'batch-malformed-projection', kind: 'transition', operations: [],
      projections: [{ relativePath: '.leo-dev/changes/c/manifest.yaml', priorHash: 'a'.repeat(64), desiredHash: 'b'.repeat(64), desiredValue: { state: 'triage' } }],
    } });
    await journal.appendIfTail({ changeId: 'c', type: 'controller.batch.committed', payload: { version: 1, batchId: 'batch-malformed-projection', preparedEventHash: prepared.eventHash } }, prepared.eventHash);
    const events = (await journal.replayStrict()).events;
    expect(() => reduceJournal(events)).toThrow(/batch|projection/i);
  });

  test('returns a stable busy code after bounded lock contention', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'leo-dev-lock-')); const path = join(dir, 'journal.ndjson');
    let acquired!: () => void; let release!: () => void;
    const acquiredLock = new Promise<void>((resolve) => { acquired = resolve; });
    const releaseLock = new Promise<void>((resolve) => { release = resolve; });
    const held = withJournalLock(path, async () => { acquired(); await releaseLock; });
    await acquiredLock;
    await expect(withJournalLock(path, async () => undefined)).rejects.toMatchObject({ code: 'CONTROLLER_BUSY' });
    release();
    await held;
  });
});
