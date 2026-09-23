import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const refusal = 'Do not copy npm run typecheck from another project, and do not record a gate as passed.';

type Envelope = { ok: boolean; code: string; errors: Array<{ message: string }> };
function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
  expect(result.error).toBeUndefined();
  return { status: result.status ?? 9, envelope: JSON.parse(result.stdout.trim()) as Envelope };
}
function gateYaml(id: string): string {
  return [
    'gates:',
    `  - id: ${id}`,
    `    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]`,
    '    cwd: .',
    '    timeoutSeconds: 10',
    '    required: true',
    '    replaySafety: pure',
    '    effectClass: local-verification',
    '    network: deny',
    '    environmentAllowlist: []',
    '    declaredWritePaths: []',
  ].join('\n');
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

async function bare(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `leo-dev-${name}-`));
  temporary.push(root);
  await writeFile(join(root, 'approved.md'), '# fixture\n');
  return root;
}

test('missing default registry stops route and doctor without recording a pass', async () => {
  const root = await bare('missing-gate');
  expect(cli(root, 'init', '--change', 'foreign', '--spec', 'approved.md').status).toBe(0);
  const cases = [
    ['route', '--change', 'foreign', '--task', 'task', '--gate', 'check'],
    ['route', '--change', 'foreign', '--task', 'task', '--gate', 'check', '--dry-run'],
    ['route', '--change', 'foreign', '--task', 'task', '--gate', 'check', '--registry', 'gates/missing.yaml'],
    ['doctor'],
  ];
  for (const args of cases) {
    const result = cli(root, ...args);
    expect(result.status, JSON.stringify(result.envelope)).toBe(8);
    expect(result.envelope.code).toBe('PREREQUISITE_FAILED');
    const message = result.envelope.errors[0]?.message ?? '';
    expect(message).toContain(args.includes('--registry') ? 'gates/missing.yaml' : 'core/gates/default.yaml');
    expect(message).toContain(refusal);
  }
  const journal = await readFile(join(root, '.leo-dev/runtime/foreign/journal.ndjson'), 'utf8');
  expect(journal).not.toContain('route.selected');
  expect(journal).not.toContain('GATES_PASSED');
});

test('an explicit registry in the target repository can route', async () => {
  const root = await bare('own-gate');
  await mkdir(join(root, 'gates'), { recursive: true });
  await writeFile(join(root, 'gates/check.yaml'), gateYaml('check'));
  expect(cli(root, 'init', '--change', 'own-check', '--spec', 'approved.md').status).toBe(0);
  const routed = cli(root, 'route', '--change', 'own-check', '--task', 'task', '--gate', 'check', '--registry', 'gates/check.yaml');
  expect(routed.status, JSON.stringify(routed.envelope)).toBe(0);
  expect(routed.envelope.code).toBe('ROUTED_LITE');
});

test('an existing default registry still routes without --registry', async () => {
  const root = await bare('default-gate');
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), gateYaml('pass'));
  expect(cli(root, 'init', '--change', 'has-default', '--spec', 'approved.md').status).toBe(0);
  const routed = cli(root, 'route', '--change', 'has-default', '--task', 'task', '--gate', 'pass');
  expect(routed.status, JSON.stringify(routed.envelope)).toBe(0);
  expect(routed.envelope.code).toBe('ROUTED_LITE');
});
