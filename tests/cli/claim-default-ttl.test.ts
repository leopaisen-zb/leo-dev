import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];

type Envelope = { ok: boolean; code: string };
function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
  expect(result.error).toBeUndefined();
  return { status: result.status ?? 9, envelope: JSON.parse(result.stdout.trim()) as Envelope };
}
function expectExit(result: ReturnType<typeof cli>, status: number, code: string): void {
  expect(result.status, JSON.stringify(result.envelope)).toBe(status);
  expect(result.envelope.code).toBe(code);
}
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-claim-ttl-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'approved.md'), '# fixture\n');
  await writeFile(join(root, 'core/gates/default.yaml'), [
    'gates:',
    `  - id: pass\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []`,
  ].join('\n'));
  return root;
}
async function executing(root: string, change: string): Promise<void> {
  expectExit(cli(root, 'init', '--change', change, '--spec', 'approved.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', change, '--task', 'task', '--gate', 'pass'), 0, 'ROUTED_LITE');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'start', '--change', change, '--goal', 'check the default claim lease'), 0, 'START_AUTHORIZED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', change, '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
}
async function claimedExpiry(root: string, change: string): Promise<number> {
  const journal = await readFile(join(root, '.leo-dev/runtime', change, 'journal.ndjson'), 'utf8');
  for (const line of journal.trim().split('\n').reverse()) {
    const event = JSON.parse(line) as { type: string; payload?: { kind?: string; operations?: Array<{ type: string; payload?: { lease?: { expiresAt?: string } } }> } };
    if (event.type !== 'controller.batch.prepared' || event.payload?.kind !== 'claim') continue;
    const lease = event.payload.operations?.find((operation) => operation.type === 'lease.claimed')?.payload?.lease;
    if (!lease?.expiresAt) throw new Error('claim batch has no lease expiry');
    return Date.parse(lease.expiresAt);
  }
  throw new Error('no claim batch');
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('claim without --ttl lasts one hour', async () => {
  const root = await fixture();
  await executing(root, 'default-ttl');
  const before = Date.now();
  expectExit(cli(root, 'claim', '--change', 'default-ttl', '--task', 'task', '--session', 'producer'), 0, 'CLAIMED');
  const after = Date.now();
  const expiresAt = await claimedExpiry(root, 'default-ttl');
  expect(expiresAt).toBeGreaterThanOrEqual(before + 3_600_000 - 5_000);
  expect(expiresAt).toBeLessThanOrEqual(after + 3_600_000 + 5_000);
}, 30_000);

test('claim --ttl still overrides the default', async () => {
  const root = await fixture();
  await executing(root, 'override-ttl');
  const before = Date.now();
  expectExit(cli(root, 'claim', '--change', 'override-ttl', '--task', 'task', '--session', 'producer', '--ttl', '60000'), 0, 'CLAIMED');
  const after = Date.now();
  const expiresAt = await claimedExpiry(root, 'override-ttl');
  expect(expiresAt).toBeGreaterThanOrEqual(before + 60_000 - 5_000);
  expect(expiresAt).toBeLessThanOrEqual(after + 60_000 + 5_000);
}, 30_000);
