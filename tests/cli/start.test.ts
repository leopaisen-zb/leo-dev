import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';

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
