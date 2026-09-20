import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';
import { afterEach, describe, expect, test } from 'vitest';
import { Controller } from '../../packages/cli/src/controller/controller.js';
import { GateRunner } from '../../packages/cli/src/gates/runner.js';
import { GateRegistry } from '../../packages/cli/src/gates/registry.js';
import { canonicalTreeHash } from '../../packages/cli/src/repository/tree-hash.js';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { projectJournalEvents } from '../../packages/cli/src/state/snapshot.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = process.env.LEO_DEV_CANDIDATE_TEST_CLI
  ? resolve(process.env.LEO_DEV_CANDIDATE_TEST_CLI)
  : join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const issuedAt = () => new Date(Date.now() - 60_000).toISOString();
const expiresAt = () => new Date(Date.now() + 60 * 60_000).toISOString();
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

type Envelope = {
  ok: boolean;
  code: string;
  state: Record<string, unknown> | null;
  errors: Array<{ code: string; message: string }>;
  evidenceRefs: string[];
};

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], {
    cwd: repository,
    encoding: 'utf8',
    timeout: 20_000,
    killSignal: 'SIGKILL',
  });
  expect(result.error, `CLI timed out or could not start: ${result.error?.message ?? 'unknown error'}`).toBeUndefined();
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  expect(lines, `stdout=${result.stdout}\nstderr=${result.stderr}`).toHaveLength(1);
  expect(result.stderr).toBe('');
  return { status: result.status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope };
}

function expectExit(result: ReturnType<typeof cli>, status: number, code: string): void {
  expect(result.status, JSON.stringify(result.envelope)).toBe(status);
  expect(result.envelope.ok).toBe(status === 0);
  expect(result.envelope.code).toBe(code);
}

async function fixture(gate: 'pass' | 'missing' = 'pass'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-candidate-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({
    gates: [{
      id: gate,
      argv: gate === 'missing' ? ['/definitely/missing/leo-dev-candidate-gate'] : [process.execPath, '-e', 'process.exit(0)'],
      cwd: '.', timeoutSeconds: 10,
      required: true, replaySafety: 'pure', effectClass: 'local-verification', network: gate === 'missing' ? 'approval-required' : 'deny',
      environmentAllowlist: [], declaredWritePaths: [],
    }],
  }));
  await writeFile(join(root, 'approved-spec.md'), '# Synthetic candidate-test specification\n');
  await mkdir(join(root, 'notes'), { recursive: true });
  await writeFile(join(root, 'notes/sentinel.txt'), 'sentinel bytes must survive every refusal\n');
  await writeFile(join(root, 'notes/outside.txt'), 'outside baseline content\n');
  await writeFile(join(root, 'notes/remove-me.txt'), 'removal baseline content\n');
  await writeFile(join(root, 'task-plan.json'), JSON.stringify({
    schemaVersion: 1,
    tasks: [{
      id: 'task-a', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/candidate.ts'],
      acceptance: ['Synthetic candidate test passes'], gateIds: [gate], risk: 'lite',
    }],
  }));
  return root;
}

async function receipt(name: string, value: unknown): Promise<string> {
  const path = join(tmpdir(), `leo-dev-candidate-${name}-${Date.now()}-${Math.random()}.json`);
  temporary.push(path);
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function runMissingGate(root: string, changeId: string): Promise<ReturnType<typeof cli>> {
  const preview = cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--dry-run');
  expectExit(preview, 0, 'DRY_RUN');
  const { runId: _runId, gateId: _gateId, taskRevision: _taskRevision, leaseGeneration: _leaseGeneration, ...context } = preview.envelope.state!.gateApprovalContext as Record<string, unknown>;
  const approval = await receipt(`gate-approval-${changeId}`, {
    receiptId: `test-only-gate-approval-${changeId}`,
    provenance: 'human-confirmed',
    actorLabel: 'TEST-ONLY fixture gate approval; issuer not authenticated',
    decision: 'grant',
    grantedAt: issuedAt(),
    expiresAt: expiresAt(),
    scope: 'gate',
    operationKind: 'gate-run',
    ...context,
  });
  return cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--approval-receipt', approval);
}

async function advanceToExecuting(root: string, changeId: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'task-plan.json'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  const status = cli(root, 'status', '--change', changeId);
  const approvalContext = (status.envelope.state as { approvalContext: Record<string, unknown> }).approvalContext;
  const approval = await receipt(`approval-${changeId}`, {
    receiptId: `test-only-approval-${changeId}`,
    provenance: 'human-confirmed',
    actorLabel: 'TEST-ONLY synthetic fixture approval; not production authority',
    decision: 'grant',
    grantedAt: issuedAt(),
    expiresAt: expiresAt(),
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

async function claimChangedCandidate(root: string, changeId: string): Promise<string> {
  const claimed = cli(root, 'claim', '--change', changeId, '--task', 'task-a');
  expectExit(claimed, 0, 'CLAIMED');
  const runId = ((claimed.envelope.state as { run: { runId: string } }).run).runId;
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src/candidate.ts'), 'export const candidate = true;\n');
  return runId;
}

async function registerCandidateThenStop(root: string, changeId: string, runId: string): Promise<void> {
  await expect(new Controller().execute('run-gates', {
    repo: root,
    change: changeId,
    task: 'task-a',
    run: runId,
    faultAt: 'after-batch-prepared',
  })).rejects.toMatchObject({ exitCode: 9, publicCode: 'INTERNAL_ERROR' });
  expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
}

async function logicalEvents(root: string, changeId: string) {
  const replay = await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).replayStrict();
  return projectJournalEvents(replay.events).events;
}

async function rewriteAsHistoricalPreRegistrationUnknown(root: string, changeId: string): Promise<void> {
  const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const raw = (await new Journal(journalPath).replayStrict()).events;
  await writeFile(journalPath, '');
  const journal = new Journal(journalPath);
  const remappedHashes = new Map<string, string>();

  for (let index = 0; index < raw.length; index += 1) {
    const source = raw[index]!;
    const payload = structuredClone(source.payload) as Record<string, unknown>;
    if (source.type === 'controller.batch.prepared' && payload.kind === 'candidate-registration') {
      const commit = raw[index + 1];
      if (commit?.type !== 'controller.batch.committed') throw new Error('candidate registration fixture is not a committed batch');
      index += 1;
      continue;
    }
    if (source.type === 'controller.batch.prepared') {
      const operations = Array.isArray(payload.operations) ? payload.operations as Record<string, unknown>[] : [];
      for (const operation of operations) {
        const operationPayload = operation.payload as Record<string, unknown> | undefined;
        if (operation.type === 'run.claimed' && operationPayload) delete operationPayload.inputEntries;
        if (operation.type === 'run.unknown.context' && Array.isArray(operationPayload?.evidenceHashes)) {
          operationPayload.evidenceHashes = operationPayload.evidenceHashes.map((value) => remappedHashes.get(String(value)) ?? value);
        }
      }
    }
    for (const field of ['preparedEventHash', 'startedEventHash', 'releasedEventHash', 'priorEventHash']) {
      const value = payload[field];
      if (typeof value === 'string' && remappedHashes.has(value)) payload[field] = remappedHashes.get(value)!;
    }
    if (source.type === 'controller.batch.committed' && typeof payload.preparedEventHash === 'string') {
      payload.preparedEventHash = remappedHashes.get(payload.preparedEventHash) ?? payload.preparedEventHash;
    }
    const appended = await journal.append({
      changeId: source.changeId,
      ...(source.taskId === undefined ? {} : { taskId: source.taskId }),
      ...(source.taskRevision === undefined ? {} : { taskRevision: source.taskRevision }),
      ...(source.leaseGeneration === undefined ? {} : { leaseGeneration: source.leaseGeneration }),
      type: source.type,
      payload,
    });
    remappedHashes.set(source.eventHash, appended.eventHash);
  }

  const historical = projectJournalEvents((await journal.replayStrict()).events).events;
  expect(historical.filter((event) => event.type === 'controller.candidate.registered')).toHaveLength(0);
  const claim = historical.find((event) => event.type === 'run.claimed');
  expect((claim?.payload as Record<string, unknown> | undefined)?.inputEntries).toBeUndefined();
}

type ScopeMutation = {
  label: string;
  expectedMessage: string;
  mutate(root: string): Promise<void>;
  assertPreserved(root: string): Promise<void>;
};

const scopeMutations: ScopeMutation[] = [
  {
    label: 'outside addition',
    expectedMessage: 'outside the task allowed paths',
    async mutate(root) { await writeFile(join(root, 'notes/added.txt'), 'outside addition remains after refusal\n'); },
    async assertPreserved(root) { expect(await readFile(join(root, 'notes/added.txt'), 'utf8')).toBe('outside addition remains after refusal\n'); },
  },
  {
    label: 'outside removal',
    expectedMessage: 'outside the task allowed paths',
    async mutate(root) { await rm(join(root, 'notes/remove-me.txt')); },
    async assertPreserved(root) { await expect(readFile(join(root, 'notes/remove-me.txt'))).rejects.toMatchObject({ code: 'ENOENT' }); },
  },
  {
    label: 'outside content change',
    expectedMessage: 'outside the task allowed paths',
    async mutate(root) { await writeFile(join(root, 'notes/outside.txt'), 'changed outside content remains after refusal\n'); },
    async assertPreserved(root) { expect(await readFile(join(root, 'notes/outside.txt'), 'utf8')).toBe('changed outside content remains after refusal\n'); },
  },
  {
    label: 'outside mode change',
    expectedMessage: 'outside the task allowed paths',
    async mutate(root) { await chmod(join(root, 'notes/outside.txt'), 0o755); },
    async assertPreserved(root) { expect((await lstat(join(root, 'notes/outside.txt'))).mode & 0o777).toBe(0o755); },
  },
  {
    label: 'protected specification change',
    expectedMessage: 'specification source has drifted',
    async mutate(root) { await writeFile(join(root, 'approved-spec.md'), '# Mutated protected specification remains after refusal\n'); },
    async assertPreserved(root) { expect(await readFile(join(root, 'approved-spec.md'), 'utf8')).toContain('Mutated protected specification'); },
  },
  {
    label: 'protected Gate registry change',
    expectedMessage: 'protected controller/spec/Gate binding',
    async mutate(root) { await writeFile(join(root, 'core/gates/default.yaml'), `${await readFile(join(root, 'core/gates/default.yaml'), 'utf8')}# protected mutation remains\n`); },
    async assertPreserved(root) { expect(await readFile(join(root, 'core/gates/default.yaml'), 'utf8')).toContain('# protected mutation remains'); },
  },
];

async function settleCandidateOutsideController(root: string, changeId: string, runId: string): Promise<void> {
  const status = cli(root, 'status', '--change', changeId).envelope.state as {
    route: { gateDefinitionHash: string };
    run: { lease: { taskRevision: number; generation: number } };
  };
  const registry = await GateRegistry.fromYaml(join(root, 'core/gates/default.yaml'));
  await new GateRunner().run({
    repositoryRoot: root,
    registry,
    gateId: 'pass',
    expectedInputTreeHash: (await canonicalTreeHash(root)).hash,
    expectedGateDefinitionHash: status.route.gateDefinitionHash,
    runId,
    changeId,
    taskId: 'task-a',
    taskRevision: status.run.lease.taskRevision,
    leaseGeneration: status.run.lease.generation,
    maxOutputBytes: 64 * 1024,
  });
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('Codex C2 candidate handoff regressions', () => {
  // Mutant caught: pending settlement recovery uses the Lease input instead of the registered changed candidate.
  test('dry-runs and idempotently resumes a changed candidate whose Gate terminal became durable before handoff', async () => {
    const root = await fixture();
    const changeId = 'changed-terminal-handoff';
    await advanceToExecuting(root, changeId);
    const runId = await claimChangedCandidate(root, changeId);
    await registerCandidateThenStop(root, changeId, runId);
    await settleCandidateOutsideController(root, changeId, runId);
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    const beforeDryRun = await readFile(journalPath, 'utf8');

    const dryRun = cli(root, 'resume', '--change', changeId, '--dry-run');

    expectExit(dryRun, 0, 'DRY_RUN');
    expect(dryRun.envelope.state).toMatchObject({ plannedRecovery: true, writes: [] });
    expect(await readFile(journalPath, 'utf8')).toBe(beforeDryRun);

    const resumed = cli(root, 'resume', '--change', changeId);
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ tasks: { 'task-a': { state: 'verifying' } } });
    const afterFirstResume = await readFile(journalPath, 'utf8');
    expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
    expect(await readFile(journalPath, 'utf8')).toBe(afterFirstResume);

    const events = await logicalEvents(root, changeId);
    expect(events.filter((event) => event.type === 'controller.candidate.registered')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'gate.attempt.prepared')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'controller.gate.result')).toHaveLength(1);
  }, 60_000);

  // Mutant caught: an idempotent existing registration bypasses the explicit changed-output Run identity check.
  test('requires the same explicit Run after candidate registration and never duplicates the registration', async () => {
    const root = await fixture();
    const changeId = 'registered-retry-run';
    await advanceToExecuting(root, changeId);
    const runId = await claimChangedCandidate(root, changeId);
    await registerCandidateThenStop(root, changeId, runId);
    const beforeUnidentifiedRetry = await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8');

    const unidentified = cli(root, 'run-gates', '--change', changeId, '--task', 'task-a');

    expectExit(unidentified, 5, 'CONFLICT');
    expect(unidentified.envelope.errors[0]?.message).toContain('explicit matching --run');
    expect(await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8')).toBe(beforeUnidentifiedRetry);

    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', runId), 0, 'GATES_PASSED');
    const events = await logicalEvents(root, changeId);
    expect(events.filter((event) => event.type === 'controller.candidate.registered')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'gate.attempt.prepared')).toHaveLength(1);
  }, 60_000);

  test.each(scopeMutations)('refuses a $label without undoing that user-tree mutation', async ({ expectedMessage, mutate, assertPreserved }) => {
    const root = await fixture();
    const changeId = `scope-${scopeMutations.findIndex((entry) => entry.mutate === mutate)}`;
    await advanceToExecuting(root, changeId);
    const claimed = cli(root, 'claim', '--change', changeId, '--task', 'task-a');
    expectExit(claimed, 0, 'CLAIMED');
    const runId = (claimed.envelope.state as { run: { runId: string } }).run.runId;
    await mutate(root);

    const refused = cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', runId);

    expectExit(refused, 5, 'CONFLICT');
    expect(refused.envelope.errors[0]?.message).toContain(expectedMessage);
    await assertPreserved(root);
    expect(await readFile(join(root, 'notes/sentinel.txt'), 'utf8')).toBe('sentinel bytes must survive every refusal\n');
    const events = await logicalEvents(root, changeId);
    expect(events.filter((event) => event.type === 'controller.candidate.registered')).toHaveLength(0);
    expect(events.filter((event) => event.type === 'gate.attempt.prepared')).toHaveLength(0);
  }, 60_000);

  // Mutant caught: dry-run skips the active lease expiry fence that actual run-gates enforces.
  test('applies the same expired-lease refusal in dry-run and actual run-gates without writes', async () => {
    const root = await fixture();
    const changeId = 'expired-lease-parity';
    await advanceToExecuting(root, changeId);
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-a', '--ttl', '1'), 0, 'CLAIMED');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    const before = await readFile(journalPath, 'utf8');

    const dryRun = cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--dry-run');
    expectExit(dryRun, 5, 'CONFLICT');
    expect(dryRun.envelope.errors[0]?.message).toContain('lease binding is stale');
    expect(await readFile(journalPath, 'utf8')).toBe(before);

    const actual = cli(root, 'run-gates', '--change', changeId, '--task', 'task-a');
    expectExit(actual, 5, 'CONFLICT');
    expect(actual.envelope.errors[0]?.message).toContain('lease binding is stale');
    expect(await readFile(journalPath, 'utf8')).toBe(before);
  }, 60_000);

  // This is a real missing-executable Gate followed by a TEST-ONLY declared
  // reconciliation, not a successful Gate or an authenticated human decision.
  test('refuses expired review recovery for a reconciliation-only submitted candidate without changing its history', async () => {
    const root = await fixture('missing');
    const changeId = 'expired-reconciliation-only';
    await advanceToExecuting(root, changeId);
    const claim = cli(root, 'claim', '--change', changeId, '--task', 'task-a', '--ttl', '15000');
    expectExit(claim, 0, 'CLAIMED');
    const originalLease = (claim.envelope.state as { run: { lease: { expiresAt: string } } }).run.lease;
    expectExit(await runMissingGate(root, changeId), 7, 'BLOCKED');
    const unknown = cli(root, 'status', '--change', changeId);
    expectExit(unknown, 0, 'STATUS');
    const context = (unknown.envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const reconciliation = await receipt(`reconciliation-${changeId}`, {
      receiptId: `test-only-reconciliation-${changeId}`,
      runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision,
      leaseGeneration: context.leaseGeneration, operationFingerprint: context.operationFingerprint,
      inputTreeHash: context.inputTreeHash, evidenceHashes: context.evidenceHashes,
      resolvedRunState: 'succeeded', sideEffectDisposition: 'completed', safeToRetry: false,
      provenance: 'human-confirmed', actorLabel: 'TEST-ONLY reconciliation claim; not production authority',
      timestamp: issuedAt(), expiresAt: expiresAt(),
    });
    expectExit(cli(root, 'reconcile', '--change', changeId, '--receipt', reconciliation), 0, 'RUN_RECONCILED_UNAUTHENTICATED');
    const submitted = cli(root, 'submit', '--change', changeId, '--task', 'task-a');
    expectExit(submitted, 0, 'SUBMITTED_FOR_REVIEW');
    expect(submitted.envelope.state).toMatchObject({
      changeState: 'executing', tasks: { 'task-a': { state: 'review-required' } },
      runs: { [String(context.runId)]: { state: 'succeeded' } },
    });
    const events = await logicalEvents(root, changeId);
    expect(events.filter((event) => event.type === 'controller.candidate.registered')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'controller.submit.accepted')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'gate.attempt.settled')).toHaveLength(0);
    await new Promise((resolveWait) => setTimeout(resolveWait, Math.max(0, Date.parse(originalLease.expiresAt) - Date.now() + 30)));
    const runtime = join(root, `.leo-dev/runtime/${changeId}`);
    const before = await Promise.all(['journal.ndjson', 'snapshot.json'].map((name) => readFile(join(runtime, name), 'utf8')));
    for (const flags of [['--dry-run'], []]) {
      expectExit(cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review', ...flags), 7, 'BLOCKED');
      expect(await Promise.all(['journal.ndjson', 'snapshot.json'].map((name) => readFile(join(runtime, name), 'utf8')))).toEqual(before);
    }
  }, 60_000);

  // Mutant caught: successful reconciliation submits a historical Run without creating the durable candidate review requires.
  test('reconciles, submits, and reviews an unchanged historical pre-registration unknown Run without stranding it', async () => {
    const root = await fixture('missing');
    const changeId = 'historical-unknown-success';
    await advanceToExecuting(root, changeId);
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-a'), 0, 'CLAIMED');
    expectExit(await runMissingGate(root, changeId), 7, 'BLOCKED');
    await rewriteAsHistoricalPreRegistrationUnknown(root, changeId);

    const historicalStatus = cli(root, 'status', '--change', changeId);
    expectExit(historicalStatus, 0, 'STATUS');
    const context = (historicalStatus.envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const reconciliation = await receipt(`reconciliation-${changeId}`, {
      receiptId: `test-only-reconciliation-${changeId}`,
      runId: context.runId,
      taskId: context.taskId,
      taskRevision: context.taskRevision,
      leaseGeneration: context.leaseGeneration,
      operationFingerprint: context.operationFingerprint,
      inputTreeHash: context.inputTreeHash,
      evidenceHashes: context.evidenceHashes,
      resolvedRunState: 'succeeded',
      sideEffectDisposition: 'completed',
      safeToRetry: false,
      provenance: 'human-confirmed',
      actorLabel: 'TEST-ONLY synthetic reconciliation; not production authority',
      timestamp: issuedAt(),
      expiresAt: expiresAt(),
    });
    expectExit(cli(root, 'reconcile', '--change', changeId, '--receipt', reconciliation), 0, 'RUN_RECONCILED_UNAUTHENTICATED');
    expectExit(cli(root, 'submit', '--change', changeId, '--task', 'task-a'), 0, 'SUBMITTED_FOR_REVIEW');
    const submitted = cli(root, 'status', '--change', changeId);
    expectExit(submitted, 0, 'STATUS');
    const reviewContext = (submitted.envelope.state as { reviewContext: Record<string, unknown> }).reviewContext;
    const review = await receipt(`review-${changeId}`, {
      receiptId: `test-only-review-${changeId}`,
      provenance: 'platform-attested',
      actorLabel: 'TEST-ONLY synthetic reviewer; issuer not authenticated',
      sessionId: 'test-only-historical-review-session',
      ...reviewContext,
      findingsHash: digest('no findings in synthetic historical compatibility fixture'),
      verdict: 'pass',
      timestamp: issuedAt(),
      expiresAt: expiresAt(),
    });

    const reviewed = cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', review);

    expectExit(reviewed, 0, 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED');
    expect(reviewed.envelope.state).toMatchObject({
      changeState: 'integration-review',
      tasks: { 'task-a': { state: 'done' } },
      leases: { 'task-a': { active: false } },
    });
    const events = await logicalEvents(root, changeId);
    const candidates = events.filter((event) => event.type === 'controller.candidate.registered');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.payload).toMatchObject({
      runId: context.runId,
      taskId: context.taskId,
      taskRevision: context.taskRevision,
      leaseGeneration: context.leaseGeneration,
      claimInputTreeHash: context.inputTreeHash,
      treeHash: context.inputTreeHash,
      specHash: reviewContext.specHash,
      taskHash: reviewContext.taskHash,
    });
  }, 60_000);
});
