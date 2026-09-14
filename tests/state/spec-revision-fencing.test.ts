import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { reduceJournal, type ControllerBatchOperation } from '../../packages/cli/src/state/snapshot.js';

const h = (digit: string) => digit.repeat(64);

const route = (revision: number) => ({
  task: {
    id: 'task-a', revision, state: 'ready' as const, dependsOn: [], allowedPaths: ['packages/cli/src/**'],
    acceptance: ['The focused state tests pass'], gateIds: ['pass'], risk: 'lite' as const,
  },
  taskHash: h(revision === 1 ? 'a' : 'b'), registryPath: 'core/gates/default.yaml', gateDefinitionHash: h('c'),
});

const oldLease = {
  taskId: 'task-a', taskRevision: 1, generation: 3, inputTreeHash: h('d'), expiresAt: '2030-01-01T00:00:00.000Z',
};
const newLease = {
  taskId: 'task-a', taskRevision: 2, generation: 4, inputTreeHash: h('e'), expiresAt: '2030-01-02T00:00:00.000Z',
};

async function appendCommittedBatch(journal: Journal, kind: string, operations: ControllerBatchOperation[]): Promise<void> {
  const prepared = await journal.append({
    changeId: 'revision-fencing', type: 'controller.batch.prepared', payload: {
      version: 1, batchId: `batch-${(await journal.replay()).events.length + 1}`, kind, operations, projections: [],
    },
  });
  await journal.appendIfTail({
    changeId: 'revision-fencing', type: 'controller.batch.committed',
    payload: { version: 1, batchId: (prepared.payload as { batchId: string }).batchId, preparedEventHash: prepared.eventHash },
  }, prepared.eventHash);
}

async function journalAtNewRevision(): Promise<Journal> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-spec-revision-fencing-'));
  const journal = new Journal(join(root, 'journal.ndjson'));
  await journal.append({ changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, type: 'route.selected', payload: route(1) });
  await journal.append({ changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'lease.claimed', payload: { lease: oldLease } });
  await journal.append({ changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'run.transition', payload: { runId: 'run-v1', from: null, to: 'created' } });
  await journal.append({ changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'run.transition', payload: { runId: 'run-v1', from: 'created', to: 'running' } });
  await journal.append({ changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'run.transition', payload: { runId: 'run-v1', from: 'running', to: 'succeeded' } });
  await journal.append({ changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'task.transition', payload: { from: 'verifying', to: 'done' } });
  await journal.append({ changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'lease.released', payload: { lease: oldLease, reason: 'completed' } });

  // This reducer-only authority stub has the current event shape; controller approval/history validation is outside this unit fixture.
  await appendCommittedBatch(journal, 'spec-revision', [
    {
      type: 'controller.spec.revised', payload: {
        schemaVersion: 1,
        authority: {
          revision: 2, revisionId: h('2'), specHash: h('2'), previousRevisionId: null, previousSpecHash: h('1'),
          specPath: 'spec-v2.md', sourceHash: h('3'), sourceBase64: 'c3BlYy12Mgo=',
          constitutionPath: null, constitutionHash: null, constitutionBase64: null, routes: [route(2)],
        },
      },
    },
    { type: 'route.selected', taskId: 'task-a', taskRevision: 2, payload: route(2) },
    { type: 'change.transition', payload: { from: 'triage', to: 'spec-approved', revisionReset: true } },
  ]);

  await appendCommittedBatch(journal, 'claim', [
    { type: 'lease.claimed', taskId: 'task-a', taskRevision: 2, leaseGeneration: 4, payload: { lease: newLease } },
    { type: 'task.transition', taskId: 'task-a', taskRevision: 2, leaseGeneration: 4, payload: { from: 'ready', to: 'leased' } },
    { type: 'run.transition', taskId: 'task-a', taskRevision: 2, leaseGeneration: 4, payload: { runId: 'run-v2', from: null, to: 'created' } },
    { type: 'run.transition', taskId: 'task-a', taskRevision: 2, leaseGeneration: 4, payload: { runId: 'run-v2', from: 'created', to: 'running' } },
    { type: 'run.claimed', taskId: 'task-a', taskRevision: 2, leaseGeneration: 4, payload: { runId: 'run-v2', lease: newLease, operationFingerprint: h('f'), inputEntries: [], attemptKind: 'initial' } },
    { type: 'task.transition', taskId: 'task-a', taskRevision: 2, leaseGeneration: 4, payload: { from: 'leased', to: 'implementing' } },
  ]);
  return journal;
}

describe('spec-revision reducer fencing', () => {
  test('projects a revision-route reset, a new claim, and retained completed Run history', async () => {
    const journal = await journalAtNewRevision();

    expect(reduceJournal((await journal.replay()).events)).toMatchObject({
      tasks: { 'task-a': { state: 'implementing', revision: 2, leaseGeneration: 4 } },
      leases: { 'task-a': { generation: 4, active: true } },
      runs: {
        'run-v1': { state: 'succeeded', taskId: 'task-a' },
        'run-v2': { state: 'running', taskId: 'task-a' },
      },
    });
  });

  test.each([
    ['task transition', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'task.transition', payload: { from: 'verifying', to: 'done' } }],
    ['lease release', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'lease.released', payload: { lease: oldLease, reason: 'late-old-worker' } }],
    ['lease abandonment', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'lease.abandoned', payload: { lease: oldLease, reason: 'late-old-worker' } }],
    ['lease claim', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'lease.claimed', payload: { lease: oldLease } }],
    ['old Run transition', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 1, leaseGeneration: 3, type: 'run.transition', payload: { runId: 'run-v1', from: 'succeeded', to: 'cancelled' } }],
  ] as const)('fails closed for a late old-revision %s after the new epoch', async (_kind, staleEvent) => {
    const journal = await journalAtNewRevision();
    await journal.append(staleEvent);
    const events = (await journal.replay()).events;
    expect(() => reduceJournal(events)).toThrow();
  });

  test.each([
    ['equal-revision route reuse', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 2, type: 'route.selected', payload: route(2) }],
    ['regressed current-revision lease claim', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 2, leaseGeneration: 3, type: 'lease.claimed', payload: { lease: { ...newLease, generation: 3 } } }],
    ['regressed current-revision lease release', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 2, leaseGeneration: 3, type: 'lease.released', payload: { lease: { ...newLease, generation: 3 }, reason: 'late-current-worker' } }],
    ['generation-less current Run transition', { changeId: 'revision-fencing', taskId: 'task-a', taskRevision: 2, type: 'run.transition', payload: { runId: 'run-v2', from: 'running', to: 'succeeded' } }],
    ['taskless current Run transition', { changeId: 'revision-fencing', type: 'run.transition', payload: { runId: 'run-v2', from: 'running', to: 'succeeded' } }],
    ['taskless current Run claim', { changeId: 'revision-fencing', type: 'run.claimed', payload: { runId: 'forged-run', lease: newLease } }],
    ['taskless current submission', { changeId: 'revision-fencing', type: 'controller.submit.accepted', payload: { runId: 'run-v2', taskId: 'task-a', taskRevision: 2, leaseGeneration: 4 } }],
    ['taskless current Gate evidence', { changeId: 'revision-fencing', type: 'controller.gate.result', payload: { runId: 'run-v2', taskId: 'task-a', taskRevision: 2, leaseGeneration: 4 } }],
  ] as const)('fails closed for %s after a newer current-generation claim', async (_kind, staleEvent) => {
    const journal = await journalAtNewRevision();
    await journal.append(staleEvent);
    const events = (await journal.replay()).events;
    expect(() => reduceJournal(events)).toThrow();
  });
});
