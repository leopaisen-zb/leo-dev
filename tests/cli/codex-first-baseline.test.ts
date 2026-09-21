import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'vitest';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const fixtureIntegrity = new Map<string, { unrelated: Buffer; head: Buffer; index?: Buffer; unrelatedStatus: string }>();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const issuedAt = new Date(Date.now() - 60_000).toISOString();
const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();

interface Envelope {
  ok: boolean;
  code: string;
  state: unknown;
  errors: Array<{ code: string; message: string }>;
  evidenceRefs: string[];
}

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], {
    cwd: repository,
    encoding: 'utf8',
    timeout: 15_000,
    killSignal: 'SIGKILL',
  });
  expect(result.error, `CLI timed out or could not start: ${result.error?.message ?? 'unknown error'}`).toBeUndefined();
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  expect(lines, `stdout=${result.stdout}\nstderr=${result.stderr}`).toHaveLength(1);
  expect(result.stderr).toBe('');
  const envelope = JSON.parse(lines[0]!) as Envelope;
  expect(Object.keys(envelope).sort()).toEqual(['code', 'errors', 'evidenceRefs', 'ok', 'state']);
  return { status: result.status ?? 9, envelope };
}

function expectExit(result: ReturnType<typeof cli>, status: number, code: string): void {
  expect(result.status, JSON.stringify(result.envelope)).toBe(status);
  expect(result.envelope.ok).toBe(status === 0);
  expect(result.envelope.code).toBe(code);
}

function git(root: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5_000, killSignal: 'SIGKILL' });
  if (result.error || result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}

async function assertFixturePreserved(root: string): Promise<void> {
  const before = fixtureIntegrity.get(root);
  if (!before) throw new Error(`Missing integrity snapshot for ${root}`);
  expect(await readFile(join(root, 'notes', 'unrelated.txt'))).toEqual(before.unrelated);
  expect(await readFile(join(root, '.git', 'HEAD'))).toEqual(before.head);
  expect(await readFile(join(root, '.git', 'index')).catch(() => undefined)).toEqual(before.index);
  expect(git(root, 'status', '--porcelain=v1', '--untracked-files=all', '--', 'notes/unrelated.txt')).toBe(before.unrelatedStatus);
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-codex-first-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), [
    'gates:',
    '  - id: pass',
    `    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]`,
    '    cwd: .',
    '    timeoutSeconds: 10',
    '    required: true',
    '    replaySafety: pure',
    '    effectClass: local-verification',
    '    network: deny',
    '    environmentAllowlist: []',
    '    declaredWritePaths: []',
    '',
  ].join('\n'));
  await writeFile(join(root, 'approved-spec.md'), '# Approved fixture specification\n');
  await mkdir(join(root, 'notes'), { recursive: true });
  await writeFile(join(root, 'notes', 'unrelated.txt'), 'pre-existing unrelated fixture content\n');
  git(root, 'init', '--quiet');
  fixtureIntegrity.set(root, {
    unrelated: await readFile(join(root, 'notes', 'unrelated.txt')),
    head: await readFile(join(root, '.git', 'HEAD')),
    index: await readFile(join(root, '.git', 'index')).catch(() => undefined),
    unrelatedStatus: git(root, 'status', '--porcelain=v1', '--untracked-files=all', '--', 'notes/unrelated.txt'),
  });
  return root;
}

async function receiptFile(value: unknown): Promise<string> {
  const path = join(tmpdir(), `leo-dev-codex-first-receipt-${randomUUID()}.json`);
  temporary.push(path);
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function approveSpec(root: string, changeId: string): Promise<void> {
  const status = cli(root, 'status', '--change', changeId);
  const context = (status.envelope.state as { approvalContext: Record<string, string> }).approvalContext;
  const receipt = await receiptFile({
    receiptId: `approval-${changeId}`,
    provenance: 'human-confirmed',
    actorLabel: 'fixture approval record',
    decision: 'grant',
    grantedAt: issuedAt,
    expiresAt,
    changeId,
    scope: 'change',
    operationKind: 'spec-approval',
    ...context,
  });
  expectExit(cli(root, 'approve', '--change', changeId, '--receipt', receipt), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
}

async function advanceToExecuting(root: string, changeId: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--task', 'task-a', '--gate', 'pass'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  await approveSpec(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
}

async function advanceToReview(root: string, changeId: string): Promise<Record<string, unknown>> {
  await advanceToExecuting(root, changeId);
  expectExit(cli(root, 'claim', '--change', changeId, '--task', 'task-a'), 0, 'CLAIMED');
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'task-a'), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', changeId, '--task', 'task-a'), 0, 'SUBMITTED_FOR_REVIEW');
  return (cli(root, 'status', '--change', changeId).envelope.state as { reviewContext: Record<string, unknown> }).reviewContext;
}

afterEach(async () => {
  for (const path of temporary) fixtureIntegrity.delete(path);
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('Codex-first C2 acceptance regressions', () => {
  // Mutant caught: rebinding Gate input to the original Lease input rejects a legitimate, identified candidate.
  test('accepts an allowed implementation candidate written after claim when explicitly bound to its Run', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'tree-gap');
    const claimed = cli(root, 'claim', '--change', 'tree-gap', '--task', 'task-a');
    expectExit(claimed, 0, 'CLAIMED');
    const runId = (claimed.envelope.state as { run: { runId: string } }).run.runId;
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'implementation.ts'), 'export const implemented = true;\n');

    const gated = cli(root, 'run-gates', '--change', 'tree-gap', '--task', 'task-a', '--run', runId);

    expectExit(gated, 0, 'GATES_PASSED');
    expect(gated.envelope.state).toMatchObject({ changeState: 'executing', tasks: { 'task-a': { state: 'verifying' } } });
    await assertFixturePreserved(root);
  }, 20_000);

  // Mutant caught: accepting changed output without Run identity lets a task-only caller bind a later worker's candidate.
  test('refuses a changed candidate without an explicit Run binding', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'missing-run');
    expectExit(cli(root, 'claim', '--change', 'missing-run', '--task', 'task-a'), 0, 'CLAIMED');
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'implementation.ts'), 'export const implementation = 1;\n');

    const refused = cli(root, 'run-gates', '--change', 'missing-run', '--task', 'task-a');

    expectExit(refused, 5, 'CONFLICT');
    expect(refused.envelope.errors[0]?.message).toContain('explicit matching --run');
    await assertFixturePreserved(root);
  }, 20_000);

  // Mutant caught: ignoring a supplied Run ID permits a stale caller to rebind a different worker's output.
  test('refuses a changed candidate whose supplied Run does not match the active claim', async () => {
    const root = await fixture();
    await advanceToExecuting(root, 'stale-run');
    expectExit(cli(root, 'claim', '--change', 'stale-run', '--task', 'task-a'), 0, 'CLAIMED');
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'implementation.ts'), 'export const implementation = 2;\n');

    const refused = cli(root, 'run-gates', '--change', 'stale-run', '--task', 'task-a', '--run', 'run-stale');

    expectExit(refused, 5, 'CONFLICT');
    expect(refused.envelope.errors[0]?.message).toContain('does not match the active claimed Run');
    await assertFixturePreserved(root);
  }, 20_000);

  // Mutant caught: treating a candidate-bound rejection as stale prevents the bounded remediation path.
  test('records a valid candidate-bound review rejection as remediation instead of completion', async () => {
    const root = await fixture();
    const context = await advanceToReview(root, 'review-gap');
    const receipt = await receiptFile({
      receiptId: 'candidate-bound-rejection',
      provenance: 'human-confirmed',
      actorLabel: 'fixture reviewer',
      sessionId: 'fixture-review-session',
      runId: context.runId,
      taskId: context.taskId,
      taskRevision: context.taskRevision,
      leaseGeneration: context.leaseGeneration,
      specHash: context.specHash,
      taskHash: context.taskHash,
      treeHash: context.treeHash,
      findingsHash: hash('one reproducible finding'),
      verdict: 'reject',
      timestamp: issuedAt,
      expiresAt,
    });

    const rejected = cli(root, 'review', '--change', 'review-gap', '--task', 'task-a', '--receipt', receipt);

    expectExit(rejected, 0, 'REVIEW_REJECTED');
    expect(cli(root, 'status', '--change', 'review-gap').envelope.state).toMatchObject({
      changeState: 'executing', tasks: { 'task-a': { state: 'remediation' } },
    });
    await assertFixturePreserved(root);
  }, 20_000);

  // Mutant caught: a route that discards dependencies cannot preserve a three-task execution plan.
  test('routes an immutable dependent Lite task plan in one operation', async () => {
    const root = await fixture();
    const changeId = 'route-gap';
    expectExit(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md'), 0, 'INITIALIZED');
    await writeFile(join(root, 'plan.json'), JSON.stringify({
      schemaVersion: 1,
      tasks: [
        { id: 'task-a', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/**'], acceptance: ['A completes'], gateIds: ['pass'], risk: 'lite' },
        { id: 'task-b', revision: 1, state: 'pending', dependsOn: ['task-a'], allowedPaths: ['src/**'], acceptance: ['B completes'], gateIds: ['pass'], risk: 'lite' },
        { id: 'task-c', revision: 1, state: 'pending', dependsOn: ['task-b'], allowedPaths: ['src/**'], acceptance: ['C completes'], gateIds: ['pass'], risk: 'lite' },
      ],
    }));

    const routed = cli(root, 'route', '--change', changeId, '--plan', 'plan.json');

    expectExit(routed, 0, 'ROUTED_LITE');
    expect(routed.envelope.state).toMatchObject({
      tasks: {
        'task-a': { state: 'ready' },
        'task-b': { state: 'pending' },
        'task-c': { state: 'pending' },
      },
    });
    expect(Object.keys((routed.envelope.state as { tasks: Record<string, unknown> }).tasks).sort()).toEqual(['task-a', 'task-b', 'task-c']);
    await assertFixturePreserved(root);
  }, 20_000);
});
