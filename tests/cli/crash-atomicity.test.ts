import { createHash, randomUUID } from 'node:crypto';
import { access, appendFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';
import { afterEach, describe, expect, test } from 'vitest';
import { Controller } from '../../packages/cli/src/controller/controller.js';
import { commitControllerBatch } from '../../packages/cli/src/controller/batch.js';
import { evidenceFilePath } from '../../packages/cli/src/gates/evidence.js';
import { GateRunner, approvalFingerprintFields, type NetworkIsolation } from '../../packages/cli/src/gates/runner.js';
import { GateRegistry, fingerprint } from '../../packages/cli/src/gates/registry.js';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { projectJournalEvents } from '../../packages/cli/src/state/snapshot.js';
import type { JournalEvent } from '../../packages/cli/src/state/types.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const issuedAt = () => new Date(Date.now() - 60_000).toISOString();
const expiresAt = () => new Date(Date.now() + 60 * 60_000).toISOString();

type Envelope = { ok: boolean; code: string; state: Record<string, unknown> | null; errors: Array<{ code: string; message: string }>; evidenceRefs: string[] };

async function fixture(gate: 'pass' | 'failed' | 'secret' | 'missing' | 'approval-missing' = 'pass'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-batch-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  const argv = gate === 'missing' || gate === 'approval-missing' ? ['/definitely/missing/leo-dev-gate'] : [process.execPath, '-e', gate === 'secret' ? 'process.stdout.write("password=abcdefghijkl")' : gate === 'failed' ? 'process.exit(2)' : 'process.exit(0)'];
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{ id: gate, argv, cwd: '.', timeoutSeconds: 10, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: gate === 'approval-missing' ? 'approval-required' : 'deny', environmentAllowlist: [], declaredWritePaths: [] }] }));
  await writeFile(join(root, 'approved-spec.md'), '# approved\n');
  return root;
}

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', env: { ...process.env, CODEX_SANDBOX: 'seatbelt', CODEX_SANDBOX_NETWORK_DISABLED: '1' } });
  return { status: result.status ?? 9, envelope: JSON.parse(result.stdout.trim()) as Envelope };
}

function expectExit(result: ReturnType<typeof cli>, status: number, code: string): void {
  expect(result.status, JSON.stringify(result.envelope)).toBe(status);
  expect(result.envelope.code).toBe(code);
}

async function receipt(value: unknown): Promise<string> {
  const path = join(tmpdir(), `leo-dev-batch-receipt-${randomUUID()}.json`);
  temporary.push(path);
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function gateApprovalReceipt(context: Record<string, unknown>): Promise<string> {
  const { runId: _runId, gateId: _gateId, taskRevision: _taskRevision, leaseGeneration: _leaseGeneration, ...receiptContext } = context;
  return receipt({
    receiptId: `gate-approval-${randomUUID()}`,
    provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture gate approval; issuer not authenticated', decision: 'grant',
    grantedAt: issuedAt(), expiresAt: expiresAt(), scope: 'gate', operationKind: 'gate-run', ...receiptContext,
  });
}

async function treeDigest(root: string): Promise<string> {
  const entries: string[] = [];
  async function visit(path: string, prefix = ''): Promise<void> {
    for (const name of (await readdir(path)).sort()) {
      const absolute = join(path, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      const info = await stat(absolute);
      if (info.isDirectory()) await visit(absolute, relative);
      else entries.push(`${relative}:${digest(await readFile(absolute, 'utf8'))}`);
    }
  }
  await visit(root);
  return digest(entries.join('\n'));
}

async function approve(root: string, changeId: string): Promise<void> {
  const context = (cli(root, 'status', '--change', changeId).envelope.state as { approvalContext: Record<string, unknown> }).approvalContext;
  const path = await receipt({ receiptId: `approval-${changeId}`, provenance: 'human-confirmed', actorLabel: 'test', decision: 'grant', grantedAt: issuedAt(), expiresAt: expiresAt(), changeId, scope: 'change', operationKind: 'spec-approval', ...context });
  expectExit(cli(root, 'approve', '--change', changeId, '--receipt', path), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
}

async function executing(root: string, changeId: string, gate: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--task', 'task-1', '--gate', gate), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  await approve(root, changeId);
  for (const state of ['spec-approved', 'task-ready', 'executing']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
}

async function expectCrash(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({ exitCode: 9, publicCode: 'INTERNAL_ERROR' });
}

const passthroughIsolation: NetworkIsolation = { async prepare(command, args) { return { command, args: [...args], fingerprint: 'a'.repeat(64) }; } };

async function settleOutsideController(root: string, changeId: string, gateId: string) {
  const claimed = cli(root, 'status', '--change', changeId).envelope.state as { run: { runId: string; lease: { inputTreeHash: string; generation: number; taskRevision: number } }; route: { gateDefinitionHash: string } };
  const registry = await GateRegistry.fromYaml(join(root, 'core/gates/default.yaml'));
  return new GateRunner({ networkIsolation: passthroughIsolation }).run({ repositoryRoot: root, registry, gateId, expectedInputTreeHash: claimed.run.lease.inputTreeHash, expectedGateDefinitionHash: claimed.route.gateDefinitionHash, runId: claimed.run.runId, changeId, taskId: 'task-1', taskRevision: claimed.run.lease.taskRevision, leaseGeneration: claimed.run.lease.generation, maxOutputBytes: 64 * 1024 });
}

type GateTerminal = {
  eventHash: string;
  changeId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  type: 'gate.attempt.settled' | 'gate.attempt.denied';
  payload: {
    attemptId: string;
    runId: string;
    changeId: string;
    taskId: string;
    taskRevision: number;
    leaseGeneration: number;
    gateId: string;
    status?: string;
    outcome: { runState: string; taskState: string; changeState: string };
    evidence?: unknown;
  };
};

async function latestGateTerminal(root: string, changeId: string): Promise<GateTerminal> {
  const events = (await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).replayStrict()).events;
  const terminal = events.filter((event) => event.type === 'gate.attempt.settled' || event.type === 'gate.attempt.denied').at(-1);
  if (!terminal) throw new Error('fixture has no Gate terminal');
  return terminal as GateTerminal;
}

function boundGateResult(terminal: GateTerminal): Record<string, unknown> {
  const status = terminal.type === 'gate.attempt.denied' ? 'approval-expired' : terminal.payload.status;
  return {
    attemptId: terminal.payload.attemptId,
    terminalEventHash: terminal.eventHash,
    runId: terminal.payload.runId,
    changeId: terminal.payload.changeId,
    taskId: terminal.payload.taskId,
    taskRevision: terminal.payload.taskRevision,
    leaseGeneration: terminal.payload.leaseGeneration,
    gateId: terminal.payload.gateId,
    status,
    outcome: terminal.payload.outcome,
    ...(terminal.payload.evidence === undefined ? {} : { evidenceRef: evidenceFilePath(terminal.changeId, terminal.payload.runId, terminal.payload.gateId) }),
  };
}

async function appendGateResult(root: string, changeId: string, terminal: GateTerminal, payload: Record<string, unknown>, envelope: Partial<Pick<GateTerminal, 'taskId' | 'taskRevision' | 'leaseGeneration'>> = {}): Promise<void> {
  await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).append({
    changeId,
    taskId: envelope.taskId ?? terminal.taskId,
    taskRevision: envelope.taskRevision ?? terminal.taskRevision,
    leaseGeneration: envelope.leaseGeneration ?? terminal.leaseGeneration,
    type: 'controller.gate.result',
    payload,
  });
}

function expectBlockedStatusAndResume(root: string, changeId: string): void {
  expectExit(cli(root, 'status', '--change', changeId), 7, 'BLOCKED');
  expectExit(cli(root, 'resume', '--change', changeId), 7, 'BLOCKED');
}

function expectBlockedStatusAndInspect(root: string, changeId: string): void {
  expectExit(cli(root, 'status', '--change', changeId), 7, 'BLOCKED');
  expectExit(cli(root, 'inspect', '--change', changeId), 7, 'BLOCKED');
}

type GatePhasePayloads = { prepared: Record<string, unknown>; started: Record<string, unknown>; released: Record<string, unknown>; settled: Record<string, unknown> };

async function appendGatePhase(journal: Journal, type: string, payload: Record<string, unknown>) {
  return journal.append({
    changeId: String(payload.changeId),
    taskId: String(payload.taskId),
    taskRevision: Number(payload.taskRevision),
    leaseGeneration: Number(payload.leaseGeneration),
    type,
    payload,
  });
}

async function rebuildMappedSettlementWithCorruption(root: string, changeId: string, mutate: (phases: GatePhasePayloads) => void): Promise<void> {
  await settleOutsideController(root, changeId, 'pass');
  const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const raw = (await new Journal(journalPath).replayStrict()).events;
  const phaseStart = raw.findIndex((event) => event.type === 'gate.attempt.prepared');
  if (phaseStart < 0) throw new Error('fixture has no Gate attempt');
  const phases = {
    prepared: structuredClone(raw[phaseStart]!.payload) as Record<string, unknown>,
    started: structuredClone(raw[phaseStart + 1]!.payload) as Record<string, unknown>,
    released: structuredClone(raw[phaseStart + 2]!.payload) as Record<string, unknown>,
    settled: structuredClone(raw[phaseStart + 3]!.payload) as Record<string, unknown>,
  };
  mutate(phases);
  await writeFile(journalPath, `${raw.slice(0, phaseStart).map((event) => JSON.stringify(event)).join('\n')}\n`);
  const journal = new Journal(journalPath);
  const prepared = await appendGatePhase(journal, 'gate.attempt.prepared', phases.prepared);
  phases.started.preparedEventHash = prepared.eventHash;
  const started = await appendGatePhase(journal, 'gate.attempt.started', phases.started);
  phases.released.preparedEventHash = prepared.eventHash;
  phases.released.startedEventHash = started.eventHash;
  const released = await appendGatePhase(journal, 'gate.attempt.released', phases.released);
  phases.settled.preparedEventHash = prepared.eventHash;
  phases.settled.startedEventHash = started.eventHash;
  phases.settled.releasedEventHash = released.eventHash;
  const terminalEvent = await appendGatePhase(journal, 'gate.attempt.settled', phases.settled);
  const terminal = terminalEvent as GateTerminal;
  await commitControllerBatch({
    repositoryRoot: root,
    changeId,
    journal,
    priorEvents: (await journal.replayStrict()).events,
    kind: 'gate-result',
    operations: [{
      taskId: terminal.taskId,
      taskRevision: terminal.taskRevision,
      leaseGeneration: terminal.leaseGeneration,
      type: 'controller.gate.result',
      payload: boundGateResult(terminal),
    }],
  });
}

type UnknownHistoryMutation =
  | { moveAuthority: 'route.selected' | 'run.claimed' }
  | { omitReleased: true }
  | { appendBeforeUnknown: (logical: JournalEvent[]) => Array<{ changeId: string; taskId?: string; taskRevision?: number; leaseGeneration?: number; type: string; payload: unknown }> };

async function rebuildThrownUnknownHistory(root: string, changeId: string, mutation: UnknownHistoryMutation): Promise<void> {
  const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const raw = (await new Journal(journalPath).replayStrict()).events;
  const logical = projectJournalEvents(raw).events;
  await writeFile(journalPath, '');
  const journal = new Journal(journalPath);
  const remappedHashes = new Map<string, string>();
  const omittedHashes = new Set<string>();
  let movedAuthority: Record<string, unknown> | undefined;

  for (const source of raw) {
    if ('omitReleased' in mutation && source.type === 'gate.attempt.released') {
      omittedHashes.add(source.eventHash);
      continue;
    }
    const payload = structuredClone(source.payload) as Record<string, unknown>;
    if (source.type === 'controller.batch.prepared') {
      const operations = Array.isArray(payload.operations) ? payload.operations as Record<string, unknown>[] : [];
      if ('moveAuthority' in mutation) {
        const match = operations.find((operation) => operation.type === mutation.moveAuthority);
        if (match) {
          movedAuthority = structuredClone(match);
          payload.operations = operations.filter((operation) => operation !== match);
        }
      }
      for (const operation of operations) {
        if (operation.type !== 'run.unknown.context') continue;
        const context = operation.payload as Record<string, unknown>;
        if (Array.isArray(context.evidenceHashes)) context.evidenceHashes = context.evidenceHashes
          .filter((value) => !omittedHashes.has(String(value)))
          .map((value) => remappedHashes.get(String(value)) ?? value);
      }
      for (const operation of operations) {
        if (operation.type !== 'receipt.reconciliation.ingested') continue;
        const receipt = (operation.payload as Record<string, unknown>).receipt as Record<string, unknown>;
        if (Array.isArray(receipt?.evidenceHashes)) receipt.evidenceHashes = receipt.evidenceHashes
          .filter((value) => !omittedHashes.has(String(value)))
          .map((value) => remappedHashes.get(String(value)) ?? value);
      }
    }
    for (const field of ['preparedEventHash', 'startedEventHash', 'releasedEventHash', 'priorEventHash']) {
      if (typeof payload[field] === 'string' && remappedHashes.has(payload[field] as string)) payload[field] = remappedHashes.get(payload[field] as string)!;
    }
    if (source.type === 'controller.batch.committed' && typeof payload.preparedEventHash === 'string') {
      payload.preparedEventHash = remappedHashes.get(payload.preparedEventHash) ?? payload.preparedEventHash;
    }
    if (source.type === 'controller.batch.prepared' && payload.kind === 'unknown-outcome' && 'appendBeforeUnknown' in mutation) {
      for (const input of mutation.appendBeforeUnknown(logical)) await journal.append(input);
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
    if (source.type === 'gate.attempt.released' && movedAuthority) {
      await journal.append({
        changeId,
        ...(movedAuthority.taskId === undefined ? {} : { taskId: String(movedAuthority.taskId) }),
        ...(movedAuthority.taskRevision === undefined ? {} : { taskRevision: Number(movedAuthority.taskRevision) }),
        ...(movedAuthority.leaseGeneration === undefined ? {} : { leaseGeneration: Number(movedAuthority.leaseGeneration) }),
        type: String(movedAuthority.type),
        payload: movedAuthority.payload,
      });
      movedAuthority = undefined;
    }
  }
  if (movedAuthority) throw new Error('fixture did not reach the Gate released phase');
}

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('controller crash-atomic batches', () => {
  test('keeps a prepared claim logically invisible and resumes it as one complete lease/task/run mapping', async () => {
    const root = await fixture();
    await executing(root, 'claim-crash', 'pass');
    await expectCrash(new Controller().execute('claim', { repo: root, change: 'claim-crash', task: 'task-1', faultAt: 'after-batch-prepared' }));
    expectExit(cli(root, 'status', '--change', 'claim-crash'), 7, 'BLOCKED');
    const resumed = cli(root, 'resume', '--change', 'claim-crash');
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ tasks: { 'task-1': { state: 'implementing' } } });
  }, 20_000);

  test('recovers review projection after a crash without exposing done/active-lease or manifest/journal halves', async () => {
    const root = await fixture();
    await executing(root, 'review-crash', 'pass');
    expectExit(cli(root, 'claim', '--change', 'review-crash', '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', 'review-crash', '--task', 'task-1'), 0, 'GATES_PASSED');
    expectExit(cli(root, 'submit', '--change', 'review-crash', '--task', 'task-1'), 0, 'SUBMITTED_FOR_REVIEW');
    const context = (cli(root, 'status', '--change', 'review-crash').envelope.state as { reviewContext: Record<string, unknown> }).reviewContext;
    const path = await receipt({ receiptId: 'review-crash', provenance: 'agent-asserted', actorLabel: 'self review', sessionId: 'session', ...context, findingsHash: digest('none'), verdict: 'pass', timestamp: issuedAt(), expiresAt: expiresAt() });
    await expectCrash(new Controller().execute('review', { repo: root, change: 'review-crash', task: 'task-1', receipt: path, faultAt: 'after-batch-projection' }));
    expectExit(cli(root, 'status', '--change', 'review-crash'), 7, 'BLOCKED');
    const resumed = cli(root, 'resume', '--change', 'review-crash');
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ changeState: 'integration-review', tasks: { 'task-1': { state: 'done' } }, leases: { 'task-1': { active: false } } });
  }, 30_000);

  test('recovers safe pre-release reconciliation and a thrown-indeterminate mapping only from their complete batch commits', async () => {
    const safeRoot = await fixture('missing');
    await executing(safeRoot, 'reconcile-crash', 'missing');
    const firstClaim = cli(safeRoot, 'claim', '--change', 'reconcile-crash', '--task', 'task-1');
    expectExit(firstClaim, 0, 'CLAIMED');
    const firstGeneration = Number(((firstClaim.envelope.state as { run: { lease: { generation: number } } }).run.lease.generation));
    expectExit(cli(safeRoot, 'run-gates', '--change', 'reconcile-crash', '--task', 'task-1'), 7, 'BLOCKED');
    await rebuildThrownUnknownHistory(safeRoot, 'reconcile-crash', { omitReleased: true });
    const context = (cli(safeRoot, 'status', '--change', 'reconcile-crash').envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const reconciliation = await receipt({ receiptId: 'reconcile-crash', runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration, operationFingerprint: context.operationFingerprint, inputTreeHash: context.inputTreeHash, evidenceHashes: context.evidenceHashes, resolvedRunState: 'abandoned', sideEffectDisposition: 'not-started', safeToRetry: true, provenance: 'human-confirmed', actorLabel: 'test', timestamp: issuedAt(), expiresAt: expiresAt() });
    await expectCrash(new Controller().execute('reconcile', { repo: safeRoot, change: 'reconcile-crash', receipt: reconciliation, faultAt: 'after-batch-prepared' }));
    expectExit(cli(safeRoot, 'status', '--change', 'reconcile-crash'), 7, 'BLOCKED');
    const safeResume = cli(safeRoot, 'resume', '--change', 'reconcile-crash');
    expectExit(safeResume, 0, 'RESUMED');
    expect(safeResume.envelope.state).toMatchObject({ changeState: 'executing', tasks: { 'task-1': { state: 'ready' } }, leases: { 'task-1': { active: false } } });
    const safeJournal = join(safeRoot, '.leo-dev/runtime/reconcile-crash/journal.ndjson');
    const afterSafeResume = await readFile(safeJournal, 'utf8');
    const safeLogical = projectJournalEvents((await new Journal(safeJournal).replayStrict()).events).events;
    expect(safeLogical.filter((event) => event.type === 'receipt.reconciliation.ingested')).toHaveLength(1);
    expect(safeLogical.filter((event) => event.type === 'lease.abandoned')).toHaveLength(1);
    expectExit(cli(safeRoot, 'resume', '--change', 'reconcile-crash'), 0, 'RESUMED');
    expect(await readFile(safeJournal, 'utf8')).toBe(afterSafeResume);
    const successor = cli(safeRoot, 'claim', '--change', 'reconcile-crash', '--task', 'task-1');
    expectExit(successor, 0, 'CLAIMED');
    expect(Number(((successor.envelope.state as { run: { lease: { generation: number } } }).run.lease.generation))).toBeGreaterThan(firstGeneration);
    const afterSuccessor = await readFile(safeJournal, 'utf8');
    expectExit(cli(safeRoot, 'resume', '--change', 'reconcile-crash'), 0, 'RESUMED');
    expect(await readFile(safeJournal, 'utf8')).toBe(afterSuccessor);
    expectExit(cli(safeRoot, 'run-gates', '--change', 'reconcile-crash', '--task', 'task-1'), 7, 'BLOCKED');
    await rebuildThrownUnknownHistory(safeRoot, 'reconcile-crash', { omitReleased: true });
    const secondContext = (cli(safeRoot, 'status', '--change', 'reconcile-crash').envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const secondReconciliation = await receipt({ receiptId: 'reconcile-crash-second', runId: secondContext.runId, taskId: secondContext.taskId, taskRevision: secondContext.taskRevision, leaseGeneration: secondContext.leaseGeneration, operationFingerprint: secondContext.operationFingerprint, inputTreeHash: secondContext.inputTreeHash, evidenceHashes: secondContext.evidenceHashes, resolvedRunState: 'abandoned', sideEffectDisposition: 'not-started', safeToRetry: true, provenance: 'human-confirmed', actorLabel: 'test', timestamp: issuedAt(), expiresAt: expiresAt() });
    expectExit(cli(safeRoot, 'reconcile', '--change', 'reconcile-crash', '--receipt', secondReconciliation), 0, 'RUN_RECONCILED_UNAUTHENTICATED');
    const afterSecond = await readFile(safeJournal, 'utf8');
    expectExit(cli(safeRoot, 'resume', '--change', 'reconcile-crash'), 0, 'RESUMED');
    expect(await readFile(safeJournal, 'utf8')).toBe(afterSecond);
    const third = cli(safeRoot, 'claim', '--change', 'reconcile-crash', '--task', 'task-1');
    expectExit(third, 0, 'CLAIMED');
    expect(Number(((third.envelope.state as { run: { lease: { generation: number } } }).run.lease.generation))).toBeGreaterThan(Number(((successor.envelope.state as { run: { lease: { generation: number } } }).run.lease.generation)));

    const unknownRoot = await fixture('approval-missing');
    await executing(unknownRoot, 'unknown-crash', 'approval-missing');
    expectExit(cli(unknownRoot, 'claim', '--change', 'unknown-crash', '--task', 'task-1'), 0, 'CLAIMED');
    const gatePreview = cli(unknownRoot, 'run-gates', '--change', 'unknown-crash', '--task', 'task-1', '--dry-run');
    expectExit(gatePreview, 0, 'DRY_RUN');
    const gateApproval = await gateApprovalReceipt(gatePreview.envelope.state!.gateApprovalContext as Record<string, unknown>);
    // The C2 candidate binding is its own durable batch. Recover that batch first,
    // then arm the same fault at the intended unknown-outcome handoff boundary.
    await expectCrash(new Controller().execute('run-gates', { repo: unknownRoot, change: 'unknown-crash', task: 'task-1', approvalReceipt: gateApproval, faultAt: 'after-batch-prepared' }));
    expectExit(cli(unknownRoot, 'resume', '--change', 'unknown-crash'), 0, 'RESUMED');
    await expectCrash(new Controller().execute('run-gates', { repo: unknownRoot, change: 'unknown-crash', task: 'task-1', approvalReceipt: gateApproval, faultAt: 'after-batch-prepared' }));
    expectExit(cli(unknownRoot, 'status', '--change', 'unknown-crash'), 7, 'BLOCKED');
    const unknownResume = cli(unknownRoot, 'resume', '--change', 'unknown-crash');
    expectExit(unknownResume, 0, 'RESUMED');
    expect(unknownResume.envelope.state).toMatchObject({ changeState: 'approval-required', tasks: { 'task-1': { state: 'blocked' } } });
  }, 60_000);

  test('recovers an initialization authority intent after workspace publication but before batch preparation', async () => {
    const root = await fixture();
    await expectCrash(new Controller().execute('init', { repo: root, change: 'init-crash', spec: 'approved-spec.md', faultAt: 'after-workspace-published' }));
    expectExit(cli(root, 'status', '--change', 'init-crash'), 7, 'BLOCKED');
    const resumed = cli(root, 'resume', '--change', 'init-crash');
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ changeState: 'triage' });
  }, 20_000);

  test('dry-plans matching pending initialization and resume authorities without writes, but rejects a mismatched retry', async () => {
    const root = await fixture();
    await expectCrash(new Controller().execute('init', { repo: root, change: 'dry-init-authority', spec: 'approved-spec.md', faultAt: 'after-workspace-published' }));
    const before = await treeDigest(root);
    expectExit(cli(root, 'init', '--change', 'dry-init-authority', '--spec', 'approved-spec.md', '--dry-run'), 0, 'DRY_RUN');
    expectExit(cli(root, 'resume', '--change', 'dry-init-authority', '--dry-run'), 0, 'DRY_RUN');
    expect(await treeDigest(root)).toBe(before);
    await writeFile(join(root, 'approved-spec.md'), '# changed authority\n');
    const changed = await treeDigest(root);
    expectExit(cli(root, 'init', '--change', 'dry-init-authority', '--spec', 'approved-spec.md', '--dry-run'), 5, 'CONFLICT');
    expect(await treeDigest(root)).toBe(changed);
  }, 20_000);

  test('dry resume plans a pending controller batch without committing it', async () => {
    const root = await fixture();
    expectExit(cli(root, 'init', '--change', 'dry-batch-resume', '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
    await expectCrash(new Controller().execute('route', { repo: root, change: 'dry-batch-resume', task: 'task-1', gate: 'pass', faultAt: 'after-batch-prepared' }));
    const before = await treeDigest(root);
    const dry = cli(root, 'resume', '--change', 'dry-batch-resume', '--dry-run');
    expectExit(dry, 0, 'DRY_RUN');
    expect(dry.envelope.state).toMatchObject({ plannedRecovery: true, writes: [] });
    expect(await treeDigest(root)).toBe(before);
  }, 20_000);

  test('resume after a runtime-created initialization crash removes the intent-owned staging directory', async () => {
    const root = await fixture();
    await expectCrash(new Controller().execute('init', { repo: root, change: 'runtime-init-crash', spec: 'approved-spec.md', faultAt: 'after-runtime-created' }));
    expect((await readdir(join(root, '.leo-dev'))).some((name) => name.startsWith('.staging-runtime-init-crash-'))).toBe(true);
    expectExit(cli(root, 'resume', '--change', 'runtime-init-crash'), 0, 'RESUMED');
    expect((await readdir(join(root, '.leo-dev'))).some((name) => name.startsWith('.staging-runtime-init-crash-'))).toBe(false);
  }, 20_000);

  test('recovers a routed task projection written before its batch commit', async () => {
    const root = await fixture();
    expectExit(cli(root, 'init', '--change', 'route-crash', '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
    await expectCrash(new Controller().execute('route', { repo: root, change: 'route-crash', task: 'task-1', gate: 'pass', faultAt: 'after-batch-projection' }));
    expectExit(cli(root, 'status', '--change', 'route-crash'), 7, 'BLOCKED');
    expect(YAML.parse(await readFile(join(root, '.leo-dev/changes/route-crash/tasks.yaml'), 'utf8'))).toMatchObject({ tasks: [{ id: 'task-1' }] });
    await appendFile(join(root, '.leo-dev/runtime/route-crash/journal.ndjson'), '{"changeId":"route-crash","type":"controller.batch.committed"');
    const resumed = cli(root, 'resume', '--change', 'route-crash');
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ tasks: { 'task-1': { state: 'ready' } } });
  }, 20_000);

  test('does not overwrite a third-value artifact while recovering a pending projection', async () => {
    const root = await fixture();
    expectExit(cli(root, 'init', '--change', 'projection-drift', '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
    expectExit(cli(root, 'route', '--change', 'projection-drift', '--task', 'task-1', '--gate', 'pass'), 0, 'ROUTED_LITE');
    await expectCrash(new Controller().execute('transition', { repo: root, change: 'projection-drift', scope: 'change', to: 'discovery', faultAt: 'after-batch-prepared' }));
    const manifestPath = join(root, '.leo-dev/changes/projection-drift/manifest.yaml');
    const manifest = YAML.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    await writeFile(manifestPath, YAML.stringify({ ...manifest, state: 'blocked' }));
    const thirdValue = await readFile(manifestPath, 'utf8');
    expectExit(cli(root, 'resume', '--change', 'projection-drift'), 7, 'BLOCKED');
    expect(await readFile(manifestPath, 'utf8')).toBe(thirdValue);
  }, 20_000);

  test.each([
    { gate: 'pass', expectedStatus: 'succeeded', expectedRun: 'succeeded', expectedTask: 'verifying', expectedChange: 'executing', exit: 0 },
    { gate: 'failed', expectedStatus: 'failed', expectedRun: 'failed', expectedTask: 'remediation', expectedChange: 'executing', exit: 4 },
    { gate: 'secret', expectedStatus: 'unknown', expectedRun: 'unknown', expectedTask: 'blocked', expectedChange: 'approval-required', exit: 7 },
  ] as const)('recovers one durable $expectedStatus settlement handoff without rerunning the Gate', async ({ gate, expectedStatus, expectedRun, expectedTask, expectedChange, exit }) => {
    const root = await fixture(gate);
    const changeId = `handoff-${gate}`;
    await executing(root, changeId, gate);
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    const raw = await settleOutsideController(root, changeId, gate);
    expect(raw.status === 'evidence-blocked-secret' ? 'unknown' : raw.status).toBe(expectedStatus);
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    const beforeJournal = await readFile(journalPath, 'utf8');
    const beforeEvidence = await treeDigest(join(root, '.leo-dev/runtime', `c-${Buffer.from(changeId).toString('base64url')}`));
    const attemptsBefore = (await new Journal(journalPath).replayStrict()).events.filter((event) => event.type === 'gate.attempt.prepared').length;

    for (const command of [['status'], ['inspect'], ['run-gates', '--task', 'task-1']] as const) expectExit(cli(root, command[0], '--change', changeId, ...command.slice(1)), 7, 'BLOCKED');
    const resumed = cli(root, 'resume', '--change', changeId);
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ changeState: expectedChange, tasks: { 'task-1': { state: expectedTask } }, runs: { [String((cli(root, 'status', '--change', changeId).envelope.state as { run: { runId: string } }).run.runId)]: { state: expectedRun } } });
    const afterFirst = await readFile(journalPath, 'utf8');
    const mapped = (await new Journal(journalPath).replayStrict()).events.filter((event) => event.type === 'controller.batch.prepared' && (event.payload as { kind?: string }).kind === 'gate-result');
    expect(mapped).toHaveLength(1);
    expect((await new Journal(journalPath).replayStrict()).events.filter((event) => event.type === 'gate.attempt.prepared')).toHaveLength(attemptsBefore);
    expect(await treeDigest(join(root, '.leo-dev/runtime', `c-${Buffer.from(changeId).toString('base64url')}`))).toBe(beforeEvidence);

    expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
    expect(await readFile(journalPath, 'utf8')).toBe(afterFirst);
    expect(beforeJournal).not.toContain('controller.gate.result');
    if (exit !== 0) expect(expectedStatus).not.toBe('succeeded');
  }, 60_000);

  test.each([
    { label: 'before a readable type', tail: '{"sequence":' },
    { label: 'after a readable type', tail: '{"sequence":999,"type":"controller.batch.committed"' },
  ])('recovers a pending gate-result batch with an incomplete commit tail $label', async ({ tail }) => {
    const root = await fixture();
    const changeId = `gate-tail-${digest(tail).slice(0, 8)}`;
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    // Materialize/recover the separate C2 candidate-registration batch before
    // faulting the Gate-result handoff that this fixture exercises.
    await expectCrash(new Controller().execute('run-gates', { repo: root, change: changeId, task: 'task-1', faultAt: 'after-batch-prepared' }));
    expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
    await expectCrash(new Controller().execute('run-gates', { repo: root, change: changeId, task: 'task-1', faultAt: 'after-batch-prepared' }));
    await appendFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), tail);
    const resumed = cli(root, 'resume', '--change', changeId);
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ tasks: { 'task-1': { state: 'verifying' } } });
  }, 60_000);

  test.each([
    { label: 'after the opening brace', tail: '{' },
    { label: 'inside the sequence key', tail: '{"seque' },
    { label: 'after the sequence separator', tail: '{"sequence":' },
  ])('repairs a partial Controller prepared prefix $label only after a complete raw success terminal', async ({ tail }) => {
    const root = await fixture();
    const changeId = `partial-prepared-${digest(tail).slice(0, 8)}`;
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await settleOutsideController(root, changeId, 'pass');
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    const attemptsBefore = (await new Journal(journalPath).replayStrict()).events.filter((event) => event.type === 'gate.attempt.prepared').length;
    const evidenceRoot = join(root, '.leo-dev/runtime', `c-${Buffer.from(changeId).toString('base64url')}`);
    const evidenceBefore = await treeDigest(evidenceRoot);
    await appendFile(journalPath, tail);

    const resumed = cli(root, 'resume', '--change', changeId);
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ tasks: { 'task-1': { state: 'verifying' } } });
    const afterFirst = await readFile(journalPath, 'utf8');
    const replay = await new Journal(journalPath).replayStrict();
    expect(replay.events.filter((event) => event.type === 'gate.attempt.prepared')).toHaveLength(attemptsBefore);
    expect(replay.events.filter((event) => event.type === 'controller.batch.prepared' && (event.payload as { kind?: string }).kind === 'gate-result')).toHaveLength(1);
    expect(await treeDigest(evidenceRoot)).toBe(evidenceBefore);

    expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
    expect(await readFile(journalPath, 'utf8')).toBe(afterFirst);
  }, 60_000);

  test('dry-plans an unknown raw-terminal handoff across a partial prepared prefix without writes', async () => {
    const root = await fixture('secret');
    const changeId = 'dry-partial-prepared-unknown';
    await executing(root, changeId, 'secret');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await settleOutsideController(root, changeId, 'secret');
    await appendFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), '{"sequence":');
    const before = await treeDigest(root);

    const dry = cli(root, 'resume', '--change', changeId, '--dry-run');
    expectExit(dry, 0, 'DRY_RUN');
    expect(dry.envelope.state).toMatchObject({ plannedRecovery: true, writes: [] });
    expect(await treeDigest(root)).toBe(before);
  }, 60_000);

  test('does not truncate a partial prepared prefix until the unmatched terminal passes strict evidence verification', async () => {
    const root = await fixture();
    const changeId = 'partial-prepared-invalid-evidence';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await settleOutsideController(root, changeId, 'pass');
    const terminal = await latestGateTerminal(root, changeId);
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    await writeFile(join(root, evidenceFilePath(changeId, terminal.payload.runId, terminal.payload.gateId)), '{"corrupt":true}\n');
    await appendFile(journalPath, '{"sequence":');
    const before = await readFile(journalPath, 'utf8');

    expectExit(cli(root, 'resume', '--change', changeId), 7, 'BLOCKED');
    expect(await readFile(journalPath, 'utf8')).toBe(before);
  }, 60_000);

  test('blocks a duplicate terminal appended after a fully mapped result', async () => {
    const root = await fixture();
    const changeId = 'duplicate-terminal-after-result';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 0, 'GATES_PASSED');
    const terminal = await latestGateTerminal(root, changeId);
    await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).append({
      changeId,
      taskId: terminal.taskId,
      taskRevision: terminal.taskRevision,
      leaseGeneration: terminal.leaseGeneration,
      type: terminal.type,
      payload: terminal.payload,
    });

    expectBlockedStatusAndResume(root, changeId);
  }, 60_000);

  test('does not let a legacy run-only result hide a later malformed terminal', async () => {
    const root = await fixture();
    const changeId = 'legacy-hidden-malformed-terminal';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await settleOutsideController(root, changeId, 'pass');
    const terminal = await latestGateTerminal(root, changeId);
    const legacy = boundGateResult(terminal);
    delete legacy.attemptId;
    delete legacy.terminalEventHash;
    delete legacy.changeId;
    delete legacy.taskId;
    delete legacy.taskRevision;
    delete legacy.leaseGeneration;
    delete legacy.gateId;
    await appendGateResult(root, changeId, terminal, legacy);
    await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).append({
      changeId,
      taskId: terminal.taskId,
      taskRevision: terminal.taskRevision,
      leaseGeneration: terminal.leaseGeneration,
      type: 'gate.attempt.settled',
      payload: { ...terminal.payload, attemptId: 'malformed-attempt' },
    });

    expectBlockedStatusAndResume(root, changeId);
  }, 60_000);

  test('blocks a legacy result that precedes its terminal', async () => {
    const root = await fixture();
    const changeId = 'legacy-result-before-terminal';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    const state = cli(root, 'status', '--change', changeId).envelope.state as { run: { runId: string; lease: { inputTreeHash: string; taskRevision: number; generation: number } }; route: { gateDefinitionHash: string } };
    await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).append({
      changeId,
      taskId: 'task-1',
      taskRevision: state.run.lease.taskRevision,
      leaseGeneration: state.run.lease.generation,
      type: 'controller.gate.result',
      payload: {
        runId: state.run.runId,
        status: 'succeeded',
        outcome: { runState: 'succeeded', taskState: 'verifying', changeState: 'executing' },
        evidenceRef: evidenceFilePath(changeId, state.run.runId, 'pass'),
      },
    });
    const registry = await GateRegistry.fromYaml(join(root, 'core/gates/default.yaml'));
    await new GateRunner({ networkIsolation: passthroughIsolation }).run({ repositoryRoot: root, registry, gateId: 'pass', expectedInputTreeHash: state.run.lease.inputTreeHash, expectedGateDefinitionHash: state.route.gateDefinitionHash, runId: state.run.runId, changeId, taskId: 'task-1', taskRevision: state.run.lease.taskRevision, leaseGeneration: state.run.lease.generation, maxOutputBytes: 64 * 1024 });

    expectBlockedStatusAndResume(root, changeId);
  }, 60_000);

  test.each([
    { label: 'task id', envelope: { taskId: 'other-task' } },
    { label: 'task revision', envelope: { taskRevision: 99 } },
    { label: 'lease generation', envelope: { leaseGeneration: 99 } },
  ])('blocks a result with the wrong $label envelope', async ({ envelope }) => {
    const root = await fixture();
    const changeId = `wrong-result-envelope-${digest(JSON.stringify(envelope)).slice(0, 8)}`;
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await settleOutsideController(root, changeId, 'pass');
    const terminal = await latestGateTerminal(root, changeId);
    await appendGateResult(root, changeId, terminal, boundGateResult(terminal), envelope);

    expectBlockedStatusAndResume(root, changeId);
  }, 60_000);

  test.each([
    { label: 'terminal event hash', mutate: (payload: Record<string, unknown>) => ({ ...payload, terminalEventHash: 'f'.repeat(64) }) },
    { label: 'status', mutate: (payload: Record<string, unknown>) => ({ ...payload, status: 'failed' }) },
    { label: 'outcome', mutate: (payload: Record<string, unknown>) => ({ ...payload, outcome: { runState: 'failed', taskState: 'remediation', changeState: 'executing' } }) },
  ])('blocks a result with the wrong $label binding', async ({ label, mutate }) => {
    const root = await fixture();
    const changeId = `wrong-result-${digest(label).slice(0, 8)}`;
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await settleOutsideController(root, changeId, 'pass');
    const terminal = await latestGateTerminal(root, changeId);
    await appendGateResult(root, changeId, terminal, mutate(boundGateResult(terminal)));

    expectBlockedStatusAndResume(root, changeId);
  }, 60_000);

  test('blocks duplicate results for one terminal', async () => {
    const root = await fixture();
    const changeId = 'duplicate-gate-results';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await settleOutsideController(root, changeId, 'pass');
    const terminal = await latestGateTerminal(root, changeId);
    const legacy = boundGateResult(terminal);
    for (const field of ['attemptId', 'terminalEventHash', 'changeId', 'taskId', 'taskRevision', 'leaseGeneration', 'gateId']) delete legacy[field];
    await appendGateResult(root, changeId, terminal, legacy);
    await appendGateResult(root, changeId, terminal, legacy);

    expectBlockedStatusAndResume(root, changeId);
  }, 60_000);

  test('blocks duplicate standalone thrown-indeterminate results for one Run', async () => {
    const root = await fixture('missing');
    const changeId = 'duplicate-standalone-unknown-results';
    await executing(root, changeId, 'missing');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 7, 'BLOCKED');
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    const raw = (await journal.replayStrict()).events;
    const resultEvent = projectJournalEvents(raw).events.filter((event) => event.type === 'controller.gate.result').at(-1)!;
    await commitControllerBatch({
      repositoryRoot: root,
      changeId,
      journal,
      priorEvents: raw,
      kind: 'unknown-outcome',
      operations: [{
        taskId: resultEvent.taskId,
        taskRevision: resultEvent.taskRevision,
        leaseGeneration: resultEvent.leaseGeneration,
        type: resultEvent.type,
        payload: resultEvent.payload,
      }],
    });

    expectBlockedStatusAndResume(root, changeId);
  }, 60_000);

  test('keeps one correctly ordered and envelope-compatible legacy Gate pair readable', async () => {
    const root = await fixture();
    const changeId = 'legacy-readable-pair';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await settleOutsideController(root, changeId, 'pass');
    const terminal = await latestGateTerminal(root, changeId);
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    await journal.append({ changeId, taskId: terminal.taskId, taskRevision: terminal.taskRevision, leaseGeneration: terminal.leaseGeneration, type: 'task.transition', payload: { from: 'implementing', to: 'verifying' } });
    await journal.append({ changeId, taskId: terminal.taskId, taskRevision: terminal.taskRevision, leaseGeneration: terminal.leaseGeneration, type: 'run.transition', payload: { runId: terminal.payload.runId, from: 'running', to: 'succeeded' } });
    const legacy = boundGateResult(terminal);
    for (const field of ['attemptId', 'terminalEventHash', 'changeId', 'taskId', 'taskRevision', 'leaseGeneration', 'gateId']) delete legacy[field];
    await appendGateResult(root, changeId, terminal, legacy);

    expectExit(cli(root, 'status', '--change', changeId), 0, 'STATUS');
  }, 60_000);

  test('blocks a superficially matched settlement and result with no durable prepared-started-released chain', async () => {
    const root = await fixture();
    const changeId = 'mapped-terminal-without-chain';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    const state = cli(root, 'status', '--change', changeId).envelope.state as { run: { runId: string; lease: { inputTreeHash: string; taskRevision: number; generation: number } }; route: { gateDefinitionHash: string } };
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    const terminalEvent = await journal.append({
      changeId,
      taskId: 'task-1',
      taskRevision: state.run.lease.taskRevision,
      leaseGeneration: state.run.lease.generation,
      type: 'gate.attempt.settled',
      payload: {
        version: 3,
        attemptId: 'a'.repeat(64),
        runId: state.run.runId,
        changeId,
        taskId: 'task-1',
        taskRevision: state.run.lease.taskRevision,
        leaseGeneration: state.run.lease.generation,
        gateId: 'pass',
        repositoryIdentity: 'b'.repeat(64),
        preparedEventHash: 'c'.repeat(64),
        startedEventHash: 'd'.repeat(64),
        releasedEventHash: 'e'.repeat(64),
        gateDefinitionHash: state.route.gateDefinitionHash,
        inputTreeHash: state.run.lease.inputTreeHash,
        status: 'unknown',
        exitCode: null,
        outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' },
      },
    });
    const terminal = terminalEvent as GateTerminal;
    await commitControllerBatch({ repositoryRoot: root, changeId, journal, priorEvents: (await journal.replayStrict()).events, kind: 'gate-result', operations: [{ taskId: terminal.taskId, taskRevision: terminal.taskRevision, leaseGeneration: terminal.leaseGeneration, type: 'controller.gate.result', payload: boundGateResult(terminal) }] });

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test('does not roll forward a pending Gate-result batch before validating its raw terminal provenance', async () => {
    const root = await fixture();
    const changeId = 'pending-result-invalid-terminal';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    const state = cli(root, 'status', '--change', changeId).envelope.state as { run: { runId: string; lease: { inputTreeHash: string; taskRevision: number; generation: number } }; route: { gateDefinitionHash: string } };
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    const terminalEvent = await journal.append({
      changeId,
      taskId: 'task-1',
      taskRevision: state.run.lease.taskRevision,
      leaseGeneration: state.run.lease.generation,
      type: 'gate.attempt.settled',
      payload: {
        version: 3,
        attemptId: 'a'.repeat(64),
        runId: state.run.runId,
        changeId,
        taskId: 'task-1',
        taskRevision: state.run.lease.taskRevision,
        leaseGeneration: state.run.lease.generation,
        gateId: 'pass',
        repositoryIdentity: 'b'.repeat(64),
        preparedEventHash: 'c'.repeat(64),
        startedEventHash: 'd'.repeat(64),
        releasedEventHash: 'e'.repeat(64),
        gateDefinitionHash: state.route.gateDefinitionHash,
        inputTreeHash: state.run.lease.inputTreeHash,
        status: 'unknown',
        exitCode: null,
        outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' },
      },
    });
    const terminal = terminalEvent as GateTerminal;
    await expect(commitControllerBatch({
      repositoryRoot: root,
      changeId,
      journal,
      priorEvents: (await journal.replayStrict()).events,
      kind: 'gate-result',
      faultAt: 'after-batch-prepared',
      operations: [{ taskId: terminal.taskId, taskRevision: terminal.taskRevision, leaseGeneration: terminal.leaseGeneration, type: 'controller.gate.result', payload: boundGateResult(terminal) }],
    })).rejects.toThrow('Simulated crash at after-batch-prepared');
    const before = (await journal.replayStrict()).events.map((event) => event.eventHash);

    expectExit(cli(root, 'resume', '--change', changeId), 7, 'BLOCKED');
    expect((await journal.replayStrict()).events.map((event) => event.eventHash)).toEqual(before);
  }, 60_000);

  test('blocks ordinary reads when immutable evidence for an already mapped determinate settlement drifts', async () => {
    const root = await fixture();
    const changeId = 'mapped-evidence-drift';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 0, 'GATES_PASSED');
    const terminal = await latestGateTerminal(root, changeId);
    await writeFile(join(root, evidenceFilePath(changeId, terminal.payload.runId, terminal.payload.gateId)), '{"state":"corrupt"}\n');

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test.each([
    {
      label: 'repository identity',
      mutate: (phases: GatePhasePayloads) => {
        const repositoryIdentity = 'f'.repeat(64);
        const prepared = phases.prepared;
        const attemptId = fingerprint({ repositoryIdentity, changeId: prepared.changeId, runId: prepared.runId, gateId: prepared.gateId, taskId: prepared.taskId, taskRevision: prepared.taskRevision, leaseGeneration: prepared.leaseGeneration });
        for (const phase of Object.values(phases)) { phase.repositoryIdentity = repositoryIdentity; phase.attemptId = attemptId; }
      },
    },
    { label: 'deterministic attempt identity', mutate: (phases: GatePhasePayloads) => { for (const phase of Object.values(phases)) phase.attemptId = 'f'.repeat(64); } },
    { label: 'reviewed execution policy', mutate: (phases: GatePhasePayloads) => { const policy = phases.prepared.executionPolicy as Record<string, unknown>; phases.prepared.executionPolicy = { ...policy, timeoutSeconds: Number(policy.timeoutSeconds) + 1 }; } },
    { label: 'operation fingerprint', mutate: (phases: GatePhasePayloads) => { phases.prepared.operationFingerprint = 'f'.repeat(64); } },
    { label: 'input tree', mutate: (phases: GatePhasePayloads) => { phases.prepared.inputTreeHash = 'f'.repeat(64); phases.settled.inputTreeHash = 'f'.repeat(64); } },
  ])('blocks an already mapped settlement whose $label provenance is corrupt', async ({ label, mutate }) => {
    const root = await fixture();
    const changeId = `mapped-provenance-${digest(label).slice(0, 8)}`;
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    await rebuildMappedSettlementWithCorruption(root, changeId, mutate);

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test('keeps the real committed thrown-indeterminate history readable and reconcilable', async () => {
    const root = await fixture('missing');
    const changeId = 'real-standalone-unknown';
    await executing(root, changeId, 'missing');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 7, 'BLOCKED');

    expectExit(cli(root, 'status', '--change', changeId), 0, 'STATUS');
    expectExit(cli(root, 'inspect', '--change', changeId), 0, 'INSPECTED');
    const context = (cli(root, 'status', '--change', changeId).envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const reconciliation = await receipt({
      receiptId: 'real-standalone-unknown-reconciliation',
      runId: context.runId,
      taskId: context.taskId,
      taskRevision: context.taskRevision,
      leaseGeneration: context.leaseGeneration,
      operationFingerprint: context.operationFingerprint,
      inputTreeHash: context.inputTreeHash,
      evidenceHashes: context.evidenceHashes,
      resolvedRunState: 'abandoned',
      sideEffectDisposition: 'not-started',
      safeToRetry: true,
      provenance: 'human-confirmed',
      actorLabel: 'test',
      timestamp: issuedAt(),
      expiresAt: expiresAt(),
    });
    expectExit(cli(root, 'reconcile', '--change', changeId, '--receipt', reconciliation), 7, 'BLOCKED');
  }, 60_000);

  test('preserves not-started safe abandonment for a valid legacy unknown prefix with no durable Gate release', async () => {
    const root = await fixture('missing');
    const changeId = 'legacy-unreleased-unknown';
    await executing(root, changeId, 'missing');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 7, 'BLOCKED');
    await rebuildThrownUnknownHistory(root, changeId, { omitReleased: true });
    const status = cli(root, 'status', '--change', changeId); expectExit(status, 0, 'STATUS');
    const context = (status.envelope.state as { reconciliationContext: Record<string, unknown> }).reconciliationContext;
    const reconciliation = await receipt({
      receiptId: 'legacy-unreleased-safe-abandoned', runId: context.runId, taskId: context.taskId,
      taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration,
      operationFingerprint: context.operationFingerprint, inputTreeHash: context.inputTreeHash,
      evidenceHashes: context.evidenceHashes, resolvedRunState: 'abandoned', sideEffectDisposition: 'not-started',
      safeToRetry: true, provenance: 'human-confirmed', actorLabel: 'test', timestamp: issuedAt(), expiresAt: expiresAt(),
    });
    const reconciled = cli(root, 'reconcile', '--change', changeId, '--receipt', reconciliation);
    expectExit(reconciled, 0, 'RUN_RECONCILED_UNAUTHENTICATED');
    expect(reconciled.envelope.state).toMatchObject({ changeState: 'executing', tasks: { 'task-1': { state: 'ready' } }, leases: { 'task-1': { active: false } } });
  }, 60_000);

  test.each([
    { label: 'route', eventType: 'route.selected' as const },
    { label: 'Run claim', eventType: 'run.claimed' as const },
  ])('blocks standalone unknown when its $label authority is committed only after Gate prepared', async ({ label, eventType }) => {
    const root = await fixture('missing');
    const changeId = `late-${label.replace(/\s+/g, '-').toLowerCase()}-authority`;
    await executing(root, changeId, 'missing');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 7, 'BLOCKED');
    await rebuildThrownUnknownHistory(root, changeId, { moveAuthority: eventType });

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test.each([
    {
      label: 'Task is no longer implementing',
      mutation: (changeId: string, claim: JournalEvent, claimed: Record<string, unknown>) => ({ changeId, taskId: claim.taskId, taskRevision: claim.taskRevision, leaseGeneration: claim.leaseGeneration, type: 'task.transition', payload: { from: 'implementing', to: 'ready' } }),
    },
    {
      label: 'Run is no longer running',
      mutation: (changeId: string, claim: JournalEvent, claimed: Record<string, unknown>) => ({ changeId, taskId: claim.taskId, taskRevision: claim.taskRevision, leaseGeneration: claim.leaseGeneration, type: 'run.transition', payload: { runId: claimed.runId, from: 'running', to: 'failed' } }),
    },
    {
      label: 'matching lease is inactive',
      mutation: (changeId: string, claim: JournalEvent, claimed: Record<string, unknown>) => ({ changeId, taskId: claim.taskId, taskRevision: claim.taskRevision, leaseGeneration: claim.leaseGeneration, type: 'lease.released', payload: { lease: claimed.lease, reason: 'corrupt-history-fixture' } }),
    },
    {
      label: 'a different lease generation is active',
      mutation: (changeId: string, claim: JournalEvent, claimed: Record<string, unknown>) => {
        const lease = claimed.lease as Record<string, unknown>;
        return { changeId, taskId: claim.taskId, taskRevision: claim.taskRevision, leaseGeneration: Number(claim.leaseGeneration) + 1, type: 'lease.claimed', payload: { lease: { ...lease, generation: Number(lease.generation) + 1 } } };
      },
    },
    {
      label: 'Change differs from recorded prior state',
      mutation: (changeId: string) => ({ changeId, type: 'change.transition', payload: { from: 'executing', to: 'discovery' } }),
    },
  ])('blocks standalone unknown when immediately before its batch $label', async ({ label, mutation }) => {
    const root = await fixture('missing');
    const changeId = `wrong-prebatch-${digest(label).slice(0, 8)}`;
    await executing(root, changeId, 'missing');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 7, 'BLOCKED');
    await rebuildThrownUnknownHistory(root, changeId, {
      appendBeforeUnknown: (logical) => {
        const claim = logical.find((event) => event.type === 'run.claimed')!;
        return [mutation(changeId, claim, claim.payload as Record<string, unknown>)];
      },
    });

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test('blocks an orphan standalone unknown-outcome result without a durable prepared attempt and mapping context', async () => {
    const root = await fixture();
    const changeId = 'orphan-standalone-unknown';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    const state = cli(root, 'status', '--change', changeId).envelope.state as { run: { runId: string; lease: { taskRevision: number; generation: number } } };
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    await commitControllerBatch({
      repositoryRoot: root,
      changeId,
      journal,
      priorEvents: (await journal.replayStrict()).events,
      kind: 'unknown-outcome',
      operations: [{
        taskId: 'task-1',
        taskRevision: state.run.lease.taskRevision,
        leaseGeneration: state.run.lease.generation,
        type: 'controller.gate.result',
        payload: { runId: state.run.runId, status: 'unknown', outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' }, error: 'indeterminate fixture' },
      }],
    });

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test('blocks an orphan Run-unknown context without a Controller Gate result', async () => {
    const root = await fixture();
    const changeId = 'orphan-standalone-context';
    await executing(root, changeId, 'pass');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    const state = cli(root, 'status', '--change', changeId).envelope.state as { run: { runId: string; lease: { inputTreeHash: string; taskRevision: number; generation: number } } };
    await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).append({
      changeId,
      taskId: 'task-1',
      taskRevision: state.run.lease.taskRevision,
      leaseGeneration: state.run.lease.generation,
      type: 'run.unknown.context',
      payload: {
        runId: state.run.runId,
        taskId: 'task-1',
        taskRevision: state.run.lease.taskRevision,
        leaseGeneration: state.run.lease.generation,
        operationFingerprint: 'a'.repeat(64),
        inputTreeHash: state.run.lease.inputTreeHash,
        evidenceHashes: ['b'.repeat(64)],
        priorChangeState: 'executing',
        resumeTaskStateOnSuccess: 'verifying',
        retryRemaining: true,
      },
    });

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test('blocks a standalone unknown-outcome history with a duplicate durable prepared attempt', async () => {
    const root = await fixture('missing');
    const changeId = 'duplicate-standalone-prepared';
    await executing(root, changeId, 'missing');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 7, 'BLOCKED');
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    const prepared = (await journal.replayStrict()).events.find((event) => event.type === 'gate.attempt.prepared')!;
    await journal.append({ changeId, taskId: prepared.taskId, taskRevision: prepared.taskRevision, leaseGeneration: prepared.leaseGeneration, type: prepared.type, payload: prepared.payload });

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test('blocks a standalone unknown-outcome history with a duplicate mismatched unknown context', async () => {
    const root = await fixture('missing');
    const changeId = 'mismatched-standalone-context';
    await executing(root, changeId, 'missing');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 7, 'BLOCKED');
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    const context = projectJournalEvents((await journal.replayStrict()).events).events.find((event) => event.type === 'run.unknown.context')!;
    await journal.append({ changeId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration, type: context.type, payload: { ...(context.payload as Record<string, unknown>), inputTreeHash: 'f'.repeat(64) } });

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test('blocks a standalone unknown-outcome history with a duplicate mismatched Run claim', async () => {
    const root = await fixture('missing');
    const changeId = 'mismatched-standalone-claim';
    await executing(root, changeId, 'missing');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1'), 7, 'BLOCKED');
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    const claim = projectJournalEvents((await journal.replayStrict()).events).events.find((event) => event.type === 'run.claimed')!;
    const payload = structuredClone(claim.payload) as { runId: string; lease: Record<string, unknown>; operationFingerprint: string };
    payload.lease = { ...payload.lease, generation: Number(payload.lease.generation) + 1, inputTreeHash: 'f'.repeat(64) };
    await journal.append({ changeId, taskId: claim.taskId, taskRevision: claim.taskRevision, leaseGeneration: Number(claim.leaseGeneration) + 1, type: claim.type, payload });

    expectBlockedStatusAndInspect(root, changeId);
  }, 60_000);

  test('keeps missing-change dry and actual resume side-effect free, then permits initialization with the same id', async () => {
    const root = await fixture();
    const before = await treeDigest(root);
    expectExit(cli(root, 'resume', '--change', 'missing-resume', '--dry-run'), 8, 'PREREQUISITE_FAILED');
    expect(await treeDigest(root)).toBe(before);
    expectExit(cli(root, 'resume', '--change', 'missing-resume'), 8, 'PREREQUISITE_FAILED');
    expect(await treeDigest(root)).toBe(before);
    expectExit(cli(root, 'init', '--change', 'missing-resume', '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
  }, 20_000);

  test('maps a crash after durable approval denial without running argv or leaving lifecycle state active', async () => {
    const root = await fixture();
    const changeId = 'approval-denied-handoff';
    const invocation = join(root, 'must-not-run');
    await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{ id: 'approved', argv: [process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(invocation)}, 'ran')`], cwd: '.', timeoutSeconds: 10, required: true, replaySafety: 'idempotent', effectClass: 'external-write', network: 'approval-required', environmentAllowlist: [], declaredWritePaths: ['must-not-run'] }] }));
    await executing(root, changeId, 'approved');
    expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1'), 0, 'CLAIMED');
    const state = cli(root, 'status', '--change', changeId).envelope.state as { run: { runId: string; lease: { inputTreeHash: string; generation: number; taskRevision: number } }; route: { gateDefinitionHash: string } };
    const registry = await GateRegistry.fromYaml(join(root, 'core/gates/default.yaml'));
    const request = { repositoryRoot: root, registry, gateId: 'approved', expectedInputTreeHash: state.run.lease.inputTreeHash, expectedGateDefinitionHash: state.route.gateDefinitionHash, runId: state.run.runId, changeId, taskId: 'task-1', taskRevision: state.run.lease.taskRevision, leaseGeneration: state.run.lease.generation, maxOutputBytes: 64 * 1024 };
    const fields = approvalFingerprintFields(request, registry.get('approved'), await realpath(root));
    const approval = { receiptId: 'short-controller-approval', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2026-09-04T11:59:00.000Z', expiresAt: '2026-09-04T12:01:00.000Z', changeId, taskId: 'task-1', scope: 'gate', operationKind: 'gate-run', ...fields };
    const times = ['2026-09-04T12:00:00.000Z', '2026-09-04T12:00:10.000Z', '2026-09-04T12:00:20.000Z', '2026-09-04T12:02:00.000Z'];
    const expiryRunner = new GateRunner({ networkIsolation: passthroughIsolation, clock: () => new Date(times.shift() ?? '2026-09-04T12:02:00.000Z') });
    await expect(expiryRunner.run({ ...request, approvalReceipt: approval })).resolves.toMatchObject({ status: 'approval-expired' });
    expectExit(cli(root, 'status', '--change', changeId), 7, 'BLOCKED');

    const resumed = cli(root, 'resume', '--change', changeId);
    expectExit(resumed, 0, 'RESUMED');
    expect(resumed.envelope.state).toMatchObject({ changeState: 'approval-required', tasks: { 'task-1': { state: 'blocked' } }, runs: { [state.run.runId]: { state: 'cancelled' } }, leases: { 'task-1': { active: false } } });
    await expect(access(invocation)).rejects.toMatchObject({ code: 'ENOENT' });
    expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
  }, 30_000);
});
