import { createHash, randomUUID } from 'node:crypto';
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, test } from 'vitest';
import YAML from 'yaml';
import { Journal } from '../../packages/cli/src/state/journal.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const receiptTimestamp = new Date(Date.now() - 60_000).toISOString();
const receiptExpiry = new Date(Date.now() + 60 * 60_000).toISOString();

interface Envelope {
  ok: boolean;
  code: string;
  state: unknown;
  errors: Array<{ code: string; message: string }>;
  evidenceRefs: string[];
}

async function fixture(gates = ['pass']): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-cli-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  const definitions = gates.map((id) => ({
    id,
    argv: id === 'missing' ? ['/definitely/missing/leo-dev-gate'] : [process.execPath, '-e', id === 'fail' ? 'process.exit(11)' : id === 'secret' ? 'process.stdout.write("password=abcdefghijkl")' : 'process.exit(0)'],
    cwd: '.',
    timeoutSeconds: 10,
    required: true,
    replaySafety: 'pure',
    effectClass: 'local-verification',
    network: 'deny',
    environmentAllowlist: [],
    declaredWritePaths: [],
  }));
  await writeFile(join(root, 'core/gates/default.yaml'), `gates:\n${definitions.map((gate) => [
    `  - id: ${gate.id}`,
    `    argv: [${gate.argv.map((item) => JSON.stringify(item)).join(', ')}]`,
    '    cwd: .',
    '    timeoutSeconds: 10',
    '    required: true',
    '    replaySafety: pure',
    '    effectClass: local-verification',
    '    network: deny',
    '    environmentAllowlist: []',
    '    declaredWritePaths: []',
  ].join('\n')).join('\n')}\n`);
  await writeFile(join(root, 'approved-spec.md'), '# Approved fixture specification\n');
  return root;
}

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, CODEX_SANDBOX: 'seatbelt', CODEX_SANDBOX_NETWORK_DISABLED: '1' },
  });
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  expect(lines, `stdout=${result.stdout}\nstderr=${result.stderr}`).toHaveLength(1);
  const envelope = JSON.parse(lines[0]!) as Envelope;
  expect(Object.keys(envelope).sort()).toEqual(['code', 'errors', 'evidenceRefs', 'ok', 'state']);
  expect(Array.isArray(envelope.errors)).toBe(true);
  expect(Array.isArray(envelope.evidenceRefs)).toBe(true);
  expect(result.stderr).toBe('');
  return { status: result.status ?? 9, envelope, stdout: result.stdout, stderr: result.stderr };
}

async function receiptFile(value: unknown): Promise<string> {
  const path = join(tmpdir(), `leo-dev-receipt-${randomUUID()}.json`);
  temporary.push(path);
  await writeFile(path, JSON.stringify(value));
  return path;
}

/** Synthetic legacy fixture: a hash-linked unknown prefix stopped after prepare, before argv release. */
async function omitReleasedPhase(root: string, changeId: string): Promise<void> {
  const path = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const raw = (await new Journal(path).replayStrict()).events;
  await writeFile(path, '');
  const journal = new Journal(path);
  const remapped = new Map<string, string>();
  const omitted = new Set<string>();
  for (const source of raw) {
    if (source.type === 'gate.attempt.released') { omitted.add(source.eventHash); continue; }
    const payload = structuredClone(source.payload) as Record<string, unknown>;
    if (source.type === 'controller.batch.prepared') {
      const operations = Array.isArray(payload.operations) ? payload.operations as Array<Record<string, unknown>> : [];
      for (const operation of operations) if (operation.type === 'run.unknown.context') {
        const context = operation.payload as Record<string, unknown>;
        if (Array.isArray(context.evidenceHashes)) context.evidenceHashes = context.evidenceHashes.filter((value) => !omitted.has(String(value))).map((value) => remapped.get(String(value)) ?? value);
      }
    }
    for (const field of ['preparedEventHash', 'startedEventHash', 'releasedEventHash', 'priorEventHash']) if (typeof payload[field] === 'string' && remapped.has(payload[field] as string)) payload[field] = remapped.get(payload[field] as string)!;
    if (source.type === 'controller.batch.committed' && typeof payload.preparedEventHash === 'string') payload.preparedEventHash = remapped.get(payload.preparedEventHash) ?? payload.preparedEventHash;
    const appended = await journal.append({ changeId: source.changeId, ...(source.taskId === undefined ? {} : { taskId: source.taskId }), ...(source.taskRevision === undefined ? {} : { taskRevision: source.taskRevision }), ...(source.leaseGeneration === undefined ? {} : { leaseGeneration: source.leaseGeneration }), type: source.type, payload });
    remapped.set(source.eventHash, appended.eventHash);
  }
}

async function reviewReceipt(context: Record<string, unknown>, overrides: Record<string, unknown> = {}): Promise<string> {
  return receiptFile({
    receiptId: `review-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'label only; issuer not authenticated',
    sessionId: `session-${randomUUID()}`, runId: context.runId, taskId: context.taskId,
    taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration,
    specHash: context.specHash, taskHash: context.taskHash, treeHash: context.treeHash,
    findingsHash: hash('no findings'), verdict: 'pass', timestamp: receiptTimestamp,
    expiresAt: receiptExpiry, ...overrides,
  });
}

async function reconciliationReceipt(context: Record<string, unknown>, overrides: Record<string, unknown> = {}): Promise<string> {
  return receiptFile({
    receiptId: `reconciliation-${randomUUID()}`, runId: context.runId, taskId: context.taskId,
    taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration,
    operationFingerprint: context.operationFingerprint, inputTreeHash: context.inputTreeHash,
    evidenceHashes: context.evidenceHashes, resolvedRunState: 'succeeded', sideEffectDisposition: 'completed',
    safeToRetry: false, provenance: 'human-confirmed', actorLabel: 'label only; issuer not authenticated',
    timestamp: receiptTimestamp, expiresAt: receiptExpiry, ...overrides,
  });
}

async function treeDigest(root: string): Promise<string> {
  const entries: string[] = [];
  async function visit(path: string, relative = ''): Promise<void> {
    for (const name of (await readdir(path)).sort()) {
      const absolute = join(path, name);
      const rel = relative ? `${relative}/${name}` : name;
      const info = await stat(absolute);
      if (info.isDirectory()) await visit(absolute, rel);
      else entries.push(`${rel}:${hash(await readFile(absolute, 'utf8'))}`);
    }
  }
  await visit(root);
  return hash(entries.join('\n'));
}

async function injectPreparedGate(root: string, changeId: string, includePartialStarted: boolean): Promise<string> {
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const raw = await readFile(journal, 'utf8');
  const prior = JSON.parse(raw.trim().split('\n').at(-1)!) as Record<string, unknown>;
  const payload = { attemptId: `fault-${changeId}` };
  const framed: Record<string, unknown> = {
    sequence: Number(prior.sequence) + 1, previousEventHash: prior.eventHash,
    changeId, taskId: 'task-1', taskRevision: 1, leaseGeneration: 1,
    type: 'gate.attempt.prepared', timestamp: new Date().toISOString(), payloadHash: hash(JSON.stringify(payload)), payload,
  };
  const hashFrame = { ...framed };
  delete hashFrame.payload;
  framed.eventHash = hash(JSON.stringify(hashFrame));
  const faulted = `${raw}${JSON.stringify(framed)}\n${includePartialStarted ? '{"type":"gate.attempt.started"' : ''}`;
  await writeFile(journal, faulted);
  return faulted;
}

async function materializeLegacyDirectJournal(root: string, changeId: string): Promise<void> {
  const path = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const frames = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
  const logical: Array<Record<string, unknown>> = [];
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!;
    if (frame.type === 'controller.batch.prepared') {
      const commit = frames[index + 1];
      if (commit?.type !== 'controller.batch.committed') throw new Error('fixture expected committed batch');
      logical.push(...((frame.payload as { operations: Array<Record<string, unknown>> }).operations));
      index += 1;
    } else if (frame.type !== 'controller.batch.committed') logical.push(frame);
  }
  await rm(path);
  const journal = new Journal(path);
  for (const event of logical) await journal.append({
    changeId,
    ...(typeof event.taskId === 'string' ? { taskId: event.taskId } : {}),
    ...(typeof event.taskRevision === 'number' ? { taskRevision: event.taskRevision } : {}),
    ...(typeof event.leaseGeneration === 'number' ? { leaseGeneration: event.leaseGeneration } : {}),
    type: String(event.type),
    payload: event.payload,
  });
}

function expectExit(result: ReturnType<typeof cli>, exit: number, code?: string): void {
  expect(result.status, JSON.stringify(result.envelope)).toBe(exit);
  expect(result.envelope.ok).toBe(exit === 0);
  if (code) expect(result.envelope.code).toBe(code);
}

async function approveSpec(root: string, changeId: string): Promise<void> {
  const status = cli(root, 'status', '--change', changeId);
  const context = (status.envelope.state as { approvalContext: Record<string, string> }).approvalContext;
  const receipt = await receiptFile({
    receiptId: `approval-${changeId}`,
    provenance: 'human-confirmed',
    actorLabel: 'Fixture reviewer (label only; issuer not authenticated)',
    decision: 'grant',
    grantedAt: receiptTimestamp,
    expiresAt: receiptExpiry,
    changeId,
    scope: 'change',
    operationKind: 'spec-approval',
    ...context,
  });
  const approved = cli(root, 'approve', '--change', changeId, '--receipt', receipt);
  expectExit(approved, 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
}

async function advanceToExecuting(root: string, changeId = 'change', gate = 'pass'): Promise<void> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0);
  expectExit(cli(root, 'route', '--change', changeId, '--task', 'task-1', '--gate', gate), 0);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'discovery'), 0);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-review'), 0);
  await approveSpec(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 0);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 0);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing'), 0);
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('compiled public CLI contract', () => {
  test('registers the public lifecycle, observation and team commands and converts help to one JSON envelope', async () => {
    const root = await fixture();
    const result = cli(root, '--help');
    expectExit(result, 0, 'HELP');
    expect((result.envelope.state as { commands: string[] }).commands).toEqual([
      'init', 'inspect', 'observe', 'board', 'route', 'start', 'commit', 'revise', 'status', 'transition', 'claim', 'run-gates', 'submit',
      'review', 'approve', 'waive', 'resolve', 'reconcile', 'resume', 'team', 'doctor',
    ]);
  });

  test('doctor distinguishes passed prerequisites from client and Node 20 checks that were not run', async () => {
    const root = await fixture();
    const doctor = cli(root, 'doctor');
    expectExit(doctor, 0, 'DOCTOR_OK');
    const state = doctor.envelope.state as { hostNode: string; checks: Array<{ name: string; ok: boolean | null }> };
    expect(state.checks.find((check) => check.name === 'client-loading')?.ok).toBeNull();
    expect(state.checks.find((check) => check.name === 'node20-runtime')?.ok).toBe(state.hostNode.startsWith('v20.') ? true : null);
  });

  test('converts Commander parse failures to the same single JSON envelope', async () => {
    const root = await fixture();
    expectExit(cli(root, 'route'), 2, 'VALIDATION_ERROR');
    expectExit(cli(root, 'not-a-command'), 2, 'VALIDATION_ERROR');
  });

  test('runs the real Lite serial vertical slice to Task done and Change integration-review', async () => {
    const root = await fixture();
    const changeId = 'lite-change';
    expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
    expectExit(cli(root, 'inspect', '--change', changeId), 0, 'INSPECTED');
    expectExit(cli(root, 'route', '--change', changeId, '--task', 'task-1', '--gate', 'pass'), 0, 'ROUTED_LITE');
    for (const state of ['discovery', 'spec-review']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0);
    await approveSpec(root, changeId);
    for (const state of ['spec-approved', 'task-ready', 'executing']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0);
    const claimed = cli(root, 'claim', '--change', changeId, '--task', 'task-1', '--ttl', '600000');
    expectExit(claimed, 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 0, 'GATES_PASSED');
    expectExit(cli(root, 'submit', '--change', changeId, '--task', 'task-1'), 0, 'SUBMITTED_FOR_REVIEW');
    const status = cli(root, 'status', '--change', changeId);
    const review = (status.envelope.state as { reviewContext: Record<string, unknown> }).reviewContext;
    const receipt = await receiptFile({
      receiptId: 'self-review', provenance: 'human-confirmed',
      actorLabel: 'CLI fixture self-review (label only; issuer not authenticated)',
      sessionId: 'fixture-session', runId: review.runId, taskId: review.taskId,
      taskRevision: review.taskRevision, leaseGeneration: review.leaseGeneration,
      specHash: review.specHash, taskHash: review.taskHash, treeHash: review.treeHash,
      findingsHash: hash('no findings'), verdict: 'pass',
      timestamp: receiptTimestamp, expiresAt: receiptExpiry,
    });
    const reviewed = cli(root, 'review', '--change', changeId, '--task', 'task-1', '--receipt', receipt);
    expectExit(reviewed, 0, 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED');
    expect(reviewed.envelope.state).toMatchObject({ changeState: 'integration-review', tasks: { 'task-1': { state: 'done' } } });
    expect(reviewed.envelope.evidenceRefs.length).toBeGreaterThan(0);
    const reviewFrames = (await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as { type: string; payload: { kind?: string; operations?: Array<{ type: string }> } });
    const reviewBatch = reviewFrames.findLast((frame) => frame.type === 'controller.batch.prepared' && frame.payload.kind === 'review');
    expect(reviewBatch?.payload.operations?.map((event) => event.type)).toEqual(['receipt.review.ingested', 'task.transition', 'task.transition', 'lease.released', 'change.transition']);
  }, 20_000);

  test('repairs one crash-truncated journal tail and rebuilds the snapshot on resume', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'resume-change');
    const journal = join(root, '.leo-dev/runtime/resume-change/journal.ndjson');
    const snapshot = join(root, '.leo-dev/runtime/resume-change/snapshot.json');
    await writeFile(journal, '{"incomplete":', { flag: 'a' });
    await rm(snapshot, { force: true });
    const beforeDryResume = await readFile(journal, 'utf8');
    const dryResume = cli(root, 'resume', '--change', 'resume-change', '--dry-run');
    expectExit(dryResume, 0, 'DRY_RUN');
    expect(dryResume.envelope.state).toMatchObject({ plannedRecovery: true, writes: [] });
    expect(await readFile(journal, 'utf8')).toBe(beforeDryResume);
    const resumed = cli(root, 'resume', '--change', 'resume-change');
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ changeState: 'executing', discardedIncompleteTail: true });
    expect(JSON.parse(await readFile(snapshot, 'utf8'))).toMatchObject({ state: { changeState: 'executing' } });
  }, 20_000);

  test('rejects review after the submitted Gate-bound candidate tree drifts, even if status is queried after drift', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'review-drift');
    expectExit(cli(root, 'claim', '--change', 'review-drift', '--task', 'task-1'), 0);
    expectExit(cli(root, 'run-gates', '--change', 'review-drift', '--task', 'task-1'), 0);
    expectExit(cli(root, 'submit', '--change', 'review-drift', '--task', 'task-1'), 0);
    await writeFile(join(root, 'post-submit-drift.txt'), 'drift');
    const status = cli(root, 'status', '--change', 'review-drift');
    const context = (status.envelope.state as { reviewContext: Record<string, unknown> }).reviewContext;
    const receipt = await reviewReceipt(context);
    const before = await treeDigest(root);
    expectExit(cli(root, 'review', '--change', 'review-drift', '--task', 'task-1', '--receipt', receipt, '--dry-run'), 5, 'CONFLICT');
    expect(await treeDigest(root)).toBe(before);
    expectExit(cli(root, 'review', '--change', 'review-drift', '--task', 'task-1', '--receipt', receipt), 5, 'CONFLICT');
  }, 20_000);

  test('receipt ingestion never repairs or appends after an incomplete Gate journal tail', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'receipt-tail');
    expectExit(cli(root, 'claim', '--change', 'receipt-tail', '--task', 'task-1'), 0);
    const journal = join(root, '.leo-dev/runtime/receipt-tail/journal.ndjson');
    const faulted = await injectPreparedGate(root, 'receipt-tail', true);
    const receipt = await receiptFile({ receiptId: 'tail-approval', provenance: 'human-confirmed', actorLabel: 'tail', decision: 'grant', grantedAt: receiptTimestamp, expiresAt: receiptExpiry, changeId: 'receipt-tail', scope: 'change', operationKind: 'spec-approval', decisionFingerprint: 'a'.repeat(64), gateDefinitionFingerprint: 'b'.repeat(64), argvFingerprint: 'c'.repeat(64), cwdFingerprint: 'd'.repeat(64), environmentFingerprint: 'e'.repeat(64), inputFingerprint: 'f'.repeat(64) });
    expectExit(cli(root, 'approve', '--change', 'receipt-tail', '--receipt', receipt), 7, 'BLOCKED');
    expect(await readFile(journal, 'utf8')).toBe(faulted);
  }, 20_000);

  test('safe abandoned reconciliation from a prepared-but-never-released Gate fences the old lease and leaves the next normal claim usable', async () => {
    const root = await fixture(['missing']);
    await advanceToExecuting(root, 'safe-retry', 'missing');
    const first = cli(root, 'claim', '--change', 'safe-retry', '--task', 'task-1');
    expectExit(first, 0);
    const firstGeneration = Number(((first.envelope.state as { run: { lease: { generation: number } } }).run.lease.generation));
    expectExit(cli(root, 'run-gates', '--change', 'safe-retry', '--task', 'task-1'), 7, 'BLOCKED');
    await omitReleasedPhase(root, 'safe-retry');
    const unknown = cli(root, 'status', '--change', 'safe-retry');
    const context = (unknown.envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const receipt = await reconciliationReceipt(context, { resolvedRunState: 'abandoned', sideEffectDisposition: 'not-started', safeToRetry: true });
    const reconciled = cli(root, 'reconcile', '--change', 'safe-retry', '--receipt', receipt);
    expectExit(reconciled, 0, 'RUN_RECONCILED_UNAUTHENTICATED');
    expect(reconciled.envelope.state).toMatchObject({ changeState: 'executing', tasks: { 'task-1': { state: 'ready' } }, leases: { 'task-1': { active: false } } });
    const reconciliationFrames = (await readFile(join(root, '.leo-dev/runtime/safe-retry/journal.ndjson'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as { type: string; payload: { kind?: string; operations?: Array<{ type: string }> } });
    const reconciliationBatch = reconciliationFrames.findLast((frame) => frame.type === 'controller.batch.prepared' && frame.payload.kind === 'reconcile');
    expect(reconciliationBatch?.payload.operations?.map((event) => event.type)).toEqual(['lease.abandoned', 'receipt.reconciliation.ingested', 'run.transition', 'task.transition', 'change.transition']);
    const next = cli(root, 'claim', '--change', 'safe-retry', '--task', 'task-1');
    expectExit(next, 0, 'CLAIMED');
    expect(Number(((next.envelope.state as { run: { lease: { generation: number } } }).run.lease.generation))).toBeGreaterThan(firstGeneration);
  }, 20_000);

  test('dry-run and actual review reject the same wrong task hash, and dry route rejects a duplicate route', async () => {
    const root = await fixture();
    expectExit(cli(root, 'init', '--change', 'dry-binding', '--spec', 'approved-spec.md'), 0);
    expectExit(cli(root, 'route', '--change', 'dry-binding', '--task', 'task-1', '--gate', 'pass'), 0);
    const routeBytes = await treeDigest(root);
    expectExit(cli(root, 'route', '--change', 'dry-binding', '--task', 'task-1', '--gate', 'pass', '--dry-run'), 5, 'CONFLICT');
    expect(await treeDigest(root)).toBe(routeBytes);
    for (const state of ['discovery', 'spec-review']) expectExit(cli(root, 'transition', '--change', 'dry-binding', '--scope', 'change', '--to', state), 0);
    await approveSpec(root, 'dry-binding');
    for (const state of ['spec-approved', 'task-ready', 'executing']) expectExit(cli(root, 'transition', '--change', 'dry-binding', '--scope', 'change', '--to', state), 0);
    expectExit(cli(root, 'claim', '--change', 'dry-binding', '--task', 'task-1'), 0);
    expectExit(cli(root, 'run-gates', '--change', 'dry-binding', '--task', 'task-1'), 0);
    await writeFile(join(root, 'pre-submit-drift.txt'), 'drift before submit');
    const beforeStaleSubmit = await treeDigest(root);
    expectExit(cli(root, 'submit', '--change', 'dry-binding', '--task', 'task-1', '--dry-run'), 5, 'CONFLICT');
    expect(await treeDigest(root)).toBe(beforeStaleSubmit);
    expectExit(cli(root, 'submit', '--change', 'dry-binding', '--task', 'task-1'), 5, 'CONFLICT');
    await rm(join(root, 'pre-submit-drift.txt'));
    expectExit(cli(root, 'submit', '--change', 'dry-binding', '--task', 'task-1'), 0);
    const status = cli(root, 'status', '--change', 'dry-binding');
    const context = (status.envelope.state as { reviewContext: Record<string, unknown> }).reviewContext;
    const receipt = await reviewReceipt(context, { taskHash: '0'.repeat(64) });
    const before = await treeDigest(root);
    expectExit(cli(root, 'review', '--change', 'dry-binding', '--task', 'task-1', '--receipt', receipt, '--dry-run'), 5, 'CONFLICT');
    expect(await treeDigest(root)).toBe(before);
    expectExit(cli(root, 'review', '--change', 'dry-binding', '--task', 'task-1', '--receipt', receipt), 5, 'CONFLICT');
  }, 20_000);

  test('durably maps a thrown Gate indeterminate error to unknown/blocked/approval-required and keeps reconciliation reachable', async () => {
    const root = await fixture(['missing']);
    await advanceToExecuting(root, 'thrown-unknown', 'missing');
    expectExit(cli(root, 'claim', '--change', 'thrown-unknown', '--task', 'task-1'), 0);
    const result = cli(root, 'run-gates', '--change', 'thrown-unknown', '--task', 'task-1');
    expectExit(result, 7, 'BLOCKED');
    expect(result.envelope.state).toMatchObject({ changeState: 'approval-required', tasks: { 'task-1': { state: 'blocked' } } });
    const runtime = join(root, '.leo-dev/runtime/thrown-unknown');
    const beforeObservation = { bytes: await readFile(join(runtime, 'journal.ndjson')), directory: await lstat(runtime, { bigint: true }) };
    const observed = cli(root, 'observe', '--change', 'thrown-unknown');
    expectExit(observed, 0, 'OBSERVATION');
    expect(observed.envelope.state).toMatchObject({ availability: 'available', change: { state: 'approval-required' } });
    const afterObservation = { bytes: await readFile(join(runtime, 'journal.ndjson')), directory: await lstat(runtime, { bigint: true }) };
    expect(afterObservation.bytes).toEqual(beforeObservation.bytes);
    expect(afterObservation.directory.mtimeNs).toBe(beforeObservation.directory.mtimeNs);
    expect(afterObservation.directory.ctimeNs).toBe(beforeObservation.directory.ctimeNs);
    const status = cli(root, 'status', '--change', 'thrown-unknown');
    expect(status.envelope.state).toMatchObject({ changeState: 'approval-required', tasks: { 'task-1': { state: 'blocked' } } });
    const context = (status.envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    expect(context).toMatchObject({ taskId: 'task-1', resumeTaskStateOnSuccess: 'verifying', priorChangeState: 'executing' });
    const journal = await readFile(join(root, '.leo-dev/runtime/thrown-unknown/journal.ndjson'), 'utf8');
    expect(journal).toContain('gate.attempt.prepared');
    expect(journal).not.toContain('gate.attempt.settled');
    const receipt = await reconciliationReceipt(context);
    expectExit(cli(root, 'reconcile', '--change', 'thrown-unknown', '--receipt', receipt), 0, 'RUN_RECONCILED_UNAUTHENTICATED');
  }, 20_000);

  test('never truncates an incomplete Gate lifecycle from status, run-gates, or resume', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'gate-crash');
    expectExit(cli(root, 'claim', '--change', 'gate-crash', '--task', 'task-1'), 0);
    const journal = join(root, '.leo-dev/runtime/gate-crash/journal.ndjson');
    const faulted = await injectPreparedGate(root, 'gate-crash', true);
    for (const args of [
      ['status', '--change', 'gate-crash'],
      ['run-gates', '--change', 'gate-crash', '--task', 'task-1'],
      ['resume', '--change', 'gate-crash'],
    ]) {
      expectExit(cli(root, ...args), 7, 'BLOCKED');
      expect(await readFile(journal, 'utf8')).toBe(faulted);
    }

    const cleanRoot = await fixture();
    await advanceToExecuting(cleanRoot, 'clean-gate-crash');
    expectExit(cli(cleanRoot, 'claim', '--change', 'clean-gate-crash', '--task', 'task-1'), 0);
    const cleanJournal = join(cleanRoot, '.leo-dev/runtime/clean-gate-crash/journal.ndjson');
    const cleanPrepared = await injectPreparedGate(cleanRoot, 'clean-gate-crash', false);
    expectExit(cli(cleanRoot, 'resume', '--change', 'clean-gate-crash'), 7, 'BLOCKED');
    expect(await readFile(cleanJournal, 'utf8')).toBe(cleanPrepared);
  }, 20_000);

  test('uses the recorded unique Run-unknown mapping for reconciliation receipts', async () => {
    const root = await fixture(['secret']);
    await advanceToExecuting(root, 'unknown-change', 'secret');
    expectExit(cli(root, 'claim', '--change', 'unknown-change', '--task', 'task-1'), 0);
    const unknown = cli(root, 'run-gates', '--change', 'unknown-change', '--task', 'task-1');
    expectExit(unknown, 7, 'BLOCKED');
    expect(unknown.envelope.state).toMatchObject({ changeState: 'approval-required', tasks: { 'task-1': { state: 'blocked' } } });
    const status = cli(root, 'status', '--change', 'unknown-change');
    const context = (status.envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const mismatch = await receiptFile({
      receiptId: 'unknown-mismatch', runId: context.runId, taskId: context.taskId,
      taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration,
      operationFingerprint: '0'.repeat(64), inputTreeHash: context.inputTreeHash,
      evidenceHashes: context.evidenceHashes, resolvedRunState: 'succeeded',
      sideEffectDisposition: 'completed', safeToRetry: false,
      provenance: 'human-confirmed', actorLabel: 'mismatch label',
      timestamp: receiptTimestamp, expiresAt: receiptExpiry,
    });
    const beforeMismatch = await treeDigest(root);
    expectExit(cli(root, 'reconcile', '--change', 'unknown-change', '--receipt', mismatch, '--dry-run'), 5, 'CONFLICT');
    expect(await treeDigest(root)).toBe(beforeMismatch);
    expectExit(cli(root, 'reconcile', '--change', 'unknown-change', '--receipt', mismatch), 5, 'CONFLICT');
    const receipt = await receiptFile({
      receiptId: 'unknown-success', runId: context.runId, taskId: context.taskId,
      taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration,
      operationFingerprint: context.operationFingerprint, inputTreeHash: context.inputTreeHash,
      evidenceHashes: context.evidenceHashes, resolvedRunState: 'succeeded',
      sideEffectDisposition: 'completed', safeToRetry: false,
      provenance: 'human-confirmed', actorLabel: 'label only; issuer not authenticated',
      timestamp: receiptTimestamp, expiresAt: receiptExpiry,
    });
    const reconciled = cli(root, 'reconcile', '--change', 'unknown-change', '--receipt', receipt);
    expectExit(reconciled, 0, 'RUN_RECONCILED_UNAUTHENTICATED');
    expect(reconciled.envelope.state).toMatchObject({ changeState: 'executing', tasks: { 'task-1': { state: 'verifying' } }, runs: { [String(context.runId)]: { state: 'succeeded' } } });
    expectExit(cli(root, 'submit', '--change', 'unknown-change', '--task', 'task-1'), 0, 'SUBMITTED_FOR_REVIEW');
    const reviewStatus = cli(root, 'status', '--change', 'unknown-change');
    const review = (reviewStatus.envelope.state as { reviewContext: Record<string, unknown> }).reviewContext;
    const reviewReceipt = await receiptFile({
      receiptId: 'reconciled-review', provenance: 'human-confirmed', actorLabel: 'reconciled labelled self-review',
      sessionId: 'reconciled-session', runId: review.runId, taskId: review.taskId,
      taskRevision: review.taskRevision, leaseGeneration: review.leaseGeneration,
      specHash: review.specHash, taskHash: review.taskHash, treeHash: review.treeHash,
      findingsHash: hash('reconciled no findings'), verdict: 'pass',
      timestamp: receiptTimestamp, expiresAt: receiptExpiry,
    });
    const completed = cli(root, 'review', '--change', 'unknown-change', '--task', 'task-1', '--receipt', reviewReceipt);
    expectExit(completed, 0, 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED');
    expect(completed.envelope.state).toMatchObject({ changeState: 'integration-review', tasks: { 'task-1': { state: 'done' } } });
  }, 20_000);

  test('maps an unsafe abandoned unknown Run to abandoned/blocked/approval-required', async () => {
    const root = await fixture(['secret']);
    await advanceToExecuting(root, 'unsafe-change', 'secret');
    expectExit(cli(root, 'claim', '--change', 'unsafe-change', '--task', 'task-1'), 0);
    expectExit(cli(root, 'run-gates', '--change', 'unsafe-change', '--task', 'task-1'), 7, 'BLOCKED');
    const status = cli(root, 'status', '--change', 'unsafe-change');
    const context = (status.envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const receipt = await receiptFile({
      receiptId: 'unknown-abandoned-unsafe', runId: context.runId, taskId: context.taskId,
      taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration,
      operationFingerprint: context.operationFingerprint, inputTreeHash: context.inputTreeHash,
      evidenceHashes: context.evidenceHashes, resolvedRunState: 'abandoned',
      sideEffectDisposition: 'side-effects-unknown', safeToRetry: false,
      provenance: 'human-confirmed', actorLabel: 'unsafe disposition label',
      timestamp: receiptTimestamp, expiresAt: receiptExpiry,
    });
    const reconciled = cli(root, 'reconcile', '--change', 'unsafe-change', '--receipt', receipt);
    expectExit(reconciled, 0, 'RUN_RECONCILED_UNAUTHENTICATED');
    expect(reconciled.envelope.state).toMatchObject({ changeState: 'approval-required', tasks: { 'task-1': { state: 'blocked' } }, runs: { [String(context.runId)]: { state: 'abandoned' } } });
  }, 20_000);

  test('all state-changing commands accept dry-run and perform zero writes', async () => {
    const root = await fixture();
    expectExit(cli(root, 'init', '--change', 'dry-init', '--spec', 'approved-spec.md', '--dry-run'), 0, 'DRY_RUN');
    expect(await stat(join(root, '.leo-dev')).catch(() => undefined)).toBeUndefined();

    await advanceToExecuting(root, 'dry-change');
    expectExit(cli(root, 'claim', '--change', 'dry-change', '--task', 'task-1'), 0);
    expectExit(cli(root, 'run-gates', '--change', 'dry-change', '--task', 'task-1'), 0);
    const beforeDrySubmit = await treeDigest(root);
    expectExit(cli(root, 'submit', '--change', 'dry-change', '--task', 'task-1', '--dry-run'), 0, 'DRY_RUN');
    expect(await treeDigest(root)).toBe(beforeDrySubmit);
    expectExit(cli(root, 'submit', '--change', 'dry-change', '--task', 'task-1'), 0);
    const status = cli(root, 'status', '--change', 'dry-change');
    const reviewContext = (status.envelope.state as { reviewContext: Record<string, unknown> }).reviewContext;
    const review = await receiptFile({ receiptId: 'dry-review', provenance: 'human-confirmed', actorLabel: 'dry labelled reviewer', sessionId: 'dry-session', runId: reviewContext.runId, taskId: reviewContext.taskId, taskRevision: reviewContext.taskRevision, leaseGeneration: reviewContext.leaseGeneration, specHash: reviewContext.specHash, taskHash: reviewContext.taskHash, treeHash: reviewContext.treeHash, findingsHash: hash('dry'), verdict: 'pass', timestamp: receiptTimestamp, expiresAt: receiptExpiry });
    const validApproval = await receiptFile({ receiptId: 'dry-approval', provenance: 'human-confirmed', actorLabel: 'dry', decision: 'grant', grantedAt: receiptTimestamp, expiresAt: receiptExpiry, changeId: 'dry-change', scope: 'change', operationKind: 'spec-approval', decisionFingerprint: 'a'.repeat(64), gateDefinitionFingerprint: 'b'.repeat(64), argvFingerprint: 'c'.repeat(64), cwdFingerprint: 'd'.repeat(64), environmentFingerprint: 'e'.repeat(64), inputFingerprint: 'f'.repeat(64) });
    const waiver = await receiptFile({ receiptId: 'dry-waiver', provenance: 'human-confirmed', actorLabel: 'dry', scope: 'change', changeId: 'dry-change', risk: 'lite', waivedRequirements: ['optional-review-detail'], timestamp: receiptTimestamp, expiresAt: receiptExpiry });
    const resolution = await receiptFile({ receiptId: 'dry-resolution', blockerId: 'dry-blocker', provenance: 'human-confirmed', actorLabel: 'dry', decision: 'resume', scope: 'change', changeId: 'dry-change', artifactHashes: ['a'.repeat(64)], targetRecoveryState: 'executing', timestamp: receiptTimestamp, expiresAt: receiptExpiry });
    const reconciliation = await receiptFile({ receiptId: 'dry-reconcile', runId: 'dry-run', taskId: 'task-1', taskRevision: 1, leaseGeneration: 1, operationFingerprint: 'a'.repeat(64), inputTreeHash: 'b'.repeat(64), evidenceHashes: ['c'.repeat(64)], resolvedRunState: 'abandoned', sideEffectDisposition: 'not-started', safeToRetry: true, provenance: 'human-confirmed', actorLabel: 'dry', timestamp: receiptTimestamp, expiresAt: receiptExpiry });
    const before = await treeDigest(root);
    const commands = [
      ['route', '--change', 'dry-change', '--task', 'task-1', '--gate', 'pass'],
      ['transition', '--change', 'dry-change', '--scope', 'change', '--to', 'integration-review'],
      ['claim', '--change', 'dry-change', '--task', 'task-1'],
      ['run-gates', '--change', 'dry-change', '--task', 'task-1'],
      ['submit', '--change', 'dry-change', '--task', 'task-1'],
      ['review', '--change', 'dry-change', '--task', 'task-1', '--receipt', review],
      ['approve', '--change', 'dry-change', '--receipt', validApproval],
      ['waive', '--change', 'dry-change', '--receipt', waiver],
      ['resolve', '--change', 'dry-change', '--receipt', resolution],
      ['reconcile', '--change', 'dry-change', '--receipt', reconciliation],
      ['resume', '--change', 'dry-change'],
    ];
    for (const args of commands) {
      const result = cli(root, ...args, '--dry-run');
      expect([0, 2, 3, 5, 7]).toContain(result.status);
      expect(await treeDigest(root)).toBe(before);
    }
  }, 20_000);

  test('dry-run performs truthful read-only preflight for missing changes, unknown gates, forbidden transitions, and non-runnable gates', async () => {
    const root = await fixture();
    const beforeMissing = await treeDigest(root);
    expectExit(cli(root, 'route', '--change', 'missing', '--task', 'task-1', '--gate', 'pass', '--dry-run'), 8, 'PREREQUISITE_FAILED');
    expect(await treeDigest(root)).toBe(beforeMissing);
    expectExit(cli(root, 'init', '--change', 'preflight', '--spec', 'approved-spec.md'), 0);
    const before = await treeDigest(root);
    expectExit(cli(root, 'init', '--change', 'preflight', '--spec', 'approved-spec.md', '--dry-run'), 5, 'CONFLICT');
    expectExit(cli(root, 'route', '--change', 'preflight', '--task', 'task-1', '--gate', 'unknown', '--dry-run'), 2, 'VALIDATION_ERROR');
    expectExit(cli(root, 'transition', '--change', 'preflight', '--scope', 'change', '--to', 'archived', '--dry-run'), 3, 'TRANSITION_FORBIDDEN');
    expectExit(cli(root, 'run-gates', '--change', 'preflight', '--task', 'task-1', '--dry-run'), 7, 'BLOCKED');
    expect(await treeDigest(root)).toBe(before);
  });

  test('dry-run and actual claim share TTL validation and active serial lease conflict checks', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'claim-preflight');
    const beforeInvalid = await treeDigest(root);
    expectExit(cli(root, 'claim', '--change', 'claim-preflight', '--task', 'task-1', '--ttl', '0', '--dry-run'), 2, 'VALIDATION_ERROR');
    expectExit(cli(root, 'claim', '--change', 'claim-preflight', '--task', 'task-1', '--ttl', '0'), 2, 'VALIDATION_ERROR');
    expect(await treeDigest(root)).toBe(beforeInvalid);
    expectExit(cli(root, 'claim', '--change', 'claim-preflight', '--task', 'task-1'), 0, 'CLAIMED');
    const claimFrames = (await readFile(join(root, '.leo-dev/runtime/claim-preflight/journal.ndjson'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as { type: string; payload: { kind?: string; operations?: Array<{ type: string }> } });
    const claimBatch = claimFrames.findLast((frame) => frame.type === 'controller.batch.prepared' && frame.payload.kind === 'claim');
    expect(claimBatch?.payload.operations?.map((event) => event.type)).toEqual(['lease.claimed', 'task.transition', 'run.transition', 'run.transition', 'run.claimed', 'task.transition']);
    const beforeConflict = await treeDigest(root);
    expectExit(cli(root, 'claim', '--change', 'claim-preflight', '--task', 'task-1', '--dry-run'), 5, 'CONFLICT');
    expect(await treeDigest(root)).toBe(beforeConflict);
  }, 20_000);

  test('dry init shares source hashing and baseline capture failures with actual init without writing', async () => {
    const root = await fixture();
    await symlink('approved-spec.md', join(root, 'baseline-symlink'));
    const before = await treeDigest(root);
    expectExit(cli(root, 'init', '--change', 'baseline-dry', '--spec', 'approved-spec.md', '--dry-run'), 9, 'INTERNAL_ERROR');
    expect(await treeDigest(root)).toBe(before);
    expectExit(cli(root, 'init', '--change', 'baseline-real', '--spec', 'approved-spec.md'), 9, 'INTERNAL_ERROR');
    expect(await treeDigest(root)).toBe(before);
  }, 20_000);

  test('fails closed when referenced specification or routed task artifacts drift from their journal commitments', async () => {
    const sourceRoot = await fixture();
    expectExit(cli(sourceRoot, 'init', '--change', 'source-drift', '--spec', 'approved-spec.md'), 0);
    await writeFile(join(sourceRoot, 'approved-spec.md'), '# changed after initialization\n');
    expectExit(cli(sourceRoot, 'status', '--change', 'source-drift'), 5, 'CONFLICT');
    expectExit(cli(sourceRoot, 'inspect', '--change', 'source-drift'), 5, 'CONFLICT');

    const tasksRoot = await fixture();
    expectExit(cli(tasksRoot, 'init', '--change', 'tasks-drift', '--spec', 'approved-spec.md'), 0);
    expectExit(cli(tasksRoot, 'route', '--change', 'tasks-drift', '--task', 'task-1', '--gate', 'pass'), 0);
    await writeFile(join(tasksRoot, '.leo-dev/changes/tasks-drift/tasks.yaml'), YAML.stringify({ schemaVersion: 1, tasks: [] }));
    expectExit(cli(tasksRoot, 'status', '--change', 'tasks-drift'), 5, 'CONFLICT');
  }, 20_000);

  test('reconciles every committed manifest/spec field and derives unresolved-decision guards from artifacts', async () => {
    const unresolvedRoot = await fixture();
    expectExit(cli(unresolvedRoot, 'init', '--change', 'unresolved-drift', '--spec', 'approved-spec.md'), 0);
    expectExit(cli(unresolvedRoot, 'route', '--change', 'unresolved-drift', '--task', 'task-1', '--gate', 'pass'), 0);
    expectExit(cli(unresolvedRoot, 'transition', '--change', 'unresolved-drift', '--scope', 'change', '--to', 'discovery'), 0);
    const unresolvedManifest = join(unresolvedRoot, '.leo-dev/changes/unresolved-drift/manifest.yaml');
    const manifest = YAML.parse(await readFile(unresolvedManifest, 'utf8')) as Record<string, unknown>;
    await writeFile(unresolvedManifest, YAML.stringify({ ...manifest, unresolvedDecisions: ['material-choice'] }));
    expectExit(cli(unresolvedRoot, 'status', '--change', 'unresolved-drift'), 5, 'CONFLICT');
    expectExit(cli(unresolvedRoot, 'transition', '--change', 'unresolved-drift', '--scope', 'change', '--to', 'spec-review', '--dry-run'), 5, 'CONFLICT');
    expectExit(cli(unresolvedRoot, 'transition', '--change', 'unresolved-drift', '--scope', 'change', '--to', 'spec-review'), 5, 'CONFLICT');

    const approvalRoot = await fixture();
    expectExit(cli(approvalRoot, 'init', '--change', 'approval-fields', '--spec', 'approved-spec.md'), 0);
    const manifestPath = join(approvalRoot, '.leo-dev/changes/approval-fields/manifest.yaml');
    const specPath = join(approvalRoot, '.leo-dev/changes/approval-fields/spec.yaml');
    const fakeHash = 'a'.repeat(64);
    const manifestValue = YAML.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    const specValue = YAML.parse(await readFile(specPath, 'utf8')) as Record<string, unknown>;
    await writeFile(manifestPath, YAML.stringify({ ...manifestValue, approvalRef: 'receipt:forged', approvalHash: fakeHash }));
    await writeFile(specPath, YAML.stringify({ ...specValue, approvalRef: 'receipt:forged', approvalHash: fakeHash }));
    expectExit(cli(approvalRoot, 'inspect', '--change', 'approval-fields'), 5, 'CONFLICT');
  }, 20_000);

  test('does not let legacy direct journals bypass unresolved-decision or approval artifact coherence', async () => {
    const unresolvedRoot = await fixture();
    expectExit(cli(unresolvedRoot, 'init', '--change', 'legacy-unresolved', '--spec', 'approved-spec.md'), 0);
    await materializeLegacyDirectJournal(unresolvedRoot, 'legacy-unresolved');
    const unresolvedPath = join(unresolvedRoot, '.leo-dev/changes/legacy-unresolved/manifest.yaml');
    const unresolved = YAML.parse(await readFile(unresolvedPath, 'utf8')) as Record<string, unknown>;
    await writeFile(unresolvedPath, YAML.stringify({ ...unresolved, unresolvedDecisions: ['legacy-bypass'] }));
    expectExit(cli(unresolvedRoot, 'status', '--change', 'legacy-unresolved'), 5, 'CONFLICT');

    const approvalRoot = await fixture();
    expectExit(cli(approvalRoot, 'init', '--change', 'legacy-approval', '--spec', 'approved-spec.md'), 0);
    await materializeLegacyDirectJournal(approvalRoot, 'legacy-approval');
    for (const name of ['manifest.yaml', 'spec.yaml']) {
      const path = join(approvalRoot, `.leo-dev/changes/legacy-approval/${name}`);
      const value = YAML.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
      await writeFile(path, YAML.stringify({ ...value, approvalRef: 'receipt:forged', approvalHash: 'a'.repeat(64) }));
    }
    expectExit(cli(approvalRoot, 'inspect', '--change', 'legacy-approval'), 5, 'CONFLICT');
  }, 20_000);

  test('projects the consumed approval into manifest/spec and revalidates expiry at transition use time', async () => {
    const root = await fixture();
    const changeId = 'approval-use-time';
    expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0);
    expectExit(cli(root, 'route', '--change', changeId, '--task', 'task-1', '--gate', 'pass'), 0);
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'discovery'), 0);
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-review'), 0);
    const context = (cli(root, 'status', '--change', changeId).envelope.state as { approvalContext: Record<string, unknown> }).approvalContext;
    const expiry = Date.now() + 6_000;
    const approvalValue = { receiptId: 'short-approval', provenance: 'human-confirmed', actorLabel: 'short lived', decision: 'grant', grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(expiry).toISOString(), changeId, scope: 'change', operationKind: 'spec-approval', ...context };
    const approval = await receiptFile(approvalValue);
    expectExit(cli(root, 'approve', '--change', changeId, '--receipt', approval), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
    await delay(Math.max(0, expiry - Date.now() + 150));
    const beforeExpired = await treeDigest(root);
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved', '--dry-run'), 6, 'APPROVAL_REQUIRED');
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 6, 'APPROVAL_REQUIRED');
    expect(await treeDigest(root)).toBe(beforeExpired);

    const liveRoot = await fixture();
    await advanceToExecuting(liveRoot, 'approval-projected');
    const projectedManifest = YAML.parse(await readFile(join(liveRoot, '.leo-dev/changes/approval-projected/manifest.yaml'), 'utf8')) as Record<string, unknown>;
    const projectedSpec = YAML.parse(await readFile(join(liveRoot, '.leo-dev/changes/approval-projected/spec.yaml'), 'utf8')) as Record<string, unknown>;
    expect(projectedManifest.approvalRef).toBe('receipt:approval-approval-projected');
    expect(projectedManifest.approvalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(projectedSpec).toMatchObject({ approvalRef: projectedManifest.approvalRef, approvalHash: projectedManifest.approvalHash });
  }, 30_000);

  test('uses the same current gate-registry prerequisite for dry and actual task-ready transition', async () => {
    const root = await fixture();
    const changeId = 'transition-registry';
    expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0);
    expectExit(cli(root, 'route', '--change', changeId, '--task', 'task-1', '--gate', 'pass'), 0);
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'discovery'), 0);
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-review'), 0);
    await approveSpec(root, changeId);
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 0);
    await writeFile(join(root, 'core/gates/default.yaml'), 'gates: []\n');
    const before = await treeDigest(root);
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready', '--dry-run'), 5, 'CONFLICT');
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 5, 'CONFLICT');
    expect(await treeDigest(root)).toBe(before);
  }, 20_000);

  test('enforces a controller hard cap on Gate output while permitting callers to lower the limit', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'bounded-output');
    expectExit(cli(root, 'claim', '--change', 'bounded-output', '--task', 'task-1'), 0);
    const before = await treeDigest(root);
    expectExit(cli(root, 'run-gates', '--change', 'bounded-output', '--task', 'task-1', '--max-output-bytes', '65537', '--dry-run'), 2, 'VALIDATION_ERROR');
    expectExit(cli(root, 'run-gates', '--change', 'bounded-output', '--task', 'task-1', '--max-output-bytes', '65537'), 2, 'VALIDATION_ERROR');
    expect(await treeDigest(root)).toBe(before);
    expectExit(cli(root, 'run-gates', '--change', 'bounded-output', '--task', 'task-1', '--max-output-bytes', '65536', '--dry-run'), 0, 'DRY_RUN');
    expect(await treeDigest(root)).toBe(before);
    expectExit(cli(root, 'run-gates', '--change', 'bounded-output', '--task', 'task-1', '--max-output-bytes', '1024', '--dry-run'), 0, 'DRY_RUN');
    expect(await treeDigest(root)).toBe(before);
  }, 20_000);

  test('receipt seams reject nonexistent changes without creating ghost runtime state', async () => {
    const receipts = [
      ['approve', { receiptId: 'ghost-approval', provenance: 'human-confirmed', actorLabel: 'ghost', decision: 'grant', grantedAt: receiptTimestamp, expiresAt: receiptExpiry, changeId: 'ghost', scope: 'change', operationKind: 'spec-approval', decisionFingerprint: 'a'.repeat(64), gateDefinitionFingerprint: 'b'.repeat(64), argvFingerprint: 'c'.repeat(64), cwdFingerprint: 'd'.repeat(64), environmentFingerprint: 'e'.repeat(64), inputFingerprint: 'f'.repeat(64) }],
      ['waive', { receiptId: 'ghost-waiver', provenance: 'human-confirmed', actorLabel: 'ghost', scope: 'change', changeId: 'ghost', risk: 'lite', waivedRequirements: ['optional-review-detail'], timestamp: receiptTimestamp, expiresAt: receiptExpiry }],
      ['resolve', { receiptId: 'ghost-resolution', blockerId: 'ghost-blocker', provenance: 'human-confirmed', actorLabel: 'ghost', decision: 'resume', scope: 'change', changeId: 'ghost', artifactHashes: ['a'.repeat(64)], targetRecoveryState: 'executing', timestamp: receiptTimestamp, expiresAt: receiptExpiry }],
    ] as const;
    for (const [command, value] of receipts) {
      const root = await fixture();
      const receipt = await receiptFile(value);
      const before = await treeDigest(root);
      expectExit(cli(root, command, '--change', 'ghost', '--receipt', receipt), 8, 'PREREQUISITE_FAILED');
      expect(await treeDigest(root)).toBe(before);
      expect(await stat(join(root, '.leo-dev')).catch(() => undefined)).toBeUndefined();
    }
  }, 20_000);

  test('maps validation, transition, gate, conflict, approval, blocked, prerequisite, and internal failures to stable exits', async () => {
    const root = await fixture(['fail']);
    expectExit(cli(root, 'init', '--change', '../escape'), 2, 'VALIDATION_ERROR');
    await advanceToExecuting(root, 'exit-change', 'fail');
    expectExit(cli(root, 'transition', '--change', 'exit-change', '--scope', 'change', '--to', 'archived'), 3, 'TRANSITION_FORBIDDEN');
    expectExit(cli(root, 'claim', '--change', 'exit-change', '--task', 'task-1'), 0);
    expectExit(cli(root, 'claim', '--change', 'exit-change', '--task', 'task-1'), 5, 'CONFLICT');
    expectExit(cli(root, 'run-gates', '--change', 'exit-change', '--task', 'task-1'), 4, 'GATE_FAILED');
    expectExit(cli(root, 'submit', '--change', 'exit-change', '--task', 'task-1'), 7, 'BLOCKED');

    const approvalRoot = await fixture();
    expectExit(cli(approvalRoot, 'init', '--change', 'approval-change', '--spec', 'approved-spec.md'), 0);
    expectExit(cli(approvalRoot, 'route', '--change', 'approval-change', '--task', 'task-1', '--gate', 'pass'), 0);
    expectExit(cli(approvalRoot, 'transition', '--change', 'approval-change', '--scope', 'change', '--to', 'discovery'), 0);
    expectExit(cli(approvalRoot, 'transition', '--change', 'approval-change', '--scope', 'change', '--to', 'spec-review'), 0);
    expectExit(cli(approvalRoot, 'transition', '--change', 'approval-change', '--scope', 'change', '--to', 'spec-approved'), 6, 'APPROVAL_REQUIRED');

    const missing = await fixture();
    await rm(join(missing, 'core/gates/default.yaml'));
    expectExit(cli(missing, 'doctor'), 8, 'PREREQUISITE_FAILED');

    const internalRoot = await fixture();
    expectExit(cli(internalRoot, 'init', '--change', 'internal-change', '--spec', 'approved-spec.md'), 0);
    const journal = join(internalRoot, '.leo-dev/runtime/internal-change/journal.ndjson');
    await rm(journal);
    await mkdir(journal);
    expectExit(cli(internalRoot, 'status', '--change', 'internal-change'), 9, 'INTERNAL_ERROR');
  }, 20_000);

  test('receipt commands schema-validate input while explicitly declining issuer authentication', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'receipt-change');
    const invalid = await receiptFile({ receiptId: 'not-enough' });
    for (const command of ['review', 'approve', 'waive', 'resolve', 'reconcile']) {
      const result = cli(root, command, '--change', 'receipt-change', ...(command === 'review' ? ['--task', 'task-1'] : []), '--receipt', invalid);
      expectExit(result, 2, 'SCHEMA_INVALID');
      expect(result.envelope.errors[0]?.message).toContain('issuer was not authenticated');
    }
  }, 20_000);
});
