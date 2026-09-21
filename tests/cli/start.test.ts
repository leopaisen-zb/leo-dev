import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';
import YAML from 'yaml';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];

type Envelope = { ok: boolean; code: string; state: any; errors: Array<{ message: string }> };
function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 15_000, killSignal: 'SIGKILL' });
  expect(result.error).toBeUndefined();
  return { status: result.status ?? 9, envelope: JSON.parse(result.stdout.trim()) as Envelope };
}
function expectExit(result: ReturnType<typeof cli>, status: number, code: string): void { expect(result.status, JSON.stringify(result.envelope)).toBe(status); expect(result.envelope.code).toBe(code); }
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-start-fixture-')); temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'approved.md'), '# fixture\n');
  await writeFile(join(root, 'core/gates/default.yaml'), [
    'gates:',
    `  - id: pass\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []`,
  ].join('\n'));
  return root;
}
async function receipt(value: object): Promise<string> {
  const path = join(tmpdir(), `leo-dev-start-receipt-${randomUUID()}.json`);
  temporary.push(path);
  await writeFile(path, JSON.stringify(value));
  return path;
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('start authorizes spec-approved without a spec-approval receipt', async () => {
  const root = await fixture();
  expectExit(cli(root, 'init', '--change', 'work', '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', 'work', '--task', 'task', '--gate', 'pass'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'start', '--change', 'work', '--goal', 'ship the three-column board'), 0, 'START_AUTHORIZED');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
});

test('start without a goal is invalid', async () => {
  const root = await fixture();
  expectExit(cli(root, 'init', '--change', 'work', '--spec', 'approved.md'), 0, 'INITIALIZED');
  expect(cli(root, 'start', '--change', 'work').status).toBe(2);
});

test('start then spec-approved can claim', async () => {
  const root = await fixture();
  expectExit(cli(root, 'init', '--change', 'work', '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', 'work', '--task', 'task', '--gate', 'pass'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'start', '--change', 'work', '--goal', 'ship the three-column board'), 0, 'START_AUTHORIZED');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'claim', '--change', 'work', '--task', 'task', '--session', 'producer'), 0, 'CLAIMED');
  expectExit(cli(root, 'start', '--change', 'work', '--goal', 'too late'), 7, 'BLOCKED');
});

test('reject then start reaches spec-approved without stamping the reject receipt', async () => {
  const root = await fixture();
  expectExit(cli(root, 'init', '--change', 'work', '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', 'work', '--task', 'task', '--gate', 'pass'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  const context = cli(root, 'status', '--change', 'work').envelope.state.approvalContext;
  const rejectId = 'reject-work';
  const path = await receipt({
    receiptId: rejectId,
    provenance: 'human-confirmed',
    actorLabel: 'fixture',
    decision: 'reject',
    grantedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    changeId: 'work',
    scope: 'change',
    operationKind: 'spec-approval',
    ...context,
  });
  expectExit(cli(root, 'approve', '--change', 'work', '--receipt', path), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
  expectExit(cli(root, 'start', '--change', 'work', '--goal', 'ship the three-column board'), 0, 'START_AUTHORIZED');
  expectExit(cli(root, 'transition', '--change', 'work', '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  const artifacts = join(root, '.leo-dev/changes/work');
  const manifest = YAML.parse(await readFile(join(artifacts, 'manifest.yaml'), 'utf8')) as Record<string, unknown>;
  const spec = YAML.parse(await readFile(join(artifacts, 'spec.yaml'), 'utf8')) as Record<string, unknown>;
  expect(manifest.approvalRef).not.toBe(`receipt:${rejectId}`);
  expect(spec.approvalRef).not.toBe(`receipt:${rejectId}`);
});
