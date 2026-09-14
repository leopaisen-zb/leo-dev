import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { afterEach, describe, expect, test } from 'vitest';
import { commitControllerBatch } from '../../packages/cli/src/controller/batch.js';
import { Controller } from '../../packages/cli/src/controller/controller.js';
import { validateReceipt } from '../../packages/cli/src/schema/validate.js';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { projectJournalEvents } from '../../packages/cli/src/state/snapshot.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

type Envelope = {
  ok: boolean;
  code: string;
  state: Record<string, any> | null;
  errors: Array<{ code: string; message: string }>;
  evidenceRefs: string[];
};

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope; stderr: string } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], {
    cwd: repository,
    encoding: 'utf8',
    timeout: 20_000,
    killSignal: 'SIGKILL',
  });
  expect(result.error, `CLI timed out or could not start: ${result.error?.message ?? 'unknown error'}`).toBeUndefined();
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  expect(lines, `stdout=${result.stdout}\nstderr=${result.stderr}`).toHaveLength(1);
  return { status: result.status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope, stderr: result.stderr };
}

/** Starts two real compiled CLIs before awaiting either, rather than simulating a CAS loser. */
async function cliAsync(root: string, ...args: string[]): Promise<ReturnType<typeof cli>> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(process.execPath, [executable, ...args, '--repo', root, '--json'], {
      cwd: repository,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (value: Buffer) => { stdout += value; });
    child.stderr.on('data', (value: Buffer) => { stderr += value; });
    child.once('error', rejectResult);
    child.once('close', (status) => {
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        expect(lines, `stdout=${stdout}\nstderr=${stderr}`).toHaveLength(1);
        resolveResult({ status: status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope, stderr });
      } catch (error) { rejectResult(error); }
    });
  });
}

function expectExit(actual: ReturnType<typeof cli>, status: number, code: string): void {
  expect(actual.status, JSON.stringify(actual.envelope)).toBe(status);
  expect(actual.envelope.ok).toBe(status === 0);
  expect(actual.envelope.code).toBe(code);
  expect(actual.stderr).toBe('');
}

async function receipt(_root: string, name: string, value: unknown): Promise<string> {
  const path = join(tmpdir(), `leo-dev-review-recovery-${name}-${randomUUID()}.json`);
  temporary.push(path);
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function fixture(gate: 'pass' | 'missing' = 'pass'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-review-recovery-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({
    gates: [{
      id: 'pass', argv: gate === 'missing' ? ['/definitely/missing/leo-dev-review-recovery-gate'] : [process.execPath, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 10,
      required: true, replaySafety: 'pure', effectClass: 'local-verification', network: gate === 'missing' ? 'approval-required' : 'deny',
      environmentAllowlist: [], declaredWritePaths: [],
    }],
  }));
  await writeFile(join(root, 'approved-spec.md'), '# Synthetic review-recovery specification\n');
  await writeFile(join(root, 'src/candidate.ts'), 'export const candidate = true;\n');
  await writeFile(join(root, 'src/other.ts'), 'export const other = true;\n');
  await writeFile(join(root, 'src/successor.ts'), 'export const successor = true;\n');
  await writeFile(join(root, 'task-plan.json'), JSON.stringify({
    schemaVersion: 1,
    tasks: [
      {
        id: 'task-a', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/candidate.ts'],
        acceptance: ['Synthetic candidate passes'], gateIds: ['pass'], risk: 'lite',
      },
      {
        id: 'task-b', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/other.ts'],
        acceptance: ['Independent task remains serialized'], gateIds: ['pass'], risk: 'lite',
      },
      {
        id: 'task-c', revision: 1, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/successor.ts'],
        acceptance: ['Successor unlocks only after accepted review'], gateIds: ['pass'], risk: 'lite',
      },
    ],
  }));
  return root;
}

async function advanceToExecuting(root: string, changeId: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'task-plan.json'), 0, 'ROUTED_LITE');
  for (const state of ['discovery', 'spec-review']) {
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
  }
  const status = cli(root, 'status', '--change', changeId);
  const approvalContext = status.envelope.state!.approvalContext;
  const approval = await receipt(root, 'approval', {
    receiptId: `approval-${changeId}`,
    provenance: 'human-confirmed',
    actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated',
    decision: 'grant',
    grantedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    changeId,
    scope: 'change',
    operationKind: 'spec-approval',
    ...approvalContext,
  });
  expectExit(cli(root, 'approve', '--change', changeId, '--receipt', approval), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
  for (const state of ['spec-approved', 'task-ready', 'executing']) {
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
  }
}

async function submittedCandidate(root: string, changeId: string): Promise<Envelope['state']> {
  await advanceToExecuting(root, changeId);
  const claimed = cli(root, 'claim', '--change', changeId, '--task', 'task-a', '--ttl', '15000');
  expectExit(claimed, 0, 'CLAIMED');
  const runId = claimed.envelope.state!.run.runId as string;
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', runId), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', changeId, '--task', 'task-a'), 0, 'SUBMITTED_FOR_REVIEW');
  return cli(root, 'status', '--change', changeId).envelope.state;
}

async function waitUntilExpired(expiresAt: string): Promise<void> {
  const expiryWithMargin = Date.parse(expiresAt) + 30;
  while (Date.now() <= expiryWithMargin) {
    const delay = Math.min(50, Math.max(1, expiryWithMargin - Date.now() + 1));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
  }
}

async function reviewReceipt(root: string, context: Record<string, unknown>, overrides: Record<string, unknown> = {}): Promise<string> {
  return receipt(root, 'review', {
    ...context,
    receiptId: `review-${randomUUID()}`,
    provenance: 'agent-asserted',
    actorLabel: 'TEST-ONLY reviewer label; issuer not authenticated',
    sessionId: `session-${randomUUID()}`,
    findingsHash: hash('no findings'),
    verdict: 'pass',
    timestamp: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    ...overrides,
  });
}

async function gateApprovalReceipt(root: string, context: Record<string, unknown>): Promise<string> {
  const { runId: _runId, gateId: _gateId, taskRevision: _taskRevision, leaseGeneration: _leaseGeneration, ...receiptContext } = context;
  return receipt(root, 'gate-approval', {
    receiptId: `gate-approval-${randomUUID()}`,
    provenance: 'human-confirmed',
    actorLabel: 'TEST-ONLY fixture gate approval; issuer not authenticated',
    decision: 'grant',
    grantedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    scope: 'gate',
    operationKind: 'gate-run',
    ...receiptContext,
  });
}

async function journalBytes(root: string, changeId: string): Promise<string> {
  return readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8');
}

function journalPath(root: string, changeId: string): string {
  return join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
}

function recoveryOperations(journal: string): Array<Record<string, any>> {
  return journal.trim().split('\n').filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, any>)
    .filter((event) => event.type === 'controller.batch.prepared' && event.payload?.kind === 'expired-review-recovery')
    .flatMap((event) => event.payload.operations as Array<Record<string, any>>);
}

async function recoverExpired(root: string, changeId: string): Promise<{ before: NonNullable<Envelope['state']>; recovered: Envelope }> {
  const before = await submittedCandidate(root, changeId);
  await waitUntilExpired(before!.run.lease.expiresAt as string);
  const recovered = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review');
  expectExit(recovered, 0, 'REVIEW_RECOVERED');
  return { before: before!, recovered: recovered.envelope };
}

async function expectRecoveryRefusalWithoutWrite(root: string, changeId: string, taskId = 'task-a'): Promise<void> {
  const before = await journalBytes(root, changeId);
  const result = cli(root, 'resume', '--change', changeId, '--task', taskId, '--recover-review');
  expect([5, 7]).toContain(result.status);
  expect(['CONFLICT', 'BLOCKED']).toContain(result.envelope.code);
  expect(await journalBytes(root, changeId)).toBe(before);
}

function gateEventHashes(journal: string): string[] {
  return journal.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((event) => String(event.type).startsWith('gate.attempt.') || event.type === 'controller.batch.prepared'
      && ((event.payload as { operations?: Array<{ type?: string }> }).operations ?? []).some((operation) => operation.type === 'controller.gate.result'))
    .map((event) => String(event.eventHash));
}

function immutableExecutionEventHashes(journal: string): Record<string, string[]> {
  const selected = new Set(['run.claimed', 'controller.candidate.registered', 'controller.gate.result', 'controller.submit.accepted']);
  const raw = journal.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const entries = projectJournalEvents(raw).events.filter((event) => selected.has(event.type));
  return Object.fromEntries([...selected].map((type) => [type, entries.filter((event) => event.type === type).map((event) => event.eventHash)]));
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('compiled public expired submitted-review recovery', () => {
  test('rejects malformed recovery option pairings, including empty task values, before creating runtime state', async () => {
    const root = await fixture();
    const invalid = [
      ['resume', '--change', 'pairing', '--task', 'task-a'],
      ['resume', '--change', 'pairing', '--recover-review'],
      ['resume', '--change', 'pairing', '--task', ''],
      ['resume', '--change', 'pairing', '--task', '   ', '--recover-review'],
      ['resume', '--change', 'pairing', '--task', 'task-a', '--dry-run'],
      ['resume', '--change', 'pairing', '--recover-review', '--dry-run'],
    ];
    for (const args of invalid) expectExit(cli(root, ...args), 2, 'VALIDATION_ERROR');
    await expect(readFile(join(root, '.leo-dev/runtime/pairing/journal.ndjson'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('accepts recoveryId as the only optional recovery receipt field and rejects an empty value', () => {
    const base = {
      receiptId: 'schema-review', provenance: 'agent-asserted', actorLabel: 'test label', sessionId: 'session', runId: 'run',
      taskId: 'task-a', taskRevision: 1, leaseGeneration: 1, specHash: 'a'.repeat(64), taskHash: 'b'.repeat(64),
      treeHash: 'c'.repeat(64), findingsHash: 'd'.repeat(64), verdict: 'pass', timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(validateReceipt('review', { ...base, recoveryId: 'recovery-1' }).ok).toBe(true);
    expect(validateReceipt('review', { ...base, recoveryId: '' }).ok).toBe(false);
    expect(validateReceipt('review', { ...base, recoveredAt: new Date().toISOString() }).ok).toBe(false);
  });

  test('recovers an expired Gate-backed submission without replacing its immutable execution identity', async () => {
    const root = await fixture();
    const changeId = 'expired-review';
    const before = await submittedCandidate(root, changeId);
    const journalSubmitted = await journalBytes(root, changeId);
    const unexpiredRecovery = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review');
    expectExit(unexpiredRecovery, 5, 'CONFLICT');
    expect(await journalBytes(root, changeId)).toBe(journalSubmitted);
    await waitUntilExpired(before!.run.lease.expiresAt as string);

    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    const journalBeforeDryRun = await readFile(journalPath, 'utf8');
    const snapshotPath = join(root, `.leo-dev/runtime/${changeId}/snapshot.json`);
    const snapshotBeforeDryRun = await readFile(snapshotPath, 'utf8');
    const immutableBeforeRecovery = immutableExecutionEventHashes(journalBeforeDryRun);
    const oldReceipt = await reviewReceipt(root, before!.reviewContext);
    expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', oldReceipt), 5, 'CONFLICT');
    const unsolicitedRecovery = await reviewReceipt(root, before!.reviewContext, { recoveryId: 'not-committed' });
    expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', unsolicitedRecovery), 5, 'CONFLICT');
    expect(await readFile(journalPath, 'utf8')).toBe(journalBeforeDryRun);

    const dryRun = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review', '--dry-run');
    expectExit(dryRun, 0, 'DRY_RUN');
    expect(await readFile(journalPath, 'utf8')).toBe(journalBeforeDryRun);
    expect(await readFile(snapshotPath, 'utf8')).toBe(snapshotBeforeDryRun);

    const recovered = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review');
    expectExit(recovered, 0, 'REVIEW_RECOVERED');
    expect(recovered.envelope.state!.reviewContext).toMatchObject(before!.reviewContext);
    expect(recovered.envelope.state!.reviewContext.recoveryId).toEqual(expect.any(String));
    expect(recovered.envelope.state!.reviewRecovery).toMatchObject({ recoveryId: recovered.envelope.state!.reviewContext.recoveryId });
    expect(recovered.envelope.state!.tasks['task-a'].state).toBe('review-required');
    expect(recovered.envelope.state!.run.lease).toEqual(before!.run.lease);
    expect(recovered.envelope.state!.attempts).toEqual(before!.attempts);
    expect(recovered.envelope.state!.tasks['task-b'].state).toBe('ready');
    expect(recovered.envelope.state!.tasks['task-c'].state).toBe('pending');
    const journalRecovered = await journalBytes(root, changeId);
    expect(gateEventHashes(journalRecovered)).toEqual(gateEventHashes(journalBeforeDryRun));
    expect(immutableExecutionEventHashes(journalRecovered)).toEqual(immutableBeforeRecovery);
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-b'), 5, 'CONFLICT');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', before!.run.runId), 7, 'BLOCKED');
    expectExit(cli(root, 'submit', '--change', changeId, '--task', 'task-a'), 7, 'BLOCKED');
    expect(await journalBytes(root, changeId)).toBe(journalRecovered);

    const replay = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review');
    expectExit(replay, 0, 'REVIEW_RECOVERY_REPLAYED');
    expect(replay.envelope.state!.reviewContext.recoveryId).toBe(recovered.envelope.state!.reviewContext.recoveryId);
    expect(await journalBytes(root, changeId)).toBe(journalRecovered);

    expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', oldReceipt), 5, 'CONFLICT');
    const accepted = await reviewReceipt(root, recovered.envelope.state!.reviewContext);
    expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', accepted), 0, 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED');
    const done = cli(root, 'status', '--change', changeId);
    expectExit(done, 0, 'STATUS');
    expect(done.envelope.state!.tasks['task-a'].state).toBe('done');
    expect(done.envelope.state!.tasks['task-b'].state).toBe('ready');
    expect(done.envelope.state!.tasks['task-c'].state).toBe('ready');
    expect(done.envelope.state!.leases['task-a'].active).toBe(false);
    const afterDone = await journalBytes(root, changeId);
    expectExit(cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review'), 7, 'BLOCKED');
    expect(await journalBytes(root, changeId)).toBe(afterDone);
  }, 60_000);

  test('fences every pre-epoch or mismatched review receipt, then records exactly one remediation failure and next generation', async () => {
    const root = await fixture();
    const changeId = 'review-epoch-reject';
    const { before, recovered } = await recoverExpired(root, changeId);
    const recoveredContext = recovered.state!.reviewContext as Record<string, unknown>;
    const journalAfterRecovery = await journalBytes(root, changeId);

    const preEpoch = await reviewReceipt(root, before.reviewContext);
    const wrongEpoch = await reviewReceipt(root, recoveredContext, { recoveryId: 'wrong-recovery-id' });
    const predatingEpoch = await reviewReceipt(root, recoveredContext, { timestamp: new Date(Date.now() - 60_000).toISOString() });
    for (const path of [preEpoch, wrongEpoch, predatingEpoch]) {
      expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', path), 5, 'CONFLICT');
      expect(await journalBytes(root, changeId)).toBe(journalAfterRecovery);
    }

    const rejected = await reviewReceipt(root, recoveredContext, { verdict: 'reject', findingsHash: hash('one real finding') });
    expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', rejected), 0, 'REVIEW_REJECTED');
    const remediating = cli(root, 'status', '--change', changeId);
    expectExit(remediating, 0, 'STATUS');
    expect(remediating.envelope.state!.tasks['task-a'].state).toBe('remediation');
    expect(remediating.envelope.state!.tasks['task-c'].state).toBe('pending');
    expect(remediating.envelope.state!.attempts['task-a']).toMatchObject({ consumed: 1, nextKind: 'remediation' });
    expect(remediating.envelope.state!.leases['task-a'].active).toBe(false);
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-a'), 0, 'CLAIMED');
    const retried = cli(root, 'status', '--change', changeId);
    expectExit(retried, 0, 'STATUS');
    expect(retried.envelope.state!.run.lease.generation).toBe((before.run.lease.generation as number) + 1);
    expect(retried.envelope.state!.attempts['task-a']).toMatchObject({ consumed: 1, nextKind: 'remediation' });
  }, 60_000);

  test('refuses an expired recovery when its current source, specification, task plan, Gate registry, or Gate evidence drifted', async () => {
    const variants = [
      ['code', 'src/candidate.ts', 'export const candidate = false;\n'],
      ['specification', 'approved-spec.md', '# Drifted specification\n'],
      ['task projection', 'tasks-projection', 'schemaVersion: 1\ntasks: []\n'],
      ['Gate registry', 'core/gates/default.yaml', '# changed Gate registry source\n'],
    ] as const;
    const subjects = await Promise.all(variants.map(async ([name], index) => ({ name, root: await fixture(), changeId: `drift-${index}` })));
    await Promise.all(subjects.map(async (subject) => submittedCandidate(subject.root, subject.changeId)));
    // Re-read subjects with their completed submission state without relying on a synthetic expiration.
    const submitted = await Promise.all(subjects.map(async (subject) => ({
      ...subject,
      state: cli(subject.root, 'status', '--change', subject.changeId).envelope.state!,
    })));
    await Promise.all(submitted.map(({ state }) => waitUntilExpired(state.run.lease.expiresAt as string)));
    for (const [index, subject] of submitted.entries()) {
      const [, target, contents] = variants[index]!;
      const path = target === 'tasks-projection' ? `.leo-dev/changes/${subject.changeId}/tasks.yaml` : target;
      if (target === 'core/gates/default.yaml') await writeFile(join(subject.root, path), `${await readFile(join(subject.root, path), 'utf8')}${contents}`);
      else await writeFile(join(subject.root, path), contents);
      await expectRecoveryRefusalWithoutWrite(subject.root, subject.changeId);
    }

    const evidenceRoot = await fixture();
    const evidenceChange = 'drift-evidence';
    const evidenceState = await submittedCandidate(evidenceRoot, evidenceChange);
    await waitUntilExpired(evidenceState!.run.lease.expiresAt as string);
    const raw = await journalBytes(evidenceRoot, evidenceChange);
    const gateResult = raw.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, any>)
      .flatMap((event) => event.payload?.operations ?? [])
      .find((operation: Record<string, any>) => operation.type === 'controller.gate.result');
    expect(gateResult?.payload?.evidenceRef).toEqual(expect.any(String));
    await writeFile(resolve(evidenceRoot, gateResult!.payload.evidenceRef as string), '{"tampered":true}\n');
    await expectRecoveryRefusalWithoutWrite(evidenceRoot, evidenceChange);
  }, 100_000);

  test('refuses unknown, wrong-task, and in-flight recovery requests without admitting an executable', async () => {
    const root = await fixture();
    const changeId = 'recovery-admission-fences';
    const state = await submittedCandidate(root, changeId);
    await waitUntilExpired(state!.run.lease.expiresAt as string);
    await expectRecoveryRefusalWithoutWrite(root, changeId, 'task-b');
    await expectRecoveryRefusalWithoutWrite(root, changeId, 'unknown-task');

    const inflightRoot = await fixture();
    const inflightChange = 'inflight-gate';
    await advanceToExecuting(inflightRoot, inflightChange);
    expectExit(cli(inflightRoot, 'claim', '--change', inflightChange, '--task', 'task-a', '--ttl', '15000'), 0, 'CLAIMED');
    const inflightBefore = await journalBytes(inflightRoot, inflightChange);
    expectExit(cli(inflightRoot, 'resume', '--change', inflightChange, '--task', 'task-a', '--recover-review'), 7, 'BLOCKED');
    expect(await journalBytes(inflightRoot, inflightChange)).toBe(inflightBefore);
  }, 60_000);

  test.each(['after-batch-prepared', 'after-batch-projection'] as const)('keeps a %s recovery batch pending for dry-run refusal and resumes its original recovery ID', async (faultAt) => {
    const root = await fixture();
    const changeId = `pending-${faultAt}`;
    const before = await submittedCandidate(root, changeId);
    await waitUntilExpired(before!.run.lease.expiresAt as string);
    const lateReceipt = await reviewReceipt(root, before!.reviewContext);
    await expect(new Controller().execute('resume', {
      repo: root, change: changeId, task: 'task-a', recoverReview: true, faultAt,
    })).rejects.toMatchObject({ exitCode: 9, publicCode: 'INTERNAL_ERROR' });
    const pending = await journalBytes(root, changeId);
    const pendingOperation = recoveryOperations(pending);
    expect(pendingOperation).toHaveLength(1);
    const recoveryId = pendingOperation[0]!.payload.recoveryId;
    expect(recoveryId).toEqual(expect.any(String));

    expectExit(cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review', '--dry-run'), 7, 'BLOCKED');
    expect(await journalBytes(root, changeId)).toBe(pending);
    const recovered = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review');
    expectExit(recovered, 0, 'REVIEW_RECOVERY_REPLAYED');
    expect(recovered.envelope.state!.reviewContext.recoveryId).toBe(recoveryId);
    expect(recoveryOperations(await journalBytes(root, changeId))).toHaveLength(1);
    expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', lateReceipt), 5, 'CONFLICT');
  }, 60_000);

  test('fails closed on direct, forged committed, and duplicate committed recovery contexts', async () => {
    const directRoot = await fixture();
    const directChange = 'direct-recovery-context';
    const directState = await submittedCandidate(directRoot, directChange);
    await waitUntilExpired(directState!.run.lease.expiresAt as string);
    await new Journal(journalPath(directRoot, directChange)).append({
      changeId: directChange, taskId: 'task-a', taskRevision: 1, leaseGeneration: 1,
      type: 'controller.review.recovered', payload: { recoveryId: 'direct-not-batched' },
    });
    expectExit(cli(directRoot, 'resume', '--change', directChange, '--task', 'task-a', '--recover-review'), 7, 'BLOCKED');

    const forgedRoot = await fixture();
    const forgedChange = 'forged-recovery-context';
    const forgedState = await submittedCandidate(forgedRoot, forgedChange);
    await waitUntilExpired(forgedState!.run.lease.expiresAt as string);
    const forgedJournal = new Journal(journalPath(forgedRoot, forgedChange));
    await commitControllerBatch({
      repositoryRoot: forgedRoot, changeId: forgedChange, journal: forgedJournal,
      priorEvents: (await forgedJournal.replayStrict()).events, kind: 'expired-review-recovery',
      operations: [{ type: 'controller.review.recovered', taskId: 'task-a', taskRevision: 1, leaseGeneration: 1,
        payload: { schemaVersion: 1, recoveryId: 'forged-context' } }],
    });
    expectExit(cli(forgedRoot, 'resume', '--change', forgedChange, '--task', 'task-a', '--recover-review'), 7, 'BLOCKED');

    const duplicateRoot = await fixture();
    const duplicateChange = 'duplicate-recovery-context';
    await recoverExpired(duplicateRoot, duplicateChange);
    const duplicateJournal = new Journal(journalPath(duplicateRoot, duplicateChange));
    const original = recoveryOperations(await journalBytes(duplicateRoot, duplicateChange));
    expect(original).toHaveLength(1);
    await commitControllerBatch({
      repositoryRoot: duplicateRoot, changeId: duplicateChange, journal: duplicateJournal,
      priorEvents: (await duplicateJournal.replayStrict()).events, kind: 'expired-review-recovery',
      operations: [structuredClone(original[0]!)],
    });
    expectExit(cli(duplicateRoot, 'resume', '--change', duplicateChange, '--task', 'task-a', '--recover-review'), 7, 'BLOCKED');
  }, 100_000);

  test('lets two concurrent public recovery CLIs converge on one durable epoch and preserves the serial writer fence', async () => {
    const root = await fixture();
    const changeId = 'concurrent-public-recovery';
    const before = await submittedCandidate(root, changeId);
    await waitUntilExpired(before!.run.lease.expiresAt as string);
    const [first, second] = await Promise.all([
      cliAsync(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review'),
      cliAsync(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review'),
    ]);
    for (const result of [first, second]) expect(result.stderr).toBe('');
    expect([first.envelope.code, second.envelope.code].filter((code) => code === 'REVIEW_RECOVERED')).toHaveLength(1);
    expect([first.envelope.code, second.envelope.code].every((code) => ['REVIEW_RECOVERED', 'REVIEW_RECOVERY_REPLAYED', 'CONFLICT'].includes(code))).toBe(true);
    const journal = await journalBytes(root, changeId);
    const operations = recoveryOperations(journal);
    expect(operations).toHaveLength(1);
    const id = operations[0]!.payload.recoveryId;
    const converged = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review');
    expectExit(converged, 0, 'REVIEW_RECOVERY_REPLAYED');
    expect(converged.envelope.state!.reviewContext.recoveryId).toBe(id);
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-b'), 5, 'CONFLICT');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', before!.run.runId), 7, 'BLOCKED');
  }, 60_000);

  test('binds a replacement submitted candidate to a new recovery epoch and never reuses an obsolete receipt epoch', async () => {
    const root = await fixture();
    const changeId = 'second-candidate-epoch';
    const first = await recoverExpired(root, changeId);
    const oldEpochReceipt = await reviewReceipt(root, first.recovered.state!.reviewContext);
    const rejectFirst = await reviewReceipt(root, first.recovered.state!.reviewContext, { verdict: 'reject', findingsHash: hash('first rejection') });
    expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', rejectFirst), 0, 'REVIEW_REJECTED');

    const secondClaim = cli(root, 'claim', '--change', changeId, '--task', 'task-a', '--ttl', '15000');
    expectExit(secondClaim, 0, 'CLAIMED');
    const secondRunId = secondClaim.envelope.state!.run.runId as string;
    expect(secondClaim.envelope.state!.run.lease.generation).toBe((first.before.run.lease.generation as number) + 1);
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', secondRunId), 0, 'GATES_PASSED');
    expectExit(cli(root, 'submit', '--change', changeId, '--task', 'task-a'), 0, 'SUBMITTED_FOR_REVIEW');
    const secondSubmitted = cli(root, 'status', '--change', changeId);
    expectExit(secondSubmitted, 0, 'STATUS');
    await waitUntilExpired(secondSubmitted.envelope.state!.run.lease.expiresAt as string);
    const second = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review');
    expectExit(second, 0, 'REVIEW_RECOVERED');
    expect(second.envelope.state!.reviewContext.recoveryId).not.toBe(first.recovered.state!.reviewContext.recoveryId);
    expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', oldEpochReceipt), 5, 'CONFLICT');
  }, 120_000);

  test('consumes one recovered pass receipt once under concurrent public review and unlocks successors once', async () => {
    const root = await fixture();
    const changeId = 'concurrent-recovered-review';
    const { recovered } = await recoverExpired(root, changeId);
    const accepted = await reviewReceipt(root, recovered.state!.reviewContext);
    const acceptedReceiptId = JSON.parse(await readFile(accepted, 'utf8')).receiptId;
    const [first, second] = await Promise.all([
      cliAsync(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', accepted),
      cliAsync(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', accepted),
    ]);
    expect([first.envelope.code, second.envelope.code].filter((code) => code === 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED')).toHaveLength(1);
    expect([first.envelope.code, second.envelope.code].every((code) => ['LITE_REVIEW_ACCEPTED_UNAUTHENTICATED', 'CONFLICT', 'BLOCKED'].includes(code))).toBe(true);
    const state = cli(root, 'status', '--change', changeId);
    expectExit(state, 0, 'STATUS');
    expect(state.envelope.state!.tasks['task-a'].state).toBe('done');
    expect(state.envelope.state!.tasks['task-c'].state).toBe('ready');
    expect(state.envelope.state!.attempts['task-a']).toMatchObject({ consumed: 0 });
    const logical = projectJournalEvents((await new Journal(journalPath(root, changeId)).replayStrict()).events).events;
    expect(logical.filter((event) => event.type === 'receipt.review.ingested' && (event.payload as Record<string, any>).receipt?.receiptId === acceptedReceiptId)).toHaveLength(1);
    expect(logical.filter((event) => event.type === 'task.transition' && event.taskId === 'task-c' && (event.payload as Record<string, unknown>).to === 'ready')).toHaveLength(1);
  }, 60_000);

  test('refuses recovery from a real Gate-induced unknown Run and from an explicitly released original lease', async () => {
    const unknownRoot = await fixture('missing');
    const unknownChange = 'real-gate-unknown';
    await advanceToExecuting(unknownRoot, unknownChange);
    const claimed = cli(unknownRoot, 'claim', '--change', unknownChange, '--task', 'task-a');
    expectExit(claimed, 0, 'CLAIMED');
    const gatePreview = cli(unknownRoot, 'run-gates', '--change', unknownChange, '--task', 'task-a', '--dry-run');
    expectExit(gatePreview, 0, 'DRY_RUN');
    const approval = await gateApprovalReceipt(unknownRoot, gatePreview.envelope.state!.gateApprovalContext);
    expectExit(cli(unknownRoot, 'run-gates', '--change', unknownChange, '--task', 'task-a', '--approval-receipt', approval), 7, 'BLOCKED');
    const unknownStatus = cli(unknownRoot, 'status', '--change', unknownChange);
    expectExit(unknownStatus, 0, 'STATUS');
    expect(unknownStatus.envelope.state!.runs[claimed.envelope.state!.run.runId].state).toBe('unknown');
    const unknownBefore = await journalBytes(unknownRoot, unknownChange);
    expectExit(cli(unknownRoot, 'resume', '--change', unknownChange, '--task', 'task-a', '--recover-review'), 7, 'BLOCKED');
    expect(await journalBytes(unknownRoot, unknownChange)).toBe(unknownBefore);

    const releasedRoot = await fixture();
    const releasedChange = 'released-review-lease';
    const submitted = await submittedCandidate(releasedRoot, releasedChange);
    await waitUntilExpired(submitted!.run.lease.expiresAt as string);
    const releaseJournal = new Journal(journalPath(releasedRoot, releasedChange));
    await releaseJournal.append({ changeId: releasedChange, taskId: 'task-a', taskRevision: 1, leaseGeneration: submitted!.run.lease.generation as number,
      type: 'lease.released', payload: { lease: submitted!.run.lease, reason: 'TEST-ONLY explicit released-lease mutation' } });
    const releasedBefore = await journalBytes(releasedRoot, releasedChange);
    expectExit(cli(releasedRoot, 'resume', '--change', releasedChange, '--task', 'task-a', '--recover-review'), 7, 'BLOCKED');
    expect(await journalBytes(releasedRoot, releasedChange)).toBe(releasedBefore);
  }, 60_000);
});
