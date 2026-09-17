import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { afterEach, expect, test } from 'vitest';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { projectJournalEvents } from '../../packages/cli/src/state/snapshot.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

type Envelope = { ok: boolean; code: string; state: Record<string, any> | null; errors: Array<{ code: string; message: string }> };

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  return cliFrom(repository, root, ...args);
}

function cliFrom(cwd: string, root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
  expect(result.error, result.error?.message).toBeUndefined();
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  expect(lines, `stderr=${result.stderr}`).toHaveLength(1);
  return { status: result.status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope };
}

function expectExit(actual: ReturnType<typeof cli>, status: number, code: string): void {
  expect(actual.status, JSON.stringify(actual.envelope)).toBe(status);
  expect(actual.envelope.code).toBe(code);
}

async function fixture(risk: 'standard' | 'full' = 'standard'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-design-')); temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true }); await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{ id: 'pass', argv: [process.execPath, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 10, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }] }));
  await writeFile(join(root, 'spec.md'), '# Standard design fixture\n');
  await writeFile(join(root, 'design.md'), '# Reviewed design\n');
  await writeFile(join(root, 'src/app.ts'), 'export const app = true;\n');
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'implementation', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['passes'], gateIds: ['pass'], risk }] }));
  return root;
}

async function receipt(root: string, value: unknown): Promise<string> {
  void root; const path = join(tmpdir(), `leo-dev-design-receipt-${randomUUID()}.json`); temporary.push(path); await writeFile(path, JSON.stringify(value)); return path;
}

async function approveSpec(root: string, changeId: string): Promise<void> {
  for (const state of ['discovery', 'spec-review']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.approvalContext;
  const approval = await receipt(root, { receiptId: `approval-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'test authority', decision: 'grant', grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-approval', ...context });
  expectExit(cli(root, 'approve', '--change', changeId, '--receipt', approval), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
}

async function advanceToSubmitted(root: string, changeId: string): Promise<Record<string, any>> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'plan.json'), 0, changeId.startsWith('full') ? 'ROUTED_FULL' : 'ROUTED_STANDARD');
  await approveSpec(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer'), 0, 'TRANSITIONED');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  const design = await receipt(root, { receiptId: `design-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'human reviewer', verdict: 'pass', findingsHash: hash('none'), timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId, specHash: context.specHash, planHash: context.planHash, designHash: context.designHash, producerSession: context.producerSession });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', design), 0, 'TRANSITIONED');
  for (const state of ['task-ready', 'executing']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
  const claimed = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'producer'); expectExit(claimed, 0, 'CLAIMED');
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'implementation', '--run', claimed.envelope.state!.run.runId), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', changeId, '--task', 'implementation'), 0, 'SUBMITTED_FOR_REVIEW');
  return cli(root, 'status', '--change', changeId).envelope.state!.reviewContext;
}

async function review(root: string, context: Record<string, any>, overrides: Record<string, unknown> = {}): Promise<string> {
  return receipt(root, { ...context, receiptId: `review-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'reviewer', sessionId: 'reviewer', findingsHash: hash('none'), verdict: 'pass', timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), ...overrides });
}

async function readyNonLiteRevision(root: string, changeId: string): Promise<{ assessment: string; grant: string }> {
  await writeFile(join(root, 'spec-v2.md'), '# Standard design fixture v2\n');
  await writeFile(join(root, 'plan-v2.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'implementation', revision: 2, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['passes v2'], gateIds: ['pass'], risk: 'standard' }] }));
  const proposed = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
  expectExit(proposed, 0, 'DRY_RUN'); const context = proposed.envelope.state!.revisionContext;
  const assessment = `.leo-dev/runtime/${changeId}/revision-assessment.json`;
  await writeFile(join(root, assessment), JSON.stringify({ schemaVersion: 1, assessmentId: `assessment-${changeId}`, changeId, taskId: context.taskId, specHash: context.authorityHash, subjectTreeHash: context.subjectTreeHash, coverage: 'complete', findings: [] }));
  const ready = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', assessment, '--dry-run');
  expectExit(ready, 0, 'DRY_RUN');
  const grant = await receipt(root, { receiptId: `revision-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'revision authority', decision: 'grant', grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-revision', ...ready.envelope.state!.revisionApprovalContext });
  return { assessment, grant };
}

async function designReceipt(root: string, changeId: string, context: Record<string, any>, overrides: Record<string, unknown> = {}): Promise<string> {
  return receipt(root, { receiptId: `design-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'design reviewer', verdict: 'pass', findingsHash: hash('none'), timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId, specHash: context.specHash, planHash: context.planHash, designHash: context.designHash, producerSession: context.producerSession, ...overrides });
}

async function atNonLiteSpecApproved(root: string, changeId: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'plan.json'), 0, 'ROUTED_STANDARD');
  await approveSpec(root, changeId);
}

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('routes Standard without downgrade and requires immutable independent design evidence before task-ready', async () => {
  const root = await fixture(); const changeId = 'standard-design';
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED');
  const routed = cli(root, 'route', '--change', changeId, '--plan', 'plan.json');
  expectExit(routed, 0, 'ROUTED_STANDARD');
  expect(routed.envelope.state!.risk).toBe('standard');
  await approveSpec(root, changeId);
  const before = await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 5, 'CONFLICT');
  expect(await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8')).toBe(before);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', '../escape.md', '--session', 'producer-session'), 2, 'VALIDATION_ERROR');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer-session'), 0, 'TRANSITIONED');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  expect(context).toMatchObject({ changeId, producerSession: 'producer-session', designHash: hash('# Reviewed design\n') });
  const { changeId: boundChangeId, specHash, planHash, designHash, producerSession } = context;
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const beforeBadReceipt = await readFile(journal, 'utf8');
  const expired = await receipt(root, { receiptId: `design-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'reviewer', verdict: 'pass', findingsHash: hash('no findings'), timestamp: new Date(Date.now() - 120_000).toISOString(), expiresAt: new Date(Date.now() - 60_000).toISOString(), changeId: boundChangeId, specHash, planHash, designHash, producerSession });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', expired), 2, 'SCHEMA_INVALID');
  expect(await readFile(journal, 'utf8')).toBe(beforeBadReceipt);
  const wrongBinding = await receipt(root, { receiptId: `design-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'reviewer', verdict: 'pass', findingsHash: hash('no findings'), timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId: boundChangeId, specHash: '0'.repeat(64), planHash, designHash, producerSession });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', wrongBinding), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(beforeBadReceipt);
  const selfReview = await receipt(root, { receiptId: `design-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'producer', sessionId: producerSession, verdict: 'pass', findingsHash: hash('no findings'), timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId: boundChangeId, specHash, planHash, designHash, producerSession });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', selfReview), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(beforeBadReceipt);
  const design = await receipt(root, { receiptId: `design-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'reviewer', sessionId: 'reviewer-session', verdict: 'pass', findingsHash: hash('no findings'), timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId: boundChangeId, specHash, planHash, designHash, producerSession });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', design), 0, 'TRANSITIONED');
  await writeFile(join(root, 'design.md'), '# Altered design\n');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 5, 'CONFLICT');
  await writeFile(join(root, 'design.md'), '# Reviewed design\n');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
}, 20_000);

test('records an independent rejected design then accepts repaired design review under the unchanged authority', async () => {
  const root = await fixture('standard'); const changeId = 'repaired-design'; await atNonLiteSpecApproved(root, changeId);
  const manifest = join(root, `.leo-dev/changes/${changeId}/manifest.yaml`);
  const spec = join(root, `.leo-dev/changes/${changeId}/spec.yaml`);
  const approvalBefore = { manifest: YAML.parse(await readFile(manifest, 'utf8')), spec: YAML.parse(await readFile(spec, 'utf8')) };
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer-v1'), 0, 'TRANSITIONED');
  const rejectedContext = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  const rejection = await designReceipt(root, changeId, rejectedContext, { verdict: 'reject', findingsHash: hash('move the review boundary') });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved', '--receipt', rejection), 0, 'TRANSITIONED');
  expect(YAML.parse(await readFile(manifest, 'utf8'))).toMatchObject({ approvalRef: approvalBefore.manifest.approvalRef, approvalHash: approvalBefore.manifest.approvalHash, state: 'spec-approved' });
  expect(YAML.parse(await readFile(spec, 'utf8'))).toMatchObject({ approvalRef: approvalBefore.spec.approvalRef, approvalHash: approvalBefore.spec.approvalHash });
  expect(cli(root, 'status', '--change', changeId).envelope.state).toMatchObject({ tasks: { implementation: { state: 'ready', revision: 1 } } });
  const observed = cli(root, 'observe', '--change', changeId);
  expectExit(observed, 0, 'OBSERVATION');
  expect(observed.envelope.state).toMatchObject({ availability: 'available', change: { state: 'spec-approved' }, tasks: [{ id: 'implementation', state: 'ready' }] });
  await writeFile(join(root, 'design.md'), '# Repaired design\n');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer-v2'), 0, 'TRANSITIONED');
  const repairedContext = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  expect(repairedContext.designHash).toBe(hash('# Repaired design\n'));
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', await designReceipt(root, changeId, repairedContext)), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
}, 30_000);

test('reject-design admission refuses invalid or stale repair receipts without writes', async () => {
  const root = await fixture('standard'); const changeId = 'reject-admission'; await atNonLiteSpecApproved(root, changeId);
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved', '--receipt', await designReceipt(root, changeId, { changeId: 'wrong-state', specHash: 'a'.repeat(64), planHash: 'b'.repeat(64), designHash: 'c'.repeat(64), producerSession: 'producer' }, { verdict: 'reject' })), 3, 'TRANSITION_FORBIDDEN');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer'), 0, 'TRANSITIONED');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  const before = await readFile(journal, 'utf8');
  const reject = (overrides: Record<string, unknown> = {}) => designReceipt(root, changeId, context, { verdict: 'reject', ...overrides });
  const dryRunPass = await reject({ verdict: 'pass' });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved', '--receipt', dryRunPass, '--dry-run'), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(before);
  for (const invalid of [
    await reject({ verdict: 'pass' }),
    await reject({ expiresAt: new Date(Date.now() - 60_000).toISOString(), timestamp: new Date(Date.now() - 120_000).toISOString() }),
    await reject({ timestamp: new Date(Date.now() + 60_000).toISOString(), expiresAt: new Date(Date.now() + 120_000).toISOString() }),
    await reject({ specHash: '0'.repeat(64) }),
    await reject({ provenance: 'platform-attested', sessionId: context.producerSession }),
  ]) {
    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved', '--receipt', invalid).status).not.toBe(0);
    expect(await readFile(journal, 'utf8')).toBe(before);
  }
  const accepted = await reject({ receiptId: 'reused-reject' });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved', '--receipt', accepted), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer-v2'), 0, 'TRANSITIONED');
  const reusedBefore = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved', '--receipt', accepted), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(reusedBefore);
  const sourceDrift = await designReceipt(root, changeId, cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext, { verdict: 'reject' });
  await writeFile(join(root, 'design.md'), '# Drifted after review\n');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved', '--receipt', sourceDrift), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(reusedBefore);
}, 40_000);

test('recovers each interrupted design rejection batch exactly once with preserved approval projections', async () => {
  const { Controller } = await import('../../packages/cli/dist/controller/controller.js');
  for (const faultAt of ['after-batch-prepared', 'after-batch-projection'] as const) {
    const root = await fixture('standard'); const changeId = `reject-recovery-${faultAt}`; await atNonLiteSpecApproved(root, changeId);
    const manifest = join(root, `.leo-dev/changes/${changeId}/manifest.yaml`); const spec = join(root, `.leo-dev/changes/${changeId}/spec.yaml`);
    const before = { manifest: YAML.parse(await readFile(manifest, 'utf8')), spec: YAML.parse(await readFile(spec, 'utf8')) };
    expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer'), 0, 'TRANSITIONED');
    const context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
    await expect(new Controller().execute('transition', { repo: root, change: changeId, scope: 'change', to: 'spec-approved', receipt: await designReceipt(root, changeId, context, { verdict: 'reject' }), faultAt })).rejects.toThrow('Simulated crash');
    expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
    const events = projectJournalEvents((await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).replayStrict()).events).events;
    expect(events.filter((event) => event.type === 'receipt.design-review.ingested')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'change.transition' && (event.payload as { from?: string; to?: string }).from === 'design-review' && (event.payload as { to?: string }).to === 'spec-approved')).toHaveLength(1);
    expect(YAML.parse(await readFile(manifest, 'utf8'))).toMatchObject({ state: 'spec-approved', approvalRef: before.manifest.approvalRef, approvalHash: before.manifest.approvalHash });
    expect(YAML.parse(await readFile(spec, 'utf8'))).toMatchObject({ approvalRef: before.spec.approvalRef, approvalHash: before.spec.approvalHash });
  }
}, 40_000);

test('rejects integration plans that do not transitively depend on every other task', async () => {
  const root = await fixture();
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [
    { id: 'a', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['a'], gateIds: ['pass'], risk: 'lite' },
    { id: 'b', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['b'], gateIds: ['pass'], risk: 'lite', role: 'integration' },
  ] }));
  expectExit(cli(root, 'init', '--change', 'bad-integration', '--spec', 'spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', 'bad-integration', '--plan', 'plan.json'), 2, 'VALIDATION_ERROR');
});

test('Standard review rejects agent assertions and the implementer platform session without consuming the attempt', async () => {
  const root = await fixture('standard'); const context = await advanceToSubmitted(root, 'standard-review'); const journal = join(root, '.leo-dev/runtime/standard-review/journal.ndjson'); const before = await readFile(journal, 'utf8');
  expectExit(cli(root, 'review', '--change', 'standard-review', '--task', 'implementation', '--receipt', await review(root, context, { provenance: 'agent-asserted' }), '--dry-run'), 3, 'TRANSITION_FORBIDDEN');
  expect(await readFile(journal, 'utf8')).toBe(before);
  expectExit(cli(root, 'review', '--change', 'standard-review', '--task', 'implementation', '--receipt', await review(root, context, { provenance: 'agent-asserted' })), 3, 'TRANSITION_FORBIDDEN');
  expect(await readFile(journal, 'utf8')).toBe(before);
  expectExit(cli(root, 'review', '--change', 'standard-review', '--task', 'implementation', '--receipt', await review(root, context, { sessionId: 'producer' })), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(before);
}, 30_000);

test('Full review refuses a partial composite then accepts three current independent candidate-bound assessments', async () => {
  const root = await fixture('full'); const context = await advanceToSubmitted(root, 'full-review'); const journal = join(root, '.leo-dev/runtime/full-review/journal.ndjson'); const before = await readFile(journal, 'utf8');
  expectExit(cli(root, 'review', '--change', 'full-review', '--task', 'implementation', '--receipt', await review(root, context)), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(before);
  const now = new Date().toISOString(); const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const assessments = ['architecture', 'security', 'nfr'].map((area) => ({ ...context, receiptId: `${area}-${randomUUID()}`, area, provenance: 'platform-attested', actorLabel: `${area} reviewer`, sessionId: `${area}-session`, findingsHash: hash(area), verdict: 'pass', timestamp: now, expiresAt }));
  const accepted = cli(root, 'review', '--change', 'full-review', '--task', 'implementation', '--receipt', await review(root, context, { assessments }));
  expect(accepted.status, JSON.stringify(accepted.envelope)).toBe(0);
  expect(accepted.envelope.state!.tasks.implementation.state).toBe('done');
}, 30_000);

test('Full review records a complete independently bound nested rejection as remediation', async () => {
  const root = await fixture('full'); const changeId = 'full-composite-reject'; const context = await advanceToSubmitted(root, changeId);
  const now = new Date().toISOString(); const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const assessments = ['architecture', 'security', 'nfr'].map((area) => ({
    ...context, receiptId: `${area}-${randomUUID()}`, area, provenance: 'platform-attested', actorLabel: `${area} reviewer`, sessionId: `${area}-session`,
    findingsHash: hash(area), verdict: area === 'security' ? 'reject' : 'pass', timestamp: now, expiresAt,
  }));
  const rejected = cli(root, 'review', '--change', changeId, '--task', 'implementation', '--receipt', await review(root, context, { verdict: 'reject', assessments }));
  expectExit(rejected, 0, 'REVIEW_REJECTED');
  expect(rejected.envelope.state).toMatchObject({ tasks: { implementation: { state: 'remediation' } }, attempts: { implementation: { consumed: 1, nextKind: 'remediation' } } });
}, 40_000);

test('Full review refuses future-start nested assessments without consuming the submitted candidate', async () => {
  const root = await fixture('full'); const changeId = 'full-future-assessments'; const context = await advanceToSubmitted(root, changeId);
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
  const assessments = ['architecture', 'security', 'nfr'].map((area) => ({
    ...context, receiptId: `${area}-${randomUUID()}`, area, provenance: 'platform-attested', actorLabel: `${area} reviewer`, sessionId: `${area}-session`,
    findingsHash: hash(area), verdict: 'pass', timestamp: new Date(Date.now() + 86_400_000).toISOString(), expiresAt: new Date(Date.now() + 172_800_000).toISOString(),
  }));
  expectExit(cli(root, 'review', '--change', changeId, '--task', 'implementation', '--receipt', await review(root, context, { assessments })), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(before);
  expect(cli(root, 'status', '--change', changeId).envelope.state!.tasks.implementation.state).toBe('review-required');
}, 40_000);

test('non-Lite revision invalidates design evidence until a fresh bound design review and approval', async () => {
  const root = await fixture('standard'); const changeId = 'standard-revision';
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'plan.json'), 0, 'ROUTED_STANDARD'); await approveSpec(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer-v1'), 0, 'TRANSITIONED');
  let context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', await designReceipt(root, changeId, context)), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  const revision = await readyNonLiteRevision(root, changeId);
  expectExit(cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', revision.assessment, '--receipt', revision.grant), 0, 'SPEC_REVISED_UNAUTHENTICATED');
  const status = cli(root, 'status', '--change', changeId); expect(status.envelope.state).toMatchObject({ changeState: 'spec-approved', tasks: { implementation: { revision: 2, state: 'ready' } }, attempts: { implementation: { consumed: 0 } } });
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 5, 'CONFLICT'); expect(await readFile(journal, 'utf8')).toBe(before);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer-v2'), 0, 'TRANSITIONED');
  context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  const revisionReceiptId = JSON.parse(await readFile(revision.grant, 'utf8')).receiptId;
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', await designReceipt(root, changeId, context, { receiptId: revisionReceiptId })), 5, 'CONFLICT');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', await designReceipt(root, changeId, context)), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
}, 40_000);

// Mutant caught: ordinary design approval resolves a relative receipt from
// --repo, shadowing the valid receipt supplied from the invoking directory.
test('ordinary design approval resolves a relative receipt from the caller cwd', async () => {
  const root = await fixture('standard'); const changeId = 'caller-cwd-receipt'; await atNonLiteSpecApproved(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer'), 0, 'TRANSITIONED');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  const caller = await mkdtemp(join(tmpdir(), 'leo-dev-design-caller-')); temporary.push(caller);
  const validReceipt = await designReceipt(root, changeId, context);
  await writeFile(join(caller, 'receipt.json'), await readFile(validReceipt));
  await writeFile(join(root, 'receipt.json'), JSON.stringify({ shadow: 'not a design receipt' }));

  expectExit(cliFrom(caller, root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', 'receipt.json'), 0, 'TRANSITIONED');
}, 30_000);

test('recovers a pending design-review batch and refuses a third-value design-approved projection', async () => {
  const { Controller } = await import('../../packages/cli/dist/controller/controller.js');
  const root = await fixture('standard'); const changeId = 'design-recovery'; await atNonLiteSpecApproved(root, changeId);
  await expect(new Controller().execute('transition', { repo: root, change: changeId, scope: 'change', to: 'design-review', design: 'design.md', session: 'producer', faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
  expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  await expect(new Controller().execute('transition', { repo: root, change: changeId, scope: 'change', to: 'design-approved', receipt: await designReceipt(root, changeId, context), faultAt: 'after-batch-projection' })).rejects.toThrow('Simulated crash');
  const manifest = join(root, `.leo-dev/changes/${changeId}/manifest.yaml`); await writeFile(manifest, 'third: value\n'); const third = await readFile(manifest, 'utf8');
  expectExit(cli(root, 'resume', '--change', changeId), 7, 'BLOCKED'); expect(await readFile(manifest, 'utf8')).toBe(third);
}, 40_000);

// Mutant caught: status reuses the older valid request after a corrupt relevant
// journal event, displaying an approval context that no longer has valid history.
test('status blocks a malformed latest persisted design event instead of reusing an older context', async () => {
  const root = await fixture('standard'); const changeId = 'corrupt-design-status'; await atNonLiteSpecApproved(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer'), 0, 'TRANSITIONED');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', await designReceipt(root, changeId, context)), 0, 'TRANSITIONED');
  const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
  await journal.append({ changeId, type: 'receipt.design-review.ingested', payload: { receipt: { receiptId: 'corrupt' }, issuerAuthenticated: false } });
  expectExit(cli(root, 'status', '--change', changeId), 7, 'BLOCKED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 7, 'BLOCKED');
}, 30_000);

// Mutant caught: requiring nonempty serialized source bytes blocks the accepted
// empty readable design file after its request has already reached the journal.
test('accepts an empty design source through transition, status, and prepared-batch recovery', async () => {
  const root = await fixture('standard'); const changeId = 'empty-design-source'; await writeFile(join(root, 'design.md'), ''); await atNonLiteSpecApproved(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer'), 0, 'TRANSITIONED');
  expect(cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext).toMatchObject({ designSourceBase64: '' });

  const recoveryRoot = await fixture('standard'); const recoveryChange = 'empty-design-recovery'; await writeFile(join(recoveryRoot, 'design.md'), ''); await atNonLiteSpecApproved(recoveryRoot, recoveryChange);
  const { Controller } = await import('../../packages/cli/dist/controller/controller.js');
  await expect(new Controller().execute('transition', { repo: recoveryRoot, change: recoveryChange, scope: 'change', to: 'design-review', design: 'design.md', session: 'producer', faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
  expectExit(cli(recoveryRoot, 'resume', '--change', recoveryChange), 0, 'RESUMED');
  expect(cli(recoveryRoot, 'status', '--change', recoveryChange).envelope.state!.designReviewContext).toMatchObject({ designSourceBase64: '' });
}, 40_000);
