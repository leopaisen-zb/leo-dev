import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { afterEach, expect, test } from 'vitest';
import { Controller } from '../../packages/cli/src/controller/controller.js';
import { Journal } from '../../packages/cli/src/state/journal.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

type Envelope = { ok: boolean; code: string; state: Record<string, any> | null; errors: Array<{ code: string; message: string }> };

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
  expect(result.error, result.error?.message).toBeUndefined();
  const lines = result.stdout.trim().split('\n').filter(Boolean); expect(lines, `stderr=${result.stderr}`).toHaveLength(1);
  return { status: result.status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope };
}

function expectExit(actual: ReturnType<typeof cli>, status: number, code: string): void {
  expect(actual.status, JSON.stringify(actual.envelope)).toBe(status); expect(actual.envelope.code).toBe(code);
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-claim-continuation-integrity-')); temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true }); await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{ id: 'pass', argv: [process.execPath, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 10, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }] }));
  await writeFile(join(root, 'spec.md'), '# Integrity fixture\n'); await writeFile(join(root, 'design.md'), '# Design\n'); await writeFile(join(root, 'src/app.ts'), 'export const value = 1;\n');
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'implementation', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['passes'], gateIds: ['pass'], risk: 'standard' }] }));
  return root;
}

async function runtimeReceipt(root: string, changeId: string, name: string, value: unknown): Promise<string> {
  const directory = join(root, '.leo-dev', 'runtime', changeId, 'receipts'); await mkdir(directory, { recursive: true });
  const path = join(directory, name); await writeFile(path, JSON.stringify(value)); return path;
}

async function activate(root: string, changeId: string): Promise<Record<string, any>> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED'); expectExit(cli(root, 'route', '--change', changeId, '--plan', 'plan.json'), 0, 'ROUTED_STANDARD');
  for (const to of ['discovery', 'spec-review']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', to), 0, 'TRANSITIONED');
  const approval = cli(root, 'status', '--change', changeId).envelope.state!.approvalContext;
  const approvalPath = await runtimeReceipt(root, changeId, 'approval.json', { receiptId: `approval-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'fixture authority', decision: 'grant', grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId, scope: 'change', operationKind: 'spec-approval', ...approval });
  expectExit(cli(root, 'approve', '--change', changeId, '--receipt', approvalPath), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED'); expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'design-producer'), 0, 'TRANSITIONED');
  const design = cli(root, 'status', '--change', changeId).envelope.state!.designReviewContext;
  const designReceipt = await runtimeReceipt(root, changeId, 'design-approved.json', { receiptId: `design-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'fixture reviewer', sessionId: 'design-reviewer', verdict: 'pass', findingsHash: hash('design'), timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), changeId, specHash: design.specHash, planHash: design.planHash, designHash: design.designHash, producerSession: design.producerSession });
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'design-approved', '--receipt', designReceipt), 0, 'TRANSITIONED');
  for (const to of ['task-ready', 'executing']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', to), 0, 'TRANSITIONED');
  return design;
}

async function freshReceipt(root: string, changeId: string, design: Record<string, any>, name: string, expiresAt = new Date(Date.now() + 60_000).toISOString()): Promise<string> {
  return runtimeReceipt(root, changeId, name, { receiptId: `fresh-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'fresh fixture reviewer', sessionId: `fresh-reviewer-${randomUUID()}`, verdict: 'pass', findingsHash: hash(name), timestamp: new Date().toISOString(), expiresAt, changeId, specHash: design.specHash, planHash: design.planHash, designHash: design.designHash, producerSession: design.producerSession });
}

function paths(root: string, changeId: string): { journal: string; snapshot: string } {
  const runtime = join(root, '.leo-dev', 'runtime', changeId); return { journal: join(runtime, 'journal.ndjson'), snapshot: join(runtime, 'snapshot.json') };
}

async function waitUntilExpired(expiresAt: string): Promise<void> {
  const deadline = Date.parse(expiresAt) + 30;
  while (Date.now() <= deadline) await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(25, Math.max(1, deadline - Date.now() + 1))));
}

async function prepareOrdinaryFreshClaim(root: string, changeId: string, design: Record<string, any>, receiptName: string, expiresAt?: string): Promise<string> {
  const receipt = await freshReceipt(root, changeId, design, receiptName, expiresAt);
  await expect(new Controller().execute('claim', { repo: root, change: changeId, task: 'implementation', session: 'fresh-producer', designReviewReceipt: receipt, faultAt: 'after-batch-prepared' })).rejects.toThrow('Simulated crash');
  return receipt;
}

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('ordinary fresh-review prepared recovery refuses receipt and design drift with an incomplete tail without repairing bytes', async () => {
  for (const kind of ['receipt', 'design'] as const) {
    const root = await fixture(); const changeId = `ordinary-fresh-${kind}-drift`; const design = await activate(root, changeId);
    const receipt = await prepareOrdinaryFreshClaim(root, changeId, design, `${kind}.json`); const runtime = paths(root, changeId);
    if (kind === 'receipt') await writeFile(receipt, '{"tampered":true}\n'); else await writeFile(join(root, 'design.md'), '# changed design\n');
    await writeFile(runtime.journal, '{"incomplete"', { flag: 'a' });
    const beforeJournal = await readFile(runtime.journal, 'utf8'); const beforeSnapshot = await readFile(runtime.snapshot, 'utf8');
    expectExit(cli(root, 'resume', '--change', changeId), 7, 'BLOCKED');
    expect(await readFile(runtime.journal, 'utf8')).toBe(beforeJournal); expect(await readFile(runtime.snapshot, 'utf8')).toBe(beforeSnapshot);
  }
}, 60_000);

test('claim receipt that expires after planning but before batch preparation records no journal write', async () => {
  const root = await fixture(); const changeId = 'ordinary-receipt-preparation-expiry'; const design = await activate(root, changeId);
  const expiresAt = new Date(Date.now() + 800).toISOString(); const receipt = await freshReceipt(root, changeId, design, 'expiring.json', expiresAt); const runtime = paths(root, changeId);
  const beforeJournal = await readFile(runtime.journal, 'utf8');
  const controller = new Controller() as any; const planClaim = controller.planClaim.bind(controller);
  controller.planClaim = async (...args: unknown[]) => { const plan = await planClaim(...args); await waitUntilExpired(expiresAt); return plan; };
  await expect(controller.execute('claim', { repo: root, change: changeId, task: 'implementation', session: 'fresh-producer', designReviewReceipt: receipt })).rejects.toMatchObject({ exitCode: 5, publicCode: 'CONFLICT' });
  expect(await readFile(runtime.journal, 'utf8')).toBe(beforeJournal);
}, 40_000);

// Mutant caught: recovery rechecks the receipt against its wall clock instead of
// the immutable preparedAt value, stranding a valid historical claim batch.
test('prepared fresh-claim recovery accepts a receipt that expired after durable preparation', async () => {
  const root = await fixture(); const changeId = 'ordinary-historical-receipt'; const design = await activate(root, changeId);
  const expiresAt = new Date(Date.now() + 150).toISOString();
  await prepareOrdinaryFreshClaim(root, changeId, design, 'historical-expired.json', expiresAt);
  await waitUntilExpired(expiresAt);
  expectExit(cli(root, 'resume', '--change', changeId), 0, 'RESUMED');
}, 40_000);

test('one captured fresh receipt cannot be replaced between readReceipt and its embedded batch binding', async () => {
  const root = await fixture(); const changeId = 'ordinary-fresh-receipt-read-race'; const design = await activate(root, changeId);
  const receipt = await freshReceipt(root, changeId, design, 'read-race.json'); const runtime = paths(root, changeId);
  const beforeJournal = await readFile(runtime.journal, 'utf8'); const beforeSnapshot = await readFile(runtime.snapshot, 'utf8');
  const receiptPath = await realpath(receipt); const controller = new Controller() as any; const readReceipt = controller.readReceipt.bind(controller); let intercepted = false; let readPath: string | undefined;
  controller.readReceipt = async (...args: unknown[]) => {
    const parsed = await readReceipt(...args);
    if (args[0] === 'design-review' && typeof args[1] === 'string' && await realpath(args[1]) === receiptPath) {
      intercepted = true;
      readPath = await realpath(args[1]);
      await writeFile(receipt, JSON.stringify({ ...JSON.parse(await readFile(receipt, 'utf8')), verdict: 'reject' }));
    }
    return parsed;
  };
  const outcome: { error?: unknown; value?: unknown } = await controller.execute('claim', { repo: root, change: changeId, task: 'implementation', session: 'fresh-producer', designReviewReceipt: receipt }).then((value: unknown) => ({ value }), (error: unknown) => ({ error }));
  expect(intercepted).toBe(true); expect(readPath).toBe(receiptPath); expect(JSON.parse(await readFile(receipt, 'utf8')).verdict).toBe('reject');
  expect(outcome.error).toMatchObject({ exitCode: 7, publicCode: 'BLOCKED' });
  expect(await readFile(runtime.journal, 'utf8')).toBe(beforeJournal); expect(await readFile(runtime.snapshot, 'utf8')).toBe(beforeSnapshot);
}, 40_000);

test('a direct unbatched continuation guard is structurally blocked without journal repair', async () => {
  const root = await fixture(); const changeId = 'direct-unbatched-guard'; await activate(root, changeId);
  const runtime = paths(root, changeId); await new Journal(runtime.journal).append({ changeId, taskId: 'implementation', taskRevision: 1, leaseGeneration: 1, type: 'task.continuation.recovered', payload: {} });
  const beforeJournal = await readFile(runtime.journal, 'utf8'); expectExit(cli(root, 'status', '--change', changeId), 7, 'BLOCKED'); expect(await readFile(runtime.journal, 'utf8')).toBe(beforeJournal);
}, 30_000);
