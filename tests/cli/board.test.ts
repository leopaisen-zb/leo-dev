import { createHash } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { appendFile, lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { canonicalTreeHash } from '../../packages/cli/src/repository/tree-hash.js';
import { projectJournalEvents } from '../../packages/cli/src/state/snapshot.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const owned: string[] = [];
const ownedChildren = new Map<ChildProcess, Promise<number | null>>();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function ownChild(child: ChildProcess): Promise<number | null> {
  const closed = child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve(child.exitCode)
    : new Promise<number | null>((resolve) => child.once('close', resolve));
  ownedChildren.set(child, closed);
  void closed.then(() => { ownedChildren.delete(child); });
  return closed;
}

async function stopOwnedChild(child: ChildProcess, closed: Promise<number | null>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) { await closed; return; }
  child.kill('SIGINT');
  await Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 1_000))]);
  if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await closed; }
}

async function receiptFile(name: string, value: unknown): Promise<string> {
  const path = join(tmpdir(), `leo-dev-board-${name}-${process.pid}-${Math.random()}.json`);
  owned.push(path);
  await writeFile(path, JSON.stringify(value));
  return path;
}

function cli(root: string, ...args: string[]): { status: number; envelope: any } {
  const output = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 15_000 });
  expect(output.error, output.error?.message).toBeUndefined();
  expect(output.stderr).toBe('');
  return { status: output.status ?? 9, envelope: JSON.parse(output.stdout.trim()) };
}

async function files(root: string, prefix = ''): Promise<Record<string, { bytes: string; mtimeMs: number }>> {
  const output: Record<string, { bytes: string; mtimeMs: number }> = {};
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(output, await files(root, relative));
    else {
      const path = join(root, relative); const info = await stat(path);
      output[relative] = { bytes: (await readFile(path)).toString('base64'), mtimeMs: info.mtimeMs };
    }
  }
  return output;
}

async function metadata(root: string, prefix = ''): Promise<Record<string, Record<string, bigint | number | string>>> {
  const path = join(root, prefix);
  const info = await lstat(path, { bigint: true });
  const entry: Record<string, bigint | number | string> = {
    kind: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : info.isSymbolicLink() ? 'symlink' : 'other',
    dev: info.dev, ino: info.ino, mode: info.mode, nlink: info.nlink, size: info.size, mtimeNs: info.mtimeNs, ctimeNs: info.ctimeNs,
  };
  if (info.isFile()) entry.sha256 = createHash('sha256').update(await readFile(path)).digest('hex');
  const output: Record<string, Record<string, bigint | number | string>> = { [prefix || '.']: entry };
  if (!info.isDirectory()) return output;
  for (const child of await readdir(path, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${child.name}` : child.name;
    Object.assign(output, await metadata(root, relative));
  }
  return output;
}

async function fixture(gateExit = 0, risk: 'lite' | 'standard' | 'full' = 'lite'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-board-')); owned.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'spec.md'), '# Board observation\n');
  await writeFile(join(root, 'design.md'), '# Board design\n');
  await writeFile(join(root, 'plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'board-task', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['.'], acceptance: ['Board task is complete'], gateIds: ['pass'], risk }] }));
  await writeFile(join(root, 'core/gates/default.yaml'), `gates:\n  - id: pass\n    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(${gateExit})"]\n    cwd: .\n    timeoutSeconds: 10\n    required: true\n    replaySafety: pure\n    effectClass: local-verification\n    network: deny\n    environmentAllowlist: []\n    declaredWritePaths: []\n`);
  expect(cli(root, 'init', '--change', 'board', '--spec', 'spec.md').status).toBe(0);
  const routed = risk === 'lite'
    ? cli(root, 'route', '--change', 'board', '--task', 'board-task', '--gate', 'pass')
    : cli(root, 'route', '--change', 'board', '--plan', 'plan.json');
  expect(routed.status, JSON.stringify(routed.envelope)).toBe(0);
  return root;
}

async function advanceToExecuting(root: string, risk: 'lite' | 'standard' | 'full' = 'lite'): Promise<void> {
  expect(cli(root, 'transition', '--change', 'board', '--scope', 'change', '--to', 'discovery').status).toBe(0);
  expect(cli(root, 'transition', '--change', 'board', '--scope', 'change', '--to', 'spec-review').status).toBe(0);
  const context = cli(root, 'status', '--change', 'board').envelope.state.approvalContext;
  const receipt = join(root, 'approval.json');
  await writeFile(receipt, JSON.stringify({
    receiptId: 'board-approval', provenance: 'human-confirmed', actorLabel: 'board fixture authority', decision: 'grant',
    grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    changeId: 'board', scope: 'change', operationKind: 'spec-approval', ...context,
  }));
  expect(cli(root, 'approve', '--change', 'board', '--receipt', receipt).status).toBe(0);
  expect(cli(root, 'transition', '--change', 'board', '--scope', 'change', '--to', 'spec-approved').status).toBe(0);
  if (risk !== 'lite') {
    expect(cli(root, 'transition', '--change', 'board', '--scope', 'change', '--to', 'design-review', '--design', 'design.md', '--session', 'producer-A').status).toBe(0);
    const designContext = cli(root, 'status', '--change', 'board').envelope.state.designReviewContext;
    const designReceipt = await receiptFile('design-review', {
      receiptId: 'board-design-review', provenance: 'human-confirmed', actorLabel: 'board design reviewer', verdict: 'pass',
      findingsHash: hash('no design findings'), timestamp: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
      changeId: 'board', specHash: designContext.specHash, planHash: designContext.planHash, designHash: designContext.designHash, producerSession: designContext.producerSession,
    });
    const designed = cli(root, 'transition', '--change', 'board', '--scope', 'change', '--to', 'design-approved', '--receipt', designReceipt);
    expect(designed.status, JSON.stringify(designed.envelope)).toBe(0);
  }
  for (const target of ['task-ready', 'executing']) {
    expect(cli(root, 'transition', '--change', 'board', '--scope', 'change', '--to', target).status).toBe(0);
  }
}

afterEach(async () => {
  await Promise.all([...ownedChildren.entries()].map(([child, closed]) => stopOwnedChild(child, closed)));
  await Promise.all(owned.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test('publishes board as an explicit change-bound command', async () => {
  const root = await fixture();
  const help = cli(root, 'board', '--help');
  expect(help.status).toBe(0);
  expect(help.envelope.state).toMatchObject({ command: 'board', options: expect.arrayContaining(['--change <id>']) });
});

describe('loopback board lifecycle fixture', () => {
  let root: string;

  beforeEach(async () => { root = await fixture(); });

  test('starts a loopback board only on explicit invocation and closes on SIGINT', async () => {
    const child = spawn(process.execPath, [executable, 'board', '--change', 'board', '--repo', root, '--json'], { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = ownChild(child);
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); }); child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { clearTimeout(deadline); child.stdout.off('data', check); child.off('error', failed); };
        const failed = (error: Error) => { cleanup(); reject(error); };
        const check = () => { if (/http:\/\/127\.0\.0\.1:\d+\//.test(stdout)) { cleanup(); resolve(); } };
        const deadline = setTimeout(() => { cleanup(); reject(new Error(`board did not publish URL: ${stdout}`)); }, 5_000);
        child.stdout.on('data', check); child.once('error', failed);
      });
      const status = await new Promise<number | null>((resolve, reject) => {
        const childState = () => JSON.stringify({ pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode, killed: child.killed });
        const cleanup = () => clearTimeout(deadline);
        const deadline = setTimeout(() => { cleanup(); reject(new Error(`board did not close within 1000ms after SIGINT; state=${childState()} stdout=${stdout} stderr=${stderr}`)); }, 1_000);
        closed.then((code) => { cleanup(); resolve(code); }, (error) => { cleanup(); reject(error); });
        try { child.kill('SIGINT'); } catch (error) { cleanup(); reject(error); }
      });
      expect(stderr).toBe(''); expect(status).toBe(0);
      const stream = stdout.trim().split('\n').map((line) => JSON.parse(line));
      expect(stream).toHaveLength(2);
      expect(stream[0]).toMatchObject({ event: 'BOARD_LISTENING', url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/$/), repositoryRoot: await realpath(root), changeId: 'board' });
      expect(stream[1]).toMatchObject({ code: 'BOARD_CLOSED' });
    } finally { await stopOwnedChild(child, closed); }
  }, 10_000);
});

test('observes a real CLI-produced task history without changing any file', async () => {
  const root = await fixture(); const before = await files(root);
  const observed = cli(root, 'observe', '--change', 'board');
  expect(observed.status, JSON.stringify(observed.envelope)).toBe(0);
  expect(observed.envelope.code).toBe('OBSERVATION');
  expect(observed.envelope.state).toMatchObject({ availability: 'available', hostLiveStatus: 'unknown', change: { state: 'triage' }, tasks: [{ id: 'board-task', state: 'ready', column: 'todo' }] });
  expect(await files(root)).toEqual(before);
});

test('reports missing, incomplete, and source-drifted histories as unavailable without repairing them', async () => {
  const root = await fixture();
  const missing = cli(root, 'observe', '--change', 'absent');
  expect(missing.status).toBe(0);
  expect(missing.envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'PREREQUISITE_FAILED' } });

  const journal = join(root, '.leo-dev/runtime/board/journal.ndjson');
  await appendFile(journal, '{"sequence":999'); const incomplete = await readFile(journal);
  const half = cli(root, 'observe', '--change', 'board');
  expect(half.status).toBe(0);
  expect(half.envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
  expect(await readFile(journal)).toEqual(incomplete);

  await writeFile(journal, incomplete.subarray(0, incomplete.lastIndexOf(Buffer.from('\n')) + 1));
  await writeFile(join(root, 'spec.md'), '# Source drift\n');
  const drifted = cli(root, 'observe', '--change', 'board');
  expect(drifted.status).toBe(0);
  expect(drifted.envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'CONFLICT' } });
});

test('keeps a pending controller batch visible as an observation blocker', async () => {
  const root = await fixture();
  const journal = new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson'));
  await journal.append({ changeId: 'board', type: 'controller.batch.prepared', payload: { version: 1, batchId: 'pending-board', kind: 'board-test', projections: [], operations: [] } });
  const observed = cli(root, 'observe', '--change', 'board');
  expect(observed.status).toBe(0);
  expect(observed.envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED', message: expect.stringContaining('pending controller batch') } });
});

describe('superseded Gate fixture', () => {
  let root: string;

  beforeEach(async () => { root = await fixture(1); await advanceToExecuting(root); });

  test('keeps an old Gate result bound to its own candidate when a later Run has a matching candidate', async () => {
  const first = cli(root, 'claim', '--change', 'board', '--task', 'board-task', '--session', 'first');
  expect(first.status).toBe(0);
  const oldRun = first.envelope.state.run.runId as string;
  expect(cli(root, 'run-gates', '--change', 'board', '--task', 'board-task', '--run', oldRun).status).toBe(4);

  const second = cli(root, 'claim', '--change', 'board', '--task', 'board-task', '--session', 'second');
  expect(second.status).toBe(0);
  const secondRun = second.envelope.state.run.runId as string;
  await writeFile(join(root, 'later-candidate.ts'), 'export const later = true;\n');
  const events = projectJournalEvents((await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).replay()).events).events;
  const oldCandidateEvent = events.find((event) => event.type === 'controller.candidate.registered' && (event.payload as { runId?: string }).runId === oldRun);
  expect(oldCandidateEvent).toBeDefined();
  const oldCandidate = oldCandidateEvent!.payload as Record<string, unknown>;
  const newLease = second.envelope.state.run.lease;
  const newCandidate = { ...oldCandidate, runId: secondRun, leaseGeneration: newLease.generation, claimInputTreeHash: newLease.inputTreeHash, treeHash: (await canonicalTreeHash(root)).hash };
  await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({ changeId: 'board', taskId: 'board-task', taskRevision: 1, leaseGeneration: newLease.generation, type: 'controller.candidate.registered', payload: newCandidate });

  const observed = cli(root, 'observe', '--change', 'board');
  expect(observed.status, JSON.stringify(observed.envelope)).toBe(0);
    expect(observed.envelope.state.tasks[0]).toMatchObject({ runId: secondRun, gate: { runId: oldRun, candidateTreeHash: oldCandidate.treeHash, currentCandidate: 'drifted' } });
  });
});

async function submittedFixture(risk: 'lite' | 'standard' | 'full' = 'lite', ttlSeconds?: number): Promise<{ root: string; runId: string; candidate: Record<string, unknown>; submitted: Record<string, unknown> }> {
  const root = await fixture(0, risk);
  await advanceToExecuting(root, risk);
  const claimArgs = ['claim', '--change', 'board', '--task', 'board-task', '--session', 'producer-A'];
  if (ttlSeconds !== undefined) claimArgs.push('--ttl', String(ttlSeconds));
  const claimed = cli(root, ...claimArgs);
  expect(claimed.status).toBe(0);
  const runId = claimed.envelope.state.run.runId as string;
  const gated = cli(root, 'run-gates', '--change', 'board', '--task', 'board-task', '--run', runId);
  expect(gated.status, JSON.stringify(gated.envelope)).toBe(0);
  expect(cli(root, 'submit', '--change', 'board', '--task', 'board-task').status).toBe(0);
  const logical = projectJournalEvents((await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).replay()).events).events;
  const candidate = logical.find((event) => event.type === 'controller.candidate.registered' && (event.payload as { runId?: string }).runId === runId)?.payload as Record<string, unknown> | undefined;
  const submitted = logical.find((event) => event.type === 'controller.submit.accepted' && (event.payload as { runId?: string }).runId === runId)?.payload as Record<string, unknown> | undefined;
  expect(candidate).toBeDefined();
  expect(submitted).toBeDefined();
  return { root, runId, candidate: candidate!, submitted: submitted! };
}

test('projects a submitted task onto doing with a reviewing badge', async () => {
  const { root } = await submittedFixture();
  const observed = cli(root, 'observe', '--change', 'board');
  expect(observed.status, JSON.stringify(observed.envelope)).toBe(0);
  expect(observed.envelope.state).toMatchObject({
    availability: 'available',
    tasks: [{ id: 'board-task', state: 'review-required', column: 'doing', reviewBadge: 'reviewing' }],
  });
}, 60_000);

describe('completed Gate observation fixture', () => {
  let prepared: Awaited<ReturnType<typeof submittedFixture>>;

  beforeEach(async () => { prepared = await submittedFixture(); });

  test('observes a completed Gate history repeatedly without changing runtime directory or file metadata', async () => {
    const { root } = prepared;
    const before = await metadata(root);

    const first = cli(root, 'observe', '--change', 'board');
    const second = cli(root, 'observe', '--change', 'board');

    expect(first.status, JSON.stringify(first.envelope)).toBe(0);
    expect(second.status, JSON.stringify(second.envelope)).toBe(0);
    expect(first.envelope.state).toMatchObject({ availability: 'available' });
    expect(second.envelope.state).toMatchObject({ availability: 'available' });
    expect(await metadata(root)).toEqual(before);
  }, 30_000);
});

function reviewReceipt(submitted: Record<string, unknown>, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...submitted, receiptId: 'board-review', provenance: 'human-confirmed', actorLabel: 'board reviewer',
    findingsHash: hash('no findings'), verdict: 'pass', timestamp: new Date(Date.now() - 100).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), ...overrides,
  };
}

async function appendReview(root: string, receipt: Record<string, unknown>): Promise<void> {
  await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({
    changeId: 'board', taskId: 'board-task', taskRevision: Number(receipt.taskRevision), leaseGeneration: Number(receipt.leaseGeneration),
    type: 'receipt.review.ingested', payload: { receipt, issuerAuthenticated: false },
  });
}

async function recoveredSubmittedFixture(): Promise<{ root: string; submitted: Record<string, unknown>; recoveryId: string; recoveryRecordedAt: string }> {
  const { root, submitted } = await submittedFixture('lite', 6_000);
  const expiresAt = Date.parse(cli(root, 'status', '--change', 'board').envelope.state.run.lease.expiresAt);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.max(0, expiresAt - Date.now() + 100)));
  const recovered = cli(root, 'resume', '--change', 'board', '--task', 'board-task', '--recover-review');
  expect(recovered.status, JSON.stringify(recovered.envelope)).toBe(0);
  const logical = projectJournalEvents((await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).replay()).events).events;
  const recovery = logical.findLast((event) => event.type === 'controller.review.recovered');
  expect(recovery).toBeDefined();
  return { root, submitted, recoveryId: recovered.envelope.state.reviewContext.recoveryId as string, recoveryRecordedAt: recovery!.timestamp };
}

describe('displayed candidate and review integrity fixture', () => {
  let prepared: Awaited<ReturnType<typeof submittedFixture>>;

  beforeEach(async () => { prepared = await submittedFixture(); });

  test('refuses an observation when a displayed Gate candidate has a forged claim-input binding', async () => {
    const { root, runId, candidate } = prepared;
    const status = cli(root, 'status', '--change', 'board').envelope.state;
    const lease = status.run.lease;
    await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({
      changeId: 'board', taskId: 'board-task', taskRevision: 1, leaseGeneration: lease.generation, type: 'controller.candidate.registered',
      payload: { ...candidate, runId, claimInputTreeHash: 'f'.repeat(64) },
    });

    const before = await metadata(root);
    const observed = cli(root, 'observe', '--change', 'board');
    expect(observed.envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
    expect(await metadata(root)).toEqual(before);
  });

  test('refuses an observation when a displayed review receipt has a forged candidate binding', async () => {
    const { root, runId, candidate } = prepared;
    const lease = cli(root, 'status', '--change', 'board').envelope.state.run.lease;
    await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({
      changeId: 'board', taskId: 'board-task', taskRevision: 1, leaseGeneration: lease.generation, type: 'receipt.review.ingested',
      payload: { receipt: { receiptId: 'forged-review', verdict: 'pass', runId, taskId: 'wrong-task', taskRevision: 99, leaseGeneration: 99, specHash: 'a'.repeat(64), taskHash: 'b'.repeat(64), treeHash: candidate.treeHash }, issuerAuthenticated: false },
    });

    const observed = cli(root, 'observe', '--change', 'board');
    expect(observed.envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
  });
});

describe('malformed recorded review fixture', () => {
  let prepared: Awaited<ReturnType<typeof submittedFixture>>;

  beforeEach(async () => { prepared = await submittedFixture(); });

  test('refuses a review verdict with only submitted fields and no review receipt shape', async () => {
    const { root, runId, candidate } = prepared;
    const lease = cli(root, 'status', '--change', 'board').envelope.state.run.lease;
    await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({
      changeId: 'board', taskId: 'board-task', taskRevision: 1, leaseGeneration: lease.generation, type: 'receipt.review.ingested',
      payload: { receipt: { receiptId: 'shape-missing', verdict: 'pass', runId, taskId: 'board-task', taskRevision: 1, leaseGeneration: lease.generation, specHash: candidate.specHash, taskHash: candidate.taskHash, treeHash: candidate.treeHash }, issuerAuthenticated: false },
    });

    expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
  });

  test('refuses a schema-valid review receipt whose outer event belongs to another change', async () => {
    const { root, runId, candidate } = prepared;
    const lease = cli(root, 'status', '--change', 'board').envelope.state.run.lease;
    await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({
      changeId: 'other-change', taskId: 'board-task', taskRevision: 1, leaseGeneration: lease.generation, type: 'receipt.review.ingested',
      payload: { receipt: { receiptId: 'wrong-change', provenance: 'human-confirmed', actorLabel: 'fixture reviewer', runId, taskId: 'board-task', taskRevision: 1, leaseGeneration: lease.generation, specHash: candidate.specHash, taskHash: candidate.taskHash, treeHash: candidate.treeHash, findingsHash: 'c'.repeat(64), verdict: 'pass', timestamp: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }, issuerAuthenticated: false },
    });

    expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
  });
});

describe('recorded claim fixture', () => {
  let root: string;

  beforeEach(async () => { root = await fixture(); await advanceToExecuting(root); });

  test('publishes recorded claim, lease, numeric revision, and blocker reasons without claiming host liveness', async () => {
    const claimed = cli(root, 'claim', '--change', 'board', '--task', 'board-task', '--session', 'producer-A');
    expect(claimed.status).toBe(0);
    const lease = claimed.envelope.state.run.lease;
    await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({
      changeId: 'board', taskId: 'board-task', taskRevision: 1, leaseGeneration: lease.generation, type: 'blocker.recorded',
      payload: { blockerId: 'fixture-blocker', reason: 'fixture evidence requires attention' },
    });

    const observed = cli(root, 'observe', '--change', 'board');
    expect(observed.status, JSON.stringify(observed.envelope)).toBe(0);
    expect(observed.envelope.state).toMatchObject({ hostLiveStatus: 'unknown', change: { revision: 1, revisionId: null, blockers: [{ blockerId: 'fixture-blocker', reason: 'fixture evidence requires attention', taskId: 'board-task' }] }, tasks: [{ assignmentSession: 'producer-A', runState: 'running', leaseActive: true, blockers: [{ blockerId: 'fixture-blocker', reason: 'fixture evidence requires attention' }] }] });
  });
});

describe.each(['lite', 'standard'] as const)('normally admitted %s review fixture', (risk) => {
  let prepared: Awaited<ReturnType<typeof submittedFixture>>;

  beforeEach(async () => { prepared = await submittedFixture(risk); });

  test(`shows a normally admitted ${risk} review from its certified submission`, async () => {
    const { root, submitted } = prepared;
    const path = await receiptFile(`${risk}-review`, reviewReceipt(submitted, risk === 'lite' ? { provenance: 'platform-attested', sessionId: 'reviewer-lite' } : {}));
    const reviewed = cli(root, 'review', '--change', 'board', '--task', 'board-task', '--receipt', path);
    expect(reviewed.status, JSON.stringify(reviewed.envelope)).toBe(0);

    const observed = cli(root, 'observe', '--change', 'board');
    expect(observed.status, JSON.stringify(observed.envelope)).toBe(0);
    expect(observed.envelope.state).toMatchObject({ availability: 'available', tasks: [{ review: { status: 'pass', evidenceRef: 'receipt:board-review' } }] });
  });
});

describe('Full review fixture', () => {
  let prepared: Awaited<ReturnType<typeof submittedFixture>>;

  beforeEach(async () => { prepared = await submittedFixture('full'); });

  test('keeps an admitted Full review observable after nested assessments expire while admission still rejects expired assessments', async () => {
  const { root, submitted } = prepared;
  const nested = (expiresAt: string, timestamp: string) => ['architecture', 'security', 'nfr'].map((area) => ({
    ...submitted, receiptId: `board-${area}`, area, provenance: 'platform-attested', actorLabel: `${area} reviewer`,
    sessionId: `${area}-session`, findingsHash: hash(area), verdict: 'pass', timestamp, expiresAt,
  }));
  const expiredPath = await receiptFile('expired-full-review', reviewReceipt(submitted, {
    receiptId: 'expired-full-review', assessments: nested(new Date(Date.now() - 500).toISOString(), new Date(Date.now() - 1_000).toISOString()),
  }));
  expect(cli(root, 'review', '--change', 'board', '--task', 'board-task', '--receipt', expiredPath).status).toBe(5);

  const assessmentExpiry = Date.now() + 2_000;
  const acceptedPath = await receiptFile('accepted-full-review', reviewReceipt(submitted, {
    assessments: nested(new Date(assessmentExpiry).toISOString(), new Date(Date.now() - 100).toISOString()),
  }));
  const reviewed = cli(root, 'review', '--change', 'board', '--task', 'board-task', '--receipt', acceptedPath);
  expect(reviewed.status, JSON.stringify(reviewed.envelope)).toBe(0);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.max(0, assessmentExpiry - Date.now() + 100)));

  const observed = cli(root, 'observe', '--change', 'board');
  expect(observed.status, JSON.stringify(observed.envelope)).toBe(0);
  expect(observed.envelope.state).toMatchObject({ availability: 'available', tasks: [{ review: { status: 'pass', evidenceRef: 'receipt:board-review' } }] });
  }, 30_000);
});

describe('review receipt history fixture', () => {
  let prepared: Awaited<ReturnType<typeof submittedFixture>>;

  beforeEach(async () => { prepared = await submittedFixture(); });

  test('refuses a review receipt ID already consumed by another receipt kind in the strict history prefix', async () => {
    const { root, submitted } = prepared;
    await appendReview(root, reviewReceipt(submitted, { receiptId: 'board-approval' }));

    expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
  });

  test('refuses a recovery ID on a normally submitted candidate with no recovery epoch', async () => {
    const { root, submitted } = prepared;
    await appendReview(root, reviewReceipt(submitted, { recoveryId: 'invented-recovery' }));

    expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
  });
});

describe('prior revision review fixture', () => {
  let prepared: Awaited<ReturnType<typeof submittedFixture>>;

  beforeEach(async () => { prepared = await submittedFixture('full'); });

  test('refuses a current review receipt ID consumed by a prior task revision without revalidating the old receipt', async () => {
  const { root, submitted } = prepared;
  const assessmentTimestamp = new Date(Date.now() - 100).toISOString();
  const assessmentExpiry = new Date(Date.now() + 60_000).toISOString();
  const assessments = ['architecture', 'security', 'nfr'].map((area) => ({
    ...submitted, receiptId: area === 'architecture' ? 'prior-review-id' : `prior-${area}`, area,
    provenance: 'platform-attested', actorLabel: `${area} reviewer`, sessionId: `prior-${area}-session`,
    findingsHash: hash(`prior-${area}`), verdict: 'pass', timestamp: assessmentTimestamp, expiresAt: assessmentExpiry,
  }));
  const priorReceipt = await receiptFile('prior-review', reviewReceipt(submitted, { receiptId: 'prior-review-main', assessments }));
  expect(cli(root, 'review', '--change', 'board', '--task', 'board-task', '--receipt', priorReceipt).status).toBe(0);

  await writeFile(join(root, 'spec-v2.md'), '# Board observation v2\n');
  await writeFile(join(root, 'plan-v2.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'board-task', revision: 2, state: 'ready', dependsOn: [], allowedPaths: ['.'], acceptance: ['Board task v2 is complete'], gateIds: ['pass'], risk: 'lite' }] }));
  const proposal = cli(root, 'revise', '--change', 'board', '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--dry-run');
  expect(proposal.status, JSON.stringify(proposal.envelope)).toBe(0);
  const revision = proposal.envelope.state.revisionContext;
  const assessment = '.leo-dev/runtime/board/revision-assessment.json';
  await writeFile(join(root, assessment), JSON.stringify({ schemaVersion: 1, assessmentId: 'board-v2-assessment', changeId: 'board', taskId: revision.taskId, specHash: revision.authorityHash, subjectTreeHash: revision.subjectTreeHash, coverage: 'complete', findings: [] }));
  const ready = cli(root, 'revise', '--change', 'board', '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', assessment, '--dry-run');
  expect(ready.status, JSON.stringify(ready.envelope)).toBe(0);
  const grant = await receiptFile('revision-grant', {
    receiptId: 'board-v2-grant', provenance: 'human-confirmed', actorLabel: 'board revision authority', decision: 'grant',
    grantedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    changeId: 'board', scope: 'change', operationKind: 'spec-revision', ...ready.envelope.state.revisionApprovalContext,
  });
  const revised = cli(root, 'revise', '--change', 'board', '--spec', 'spec-v2.md', '--plan', 'plan-v2.json', '--assessment', assessment, '--receipt', grant);
  expect(revised.status, JSON.stringify(revised.envelope)).toBe(0);
  for (const target of ['task-ready', 'executing']) expect(cli(root, 'transition', '--change', 'board', '--scope', 'change', '--to', target).status).toBe(0);
  const claimed = cli(root, 'claim', '--change', 'board', '--task', 'board-task', '--session', 'producer-v2');
  expect(claimed.status, JSON.stringify(claimed.envelope)).toBe(0);
  const runId = claimed.envelope.state.run.runId as string;
  expect(cli(root, 'run-gates', '--change', 'board', '--task', 'board-task', '--run', runId).status).toBe(0);
  expect(cli(root, 'submit', '--change', 'board', '--task', 'board-task').status).toBe(0);
  const current = projectJournalEvents((await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).replay()).events).events;
  const currentSubmitted = current.findLast((event) => event.type === 'controller.submit.accepted')!.payload as Record<string, unknown>;
  await appendReview(root, reviewReceipt(currentSubmitted, { receiptId: 'prior-review-id' }));

  expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
  }, 40_000);
});

describe('duplicate submit fixture', () => {
  let prepared: Awaited<ReturnType<typeof submittedFixture>>;

  beforeEach(async () => { prepared = await submittedFixture(); });

  test('refuses a receipt followed by another identical submit for the same Run and revision', async () => {
    const { root, submitted } = prepared;
    await appendReview(root, reviewReceipt(submitted));
    await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({
      changeId: 'board', taskId: 'board-task', taskRevision: Number(submitted.taskRevision), leaseGeneration: Number(submitted.leaseGeneration),
      type: 'controller.submit.accepted', payload: submitted,
    });

    expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
  });
});

test.each(['missing', 'wrong', 'predating'] as const)('refuses a recovered candidate receipt with a %s recovery binding', async (variant) => {
  const { root, submitted, recoveryId, recoveryRecordedAt } = await recoveredSubmittedFixture();
  const overrides = variant === 'missing' ? {}
    : variant === 'wrong' ? { recoveryId: 'wrong-recovery-id' }
      : { recoveryId, timestamp: new Date(Date.parse(recoveryRecordedAt) - 1_000).toISOString() };
  await appendReview(root, reviewReceipt(submitted, overrides));

  expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
}, 30_000);

test('keeps the original certified submit observable through legitimate expired-review recovery', async () => {
  const { root, submitted, recoveryId } = await recoveredSubmittedFixture();
  const receipt = await receiptFile('recovered-review', reviewReceipt(submitted, { recoveryId, provenance: 'platform-attested', sessionId: 'recovery-reviewer', timestamp: new Date().toISOString() }));
  const reviewed = cli(root, 'review', '--change', 'board', '--task', 'board-task', '--receipt', receipt);
  expect(reviewed.status, JSON.stringify(reviewed.envelope)).toBe(0);

  const observed = cli(root, 'observe', '--change', 'board');
  expect(observed.status, JSON.stringify(observed.envelope)).toBe(0);
  expect(observed.envelope.state).toMatchObject({ availability: 'available', tasks: [{ review: { status: 'pass', evidenceRef: 'receipt:board-review' } }] });
}, 30_000);

test('refuses a receipt recorded before a later recovery for that exact submit', async () => {
  const { root, submitted } = await submittedFixture('lite', 6_000);
  const expiresAt = Date.parse(cli(root, 'status', '--change', 'board').envelope.state.run.lease.expiresAt);
  await appendReview(root, reviewReceipt(submitted));
  await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.max(0, expiresAt - Date.now() + 100)));
  const recovered = cli(root, 'resume', '--change', 'board', '--task', 'board-task', '--recover-review');
  expect(recovered.status, JSON.stringify(recovered.envelope)).toBe(0);

  expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
}, 30_000);

test('refuses any logical event whose outer change identity differs from the observed journal', async () => {
  const root = await fixture();
  await new Journal(join(root, '.leo-dev/runtime/board/journal.ndjson')).append({
    changeId: 'other-change', type: 'blocker.recorded', payload: { blockerId: 'cross-change', reason: 'wrong outer identity' },
  });

  expect(cli(root, 'observe', '--change', 'board').envelope.state).toMatchObject({ availability: 'unavailable', blocker: { code: 'BLOCKED' } });
});
