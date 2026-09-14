import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { afterEach, expect, test } from 'vitest';
import { Controller } from '../../packages/cli/src/controller/controller.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

type Envelope = { ok: boolean; code: string; state: Record<string, any> | null; errors: Array<{ code: string; message: string }> };

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
  expect(result.error, result.error?.message).toBeUndefined();
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  expect(lines, `stderr=${result.stderr}`).toHaveLength(1);
  return { status: result.status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope };
}

async function cliAsync(root: string, ...args: string[]): Promise<ReturnType<typeof cli>> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (value: Buffer) => { stdout += value; }); child.stderr.on('data', (value: Buffer) => { stderr += value; });
    child.once('error', rejectResult);
    child.once('close', (status) => {
      try {
        const lines = stdout.trim().split('\n').filter(Boolean); expect(lines, `stderr=${stderr}`).toHaveLength(1);
        resolveResult({ status: status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope });
      } catch (error) { rejectResult(error); }
    });
  });
}

function expectExit(actual: ReturnType<typeof cli>, status: number, code: string): void {
  expect(actual.status, JSON.stringify(actual.envelope)).toBe(status);
  expect(actual.envelope.code).toBe(code);
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-claim-continuation-')); temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true }); await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{ id: 'pass', argv: [process.execPath, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 10, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }] }));
  await writeFile(join(root, 'spec.md'), '# Claim continuation fixture\n');
  await writeFile(join(root, 'design.md'), '# Reviewed design\n');
  await writeFile(join(root, 'src/app.ts'), 'export const version = 1;\n');
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'implementation', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['passes'], gateIds: ['pass'], risk: 'standard' }] }));
  return root;
}

async function receipt(root: string, name: string, value: unknown): Promise<string> {
  const path = join(root, name); await writeFile(path, JSON.stringify(value)); return path;
}

async function runtimeReceipt(root: string, changeId: string, name: string, value: unknown): Promise<string> {
  const directory = join(root, '.leo-dev', 'runtime', changeId, 'receipts');
  await mkdir(directory, { recursive: true });
  const path = join(directory, name); await writeFile(path, JSON.stringify(value)); return path;
}

async function waitUntilExpired(expiresAt: string): Promise<void> {
  const deadline = Date.parse(expiresAt) + 30;
  while (Date.now() <= deadline) await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(25, Math.max(1, deadline - Date.now() + 1))));
}

function runtimePaths(root: string, changeId: string): { journal: string; snapshot: string } {
  const runtime = join(root, '.leo-dev', 'runtime', changeId);
  return { journal: join(runtime, 'journal.ndjson'), snapshot: join(runtime, 'snapshot.json') };
}

async function unchangedAfterRefusal(root: string, changeId: string, action: () => ReturnType<typeof cli>): Promise<ReturnType<typeof cli>> {
  const paths = runtimePaths(root, changeId);
  const beforeJournal = await readFile(paths.journal, 'utf8'); const beforeSnapshot = await readFile(paths.snapshot, 'utf8');
  const outcome = action();
  expect(outcome.status, JSON.stringify(outcome.envelope)).not.toBe(0);
  expect(await readFile(paths.journal, 'utf8')).toBe(beforeJournal); expect(await readFile(paths.snapshot, 'utf8')).toBe(beforeSnapshot);
  return outcome;
}

async function freshDesignReceipt(root: string, changeId: string, design: Record<string, any>, name: string, overrides: Record<string, unknown> = {}): Promise<string> {
  return runtimeReceipt(root, changeId, name, {
    receiptId: `fresh-design-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'fresh independent fixture reviewer',
    sessionId: 'fresh-design-reviewer', verdict: 'pass', findingsHash: hash(name), timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    changeId, specHash: design.specHash, planHash: design.planHash, designHash: design.designHash, producerSession: design.producerSession, ...overrides,
  });
}

async function approveAndDesign(root: string, changeId: string, expiresAt: string): Promise<Record<string, any>> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'plan.json'), 0, 'ROUTED_STANDARD');
  for (const state of ['discovery', 'spec-review']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
  const approvalContext = cli(root, 'status', '--change', changeId).envelope.state!.approvalContext;
  expectExit(cli(root, 'approve', '--change', changeId, '--receipt', await receipt(root, `approval-${randomUUID()}.json`, { receiptId: `approval-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'fixture authority', decision: 'grant', grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-approval', ...approvalContext })), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'design-producer'), 0, 'TRANSITIONED');
  const design = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', await receipt(root, `design-${randomUUID()}.json`, { receiptId: `design-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'independent fixture reviewer', sessionId: 'design-reviewer', verdict: 'pass', findingsHash: hash('none'), timestamp: new Date().toISOString(), expiresAt, changeId, specHash: design.specHash, planHash: design.planHash, designHash: design.designHash, producerSession: design.producerSession })), 0, 'TRANSITIONED');
  for (const state of ['task-ready', 'executing']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
  return design;
}

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

// Mutant caught: accepting an expired pre-Gate run without fencing its exact old Run,
// or replacing it before validating its dirty allowed-path source.
test('public claim supersedes only the explicit expired pre-Gate Run while retaining allowed dirty source', async () => {
  const root = await fixture(); const changeId = 'expired-pre-gate';
  await approveAndDesign(root, changeId, new Date(Date.now() + 60_000).toISOString());
  const old = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'old-producer', '--ttl', '1'); expectExit(old, 0, 'CLAIMED');
  const oldRun = old.envelope.state!.run.runId as string;
  await writeFile(join(root, 'src/app.ts'), 'export const version = 2;\n');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  const superseded = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', oldRun, '--session', 'fresh-producer');
  expectExit(superseded, 0, 'CLAIMED');
  expect(await readFile(join(root, 'src/app.ts'), 'utf8')).toBe('export const version = 2;\n');
  expect(superseded.envelope.state).toMatchObject({ runs: { [oldRun]: { state: 'abandoned' } }, attempts: { implementation: { consumed: 0 } } });
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'implementation', '--run', oldRun), 5, 'CONFLICT');
}, 30_000);

// Mutant caught: treating a fresh receipt as an edit to expired evidence, or consuming
// it before ordinary claim admission succeeds.
test('public claim atomically ingests a fresh same-binding independent design receipt after expiry', async () => {
  const root = await fixture(); const changeId = 'fresh-design-on-claim';
  const design = await approveAndDesign(root, changeId, new Date(Date.now() + 10_000).toISOString());
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 10_050));
  expectExit(cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'ordinary-producer'), 5, 'CONFLICT');
  const fresh = await receipt(root, 'fresh-design-receipt.json', { receiptId: `fresh-design-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'new independent reviewer', sessionId: 'fresh-design-reviewer', verdict: 'pass', findingsHash: hash('fresh review'), timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId, specHash: design.specHash, planHash: design.planHash, designHash: design.designHash, producerSession: design.producerSession });
  const claimed = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'fresh-producer', '--design-review-receipt', fresh);
  expectExit(claimed, 0, 'CLAIMED');
  expect(await readFile(join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`), 'utf8')).toContain('fresh-design-');
}, 30_000);

// Mutant caught: repairing a prepared continuation after its captured source has
// drifted, or failing to make the valid prepared batch resumable through public CLI.
test('public resume repairs a prepared continuation only while its captured source remains exact', async () => {
  const root = await fixture(); const changeId = 'continuation-recovery';
  await approveAndDesign(root, changeId, new Date(Date.now() + 60_000).toISOString());
  const old = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'old-producer', '--ttl', '1'); expectExit(old, 0, 'CLAIMED');
  await writeFile(join(root, 'src/app.ts'), 'export const version = 2;\n'); await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  await expect(new Controller().execute('claim', { repo: root, change: changeId, task: 'implementation', supersede: old.envelope.state!.run.runId, session: 'fresh-producer', faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
  expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
  expect(cli(root, 'status', '--change', changeId).envelope.state).toMatchObject({ tasks: { implementation: { state: 'implementing' } }, attempts: { implementation: { consumed: 0 } } });

  const driftingRoot = await fixture(); const driftingChange = 'continuation-source-drift';
  await approveAndDesign(driftingRoot, driftingChange, new Date(Date.now() + 60_000).toISOString());
  const driftingOld = cli(driftingRoot, 'claim', '--change', driftingChange, '--task', 'implementation', '--session', 'old-producer', '--ttl', '1'); expectExit(driftingOld, 0, 'CLAIMED');
  await writeFile(join(driftingRoot, 'src/app.ts'), 'export const version = 2;\n'); await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  await expect(new Controller().execute('claim', { repo: driftingRoot, change: driftingChange, task: 'implementation', supersede: driftingOld.envelope.state!.run.runId, session: 'fresh-producer', faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
  const journal = join(driftingRoot, `.leo-dev/runtime/${driftingChange}/journal.ndjson`); const before = await readFile(journal, 'utf8');
  await writeFile(join(driftingRoot, 'src/app.ts'), 'export const version = 3;\n');
  expectExit(cli(driftingRoot, 'resume', '--change', driftingChange), 7, 'BLOCKED');
  expect(await readFile(journal, 'utf8')).toBe(before);
}, 60_000);

test('public continuation dry-run and admission refusals never write source, journal, snapshot, or fresh receipt', async () => {
  const root = await fixture(); const changeId = 'continuation-dry-run-fences';
  const design = await approveAndDesign(root, changeId, new Date(Date.now() + 60_000).toISOString());
  const old = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'old-producer', '--ttl', '80'); expectExit(old, 0, 'CLAIMED');
  const oldRun = old.envelope.state!.run.runId as string;
  await writeFile(join(root, 'src/app.ts'), 'export const version = 2;\n');
  const fresh = await freshDesignReceipt(root, changeId, design, 'dry-run-fresh.json');
  const paths = runtimePaths(root, changeId);
  const before = { source: await readFile(join(root, 'src/app.ts'), 'utf8'), journal: await readFile(paths.journal, 'utf8'), snapshot: await readFile(paths.snapshot, 'utf8'), receipt: await readFile(fresh, 'utf8') };
  await waitUntilExpired(old.envelope.state!.run.lease.expiresAt as string);
  expectExit(cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', oldRun, '--session', 'fresh-producer', '--design-review-receipt', fresh, '--dry-run'), 0, 'DRY_RUN');
  expect(await readFile(join(root, 'src/app.ts'), 'utf8')).toBe(before.source); expect(await readFile(paths.journal, 'utf8')).toBe(before.journal); expect(await readFile(paths.snapshot, 'utf8')).toBe(before.snapshot); expect(await readFile(fresh, 'utf8')).toBe(before.receipt);
  await unchangedAfterRefusal(root, changeId, () => cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'fresh-producer'));
  await unchangedAfterRefusal(root, changeId, () => cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', 'run-wrong', '--session', 'fresh-producer'));
  await unchangedAfterRefusal(root, changeId, () => cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', oldRun, '--session', 'old-producer'));
  await unchangedAfterRefusal(root, changeId, () => cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', oldRun));

  const protectedRoot = await fixture(); const protectedChange = 'continuation-protected-drift';
  await approveAndDesign(protectedRoot, protectedChange, new Date(Date.now() + 60_000).toISOString());
  const protectedOld = cli(protectedRoot, 'claim', '--change', protectedChange, '--task', 'implementation', '--session', 'old-producer', '--ttl', '80'); expectExit(protectedOld, 0, 'CLAIMED');
  await writeFile(join(protectedRoot, 'spec.md'), '# protected drift\n'); await waitUntilExpired(protectedOld.envelope.state!.run.lease.expiresAt as string);
  await unchangedAfterRefusal(protectedRoot, protectedChange, () => cli(protectedRoot, 'claim', '--change', protectedChange, '--task', 'implementation', '--supersede', protectedOld.envelope.state!.run.runId, '--session', 'fresh-producer'));

  const outcomeRoot = await fixture(); const outcomeChange = 'continuation-outcome-fence';
  await approveAndDesign(outcomeRoot, outcomeChange, new Date(Date.now() + 60_000).toISOString());
  const outcomeOld = cli(outcomeRoot, 'claim', '--change', outcomeChange, '--task', 'implementation', '--session', 'old-producer', '--ttl', '1000'); expectExit(outcomeOld, 0, 'CLAIMED');
  expectExit(cli(outcomeRoot, 'run-gates', '--change', outcomeChange, '--task', 'implementation', '--run', outcomeOld.envelope.state!.run.runId), 0, 'GATES_PASSED');
  await waitUntilExpired(outcomeOld.envelope.state!.run.lease.expiresAt as string);
  await unchangedAfterRefusal(outcomeRoot, outcomeChange, () => cli(outcomeRoot, 'claim', '--change', outcomeChange, '--task', 'implementation', '--supersede', outcomeOld.envelope.state!.run.runId, '--session', 'fresh-producer'));
}, 60_000);

test('fresh design receipts are independent, current, unconsumed claim inputs and successful continuation preserves their bytes', async () => {
  const root = await fixture(); const changeId = 'continuation-fresh-receipt-fences';
  const originalExpiry = new Date(Date.now() + 15_000).toISOString();
  const design = await approveAndDesign(root, changeId, originalExpiry);
  await waitUntilExpired(originalExpiry);
  const dryReceipt = await freshDesignReceipt(root, changeId, design, 'ordinary-dry-run.json');
  const dryPaths = runtimePaths(root, changeId); const dryJournal = await readFile(dryPaths.journal, 'utf8'); const drySnapshot = await readFile(dryPaths.snapshot, 'utf8'); const dryBytes = await readFile(dryReceipt, 'utf8');
  expectExit(cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'ordinary-producer', '--design-review-receipt', dryReceipt, '--dry-run'), 0, 'DRY_RUN');
  expect(await readFile(dryPaths.journal, 'utf8')).toBe(dryJournal); expect(await readFile(dryPaths.snapshot, 'utf8')).toBe(drySnapshot); expect(await readFile(dryReceipt, 'utf8')).toBe(dryBytes);
  const self = await freshDesignReceipt(root, changeId, design, 'self.json', { sessionId: design.producerSession });
  const stale = await freshDesignReceipt(root, changeId, design, 'stale.json', { expiresAt: new Date(Date.now() - 1_000).toISOString() });
  const wrong = await freshDesignReceipt(root, changeId, design, 'wrong.json', { designHash: hash('wrong') });
  for (const input of [self, stale, wrong]) await unchangedAfterRefusal(root, changeId, () => cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'ordinary-producer', '--design-review-receipt', input));
  const fresh = await freshDesignReceipt(root, changeId, design, 'success.json'); const sourceBefore = await readFile(fresh, 'utf8');
  const claimed = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'ordinary-producer', '--design-review-receipt', fresh); expectExit(claimed, 0, 'CLAIMED');
  expect(await readFile(fresh, 'utf8')).toBe(sourceBefore);
  expect(await readFile(runtimePaths(root, changeId).journal, 'utf8')).toContain(JSON.parse(sourceBefore).receiptId);
  await unchangedAfterRefusal(root, changeId, () => cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'another-producer', '--design-review-receipt', fresh));
}, 60_000);

test('continuation retains consumed failures and fresh-debug requires a session distinct from every earlier claim', async () => {
  const root = await fixture(); const changeId = 'continuation-fresh-debug-history';
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{ id: 'pass', argv: [process.execPath, '-e', 'process.exit(1)'], cwd: '.', timeoutSeconds: 10, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }] }));
  await approveAndDesign(root, changeId, new Date(Date.now() + 60_000).toISOString());
  for (const session of ['producer-one', 'producer-two', 'producer-three']) {
    const claim = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', session); expectExit(claim, 0, 'CLAIMED');
    expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'implementation', '--run', claim.envelope.state!.run.runId), 4, 'GATE_FAILED');
  }
  expect(cli(root, 'status', '--change', changeId).envelope.state).toMatchObject({ attempts: { implementation: { consumed: 3, nextKind: 'fresh-debug' } } });
  const debug = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'fresh-debugger', '--ttl', '80'); expectExit(debug, 0, 'CLAIMED');
  await waitUntilExpired(debug.envelope.state!.run.lease.expiresAt as string);
  const paths = runtimePaths(root, changeId); const beforeJournal = await readFile(paths.journal, 'utf8'); const beforeSnapshot = await readFile(paths.snapshot, 'utf8');
  const replayedEarlierProducer = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', debug.envelope.state!.run.runId, '--session', 'producer-one');
  expectExit(replayedEarlierProducer, 5, 'CONFLICT');
  expect(await readFile(paths.journal, 'utf8')).toBe(beforeJournal); expect(await readFile(paths.snapshot, 'utf8')).toBe(beforeSnapshot);
  const freshContinuation = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', debug.envelope.state!.run.runId, '--session', 'brand-new-debugger');
  expectExit(freshContinuation, 0, 'CLAIMED');
  expect(freshContinuation.envelope.state).toMatchObject({ attempts: { implementation: { consumed: 3, nextKind: 'fresh-debug' } }, run: { attemptKind: 'fresh-debug', sessionId: 'brand-new-debugger' } });
}, 60_000);

test('unexpired and out-of-allowed-path continuation admissions refuse without writing', async () => {
  const unexpiredRoot = await fixture(); const unexpiredChange = 'continuation-unexpired';
  await approveAndDesign(unexpiredRoot, unexpiredChange, new Date(Date.now() + 60_000).toISOString());
  const unexpired = cli(unexpiredRoot, 'claim', '--change', unexpiredChange, '--task', 'implementation', '--session', 'old-producer', '--ttl', '5000'); expectExit(unexpired, 0, 'CLAIMED');
  await unchangedAfterRefusal(unexpiredRoot, unexpiredChange, () => cli(unexpiredRoot, 'claim', '--change', unexpiredChange, '--task', 'implementation', '--supersede', unexpired.envelope.state!.run.runId, '--session', 'fresh-producer'));

  const outsideRoot = await fixture(); const outsideChange = 'continuation-outside-path';
  await approveAndDesign(outsideRoot, outsideChange, new Date(Date.now() + 60_000).toISOString());
  const outside = cli(outsideRoot, 'claim', '--change', outsideChange, '--task', 'implementation', '--session', 'old-producer', '--ttl', '100'); expectExit(outside, 0, 'CLAIMED');
  await writeFile(join(outsideRoot, 'outside.ts'), 'export const outside = true;\n'); await waitUntilExpired(outside.envelope.state!.run.lease.expiresAt as string);
  await unchangedAfterRefusal(outsideRoot, outsideChange, () => cli(outsideRoot, 'claim', '--change', outsideChange, '--task', 'implementation', '--supersede', outside.envelope.state!.run.runId, '--session', 'fresh-producer'));
}, 40_000);

test('two real concurrent supersede CLIs elect one replacement and the winner completes through public Gate, submit, and review', async () => {
  const root = await fixture(); const changeId = 'continuation-concurrent';
  await approveAndDesign(root, changeId, new Date(Date.now() + 60_000).toISOString());
  const old = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'old-producer', '--ttl', '100'); expectExit(old, 0, 'CLAIMED');
  const oldRun = old.envelope.state!.run.runId as string; await writeFile(join(root, 'src/app.ts'), 'export const version = 2;\n'); await waitUntilExpired(old.envelope.state!.run.lease.expiresAt as string);
  const [first, second] = await Promise.all([
    cliAsync(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', oldRun, '--session', 'fresh-one'),
    cliAsync(root, 'claim', '--change', changeId, '--task', 'implementation', '--supersede', oldRun, '--session', 'fresh-two'),
  ]);
  const winner = [first, second].filter((outcome) => outcome.status === 0); expect(winner).toHaveLength(1);
  expect([first, second].filter((outcome) => outcome.status !== 0).every((outcome) => outcome.envelope.code === 'CONFLICT')).toBe(true);
  const claimed = winner[0]!.envelope.state!; const newRun = claimed.run.runId as string;
  expect(claimed).toMatchObject({ runs: { [oldRun]: { state: 'abandoned' } }, attempts: { implementation: { consumed: 0 } } });
  expect(await readFile(join(root, 'src/app.ts'), 'utf8')).toBe('export const version = 2;\n');
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'implementation', '--run', newRun), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', changeId, '--task', 'implementation'), 0, 'SUBMITTED_FOR_REVIEW');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.reviewContext;
  const review = await runtimeReceipt(root, changeId, 'concurrent-review.json', { ...context, receiptId: `concurrent-review-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'independent fixture reviewer', sessionId: 'independent-reviewer', findingsHash: hash('concurrent-pass'), verdict: 'pass', timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const reviewed = cli(root, 'review', '--change', changeId, '--task', 'implementation', '--receipt', review); expect(reviewed.status, JSON.stringify(reviewed.envelope)).toBe(0);
  expect(reviewed.envelope.state).toMatchObject({ tasks: { implementation: { state: 'done' } } });
}, 60_000);

test('prepared supersession with a fresh receipt refuses receipt drift and incomplete journal tail before repair', async () => {
  const root = await fixture(); const changeId = 'continuation-pending-receipt-tail';
  const design = await approveAndDesign(root, changeId, new Date(Date.now() + 60_000).toISOString());
  const old = cli(root, 'claim', '--change', changeId, '--task', 'implementation', '--session', 'old-producer', '--ttl', '100'); expectExit(old, 0, 'CLAIMED');
  await writeFile(join(root, 'src/app.ts'), 'export const version = 2;\n'); await waitUntilExpired(old.envelope.state!.run.lease.expiresAt as string);
  const fresh = await freshDesignReceipt(root, changeId, design, 'pending-fresh.json');
  await expect(new Controller().execute('claim', { repo: root, change: changeId, task: 'implementation', supersede: old.envelope.state!.run.runId, session: 'fresh-producer', designReviewReceipt: fresh, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
  await writeFile(fresh, '{"tampered":true}\n');
  const paths = runtimePaths(root, changeId); await writeFile(paths.journal, '{"incomplete"', { flag: 'a' });
  const beforeJournal = await readFile(paths.journal, 'utf8'); const beforeSnapshot = await readFile(paths.snapshot, 'utf8');
  expectExit(cli(root, 'resume', '--change', changeId), 7, 'BLOCKED');
  expect(await readFile(paths.journal, 'utf8')).toBe(beforeJournal); expect(await readFile(paths.snapshot, 'utf8')).toBe(beforeSnapshot);
}, 60_000);
