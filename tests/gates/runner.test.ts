import { access, appendFile, cp, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { canonicalTreeHash } from '../../packages/cli/src/repository/tree-hash.js';
import { GateRegistry, gateDefinitionFingerprint } from '../../packages/cli/src/gates/registry.js';
import { GateRunError, GateRunner, approvalFingerprintFields, runGate as untrustedRunGate, recoverGateRun, type NetworkIsolation } from '../../packages/cli/src/gates/runner.js';
import * as gateRunnerModule from '../../packages/cli/src/gates/runner.js';
import { evidenceDirectory, evidenceFilePath } from '../../packages/cli/src/gates/evidence.js';
import { gateLauncherSource } from '../../packages/cli/src/gates/launcher.js';
import { runtimePaths } from '../../packages/cli/src/runtime/paths.js';
import { Journal } from '../../packages/cli/src/state/journal.js';

const hash = (value: string) => value.repeat(64).slice(0, 64);
const node = process.execPath;
const passthroughIsolation: NetworkIsolation = {
  async prepare(command, args) { return { command, args, fingerprint: 'a'.repeat(64) }; },
};
const runner = new GateRunner({ networkIsolation: passthroughIsolation, clock: () => new Date('2026-09-04T12:00:00.000Z') });
const runGate = (request: Parameters<GateRunner['run']>[0]) => runner.run(request);

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

async function gateJournal(root: string, changeId = 'change-1') {
  return new Journal(runtimePaths(root, changeId).journal).replay();
}

async function expectJournaledUnknownWithoutEvidence(root: string, gateId: string, result: Awaited<ReturnType<GateRunner['run']>>) {
  const outcome = { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' };
  expect(result).toMatchObject({ status: 'unknown', outcome });
  expect(result).not.toHaveProperty('evidence');
  expect((await gateJournal(root)).events.at(-1)).toMatchObject({ type: 'gate.attempt.settled', payload: { status: 'unknown', outcome } });
  const directory = join(root, evidenceDirectory('change-1', 'run-1', gateId));
  for (const file of ['stdout.log', 'stderr.log', 'evidence.json']) {
    await expect(access(join(directory, file))).rejects.toMatchObject({ code: 'ENOENT' });
  }
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'leo-dev-gate-'));
  await writeFile(join(root, 'input.txt'), 'initial');
  const registry = new GateRegistry([
    { id: 'ok', argv: [node, '-e', "process.stdout.write(process.env.UNRELATED || 'minimal')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] },
    { id: 'write-build', argv: [node, '-e', "require('fs').mkdirSync('build',{recursive:true});require('fs').writeFileSync('build/out.txt','ok')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['build'] },
    { id: 'undeclared-write', argv: [node, '-e', "require('fs').writeFileSync('source.txt','changed')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] },
    { id: 'timeout', argv: [node, '-e', 'setTimeout(() => {}, 1000)'], cwd: '.', timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] },
    { id: 'large-output', argv: [node, '-e', "process.stdout.write('x'.repeat(256))"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] },
    { id: 'secret', argv: [node, '-e', "process.stdout.write('token=sk-abcdefghijklmnopqrstuvwxyz123456')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] },
    { id: 'residual-secret', argv: [node, '-e', "process.stdout.write('password=super-secret-value')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] },
    { id: 'approved', argv: [node, '-e', "process.stdout.write('approved')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'idempotent', effectClass: 'network-read', network: 'approval-required', environmentAllowlist: [], declaredWritePaths: [] },
    { id: 'failed', argv: [node, '-e', "process.stderr.write('failed output');process.exit(4)"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] },
  ]);
  return { root, registry };
}

async function request(root: string, registry: GateRegistry, gateId = 'ok') {
  const input = await canonicalTreeHash(root);
  const gate = registry.get(gateId === 'missing' ? 'ok' : gateId);
  return { repositoryRoot: root, registry, gateId, expectedInputTreeHash: input.hash, expectedGateDefinitionHash: gateDefinitionFingerprint(gate), runId: 'run-1', changeId: 'change-1', taskId: 'task-1', taskRevision: 1, leaseGeneration: 1, maxOutputBytes: 128 };
}

describe('reviewed gate runner', () => {
  test('shares a read-only preflight with run before any gate side effects', async () => {
    const { root, registry } = await fixture();
    const invocationPath = join(root, 'gate-invoked');
    const checkedRegistry = new GateRegistry([{ id: 'checked', argv: [node, '-e', `require('fs').writeFileSync(${JSON.stringify(invocationPath)}, 'invoked')`], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const prepareCalls: Array<{ command: string; args: readonly string[] }> = [];
    const checkedRunner = new GateRunner({
      clock: () => new Date('2026-09-04T12:00:00.000Z'),
      networkIsolation: {
        async prepare(command, args) {
          prepareCalls.push({ command, args });
          return { command, args: [...args], fingerprint: 'b'.repeat(64) };
        },
      },
    });
    const checkedRequest = await request(root, checkedRegistry, 'checked');
    const before = await canonicalTreeHash(root);

    const context = await checkedRunner.preflight(checkedRequest);

    expect(context).toMatchObject({ gate: { id: 'checked' }, canonicalRoot: await realpath(root) });
    expect(JSON.stringify(context)).not.toContain('approvalReceipt');
    expect(prepareCalls).toEqual([{ command: node, args: ['-e', expect.any(String)] }]);
    expect(await canonicalTreeHash(root)).toEqual(before);
    await expect(access(invocationPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(runtimePaths(root, checkedRequest.changeId).journal)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(join(root, evidenceDirectory(checkedRequest.changeId, checkedRequest.runId, 'checked')))).rejects.toMatchObject({ code: 'ENOENT' });

    await expect(checkedRunner.run(checkedRequest)).resolves.toMatchObject({ status: 'undeclared-writes' });
    expect(prepareCalls).toHaveLength(2);
    await expect(readFile(invocationPath, 'utf8')).resolves.toBe('invoked');
  });

  test.each([
    {
      label: 'platform containment',
      make: async () => {
        const { root, registry } = await fixture();
        return { runner: new GateRunner({ platform: 'win32', networkIsolation: passthroughIsolation }), request: await request(root, registry), code: 'PROCESS_CONTAINMENT_UNAVAILABLE' };
      },
    },
    {
      label: 'reviewed gate shape',
      make: async () => {
        const { root, registry } = await fixture();
        const base = await request(root, registry);
        return { runner, request: { ...base, registry: { get: () => ({ id: 'bad', argv: ['node', 1], cwd: '.', declaredWritePaths: [] }) } as never }, code: 'GATE_INVALID' };
      },
    },
    {
      label: 'maximum output size',
      make: async () => {
        const { root, registry } = await fixture();
        return { runner, request: { ...(await request(root, registry)), maxOutputBytes: 0 }, code: 'GATE_INVALID' };
      },
    },
    {
      label: 'working-directory containment',
      make: async () => {
        const { root } = await fixture();
        const outside = await mkdtemp(join(tmpdir(), 'leo-dev-gate-outside-'));
        const registry = new GateRegistry([{ id: 'cwd-escape', argv: [node, '-e', 'process.exit(0)'], cwd: 'linked', timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
        const gateRequest = await request(root, registry, 'cwd-escape');
        await symlink(outside, join(root, 'linked'));
        return { runner, request: gateRequest, code: 'PATH_ESCAPE' };
      },
    },
    {
      label: 'declared write containment',
      make: async () => {
        const { root } = await fixture();
        const outside = await mkdtemp(join(tmpdir(), 'leo-dev-gate-outside-'));
        const registry = new GateRegistry([{ id: 'declared-escape', argv: [node, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['linked/output'] }]);
        const gateRequest = await request(root, registry, 'declared-escape');
        await symlink(outside, join(root, 'linked'));
        return { runner, request: gateRequest, code: 'PATH_ESCAPE' };
      },
    },
    {
      label: 'automatic write policy',
      make: async () => {
        const { root } = await fixture();
        const registry = new GateRegistry([{ id: 'automatic-write', argv: [node, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['source'] }]);
        return { runner, request: await request(root, registry, 'automatic-write'), code: 'GATE_INVALID' };
      },
    },
    {
      label: 'current input tree',
      make: async () => {
        const { root, registry } = await fixture();
        const stale = await request(root, registry);
        await writeFile(join(root, 'input.txt'), 'changed');
        return { runner, request: stale, code: 'STALE_TREE' };
      },
    },
    {
      label: 'current gate definition',
      make: async () => {
        const { root, registry } = await fixture();
        const stale = await request(root, registry);
        const changed = new GateRegistry([{ id: 'ok', argv: [node, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
        return { runner, request: { ...stale, registry: changed }, code: 'STALE_GATE' };
      },
    },
    {
      label: 'current approval receipt',
      make: async () => {
        const { root, registry } = await fixture();
        return { runner, request: await request(root, registry, 'approved'), code: 'APPROVAL_REQUIRED' };
      },
    },
    {
      label: 'approval fingerprints',
      make: async () => {
        const { root, registry } = await fixture();
        const base = await request(root, registry, 'approved');
        const fields = approvalFingerprintFields(base, registry.get('approved'), await realpath(root));
        const receipt = { receiptId: 'receipt-mismatch', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2026-09-04T11:00:00.000Z', expiresAt: '2026-09-04T13:00:00.000Z', changeId: base.changeId, taskId: base.taskId, scope: 'gate', operationKind: 'gate-run', ...fields, argvFingerprint: hash('a') };
        return { runner, request: { ...base, approvalReceipt: receipt }, code: 'APPROVAL_MISMATCH' };
      },
    },
    {
      label: 'network isolation availability',
      make: async () => {
        const { root, registry } = await fixture();
        const unavailable = new GateRunner({ networkIsolation: { async prepare() { throw new GateRunError('NETWORK_ISOLATION_UNAVAILABLE', 'not available'); } } });
        return { runner: unavailable, request: await request(root, registry), code: 'NETWORK_ISOLATION_UNAVAILABLE' };
      },
    },
  ])('applies the same $label check to public preflight and run', async ({ make }) => {
    const candidate = await make();
    await expect(candidate.runner.preflight(candidate.request)).rejects.toMatchObject({ code: candidate.code });
    await expect(candidate.runner.run(candidate.request)).rejects.toMatchObject({ code: candidate.code });
  });

  test('rejects an unknown reviewed gate ID', async () => {
    const { root, registry } = await fixture();
    await expect(runGate(await request(root, registry, 'missing'))).rejects.toMatchObject({ code: 'UNKNOWN_GATE' });
  });

  test('rejects shell command strings instead of argv arrays', () => {
    expect(() => new GateRegistry([{ id: 'shell', argv: 'echo unsafe' as never, cwd: '.', timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }])).toThrow(/argv/i);
  });

  test('rejects cwd and ancestor symlink escapes before execution', async () => {
    const { root } = await fixture();
    const outside = await mkdtemp(join(tmpdir(), 'leo-dev-gate-outside-'));
    expect(() => new GateRegistry([{ id: 'escape-parent', argv: [node, '-e', 'process.exit(0)'], cwd: '../escape', timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }])).toThrow(/cwd|path/i);
    for (const cwd of ['linked']) {
      const registry = new GateRegistry([{ id: 'escape', argv: [node, '-e', 'process.exit(0)'], cwd, timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
      const gateRequest = await request(root, registry, 'escape');
      await symlink(outside, join(root, 'linked'));
      await expect(runGate(gateRequest)).rejects.toMatchObject({ code: 'PATH_ESCAPE' });
    }
  });

  test('executes with a minimal allowlisted environment and publishes current redacted evidence', async () => {
    const { root, registry } = await fixture();
    const prior = process.env.UNRELATED;
    process.env.UNRELATED = 'must-not-leak';
    try {
      const result = await runGate(await request(root, registry));
      expect(result.status).toBe('succeeded');
      expect(result.evidence.treeHash).toBe((await canonicalTreeHash(root)).hash);
      expect(result.evidence.repositoryIdentity).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(result.evidence)).not.toContain(await realpath(root));
      expect(result.evidence).not.toHaveProperty('environment');
      await expect(readFile(join(root, result.evidence.stdoutLogPath), 'utf8')).resolves.toBe('minimal');
    } finally {
      if (prior === undefined) delete process.env.UNRELATED;
      else process.env.UNRELATED = prior;
    }
  });

  test('requires matching unexpired approval for non-automatic gates', async () => {
    const { root, registry } = await fixture();
    const base = await request(root, registry, 'approved');
    await expect(runGate(base)).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    const approval = { receiptId: 'receipt-1', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2026-09-04T00:00:00.000Z', expiresAt: '2027-09-04T00:00:00.000Z', changeId: base.changeId, taskId: base.taskId, scope: 'gate', operationKind: 'gate-run', decisionFingerprint: hash('d'), gateDefinitionFingerprint: base.expectedGateDefinitionHash, argvFingerprint: hash('a'), cwdFingerprint: hash('c'), environmentFingerprint: hash('e'), inputFingerprint: base.expectedInputTreeHash };
    await expect(runGate({ ...base, approvalReceipt: approval })).rejects.toMatchObject({ code: 'APPROVAL_MISMATCH' });
  });

  test('accepts only exact, current approvals and rejects expired or future grants', async () => {
    const { root, registry } = await fixture();
    const base = await request(root, registry, 'approved');
    const fields = approvalFingerprintFields(base, registry.get('approved'), await realpath(root));
    const receipt = { receiptId: 'receipt-exact', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2026-09-04T11:00:00.000Z', expiresAt: '2026-09-04T13:00:00.000Z', changeId: base.changeId, taskId: base.taskId, scope: 'gate', operationKind: 'gate-run', ...fields };
    await expect(runGate({ ...base, approvalReceipt: receipt })).resolves.toMatchObject({ status: 'succeeded' });
    await expect(runGate({ ...base, runId: 'expired', approvalReceipt: { ...receipt, expiresAt: '2026-09-04T11:30:00.000Z' } })).rejects.toMatchObject({ code: 'APPROVAL_MISMATCH' });
    await expect(runGate({ ...base, runId: 'future', approvalReceipt: { ...receipt, grantedAt: '2026-09-04T12:30:00.000Z', expiresAt: '2026-09-04T13:30:00.000Z' } })).rejects.toMatchObject({ code: 'APPROVAL_MISMATCH' });
  });

  test('revalidates approval with the trusted clock after launcher preflight and before releasing reviewed argv', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-gate-expiry-'));
    const invocation = join(root, 'approved-gate-ran');
    const registry = new GateRegistry([{ id: 'short-approval', argv: [node, '-e', `require('fs').writeFileSync(${JSON.stringify(invocation)}, 'ran')`], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'idempotent', effectClass: 'external-write', network: 'approval-required', environmentAllowlist: [], declaredWritePaths: ['approved-gate-ran'] }]);
    const base = await request(root, registry, 'short-approval');
    const fields = approvalFingerprintFields(base, registry.get('short-approval'), await realpath(root));
    const receipt = { receiptId: 'short-lived', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2026-09-04T11:59:00.000Z', expiresAt: '2026-09-04T12:01:00.000Z', changeId: base.changeId, taskId: base.taskId, scope: 'gate', operationKind: 'gate-run', ...fields };
    const times = [
      '2026-09-04T12:00:00.000Z', // preflight
      '2026-09-04T12:00:10.000Z', // execution start
      '2026-09-04T12:00:20.000Z', // launcher identity
      '2026-09-04T12:02:00.000Z', // release-time authority check
    ];
    const expiryRunner = new GateRunner({ networkIsolation: passthroughIsolation, clock: () => new Date(times.shift() ?? '2026-09-04T12:02:00.000Z') });

    await expect(expiryRunner.run({ ...base, approvalReceipt: receipt })).resolves.toMatchObject({
      status: 'approval-expired',
      exitCode: null,
      outcome: { runState: 'cancelled', taskState: 'blocked', changeState: 'approval-required' },
    });
    await expect(access(invocation)).rejects.toMatchObject({ code: 'ENOENT' });
    const events = (await gateJournal(root)).events;
    expect(events.map((event) => event.type)).toEqual(['gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.denied']);
    expect(events.at(-1)).toMatchObject({ payload: { reason: 'approval-expired', outcome: { runState: 'cancelled', taskState: 'blocked', changeState: 'approval-required' } } });
    await expect(access(join(root, evidenceFilePath(base.changeId, base.runId, 'short-approval')))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('treats a durable approval denial as terminal and never recovers it by rerunning argv', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-gate-expiry-recovery-'));
    const invocation = join(root, 'must-not-run');
    const registry = new GateRegistry([{ id: 'short-approval', argv: [node, '-e', `require('fs').writeFileSync(${JSON.stringify(invocation)}, 'ran')`], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'idempotent', effectClass: 'external-write', network: 'approval-required', environmentAllowlist: [], declaredWritePaths: ['must-not-run'] }]);
    const prior = await request(root, registry, 'short-approval');
    const fields = approvalFingerprintFields(prior, registry.get('short-approval'), await realpath(root));
    const receipt = { receiptId: 'short-lived-recovery', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2026-09-04T11:59:00.000Z', expiresAt: '2026-09-04T12:01:00.000Z', changeId: prior.changeId, taskId: prior.taskId, scope: 'gate', operationKind: 'gate-run', ...fields };
    const times = ['2026-09-04T12:00:00.000Z', '2026-09-04T12:00:10.000Z', '2026-09-04T12:00:20.000Z', '2026-09-04T12:02:00.000Z'];
    const expiryRunner = new GateRunner({ networkIsolation: passthroughIsolation, clock: () => new Date(times.shift() ?? '2026-09-04T12:02:00.000Z') });
    await expect(expiryRunner.run({ ...prior, approvalReceipt: receipt })).resolves.toMatchObject({ status: 'approval-expired' });
    const fresh = { ...prior, runId: 'run-after-denial', leaseGeneration: 2 };

    await expect(expiryRunner.recover({ previousRunId: prior.runId, request: fresh })).resolves.toEqual({
      restarted: false,
      outcome: { runState: 'cancelled', taskState: 'blocked', changeState: 'approval-required' },
    });
    await expect(access(invocation)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await gateJournal(root)).events.filter((event) => event.type === 'gate.attempt.prepared')).toHaveLength(1);
  });

  test('rejects timeout and output cap without publishing success evidence', async () => {
    const { root, registry } = await fixture();
    const timeout = await runGate({ ...(await request(root, registry, 'timeout')), maxOutputBytes: 128 });
    expect(timeout.status).toBe('timed-out');
    expect(timeout.evidence).toMatchObject({ runId: 'run-1', gateId: 'timeout', runStatus: 'timed-out' });
    const capped = await runGate(await request(root, registry, 'large-output'));
    expect(capped.status).toBe('output-capped');
    expect(capped.evidence.runStatus).toBe('output-capped');
  }, 5_000);

  test('publishes every stdout byte when a successful large output remains below the cap', async () => {
    const { root } = await fixture();
    const outputBytes = 8 * 1024 * 1024;
    const registry = new GateRegistry([{ id: 'large-exact-output', argv: [node, '-e', `require('fs').writeSync(1,Buffer.alloc(${outputBytes},120))`], cwd: '.', timeoutSeconds: 5, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const result = await runner.run({ ...(await request(root, registry, 'large-exact-output')), maxOutputBytes: 16 * 1024 * 1024 });

    expect(result).toMatchObject({ status: 'succeeded', evidence: { runStatus: 'succeeded' } });
    const stdout = await readFile(join(root, result.evidence.stdoutLogPath));
    expect(stdout.byteLength).toBe(outputBytes);
    expect(stdout.equals(Buffer.alloc(outputBytes, 120))).toBe(true);
  }, 15_000);

  test.each([
    { label: 'two-byte stdout', character: '¢', repetitions: 65, descriptor: 1, cap: 129, expectedText: '¢'.repeat(64) },
    { label: 'three-byte stderr', character: '€', repetitions: 43, descriptor: 2, cap: 128, expectedText: '€'.repeat(42) },
    { label: 'four-byte stdout', character: '😀', repetitions: 33, descriptor: 1, cap: 130, expectedText: '😀'.repeat(32) },
  ])('keeps a capped $label result determinate at a UTF-8 boundary', async ({ character, repetitions, descriptor, cap, expectedText }) => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'utf8-cap', argv: [node, '-e', `require('fs').writeSync(${descriptor},Buffer.from(${JSON.stringify(character)}.repeat(${repetitions})))`], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const result = await runner.run({ ...(await request(root, registry, 'utf8-cap')), maxOutputBytes: cap });

    expect(result).toMatchObject({ status: 'output-capped', evidence: { runStatus: 'output-capped' } });
    const stdout = await readFile(join(root, result.evidence.stdoutLogPath), 'utf8');
    const stderr = await readFile(join(root, result.evidence.stderrLogPath), 'utf8');
    const published = descriptor === 1 ? stdout : stderr;
    expect(published).toBe(expectedText);
    expect(Buffer.byteLength(stdout) + Buffer.byteLength(stderr)).toBeLessThanOrEqual(cap);
    expect(published).not.toContain('\uFFFD');
  });

  test('uses the first same-stream omission when the cap falls exactly on a chunk boundary', async () => {
    const { root } = await fixture();
    const firstChunk = [...Buffer.alloc(127, 120), 0xe2];
    const script = `const fs=require('fs');fs.writeSync(1,Buffer.from(${JSON.stringify(firstChunk)}));setTimeout(()=>fs.writeSync(1,Buffer.from([0x82,0xac])),50)`;
    const registry = new GateRegistry([{ id: 'utf8-chunk-boundary', argv: [node, '-e', script], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const result = await runner.run({ ...(await request(root, registry, 'utf8-chunk-boundary')), maxOutputBytes: 128 });

    expect(result).toMatchObject({ status: 'output-capped', evidence: { runStatus: 'output-capped' } });
    await expect(readFile(join(root, result.evidence.stdoutLogPath), 'utf8')).resolves.toBe('x'.repeat(127));
  });

  test('fails closed without publishing evidence when invalid bytes split a secret-shaped value', async () => {
    const { root } = await fixture();
    const invalidSecret = [
      ...Buffer.from('token=sk-abcdefghijklmnop'),
      0xff,
      ...Buffer.from('qrstuvwxyz123456'),
    ];
    const registry = new GateRegistry([{ id: 'invalid-utf8-secret', argv: [node, '-e', `require('fs').writeSync(2,Buffer.from(${JSON.stringify(invalidSecret)}))`], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const result = await runner.run({ ...(await request(root, registry, 'invalid-utf8-secret')), maxOutputBytes: 256 });

    expect(result).toEqual({ status: 'unknown', exitCode: 0, outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' } });
  });

  test.each([
    { label: 'two-byte', lead: 0xc2 },
    { label: 'three-byte', lead: 0xe2 },
    { label: 'four-byte', lead: 0xf0 },
  ])('fails closed when a capped $label lead is followed by an invalid continuation', async ({ label, lead }) => {
    const { root } = await fixture();
    const gateId = `invalid-${label}-continuation`;
    const bytes = [...Buffer.alloc(127, 120), lead, 0x41];
    const registry = new GateRegistry([{ id: gateId, argv: [node, '-e', `require('fs').writeSync(1,Buffer.from(${JSON.stringify(bytes)}))`], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const result = await runner.run({ ...(await request(root, registry, gateId)), maxOutputBytes: 128 });

    await expectJournaledUnknownWithoutEvidence(root, gateId, result);
  });

  test('does not let stderr global capping authorize an unomitted invalid stdout tail', async () => {
    const { root } = await fixture();
    const gateId = 'cross-stream-invalid-tail';
    const stdout = [...Buffer.alloc(120, 120), 0xe2];
    const script = `const fs=require('fs');fs.writeSync(1,Buffer.from(${JSON.stringify(stdout)}));setTimeout(()=>fs.writeSync(2,Buffer.alloc(16,121)),50)`;
    const registry = new GateRegistry([{ id: gateId, argv: [node, '-e', script], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const result = await runner.run({ ...(await request(root, registry, gateId)), maxOutputBytes: 128 });

    await expectJournaledUnknownWithoutEvidence(root, gateId, result);
  });

  test('returns indeterminate when a descendant keeps output pipes open past the bounded drain deadline', async () => {
    const { root } = await fixture();
    const descendant = "process.stdout.write('descendant-ready');setInterval(()=>{},1000)";
    const leader = `const {spawn}=require('child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:['ignore',1,2]});child.unref();process.stdout.write('leader-exit')`;
    const registry = new GateRegistry([{ id: 'held-output-pipe', argv: [node, '-e', leader], cwd: '.', timeoutSeconds: 5, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);

    await expect(runner.run(await request(root, registry, 'held-output-pipe'))).rejects.toMatchObject({ code: 'GATE_RECORD_INDETERMINATE', outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' } });
  }, 15_000);

  test('rejects stale expected tree and gate definition hashes', async () => {
    const { root, registry } = await fixture();
    const staleTree = await request(root, registry);
    await writeFile(join(root, 'input.txt'), 'changed');
    await expect(runGate(staleTree)).rejects.toMatchObject({ code: 'STALE_TREE' });
    const staleGate = await request(root, registry);
    const changedRegistry = new GateRegistry([{ id: 'ok', argv: [node, '-e', "process.stdout.write('changed definition')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    await expect(runGate({ ...staleGate, registry: changedRegistry })).rejects.toMatchObject({ code: 'STALE_GATE' });
  });

  test('detects writes outside declared paths', async () => {
    const { root, registry } = await fixture();
    const result = await runGate(await request(root, registry, 'undeclared-write'));
    expect(result.status).toBe('undeclared-writes');
    expect(result.undeclaredWrites).toContain('source.txt');
    expect(result.evidence.runStatus).toBe('undeclared-writes');
  });

  test('publishes bounded redacted evidence for a determinate nonzero exit', async () => {
    const { root, registry } = await fixture();
    const result = await runGate(await request(root, registry, 'failed'));
    expect(result).toMatchObject({ status: 'failed', exitCode: 4, evidence: { runStatus: 'failed', gateId: 'failed' } });
    await expect(readFile(join(root, result.evidence.stderrLogPath), 'utf8')).resolves.toContain('failed output');
  });

  test('binds successful declared writes to the post-execution tree', async () => {
    const { root, registry } = await fixture();
    const result = await runGate(await request(root, registry, 'write-build'));
    expect(result.status).toBe('succeeded');
    expect(result.evidence.inputTreeHash).not.toBe(result.evidence.treeHash);
    expect(result.evidence.treeHash).toBe((await canonicalTreeHash(root)).hash);
  });

  test('redacts known secrets and blocks publication if a secret shape survives redaction', async () => {
    const { root, registry } = await fixture();
    const redacted = await runGate(await request(root, registry, 'secret'));
    expect(redacted.status).toBe('succeeded');
    await expect(readFile(join(root, redacted.evidence.stdoutLogPath), 'utf8')).resolves.not.toMatch(/sk-/);
    const blocked = await runGate(await request(root, registry, 'residual-secret'));
    expect(blocked.status).toBe('evidence-blocked-secret');
    expect(blocked).not.toHaveProperty('evidence');
    expect(blocked.outcome).toEqual({ runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' });
  });

  test('detects ignored-path and empty-directory writes outside the exact evidence target', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([
      { id: 'ignored', argv: [node, '-e', "require('fs').mkdirSync('node_modules/new-empty',{recursive:true});require('fs').writeFileSync('node_modules/new.txt','x')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] },
    ]);
    const result = await runGate(await request(root, registry, 'ignored'));
    expect(result.status).toBe('undeclared-writes');
    expect(result.undeclaredWrites).toEqual(expect.arrayContaining(['node_modules/new-empty', 'node_modules/new.txt']));
  });

  test('derives immutable evidence paths and rejects a run/gate collision', async () => {
    const { root, registry } = await fixture();
    const first = await runGate(await request(root, registry));
    expect(first.status).toBe('succeeded');
    expect(first.evidence.stdoutLogPath).toMatch(/^\.leo-dev\/runtime\/c-/);
    await expect(runGate(await request(root, registry))).rejects.toMatchObject({ code: 'EVIDENCE_COLLISION' });
  });

  test('detects an undeclared file injected into the reserved evidence directory', async () => {
    const { root } = await fixture();
    const evidencePath = evidenceDirectory('change-1', 'run-1', 'reservation-write');
    const registry = new GateRegistry([{ id: 'reservation-write', argv: [node, '-e', `require('fs').writeFileSync(${JSON.stringify(`${evidencePath}/intruder.txt`)}, 'intruder')`], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const result = await runGate(await request(root, registry, 'reservation-write'));
    expect(result).toMatchObject({ status: 'undeclared-writes', undeclaredWrites: expect.arrayContaining([`${evidencePath}/intruder.txt`]) });
  });

  test('keeps nested gate arrays immutable and normalizes portable declared paths', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'normalized', argv: [node, '-e', "require('fs').mkdirSync('build/nested',{recursive:true});require('fs').writeFileSync('build/nested/out.txt','ok')"], cwd: './', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['./build\\'] }]);
    const first = registry.get('normalized');
    expect(() => first.argv.push('unsafe')).toThrow();
    expect(registry.get('normalized').argv).toHaveLength(3);
    await expect(runGate(await request(root, registry, 'normalized'))).resolves.toMatchObject({ status: 'succeeded' });
  });

  test('durably links prepared, started, and settled records by a full stable attempt identity', async () => {
    const { root, registry } = await fixture();
    await expect(runGate(await request(root, registry))).resolves.toMatchObject({ status: 'succeeded' });

    const { events } = await gateJournal(root);
    expect(events.map((event) => event.type)).toEqual(['gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.released', 'gate.attempt.settled']);
    const [prepared, started, released, settled] = events;
    const preparedPayload = prepared.payload as Record<string, unknown>;
    expect(preparedPayload).toMatchObject({
      version: 3,
      runId: 'run-1',
      changeId: 'change-1',
      gateId: 'ok',
      taskId: 'task-1',
      taskRevision: 1,
      leaseGeneration: 1,
      repositoryIdentity: expect.stringMatching(/^[a-f0-9]{64}$/),
      gateDefinitionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      inputTreeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      executionFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      launcherCommandFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      recoveryWriteSurfaceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      executionPolicy: expect.objectContaining({ replaySafety: 'pure', effectClass: 'local-verification', network: 'deny' }),
    });
    expect(preparedPayload.attemptId).toMatch(/^[a-f0-9]{64}$/);
    expect(started.payload).toMatchObject({
      version: 3,
      attemptId: preparedPayload.attemptId,
      preparedEventHash: prepared.eventHash,
      process: { pid: expect.any(Number), processGroupId: expect.any(Number), commandFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), reviewedCommandFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(released.payload).toMatchObject({
      version: 3,
      attemptId: preparedPayload.attemptId,
      preparedEventHash: prepared.eventHash,
      startedEventHash: started.eventHash,
    });
    expect(settled.payload).toMatchObject({
      version: 3,
      attemptId: preparedPayload.attemptId,
      preparedEventHash: prepared.eventHash,
      startedEventHash: started.eventHash,
      releasedEventHash: released.eventHash,
      status: 'succeeded',
      evidence: { contentHash: expect.stringMatching(/^[a-f0-9]{64}$/), pathHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
  });

  test('persists prepared intent before launch and leaves it recoverable when the controller stops at that boundary', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'prepared-crash', argv: [node, '-e', "require('fs').mkdirSync('build',{recursive:true});require('fs').writeFileSync('build/launched','yes')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['build'] }]);
    const crashRunner = new GateRunner({
      networkIsolation: passthroughIsolation,
      clock: () => new Date('2026-09-04T12:00:00.000Z'),
      attemptLifecycle: {
        async afterPrepared() {
          expect((await gateJournal(root)).events.map((event) => event.type)).toEqual(['gate.attempt.prepared']);
          throw new Error('simulated crash after prepare');
        },
      },
    } as never);

    await expect(crashRunner.run(await request(root, registry, 'prepared-crash'))).rejects.toThrow('simulated crash after prepare');
    expect((await gateJournal(root)).events.map((event) => event.type)).toEqual(['gate.attempt.prepared']);
    await expect(access(join(root, 'build/launched'))).rejects.toMatchObject({ code: 'ENOENT' });
    const fresh = { ...(await request(root, registry, 'prepared-crash')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: 'run-1', request: fresh })).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded' } });
    await expect(readFile(join(root, 'build/launched'), 'utf8')).resolves.toBe('yes');
  });

  test('rejects a second malformed prepared record claiming the same full attempt identity', async () => {
    const { root, registry } = await fixture();
    const prior = await request(root, registry, 'failed');
    await expect(runGate(prior)).resolves.toMatchObject({ status: 'failed' });
    const journal = new Journal(runtimePaths(root, prior.changeId).journal);
    const prepared = (await journal.replay()).events.find((event) => event.type === 'gate.attempt.prepared')!;
    await journal.append({
      changeId: prior.changeId,
      taskId: prior.taskId,
      taskRevision: prior.taskRevision,
      leaseGeneration: prior.leaseGeneration,
      type: 'gate.attempt.prepared',
      payload: { ...(prepared.payload as Record<string, unknown>), recoveryWriteSurfaceHash: 'malformed' },
    });
    const fresh = { ...(await request(root, registry, 'failed')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
  });

  test('rejects a started process identity that is not bound to its prepared execution', async () => {
    const { root, registry } = await fixture();
    const prior = await request(root, registry, 'ok');
    const crashRunner = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterPrepared() { throw new Error('stop before spawn'); } } } as never);
    await expect(crashRunner.run(prior)).rejects.toThrow('stop before spawn');
    const journal = new Journal(runtimePaths(root, prior.changeId).journal);
    const prepared = (await journal.replay()).events[0];
    const identity = prepared.payload as Record<string, unknown>;
    await journal.append({
      changeId: prior.changeId,
      taskId: prior.taskId,
      taskRevision: prior.taskRevision,
      leaseGeneration: prior.leaseGeneration,
      type: 'gate.attempt.started',
      payload: { ...identity, preparedEventHash: prepared.eventHash, process: { pid: 2_000_000_000, commandFingerprint: 'f'.repeat(64), observedAt: '2026-09-04T12:00:00.000Z' } },
    });
    const inactiveRunner = new GateRunner({ networkIsolation: passthroughIsolation, processLiveness: () => false });
    const fresh = { ...(await request(root, registry, 'ok')), runId: 'run-2', leaseGeneration: 2 };
    await expect(inactiveRunner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
  });

  test('fences and contains an interrupted started launcher before recovery', async () => {
    const { root } = await fixture();
    const controlRoot = await mkdtemp(join(tmpdir(), 'leo-dev-gate-control-'));
    const releasePath = join(controlRoot, 'release');
    const registry = new GateRegistry([{ id: 'active-interruption', argv: [node, '-e', `const fs=require('fs');const p=${JSON.stringify(releasePath)};function poll(){if(fs.existsSync(p))process.exit(7);setImmediate(poll)}poll()`], cwd: '.', timeoutSeconds: 5, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const started = deferred();
    const letRunnerObserve = deferred();
    const activeRunner = new GateRunner({
      networkIsolation: passthroughIsolation,
      clock: () => new Date('2026-09-04T12:00:00.000Z'),
      attemptLifecycle: { async afterStarted() { started.resolve(); await letRunnerObserve.promise; } },
    } as never);
    const prior = await request(root, registry, 'active-interruption');
    const running = activeRunner.run(prior);
    await started.promise;
    expect((await gateJournal(root)).events.map((event) => event.type)).toEqual(['gate.attempt.prepared', 'gate.attempt.started']);
    const fresh = { ...(await request(root, registry, 'active-interruption')), runId: 'run-2', leaseGeneration: 2 };
    const staleResult = expect(running).rejects.toMatchObject({ code: 'GATE_RECORD_INDETERMINATE' });
    const recovered = runner.recover({ previousRunId: prior.runId, request: fresh });
    while (!(await gateJournal(root)).events.some((event) => event.type === 'gate.attempt.aborted')) await new Promise<void>((resolve) => setImmediate(resolve));
    letRunnerObserve.resolve();
    await staleResult;
    await writeFile(releasePath, 'release');
    await expect(recovered).resolves.toMatchObject({ restarted: true, result: { status: 'failed' } });
  }, 10_000);

  test('reruns an inactive idempotent interrupted attempt with a fresh run and generation', async () => {
    const { root } = await fixture();
    process.env.RECOVER_MODE = 'fail';
    const registry = new GateRegistry([{ id: 'idempotent-interrupted', argv: [node, '-e', "const fs=require('fs');fs.mkdirSync('build',{recursive:true});const f='build/idempotent-count';fs.writeFileSync(f,String(Number(fs.existsSync(f)&&fs.readFileSync(f,'utf8')||0)+1));process.exit(process.env.RECOVER_MODE==='ok'?0:8)"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: ['RECOVER_MODE'], declaredWritePaths: ['build'] }]);
    const crashRunner = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterProcessExit() { throw new Error('simulated crash after child exit'); } } } as never);
    const prior = await request(root, registry, 'idempotent-interrupted');
    try {
      await expect(crashRunner.run(prior)).rejects.toThrow('simulated crash after child exit');
      expect((await gateJournal(root)).events.map((event) => event.type)).toEqual(['gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.released']);
      process.env.RECOVER_MODE = 'ok';
      const fresh = { ...(await request(root, registry, 'idempotent-interrupted')), runId: 'run-2', leaseGeneration: 2 };
      await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded' } });
      await expect(readFile(join(root, 'build/idempotent-count'), 'utf8')).resolves.toBe('2');
    } finally {
      delete process.env.RECOVER_MODE;
    }
  });

  test('reruns an inactive pure interruption only when its journaled recovery surface is unchanged', async () => {
    const unchanged = await fixture();
    const registry = new GateRegistry([{ id: 'pure-interrupted', argv: [node, '-e', "process.stdout.write('pure')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const crashRunner = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterProcessExit() { throw new Error('simulated crash after child exit'); } } } as never);
    const unchangedPrior = await request(unchanged.root, registry, 'pure-interrupted');
    await expect(crashRunner.run(unchangedPrior)).rejects.toThrow('simulated crash after child exit');
    const unchangedFresh = { ...(await request(unchanged.root, registry, 'pure-interrupted')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: unchangedPrior.runId, request: unchangedFresh })).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded' } });

    const changed = await fixture();
    const changedPrior = await request(changed.root, registry, 'pure-interrupted');
    await expect(crashRunner.run(changedPrior)).rejects.toThrow('simulated crash after child exit');
    await writeFile(join(changed.root, 'unexpected.txt'), 'effect');
    const changedFresh = { ...(await request(changed.root, registry, 'pure-interrupted')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: changedPrior.runId, request: changedFresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
    await expect(access(join(changed.root, evidenceDirectory('change-1', 'run-2', 'pure-interrupted')))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('maps an interrupted manual attempt to unknown without executing it again', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'manual-interrupted', argv: [node, '-e', "const fs=require('fs');fs.mkdirSync('build',{recursive:true});const f='build/manual-interrupted-count';fs.writeFileSync(f,String(Number(fs.existsSync(f)&&fs.readFileSync(f,'utf8')||0)+1))"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'manual-reconcile', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['build'] }]);
    const crashRunner = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterProcessExit() { throw new Error('simulated crash after child exit'); } } } as never);
    const prior = await request(root, registry, 'manual-interrupted');
    await expect(crashRunner.run(prior)).rejects.toThrow('simulated crash after child exit');
    const fresh = { ...(await request(root, registry, 'manual-interrupted')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).resolves.toEqual({ restarted: false, outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' } });
    await expect(readFile(join(root, 'build/manual-interrupted-count'), 'utf8')).resolves.toBe('1');
  });

  test('treats evidence published before settlement as orphaned and applies pure recovery policy', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'orphan-before-settlement', argv: [node, '-e', "process.stdout.write('orphan')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const crashRunner = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterEvidencePublished() { throw new Error('simulated crash after evidence'); } } } as never);
    const prior = await request(root, registry, 'orphan-before-settlement');
    await expect(crashRunner.run(prior)).rejects.toThrow('simulated crash after evidence');
    await expect(access(join(root, evidenceFilePath(prior.changeId, prior.runId, prior.gateId)))).resolves.toBeUndefined();
    expect((await gateJournal(root)).events.map((event) => event.type)).toEqual(['gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.released']);
    const fresh = { ...(await request(root, registry, 'orphan-before-settlement')), runId: 'run-2', leaseGeneration: 2 };
    const recovered = await runner.recover({ previousRunId: prior.runId, request: fresh });
    expect(recovered).toMatchObject({ restarted: true, result: { status: 'succeeded', evidence: { runId: 'run-2' } } });
  });

  test('recovers a journaled pure failure only with a fresh run and generation', async () => {
    const { root } = await fixture();
    process.env.RECOVER_MODE = 'fail';
    const registry = new GateRegistry([{ id: 'pure-recovery', argv: [node, '-e', "process.exit(process.env.RECOVER_MODE === 'ok' ? 0 : 7)"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: ['RECOVER_MODE'], declaredWritePaths: [] }]);
    const firstRequest = await request(root, registry, 'pure-recovery');
    const first = await runGate(firstRequest);
    expect(first).toMatchObject({ status: 'failed', outcome: { taskState: 'remediation' } });
    process.env.RECOVER_MODE = 'ok';
    const fresh = { ...(await request(root, registry, 'pure-recovery')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: firstRequest.runId, request: fresh })).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded' } });
    await expect(runner.recover({ previousRunId: firstRequest.runId, request: { ...fresh, runId: firstRequest.runId } })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
    await expect(runner.recover({ previousRunId: firstRequest.runId, request: { ...fresh, leaseGeneration: firstRequest.leaseGeneration } })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
    delete process.env.RECOVER_MODE;
  });

  test('recovers a journaled idempotent declared-write failure with a fresh run and generation', async () => {
    const { root } = await fixture();
    process.env.RECOVER_MODE = 'fail';
    const registry = new GateRegistry([{ id: 'idempotent-recovery', argv: [node, '-e', "require('fs').mkdirSync('build',{recursive:true});require('fs').writeFileSync('build/state.txt','done');process.exit(process.env.RECOVER_MODE === 'ok' ? 0 : 8)"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: ['RECOVER_MODE'], declaredWritePaths: ['build'] }]);
    const firstRequest = await request(root, registry, 'idempotent-recovery');
    const first = await runGate(firstRequest);
    expect(first).toMatchObject({ status: 'failed', outcome: { taskState: 'remediation' } });
    process.env.RECOVER_MODE = 'ok';
    const fresh = { ...(await request(root, registry, 'idempotent-recovery')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: firstRequest.runId, request: fresh })).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded' } });
    delete process.env.RECOVER_MODE;
  });

  test('rejects caller-fabricated unknown recovery after a journaled manual success', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'manual-recovery', argv: [node, '-e', "const f='build/manual-count';require('fs').mkdirSync('build',{recursive:true});require('fs').writeFileSync(f,String((Number(require('fs').existsSync(f) && require('fs').readFileSync(f,'utf8')) || 0) + 1))"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'manual-reconcile', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['build'] }]);
    const firstRequest = await request(root, registry, 'manual-recovery');
    const first = await runGate(firstRequest);
    const fresh = { ...(await request(root, registry, 'manual-recovery')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: firstRequest.runId, previousResult: { status: 'unknown', exitCode: null, outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' } }, request: fresh } as never)).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
    await expect(readFile(join(root, 'build/manual-count'), 'utf8')).resolves.toBe('1');
  });

  test('maps a genuinely journaled manual unknown without launching it again', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'manual-unknown', argv: [node, '-e', "const f='build/manual-unknown-count';require('fs').mkdirSync('build',{recursive:true});require('fs').writeFileSync(f,String((Number(require('fs').existsSync(f) && require('fs').readFileSync(f,'utf8')) || 0) + 1));process.stdout.write('password=super-secret-value')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'manual-reconcile', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['build'] }]);
    const firstRequest = await request(root, registry, 'manual-unknown');
    await expect(runGate(firstRequest)).resolves.toMatchObject({ status: 'evidence-blocked-secret', outcome: { runState: 'unknown' } });
    const fresh = { ...(await request(root, registry, 'manual-unknown')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: firstRequest.runId, request: fresh })).resolves.toEqual({ restarted: false, outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' } });
    await expect(readFile(join(root, 'build/manual-unknown-count'), 'utf8')).resolves.toBe('1');
  });

  test('rejects a self-consistent evidence artifact that has no journaled settlement', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'orphaned-evidence', argv: [node, '-e', 'process.exit(9)'], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const prior = await request(root, registry, 'orphaned-evidence');
    await expect(runGate(prior)).resolves.toMatchObject({ status: 'failed', evidence: { runId: prior.runId } });
    await rm(runtimePaths(root, prior.changeId).journal, { force: true });
    const fresh = { ...(await request(root, registry, 'orphaned-evidence')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
  });

  test('rejects recovery when repository A journal and evidence are copied into repository B', async () => {
    const { root: rootA } = await fixture();
    const { root: rootB } = await fixture();
    const registry = new GateRegistry([{ id: 'repository-bound', argv: [node, '-e', 'process.exit(9)'], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const prior = await request(rootA, registry, 'repository-bound');
    await runGate(prior);
    await cp(join(rootA, '.leo-dev'), join(rootB, '.leo-dev'), { recursive: true });
    const fresh = { ...(await request(rootB, registry, 'repository-bound')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
  });

  test('rejects recovery when the reviewed gate definition changed', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'definition-bound', argv: [node, '-e', 'process.exit(9)'], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const prior = await request(root, registry, 'definition-bound');
    await runGate(prior);
    const changed = new GateRegistry([{ id: 'definition-bound', argv: [node, '-e', 'process.exit(0)'], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const fresh = { ...(await request(root, changed, 'definition-bound')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
  });

  test('returns a typed indeterminate error and leaves orphan evidence when settlement persistence fails', async () => {
    const { root, registry } = await fixture();
    const journals = new Map<string, Journal>();
    const persistenceFailure = new GateRunner({
      networkIsolation: passthroughIsolation,
      clock: () => new Date('2026-09-04T12:00:00.000Z'),
      journalFactory: (path: string) => ({
        async append(input: Parameters<Journal['append']>[0]) {
          if (input.type === 'gate.attempt.settled') throw new Error('disk unavailable');
          const journal = journals.get(path) ?? new Journal(path); journals.set(path, journal);
          return journal.append(input);
        },
        async appendIfTail(input: Parameters<Journal['append']>[0], expectedEventHash: string) {
          if (input.type === 'gate.attempt.settled') throw new Error('disk unavailable');
          const journal = journals.get(path) ?? new Journal(path); journals.set(path, journal);
          return journal.appendIfTail(input, expectedEventHash);
        },
        async replay() { const journal = journals.get(path) ?? new Journal(path); journals.set(path, journal); return journal.replay(); },
        async replayStrict() { const journal = journals.get(path) ?? new Journal(path); journals.set(path, journal); return journal.replayStrict(); },
      }),
    } as never);
    await expect(persistenceFailure.run(await request(root, registry))).rejects.toMatchObject({ code: 'GATE_RECORD_INDETERMINATE', outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' } });
    expect((await gateJournal(root)).events.map((event) => event.type)).toEqual(['gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.released']);
    await expect(access(join(root, evidenceFilePath('change-1', 'run-1', 'ok')))).resolves.toBeUndefined();
  });

  test('contains the runner-owned child and returns typed indeterminate when start persistence fails', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'start-record-failure', argv: [node, '-e', 'setInterval(()=>{},1000)'], cwd: '.', timeoutSeconds: 10, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    let spawnedPid: number | undefined;
    const journal = new Journal(runtimePaths(root, 'change-1').journal);
    const persistenceFailure = new GateRunner({
      networkIsolation: passthroughIsolation,
      journalFactory: () => ({
        async append(input: Parameters<Journal['append']>[0]) {
          return journal.append(input);
        },
        async appendIfTail(input: Parameters<Journal['append']>[0], expectedEventHash: string) {
          if (input.type === 'gate.attempt.started') {
            spawnedPid = ((input.payload as { process?: { pid?: number } }).process?.pid);
            throw new Error('start record unavailable');
          }
          return journal.appendIfTail(input, expectedEventHash);
        },
        replay: () => journal.replay(),
        replayStrict: () => journal.replayStrict(),
      }),
    } as never);

    await expect(persistenceFailure.run(await request(root, registry, 'start-record-failure'))).rejects.toMatchObject({ code: 'GATE_RECORD_INDETERMINATE' });
    expect(spawnedPid).toEqual(expect.any(Number));
    expect(() => process.kill(spawnedPid!, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
    expect((await gateJournal(root)).events.map((event) => event.type)).toEqual(['gate.attempt.prepared']);
  });

  test('does not release the reviewed gate before the durable release CAS and fences a late controller', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'barrier-race', argv: [node, '-e', "const fs=require('fs');fs.mkdirSync('build',{recursive:true});const p='build/barrier-count';fs.writeFileSync(p,String(Number(fs.existsSync(p)?fs.readFileSync(p,'utf8'):0)+1))"], cwd: '.', timeoutSeconds: 3, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['build'] }]);
    const started = deferred();
    const resumeOldController = deferred();
    const staleRunner = new GateRunner({
      networkIsolation: passthroughIsolation,
      attemptLifecycle: { async afterStarted() { started.resolve(); await resumeOldController.promise; } },
    });
    const prior = await request(root, registry, 'barrier-race');
    const staleRun = staleRunner.run(prior);
    const staleResult = expect(staleRun).rejects.toMatchObject({ code: 'GATE_RECORD_INDETERMINATE' });
    await started.promise;
    await expect(access(join(root, 'build/barrier-count'))).rejects.toMatchObject({ code: 'ENOENT' });

    const fresh = { ...(await request(root, registry, 'barrier-race')), runId: 'run-2', leaseGeneration: 2 };
    const successorPrepared = deferred();
    const recoveryRunner = new GateRunner({
      networkIsolation: passthroughIsolation,
      attemptLifecycle: { afterPrepared() { successorPrepared.resolve(); } },
    });
    const recovery = recoveryRunner.recover({ previousRunId: prior.runId, request: fresh });
    while (!(await gateJournal(root)).events.some((event) => event.type === 'gate.attempt.aborted')) await new Promise<void>((resolve) => setImmediate(resolve));
    await successorPrepared.promise;
    resumeOldController.resolve();

    await staleResult;
    await expect(recovery).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded' } });
    await expect(readFile(join(root, 'build/barrier-count'), 'utf8')).resolves.toBe('1');
    expect((await gateJournal(root)).events.map((event) => event.type)).toEqual([
      'gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.aborted',
      'gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.released', 'gate.attempt.settled',
    ]);
  }, 10_000);

  test('does not signal or contain an unowned live process group when identity cannot be established', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'unowned-group', argv: [node, '-e', "require('fs').writeFileSync('must-not-run','x')"], cwd: '.', timeoutSeconds: 3, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const started = deferred();
    const resumeOwner = deferred();
    let processGroupId = 0;
    const owner = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterStarted(boundary) { processGroupId = ((boundary.event.payload as { process: { processGroupId: number } }).process.processGroupId); started.resolve(); await resumeOwner.promise; } } });
    const prior = await request(root, registry, 'unowned-group');
    const staleRun = owner.run(prior);
    const staleResult = expect(staleRun).rejects.toMatchObject({ code: 'GATE_RECORD_INDETERMINATE' });
    await started.promise;
    let containmentCalls = 0;
    const recovery = new GateRunner({
      networkIsolation: passthroughIsolation,
      processLiveness: async () => { throw new Error('unowned live group'); },
      processContainment: async () => { containmentCalls += 1; },
    } as never);
    const fresh = { ...(await request(root, registry, 'unowned-group')), runId: 'run-2', leaseGeneration: 2 };
    await expect(recovery.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
    expect(containmentCalls).toBe(0);
    expect(() => process.kill(-processGroupId, 0)).not.toThrow();
    resumeOwner.resolve();
    await staleResult;
    await expect(access(join(root, 'must-not-run'))).rejects.toMatchObject({ code: 'ENOENT' });
  }, 10_000);

  test('default ownership comparison blocks a different attempt reusing the same process group without signalling it', async () => {
    type Ownership = {
      version: 3;
      attemptId: string;
      repositoryIdentity: string;
      changeId: string;
      runId: string;
      gateId: string;
      taskId: string;
      taskRevision: number;
      leaseGeneration: number;
      process: { pid: number; processGroupId: number; commandFingerprint: string; reviewedCommandFingerprint: string; observedAt: string };
    };
    type OwnershipModule = {
      GateLauncherOwnershipRegistry: new () => { register(identity: Ownership, handle: PromiseLike<unknown>): void };
      defaultLauncherLiveness(identity: Ownership, registry: unknown, signalGroup: (pid: number, signal: NodeJS.Signals | 0) => void): Promise<boolean>;
      defaultLauncherContainment(identity: Ownership, registry: unknown, signalGroup: (pid: number, signal: NodeJS.Signals | 0) => void): Promise<void>;
    };
    const ownershipApi = gateRunnerModule as unknown as OwnershipModule;
    const registry = new ownershipApi.GateLauncherOwnershipRegistry();
    const owner: Ownership = {
      version: 3,
      attemptId: 'a'.repeat(64),
      repositoryIdentity: 'b'.repeat(64),
      changeId: 'change-1',
      runId: 'run-owner',
      gateId: 'gate-owner',
      taskId: 'task-1',
      taskRevision: 1,
      leaseGeneration: 1,
      process: { pid: 4242, processGroupId: 4242, commandFingerprint: 'c'.repeat(64), reviewedCommandFingerprint: 'd'.repeat(64), observedAt: '2026-09-04T12:00:00.000Z' },
    };
    const colliding: Ownership = { ...owner, attemptId: 'e'.repeat(64), runId: 'run-reused', leaseGeneration: 2 };
    const exactHandle = Promise.resolve();
    registry.register(owner, exactHandle);
    expect(() => registry.register(owner, Promise.resolve())).toThrow(/subprocess handle/i);
    const signals: Array<[number, NodeJS.Signals | 0]> = [];
    const signalGroup = (pid: number, signal: NodeJS.Signals | 0) => { signals.push([pid, signal]); };

    await expect(ownershipApi.defaultLauncherLiveness(colliding, registry, signalGroup)).rejects.toThrow(/different gate attempt/i);
    await expect(ownershipApi.defaultLauncherContainment(colliding, registry, signalGroup)).rejects.toThrow(/different gate attempt/i);
    expect(signals).toEqual([]);
  });

  test('resumes the same successor after crashing immediately after the abort CAS', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'abort-resume', argv: [node, '-e', "const fs=require('fs');fs.mkdirSync('build',{recursive:true});fs.writeFileSync('build/abort-resume','once')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['build'] }]);
    const prior = await request(root, registry, 'abort-resume');
    const prepareCrash = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterPrepared() { throw new Error('stop at prepared'); } } });
    await expect(prepareCrash.run(prior)).rejects.toThrow('stop at prepared');
    const fresh = { ...(await request(root, registry, 'abort-resume')), runId: 'run-2', leaseGeneration: 2 };
    const abortCrash = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterAborted() { throw new Error('crash after abort CAS'); } } } as never);
    await expect(abortCrash.recover({ previousRunId: prior.runId, request: fresh })).rejects.toThrow('crash after abort CAS');
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded' } });
    await expect(readFile(join(root, 'build/abort-resume'), 'utf8')).resolves.toBe('once');
  });

  test('allows only one of two concurrent recoveries to prepare and execute the successor', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'single-successor', argv: [node, '-e', "const fs=require('fs');fs.mkdirSync('build',{recursive:true});const p='build/single-successor';fs.writeFileSync(p,String(Number(fs.existsSync(p)?fs.readFileSync(p,'utf8'):0)+1))"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: ['build'] }]);
    const prior = await request(root, registry, 'single-successor');
    const prepareCrash = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterPrepared() { throw new Error('stop at prepared'); } } });
    await expect(prepareCrash.run(prior)).rejects.toThrow('stop at prepared');
    const fresh = { ...(await request(root, registry, 'single-successor')), runId: 'run-2', leaseGeneration: 2 };
    const results = await Promise.allSettled([
      runner.recover({ previousRunId: prior.runId, request: fresh }),
      runner.recover({ previousRunId: prior.runId, request: fresh }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([expect.objectContaining({ reason: expect.objectContaining({ code: 'RECOVERY_IN_PROGRESS' }) })]);
    await expect(readFile(join(root, 'build/single-successor'), 'utf8')).resolves.toBe('1');
  });

  test('replays a manual abort mapping only for its bound successor', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'manual-abort', argv: [node, '-e', "require('fs').writeFileSync('must-not-run-manual','x')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'manual-reconcile', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const prior = await request(root, registry, 'manual-abort');
    const prepareCrash = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterPrepared() { throw new Error('stop at prepared'); } } });
    await expect(prepareCrash.run(prior)).rejects.toThrow('stop at prepared');
    const fresh = { ...(await request(root, registry, 'manual-abort')), runId: 'run-2', leaseGeneration: 2 };
    const canonical = { restarted: false, outcome: { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' } };
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).resolves.toEqual(canonical);
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).resolves.toEqual(canonical);
    await expect(runner.recover({ previousRunId: prior.runId, request: { ...fresh, runId: 'run-3', leaseGeneration: 3 } })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
    await expect(access(join(root, 'must-not-run-manual'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('fails closed without changing journal bytes when a released attempt has an incomplete tail', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'strict-recovery-tail', argv: [node, '-e', "process.stdout.write('released')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'idempotent', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const prior = await request(root, registry, 'strict-recovery-tail');
    const crashRunner = new GateRunner({
      networkIsolation: passthroughIsolation,
      attemptLifecycle: { async afterProcessExit() { throw new Error('stop after released execution'); } },
    });
    await expect(crashRunner.run(prior)).rejects.toThrow('stop after released execution');
    const journalPath = runtimePaths(root, prior.changeId).journal;
    await appendFile(journalPath, '{"sequence":999');
    const before = await readFile(journalPath);
    const fresh = { ...(await request(root, registry, 'strict-recovery-tail')), runId: 'run-2', leaseGeneration: 2 };

    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
    expect(await readFile(journalPath)).toEqual(before);
  });

  test('classifies unavailable process containment as an environment prerequisite', async () => {
    const { root, registry } = await fixture();
    const windows = new GateRunner({ networkIsolation: passthroughIsolation, platform: 'win32' } as never);
    await expect(windows.run(await request(root, registry))).rejects.toMatchObject({ code: 'PROCESS_CONTAINMENT_UNAVAILABLE' });
  });

  test.each([
    ['deletes', (path: string) => `require('fs').rmSync(${JSON.stringify(path)},{force:true})`],
    ['truncates', (path: string) => `require('fs').truncateSync(${JSON.stringify(path)},0)`],
    ['replaces', (path: string) => `const fs=require('fs'),p=${JSON.stringify(path)},r=p+'.replacement';fs.writeFileSync(r,'');fs.renameSync(r,p)`],
  ])('returns typed indeterminate when a gate %s the journal before settlement', async (_name, commandFor) => {
    const { root } = await fixture();
    const journalPath = runtimePaths(root, 'change-1').journal;
    const registry = new GateRegistry([{ id: 'damage-journal', argv: [node, '-e', commandFor(journalPath)], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    await expect(runner.run(await request(root, registry, 'damage-journal'))).rejects.toMatchObject({ code: 'GATE_RECORD_INDETERMINATE', outcome: { runState: 'unknown' } });
  });

  test('returns typed indeterminate when another journal event intervenes before settlement', async () => {
    const { root, registry } = await fixture();
    const journal = new Journal(runtimePaths(root, 'change-1').journal);
    const intervening = new GateRunner({
      networkIsolation: passthroughIsolation,
      attemptLifecycle: {
        async afterEvidencePublished() {
          await journal.append({ changeId: 'change-1', taskId: 'task-1', taskRevision: 1, leaseGeneration: 1, type: 'unrelated.concurrent.event', payload: { durable: true } });
        },
      },
    });
    await expect(intervening.run(await request(root, registry))).rejects.toMatchObject({ code: 'GATE_RECORD_INDETERMINATE', outcome: { runState: 'unknown' } });
  });

  test.each(['gate.attempt.started', 'gate.attempt.released', 'gate.attempt.settled', 'gate.attempt.aborted'])('rejects a malformed same-scope %s claim before attempt-id selection', async (phase) => {
    const { root, registry } = await fixture();
    const prior = await request(root, registry, 'failed');
    await expect(runGate(prior)).resolves.toMatchObject({ status: 'failed' });
    const journal = new Journal(runtimePaths(root, prior.changeId).journal);
    const prepared = (await journal.replay()).events[0].payload as Record<string, unknown>;
    const { attemptId: _attemptId, ...malformedScopeClaim } = prepared;
    await journal.append({
      changeId: prior.changeId,
      taskId: prior.taskId,
      taskRevision: prior.taskRevision,
      leaseGeneration: prior.leaseGeneration,
      type: phase,
      payload: malformedScopeClaim,
    });
    const fresh = { ...(await request(root, registry, 'failed')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
  });

  test.each(['gate.attempt.started', 'gate.attempt.released', 'gate.attempt.settled'])('rejects a well-shaped %s phase whose journal envelope follows an intervening event', async (intervenedPhase) => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'adjacent-phase', argv: [node, '-e', "process.stdout.write('password=super-secret-value')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'manual-reconcile', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const prior = await request(root, registry, 'adjacent-phase');
    await expect(runner.run(prior)).resolves.toMatchObject({ status: 'evidence-blocked-secret' });
    const journalPath = runtimePaths(root, prior.changeId).journal;
    const original = (await new Journal(journalPath).replay()).events;
    const payloadFor = (type: string) => ({ ...(original.find((event) => event.type === type)!.payload as Record<string, unknown>) });
    await rm(journalPath, { force: true });
    const rebuilt = new Journal(journalPath);
    const appendIntervening = () => rebuilt.append({ changeId: prior.changeId, type: 'unrelated.intervening.event', payload: { durable: true } });
    const prepared = await rebuilt.append({ changeId: prior.changeId, taskId: prior.taskId, taskRevision: prior.taskRevision, leaseGeneration: prior.leaseGeneration, type: 'gate.attempt.prepared', payload: payloadFor('gate.attempt.prepared') });
    if (intervenedPhase === 'gate.attempt.started') await appendIntervening();
    const started = await rebuilt.append({ changeId: prior.changeId, taskId: prior.taskId, taskRevision: prior.taskRevision, leaseGeneration: prior.leaseGeneration, type: 'gate.attempt.started', payload: { ...payloadFor('gate.attempt.started'), preparedEventHash: prepared.eventHash } });
    if (intervenedPhase === 'gate.attempt.released') await appendIntervening();
    const released = await rebuilt.append({ changeId: prior.changeId, taskId: prior.taskId, taskRevision: prior.taskRevision, leaseGeneration: prior.leaseGeneration, type: 'gate.attempt.released', payload: { ...payloadFor('gate.attempt.released'), preparedEventHash: prepared.eventHash, startedEventHash: started.eventHash } });
    if (intervenedPhase === 'gate.attempt.settled') await appendIntervening();
    await rebuilt.append({ changeId: prior.changeId, taskId: prior.taskId, taskRevision: prior.taskRevision, leaseGeneration: prior.leaseGeneration, type: 'gate.attempt.settled', payload: { ...payloadFor('gate.attempt.settled'), preparedEventHash: prepared.eventHash, startedEventHash: started.eventHash, releasedEventHash: released.eventHash } });
    const fresh = { ...(await request(root, registry, 'adjacent-phase')), runId: 'run-2', leaseGeneration: 2 };

    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
  });

  test('rejects a well-shaped aborted phase whose journal envelope follows an intervening event', async () => {
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'adjacent-abort', argv: [node, '-e', "process.stdout.write('must-not-run')"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'manual-reconcile', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    const prior = await request(root, registry, 'adjacent-abort');
    const prepareCrash = new GateRunner({ networkIsolation: passthroughIsolation, attemptLifecycle: { async afterPrepared() { throw new Error('stop at prepared'); } } });
    await expect(prepareCrash.run(prior)).rejects.toThrow('stop at prepared');
    const fresh = { ...(await request(root, registry, 'adjacent-abort')), runId: 'run-2', leaseGeneration: 2 };
    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).resolves.toMatchObject({ restarted: false });
    const journalPath = runtimePaths(root, prior.changeId).journal;
    const original = (await new Journal(journalPath).replay()).events;
    const preparedPayload = { ...(original.find((event) => event.type === 'gate.attempt.prepared')!.payload as Record<string, unknown>) };
    const abortedPayload = { ...(original.find((event) => event.type === 'gate.attempt.aborted')!.payload as Record<string, unknown>) };
    await rm(journalPath, { force: true });
    const rebuilt = new Journal(journalPath);
    const prepared = await rebuilt.append({ changeId: prior.changeId, taskId: prior.taskId, taskRevision: prior.taskRevision, leaseGeneration: prior.leaseGeneration, type: 'gate.attempt.prepared', payload: preparedPayload });
    await rebuilt.append({ changeId: prior.changeId, type: 'unrelated.intervening.event', payload: { durable: true } });
    await rebuilt.append({ changeId: prior.changeId, taskId: prior.taskId, taskRevision: prior.taskRevision, leaseGeneration: prior.leaseGeneration, type: 'gate.attempt.aborted', payload: { ...abortedPayload, preparedEventHash: prepared.eventHash, priorEventHash: prepared.eventHash } });

    await expect(runner.recover({ previousRunId: prior.runId, request: fresh })).rejects.toMatchObject({ code: 'RECOVERY_INVALID' });
  });

  test('kills the POSIX containment group so a grandchild cannot write after timeout', async () => {
    if (process.platform === 'win32') return;
    const { root } = await fixture();
    const trigger = join(root, 'trigger-grandchild');
    const late = join(root, 'late-grandchild');
    const grandchild = `const fs=require('fs');const trigger=${JSON.stringify(trigger)},late=${JSON.stringify(late)};function poll(){if(fs.existsSync(trigger)){fs.writeFileSync(late,'late');return}setImmediate(poll)}poll()`;
    const registry = new GateRegistry([{ id: 'process-tree', argv: [node, '-e', `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setInterval(()=>{},1000)`], cwd: '.', timeoutSeconds: 1, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    await expect(runner.run(await request(root, registry, 'process-tree'))).resolves.toMatchObject({ status: 'timed-out' });
    const events = (await gateJournal(root)).events;
    const startedPayload = events.find((event) => event.type === 'gate.attempt.started')!.payload as { process: { processGroupId: number } };
    expect(() => process.kill(-startedPayload.process.processGroupId, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
    await writeFile(trigger, 'release');
    await expect(access(late)).rejects.toMatchObject({ code: 'ENOENT' });
  }, 10_000);

  test('launcher contains an ordinary descendant when the controller disconnects after the gate leader exits', async () => {
    if (process.platform === 'win32') return;
    const { root } = await fixture();
    const journalPath = join(root, 'launcher-journal.ndjson');
    const descendantReady = join(root, 'descendant-ready');
    const trigger = join(root, 'descendant-trigger');
    const late = join(root, 'descendant-late-write');
    const descendant = `const fs=require('fs');const ready=${JSON.stringify(descendantReady)},trigger=${JSON.stringify(trigger)},late=${JSON.stringify(late)};fs.writeFileSync(ready,'ready');function poll(){if(fs.existsSync(trigger)){fs.writeFileSync(late,'late');return}setImmediate(poll)}poll()`;
    const leader = `const fs=require('fs'),{spawn}=require('child_process');const ready=${JSON.stringify(descendantReady)};const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'});child.unref();function poll(){if(fs.existsSync(ready))process.exit(0);setImmediate(poll)}poll()`;
    const launcher = spawn(node, ['--eval', gateLauncherSource], {
      cwd: root,
      env: { PATH: process.env.PATH ?? '' },
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const processGroupId = launcher.pid!;
    let groupExited = false;
    const attemptId = 'a'.repeat(64);
    const startedEventHash = 'b'.repeat(64);
    const releaseEventHash = 'c'.repeat(64);
    try {
      const [ready] = await once(launcher, 'message') as [{ type: string; pid: number; processGroupId: number }];
      expect(ready).toEqual({ type: 'launcher-ready', pid: processGroupId, processGroupId });
      await writeFile(journalPath, `${JSON.stringify({
        eventHash: releaseEventHash,
        type: 'gate.attempt.released',
        payload: { attemptId, startedEventHash, processGroupId },
      })}\n`);
      const outcomeMessage = once(launcher, 'message');
      launcher.send({
        type: 'release',
        attemptId,
        startedEventHash,
        releaseEventHash,
        journalPath,
        command: node,
        args: ['-e', leader],
        cwd: root,
        env: { PATH: process.env.PATH ?? '' },
        timeoutMs: 5_000,
        maxOutputBytes: 128,
      });
      const [outcome] = await outcomeMessage as [{ type: string }];
      expect(outcome).toMatchObject({
        type: 'gate-exit',
        observedOutputBytes: 0,
        outputStreams: {
          stdout: { observedBytes: 0, forwardedBytes: 0, omittedPrefix: [] },
          stderr: { observedBytes: 0, forwardedBytes: 0, omittedPrefix: [] },
        },
      });
      await expect(access(descendantReady)).resolves.toBeUndefined();
      if (launcher.connected) launcher.disconnect();

      for (let turn = 0; turn < 200; turn += 1) {
        try { process.kill(-processGroupId, 0); }
        catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code === 'ESRCH') { groupExited = true; break; }
          // Match production's conservative liveness rule: EPERM and every
          // other non-ESRCH result remain unconfirmed and are retried.
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      expect(groupExited).toBe(true);
      await writeFile(trigger, 'release');
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      await expect(access(late)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      if (!groupExited) {
        try { process.kill(-processGroupId, 'SIGKILL'); } catch { /* already contained */ }
      }
    }
  }, 10_000);

  test('recovers two gates sharing one prior run ID independently', async () => {
    const { root } = await fixture();
    process.env.RECOVER_MODE = 'fail';
    const registry = new GateRegistry([
      { id: 'shared-a', argv: [node, '-e', "process.exit(process.env.RECOVER_MODE==='ok'?0:7)"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: ['RECOVER_MODE'], declaredWritePaths: [] },
      { id: 'shared-b', argv: [node, '-e', "process.exit(process.env.RECOVER_MODE==='ok'?0:8)"], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: ['RECOVER_MODE'], declaredWritePaths: [] },
    ]);
    const priorA = await request(root, registry, 'shared-a');
    const priorB = await request(root, registry, 'shared-b');
    try {
      await expect(runGate(priorA)).resolves.toMatchObject({ status: 'failed' });
      await expect(runGate(priorB)).resolves.toMatchObject({ status: 'failed' });
      process.env.RECOVER_MODE = 'ok';
      const freshA = { ...(await request(root, registry, 'shared-a')), runId: 'run-2', leaseGeneration: 2 };
      const freshB = { ...(await request(root, registry, 'shared-b')), runId: 'run-2', leaseGeneration: 2 };
      await expect(runner.recover({ previousRunId: 'run-1', request: freshA })).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded', evidence: { gateId: 'shared-a' } } });
      await expect(runner.recover({ previousRunId: 'run-1', request: freshB })).resolves.toMatchObject({ restarted: true, result: { status: 'succeeded', evidence: { gateId: 'shared-b' } } });
    } finally {
      delete process.env.RECOVER_MODE;
    }
  });

  test('fails closed for network-denied gates when system isolation is unavailable', async () => {
    const { root, registry } = await fixture();
    const unavailable = new GateRunner({ networkIsolation: { async prepare() { throw Object.assign(new Error('unavailable'), { code: 'NETWORK_ISOLATION_UNAVAILABLE' }); } } });
    await expect(unavailable.run(await request(root, registry))).rejects.toMatchObject({ code: 'NETWORK_ISOLATION_UNAVAILABLE' });
  });

  test('denies a local TCP connection when the system network sandbox is available', async () => {
    const server = createServer();
    try {
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
    } catch (error) {
      expect(error).toMatchObject({ code: 'EPERM' });
      return;
    }
    const port = (server.address() as { port: number }).port;
    const { root } = await fixture();
    const registry = new GateRegistry([{ id: 'tcp', argv: [node, '-e', `require('net').connect(${port}, '127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(7))`], cwd: '.', timeoutSeconds: 2, required: true, replaySafety: 'pure', effectClass: 'local-verification', network: 'deny', environmentAllowlist: [], declaredWritePaths: [] }]);
    try {
      const result = await untrustedRunGate(await request(root, registry, 'tcp'));
      expect(result).toMatchObject({ status: 'failed' });
    } catch (error) {
      expect(error).toMatchObject({ code: 'NETWORK_ISOLATION_UNAVAILABLE' });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  test('maps manual reconciliation to the unique unknown/blocked/approval-required outcome', () => {
    expect(recoverGateRun('manual-reconcile', 'timed-out', 'executing')).toEqual({ runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' });
  });
});
