import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';
import { Controller } from '../../packages/cli/src/controller/controller.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const owned: string[] = [];
const task = (id: string, dependsOn: string[] = []) => ({ id, revision: 1, state: dependsOn.length ? 'pending' : 'ready', dependsOn, allowedPaths: ['src'], acceptance: [`Implement ${id}`], gateIds: ['pass'], risk: 'lite' });
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function cli(root: string, ...args: string[]) {
  const run = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 15_000 });
  expect(run.error).toBeUndefined();
  expect(run.stderr).toBe('');
  return { status: run.status, result: JSON.parse(run.stdout.trim()) };
}

async function contents(root: string, prefix = ''): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(entries, await contents(root, path));
    else entries[path] = (await readFile(join(root, path))).toString('base64');
  }
  return entries;
}

async function fixture(tasks: object[]) {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-c2-plan-')); owned.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'spec.md'), '# Synthetic plan validation fixture\n');
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks }));
  await writeFile(join(root, 'core/gates/default.yaml'), `gates:\n  - id: pass\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []\n`);
  expect(cli(root, 'init', '--change', 'plan', '--spec', 'spec.md').status).toBe(0);
  return root;
}

type PlanContext = { taskId: string; specHash: string; subjectTreeHash: string; latestAssessmentFingerprint: string | null; status: string };

function planDryRun(root: string) {
  return cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--dry-run');
}

function contextFrom(dry: ReturnType<typeof planDryRun>): PlanContext {
  return (dry.result.state.planAssessmentContext as PlanContext);
}

async function planAssessment(root: string, context: PlanContext, overrides: Record<string, unknown> = {}): Promise<string> {
  const document = {
    schemaVersion: 1,
    assessmentId: 'assessment-plan',
    changeId: 'plan',
    taskId: context.taskId,
    specHash: context.specHash,
    subjectTreeHash: context.subjectTreeHash,
    coverage: 'complete',
    findings: [{
      id: 'legacy', severity: 'low', relation: 'unrelated', boundary: 'legacy boundary', rationale: 'not caused by this plan',
      evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'local',
    }],
    ...overrides,
  };
  await writeFile(join(root, '.leo-dev/runtime/plan/assessment-input.yaml'), JSON.stringify(document));
  return '.leo-dev/runtime/plan/assessment-input.yaml';
}

afterEach(async () => { await Promise.all(owned.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

test('plan-only dry-run validates the same route without writing projections or journal', async () => {
  const root = await fixture([task('a'), task('b', ['a']), task('c', ['b'])]);
  const before = await contents(root);
  const dry = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--dry-run');
  expect(dry.status, JSON.stringify(dry.result)).toBe(0);
  expect(dry.result.code).toBe('DRY_RUN');
  expect(await contents(root)).toEqual(before);
  expect(cli(root, 'route', '--change', 'plan', '--plan', 'plan.json').status).toBe(0);
}, 20_000);

test.each([
  ['empty', []],
  ['duplicate IDs', [task('a'), task('a')]],
  ['missing dependency', [task('a', ['missing'])]],
  ['cycle', [task('a', ['b']), task('b', ['a'])]],
  ['precompleted task', [{ ...task('a'), state: 'done' }]],
  ['invalid risk', [{ ...task('a'), risk: 'urgent' }]],
  ['missing acceptance', [{ ...task('a'), acceptance: [] }]],
  ['missing gate', [{ ...task('a'), gateIds: ['missing'] }]],
])('refuses %s plan before changing the route or projections', async (_name, tasks) => {
  const root = await fixture(tasks);
  const before = await contents(root);
  const routed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json');
  expect(routed.status, JSON.stringify(routed.result)).not.toBe(0);
  expect(await contents(root)).toEqual(before);
  expect(cli(root, 'status', '--change', 'plan').result.state.tasks).toEqual({});
}, 20_000);

test.each(['standard', 'full'] as const)('routes a %s plan without changing its actual risk', async (risk) => {
  const root = await fixture([{ ...task('a'), risk }]);
  const routed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json');
  expect(routed.status, JSON.stringify(routed.result)).toBe(0);
  expect(routed.result.state).toMatchObject({
    risk,
    tasks: { a: { state: 'ready' } },
    route: { task: { id: 'a', risk } },
  });
}, 20_000);

test('ready assessment admits a dependent plan through the compiled CLI and dry-run publishes its plan scope', async () => {
  const root = await fixture([task('a'), task('b', ['a'])]);
  const before = await contents(root);
  const dry = planDryRun(root);
  expect(dry.status, JSON.stringify(dry.result)).toBe(0);
  expect(contextFrom(dry)).toMatchObject({
    taskId: expect.stringMatching(/^plan:[a-f0-9]{64}$/),
    specHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    subjectTreeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    status: 'not-assessed',
  });
  expect(await contents(root)).toEqual(before);
  const input = await planAssessment(root, contextFrom(dry));
  const routed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', input);
  expect(routed.status, JSON.stringify(routed.result)).toBe(0);
  expect(routed.result.state).toMatchObject({
    tasks: { a: { state: 'ready' }, b: { state: 'pending' } },
    assessmentContext: { status: 'ready' },
  });
}, 20_000);

test.each([
  ['partial', { coverage: 'partial' }, 7, 'ASSESSMENT_REQUIRED'],
  ['unknown repair scope', { findings: [{ id: 'unknown', severity: 'low', relation: 'required-by-change', boundary: 'affected', rationale: 'unknown scope', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'unknown' }] }, 7, 'ASSESSMENT_REQUIRED'],
  ['local high finding', { findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected', rationale: 'repair first', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'local' }] }, 7, 'LOCAL_REMEDIATION_REQUIRED'],
  ['material finding', { findings: [{ id: 'material', severity: 'low', relation: 'required-by-change', boundary: 'affected', rationale: 'material decision', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'material' }] }, 6, 'APPROVAL_REQUIRED'],
])('records %s assessment but selects no plan routes', async (_name, overrides, status, code) => {
  const root = await fixture([task('a'), task('b', ['a'])]);
  const input = await planAssessment(root, contextFrom(planDryRun(root)), overrides);
  const refused = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', input);
  expect(refused.status, JSON.stringify(refused.result)).toBe(status);
  expect(refused.result.code).toBe(code);
  expect(refused.result.state).toMatchObject({ tasks: {}, route: null });
}, 20_000);

test('a recorded plan refusal cannot be bypassed by omitting assessment and dry-run keeps the scoped refusal visible without writes', async () => {
  const root = await fixture([task('a'), task('b', ['a'])]);
  const input = await planAssessment(root, contextFrom(planDryRun(root)), { coverage: 'partial' });
  expect(cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', input).status).toBe(7);
  const before = await contents(root);
  const bypass = planDryRun(root);
  expect(bypass.status, JSON.stringify(bypass.result)).toBe(7);
  expect(bypass.result.code).toBe('ASSESSMENT_REQUIRED');
  expect(bypass.result.state).toMatchObject({
    assessmentContext: { status: 'assessment-required' },
    planAssessmentContext: { taskId: expect.stringMatching(/^plan:/), status: 'assessment-required' },
  });
  expect(await contents(root)).toEqual(before);
}, 20_000);

test('rejects an assessment scoped to a different validated plan without route or assessment writes', async () => {
  const root = await fixture([task('a'), task('b', ['a'])]);
  const context = contextFrom(planDryRun(root));
  const input = await planAssessment(root, context);
  await writeFile(join(root, 'other-plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [task('a'), task('b', ['a']), task('c', ['b'])] }));
  const before = await contents(root);
  const stale = cli(root, 'route', '--change', 'plan', '--plan', 'other-plan.json', '--assessment', input);
  expect(stale.status, JSON.stringify(stale.result)).toBe(5);
  expect(stale.result.code).toBe('CONFLICT');
  expect(await contents(root)).toEqual(before);
}, 20_000);

test('requires a linked successor to clear a plan-local high finding before admitting its dependent tasks', async () => {
  const root = await fixture([task('a'), task('b', ['a'])]);
  const firstContext = contextFrom(planDryRun(root));
  const first = await planAssessment(root, firstContext, {
    findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected', rationale: 'repair first', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'local' }],
  });
  expect(cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', first).status).toBe(7);
  await writeFile(join(root, 'resolved.md'), 'fresh plan repair evidence\n');
  const previous = cli(root, 'status', '--change', 'plan').result.state.assessmentContext as PlanContext;
  const successor = await planAssessment(root, { ...previous, taskId: firstContext.taskId }, {
    assessmentId: 'assessment-plan-successor',
    previousAssessmentFingerprint: previous.latestAssessmentFingerprint,
    findings: [{ id: 'high', severity: 'low', relation: 'unrelated', boundary: 'affected', rationale: 'repair complete', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'local' }],
    resolutions: [{ findingId: 'high', rationale: 'new evidence for the bounded repair', evidence: [{ path: 'resolved.md', sha256: sha256('fresh plan repair evidence\n') }] }],
  });
  const routed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', successor);
  expect(routed.status, JSON.stringify(routed.result)).toBe(0);
  expect(routed.result.state).toMatchObject({ tasks: { a: { state: 'ready' }, b: { state: 'pending' } }, assessmentContext: { status: 'ready' } });
}, 20_000);

test('recovers an interrupted ready plan assessment-and-route batch without splitting its projections', async () => {
  const root = await fixture([task('a'), task('b', ['a'])]);
  const input = await planAssessment(root, contextFrom(planDryRun(root)));
  await expect(new Controller().execute('route', { repo: root, change: 'plan', plan: 'plan.json', assessment: input, faultAt: 'after-batch-projection' })).rejects.toMatchObject({ publicCode: 'INTERNAL_ERROR' });
  const resumed = cli(root, 'resume', '--change', 'plan');
  expect(resumed.status, JSON.stringify(resumed.result)).toBe(0);
  expect(resumed.result.state).toMatchObject({ tasks: { a: { state: 'ready' }, b: { state: 'pending' } }, assessmentContext: { status: 'ready' } });
}, 20_000);

test('unassessed legacy plans remain explicitly not-assessed and ambiguous legacy flags still fail validation', async () => {
  const root = await fixture([task('a'), task('b', ['a'])]);
  const routed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json');
  expect(routed.status, JSON.stringify(routed.result)).toBe(0);
  expect(routed.result.state).toMatchObject({ assessmentContext: { status: 'not-assessed' } });
  const second = await fixture([task('a'), task('b', ['a'])]);
  const ambiguous = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--task', 'a', '--gate', 'pass');
  expect(ambiguous.status, JSON.stringify(ambiguous.result)).toBe(2);
  expect(cli(second, 'route', '--change', 'plan', '--plan', 'plan.json', '--task', 'a', '--gate', 'pass').status).toBe(2);
}, 20_000);
