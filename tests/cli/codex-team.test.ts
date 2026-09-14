import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';
import { afterEach, expect, test } from 'vitest';
import { Journal } from '../../packages/cli/src/state/journal.js';
import { planTeamRecord } from '../../packages/cli/src/team/protocol.js';
import { Controller, teamMutationBarrierReason } from '../../packages/cli/src/controller/controller.js';
import type { JournalEvent } from '../../packages/cli/src/state/types.js';
import { GateRegistry, gateDefinitionFingerprint } from '../../packages/cli/src/gates/registry.js';
import { GateRunner } from '../../packages/cli/src/gates/runner.js';
import { canonicalTreeHash } from '../../packages/cli/src/repository/tree-hash.js';

const repository = resolve(import.meta.dirname, '../..');
const executable = join(repository, 'packages/cli/dist/index.js');
const temporary: string[] = [];
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const issuedAt = () => new Date(Date.now() - 60_000).toISOString();
const expiresAt = () => new Date(Date.now() + 60 * 60_000).toISOString();

type Envelope = { ok: boolean; code: string; state: any; errors: Array<{ code: string; message: string }> };
function cli(root: string, ...args: string[]): { status: number; envelope: Envelope } {
  const output = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 20_000, env: { ...process.env, CODEX_SANDBOX: 'seatbelt', CODEX_SANDBOX_NETWORK_DISABLED: '1' } });
  expect(output.error, output.error?.message).toBeUndefined();
  expect(output.stderr).toBe('');
  return { status: output.status ?? 9, envelope: JSON.parse(output.stdout.trim()) as Envelope };
}
function rawCli(...args: string[]): { status: number; envelope: Envelope } {
  const output = spawnSync(process.execPath, [executable, ...args], { cwd: repository, encoding: 'utf8', timeout: 20_000 });
  expect(output.error, output.error?.message).toBeUndefined();
  expect(output.stderr).toBe('');
  return { status: output.status ?? 9, envelope: JSON.parse(output.stdout.trim()) as Envelope };
}
async function concurrentCli(root: string, args: string[]): Promise<{ status: number; envelope: Envelope }> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); }); child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject); child.on('close', (status) => {
      try { expect(stderr).toBe(''); resolveResult({ status: status ?? 9, envelope: JSON.parse(stdout.trim()) as Envelope }); }
      catch (error) { reject(error); }
    });
  });
}
function expectCode(value: ReturnType<typeof cli>, status: number, code: string): void {
  expect(value.status, JSON.stringify(value.envelope)).toBe(status); expect(value.envelope.code).toBe(code);
}
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-team-')); temporary.push(root);
  await mkdir(join(root, 'core/gates'), { recursive: true });
  await writeFile(join(root, 'core/gates/default.yaml'), YAML.stringify({ gates: [{ id: 'indeterminate-team', argv: ['/definitely/missing/leo-dev-team-gate'], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }] }));
  await writeFile(join(root, 'spec.md'), '# Team fixture\n');
  expectCode(cli(root, 'init', '--change', 'team', '--spec', 'spec.md'), 0, 'INITIALIZED');
  return root;
}
async function input(root: string, name: string, value: unknown, extension = 'json'): Promise<string> {
  const path = join(root, `${name}.${extension}`); await writeFile(path, JSON.stringify(value)); return `${name}.${extension}`;
}
function base(requestId: string, operation: unknown, revision = 0, teamId = 'architecture-team', specHash = ''): Record<string, unknown> {
  return { schemaVersion: 1, requestId, teamId, expectedRevision: revision, specHash, operation };
}
async function specHash(root: string): Promise<string> { return digest(await readFile(join(root, 'spec.md'))); }
async function advanceToExecuting(root: string): Promise<void> {
  expectCode(cli(root, 'route', '--change', 'team', '--task', 'team-task', '--gate', 'indeterminate-team'), 0, 'ROUTED_LITE');
  expectCode(cli(root, 'transition', '--change', 'team', '--scope', 'change', '--to', 'discovery'), 0, 'TRANSITIONED');
  expectCode(cli(root, 'transition', '--change', 'team', '--scope', 'change', '--to', 'spec-review'), 0, 'TRANSITIONED');
  const approvalContext = cli(root, 'status', '--change', 'team').envelope.state.approvalContext as Record<string, unknown>;
  const approval = await input(root, '.leo-dev/runtime/team/team-approval', { receiptId: 'team-approval', provenance: 'human-confirmed', actorLabel: 'test', decision: 'grant', grantedAt: issuedAt(), expiresAt: expiresAt(), changeId: 'team', scope: 'change', operationKind: 'spec-approval', ...approvalContext });
  expectCode(cli(root, 'approve', '--change', 'team', '--receipt', join(root, approval)), 0, 'RECEIPT_ACCEPTED_UNAUTHENTICATED');
  for (const state of ['spec-approved', 'task-ready', 'executing']) expectCode(cli(root, 'transition', '--change', 'team', '--scope', 'change', '--to', state), 0, 'TRANSITIONED');
}
async function record(root: string, name: string, payload: Record<string, unknown>, dryRun = false) {
  return cli(root, 'team', '--change', 'team', '--action', 'record', '--input', await input(root, name, payload), ...(dryRun ? ['--dry-run'] : []));
}
async function opened(root: string): Promise<string> {
  const hash = await specHash(root);
  expectCode(await record(root, 'open', base('open', { type: 'open', members: [{ memberId: 'architect', role: 'architecture owner', access: 'write' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'read' }] }, 0, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  return hash;
}
async function bound(root: string, hash: string): Promise<void> {
  expectCode(await record(root, 'bind-a', base('bind-a', { type: 'bind', memberId: 'architect', threadId: 'host-architect', expectedGeneration: 0, reason: 'initial host observation' }, 1, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  expectCode(await record(root, 'bind-r', base('bind-r', { type: 'bind', memberId: 'reviewer', threadId: 'host-reviewer', expectedGeneration: 0, reason: 'initial host observation' }, 2, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('projects a durable roster and correspondence without changing lifecycle state', async () => {
  const root = await fixture(); const before = cli(root, 'status', '--change', 'team').envelope.state;
  expectCode(cli(root, 'team', '--help'), 0, 'HELP');
  expect(cli(root, 'team', '--help').envelope.state).toMatchObject({ command: 'team', options: expect.arrayContaining(['--action <status|record>', '--input <path>', '--dry-run']) });
  expect(cli(root, 'claim', '--help').envelope.state).toMatchObject({ command: 'claim', options: expect.arrayContaining(['--task <id>', '--ttl <milliseconds>', '--session <session-id>', '--dry-run']) });
  expectCode(cli(root, 'team', '--change', 'team', '--action', 'status'), 0, 'TEAM_STATUS');
  const hash = await opened(root); await bound(root, hash);
  await writeFile(join(root, 'opinion.md'), 'The architecture has one writer and an independent reviewer.\n');
  const contribution = base('contribution', { type: 'message', messageId: 'opinion-1', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: { path: 'opinion.md', sha256: digest(await readFile(join(root, 'opinion.md'))) } }, 3, 'architecture-team', hash);
  expectCode(await record(root, 'contribution', contribution), 0, 'TEAM_RECORDED');
  const pending = cli(root, 'team', '--change', 'team', '--action', 'status'); expectCode(pending, 0, 'TEAM_STATUS');
  expect(pending.envelope.state.team).toMatchObject({ revision: 4, members: [{ memberId: 'architect', generation: 1 }, { memberId: 'reviewer', generation: 1 }], messages: [{ messageId: 'opinion-1', status: 'pending' }] });
  expectCode(await record(root, 'ack', base('ack', { type: 'ack', messageId: 'opinion-1', recipientGeneration: 1, hostReference: 'host-delivery-42' }, 4, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  expect(cli(root, 'team', '--change', 'team', '--action', 'status').envelope.state.team).toMatchObject({ revision: 5, messages: [{ messageId: 'opinion-1', status: 'delivered', hostReference: 'host-delivery-42' }] });
  await writeFile(join(root, 'challenge.md'), 'Please substantiate the recovery fence.\n');
  const artifact = { path: 'challenge.md', sha256: digest(await readFile(join(root, 'challenge.md'))) };
  expectCode(await record(root, 'challenge', base('challenge', { type: 'message', messageId: 'challenge-1', kind: 'challenge', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact }, 5, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  expectCode(await record(root, 'response', base('response', { type: 'message', messageId: 'response-1', kind: 'response', fromMemberId: 'reviewer', fromGeneration: 1, toMemberId: 'architect', toGeneration: 1, artifact, replyTo: 'challenge-1' }, 6, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  expectCode(await record(root, 'handoff', base('handoff', { type: 'message', messageId: 'handoff-1', kind: 'handoff', fromMemberId: 'reviewer', fromGeneration: 1, toMemberId: 'architect', toGeneration: 1, artifact }, 7, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  expectCode(await record(root, 'recover', base('recover', { type: 'bind', memberId: 'architect', threadId: 'host-architect-recovered', expectedGeneration: 1, reason: 'host reported lost member', handoffMessageId: 'handoff-1' }, 8, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  expect(cli(root, 'team', '--change', 'team', '--action', 'status').envelope.state.team).toMatchObject({ revision: 9, members: expect.arrayContaining([expect.objectContaining({ memberId: 'architect', generation: 2, threadId: 'host-architect-recovered' })]) });
  expectCode(await record(root, 'fenced-ack', base('fenced-ack', { type: 'ack', messageId: 'challenge-1', recipientGeneration: 1, hostReference: 'late-host-ref' }, 9, 'architecture-team', hash)), 5, 'CONFLICT');
  expectCode(await record(root, 'thread-reuse', base('thread-reuse', { type: 'bind', memberId: 'reviewer', threadId: 'host-architect', expectedGeneration: 1, reason: 'invalid reuse', handoffMessageId: 'handoff-1' }, 9, 'architecture-team', hash)), 5, 'CONFLICT');
  const after = cli(root, 'status', '--change', 'team').envelope.state;
  expect(after).toMatchObject({ changeState: before.changeState, tasks: before.tasks, runs: before.runs, leases: before.leases });
}, 30_000);

test('is idempotent and refuses altered identities, bad lineage, stale specifications and unsafe artifacts', async () => {
  const root = await fixture(); const hash = await opened(root); await bound(root, hash);
  await writeFile(join(root, 'opinion.md'), 'Original engineering opinion.\n');
  const payload = base('same', { type: 'message', messageId: 'm1', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: { path: 'opinion.md', sha256: digest(await readFile(join(root, 'opinion.md'))) } }, 3, 'architecture-team', hash);
  expectCode(await record(root, 'm1', payload), 0, 'TEAM_RECORDED');
  const journal = join(root, '.leo-dev/runtime/team/journal.ndjson'); const bytes = await readFile(journal, 'utf8');
  expectCode(await record(root, 'same-replay', payload), 0, 'TEAM_REPLAYED'); expect(await readFile(journal, 'utf8')).toBe(bytes);
  expectCode(await record(root, 'same-altered', { ...payload, operation: { ...(payload.operation as Record<string, unknown>), messageId: 'm2' } }), 5, 'CONFLICT');
  expectCode(await record(root, 'bad-response', base('bad-response', { type: 'message', messageId: 'bad', kind: 'response', fromMemberId: 'reviewer', fromGeneration: 1, toMemberId: 'architect', toGeneration: 1, artifact: { path: 'opinion.md', sha256: digest(await readFile(join(root, 'opinion.md'))) } }, 4, 'architecture-team', hash)), 2, 'VALIDATION_ERROR');
  await mkdir(join(root, 'outside')); await writeFile(join(root, 'outside', 'secret.md'), 'outside'); await symlink(join(root, 'outside', 'secret.md'), join(root, 'linked.md'));
  expectCode(await record(root, 'symlink', base('symlink', { type: 'message', messageId: 'linked', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: { path: 'linked.md', sha256: digest('outside') } }, 4, 'architecture-team', hash)), 2, 'VALIDATION_ERROR');
  await writeFile(join(root, 'spec.md'), '# Drifted\n');
  expectCode(cli(root, 'team', '--change', 'team', '--action', 'status'), 0, 'TEAM_STATUS');
  expect(cli(root, 'team', '--change', 'team', '--action', 'status').envelope.state).toMatchObject({ stale: true });
  expectCode(await record(root, 'stale', base('stale', { type: 'ack', messageId: 'm1', recipientGeneration: 1, hostReference: 'delivery' }, 4, 'architecture-team', hash)), 5, 'CONFLICT');
}, 30_000);

test('lost-member recovery consumes a current-generation handoff whose artifact still matches', async () => {
  const root = await fixture(); const hash = await opened(root); await bound(root, hash);
  await writeFile(join(root, 'handoff.md'), 'Recover architect generation one.\n');
  const firstArtifact = { path: 'handoff.md', sha256: digest(await readFile(join(root, 'handoff.md'))) };
  expectCode(await record(root, 'handoff-one', base('handoff-one', { type: 'message', messageId: 'handoff-one', kind: 'handoff', fromMemberId: 'reviewer', fromGeneration: 1, toMemberId: 'architect', toGeneration: 1, artifact: firstArtifact }, 3, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  expectCode(await record(root, 'recover-one', base('recover-one', { type: 'bind', memberId: 'architect', threadId: 'host-architect-two', expectedGeneration: 1, reason: 'first replacement', handoffMessageId: 'handoff-one' }, 4, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  expectCode(await record(root, 'stale-handoff', base('stale-handoff', { type: 'bind', memberId: 'architect', threadId: 'host-architect-three', expectedGeneration: 2, reason: 'old generation must not recover again', handoffMessageId: 'handoff-one' }, 5, 'architecture-team', hash)), 5, 'CONFLICT');
  await writeFile(join(root, 'handoff-current.md'), 'Recover architect generation two.\n');
  const currentArtifact = { path: 'handoff-current.md', sha256: digest(await readFile(join(root, 'handoff-current.md'))) };
  expectCode(await record(root, 'handoff-two', base('handoff-two', { type: 'message', messageId: 'handoff-two', kind: 'handoff', fromMemberId: 'reviewer', fromGeneration: 1, toMemberId: 'architect', toGeneration: 2, artifact: currentArtifact }, 5, 'architecture-team', hash)), 0, 'TEAM_RECORDED');
  await writeFile(join(root, 'handoff-current.md'), 'The original handoff artifact was replaced.\n');
  expectCode(await record(root, 'changed-handoff', base('changed-handoff', { type: 'bind', memberId: 'architect', threadId: 'host-architect-three', expectedGeneration: 2, reason: 'artifact must still match', handoffMessageId: 'handoff-two' }, 6, 'architecture-team', hash)), 5, 'CONFLICT');
}, 30_000);

test('does not mistake a global option value for a command while resolving help', () => {
  // Mutant caught: argv.find identifies any value equal to a command name as the selected command.
  expectCode(rawCli('--repo', 'team', 'status', '--help'), 0, 'HELP');
  expect(rawCli('--repo', 'team', 'status', '--help').envelope.state).toMatchObject({ command: 'status' });
  expect(rawCli('--repo', 'team', '--help').envelope.state).not.toHaveProperty('command');
});

test('rejects controller-owned runtime files while retaining ordinary runtime correspondence artifacts', async () => {
  // Mutant caught: validating only a supplied hash accepts a controller projection that the record itself rewrites.
  const root = await fixture(); const hash = await opened(root); await bound(root, hash);
  const runtime = join(root, '.leo-dev/runtime/team');
  await writeFile(join(runtime, 'team-opinion.md'), 'A regular runtime correspondence artifact.\n');
  const regular = base('runtime-opinion', { type: 'message', messageId: 'runtime-opinion', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: { path: '.leo-dev/runtime/team/team-opinion.md', sha256: digest(await readFile(join(runtime, 'team-opinion.md'))) } }, 3, 'architecture-team', hash);
  expectCode(await record(root, 'runtime-opinion', regular, true), 0, 'DRY_RUN');
  for (const path of ['snapshot.json', 'SNAPSHOT.JSON', 'journal.ndjson', 'lease.json']) {
    const absolute = join(runtime, path);
    try { await readFile(absolute); } catch { await writeFile(absolute, 'controller-owned mutable state\n'); }
    const controlled = base(`controlled-${path.replaceAll('.', '-')}`, { type: 'message', messageId: `controlled-${path.replaceAll('.', '-')}`, kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: { path: `.leo-dev/runtime/team/${path}`, sha256: digest(await readFile(absolute)) } }, 3, 'architecture-team', hash);
    expectCode(await record(root, `controlled-${path.replaceAll('.', '-')}`, controlled, true), 2, 'VALIDATION_ERROR');
  }
  const journal = join(runtime, 'journal.ndjson');
  const events = (await new Journal(journal).replayStrict()).events;
  const lockPath = join(runtime, 'journal.ndjson.lock'); await writeFile(lockPath, 'controller lock marker\n');
  const locked = base('controlled-lock', { type: 'message', messageId: 'controlled-lock', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: { path: '.leo-dev/runtime/team/journal.ndjson.lock', sha256: digest(await readFile(lockPath)) } }, 3, 'architecture-team', hash);
  await expect(planTeamRecord(root, events, hash, locked as any)).rejects.toMatchObject({ kind: 'validation' });
});

test('uses revision CAS so concurrent records have one winner and one conflict', async () => {
  // Mutant caught: appending from a stale event snapshot lets two revision-3 records commit.
  const root = await fixture(); const hash = await opened(root); await bound(root, hash);
  await writeFile(join(root, 'opinion.md'), 'Concurrent review input.\n');
  const artifact = { path: 'opinion.md', sha256: digest(await readFile(join(root, 'opinion.md'))) };
  const first = base('concurrent-one', { type: 'message', messageId: 'concurrent-one', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact }, 3, 'architecture-team', hash);
  const second = base('concurrent-two', { type: 'message', messageId: 'concurrent-two', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact }, 3, 'architecture-team', hash);
  const firstPath = await input(root, 'concurrent-one', first); const secondPath = await input(root, 'concurrent-two', second);
  const outcomes = await Promise.all([concurrentCli(root, ['team', '--change', 'team', '--action', 'record', '--input', firstPath]), concurrentCli(root, ['team', '--change', 'team', '--action', 'record', '--input', secondPath])]);
  expect(outcomes.filter((outcome) => outcome.status === 0 && outcome.envelope.code === 'TEAM_RECORDED')).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.status === 5 && outcome.envelope.code === 'CONFLICT')).toHaveLength(1);
  expect(cli(root, 'team', '--change', 'team', '--action', 'status').envelope.state.team).toMatchObject({ revision: 4, messages: [expect.any(Object)] });
}, 30_000);

test('applies strict writer and artifact validation identically in dry-run without ledger writes', async () => {
  // Mutant caught: accepting an invalid record in dry-run or after a partial validation mutates the journal.
  const root = await fixture(); const hash = await specHash(root); const journal = join(root, '.leo-dev/runtime/team/journal.ndjson');
  const original = await readFile(journal, 'utf8');
  const zeroWriters = base('zero-writers', { type: 'open', members: [{ memberId: 'architect', role: 'architecture owner', access: 'read' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'read' }] }, 0, 'architecture-team', hash);
  expectCode(await record(root, 'zero-writers', zeroWriters, true), 0, 'DRY_RUN'); expect(await readFile(journal, 'utf8')).toBe(original);
  const multipleWriters = base('multiple-writers', { type: 'open', members: [{ memberId: 'architect', role: 'architecture owner', access: 'write' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'write' }] }, 0, 'architecture-team', hash);
  expectCode(await record(root, 'multiple-writers', multipleWriters, true), 2, 'VALIDATION_ERROR');
  expectCode(await record(root, 'open-extra-field', { ...zeroWriters, unexpected: true }, true), 2, 'VALIDATION_ERROR');
  await writeFile(join(root, 'broken.json'), '{'); await writeFile(join(root, 'broken.yaml'), 'operation: [');
  expectCode(cli(root, 'team', '--change', 'team', '--action', 'record', '--input', 'broken.json', '--dry-run'), 2, 'VALIDATION_ERROR');
  expectCode(cli(root, 'team', '--change', 'team', '--action', 'record', '--input', 'broken.yaml', '--dry-run'), 2, 'VALIDATION_ERROR');
  expect(await readFile(journal, 'utf8')).toBe(original);

  await opened(root); await bound(root, hash); const beforeArtifacts = await readFile(journal, 'utf8');
  await writeFile(join(root, 'opinion.md'), 'Typed engineering correspondence.\n');
  await writeFile(join(root, 'large.md'), Buffer.alloc(32 * 1024 + 1, 'x'));
  const validArtifact = { path: 'opinion.md', sha256: digest(await readFile(join(root, 'opinion.md'))) };
  const invalid = [
    ['wrong-hash', { ...validArtifact, sha256: '0'.repeat(64) }, 1, 2],
    ['traversal', { path: '../opinion.md', sha256: validArtifact.sha256 }, 1, 2],
    ['oversize', { path: 'large.md', sha256: digest(await readFile(join(root, 'large.md'))) }, 1, 2],
    ['unknown-generation', validArtifact, 2, 5],
  ] as const;
  for (const [name, artifact, generation, status] of invalid) {
    const value = base(`invalid-${name}`, { type: 'message', messageId: `invalid-${name}`, kind: 'contribution', fromMemberId: 'architect', fromGeneration: generation, toMemberId: 'reviewer', toGeneration: 1, artifact }, 3, 'architecture-team', hash);
    expectCode(await record(root, `invalid-${name}`, value, true), status, status === 2 ? 'VALIDATION_ERROR' : 'CONFLICT');
  }
  const validDryRun = base('valid-dry-run', { type: 'message', messageId: 'valid-dry-run', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: validArtifact }, 3, 'architecture-team', hash);
  expectCode(await record(root, 'valid-dry-run', validDryRun, true), 0, 'DRY_RUN'); expect(await readFile(journal, 'utf8')).toBe(beforeArtifacts);
}, 40_000);

test('does not repair or append a corrupt or incomplete journal during a team record', async () => {
  // Mutant caught: a team preflight uses repairing replay and silently changes unsafe controller evidence.
  for (const tail of ['{"incomplete":', 'not a journal frame\n']) {
    const root = await fixture(); const hash = await specHash(root); const journal = join(root, '.leo-dev/runtime/team/journal.ndjson');
    const before = await readFile(journal, 'utf8'); await writeFile(journal, `${before}${tail}`); const unsafe = await readFile(journal, 'utf8');
    const open = base(`unsafe-${tail.length}`, { type: 'open', members: [{ memberId: 'architect', role: 'architecture owner', access: 'write' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'read' }] }, 0, 'architecture-team', hash);
    expectCode(await record(root, `unsafe-${tail.length}`, open), 7, 'BLOCKED'); expect(await readFile(journal, 'utf8')).toBe(unsafe);
  }
}, 30_000);

test('refuses a pending controller batch without repairing or appending team evidence', async () => {
  // Mutant caught: team records through an unfinished controller batch or invokes normal batch recovery.
  const root = await fixture(); const hash = await specHash(root);
  const open = base('pending-open', { type: 'open', members: [{ memberId: 'architect', role: 'architecture owner', access: 'write' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'read' }] }, 0, 'architecture-team', hash);
  const openInput = await input(root, 'pending-open', open);
  await expect(new Controller().execute('team', { repo: root, change: 'team', action: 'record', input: openInput, faultAt: 'after-batch-prepared' })).rejects.toMatchObject({ publicCode: 'INTERNAL_ERROR' });
  const journal = join(root, '.leo-dev/runtime/team/journal.ndjson'); const pending = await readFile(journal, 'utf8');
  const blocked = await record(root, 'blocked-pending', { ...open, requestId: 'blocked-pending' });
  expectCode(blocked, 7, 'BLOCKED'); expect(await readFile(journal, 'utf8')).toBe(pending);
}, 30_000);

test('clears an aborted recovery barrier only after the successor settles', () => {
  // The normal terminal/controller-handoff validation stays in readEvents; this
  // isolates the narrower phase-order fence so an older abort cannot outlive a
  // settled successor.
  const phase = (type: string, attemptId: string) => ({ type, payload: { attemptId } }) as JournalEvent;
  expect(teamMutationBarrierReason([phase('gate.attempt.prepared', 'prior'), phase('gate.attempt.aborted', 'prior')])).toContain('in progress');
  expect(teamMutationBarrierReason([phase('gate.attempt.prepared', 'prior'), phase('gate.attempt.aborted', 'prior'), phase('gate.attempt.prepared', 'successor')])).toContain('in progress');
  expect(teamMutationBarrierReason([phase('gate.attempt.prepared', 'prior'), phase('gate.attempt.aborted', 'prior'), phase('gate.attempt.prepared', 'successor'), phase('gate.attempt.settled', 'successor')])).toBeUndefined();
});

test('clears a standalone indeterminate Gate phase only for its exact terminal reconciled Run', () => {
  // Mutants caught: any terminal Run clears the phase; a duplicate/wrong context
  // clears it; or terminal states outside the reconciliation contract clear it.
  const event = (type: string, payload: Record<string, unknown>, eventHash: string) => ({ type, payload, eventHash }) as JournalEvent;
  const prepared = event('gate.attempt.prepared', { attemptId: 'attempt', runId: 'reconciled-run' }, 'a'.repeat(64));
  const context = event('run.unknown.context', { runId: 'reconciled-run', evidenceHashes: [prepared.eventHash] }, 'b'.repeat(64));
  const succeeded = event('run.transition', { runId: 'reconciled-run', from: 'unknown', to: 'succeeded' }, 'c'.repeat(64));
  expect(teamMutationBarrierReason([prepared, context, succeeded])).toBeUndefined();
  expect(teamMutationBarrierReason([prepared, succeeded])).toContain('in progress');
  expect(teamMutationBarrierReason([prepared, event('run.unknown.context', { runId: 'reconciled-run', evidenceHashes: ['d'.repeat(64)] }, 'e'.repeat(64)), succeeded])).toContain('in progress');
  expect(teamMutationBarrierReason([prepared, context, { ...context, eventHash: 'f'.repeat(64) }, succeeded])).toContain('in progress');
  expect(teamMutationBarrierReason([prepared, context, event('run.transition', { runId: 'reconciled-run', from: 'unknown', to: 'timed-out' }, '1'.repeat(64))])).toContain('in progress');
  expect(teamMutationBarrierReason([prepared, context, succeeded, event('run.transition', { runId: 'other-run', from: 'running', to: 'unknown' }, '2'.repeat(64))])).toContain('unresolved unknown');
});

test('admits team records after public reconciliation closes a real standalone indeterminate Gate history', async () => {
  // Mutant caught: the raw prepared/started/released phase permanently fences a
  // verified standalone unknown even after its public reconciliation is terminal.
  const root = await fixture();
  await advanceToExecuting(root);
  expectCode(cli(root, 'claim', '--change', 'team', '--task', 'team-task'), 0, 'CLAIMED');
  const hash = await specHash(root);
  const open = base('reconciled-open', { type: 'open', members: [{ memberId: 'architect', role: 'architecture owner', access: 'write' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'read' }] }, 0, 'architecture-team', hash);
  const openPath = await input(root, '.leo-dev/runtime/team/reconciled-open', open);

  expectCode(cli(root, 'run-gates', '--change', 'team', '--task', 'team-task'), 7, 'BLOCKED');
  const journalPath = join(root, '.leo-dev/runtime/team/journal.ndjson');
  const beforeReconciliation = (await new Journal(journalPath).replayStrict()).events;
  const gateHashes = beforeReconciliation.filter((event) => event.type.startsWith('gate.attempt.')).map((event) => event.eventHash);
  expect(gateHashes.length).toBeGreaterThan(0);
  expectCode(cli(root, 'team', '--change', 'team', '--action', 'record', '--input', openPath), 7, 'BLOCKED');
  expectCode(cli(root, 'team', '--change', 'team', '--action', 'record', '--input', openPath, '--dry-run'), 7, 'BLOCKED');

  const unknownState = cli(root, 'status', '--change', 'team');
  expectCode(unknownState, 0, 'STATUS');
  const context = unknownState.envelope.state.reconciliationContext as Record<string, unknown>;
  const reconciliationPath = await input(root, '.leo-dev/runtime/team/reconciliation', {
    receiptId: 'team-reconciliation',
    runId: context.runId,
    taskId: context.taskId,
    taskRevision: context.taskRevision,
    leaseGeneration: context.leaseGeneration,
    operationFingerprint: context.operationFingerprint,
    inputTreeHash: context.inputTreeHash,
    evidenceHashes: context.evidenceHashes,
    resolvedRunState: 'succeeded',
    sideEffectDisposition: 'completed',
    safeToRetry: false,
    provenance: 'human-confirmed',
    actorLabel: 'test',
    timestamp: issuedAt(),
    expiresAt: expiresAt(),
  });
  expectCode(cli(root, 'reconcile', '--change', 'team', '--receipt', join(root, reconciliationPath)), 0, 'RUN_RECONCILED_UNAUTHENTICATED');
  const reconciledLifecycle = cli(root, 'status', '--change', 'team').envelope.state;
  expect(reconciledLifecycle).toMatchObject({ changeState: 'executing', tasks: { 'team-task': { state: 'verifying' } }, runs: { [String(context.runId)]: { state: 'succeeded' } } });

  expectCode(cli(root, 'team', '--change', 'team', '--action', 'record', '--input', openPath, '--dry-run'), 0, 'DRY_RUN');
  expectCode(cli(root, 'team', '--change', 'team', '--action', 'record', '--input', openPath), 0, 'TEAM_RECORDED');
  const afterTeam = (await new Journal(journalPath).replayStrict()).events;
  expect(afterTeam.filter((event) => event.type.startsWith('gate.attempt.')).map((event) => event.eventHash)).toEqual(gateHashes);
  expect(cli(root, 'status', '--change', 'team').envelope.state).toMatchObject({ changeState: reconciledLifecycle.changeState, tasks: reconciledLifecycle.tasks, runs: reconciledLifecycle.runs });
}, 60_000);

test('refuses team mutations across an unclosed Gate attempt or unresolved unknown run', async () => {
  // Mutant caught: team only checks terminal Gate handoffs, so it can interleave
  // after GateRunner's prepared CAS and fence the started/released/settled CASes.
  const root = await fixture(); const hash = await specHash(root);
  const journalPath = join(root, '.leo-dev/runtime/team/journal.ndjson');
  const open = base('barrier-open', { type: 'open', members: [{ memberId: 'architect', role: 'architecture owner', access: 'write' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'read' }] }, 0, 'architecture-team', hash);
  let releaseGate!: () => void;
  const gateReleased = new Promise<void>((resolveGate) => { releaseGate = resolveGate; });
  let preparedGate!: () => void;
  const gatePrepared = new Promise<void>((resolveGate) => { preparedGate = resolveGate; });
  await input(root, '.leo-dev/runtime/team/barrier-open-real', open);
  await input(root, '.leo-dev/runtime/team/barrier-open-dry', open);
  const registry = new GateRegistry([{ id: 'team-barrier', argv: [process.execPath, '-e', "process.stdout.write('ok')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
  const gate = registry.get('team-barrier'); const tree = await canonicalTreeHash(root);
  const gateRun = new GateRunner({ networkIsolation: { async prepare(command, args) { return { command, args, fingerprint: 'a'.repeat(64) }; } }, attemptLifecycle: { async afterPrepared() { preparedGate(); await gateReleased; } } });
  const running = gateRun.run({ repositoryRoot: root, registry, gateId: gate.id, expectedInputTreeHash: tree.hash, expectedGateDefinitionHash: gateDefinitionFingerprint(gate), runId: 'team-barrier-run', changeId: 'team', taskId: 'team-barrier-task', taskRevision: 1, leaseGeneration: 1, maxOutputBytes: 1024 });
  const gateSettlement = running.then((value) => ({ value }), (error: unknown) => ({ error }));
  let assertionError: unknown;
  try {
    const preparedOrSettled = await Promise.race([gatePrepared.then(() => 'prepared' as const), gateSettlement.then((settled) => ({ settled }))]);
    if (preparedOrSettled !== 'prepared') {
      if ('error' in preparedOrSettled.settled) throw preparedOrSettled.settled.error;
      throw new Error('Gate settled before reaching its prepared boundary');
    }
    const preparedBytes = await readFile(journalPath, 'utf8');
    expectCode(await record(root, '.leo-dev/runtime/team/barrier-open-real', open), 7, 'BLOCKED');
    expectCode(await record(root, '.leo-dev/runtime/team/barrier-open-dry', open, true), 7, 'BLOCKED');
    expect(await readFile(journalPath, 'utf8')).toBe(preparedBytes);
  } catch (error: unknown) { assertionError = error; }
  finally { releaseGate(); }
  const settledGate = await gateSettlement;
  if (assertionError) throw assertionError;
  expect(settledGate).toMatchObject({ value: { status: 'succeeded' } });

  const unknownRoot = await fixture(); const unknownHash = await specHash(unknownRoot);
  const unknownJournalPath = join(unknownRoot, '.leo-dev/runtime/team/journal.ndjson'); const unknownJournal = new Journal(unknownJournalPath);
  await unknownJournal.append({ changeId: 'team', type: 'run.transition', payload: { runId: 'unknown-run', from: 'running', to: 'unknown' } });
  const unknownOpen = base('unknown-open', { type: 'open', members: [{ memberId: 'architect', role: 'architecture owner', access: 'write' }, { memberId: 'reviewer', role: 'independent reviewer', access: 'read' }] }, 0, 'architecture-team', unknownHash);
  const unknownBytes = await readFile(unknownJournalPath, 'utf8');
  expectCode(await record(unknownRoot, 'unknown-open-real', unknownOpen), 7, 'BLOCKED');
  expectCode(await record(unknownRoot, 'unknown-open-dry', unknownOpen, true), 7, 'BLOCKED');
  expect(await readFile(unknownJournalPath, 'utf8')).toBe(unknownBytes);

  await unknownJournal.append({ changeId: 'team', type: 'run.transition', payload: { runId: 'unknown-run', from: 'unknown', to: 'abandoned' } });
  expectCode(await record(unknownRoot, 'unknown-open-resolved', unknownOpen), 0, 'TEAM_RECORDED');
}, 30_000);

test('rejects invalid roster cardinality and parsed input shapes without changing controller artifacts', async () => {
  const root = await fixture(); const hash = await specHash(root);
  const protectedPaths = ['.leo-dev/runtime/team/journal.ndjson', '.leo-dev/runtime/team/snapshot.json'];
  const before = await Promise.all(protectedPaths.map((path) => readFile(join(root, path), 'utf8')));
  const members = Array.from({ length: 13 }, (_, index) => ({ memberId: `member-${index}`, role: `independent role ${index}`, access: 'read' }));
  const invalid: unknown[] = [
    base('empty', { type: 'open', members: [] }, 0, 'architecture-team', hash),
    base('single', { type: 'open', members: members.slice(0, 1) }, 0, 'architecture-team', hash),
    base('too-many', { type: 'open', members }, 0, 'architecture-team', hash),
    base('duplicate', { type: 'open', members: [members[0], members[0]] }, 0, 'architecture-team', hash),
    base('member-extra', { type: 'open', members: [{ ...members[0], unexpected: true }, members[1]] }, 0, 'architecture-team', hash),
    base('bad-operation-shape', [], 0, 'architecture-team', hash),
    null, [], true, 'not an object', {},
  ];
  for (const [index, value] of invalid.entries()) {
    const path = await input(root, `shape-${index}`, value);
    for (const flags of [[], ['--dry-run']]) {
      expectCode(cli(root, 'team', '--change', 'team', '--action', 'record', '--input', path, ...flags), 2, 'VALIDATION_ERROR');
      expect(await Promise.all(protectedPaths.map((file) => readFile(join(root, file), 'utf8')))).toEqual(before);
    }
  }
  await writeFile(join(root, 'sequence.yaml'), '- parsed\n- sequence\n');
  expectCode(cli(root, 'team', '--change', 'team', '--action', 'record', '--input', 'sequence.yaml', '--dry-run'), 2, 'VALIDATION_ERROR');
  const maximum = base('maximum-valid', { type: 'open', members: members.slice(0, 12) }, 0, 'architecture-team', hash);
  const preview = await record(root, 'maximum-valid', maximum, true);
  expectCode(preview, 0, 'DRY_RUN'); expect(preview.envelope.state.team.members).toHaveLength(12);
  expect(await Promise.all(protectedPaths.map((file) => readFile(join(root, file), 'utf8')))).toEqual(before);
  expect(cli(root, 'team', '--change', 'team', '--action', 'status').envelope.state.team).toBeNull();
}, 30_000);

test('rejects an escaping artifact symlink and unknown members without recording lifecycle evidence', async () => {
  const root = await fixture(); const hash = await opened(root); await bound(root, hash);
  const lifecycle = cli(root, 'status', '--change', 'team'); expectCode(lifecycle, 0, 'STATUS');
  expect(lifecycle.envelope.state).toMatchObject({ changeState: 'triage', tasks: {}, runs: {}, leases: {}, attempts: {}, reviewContext: null });
  const snapshot = join(root, '.leo-dev/runtime/team/snapshot.json'); const snapshotBefore = await readFile(snapshot, 'utf8');
  const outside = await mkdtemp(join(tmpdir(), 'leo-dev-team-outside-')); temporary.push(outside);
  const external = join(outside, 'opinion.md'); await writeFile(external, 'Outside fixture bytes remain untouched.\n');
  await symlink(external, join(root, 'escape.md'));
  await writeFile(join(root, 'opinion.md'), 'A contained independent opinion.\n');
  const journal = join(root, '.leo-dev/runtime/team/journal.ndjson'); const before = await readFile(journal, 'utf8');
  const externalBytes = await readFile(external, 'utf8');
  const escaped = base('escaping-link', { type: 'message', messageId: 'escaping-link', kind: 'contribution', fromMemberId: 'architect', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: { path: 'escape.md', sha256: digest(externalBytes) } }, 3, 'architecture-team', hash);
  const unknown = base('unknown-member', { type: 'message', messageId: 'unknown-member', kind: 'contribution', fromMemberId: 'missing-member', fromGeneration: 1, toMemberId: 'reviewer', toGeneration: 1, artifact: { path: 'opinion.md', sha256: digest(await readFile(join(root, 'opinion.md'))) } }, 3, 'architecture-team', hash);
  for (const dryRun of [false, true]) {
    expectCode(await record(root, `escaping-${dryRun}`, escaped, dryRun), 2, 'VALIDATION_ERROR');
    expectCode(await record(root, `unknown-${dryRun}`, unknown, dryRun), 5, 'CONFLICT');
    expect(await readFile(journal, 'utf8')).toBe(before); expect(await readFile(external, 'utf8')).toBe(externalBytes);
  }
  // The deliberately unsafe link prevents an ordinary whole-tree status scan.
  // Exact journal and snapshot preservation establishes no lifecycle mutation without removing that link.
  expect(await readFile(snapshot, 'utf8')).toBe(snapshotBefore);
}, 30_000);
