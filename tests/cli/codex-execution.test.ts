import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const later = () => new Date(Date.now() + 60 * 60_000).toISOString();

type Envelope = { ok: boolean; code: string; state: any; errors: Array<{ message: string }> };
function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 15_000, killSignal: 'SIGKILL' });
  expect(result.error).toBeUndefined();
  return { status: result.status ?? 9, envelope: JSON.parse(result.stdout.trim()) as Envelope };
}
function expectExit(result: ReturnType<typeof cli>, status: number, code: string): void { expect(result.status, JSON.stringify(result.envelope)).toBe(status); expect(result.envelope.code).toBe(code); }
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-c2-fixture-')); temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'approved.md'), '# fixture\n');
  await writeFile(join(root, 'core/gates/default.yaml'), [
    'gates:',
    `  - id: pass\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []`,
    `  - id: fail\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(1)"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []`,
    `  - id: toggle\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(require('node:fs').existsSync('pass.flag') ? 0 : 1)"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []`,
    '  - id: missing\n    argv: ["/definitely/missing/leo-dev-c2-gate"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: approval-required\n    environmentAllowlist: []\n    declaredWritePaths: []',
  ].join('\n'));
  return root;
}
async function receipt(_root: string, value: object): Promise<string> { const path = join(tmpdir(), `leo-dev-c2-receipt-${randomUUID()}.json`); temporary.push(path); await writeFile(path, JSON.stringify(value)); return path; }
async function approve(root: string, change: string): Promise<void> { const context = cli(root, 'status', '--change', change).envelope.state.approvalContext; const path = await receipt(root, { receiptId: `approve-${change}`, provenance: 'human-confirmed', actorLabel: 'fixture', decision: 'grant', grantedAt: now(), expiresAt: later(), changeId: change, scope: 'change', operationKind: 'spec-approval', ...context }); expectExit(cli(root, 'approve', '--change', change, '--receipt', path), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED'); }
async function runMissingGate(root: string, change: string): Promise<ReturnType<typeof cli>> {
  const preview = cli(root, 'run-gates', '--change', change, '--task', 'task', '--dry-run'); expectExit(preview, 0, 'DRY_RUN');
  const { runId: _runId, gateId: _gateId, taskRevision: _taskRevision, leaseGeneration: _leaseGeneration, ...context } = preview.envelope.state.gateApprovalContext;
  const approval = await receipt(root, { receiptId: `gate-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture gate approval; issuer not authenticated', decision: 'grant', grantedAt: now(), expiresAt: later(), scope: 'gate', operationKind: 'gate-run', ...context });
  return cli(root, 'run-gates', '--change', change, '--task', 'task', '--approval-receipt', approval);
}
async function executingPlan(root: string, change: string): Promise<void> {
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [
    { id: 'a', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['a'], gateIds: ['pass'], risk: 'lite' },
    { id: 'b', revision: 1, state: 'pending', dependsOn: ['a'], allowedPaths: ['src/b.ts'], acceptance: ['b'], gateIds: ['pass'], risk: 'lite' },
    { id: 'c', revision: 1, state: 'pending', dependsOn: ['b'], allowedPaths: ['src/c.ts'], acceptance: ['c'], gateIds: ['pass'], risk: 'lite' },
  ] }));
  expectExit(cli(root, 'init', '--change', change, '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', change, '--plan', 'plan.json'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED'); await approve(root, change);
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
}
async function executingToggle(root: string, change: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', change, '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', change, '--task', 'task', '--gate', 'toggle'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED'); await approve(root, change);
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
}
async function executingMissing(root: string, change: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', change, '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', change, '--task', 'task', '--gate', 'missing'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED'); await approve(root, change);
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
}
async function reconcileFailed(root: string, change: string): Promise<Envelope> {
  const context = cli(root, 'status', '--change', change).envelope.state.reconciliationContext;
  const path = await receipt(root, { receiptId: randomUUID(), runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration, operationFingerprint: context.operationFingerprint, inputTreeHash: context.inputTreeHash, evidenceHashes: context.evidenceHashes, resolvedRunState: 'failed', sideEffectDisposition: 'failed', safeToRetry: true, provenance: 'human-confirmed', actorLabel: 'fixture', timestamp: now(), expiresAt: later() });
  const reconciled = cli(root, 'reconcile', '--change', change, '--receipt', path); expectExit(reconciled, 0, 'RUN_RECONCILED_UNAUTHENTICATED'); return reconciled.envelope;
}
async function abandonedReceipt(root: string, change: string, disposition: 'failed' | 'not-started' | 'side-effects-absent'): Promise<string> {
  const context = cli(root, 'status', '--change', change).envelope.state.reconciliationContext;
  return receipt(root, { receiptId: randomUUID(), runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration, operationFingerprint: context.operationFingerprint, inputTreeHash: context.inputTreeHash, evidenceHashes: context.evidenceHashes, resolvedRunState: 'abandoned', sideEffectDisposition: disposition, safeToRetry: true, provenance: 'human-confirmed', actorLabel: 'fixture', timestamp: now(), expiresAt: later() });
}
async function passReview(root: string, change: string, task: string, verdict: 'pass' | 'reject' = 'pass', session = 'fixture-review'): Promise<Envelope> {
  const claim = cli(root, 'claim', '--change', change, '--task', task, '--session', `claim-${session}`); expectExit(claim, 0, 'CLAIMED');
  await mkdir(join(root, 'src'), { recursive: true }); await writeFile(join(root, 'src', `${task}.ts`), `// ${task} ${session}\n`);
  expectExit(cli(root, 'run-gates', '--change', change, '--task', task, '--run', claim.envelope.state.run.runId, '--dry-run'), 0, 'DRY_RUN');
  expectExit(cli(root, 'run-gates', '--change', change, '--task', task, '--run', claim.envelope.state.run.runId), 0, 'GATES_PASSED'); expectExit(cli(root, 'submit', '--change', change, '--task', task), 0, 'SUBMITTED_FOR_REVIEW');
  const context = cli(root, 'status', '--change', change).envelope.state.reviewContext;
  const path = await receipt(root, { receiptId: randomUUID(), provenance: 'platform-attested', actorLabel: 'fixture', sessionId: session, runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration, specHash: context.specHash, taskHash: context.taskHash, treeHash: context.treeHash, findingsHash: hash(verdict), verdict, timestamp: now(), expiresAt: later() });
  const reviewed = cli(root, 'review', '--change', change, '--task', task, '--receipt', path); expectExit(reviewed, 0, verdict === 'pass' ? 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED' : 'REVIEW_REJECTED'); return reviewed.envelope;
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('synthetic A to B to C plan keeps C pending through B rejection then unlocks it after B pass', async () => {
  const root = await fixture(); await executingPlan(root, 'plan');
  expectExit(cli(root, 'claim', '--change', 'plan', '--task', 'b'), 3, 'TRANSITION_FORBIDDEN');
  const afterA = await passReview(root, 'plan', 'a'); expect(afterA.state.tasks).toMatchObject({ a: { state: 'done' }, b: { state: 'ready' }, c: { state: 'pending' } });
  const afterReject = await passReview(root, 'plan', 'b', 'reject', 'reject-b'); expect(afterReject.state.tasks).toMatchObject({ b: { state: 'remediation' }, c: { state: 'pending' } });
  const afterB = await passReview(root, 'plan', 'b', 'pass', 'pass-b'); expect(afterB.state.tasks).toMatchObject({ b: { state: 'done' }, c: { state: 'ready' } });
  const afterC = await passReview(root, 'plan', 'c'); expect(afterC.state.changeState).toBe('integration-review');
}, 60_000);

test('synthetic identical review findings block as no-progress', async () => {
  const root = await fixture(); await executingToggle(root, 'same-findings');
  await writeFile(join(root, 'pass.flag'), 'pass\n');
  const first = await passReview(root, 'same-findings', 'task', 'reject', 'reject-1');
  expect(first.state.changeState).not.toBe('blocked');
  expect(first.state.attempts.task).toMatchObject({ consumed: 1, maximum: null, nextKind: 'remediation' });
  const second = await passReview(root, 'same-findings', 'task', 'reject', 'reject-2');
  expect(second.code).toBe('REVIEW_REJECTED');
  expect(second.state).toMatchObject({ changeState: 'blocked', tasks: { task: { state: 'blocked' } }, attempts: { task: { consumed: 2, nextKind: 'blocked' } } });
  expect(second.state.blockers.join(' ')).toContain('no-progress');
}, 60_000);

test('synthetic distinct review findings keep remediating past four attempts', async () => {
  const root = await fixture(); await executingToggle(root, 'new-findings');
  await writeFile(join(root, 'pass.flag'), 'pass\n');
  for (const n of [1, 2, 3, 4]) {
    const claim = cli(root, 'claim', '--change', 'new-findings', '--task', 'task', '--session', `s${n}`); expectExit(claim, 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', 'new-findings', '--task', 'task', '--run', claim.envelope.state.run.runId), 0, 'GATES_PASSED');
    expectExit(cli(root, 'submit', '--change', 'new-findings', '--task', 'task'), 0, 'SUBMITTED_FOR_REVIEW');
    const context = cli(root, 'status', '--change', 'new-findings').envelope.state.reviewContext;
    const rejected = await receipt(root, { receiptId: `reject-${n}`, provenance: 'platform-attested', actorLabel: 'fixture', sessionId: `review-${n}`, runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration, specHash: context.specHash, taskHash: context.taskHash, treeHash: context.treeHash, findingsHash: hash(`reject-${n}`), verdict: 'reject', timestamp: now(), expiresAt: later() });
    expectExit(cli(root, 'review', '--change', 'new-findings', '--task', 'task', '--receipt', rejected), 0, 'REVIEW_REJECTED');
    expect(cli(root, 'status', '--change', 'new-findings').envelope.state.changeState).not.toBe('blocked');
  }
  const fifth = cli(root, 'claim', '--change', 'new-findings', '--task', 'task', '--session', 's5');
  expectExit(fifth, 0, 'CLAIMED');
  expect(fifth.envelope.state).toMatchObject({ changeState: 'executing', attempts: { task: { consumed: 4, maximum: null, nextKind: 'remediation' } }, run: { attemptKind: 'remediation' } });
}, 60_000);

test('synthetic ordinary claim without session still follows lease rules after a failure', async () => {
  const root = await fixture(); await executingToggle(root, 'missing-session');
  let claim = cli(root, 'claim', '--change', 'missing-session', '--task', 'task', '--session', 's1'); expectExit(claim, 0, 'CLAIMED');
  expectExit(cli(root, 'run-gates', '--change', 'missing-session', '--task', 'task'), 4, 'GATE_FAILED');
  expectExit(cli(root, 'claim', '--change', 'missing-session', '--task', 'task', '--dry-run'), 0, 'DRY_RUN');
  claim = cli(root, 'claim', '--change', 'missing-session', '--task', 'task'); expectExit(claim, 0, 'CLAIMED');
  expect(claim.envelope.state.run.attemptKind).toBe('remediation');
  expectExit(cli(root, 'claim', '--change', 'missing-session', '--task', 'task', '--dry-run'), 5, 'CONFLICT');
}, 60_000);

test('synthetic reconciled failed unknown attempts block the second hashless failure', async () => {
  const root = await fixture(); await executingMissing(root, 'unknown-budget');
  expectExit(cli(root, 'claim', '--change', 'unknown-budget', '--task', 'task', '--session', 'u1'), 0, 'CLAIMED');
  expectExit(await runMissingGate(root, 'unknown-budget'), 7, 'BLOCKED');
  const first = await reconcileFailed(root, 'unknown-budget');
  expect(first.state).toMatchObject({ changeState: 'executing', tasks: { task: { state: 'remediation' } }, leases: { task: { active: false } }, attempts: { task: { consumed: 1, nextKind: 'remediation' } } });
  expectExit(cli(root, 'claim', '--change', 'unknown-budget', '--task', 'task', '--session', 'u2'), 0, 'CLAIMED');
  expectExit(await runMissingGate(root, 'unknown-budget'), 7, 'BLOCKED');
  const second = await reconcileFailed(root, 'unknown-budget');
  expect(second.state).toMatchObject({ changeState: 'blocked', tasks: { task: { state: 'blocked' } }, leases: { task: { active: false } }, attempts: { task: { consumed: 2, nextKind: 'blocked' } } });
  expect(second.state.blockers.join(' ')).toContain('no-progress');
}, 90_000);

test.each([
  ['not-started', 'abandonednotstarted'],
  ['side-effects-absent', 'abandonedabsent'],
  ['failed', 'abandonedfailed'],
] as const)('synthetic reconciliation rejects %s receipt after durable Gate release without resetting budget or lease', async (disposition, change) => {
  const root = await fixture(); await executingMissing(root, change);
  expectExit(cli(root, 'claim', '--change', change, '--task', 'task', '--session', 'fixture'), 0, 'CLAIMED');
  expectExit(await runMissingGate(root, change), 7, 'BLOCKED');
  const journal = join(root, '.leo-dev/runtime', change, 'journal.ndjson'); const before = await readFile(journal, 'utf8'); expect(before).toContain('gate.attempt.released');
  const path = await abandonedReceipt(root, change, disposition);
  expectExit(cli(root, 'reconcile', '--change', change, '--receipt', path, '--dry-run'), 7, 'BLOCKED'); expect(await readFile(journal, 'utf8')).toBe(before);
  expectExit(cli(root, 'reconcile', '--change', change, '--receipt', path), 7, 'BLOCKED'); expect(await readFile(journal, 'utf8')).toBe(before);
  expect(cli(root, 'status', '--change', change).envelope.state).toMatchObject({ changeState: 'approval-required', tasks: { task: { state: 'blocked' } }, leases: { task: { active: true } }, attempts: { task: { consumed: 0 } } });
}, 60_000);

test('synthetic review receipt IDs are single-use even when a later candidate has refreshed binding fields', async () => {
  const root = await fixture(); await executingToggle(root, 'review-replay'); await writeFile(join(root, 'pass.flag'), 'pass\n');
  for (const session of ['one', 'two']) {
    const claim = cli(root, 'claim', '--change', 'review-replay', '--task', 'task', '--session', session); expectExit(claim, 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', 'review-replay', '--task', 'task', '--run', claim.envelope.state.run.runId), 0, 'GATES_PASSED');
    expectExit(cli(root, 'submit', '--change', 'review-replay', '--task', 'task'), 0, 'SUBMITTED_FOR_REVIEW');
    const context = cli(root, 'status', '--change', 'review-replay').envelope.state.reviewContext;
    const path = await receipt(root, { receiptId: 'reused-review-id', provenance: 'platform-attested', actorLabel: 'fixture', sessionId: `review-${session}`, runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration, specHash: context.specHash, taskHash: context.taskHash, treeHash: context.treeHash, findingsHash: hash(session), verdict: 'reject', timestamp: now(), expiresAt: later() });
    const review = cli(root, 'review', '--change', 'review-replay', '--task', 'task', '--receipt', path);
    if (session === 'one') expectExit(review, 0, 'REVIEW_REJECTED');
    else {
      expectExit(cli(root, 'review', '--change', 'review-replay', '--task', 'task', '--receipt', path, '--dry-run'), 5, 'CONFLICT');
      expectExit(review, 5, 'CONFLICT');
    }
  }
  expect(cli(root, 'status', '--change', 'review-replay').envelope.state.attempts.task).toMatchObject({ consumed: 1, nextKind: 'remediation' });
}, 60_000);

test('journaled lite review rejects same-session agent-asserted provenance', async () => {
  const root = await fixture(); await executingPlan(root, 'lite-review');
  const claim = cli(root, 'claim', '--change', 'lite-review', '--task', 'a', '--session', 'same');
  expectExit(claim, 0, 'CLAIMED');
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src/a.ts'), '// a\n');
  expectExit(cli(root, 'run-gates', '--change', 'lite-review', '--task', 'a', '--run', claim.envelope.state.run.runId), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', 'lite-review', '--task', 'a'), 0, 'SUBMITTED_FOR_REVIEW');
  const context = cli(root, 'status', '--change', 'lite-review').envelope.state.reviewContext;
  const path = await receipt(root, {
    receiptId: randomUUID(), provenance: 'agent-asserted', actorLabel: 'same-session',
    sessionId: 'same', runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision,
    leaseGeneration: context.leaseGeneration, specHash: context.specHash, taskHash: context.taskHash,
    treeHash: context.treeHash, findingsHash: hash('pass'), verdict: 'pass', timestamp: now(), expiresAt: later(),
  });
  expectExit(cli(root, 'review', '--change', 'lite-review', '--task', 'a', '--receipt', path), 5, 'CONFLICT');
}, 60_000);

test('journaled review rejects platform-attested provenance when claim omitted session', async () => {
  const root = await fixture(); await executingPlan(root, 'missing-claim-session');
  const claim = cli(root, 'claim', '--change', 'missing-claim-session', '--task', 'a');
  expectExit(claim, 0, 'CLAIMED');
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src/a.ts'), '// a\n');
  expectExit(cli(root, 'run-gates', '--change', 'missing-claim-session', '--task', 'a', '--run', claim.envelope.state.run.runId), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', 'missing-claim-session', '--task', 'a'), 0, 'SUBMITTED_FOR_REVIEW');
  const context = cli(root, 'status', '--change', 'missing-claim-session').envelope.state.reviewContext;
  const path = await receipt(root, {
    receiptId: randomUUID(), provenance: 'platform-attested', actorLabel: 'reviewer',
    sessionId: 'reviewer', runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision,
    leaseGeneration: context.leaseGeneration, specHash: context.specHash, taskHash: context.taskHash,
    treeHash: context.treeHash, findingsHash: hash('pass'), verdict: 'pass', timestamp: now(), expiresAt: later(),
  });
  expectExit(cli(root, 'review', '--change', 'missing-claim-session', '--task', 'a', '--receipt', path), 5, 'CONFLICT');
}, 60_000);
