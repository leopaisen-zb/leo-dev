import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { appendFile, chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { afterEach, describe, expect, test } from 'vitest';
import { Controller } from '../../packages/cli/src/controller/controller.js';
import { fingerprint } from '../../packages/cli/src/gates/registry.js';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { projectJournalEvents } from '../../packages/cli/src/state/snapshot.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function cli(root: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 20_000 });
  expect(result.error).toBeUndefined();
  return { status: result.status ?? 9, envelope: JSON.parse(result.stdout.trim()) as { ok: boolean; code: string; state: Record<string, unknown> | null; errors: Array<{ code: string; message: string }> } };
}

async function cliAsync(root: string, ...args: string[]): Promise<ReturnType<typeof cli>> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (value: Buffer) => { stdout += value; }); child.stderr.on('data', (value: Buffer) => { stderr += value; });
    child.once('error', rejectResult); child.once('close', (status) => {
      try { resolveResult({ status: status ?? 9, envelope: JSON.parse(stdout.trim()) as { ok: boolean; code: string; state: Record<string, unknown> | null; errors: Array<{ code: string; message: string }> } }); }
      catch (error) { rejectResult(error); }
    });
  });
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-spec-revision-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{ id: 'pass', argv: [process.execPath, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 10, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }] }));
  await writeFile(join(root, 'spec-v1.md'), '# v1\n');
  await writeFile(join(root, 'spec-v2.md'), '# v2\n');
  await writeFile(join(root, 'plan-v1.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'task-a', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A'], gateIds: ['pass'], risk: 'lite' }, { id: 'task-b', revision: 1, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B'], gateIds: ['pass'], risk: 'lite' }] }));
  await writeFile(join(root, 'plan-v2.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'task-b', revision: 2, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B v2'], gateIds: ['pass'], risk: 'lite' }, { id: 'task-a', revision: 2, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A v2'], gateIds: ['pass'], risk: 'lite' }] }));
  return root;
}

async function receipt(name: string, value: unknown): Promise<string> {
  const path = join(tmpdir(), `leo-dev-spec-revision-${name}-${Date.now()}-${Math.random()}.json`);
  temporary.push(path); await writeFile(path, JSON.stringify(value)); return path;
}

async function approveInitialSpec(root: string, changeId: string): Promise<void> {
  expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'discovery').status).toBe(0);
  expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-review').status).toBe(0);
  const context = cli(root, 'status', '--change', changeId).envelope.state!.approvalContext as Record<string, string>;
  const path = await receipt('initial-grant', { receiptId: `${changeId}-initial-grant`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-approval', ...context });
  expect(cli(root, 'approve', '--change', changeId, '--receipt', path).status).toBe(0);
  expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved').status).toBe(0);
  expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready').status).toBe(0);
  expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing').status).toBe(0);
}

async function completeTask(root: string, changeId: string, taskId: string): Promise<string> {
  const claimed = cli(root, 'claim', '--change', changeId, '--task', taskId);
  expect(claimed.status).toBe(0);
  const runId = claimed.envelope.state!.run as { runId: string };
  expect(cli(root, 'run-gates', '--change', changeId, '--task', taskId, '--run', runId.runId).status).toBe(0);
  expect(cli(root, 'submit', '--change', changeId, '--task', taskId).status).toBe(0);
  const context = cli(root, 'status', '--change', changeId).envelope.state!.reviewContext as Record<string, string | number>;
  const path = await receipt(`review-${taskId}`, { ...context, receiptId: `${changeId}-${taskId}-review-${Date.now()}-${Math.random()}`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY independent reviewer; issuer not authenticated', sessionId: `review-session-${taskId}`, findingsHash: sha256(`no findings ${taskId}`), verdict: 'pass', timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() });
  expect(cli(root, 'review', '--change', changeId, '--task', taskId, '--receipt', path).status).toBe(0);
  return path;
}

async function readyRevision(root: string, changeId: string, expiryMs = 60 * 60_000): Promise<{ assessment: string; grant: string }> {
  const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
  const revision = proposal.envelope.state!.revisionContext as Record<string, string>;
  const assessment = join(root, `.leo-dev/runtime/${changeId}/revision-assessment.json`);
  await writeFile(assessment, JSON.stringify({ schemaVersion: 1, assessmentId: `${changeId}-assessment`, changeId, taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [] }));
  const ready = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', `.leo-dev/runtime/${changeId}/revision-assessment.json`, '--dry-run');
  const grant = await receipt(`${changeId}-grant`, { receiptId: `${changeId}-grant`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + expiryMs).toISOString(), changeId, scope: 'change', operationKind: 'spec-revision', ...(ready.envelope.state!.revisionApprovalContext as Record<string, string>) });
  return { assessment: `.leo-dev/runtime/${changeId}/revision-assessment.json`, grant };
}

async function readyRevisionFor(root: string, changeId: string, spec: string, plan: string, suffix: string, extraArgs: string[] = []): Promise<{ assessment: string; grant: string; authorityHash: string }> {
  const proposal = cli(root, 'revise', '--change', changeId, '--spec', spec, '--plan', plan, ...extraArgs, '--dry-run');
  expect(proposal.status, JSON.stringify(proposal.envelope)).toBe(0);
  const revision = proposal.envelope.state!.revisionContext as Record<string, string>;
  const previousAssessmentFingerprint = (proposal.envelope.state!.assessmentContext as { latestAssessmentFingerprint?: string | null } | undefined)?.latestAssessmentFingerprint;
  const assessment = `.leo-dev/runtime/${changeId}/revision-assessment-${suffix}.json`;
  await writeFile(join(root, assessment), JSON.stringify({ schemaVersion: 1, assessmentId: `${changeId}-${suffix}`, changeId, taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [], ...(previousAssessmentFingerprint ? { previousAssessmentFingerprint } : {}) }));
  const ready = cli(root, 'revise', '--change', changeId, '--spec', spec, '--plan', plan, ...extraArgs, '--assessment', assessment, '--dry-run');
  expect(ready.status, JSON.stringify(ready.envelope)).toBe(0);
  const grant = await receipt(`${changeId}-${suffix}`, { receiptId: `${changeId}-grant-${suffix}`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-revision', ...(ready.envelope.state!.revisionApprovalContext as Record<string, string>) });
  return { assessment, grant, authorityHash: revision.authorityHash };
}

async function applyRevisionFor(root: string, changeId: string, spec: string, plan: string, suffix: string, extraArgs: string[] = []): Promise<ReturnType<typeof cli>> {
  const input = await readyRevisionFor(root, changeId, spec, plan, suffix, extraArgs);
  const applied = cli(root, 'revise', '--change', changeId, '--spec', spec, '--plan', plan, ...extraArgs, '--assessment', input.assessment, '--receipt', input.grant);
  expect(applied.status, JSON.stringify(applied.envelope)).toBe(0);
  return applied;
}

async function openTeam(root: string, changeId: string, authorityHash: string, requestId: string): Promise<void> {
  const path = `${requestId}.json`;
  await writeFile(join(root, path), JSON.stringify({ schemaVersion: 1, requestId, teamId: `team-${requestId}`, expectedRevision: 0, specHash: authorityHash, operation: { type: 'open', members: [
    { memberId: 'writer', role: 'implementation owner', access: 'write' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'read' },
  ] } }));
  const recorded = cli(root, 'team', '--change', changeId, '--action', 'record', '--input', path);
  expect(recorded.status, JSON.stringify(recorded.envelope)).toBe(0);
}

async function mutateLatestRevisionBatch(root: string, changeId: string, mutate: (batch: Record<string, any>) => void, commit = true,
  envelope: { prepared?: Record<string, unknown>; committed?: Record<string, unknown> } = {}): Promise<void> {
  const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const raw = (await new Journal(journalPath).replayStrict()).events;
  let preparedIndex = -1;
  for (let index = raw.length - 1; index >= 0; index -= 1) {
    if (raw[index]!.type === 'controller.batch.prepared' && (raw[index]!.payload as { kind?: string }).kind === 'spec-revision') { preparedIndex = index; break; }
  }
  expect(preparedIndex).toBeGreaterThanOrEqual(0);
  const batch = structuredClone(raw[preparedIndex]!.payload) as Record<string, any>;
  mutate(batch);
  const prefix = raw.slice(0, preparedIndex);
  await writeFile(journalPath, prefix.length > 0 ? `${prefix.map((event) => JSON.stringify(event)).join('\n')}\n` : '');
  const journal = new Journal(journalPath);
  const prepared = await journal.append({ changeId, ...envelope.prepared, type: 'controller.batch.prepared', payload: batch });
  if (commit) await journal.appendIfTail({ changeId, ...envelope.committed, type: 'controller.batch.committed', payload: { version: 1, batchId: batch.batchId, preparedEventHash: prepared.eventHash } }, prepared.eventHash);
}

async function rewritePendingRevisionReceiptId(root: string, changeId: string, receiptId: string, projectionsAlreadyApplied: boolean): Promise<void> {
  const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const raw = (await new Journal(journalPath).replayStrict()).events;
  const preparedIndex = raw.findLastIndex((event) => event.type === 'controller.batch.prepared' && (event.payload as { kind?: string }).kind === 'spec-revision');
  expect(preparedIndex).toBeGreaterThanOrEqual(0);
  expect(raw[preparedIndex + 1]).toBeUndefined();
  const batch = structuredClone(raw[preparedIndex]!.payload) as Record<string, any>;
  const desiredProjections: Array<{ relativePath: string; desiredValue: unknown }> = [];
  const mutate = () => {
    const receiptOperation = batch.operations.find((operation: Record<string, any>) => operation.type === 'receipt.spec-revision.ingested');
    receiptOperation.payload.receipt.receiptId = receiptId;
    const approvalHash = fingerprint(receiptOperation.payload.receipt);
    for (const projection of batch.projections as Array<Record<string, any>>) {
      if (!String(projection.relativePath).endsWith('/manifest.yaml') && !String(projection.relativePath).endsWith('/spec.yaml')) continue;
      projection.desiredValue.approvalRef = `receipt:${receiptId}`;
      projection.desiredValue.approvalHash = approvalHash;
      const serialized = YAML.stringify(projection.desiredValue);
      projection.desiredHash = sha256(serialized);
      const recoveryProjection = batch.recovery.projections.find((candidate: Record<string, any>) => candidate.relativePath === projection.relativePath);
      recoveryProjection.desired = { type: 'file', mode: '600', bytesBase64: Buffer.from(serialized).toString('base64') };
    }
    desiredProjections.push(...batch.projections.map((projection: Record<string, any>) => ({ relativePath: projection.relativePath, desiredValue: projection.desiredValue })));
  };
  const prefix = raw.slice(0, preparedIndex);
  await writeFile(journalPath, `${prefix.map((event) => JSON.stringify(event)).join('\n')}\n`);
  const journal = new Journal(journalPath);
  await journal.withExclusive((transaction) => transaction.appendAt((timestamp) => {
    batch.preparedAt = timestamp;
    mutate();
    return { changeId, type: 'controller.batch.prepared', payload: batch };
  }));
  if (projectionsAlreadyApplied) {
    for (const projection of desiredProjections) {
      const path = join(root, projection.relativePath);
      await writeFile(path, YAML.stringify(projection.desiredValue));
      await chmod(path, 0o600);
    }
  }
}

async function pendingProjectionState(root: string, changeId: string): Promise<Array<Record<string, unknown>>> {
  const raw = (await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).replayStrict()).events;
  const pending = raw.at(-1)!.payload as { projections: Array<{ relativePath: string }> };
  return Promise.all(pending.projections.map(async ({ relativePath }) => {
    const path = join(root, relativePath);
    try {
      const info = await lstat(path);
      return { relativePath, mode: info.mode & 0o777, bytesBase64: (await readFile(path)).toString('base64') };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { relativePath, absent: true };
      throw error;
    }
  }));
}

async function appendPendingBatch(root: string, changeId: string, kind: string, operations: Array<Record<string, unknown>>, projections: Array<Record<string, unknown>> = []): Promise<void> {
  const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
  await journal.append({ changeId, type: 'controller.batch.prepared', payload: { version: 1, batchId: `pending-${changeId}-${Date.now()}`, kind, operations, projections } });
}

async function rewriteAsLegacyDirectHistory(root: string, changeId: string): Promise<void> {
  const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const raw = (await new Journal(journalPath).replayStrict()).events;
  const logical = projectJournalEvents(raw).events;
  await writeFile(journalPath, '');
  const journal = new Journal(journalPath);
  for (const event of logical) {
    await journal.append({ changeId: event.changeId, type: event.type, ...(event.taskId === undefined ? {} : { taskId: event.taskId }),
      ...(event.taskRevision === undefined ? {} : { taskRevision: event.taskRevision }), ...(event.leaseGeneration === undefined ? {} : { leaseGeneration: event.leaseGeneration }), payload: event.payload });
  }
}

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('compiled public specification revision', () => {
  test('proposes a complete next task authority without writing', async () => {
    const root = await fixture();
    expect(cli(root, 'init', '--change', 'revision', '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', 'revision', '--plan', 'plan-v1.json').status).toBe(0);
    // The revision proposal itself, not a help-text assertion, is the public behavior under test.
    const proposal = cli(root, 'revise', '--change', 'revision', '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
    expect(proposal.status).toBe(0);
    expect(proposal.envelope.code).toBe('DRY_RUN');
    expect(proposal.envelope.state).toMatchObject({ command: 'revise', writes: [], revisionContext: { revision: 2 } });
  });

  test('activates a granted ready assessment by resetting every current task revision', async () => {
    const root = await fixture();
    expect(cli(root, 'init', '--change', 'revision-apply', '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', 'revision-apply', '--plan', 'plan-v1.json').status).toBe(0);
    const proposal = cli(root, 'revise', '--change', 'revision-apply', '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
    expect(proposal.status).toBe(0);
    const revision = proposal.envelope.state!.revisionContext as Record<string, string>;
    const assessment = join(root, '.leo-dev/runtime/revision-apply/revision-assessment.json');
    await writeFile(assessment, JSON.stringify({ schemaVersion: 1, assessmentId: 'revision-assessment', changeId: 'revision-apply', taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [] }));
    const ready = cli(root, 'revise', '--change', 'revision-apply', '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', '.leo-dev/runtime/revision-apply/revision-assessment.json', '--dry-run');
    expect(ready.status).toBe(0);
    expect((ready.envelope.state!.revisionContext as { missingPrerequisites: string[] }).missingPrerequisites).toEqual(['approval']);
    const approvalContext = ready.envelope.state!.revisionApprovalContext as Record<string, string>;
    const receipt = join(tmpdir(), `leo-dev-spec-revision-grant-${Date.now()}.json`);
    temporary.push(receipt);
    await writeFile(receipt, JSON.stringify({ receiptId: 'revision-grant', provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), changeId: 'revision-apply', scope: 'change', operationKind: 'spec-revision', ...approvalContext }));
    const applied = cli(root, 'revise', '--change', 'revision-apply', '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', '.leo-dev/runtime/revision-apply/revision-assessment.json', '--receipt', receipt);
    expect(applied.status, JSON.stringify(applied.envelope)).toBe(0);
    expect(applied.envelope.state).toMatchObject({ changeState: 'spec-approved', tasks: { 'task-a': { revision: 2, state: 'ready' }, 'task-b': { revision: 2, state: 'pending' } } });
    expect((applied.envelope.state!.routes as Array<{ task: { id: string } }>).map((route) => route.task.id)).toEqual(['task-b', 'task-a']);
    expect(cli(root, 'transition', '--change', 'revision-apply', '--scope', 'change', '--to', 'task-ready').status).toBe(0);
    expect(cli(root, 'transition', '--change', 'revision-apply', '--scope', 'change', '--to', 'executing').status).toBe(0);
  }, 30_000);

  test('invalidates a completed two-task Lite authority and requires new task revisions', async () => {
    const root = await fixture(); const changeId = 'revision-complete';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await approveInitialSpec(root, changeId); const oldAReview = await completeTask(root, changeId, 'task-a'); await completeTask(root, changeId, 'task-b');
    expect(cli(root, 'status', '--change', changeId).envelope.state!.changeState).toBe('integration-review');
    await writeFile(join(root, 'spec-v1.md'), '# v2 in place\n');
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'plan-v2.json', '--dry-run');
    const revision = proposal.envelope.state!.revisionContext as Record<string, string>;
    const assessment = join(root, `.leo-dev/runtime/${changeId}/revision-assessment.json`);
    await writeFile(assessment, JSON.stringify({ schemaVersion: 1, assessmentId: 'complete-revision-assessment', changeId, taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [] }));
    const ready = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'plan-v2.json', '--assessment', `.leo-dev/runtime/${changeId}/revision-assessment.json`, '--dry-run');
    const grant = await receipt('revision-grant', { receiptId: `${changeId}-grant`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-revision', ...(ready.envelope.state!.revisionApprovalContext as Record<string, string>) });
    const applied = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'plan-v2.json', '--assessment', `.leo-dev/runtime/${changeId}/revision-assessment.json`, '--receipt', grant);
    expect(applied.status, JSON.stringify(applied.envelope)).toBe(0);
    expect(applied.envelope.state).toMatchObject({ changeState: 'spec-approved', tasks: { 'task-a': { revision: 2, state: 'ready' }, 'task-b': { revision: 2, state: 'pending' } } });
    expect(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', oldAReview).status).not.toBe(0);
    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready').status).toBe(0);
    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing').status).toBe(0);
    expect(cli(root, 'claim', '--change', changeId, '--task', 'task-b').status).not.toBe(0);
    await completeTask(root, changeId, 'task-a'); await completeTask(root, changeId, 'task-b');
    expect(cli(root, 'status', '--change', changeId).envelope.state!.changeState).toBe('integration-review');
  }, 30_000);

  test('refuses pending revision recovery after an unrelated tree change', async () => {
    const root = await fixture(); const changeId = 'revision-recovery';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
    const revision = proposal.envelope.state!.revisionContext as Record<string, string>;
    const assessment = join(root, `.leo-dev/runtime/${changeId}/revision-assessment.json`);
    await writeFile(assessment, JSON.stringify({ schemaVersion: 1, assessmentId: 'recovery-assessment', changeId, taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [] }));
    const ready = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', `.leo-dev/runtime/${changeId}/revision-assessment.json`, '--dry-run');
    const grant = await receipt('recovery-grant', { receiptId: `${changeId}-grant`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-revision', ...(ready.envelope.state!.revisionApprovalContext as Record<string, string>) });
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: `.leo-dev/runtime/${changeId}/revision-assessment.json`, receipt: grant, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    await writeFile(join(root, 'unrelated-after-prepare.txt'), 'must fence recovery\n');
    const resumed = cli(root, 'resume', '--change', changeId);
    expect(resumed.status).not.toBe(0);
    expect(await readFile(journal, 'utf8')).toBe(before);
  }, 30_000);

  test('refuses an after-projection revision recovery when the proposed source drifts', async () => {
    const root = await fixture(); const changeId = 'revision-source-recovery';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
    const revision = proposal.envelope.state!.revisionContext as Record<string, string>;
    const assessment = join(root, `.leo-dev/runtime/${changeId}/revision-assessment.json`);
    await writeFile(assessment, JSON.stringify({ schemaVersion: 1, assessmentId: 'source-recovery-assessment', changeId, taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [] }));
    const ready = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', `.leo-dev/runtime/${changeId}/revision-assessment.json`, '--dry-run');
    const grant = await receipt('source-recovery-grant', { receiptId: `${changeId}-grant`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-revision', ...(ready.envelope.state!.revisionApprovalContext as Record<string, string>) });
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: `.leo-dev/runtime/${changeId}/revision-assessment.json`, receipt: grant, faultAt: 'after-batch-projection' })).rejects.toThrow('Simulated crash');
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    await writeFile(join(root, 'spec-v2.md'), '# drifted after projection\n');
    const resumed = cli(root, 'resume', '--change', changeId);
    expect(resumed.status).not.toBe(0);
    expect(await readFile(journal, 'utf8')).toBe(before);
  }, 30_000);

  test.each([
    ['bound source drift', async (root: string, _changeId: string) => { await writeFile(join(root, 'spec-v2.md'), '# drifted after incomplete tail\n'); }, 'Spec revision bound source has drifted: spec-v2.md'],
    ['projection third value', async (root: string, changeId: string) => { await writeFile(join(root, `.leo-dev/changes/${changeId}/manifest.yaml`), 'third: value\n'); }, 'Spec revision recovery projection has a third value'],
  ] as const)('refuses incomplete-tail revision recovery with %s without changing bytes', async (_label, drift, message) => {
    const root = await fixture(); const changeId = `revision-incomplete-${_label.replaceAll(' ', '-')}`;
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: input.assessment, receipt: input.grant, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    await appendFile(journalPath, '{"sequence":');
    await drift(root, changeId);
    const beforeJournal = await readFile(journalPath, 'utf8');
    const beforeProjections = await pendingProjectionState(root, changeId);
    const beforeSnapshot = await readFile(join(root, `.leo-dev/runtime/${changeId}/snapshot.json`), 'utf8');
    for (const flags of [['--dry-run'], []] as const) {
      const resumed = cli(root, 'resume', '--change', changeId, ...flags);
      expect(resumed.status).toBe(7);
      expect(resumed.envelope.code).toBe('BLOCKED');
      expect(resumed.envelope.errors[0]?.message).toContain(message);
      expect(await readFile(journalPath, 'utf8')).toBe(beforeJournal);
      expect(await pendingProjectionState(root, changeId)).toEqual(beforeProjections);
      expect(await readFile(join(root, `.leo-dev/runtime/${changeId}/snapshot.json`), 'utf8')).toBe(beforeSnapshot);
    }
  }, 40_000);

  test('recovers a valid prepared revision with an incomplete journal tail', async () => {
    const root = await fixture(); const changeId = 'revision-incomplete-valid';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: input.assessment, receipt: input.grant, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
    await appendFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), '{"sequence":');
    const resumed = cli(root, 'resume', '--change', changeId);
    expect(resumed.status, JSON.stringify(resumed.envelope)).toBe(0);
    expect(resumed.envelope.state).toMatchObject({ changeState: 'spec-approved', tasks: { 'task-a': { revision: 2, state: 'ready' }, 'task-b': { revision: 2, state: 'pending' } } });
  }, 30_000);

  test('recovers an exact prepared revision after its grant expires', async () => {
    const root = await fixture(); const changeId = 'revision-recover-prepared';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId, 1_500);
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: input.assessment, receipt: input.grant, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_650));
    const resumed = cli(root, 'resume', '--change', changeId);
    expect(resumed.status, JSON.stringify(resumed.envelope)).toBe(0);
    expect(resumed.envelope.state).toMatchObject({ changeState: 'spec-approved', tasks: { 'task-a': { revision: 2, state: 'ready' }, 'task-b': { revision: 2, state: 'pending' } } });
  }, 30_000);

  test('recovers an exact fully projected revision without regenerating authority', async () => {
    const root = await fixture(); const changeId = 'revision-recover-projected';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: input.assessment, receipt: input.grant, faultAt: 'after-batch-projection' })).rejects.toThrow('Simulated crash');
    const resumed = cli(root, 'resume', '--change', changeId);
    expect(resumed.status, JSON.stringify(resumed.envelope)).toBe(0);
    expect(resumed.envelope.state).toMatchObject({ changeState: 'spec-approved', tasks: { 'task-a': { revision: 2, state: 'ready' }, 'task-b': { revision: 2, state: 'pending' } } });
  }, 30_000);

  test('keeps a committed thrown-indeterminate Gate outcome readable after revision', async () => {
    const root = await fixture(); const changeId = 'revision-thrown-indeterminate';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const registryPath = join(root, 'core/gates/default.yaml');
    const registry = YAML.parse(await readFile(registryPath, 'utf8')) as { gates: Array<Record<string, unknown>> };
    registry.gates.push({ id: 'missing', argv: ['/definitely/missing/leo-dev-post-revision-gate'], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'approval-required', environmentAllowlist: [], declaredWritePaths: [] });
    await writeFile(registryPath, YAML.stringify(registry));
    const planPath = join(root, 'plan-v2.json');
    const plan = JSON.parse(await readFile(planPath, 'utf8')) as { tasks: Array<{ id: string; gateIds: string[] }> };
    plan.tasks.find((task) => task.id === 'task-a')!.gateIds = ['missing'];
    await writeFile(planPath, JSON.stringify(plan));
    await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready').status).toBe(0);
    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing').status).toBe(0);
    const claim = cli(root, 'claim', '--change', changeId, '--task', 'task-a');
    expect(claim.status).toBe(0);
    const runId = (claim.envelope.state!.run as { runId: string }).runId;

    const preview = cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', runId, '--dry-run');
    expect(preview.status).toBe(0);
    const { runId: _runId, gateId: _gateId, taskRevision: _taskRevision, leaseGeneration: _leaseGeneration, ...gateApprovalContext } = preview.envelope.state!.gateApprovalContext as Record<string, unknown>;
    const approval = await receipt('missing-gate-approval', { receiptId: `missing-gate-approval-${Date.now()}-${Math.random()}`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture gate approval; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), scope: 'gate', operationKind: 'gate-run', ...gateApprovalContext });
    const gated = cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', runId, '--approval-receipt', approval);
    expect(gated.status).toBe(7);
    expect(gated.envelope.code).toBe('BLOCKED');
    expect(gated.envelope.state).toMatchObject({ changeState: 'approval-required', tasks: { 'task-a': { revision: 2, state: 'blocked' } } });
    const raw = (await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).replayStrict()).events;
    expect(raw.at(-1)?.type).toBe('controller.batch.committed');
    const resultOperation = raw.flatMap((event) => event.type === 'controller.batch.prepared'
      ? ((event.payload as { operations?: Array<Record<string, any>> }).operations ?? []) : []).at(-5)!;
    expect(resultOperation).toMatchObject({ type: 'controller.gate.result', taskId: 'task-a', taskRevision: 2, leaseGeneration: 1,
      payload: { runId, changeId, taskId: 'task-a', taskRevision: 2, leaseGeneration: 1, gateId: 'missing', status: 'unknown' } });
    expect(cli(root, 'status', '--change', changeId)).toMatchObject({ status: 0, envelope: { code: 'STATUS', state: { changeState: 'approval-required' } } });
    expect(cli(root, 'resume', '--change', changeId)).toMatchObject({ status: 0, envelope: { code: 'RESUMED', state: { changeState: 'approval-required' } } });
    expect(cli(root, 'status', '--change', changeId)).toMatchObject({ status: 0, envelope: { code: 'STATUS', state: { changeState: 'approval-required' } } });
  }, 40_000);

  test('recovers a mixed prior-and-desired revision projection state', async () => {
    const root = await fixture(); const changeId = 'revision-recover-mixed';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: input.assessment, receipt: input.grant, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
    const prepared = JSON.parse((await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8')).trim().split('\n').at(-1)!) as { payload: { projections: Array<{ relativePath: string; desiredValue: unknown }> } };
    const projection = prepared.payload.projections[0]!;
    const target = join(root, projection.relativePath);
    await writeFile(target, YAML.stringify(projection.desiredValue)); await chmod(target, 0o600);
    const resumed = cli(root, 'resume', '--change', changeId);
    expect(resumed.status, JSON.stringify(resumed.envelope)).toBe(0);
    expect(resumed.envelope.state).toMatchObject({ changeState: 'spec-approved', tasks: { 'task-a': { revision: 2, state: 'ready' } } });
  }, 30_000);

  test.each(['mode drift', 'third value'] as const)('refuses pending recovery for a projection %s', async (kind) => {
    const root = await fixture(); const changeId = `revision-recover-${kind.replace(' ', '-')}`;
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: input.assessment, receipt: input.grant, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    const manifest = join(root, `.leo-dev/changes/${changeId}/manifest.yaml`);
    if (kind === 'mode drift') await chmod(manifest, 0o644); else await writeFile(manifest, 'third: value\n');
    const resumed = cli(root, 'resume', '--change', changeId);
    expect(resumed.status).not.toBe(0); expect(await readFile(journal, 'utf8')).toBe(before);
  }, 30_000);

  test.each([
    ['semantic no-op', 'spec-v1.md', { schemaVersion: 1, tasks: [
      { id: 'task-a', revision: 2, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-b', revision: 2, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B'], gateIds: ['pass'], risk: 'lite' },
    ] }],
    ['missing existing task', 'spec-v2.md', { schemaVersion: 1, tasks: [
      { id: 'task-a', revision: 2, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A v2'], gateIds: ['pass'], risk: 'lite' },
    ] }],
  ] as const)('refuses a revision plan with %s', async (_label, spec, plan) => {
    const root = await fixture(); const changeId = `revision-invalid-${Math.random().toString(16).slice(2)}`;
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await writeFile(join(root, 'invalid-plan.json'), JSON.stringify(plan));
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', spec, '--plan', 'invalid-plan.json', '--dry-run');
    expect(proposal.status).not.toBe(0);
  });

  test('refuses activation with an active current lease without writing', async () => {
    const root = await fixture(); const changeId = 'revision-active-lease';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await approveInitialSpec(root, changeId);
    expect(cli(root, 'claim', '--change', changeId, '--task', 'task-a').status).toBe(0);
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    for (const flags of [['--dry-run'], []] as const) {
      const activated = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', ...flags);
      expect(activated.status).not.toBe(0); expect(activated.envelope.code).toBe('BLOCKED');
    }
    expect(await readFile(journal, 'utf8')).toBe(before);
  }, 30_000);

  test('refuses an unfinished Gate lifecycle in preview and activation without writing', async () => {
    const root = await fixture(); const changeId = 'revision-unfinished-gate';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    await journal.append({ changeId, taskId: 'task-a', taskRevision: 1, leaseGeneration: 1, type: 'gate.attempt.prepared', payload: { attemptId: 'a'.repeat(64), runId: 'settled-run-with-unfinished-gate' } });
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journalPath, 'utf8');
    for (const flags of [['--dry-run'], []] as const) {
      const outcome = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', ...flags);
      expect(outcome.status).not.toBe(0); expect(outcome.envelope.code).toBe('BLOCKED'); expect(await readFile(journalPath, 'utf8')).toBe(before);
    }
  }, 30_000);

  test('retains an omitted bound constitution and fences later constitution drift', async () => {
    const root = await fixture(); const changeId = 'revision-constitution';
    await writeFile(join(root, 'constitution.md'), '# constitution v1\n');
    await writeFile(join(root, 'constitution-plan-v2.json'), JSON.stringify({ schemaVersion: 1, tasks: [
      { id: 'task-b', revision: 2, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-a', revision: 2, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A'], gateIds: ['pass'], risk: 'lite' },
    ] }));
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'constitution-plan-v2.json', '--constitution', 'constitution.md', '--dry-run');
    expect(proposal.status).toBe(0);
    const revision = proposal.envelope.state!.revisionContext as Record<string, string>;
    const assessment = join(root, `.leo-dev/runtime/${changeId}/revision-assessment.json`);
    await writeFile(assessment, JSON.stringify({ schemaVersion: 1, assessmentId: 'constitution-assessment', changeId, taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [] }));
    const ready = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'constitution-plan-v2.json', '--constitution', 'constitution.md', '--assessment', `.leo-dev/runtime/${changeId}/revision-assessment.json`, '--dry-run');
    const grant = await receipt('constitution-grant', { receiptId: `${changeId}-grant`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-revision', ...(ready.envelope.state!.revisionApprovalContext as Record<string, string>) });
    expect(cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'constitution-plan-v2.json', '--constitution', 'constitution.md', '--assessment', `.leo-dev/runtime/${changeId}/revision-assessment.json`, '--receipt', grant).status).toBe(0);
    await writeFile(join(root, 'constitution-plan-v3.json'), JSON.stringify({ schemaVersion: 1, tasks: [
      { id: 'task-b', revision: 3, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-a', revision: 3, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A'], gateIds: ['pass'], risk: 'lite' },
    ] }));
    await writeFile(join(root, 'spec-v1.md'), '# source changed for retained constitution\n');
    const retained = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'constitution-plan-v3.json', '--dry-run');
    expect(retained.status).toBe(0);
    expect((retained.envelope.state!.revisionContext as { constitution: { path: string } }).constitution.path).toBe('constitution.md');
    await writeFile(join(root, 'constitution.md'), '# constitution drifted\n');
    const status = cli(root, 'status', '--change', changeId);
    expect(status.status).not.toBe(0); expect(status.envelope.code).toBe('CONFLICT');
  }, 30_000);

  test('admits exactly one of two concurrent compiled revision activations', async () => {
    const root = await fixture(); const changeId = 'revision-concurrent';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    const args = ['revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', input.assessment, '--receipt', input.grant];
    const outcomes = await Promise.all([cliAsync(root, ...args), cliAsync(root, ...args)]);
    expect(outcomes.filter((outcome) => outcome.status === 0)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status !== 0)).toHaveLength(1);
    expect(cli(root, 'status', '--change', changeId).envelope.state).toMatchObject({ changeState: 'spec-approved', tasks: { 'task-a': { revision: 2 }, 'task-b': { revision: 2 } } });
  }, 30_000);

  test('fails closed on a direct non-batch revision authority event', async () => {
    const root = await fixture(); const changeId = 'revision-forged';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    await journal.withExclusive(async (transaction) => { await transaction.append({ changeId, type: 'controller.spec.revised', payload: { schemaVersion: 1, authority: {} } }); });
    const status = cli(root, 'status', '--change', changeId);
    expect(status.status).not.toBe(0); expect(status.envelope.code).toBe('BLOCKED');
  });

  test('rejects a supplied mismatched revision grant during dry-run without writing', async () => {
    const root = await fixture(); const changeId = 'revision-wrong-preview-grant';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    const wrong = JSON.parse(await readFile(input.grant, 'utf8')) as Record<string, unknown>;
    wrong.inputFingerprint = '0'.repeat(64);
    await writeFile(input.grant, JSON.stringify(wrong));
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    const preview = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', input.assessment, '--receipt', input.grant, '--dry-run');
    expect(preview.status).not.toBe(0);
    expect(preview.envelope.code).toBe('CONFLICT');
    expect(await readFile(journal, 'utf8')).toBe(before);
  }, 30_000);

  test('refuses an omitted constitution when the currently bound document already drifted', async () => {
    const root = await fixture(); const changeId = 'revision-omitted-constitution-drift';
    await writeFile(join(root, 'constitution.md'), '# constitution v1\n');
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const firstProposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--constitution', 'constitution.md', '--dry-run');
    const first = firstProposal.envelope.state!.revisionContext as Record<string, string>;
    const assessmentPath = join(root, `.leo-dev/runtime/${changeId}/constitution-assessment.json`);
    await writeFile(assessmentPath, JSON.stringify({ schemaVersion: 1, assessmentId: 'constitution-v2', changeId, taskId: first.taskId, specHash: first.authorityHash, subjectTreeHash: first.subjectTreeHash, coverage: 'complete', findings: [] }));
    const ready = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--constitution', 'constitution.md', '--assessment', `.leo-dev/runtime/${changeId}/constitution-assessment.json`, '--dry-run');
    const grant = await receipt('constitution-v2-grant', { receiptId: `${changeId}-grant`, provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture authority; issuer not authenticated', decision: 'grant', grantedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-revision', ...(ready.envelope.state!.revisionApprovalContext as Record<string, string>) });
    expect(cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--constitution', 'constitution.md', '--assessment', `.leo-dev/runtime/${changeId}/constitution-assessment.json`, '--receipt', grant).status).toBe(0);
    await writeFile(join(root, 'plan-v3.json'), JSON.stringify({ schemaVersion: 1, tasks: [
      { id: 'task-b', revision: 3, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B v3'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-a', revision: 3, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A v3'], gateIds: ['pass'], risk: 'lite' },
    ] }));
    await writeFile(join(root, 'constitution.md'), '# drift before omitted proposal\n');
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v3.json', '--dry-run');
    expect(proposal.status).not.toBe(0);
    expect(proposal.envelope.code).toBe('CONFLICT');
    expect(await readFile(journal, 'utf8')).toBe(before);
  }, 30_000);

  test('applies ordinary Lite path normalization to a revision plan', async () => {
    const root = await fixture(); const changeId = 'revision-normalized-plan';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await writeFile(join(root, 'non-normalized-plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [
      { id: 'task-a', revision: 2, state: 'ready', dependsOn: [], allowedPaths: ['src/../outside.ts'], acceptance: ['A v2'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-b', revision: 2, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B v2'], gateIds: ['pass'], risk: 'lite' },
    ] }));
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'non-normalized-plan.json', '--dry-run');
    expect(proposal.status).not.toBe(0);
    expect(proposal.envelope.code).toBe('VALIDATION_ERROR');
  });

  test('treats a registry-path change as semantic revision substance', async () => {
    const root = await fixture(); const changeId = 'revision-registry-substance';
    await writeFile(join(root, 'core/gates/alternate.yaml'), await readFile(join(root, 'core/gates/default.yaml')));
    await writeFile(join(root, 'same-substance-plan-v2.json'), JSON.stringify({ schemaVersion: 1, tasks: [
      { id: 'task-a', revision: 2, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-b', revision: 2, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B'], gateIds: ['pass'], risk: 'lite' },
    ] }));
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'same-substance-plan-v2.json', '--registry', 'core/gates/alternate.yaml', '--dry-run');
    expect(proposal.status, JSON.stringify(proposal.envelope)).toBe(0);
    expect((proposal.envelope.state!.revisionContext as { routes: Array<{ registryPath: string }> }).routes.every((route) => route.registryPath === 'core/gates/alternate.yaml')).toBe(true);
  });

  test('refuses revision inputs that collide with exact generated projections', async () => {
    const root = await fixture(); const changeId = 'revision-input-collision';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const generatedSpec = `.leo-dev/changes/${changeId}/spec.yaml`;
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', generatedSpec, '--plan', 'plan-v2.json', '--dry-run');
    expect(proposal.status).not.toBe(0);
    expect(proposal.envelope.code).toBe('VALIDATION_ERROR');
  });

  test('exposes only current-epoch execution evidence and recovers a revised submitted review', async () => {
    const root = await fixture(); const changeId = 'revision-current-evidence';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await approveInitialSpec(root, changeId);
    await completeTask(root, changeId, 'task-a');
    const applied = await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    const state = applied.envelope.state! as Record<string, any>;
    expect(state.authority).toMatchObject({ revision: 2, revisionId: state.authority.specHash, specPath: 'spec-v2.md' });
    expect(state.authority.sourceHash).not.toBe(state.authority.specHash);
    expect(state).toMatchObject({ run: null, reviewContext: null, reviewRecovery: null, reconciliationContext: null, evidenceRefs: [] });
    expect(state.historicalEvidence).toMatchObject({ run: { lease: { taskId: 'task-a', taskRevision: 1 } }, reviewContext: { taskId: 'task-a', taskRevision: 1 } });
    expect((state.historicalEvidence.evidenceRefs as string[]).length).toBeGreaterThan(0);

    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready').status).toBe(0);
    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing').status).toBe(0);
    const claimed = cli(root, 'claim', '--change', changeId, '--task', 'task-a', '--ttl', '5000');
    expect(claimed.status, JSON.stringify(claimed.envelope)).toBe(0);
    const runId = (claimed.envelope.state!.run as { runId: string }).runId;
    expect(cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', runId).status).toBe(0);
    const submitted = cli(root, 'submit', '--change', changeId, '--task', 'task-a');
    expect(submitted.status, JSON.stringify(submitted.envelope)).toBe(0);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_200));
    const recovered = cli(root, 'resume', '--change', changeId, '--task', 'task-a', '--recover-review');
    expect(recovered.status, JSON.stringify(recovered.envelope)).toBe(0);
    expect(recovered.envelope.state).toMatchObject({ reviewContext: { taskId: 'task-a', taskRevision: 2 }, reviewRecovery: { evidence: { gateStatus: 'succeeded' } } });
  }, 40_000);

  test('keeps remediating after historic failures with distinct findings across earlier task revisions', async () => {
    const root = await fixture(); const changeId = 'revision-cumulative-provenance';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    await journal.withExclusive(async (transaction) => {
      for (let ordinal = 1; ordinal <= 3; ordinal += 1) {
        await transaction.append({ changeId, taskId: 'task-a', taskRevision: 1, leaseGeneration: ordinal, type: 'run.claimed', payload: { runId: `historic-run-${ordinal}`, lease: { taskId: 'task-a', taskRevision: 1, generation: ordinal, inputTreeHash: '1'.repeat(64), expiresAt: '2030-01-01T00:00:00.000Z' }, operationFingerprint: `${ordinal}`.repeat(64), sessionId: `historic-session-${ordinal}`, attemptKind: ordinal === 1 ? 'initial' : 'remediation' } });
        await transaction.append({ changeId, taskId: 'task-a', taskRevision: 1, leaseGeneration: ordinal, type: 'task.attempt.failed', payload: { receiptId: `historic-failure-${ordinal}`, findingsHash: `${ordinal + 3}`.repeat(64), ordinal, nextAttempt: 'remediation' } });
      }
    });
    await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready').status).toBe(0);
    expect(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing').status).toBe(0);
    const reused = cli(root, 'claim', '--change', changeId, '--task', 'task-a', '--session', 'historic-session-3', '--dry-run');
    expect(reused.status, JSON.stringify(reused.envelope)).toBe(0);
    const fresh = cli(root, 'claim', '--change', changeId, '--task', 'task-a', '--session', 'fresh-revision-session', '--dry-run');
    expect(fresh.status, JSON.stringify(fresh.envelope)).toBe(0);
    expect(cli(root, 'status', '--change', changeId).envelope.state).toMatchObject({ attempts: { 'task-a': { consumed: 3, nextKind: 'remediation' } } });
  }, 30_000);

  test('uses semantic authority for team epochs and archives only the immediately previous team across three versions', async () => {
    const root = await fixture(); const changeId = 'revision-team-epochs';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await openTeam(root, changeId, sha256('# v1\n'), 'open-v1');
    const v2 = await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    const v2Authority = (v2.envelope.state!.authority as { specHash: string }).specHash;
    expect(v2Authority).not.toBe(sha256('# v2\n'));
    await openTeam(root, changeId, v2Authority, 'open-v2');
    await writeFile(join(root, 'spec-v3.md'), '# v3\n');
    await writeFile(join(root, 'plan-v3.json'), JSON.stringify({ schemaVersion: 1, tasks: [
      { id: 'task-b', revision: 3, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B v3'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-a', revision: 3, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A v3'], gateIds: ['pass'], risk: 'lite' },
    ] }));
    const v3 = await applyRevisionFor(root, changeId, 'spec-v3.md', 'plan-v3.json', 'v3');
    const v3Authority = (v3.envelope.state!.authority as { specHash: string }).specHash;
    const teamStatus = cli(root, 'team', '--change', changeId, '--action', 'status');
    expect(teamStatus.status, JSON.stringify(teamStatus.envelope)).toBe(0);
    expect(teamStatus.envelope.state).toMatchObject({ team: null, currentSpecHash: v3Authority, stale: false, archivedTeam: { teamId: 'team-open-v2', specHash: v2Authority } });
    await openTeam(root, changeId, v3Authority, 'open-v3');
  }, 40_000);

  test.each([
    ['extra success transition', (batch: Record<string, any>) => { batch.operations.push({ type: 'task.transition', taskId: 'task-a', taskRevision: 2, payload: { from: 'ready', to: 'done' } }); }],
    ['missing tasks projection', (batch: Record<string, any>) => { batch.projections = batch.projections.filter((projection: { relativePath: string }) => !projection.relativePath.endsWith('/tasks.yaml')); batch.recovery.projections = batch.recovery.projections.filter((projection: { relativePath: string }) => !projection.relativePath.endsWith('/tasks.yaml')); }],
    ['missing recovery proof', (batch: Record<string, any>) => { delete batch.recovery; }],
    ['authenticated receipt envelope', (batch: Record<string, any>) => { batch.operations[1].payload.issuerAuthenticated = true; }],
    ['backdated prepared timestamp', (batch: Record<string, any>) => { batch.preparedAt = new Date(Date.parse(batch.preparedAt) - 1).toISOString(); }],
  ] as const)('rejects a committed revision batch with %s', async (_label, mutate) => {
    const root = await fixture(); const changeId = `revision-forged-${_label.replaceAll(' ', '-')}`;
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    await mutateLatestRevisionBatch(root, changeId, mutate);
    const status = cli(root, 'status', '--change', changeId);
    expect(status.status).not.toBe(0); expect(status.envelope.code).toBe('BLOCKED');
  }, 30_000);

  test('rejects a task-scoped enclosing revision batch envelope', async () => {
    const root = await fixture(); const changeId = 'revision-scoped-batch-envelope';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    await mutateLatestRevisionBatch(root, changeId, () => {}, true, { prepared: { taskId: 'task-a', taskRevision: 2, leaseGeneration: 1 } });
    const status = cli(root, 'status', '--change', changeId); expect(status.status).not.toBe(0); expect(status.envelope.code).toBe('BLOCKED');
  }, 30_000);

  test('rejects a duplicate or direct orphan revision receipt', async () => {
    const root = await fixture(); const changeId = 'revision-orphan-receipts';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const applied = await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    const events = (await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).replayStrict()).events;
    const revisionReceipt = events.flatMap((event) => event.type === 'controller.batch.prepared' ? ((event.payload as { operations?: Array<Record<string, any>> }).operations ?? []) : []).find((operation) => operation.type === 'receipt.spec-revision.ingested')!;
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    await journal.append({ changeId, type: 'receipt.spec-revision.ingested', payload: revisionReceipt.payload });
    const status = cli(root, 'status', '--change', changeId);
    expect(status.status).not.toBe(0); expect(status.envelope.code).toBe('BLOCKED');
    expect(applied.envelope.state!.changeState).toBe('spec-approved');
  }, 30_000);

  test('preserves unrelated legacy duplicate receipt IDs while reserving revision receipt consumption', async () => {
    const root = await fixture(); const changeId = 'revision-legacy-duplicate-receipts';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const journal = new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`));
    await journal.append({ changeId, type: 'receipt.review.ingested', payload: { receipt: { receiptId: 'legacy-shared' } } });
    await journal.append({ changeId, type: 'receipt.approval.ingested', payload: { receipt: { receiptId: 'legacy-shared' } } });
    const status = cli(root, 'status', '--change', changeId);
    expect(status.status, JSON.stringify(status.envelope)).toBe(0);
  }, 30_000);

  test('reserves a consumed revision receipt from later ordinary public approval without writes', async () => {
    const root = await fixture(); const changeId = 'revision-public-receipt-reservation';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    expect(cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', input.assessment, '--receipt', input.grant).status).toBe(0);
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    const snapshotPath = join(root, `.leo-dev/runtime/${changeId}/snapshot.json`);
    const beforeJournal = await readFile(journalPath, 'utf8'); const beforeSnapshot = await readFile(snapshotPath, 'utf8');
    for (const flags of [['--dry-run'], []] as const) {
      const approved = cli(root, 'approve', '--change', changeId, '--receipt', input.grant, ...flags);
      expect(approved.status).toBe(5);
      expect(approved.envelope.code).toBe('CONFLICT');
      expect(await readFile(journalPath, 'utf8')).toBe(beforeJournal);
      expect(await readFile(snapshotPath, 'utf8')).toBe(beforeSnapshot);
      expect(cli(root, 'status', '--change', changeId).status).toBe(0);
    }
    expect(cli(root, 'resume', '--change', changeId).status).toBe(0);
  }, 30_000);

  test('refuses pending ordinary receipt recovery when it reuses a committed revision receipt ID', async () => {
    const root = await fixture(); const changeId = 'revision-pending-ordinary-receipt-reservation';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    expect(cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', input.assessment, '--receipt', input.grant).status).toBe(0);
    const events = (await new Journal(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`)).replayStrict()).events;
    const revisionReceipt = events.flatMap((event) => event.type === 'controller.batch.prepared'
      ? ((event.payload as { operations?: Array<Record<string, unknown>> }).operations ?? []) : []).find((operation) => operation.type === 'receipt.spec-revision.ingested')!;
    await appendPendingBatch(root, changeId, 'receipt-approval', [{ type: 'receipt.approval.ingested', payload: revisionReceipt.payload }]);
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    const beforeJournal = await readFile(journalPath, 'utf8'); const beforeSnapshot = await readFile(join(root, `.leo-dev/runtime/${changeId}/snapshot.json`), 'utf8');
    for (const flags of [['--dry-run'], []] as const) {
      const resumed = cli(root, 'resume', '--change', changeId, ...flags);
      expect(resumed.status).toBe(7);
      expect(resumed.envelope.code).toBe('BLOCKED');
      expect(await readFile(journalPath, 'utf8')).toBe(beforeJournal);
      expect(await readFile(join(root, `.leo-dev/runtime/${changeId}/snapshot.json`), 'utf8')).toBe(beforeSnapshot);
    }
  }, 30_000);

  test.each([
    ['prepared', 'after-batch-prepared', false],
    ['projected', 'after-batch-projection', true],
  ] as const)('refuses a duplicate revision receipt in a pending %s recovery before any write', async (_phase, faultAt, projectionsAlreadyApplied) => {
    const root = await fixture(); const changeId = `revision-pending-duplicate-${_phase}`;
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await approveInitialSpec(root, changeId);
    const input = await readyRevision(root, changeId);
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: input.assessment, receipt: input.grant, faultAt })).rejects.toThrow('Simulated crash');
    await rewritePendingRevisionReceiptId(root, changeId, `${changeId}-initial-grant`, projectionsAlreadyApplied);
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
    const beforeJournal = await readFile(journalPath, 'utf8');
    const beforeProjections = await pendingProjectionState(root, changeId);

    for (const flags of [['--dry-run'], []] as const) {
      const resumed = cli(root, 'resume', '--change', changeId, ...flags);
      expect(resumed.status).toBe(7);
      expect(resumed.envelope.code).toBe('BLOCKED');
      expect(resumed.envelope.errors[0]?.message).toBe('Specification revision receipt identity is invalid or has been consumed more than once');
      expect(await readFile(journalPath, 'utf8')).toBe(beforeJournal);
      expect(await pendingProjectionState(root, changeId)).toEqual(beforeProjections);
    }
  }, 40_000);

  test.each(['orphan revision receipt', 'postrevision replacement route', 'orphan immutable revision projection'] as const)('refuses a pending ordinary batch containing %s before recovery writes', async (kind) => {
    const root = await fixture(); const changeId = `revision-pending-${kind.replaceAll(' ', '-')}`;
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    if (kind === 'postrevision replacement route') await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    const operation = kind === 'orphan revision receipt'
      ? { type: 'receipt.spec-revision.ingested', payload: { receipt: { receiptId: 'orphan-in-batch' } } }
      : kind === 'postrevision replacement route' ? { type: 'route.selected', taskId: 'task-a', taskRevision: 3, payload: { task: { id: 'task-a', revision: 3, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['forged'], gateIds: ['pass'], risk: 'lite' }, taskHash: 'a'.repeat(64), registryPath: 'core/gates/default.yaml', gateDefinitionHash: 'b'.repeat(64) } }
        : { type: 'ordinary.operation', payload: {} };
    const desiredValue = { forged: true }; const revisionPath = `.leo-dev/changes/${changeId}/spec-revisions/${'a'.repeat(64)}.yaml`;
    const projections = kind === 'orphan immutable revision projection' ? [{ relativePath: revisionPath, priorHash: sha256(''), desiredHash: sha256(YAML.stringify(desiredValue)), desiredValue }] : [];
    await appendPendingBatch(root, changeId, 'ordinary-forgery', [operation], projections);
    const journalPath = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journalPath, 'utf8');
    const resumed = cli(root, 'resume', '--change', changeId);
    expect(resumed.status).not.toBe(0); expect(resumed.envelope.code).toBe('BLOCKED'); expect(await readFile(journalPath, 'utf8')).toBe(before);
  }, 30_000);

  test('activates a revision from a quiescent settled remediation state and replays it', async () => {
    const root = await fixture(); const changeId = 'revision-settled-remediation';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await approveInitialSpec(root, changeId);
    const claimed = cli(root, 'claim', '--change', changeId, '--task', 'task-a'); const runId = (claimed.envelope.state!.run as { runId: string }).runId;
    expect(cli(root, 'run-gates', '--change', changeId, '--task', 'task-a', '--run', runId).status).toBe(0); expect(cli(root, 'submit', '--change', changeId, '--task', 'task-a').status).toBe(0);
    const context = cli(root, 'status', '--change', changeId).envelope.state!.reviewContext as Record<string, unknown>;
    const rejection = await receipt('settled-remediation-review', { ...context, receiptId: 'settled-remediation-review', provenance: 'human-confirmed', actorLabel: 'TEST-ONLY fixture reviewer; issuer not authenticated', sessionId: 'settled-remediation-session', findingsHash: sha256('bounded finding'), verdict: 'reject', timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() });
    expect(cli(root, 'review', '--change', changeId, '--task', 'task-a', '--receipt', rejection).status).toBe(0);
    expect(cli(root, 'status', '--change', changeId).envelope.state).toMatchObject({ tasks: { 'task-a': { state: 'remediation' } }, leases: { 'task-a': { active: false } } });
    const applied = await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    expect(applied.envelope.state).toMatchObject({ authority: { revision: 2 }, tasks: { 'task-a': { revision: 2, state: 'ready' } } });
    expect(cli(root, 'status', '--change', changeId).status).toBe(0);
  }, 40_000);

  test('accepts and replays revision activation from supported legacy direct history', async () => {
    const root = await fixture(); const changeId = 'revision-legacy-direct';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await rewriteAsLegacyDirectHistory(root, changeId);
    expect(cli(root, 'status', '--change', changeId).status).toBe(0);
    const applied = await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    expect(applied.envelope.state).toMatchObject({ authority: { revision: 2 }, tasks: { 'task-a': { revision: 2 } } });
    expect(cli(root, 'status', '--change', changeId).status).toBe(0);
  }, 30_000);

  test('rejects a v3 history that discards known v2 source bytes from its prior archive', async () => {
    const root = await fixture(); const changeId = 'revision-prior-source-continuity';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    await writeFile(join(root, 'spec-v3.md'), '# v3\n'); await writeFile(join(root, 'plan-v3.json'), JSON.stringify({ schemaVersion: 1, tasks: [
      { id: 'task-b', revision: 3, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B v3'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-a', revision: 3, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A v3'], gateIds: ['pass'], risk: 'lite' },
    ] }));
    const v3 = await applyRevisionFor(root, changeId, 'spec-v3.md', 'plan-v3.json', 'v3');
    let forgedRevision: Record<string, unknown> | undefined;
    await mutateLatestRevisionBatch(root, changeId, (batch) => {
      const revised = batch.operations.find((operation: Record<string, unknown>) => operation.type === 'controller.spec.revised').payload;
      revised.authority.previousSource = { path: 'spec-v2.md', sourceHash: sha256('# v2\n'), sourceBase64: null, bytesUnavailable: true };
      forgedRevision = revised;
      const projection = batch.projections.find((candidate: { relativePath: string }) => candidate.relativePath.includes('/spec-revisions/'));
      projection.desiredValue = revised; projection.desiredHash = sha256(YAML.stringify(revised));
      const snapshot = batch.recovery.projections.find((candidate: { relativePath: string }) => candidate.relativePath === projection.relativePath);
      snapshot.desired = { type: 'file', mode: '600', bytesBase64: Buffer.from(YAML.stringify(revised)).toString('base64') };
    });
    await writeFile(join(root, `.leo-dev/changes/${changeId}/spec-revisions/${(v3.envelope.state!.authority as { revisionId: string }).revisionId}.yaml`), YAML.stringify(forgedRevision));
    const status = cli(root, 'status', '--change', changeId); expect(status.status).not.toBe(0); expect(status.envelope.code).toBe('BLOCKED');
  }, 40_000);

  test.each([
    ['rejected', (grant: Record<string, unknown>) => { grant.decision = 'reject'; }],
    ['future', (grant: Record<string, unknown>) => { grant.grantedAt = new Date(Date.now() + 60_000).toISOString(); }],
    ['expired', (grant: Record<string, unknown>) => { grant.expiresAt = new Date(Date.now() - 1_000).toISOString(); }],
    ['task-scoped', (grant: Record<string, unknown>) => { grant.taskId = 'task-a'; }],
    ['stale-context', (grant: Record<string, unknown>) => { grant.decisionFingerprint = '0'.repeat(64); }],
  ] as const)('rejects a supplied %s revision grant in preview and execution without writing', async (_label, mutate) => {
    const root = await fixture(); const changeId = `revision-grant-${_label}`;
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId); const grant = JSON.parse(await readFile(input.grant, 'utf8')) as Record<string, unknown>; mutate(grant); await writeFile(input.grant, JSON.stringify(grant));
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    for (const flags of [['--dry-run'], []] as const) {
      const outcome = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', input.assessment, '--receipt', input.grant, ...flags);
      expect(outcome.status).not.toBe(0); expect(await readFile(journal, 'utf8')).toBe(before);
    }
  }, 30_000);

  test('rejects an A-to-B-to-A attempt carrying the old B approval', async () => {
    const root = await fixture(); const changeId = 'revision-aba';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0);
    expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const b = await readyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'b');
    expect(cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', b.assessment, '--receipt', b.grant).status).toBe(0);
    await writeFile(join(root, 'plan-v3.json'), JSON.stringify({ schemaVersion: 1, tasks: [
      { id: 'task-b', revision: 3, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/b.ts'], acceptance: ['B'], gateIds: ['pass'], risk: 'lite' },
      { id: 'task-a', revision: 3, state: 'ready', dependsOn: [], allowedPaths: ['src/a.ts'], acceptance: ['A'], gateIds: ['pass'], risk: 'lite' },
    ] }));
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'plan-v3.json', '--dry-run');
    expect(proposal.status).toBe(0);
    const revision = proposal.envelope.state!.revisionContext as Record<string, string>; const previousAssessmentFingerprint = (proposal.envelope.state!.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const assessment = `.leo-dev/runtime/${changeId}/assessment-a.json`;
    await writeFile(join(root, assessment), JSON.stringify({ schemaVersion: 1, assessmentId: 'aba-a', changeId, taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [], previousAssessmentFingerprint }));
    const before = await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8');
    const replay = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v1.md', '--plan', 'plan-v3.json', '--assessment', assessment, '--receipt', b.grant, '--dry-run');
    expect(replay.status).not.toBe(0); expect(replay.envelope.code).toBe('CONFLICT');
    expect(await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8')).toBe(before);
  }, 30_000);

  test('archives available legacy source bytes and explicitly marks genuine in-place unavailability', async () => {
    const availableRoot = await fixture(); const availableId = 'revision-legacy-available';
    expect(cli(availableRoot, 'init', '--change', availableId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(availableRoot, 'route', '--change', availableId, '--plan', 'plan-v1.json').status).toBe(0);
    const available = await applyRevisionFor(availableRoot, availableId, 'spec-v2.md', 'plan-v2.json', 'v2');
    const availableRecord = YAML.parse(await readFile(join(availableRoot, `.leo-dev/changes/${availableId}/spec-revisions/${(available.envelope.state!.authority as { revisionId: string }).revisionId}.yaml`), 'utf8')) as { authority: { previousSource: Record<string, unknown> } };
    expect(availableRecord.authority.previousSource).toEqual({ path: 'spec-v1.md', sourceHash: sha256('# v1\n'), sourceBase64: Buffer.from('# v1\n').toString('base64'), bytesUnavailable: false });

    const unavailableRoot = await fixture(); const unavailableId = 'revision-legacy-unavailable';
    expect(cli(unavailableRoot, 'init', '--change', unavailableId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(unavailableRoot, 'route', '--change', unavailableId, '--plan', 'plan-v1.json').status).toBe(0);
    await writeFile(join(unavailableRoot, 'spec-v1.md'), '# replaced in place\n');
    const unavailable = await applyRevisionFor(unavailableRoot, unavailableId, 'spec-v1.md', 'plan-v2.json', 'v2');
    const unavailableRecord = YAML.parse(await readFile(join(unavailableRoot, `.leo-dev/changes/${unavailableId}/spec-revisions/${(unavailable.envelope.state!.authority as { revisionId: string }).revisionId}.yaml`), 'utf8')) as { authority: { previousSource: Record<string, unknown> } };
    expect(unavailableRecord.authority.previousSource).toEqual({ path: 'spec-v1.md', sourceHash: sha256('# v1\n'), sourceBase64: null, bytesUnavailable: true });
  }, 30_000);

  test('rejects a tampered pending recovery proof before any recovery write', async () => {
    const root = await fixture(); const changeId = 'revision-pending-proof';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const input = await readyRevision(root, changeId);
    await expect(new Controller().execute('revise', { repo: root, change: changeId, spec: 'spec-v2.md', plan: 'plan-v2.json', assessment: input.assessment, receipt: input.grant, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
    await mutateLatestRevisionBatch(root, changeId, (batch) => { batch.recovery.remainderEntries.push('forged.txt\u0000644\u0000' + '0'.repeat(64)); }, false);
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    for (const flags of [['--dry-run'], []] as const) {
      const resumed = cli(root, 'resume', '--change', changeId, ...flags); expect(resumed.status).not.toBe(0); expect(resumed.envelope.code).toBe('BLOCKED'); expect(await readFile(journal, 'utf8')).toBe(before);
    }
  }, 30_000);

  test('records a nonready revision assessment without activation and preserves sticky material refusal', async () => {
    const root = await fixture(); const changeId = 'revision-sticky-governance';
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const proposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
    const context = proposal.envelope.state!.revisionContext as Record<string, string>;
    const materialPath = `.leo-dev/runtime/${changeId}/material-assessment.json`;
    await writeFile(join(root, materialPath), JSON.stringify({ schemaVersion: 1, assessmentId: 'material-v2', changeId, taskId: context.taskId, specHash: context.authorityHash, subjectTreeHash: context.subjectTreeHash, coverage: 'complete', findings: [{ id: 'material-boundary', severity: 'high', relation: 'required-by-change', boundary: 'revision', rationale: 'requires a separately authorized material migration', evidence: [{ path: 'spec-v2.md', sha256: sha256('# v2\n') }], repairScope: 'material' }] }));
    const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
    const refused = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', materialPath);
    expect(refused.status).not.toBe(0); expect(refused.envelope.code).toBe('APPROVAL_REQUIRED');
    const after = await readFile(journal, 'utf8'); expect(after.startsWith(before)).toBe(true); expect(after).not.toBe(before);
    expect(cli(root, 'status', '--change', changeId).envelope.state).toMatchObject({ authority: { revision: 1 }, tasks: { 'task-a': { revision: 1 } } });

    const successorProposal = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
    const successor = successorProposal.envelope.state!.revisionContext as Record<string, string>; const previousAssessmentFingerprint = (successorProposal.envelope.state!.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const successorPath = `.leo-dev/runtime/${changeId}/successor-assessment.json`;
    await writeFile(join(root, successorPath), JSON.stringify({ schemaVersion: 1, assessmentId: 'successor-v2', changeId, taskId: successor.taskId, specHash: successor.authorityHash, subjectTreeHash: successor.subjectTreeHash, coverage: 'complete', findings: [], previousAssessmentFingerprint, resolutions: [{ findingId: 'material-boundary', rationale: 'still requires separate material authority', evidence: [{ path: 'spec-v1.md', sha256: sha256('# v1\n') }] }] }));
    const sticky = cli(root, 'revise', '--change', changeId, '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', successorPath, '--dry-run');
    expect(sticky.status).toBe(0);
    expect(sticky.envelope.state!.revisionContext).toMatchObject({ assessment: { disposition: 'approval-required' }, missingPrerequisites: ['approval-required'] });
  }, 30_000);

  test('reconstructs the approved tree using canonical recursive directory order', async () => {
    const root = await fixture(); const changeId = 'revision-tree-order';
    await mkdir(join(root, 'a'), { recursive: true }); await writeFile(join(root, 'a/z.txt'), 'nested first\n'); await writeFile(join(root, 'a-foo.txt'), 'sibling second\n');
    expect(cli(root, 'init', '--change', changeId, '--spec', 'spec-v1.md').status).toBe(0); expect(cli(root, 'route', '--change', changeId, '--plan', 'plan-v1.json').status).toBe(0);
    const applied = await applyRevisionFor(root, changeId, 'spec-v2.md', 'plan-v2.json', 'v2');
    expect(applied.envelope.state).toMatchObject({ authority: { revision: 2 }, tasks: { 'task-a': { revision: 2 } } });
  }, 30_000);
});
