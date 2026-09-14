import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { afterEach, expect, test } from 'vitest';
import { Controller } from '../../packages/cli/dist/controller/controller.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

type Envelope = { ok: boolean; code: string; state: Record<string, any> | null; errors: Array<{ code: string; message: string }>; evidenceRefs: string[] };

function cli(root: string, ...args: string[]): { status: number; envelope: Envelope; stderr: string } {
  const result = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], {
    cwd: repository, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  });
  expect(result.error, result.error?.message).toBeUndefined();
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  expect(lines, `stdout=${result.stdout}\nstderr=${result.stderr}`).toHaveLength(1);
  return { status: result.status ?? 9, envelope: JSON.parse(lines[0]!) as Envelope, stderr: result.stderr };
}

function expectExit(actual: ReturnType<typeof cli>, status: number, code: string): void {
  expect(actual.status, JSON.stringify(actual.envelope)).toBe(status);
  expect(actual.envelope.ok).toBe(status === 0);
  expect(actual.envelope.code).toBe(code);
  expect(actual.stderr).toBe('');
}

async function fixture(integration: boolean): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-release-'));
  temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{
    id: 'pass', argv: [process.execPath, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 10,
    required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [],
  }] }));
  await writeFile(join(root, 'spec.md'), '# Release fixture specification\n');
  await writeFile(join(root, 'src/app.ts'), 'export const release = false;\n');
  const tasks = integration
    ? [
      { id: 'implementation', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['implementation passes'], gateIds: ['pass'], risk: 'lite' },
      { id: 'aggregate', revision: 1, state: 'pending', dependsOn: ['implementation'], allowedPaths: ['src/app.ts'], acceptance: ['aggregate verification passes'], gateIds: ['pass'], risk: 'lite', role: 'integration' },
    ]
    : [{ id: 'ordinary', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['ordinary passes'], gateIds: ['pass'], risk: 'lite' }];
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks }));
  return root;
}

async function receipt(root: string, value: unknown): Promise<string> {
  const path = join(root, '.leo-dev/runtime', `receipt-${randomUUID()}.json`);
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function approve(root: string, changeId: string): Promise<void> {
  for (const state of ['discovery', 'spec-review']) expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.approvalContext;
  const path = await receipt(root, {
    receiptId: `approval-${randomUUID()}`, provenance: 'human-confirmed', actorLabel: 'fixture authority', decision: 'grant',
    grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    changeId, scope: 'change', operationKind: 'spec-approval', ...context,
  });
  expectExit(cli(root, 'approve', '--change', changeId, '--receipt', path), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'spec-approved'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'task-ready'), 0, 'TRANSITIONED');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'executing'), 0, 'TRANSITIONED');
}

async function reviewReceipt(root: string, context: Record<string, unknown>, sessionId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  return receipt(root, {
    receiptId: `review-${randomUUID()}`, provenance: 'agent-asserted', actorLabel: 'fixture reviewer label', sessionId,
    runId: context.runId, taskId: context.taskId, taskRevision: context.taskRevision, leaseGeneration: context.leaseGeneration,
    specHash: context.specHash, taskHash: context.taskHash, treeHash: context.treeHash, findingsHash: hash('no findings'), verdict: 'pass',
    timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), ...overrides,
  });
}

async function completeTask(root: string, changeId: string, taskId: string, session: string, changeSource: boolean, reviewSession: string): Promise<Envelope> {
  const claimed = cli(root, 'claim', '--change', changeId, '--task', taskId, '--session', session);
  expectExit(claimed, 0, 'CLAIMED');
  if (changeSource) await writeFile(join(root, 'src/app.ts'), 'export const release = true;\n');
  const runId = claimed.envelope.state!.run.runId as string;
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', taskId, '--run', runId), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', changeId, '--task', taskId), 0, 'SUBMITTED_FOR_REVIEW');
  const context = cli(root, 'status', '--change', changeId).envelope.state!.reviewContext;
  const reviewed = await reviewReceipt(root, context, reviewSession);
  expectExit(cli(root, 'review', '--change', changeId, '--task', taskId, '--receipt', reviewed), 0, 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED');
  return cli(root, 'status', '--change', changeId).envelope;
}

async function aggregateReady(root: string, changeId = 'aggregate-release', afterInit?: () => Promise<void>): Promise<Envelope> {
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED');
  await afterInit?.();
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'plan.json'), 0, 'ROUTED_LITE');
  await approve(root, changeId);
  await completeTask(root, changeId, 'implementation', 'implementation-session', true, 'implementation-reviewer');
  const claimed = cli(root, 'claim', '--change', changeId, '--task', 'aggregate', '--session', 'integration-producer');
  expectExit(claimed, 0, 'CLAIMED');
  const runId = claimed.envelope.state!.run.runId as string;
  expectExit(cli(root, 'run-gates', '--change', changeId, '--task', 'aggregate', '--run', runId), 0, 'GATES_PASSED');
  expectExit(cli(root, 'submit', '--change', changeId, '--task', 'aggregate'), 0, 'SUBMITTED_FOR_REVIEW');
  return cli(root, 'status', '--change', changeId).envelope;
}

async function acceptAggregateStandardReview(root: string, changeId: string): Promise<Envelope> {
  const before = cli(root, 'status', '--change', changeId).envelope.state!;
  const self = await reviewReceipt(root, before.reviewContext, 'integration-producer');
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const journalBeforeSelf = await readFile(journal, 'utf8');
  const selfReview = cli(root, 'review', '--change', changeId, '--task', 'aggregate', '--receipt', self);
  expectExit(selfReview, 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(journalBeforeSelf);
  const assertedIndependent = await reviewReceipt(root, before.reviewContext, 'integration-agent-reviewer');
  const independentAssertion = cli(root, 'review', '--change', changeId, '--task', 'aggregate', '--receipt', assertedIndependent);
  expectExit(independentAssertion, 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(journalBeforeSelf);
  const independent = await reviewReceipt(root, before.reviewContext, 'integration-reviewer', { provenance: 'platform-attested' });
  expectExit(cli(root, 'review', '--change', changeId, '--task', 'aggregate', '--receipt', independent), 0, 'INTEGRATION_REVIEW_ACCEPTED_UNAUTHENTICATED');
  return cli(root, 'status', '--change', changeId).envelope;
}

async function archiveInputs(root: string, changeId: string): Promise<{ receiptPath: string; archiveManifestPath: string; evidencePath: string; artifactPath: string; retrospectivePath: string }> {
  const archiveContext = cli(root, 'status', '--change', changeId).envelope.state!.archiveContext as Record<string, string>;
  const evidencePath = join(root, `.leo-dev/runtime/${changeId}/ci-evidence.json`);
  const artifactPath = join(root, `.leo-dev/runtime/${changeId}/artifact.txt`);
  const retrospectivePath = join(root, `.leo-dev/runtime/${changeId}/retrospective.md`);
  const evidence = {
    schemaVersion: 1, changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash,
    sessionId: 'independent-verifier-session', verifierRunId: `provider-${randomUUID()}`, provider: 'github-actions', status: 'passed',
    checks: [{ name: 'integration-gate', argv: [process.execPath, '-e', 'process.exit(0)'], exitCode: 0, gateDefinitionHash: archiveContext.gateDefinitionHash }],
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`); await writeFile(artifactPath, 'artifact\n'); await writeFile(retrospectivePath, '# retrospective\n');
  const archiveManifestPath = join(root, `.leo-dev/runtime/${changeId}/archive-manifest.json`);
  await writeFile(archiveManifestPath, JSON.stringify({ schemaVersion: 1, changeId, releaseProofHash: archiveContext.releaseProofHash,
    artifacts: [{ path: `.leo-dev/runtime/${changeId}/artifact.txt`, sha256: hash(await readFile(artifactPath)) }],
    retrospective: { path: `.leo-dev/runtime/${changeId}/retrospective.md`, sha256: hash(await readFile(retrospectivePath)) },
  }));
  const receiptPath = await receipt(root, {
    receiptId: `ci-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'fixture GitHub Actions verifier',
    sessionId: evidence.sessionId, provider: evidence.provider, verifierRunId: evidence.verifierRunId,
    changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash, releaseProofHash: archiveContext.releaseProofHash,
    evidenceRef: `.leo-dev/runtime/${changeId}/ci-evidence.json`, evidenceHash: hash(await readFile(evidencePath)), status: 'passed',
    timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  return { receiptPath, archiveManifestPath, evidencePath, artifactPath, retrospectivePath };
}

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('does not let completed ordinary tasks without an integration role create release evidence', async () => {
  const root = await fixture(false); const changeId = 'no-role-release';
  expectExit(cli(root, 'init', '--change', changeId, '--spec', 'spec.md'), 0, 'INITIALIZED');
  expectExit(cli(root, 'route', '--change', changeId, '--plan', 'plan.json'), 0, 'ROUTED_LITE');
  await approve(root, changeId);
  await completeTask(root, changeId, 'ordinary', 'ordinary-producer', true, 'ordinary-reviewer');
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const before = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'release-evidence'), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(before);
}, 40_000);

test('requires an independent Standard-grade aggregate review, then binds release and archive to immutable proof, evidence, and artifact hashes', async () => {
  const root = await fixture(true); const changeId = 'aggregate-release';
  await aggregateReady(root, changeId);
  const integration = await acceptAggregateStandardReview(root, changeId);
  expect(integration.state!.changeState).toBe('integration-review');
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const beforeReleaseDryRun = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'release-evidence', '--dry-run'), 0, 'DRY_RUN');
  expect(await readFile(journal, 'utf8')).toBe(beforeReleaseDryRun);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'release-evidence'), 0, 'RELEASE_EVIDENCE_RECORDED');
  const released = cli(root, 'status', '--change', changeId).envelope.state!;
  const archiveContext = released.archiveContext as Record<string, string>;
  expect(archiveContext).toMatchObject({
    changeId, integrationTaskId: 'aggregate', releaseProofHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    specHash: expect.stringMatching(/^[a-f0-9]{64}$/), candidateTreeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    gateDefinitionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  const evidencePath = join(root, `.leo-dev/runtime/${changeId}/ci-evidence.json`);
  const artifactPath = join(root, `.leo-dev/runtime/${changeId}/artifact.txt`);
  const retrospectivePath = join(root, `.leo-dev/runtime/${changeId}/retrospective.md`);
  const evidence = {
    schemaVersion: 1, changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash,
    sessionId: 'independent-verifier-session', verifierRunId: `provider-${randomUUID()}`, provider: 'github-actions', status: 'passed',
    checks: [{ name: 'integration-gate', argv: [process.execPath, '-e', 'process.exit(0)'], exitCode: 0, gateDefinitionHash: archiveContext.gateDefinitionHash }],
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`); await writeFile(artifactPath, 'artifact\n'); await writeFile(retrospectivePath, '# retrospective\n');
  const manifestPath = join(root, `.leo-dev/runtime/${changeId}/archive-manifest.json`);
  await writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, changeId, releaseProofHash: archiveContext.releaseProofHash,
    artifacts: [{ path: `.leo-dev/runtime/${changeId}/artifact.txt`, sha256: hash(await readFile(artifactPath)) }],
    retrospective: { path: `.leo-dev/runtime/${changeId}/retrospective.md`, sha256: hash(await readFile(retrospectivePath)) },
  }));
  const receiptBase = { provenance: 'platform-attested', actorLabel: 'fixture GitHub Actions verifier',
    sessionId: evidence.sessionId, provider: evidence.provider, verifierRunId: evidence.verifierRunId,
    changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash, releaseProofHash: archiveContext.releaseProofHash,
    evidenceRef: `.leo-dev/runtime/${changeId}/ci-evidence.json`, status: 'passed',
    timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const sameProducer = await receipt(root, { receiptId: `ci-${randomUUID()}`, ...receiptBase, sessionId: 'integration-producer', evidenceHash: hash(await readFile(evidencePath)) });
  const beforeSameProducer = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'archived', '--receipt', sameProducer, '--archive', manifestPath), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(beforeSameProducer);
  const failedEvidence = { ...evidence, status: 'failed', checks: [{ ...evidence.checks[0], exitCode: 1 }] };
  await writeFile(evidencePath, `${JSON.stringify(failedEvidence)}\n`);
  const failedReportReceipt = await receipt(root, { receiptId: `ci-${randomUUID()}`, ...receiptBase, evidenceHash: hash(await readFile(evidencePath)) });
  const beforeFailedReport = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'archived', '--receipt', failedReportReceipt, '--archive', manifestPath), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(beforeFailedReport);
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`);
  await writeFile(artifactPath, 'altered artifact\n');
  const artifactReceipt = await receipt(root, { receiptId: `ci-${randomUUID()}`, ...receiptBase, evidenceHash: hash(await readFile(evidencePath)) });
  const beforeAlteredArtifact = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'archived', '--receipt', artifactReceipt, '--archive', manifestPath), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(beforeAlteredArtifact);
  await writeFile(artifactPath, 'artifact\n');
  const ci = await receipt(root, { receiptId: `ci-${randomUUID()}`, ...receiptBase, evidenceHash: hash(await readFile(evidencePath)) });
  const beforeArchiveDryRun = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'archived', '--receipt', ci, '--archive', manifestPath, '--dry-run'), 0, 'DRY_RUN');
  expect(await readFile(journal, 'utf8')).toBe(beforeArchiveDryRun);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'archived', '--receipt', ci, '--archive', manifestPath), 0, 'ARCHIVED');
  expect(cli(root, 'status', '--change', changeId).envelope.state!.changeState).toBe('archived');
}, 60_000);

test('refuses archive without writing when an allowed application source changes after release evidence', async () => {
  const root = await fixture(true); const changeId = 'archive-source-drift';
  await aggregateReady(root, changeId);
  await acceptAggregateStandardReview(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'release-evidence'), 0, 'RELEASE_EVIDENCE_RECORDED');
  const released = cli(root, 'status', '--change', changeId).envelope.state!;
  const archiveContext = released.archiveContext as Record<string, string>;
  const evidencePath = join(root, `.leo-dev/runtime/${changeId}/ci-evidence.json`);
  const artifactPath = join(root, `.leo-dev/runtime/${changeId}/artifact.txt`);
  const retrospectivePath = join(root, `.leo-dev/runtime/${changeId}/retrospective.md`);
  const evidence = {
    schemaVersion: 1, changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash,
    sessionId: 'independent-verifier-session', verifierRunId: `provider-${randomUUID()}`, provider: 'github-actions', status: 'passed',
    checks: [{ name: 'integration-gate', argv: [process.execPath, '-e', 'process.exit(0)'], exitCode: 0, gateDefinitionHash: archiveContext.gateDefinitionHash }],
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`); await writeFile(artifactPath, 'artifact\n'); await writeFile(retrospectivePath, '# retrospective\n');
  const manifestPath = join(root, `.leo-dev/runtime/${changeId}/archive-manifest.json`);
  await writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, changeId, releaseProofHash: archiveContext.releaseProofHash,
    artifacts: [{ path: `.leo-dev/runtime/${changeId}/artifact.txt`, sha256: hash(await readFile(artifactPath)) }],
    retrospective: { path: `.leo-dev/runtime/${changeId}/retrospective.md`, sha256: hash(await readFile(retrospectivePath)) },
  }));
  const ci = await receipt(root, {
    receiptId: `ci-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'fixture GitHub Actions verifier',
    sessionId: evidence.sessionId, provider: evidence.provider, verifierRunId: evidence.verifierRunId,
    changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash, releaseProofHash: archiveContext.releaseProofHash,
    evidenceRef: `.leo-dev/runtime/${changeId}/ci-evidence.json`, evidenceHash: hash(await readFile(evidencePath)), status: 'passed',
    timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await writeFile(join(root, 'src/app.ts'), 'export const release = "changed after evidence";\n');
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const journalBefore = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'archived', '--receipt', ci, '--archive', manifestPath), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(journalBefore);
  expect(cli(root, 'status', '--change', changeId).envelope.state!.changeState).toBe('release-evidence');
}, 60_000);

test.each(['manifest.yaml', 'archive.yaml'] as const)('refuses a self-rewritten controller %s in the archive manifest without writing', async (controllerProjection) => {
  const root = await fixture(true); const changeId = controllerProjection === 'manifest.yaml' ? 'archive-projection-manifest' : 'archive-projection-archive';
  await aggregateReady(root, changeId, async () => {
    if (controllerProjection === 'archive.yaml') await writeFile(join(root, `.leo-dev/changes/${changeId}/archive.yaml`), 'preexisting archive projection\n');
  });
  await acceptAggregateStandardReview(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'release-evidence'), 0, 'RELEASE_EVIDENCE_RECORDED');
  const archiveContext = cli(root, 'status', '--change', changeId).envelope.state!.archiveContext as Record<string, string>;
  const evidencePath = join(root, `.leo-dev/runtime/${changeId}/ci-evidence.json`);
  const retrospectivePath = join(root, `.leo-dev/runtime/${changeId}/retrospective.md`);
  const controllerPath = `.leo-dev/changes/${changeId}/${controllerProjection}`;
  const controllerAbsolutePath = join(root, controllerPath);
  const evidence = {
    schemaVersion: 1, changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash,
    sessionId: 'independent-verifier-session', verifierRunId: `provider-${randomUUID()}`, provider: 'github-actions', status: 'passed',
    checks: [{ name: 'integration-gate', argv: [process.execPath, '-e', 'process.exit(0)'], exitCode: 0, gateDefinitionHash: archiveContext.gateDefinitionHash }],
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`); await writeFile(retrospectivePath, '# retrospective\n');
  const manifestPath = join(root, `.leo-dev/runtime/${changeId}/archive-manifest.json`);
  await writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, changeId, releaseProofHash: archiveContext.releaseProofHash,
    artifacts: [{ path: controllerPath, sha256: hash(await readFile(controllerAbsolutePath)) }],
    retrospective: { path: `.leo-dev/runtime/${changeId}/retrospective.md`, sha256: hash(await readFile(retrospectivePath)) },
  }));
  const ci = await receipt(root, {
    receiptId: `ci-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'fixture GitHub Actions verifier',
    sessionId: evidence.sessionId, provider: evidence.provider, verifierRunId: evidence.verifierRunId,
    changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash, releaseProofHash: archiveContext.releaseProofHash,
    evidenceRef: `.leo-dev/runtime/${changeId}/ci-evidence.json`, evidenceHash: hash(await readFile(evidencePath)), status: 'passed',
    timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`);
  const before = await readFile(journal, 'utf8');
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'archived', '--receipt', ci, '--archive', manifestPath), 5, 'CONFLICT');
  expect(await readFile(journal, 'utf8')).toBe(before);
  expect(cli(root, 'status', '--change', changeId).envelope.state!.changeState).toBe('release-evidence');
}, 60_000);

test.each(['after-batch-prepared', 'after-batch-projection'] as const)('keeps an archive %s recovery from overwriting a third manifest value', async (faultAt) => {
  const root = await fixture(true); const changeId = `archive-recovery-${faultAt === 'after-batch-prepared' ? 'prepared' : 'projection'}`;
  await aggregateReady(root, changeId); await acceptAggregateStandardReview(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'release-evidence'), 0, 'RELEASE_EVIDENCE_RECORDED');
  const archiveContext = cli(root, 'status', '--change', changeId).envelope.state!.archiveContext as Record<string, string>;
  const evidencePath = join(root, `.leo-dev/runtime/${changeId}/ci-evidence.json`);
  const artifactPath = join(root, `.leo-dev/runtime/${changeId}/artifact.txt`);
  const retrospectivePath = join(root, `.leo-dev/runtime/${changeId}/retrospective.md`);
  const evidence = {
    schemaVersion: 1, changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash,
    sessionId: 'independent-verifier-session', verifierRunId: `provider-${randomUUID()}`, provider: 'github-actions', status: 'passed',
    checks: [{ name: 'integration-gate', argv: [process.execPath, '-e', 'process.exit(0)'], exitCode: 0, gateDefinitionHash: archiveContext.gateDefinitionHash }],
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`); await writeFile(artifactPath, 'artifact\n'); await writeFile(retrospectivePath, '# retrospective\n');
  const archiveManifest = join(root, `.leo-dev/runtime/${changeId}/archive-manifest.json`);
  await writeFile(archiveManifest, JSON.stringify({ schemaVersion: 1, changeId, releaseProofHash: archiveContext.releaseProofHash,
    artifacts: [{ path: `.leo-dev/runtime/${changeId}/artifact.txt`, sha256: hash(await readFile(artifactPath)) }],
    retrospective: { path: `.leo-dev/runtime/${changeId}/retrospective.md`, sha256: hash(await readFile(retrospectivePath)) },
  }));
  const ci = await receipt(root, {
    receiptId: `ci-${randomUUID()}`, provenance: 'platform-attested', actorLabel: 'fixture GitHub Actions verifier',
    sessionId: evidence.sessionId, provider: evidence.provider, verifierRunId: evidence.verifierRunId,
    changeId, specHash: archiveContext.specHash, candidateTreeHash: archiveContext.candidateTreeHash, releaseProofHash: archiveContext.releaseProofHash,
    evidenceRef: `.leo-dev/runtime/${changeId}/ci-evidence.json`, evidenceHash: hash(await readFile(evidencePath)), status: 'passed',
    timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await expect(new Controller().execute('transition', {
    repo: root, change: changeId, scope: 'change', to: 'archived', receipt: ci, archive: archiveManifest, faultAt,
  })).rejects.toMatchObject({ exitCode: 9, publicCode: 'INTERNAL_ERROR' });
  expectExit(cli(root, 'status', '--change', changeId), 7, 'BLOCKED');
  const manifestPath = join(root, `.leo-dev/changes/${changeId}/manifest.yaml`);
  const thirdValue = `schemaVersion: 1\nid: ${changeId}\nstate: blocked\nthirdValue: ${faultAt}\n`;
  await writeFile(manifestPath, thirdValue);
  expectExit(cli(root, 'resume', '--change', changeId), 7, 'BLOCKED');
  expect(await readFile(manifestPath, 'utf8')).toBe(thirdValue);
}, 80_000);

test.each(['after-batch-prepared', 'after-batch-projection'] as const)('publicly recovers an unchanged archive %s batch', async (faultAt) => {
  const root = await fixture(true); const changeId = `archive-recover-${faultAt === 'after-batch-prepared' ? 'prepared' : 'projection'}`;
  await aggregateReady(root, changeId); await acceptAggregateStandardReview(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'release-evidence'), 0, 'RELEASE_EVIDENCE_RECORDED');
  const inputs = await archiveInputs(root, changeId);
  await expect(new Controller().execute('transition', {
    repo: root, change: changeId, scope: 'change', to: 'archived', receipt: inputs.receiptPath, archive: inputs.archiveManifestPath, faultAt,
  })).rejects.toMatchObject({ exitCode: 9, publicCode: 'INTERNAL_ERROR' });
  expectExit(cli(root, 'status', '--change', changeId), 7, 'BLOCKED');
  const resumed = cli(root, 'resume', '--change', changeId);
  expectExit(resumed, 0, 'RESUMED');
  expect(resumed.envelope.state!.changeState).toBe('archived');
}, 80_000);

test.each([
  ['source', async (root: string, _inputs: Awaited<ReturnType<typeof archiveInputs>>) => writeFile(join(root, 'src/app.ts'), 'export const release = "drifted after archive prepare";\n')],
  ['runtime artifact', async (_root: string, inputs: Awaited<ReturnType<typeof archiveInputs>>) => writeFile(inputs.artifactPath, 'drifted artifact\n')],
  ['CI evidence', async (_root: string, inputs: Awaited<ReturnType<typeof archiveInputs>>) => writeFile(inputs.evidencePath, '{"status":"failed"}\n')],
  ['archive manifest', async (_root: string, inputs: Awaited<ReturnType<typeof archiveInputs>>) => writeFile(inputs.archiveManifestPath, '{"schemaVersion":1}\n')],
] as const)('refuses pending archive recovery after %s drift without writing or truncating the batch', async (_label, drift) => {
  const root = await fixture(true); const changeId = `archive-drift-${_label.toLowerCase().replaceAll(' ', '-')}`;
  await aggregateReady(root, changeId); await acceptAggregateStandardReview(root, changeId);
  expectExit(cli(root, 'transition', '--change', changeId, '--scope', 'change', '--to', 'release-evidence'), 0, 'RELEASE_EVIDENCE_RECORDED');
  const inputs = await archiveInputs(root, changeId);
  await expect(new Controller().execute('transition', {
    repo: root, change: changeId, scope: 'change', to: 'archived', receipt: inputs.receiptPath, archive: inputs.archiveManifestPath, faultAt: 'after-batch-prepared',
  })).rejects.toMatchObject({ exitCode: 9, publicCode: 'INTERNAL_ERROR' });
  await drift(root, inputs);
  const journal = join(root, `.leo-dev/runtime/${changeId}/journal.ndjson`); const before = await readFile(journal, 'utf8');
  expectExit(cli(root, 'resume', '--change', changeId), 7, 'BLOCKED');
  expect(await readFile(journal, 'utf8')).toBe(before);
}, 80_000);
