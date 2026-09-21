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
function git(root: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5_000, killSignal: 'SIGKILL' });
  if (result.error || result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-commit-fixture-')); temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'approved.md'), '# fixture\n');
  await writeFile(join(root, 'core/gates/default.yaml'), [
    'gates:',
    `  - id: pass\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []`,
  ].join('\n'));
  return root;
}
async function receipt(_root: string, value: object): Promise<string> {
  const path = join(tmpdir(), `leo-dev-commit-receipt-${randomUUID()}.json`);
  temporary.push(path);
  await writeFile(path, JSON.stringify(value));
  return path;
}
async function approve(root: string, change: string): Promise<void> {
  const context = cli(root, 'status', '--change', change).envelope.state.approvalContext;
  const path = await receipt(root, { receiptId: `approve-${change}`, provenance: 'human-confirmed', actorLabel: 'fixture', decision: 'grant', grantedAt: now(), expiresAt: later(), changeId: change, scope: 'change', operationKind: 'spec-approval', ...context });
  expectExit(cli(root, 'approve', '--change', change, '--receipt', path), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
}
async function executingLite(root: string, change: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', change, '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', change, '--task', 'task', '--gate', 'pass'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  await approve(root, change);
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
}
async function passReview(root: string, change: string, task: string, session = 'fixture-review'): Promise<Envelope> {
  const claim = cli(root, 'claim', '--change', change, '--task', task, '--session', `claim-${session}`);
  expectExit(claim, 0, 'CLAIMED');
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', `${task}.ts`), `// ${task} ${session}\n`);
  expectExit(cli(root, 'run-gates', '--change', change, '--task', task, '--run', claim.envelope.state.run.runId), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', change, '--task', task), 0, 'SUBMITTED_FOR_REVIEW');
  const context = cli(root, 'status', '--change', change).envelope.state.reviewContext;
  const path = await receipt(root, {
    receiptId: randomUUID(), provenance: 'platform-attested', actorLabel: 'fixture', sessionId: session,
    runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration,
    specHash: context.specHash, taskHash: context.taskHash, treeHash: context.treeHash, findingsHash: hash('pass'),
    verdict: 'pass', timestamp: now(), expiresAt: later(),
  });
  const reviewed = cli(root, 'review', '--change', change, '--task', task, '--receipt', path);
  expectExit(reviewed, 0, 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED');
  return reviewed.envelope;
}
function prepareGit(root: string): void {
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.name', 'Leo');
  git(root, 'config', 'user.email', 'leo@example.test');
  git(root, 'config', 'commit.gpgsign', 'false');
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('commits locally after an independent pass and never pushes', async () => {
  const root = await fixture();
  const change = 'work';
  await executingLite(root, change);
  await passReview(root, change, 'task');
  prepareGit(root);
  spawnSync('git', ['-c', 'user.name=Leo', '-c', 'user.email=leo@example.test', 'add', '-A'], { cwd: root });
  const committed = cli(root, 'commit', '--change', change, '--message', 'feat: example');
  expectExit(committed, 0, 'COMMITTED');
  expect(committed.envelope.state).toMatchObject({ pushed: false });
  expect(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()).toHaveLength(40);
}, 60_000);

test('refuses commit when independent review is missing', async () => {
  const root = await fixture();
  expectExit(cli(root, 'init', '--change', 'work', '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'commit', '--change', 'work', '--message', 'feat: x'), 7, 'BLOCKED');
});

test('source does not spawn git push', async () => {
  const source = await readFile(join(repository, 'packages/cli/src/controller/controller.ts'), 'utf8');
  expect(source).not.toMatch(/git\s+push/);
  const command = await readFile(join(repository, 'packages/cli/src/commands/commit.ts'), 'utf8');
  expect(command).not.toMatch(/push/);
});

test('refuses commit when nothing is staged', async () => {
  const root = await fixture();
  const change = 'unstaged';
  await executingLite(root, change);
  await passReview(root, change, 'task');
  prepareGit(root);
  const blocked = cli(root, 'commit', '--change', change, '--message', 'feat: example');
  expectExit(blocked, 7, 'BLOCKED');
  expect(blocked.envelope.errors[0]?.message).toContain('nothing staged');
}, 60_000);

test('refuses commit when product files change after the independent pass', async () => {
  const root = await fixture();
  const change = 'drift';
  await executingLite(root, change);
  await passReview(root, change, 'task');
  await writeFile(join(root, 'src/task.ts'), '// edited after independent pass\n');
  prepareGit(root);
  git(root, 'add', '-A');
  const blocked = cli(root, 'commit', '--change', change, '--message', 'feat: example');
  expectExit(blocked, 7, 'BLOCKED');
  expect(blocked.envelope.errors[0]?.message).toContain('independent review pass bound to the current tree');
}, 60_000);
