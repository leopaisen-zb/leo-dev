import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { afterEach, expect, test } from 'vitest';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
type Envelope = { ok: boolean; code: string; state: Record<string, any> | null; errors: Array<{ code: string; message: string }> };

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope; stderr: string } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
  expect(result.error, result.error?.message).toBeUndefined();
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  expect(lines, `stdout=${result.stdout}\nstderr=${result.stderr}`).toHaveLength(1);
  return { status: result.status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope, stderr: result.stderr };
}

function expectExit(actual: ReturnType<typeof cli>, status: number, code: string): void {
  expect(actual.status, JSON.stringify(actual.envelope)).toBe(status);
  expect(actual.envelope.ok).toBe(status === 0);
  expect(actual.envelope.code).toBe(code);
  expect(actual.stderr).toBe('');
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-gate-approval-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true }); await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{
    id: 'approved-network', argv: [process.execPath, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 10,
    required: true, replaySafety: 'idempotent', effectClass: 'network-read', network: 'approval-required', environmentAllowlist: [], declaredWritePaths: [],
  }] }));
  await writeFile(join(root, 'spec.md'), '# Gate approval fixture\n');
  await writeFile(join(root, 'src/app.ts'), 'export const release = false;\n');
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'task-1', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['approved network gate passes'], gateIds: ['approved-network'], risk: 'lite' }] }));
  return root;
}

async function receipt(root: string, value: unknown): Promise<string> {
  const path = join(root, '.leo-dev/runtime', `receipt-${randomUUID()}.json`);
  await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, JSON.stringify(value));
  return path;
}

async function activate(root: string, changeId: string): Promise<Record<string, any>> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'plan.json'), 0, 'ROUTED_LITE');
  for (const state of ['discovery', 'spec-review']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
  const approvalContext = cli(root, 'status', '--change', changeId).envelope.state!.approvalContext;
  const approval = await receipt(root, {
    receiptId: `spec-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'fixture authority', decision: 'grant',
    grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    changeId, scope: 'change', operationKind: 'spec-approval', ...approvalContext,
  });
  expectExit(cli(root, 'approve', '--change', changeId, '--receipt', approval), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-1', '--session', 'approved-gate-producer'), 0, 'CLAIMED');
  return cli(root, 'status', '--change', changeId).envelope.state!;
}

async function gateReceipt(root: string, context: Record<string, unknown>, overrides: Record<string, unknown> = {}): Promise<string> {
  const { runId: _runId, gateId: _gateId, taskRevision: _taskRevision, leaseGeneration: _leaseGeneration, ...receiptContext } = context;
  return receipt(root, {
    receiptId: `gate-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'fixture authority', decision: 'grant',
    grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    scope: 'gate', operationKind: 'gate-run', ...receiptContext, ...overrides,
  });
}

function journal(root: string, changeId: string): string { return join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); }

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('returns the exact gate approval context and only the approval-receipt prerequisite for a write-free network-gate dry run', async () => {
  const root = await fixture(); const changeId = 'gate-dry-context'; const state = await activate(root, changeId);
  const before = await readFile(journal(root, changeId), 'utf8');
  const dry = cli(root, 'run-gates', '--change', changeId, '--task', 'task-1', '--run', state.run.runId, '--dry-run');
  expectExit(dry, 0, 'DRY_RUN');
  expect(dry.envelope.state!.gateApprovalContext).toEqual(state.gateApprovalContext);
  expect(dry.envelope.state!).toMatchObject({ missingPrerequisites: ['approval-receipt'] });
  expect(await readFile(journal(root, changeId), 'utf8')).toBe(before);
}, 40_000);

test.each([
  ['missing', undefined, 6, 'APPROVAL_REQUIRED'],
  ['wrong', { inputFingerprint: createHash('sha256').update('wrong input').digest('hex') }, 6, 'APPROVAL_REQUIRED'],
  ['expired', { expiresAt: new Date(Date.now() - 1_000).toISOString() }, 2, 'SCHEMA_INVALID'],
] as const)('never registers a candidate or releases argv for a %s network-gate receipt', async (_label, overrides, exit, code) => {
  const root = await fixture(); const changeId = `gate-${_label}`; const state = await activate(root, changeId);
  const before = await readFile(journal(root, changeId), 'utf8');
  const supplied = overrides === undefined ? [] : ['--approval-receipt', await gateReceipt(root, state.gateApprovalContext, overrides)];
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1', '--run', state.run.runId, ...supplied), exit, code);
  const after = await readFile(journal(root, changeId), 'utf8');
  expect(after).toBe(before);
  expect(after).not.toContain('controller.candidate.registered');
  expect(after).not.toContain('gate.attempt.released');
}, 40_000);

test('uses the gate context for the changed candidate: exact receipt succeeds and wrong input remains write-free', async () => {
  const root = await fixture(); const changeId = 'gate-changed-candidate'; const state = await activate(root, changeId);
  await writeFile(join(root, 'src/app.ts'), 'export const release = true;\n');
  const preview = cli(root, 'run-gates', '--change', changeId, '--task', 'task-1', '--run', state.run.runId, '--dry-run');
  expectExit(preview, 0, 'DRY_RUN');
  const context = preview.envelope.state!.gateApprovalContext as Record<string, unknown>;
  const wrong = await gateReceipt(root, context, { inputFingerprint: createHash('sha256').update('wrong candidate').digest('hex') });
  const beforeWrong = await readFile(journal(root, changeId), 'utf8');
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1', '--run', state.run.runId, '--approval-receipt', wrong), 6, 'APPROVAL_REQUIRED');
  expect(await readFile(journal(root, changeId), 'utf8')).toBe(beforeWrong);
  const exact = await gateReceipt(root, context);
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1', '--run', state.run.runId, '--approval-receipt', exact), 0, 'GATES_PASSED');
}, 40_000);

test('persists a consumed gate authorization ID and refuses the same ID as a later review receipt', async () => {
  const root = await fixture(); const changeId = 'gate-receipt-id-reserved'; const state = await activate(root, changeId);
  const sharedReceiptId = `shared-${randomUUID()}`;
  const approval = await gateReceipt(root, state.gateApprovalContext, { receiptId: sharedReceiptId });
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-1', '--run', state.run.runId, '--approval-receipt', approval), 0, 'GATES_PASSED');
  const path = journal(root, changeId); expect(await readFile(path, 'utf8')).toContain(sharedReceiptId);
  expectExit(cli(root, 'submit', '--change', changeId, '--task', 'task-1'), 0, 'SUBMITTED_FOR_REVIEW');
  const reviewContext = cli(root, 'status', '--change', changeId).envelope.state!.reviewContext;
  const replayed = await receipt(root, {
    ...reviewContext, receiptId: sharedReceiptId, provenance: 'agent-asserted', actorLabel: 'fixture reviewer', sessionId: 'fixture-reviewer',
    findingsHash: createHash('sha256').update('no findings').digest('hex'), verdict: 'pass', timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const beforeReview = await readFile(path, 'utf8');
  expectExit(cli(root, 'review', '--change', changeId, '--task', 'task-1', '--receipt', replayed), 5, 'CONFLICT');
  expect(await readFile(path, 'utf8')).toBe(beforeReview);
}, 40_000);
