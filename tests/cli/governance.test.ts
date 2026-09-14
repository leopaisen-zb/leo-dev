import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { Controller } from '../../packages/cli/src/controller/controller.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

interface Envelope { ok: boolean; code: string; state: Record<string, unknown>; errors: Array<{ code: string; message: string }>; evidenceRefs: string[]; }

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-governance-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), `gates:\n  - id: pass\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []\n`);
  await writeFile(join(root, 'approved-spec.md'), '# fixture spec\n');
  await writeFile(join(root, 'boundary.md'), 'evidence\n');
  return root;
}

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const run = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8' });
  const envelope = JSON.parse(run.stdout.trim()) as Envelope;
  return { status: run.status ?? 9, envelope };
}

async function init(root: string, changeId = 'change'): Promise<void> {
  expect(cli(root, 'init', '--change', changeId, '--spec', 'approved-spec.md').status).toBe(0);
}

async function assessment(root: string, changeId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const specHash = sha256(await readFile(join(root, 'approved-spec.md'), 'utf8'));
  const subjectTreeHash = ((cli(root, 'status', '--change', changeId).envelope.state.assessmentContext as { subjectTreeHash: string }).subjectTreeHash);
  const path = join(root, `.leo-dev/runtime/${changeId}/assessment-input.yaml`);
  const document = {
    schemaVersion: 1,
    assessmentId: `assessment-${changeId}`,
    changeId,
    taskId: 'task-1',
    specHash,
    subjectTreeHash,
    coverage: 'complete',
    findings: [{
      id: 'finding-1', severity: 'low', relation: 'unrelated', boundary: 'legacy boundary',
      rationale: 'not caused by this task', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local',
    }],
    ...overrides,
  };
  await writeFile(path, JSON.stringify(document));
  return `.leo-dev/runtime/${changeId}/assessment-input.yaml`;
}

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('governance admission through the compiled public CLI', () => {
  test('keeps a route without assessment explicitly not-assessed', async () => {
    const root = await fixture();
    await init(root);
    const routed = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass');
    expect(routed.status).toBe(0);
    expect(routed.envelope.state).toMatchObject({ assessmentContext: { status: 'not-assessed' } });
  });

  test('records a ready supplied assessment before selecting the Lite route', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change');
    const routed = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input);
    expect(routed.status).toBe(0);
    expect(routed.envelope.state).toMatchObject({ route: { task: { id: 'task-1' } }, assessmentContext: { status: 'ready', changeId: 'change' } });
  });

  test('records a local high finding but refuses route admission', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change', { findings: [{ id: 'finding-1', severity: 'high', relation: 'worsened-by-change', boundary: 'affected boundary', rationale: 'must repair first', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }] });
    const refused = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input);
    expect(refused.status).toBe(7);
    expect(refused.envelope.code).toBe('LOCAL_REMEDIATION_REQUIRED');
    expect(refused.envelope.state).toMatchObject({ route: null, assessmentContext: { status: 'local-remediation-required' } });
  });

  test('cannot bypass an assessment refusal by omitting the option', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change', { coverage: 'partial' });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input).status).toBe(7);
    const bypass = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass');
    expect(bypass.status).toBe(7);
    expect(bypass.envelope.code).toBe('ASSESSMENT_REQUIRED');
  });

  test('retains unrelated findings without blocking a ready route', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change', { findings: [{ id: 'historical', severity: 'high', relation: 'unrelated', boundary: 'separate subsystem', rationale: 'not caused by this task', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'material' }] });
    const routed = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input);
    expect(routed.status).toBe(0);
    const context = (routed.envelope.state.assessmentContext as { latestAssessmentFingerprint: string; recordedSubjectTreeHash: string });
    expect(context.latestAssessmentFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(context.recordedSubjectTreeHash).not.toBe((routed.envelope.state.assessmentContext as { subjectTreeHash: string }).subjectTreeHash);
  });

  test('keeps a material finding terminal across omission and a later ready candidate', async () => {
    const root = await fixture();
    await init(root);
    const first = await assessment(root, 'change', { findings: [{ id: 'material', severity: 'low', relation: 'required-by-change', boundary: 'public boundary', rationale: 'scope is material', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'material' }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(6);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass').status).toBe(6);
    const prior = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const later = await assessment(root, 'change', { assessmentId: 'assessment-later', previousAssessmentFingerprint: prior, findings: [] });
    const blocked = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', later);
    expect(blocked.status).toBe(6);
    expect(blocked.envelope.code).toBe('APPROVAL_REQUIRED');
  });

  test('treats a relevant medium material finding as approval-required before severity-based routing', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change', { findings: [{ id: 'medium-material', severity: 'medium', relation: 'worsened-by-change', boundary: 'module boundary', rationale: 'material repair needed', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'material' }] });
    const refused = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input);
    expect(refused.status).toBe(6);
    expect(refused.envelope.code).toBe('APPROVAL_REQUIRED');
  });

  test('treats a relevant unknown repair scope as assessment-required without selecting a route', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change', { findings: [{ id: 'unknown-scope', severity: 'low', relation: 'required-by-change', boundary: 'affected behavior', rationale: 'scope is not established', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'unknown' }] });
    const refused = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input);
    expect(refused.status).toBe(7);
    expect(refused.envelope.state).toMatchObject({ route: null, assessmentContext: { status: 'assessment-required' } });
  });

  test('rejects stale tree, stale evidence, and outside assessment input before recording a route', async () => {
    const root = await fixture();
    await init(root);
    const staleTree = await assessment(root, 'change');
    await writeFile(join(root, 'tree-drift.md'), 'drift\n');
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', staleTree).status).toBe(5);
    const evidenceStale = await assessment(root, 'change');
    await writeFile(join(root, 'boundary.md'), 'changed evidence\n');
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', evidenceStale).status).toBe(5);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', 'approved-spec.md').status).toBe(2);
  });

  test('rejects missing, schema-invalid, and symlinked assessment inputs', async () => {
    const root = await fixture();
    await init(root);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', '.leo-dev/runtime/change/missing.yaml').status).toBe(2);
    const malformed = join(root, '.leo-dev/runtime/change/malformed.yaml');
    await writeFile(malformed, 'schemaVersion: 1\nunknown: true\n');
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', '.leo-dev/runtime/change/malformed.yaml').status).toBe(2);
    await symlink(join(root, 'approved-spec.md'), join(root, '.leo-dev/runtime/change/link.yaml'));
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', '.leo-dev/runtime/change/link.yaml').status).toBe(2);
  });

  test('requires an explicit fresh-evidence resolution when a prior high finding is downgraded', async () => {
    const root = await fixture();
    await init(root);
    const first = await assessment(root, 'change', { findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected boundary', rationale: 'repair first', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(7);
    const prior = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const downgraded = await assessment(root, 'change', { assessmentId: 'assessment-downgraded', previousAssessmentFingerprint: prior, findings: [{ id: 'high', severity: 'low', relation: 'unrelated', boundary: 'affected boundary', rationale: 'claimed fixed', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', downgraded).status).toBe(2);
    await writeFile(join(root, 'fresh-evidence.md'), 'fresh proof\n');
    const resolved = await assessment(root, 'change', { assessmentId: 'assessment-resolved', previousAssessmentFingerprint: prior, findings: [{ id: 'high', severity: 'low', relation: 'unrelated', boundary: 'affected boundary', rationale: 'bounded repair complete', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }], resolutions: [{ findingId: 'high', rationale: 'repair evidence added', evidence: [{ path: 'fresh-evidence.md', sha256: sha256('fresh proof\n') }] }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', resolved).status).toBe(0);
  });

  test('rejects an initial orphan resolution in dry-run and actual mode without controller writes', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change', { resolutions: [{ findingId: 'never-existed', rationale: 'not a prior finding', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }] }] });
    const journal = join(root, '.leo-dev/runtime/change/journal.ndjson');
    const tasks = join(root, '.leo-dev/changes/change/tasks.yaml');
    const beforeJournal = await readFile(journal, 'utf8');
    const beforeTasks = await readFile(tasks, 'utf8');
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input, '--dry-run').status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input).status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
  });

  test('rejects a successor resolution that names no prior relevant-high finding', async () => {
    const root = await fixture();
    await init(root);
    const first = await assessment(root, 'change', { findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected boundary', rationale: 'repair first', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(7);
    await writeFile(join(root, 'fresh-evidence.md'), 'fresh proof\n');
    const prior = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const successor = await assessment(root, 'change', { assessmentId: 'assessment-unknown-resolution', previousAssessmentFingerprint: prior, findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected boundary', rationale: 'still blocks', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }], resolutions: [{ findingId: 'never-existed', rationale: 'orphan', evidence: [{ path: 'fresh-evidence.md', sha256: sha256('fresh proof\n') }] }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', successor).status).toBe(2);
  });

  test('rejects a successor resolution for a prior low or unrelated finding', async () => {
    const root = await fixture();
    await init(root);
    const first = await assessment(root, 'change', { findings: [{ id: 'low-unknown', severity: 'low', relation: 'required-by-change', boundary: 'affected boundary', rationale: 'scope unknown', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'unknown' }, { id: 'unrelated', severity: 'high', relation: 'unrelated', boundary: 'other boundary', rationale: 'historical', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(7);
    await writeFile(join(root, 'fresh-evidence.md'), 'fresh proof\n');
    const prior = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const successor = await assessment(root, 'change', { assessmentId: 'assessment-low-resolution', previousAssessmentFingerprint: prior, findings: [{ id: 'low-unknown', severity: 'low', relation: 'required-by-change', boundary: 'affected boundary', rationale: 'scope remains unknown', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'unknown' }], resolutions: [{ findingId: 'low-unknown', rationale: 'not eligible', evidence: [{ path: 'fresh-evidence.md', sha256: sha256('fresh proof\n') }] }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', successor).status).toBe(2);
  });

  test('rejects an immediate duplicate assessment ID in dry-run and actual mode before any new projection or route', async () => {
    const root = await fixture();
    await init(root);
    const first = await assessment(root, 'change', { assessmentId: 'duplicate', coverage: 'partial' });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(7);
    const prior = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const duplicate = await assessment(root, 'change', { assessmentId: 'duplicate', previousAssessmentFingerprint: prior, coverage: 'complete' });
    const journal = join(root, '.leo-dev/runtime/change/journal.ndjson');
    const tasks = join(root, '.leo-dev/changes/change/tasks.yaml');
    const assessments = join(root, '.leo-dev/changes/change/assessments');
    const beforeJournal = await readFile(journal, 'utf8');
    const beforeTasks = await readFile(tasks, 'utf8');
    const beforeAssessments = await readdir(assessments);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', duplicate, '--dry-run').status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
    expect(await readdir(assessments)).toEqual(beforeAssessments);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', duplicate).status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
    expect(await readdir(assessments)).toEqual(beforeAssessments);
    expect(cli(root, 'status', '--change', 'change').status).toBe(0);
  });

  test('rejects an earlier historical duplicate ID before recording a new partial refusal', async () => {
    const root = await fixture();
    await init(root);
    const first = await assessment(root, 'change', { assessmentId: 'first', coverage: 'partial' });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(7);
    const firstFingerprint = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const second = await assessment(root, 'change', { assessmentId: 'second', previousAssessmentFingerprint: firstFingerprint, coverage: 'partial' });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', second).status).toBe(7);
    const secondFingerprint = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const duplicate = await assessment(root, 'change', { assessmentId: 'first', previousAssessmentFingerprint: secondFingerprint, coverage: 'partial' });
    const journal = join(root, '.leo-dev/runtime/change/journal.ndjson');
    const assessments = join(root, '.leo-dev/changes/change/assessments');
    const beforeJournal = await readFile(journal, 'utf8');
    const beforeAssessments = await readdir(assessments);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', duplicate).status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readdir(assessments)).toEqual(beforeAssessments);
    expect(cli(root, 'status', '--change', 'change').status).toBe(0);
  });

  test('rejects a high-finding resolution that recycles an unrelated evidence hash from the latest assessment', async () => {
    const root = await fixture();
    await init(root);
    await writeFile(join(root, 'unrelated-evidence.md'), 'unrelated proof\n');
    const first = await assessment(root, 'change', { findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected boundary', rationale: 'repair first', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }, { id: 'unrelated', severity: 'low', relation: 'unrelated', boundary: 'other boundary', rationale: 'historical', evidence: [{ path: 'unrelated-evidence.md', sha256: sha256('unrelated proof\n') }], repairScope: 'local' }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(7);
    const prior = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const recycled = await assessment(root, 'change', { assessmentId: 'assessment-recycled-unrelated', previousAssessmentFingerprint: prior, findings: [{ id: 'high', severity: 'low', relation: 'unrelated', boundary: 'affected boundary', rationale: 'claimed fixed', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }], resolutions: [{ findingId: 'high', rationale: 'recycled proof', evidence: [{ path: 'unrelated-evidence.md', sha256: sha256('unrelated proof\n') }] }] });
    const journal = join(root, '.leo-dev/runtime/change/journal.ndjson');
    const tasks = join(root, '.leo-dev/changes/change/tasks.yaml');
    const beforeJournal = await readFile(journal, 'utf8');
    const beforeTasks = await readFile(tasks, 'utf8');
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', recycled, '--dry-run').status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', recycled).status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
  });

  test('rejects a high-finding resolution that recycles a prior resolution evidence hash', async () => {
    const root = await fixture();
    await init(root);
    await writeFile(join(root, 'a-evidence.md'), 'A proof\n');
    await writeFile(join(root, 'b-evidence.md'), 'B proof\n');
    const first = await assessment(root, 'change', { findings: [{ id: 'A', severity: 'high', relation: 'worsened-by-change', boundary: 'A boundary', rationale: 'repair A first', evidence: [{ path: 'a-evidence.md', sha256: sha256('A proof\n') }], repairScope: 'local' }, { id: 'B', severity: 'high', relation: 'worsened-by-change', boundary: 'B boundary', rationale: 'repair B first', evidence: [{ path: 'b-evidence.md', sha256: sha256('B proof\n') }], repairScope: 'local' }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(7);
    await writeFile(join(root, 'resolved-a.md'), 'resolved A proof\n');
    const firstFingerprint = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const second = await assessment(root, 'change', { assessmentId: 'assessment-resolves-A', previousAssessmentFingerprint: firstFingerprint, findings: [{ id: 'B', severity: 'high', relation: 'worsened-by-change', boundary: 'B boundary', rationale: 'B still blocks', evidence: [{ path: 'b-evidence.md', sha256: sha256('B proof\n') }], repairScope: 'local' }], resolutions: [{ findingId: 'A', rationale: 'A repaired with new evidence', evidence: [{ path: 'resolved-a.md', sha256: sha256('resolved A proof\n') }] }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', second).status).toBe(7);
    const secondFingerprint = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const recycled = await assessment(root, 'change', { assessmentId: 'assessment-recycled-resolution', previousAssessmentFingerprint: secondFingerprint, findings: [{ id: 'B', severity: 'low', relation: 'unrelated', boundary: 'B boundary', rationale: 'claimed repaired', evidence: [{ path: 'b-evidence.md', sha256: sha256('B proof\n') }], repairScope: 'local' }], resolutions: [{ findingId: 'B', rationale: 'recycled A resolution', evidence: [{ path: 'resolved-a.md', sha256: sha256('resolved A proof\n') }] }] });
    const journal = join(root, '.leo-dev/runtime/change/journal.ndjson');
    const tasks = join(root, '.leo-dev/changes/change/tasks.yaml');
    const beforeJournal = await readFile(journal, 'utf8');
    const beforeTasks = await readFile(tasks, 'utf8');
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', recycled, '--dry-run').status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', recycled).status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
  });

  test('rejects a contradictory resolution when the same current finding remains relevant and high', async () => {
    const root = await fixture();
    await init(root);
    const first = await assessment(root, 'change', { findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected boundary', rationale: 'repair first', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }] });
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', first).status).toBe(7);
    await writeFile(join(root, 'contradictory-resolution.md'), 'new but contradictory proof\n');
    const prior = (cli(root, 'status', '--change', 'change').envelope.state.assessmentContext as { latestAssessmentFingerprint: string }).latestAssessmentFingerprint;
    const contradictory = await assessment(root, 'change', { assessmentId: 'assessment-contradictory', previousAssessmentFingerprint: prior, findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected boundary', rationale: 'still blocks', evidence: [{ path: 'boundary.md', sha256: sha256('evidence\n') }], repairScope: 'local' }], resolutions: [{ findingId: 'high', rationale: 'claims resolved despite retained block', evidence: [{ path: 'contradictory-resolution.md', sha256: sha256('new but contradictory proof\n') }] }] });
    const journal = join(root, '.leo-dev/runtime/change/journal.ndjson');
    const tasks = join(root, '.leo-dev/changes/change/tasks.yaml');
    const beforeJournal = await readFile(journal, 'utf8');
    const beforeTasks = await readFile(tasks, 'utf8');
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', contradictory, '--dry-run').status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
    expect(cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', contradictory).status).toBe(2);
    expect(await readFile(journal, 'utf8')).toBe(beforeJournal);
    expect(await readFile(tasks, 'utf8')).toBe(beforeTasks);
  });

  test('dry-run records nothing and status rejects a tampered immutable assessment projection', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change');
    const journal = join(root, '.leo-dev/runtime/change/journal.ndjson');
    const before = await readFile(journal, 'utf8');
    const dry = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input, '--dry-run');
    expect(dry.status).toBe(0);
    expect(await readFile(journal, 'utf8')).toBe(before);
    const routed = cli(root, 'route', '--change', 'change', '--task', 'task-1', '--gate', 'pass', '--assessment', input);
    expect(routed.status).toBe(0);
    const relativePath = ((routed.envelope.state.assessmentContext as { latest: { relativePath: string } }).latest.relativePath);
    await writeFile(join(root, relativePath), 'tampered\n');
    expect(cli(root, 'status', '--change', 'change').status).toBe(5);
  });

  test('recovers an interrupted assessment-and-route batch without splitting its immutable projection', async () => {
    const root = await fixture();
    await init(root);
    const input = await assessment(root, 'change');
    await expect(new Controller().execute('route', { repo: root, change: 'change', task: 'task-1', gate: 'pass', assessment: input, faultAt: 'after-batch-projection' })).rejects.toMatchObject({ publicCode: 'INTERNAL_ERROR' });
    const resumed = cli(root, 'resume', '--change', 'change');
    expect(resumed.status).toBe(0);
    expect(resumed.envelope.state).toMatchObject({ route: { task: { id: 'task-1' } }, assessmentContext: { status: 'ready', latestAssessmentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) } });
  });
});
