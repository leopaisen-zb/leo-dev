import { lstat, mkdtemp, mkdir, readFile, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';
import { completeControllerInitialization, initializeChangeWorkspace, readControllerInitAuthority } from '../../packages/cli/src/changes/init.js';
import { validateDocument } from '../../packages/cli/src/schema/validate.js';

describe('minimal change workspace', () => {
  test('creates separate versioned artifacts and local runtime without overwriting either', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    const workspace = await initializeChangeWorkspace(root, 'first-change');
    const canonicalRoot = await realpath(root);
    expect(workspace.artifacts).toBe(join(canonicalRoot, '.leo-dev/changes/first-change'));
    expect(workspace.runtime).toBe(join(canonicalRoot, '.leo-dev/runtime/first-change'));
    expect(await readFile(join(workspace.artifacts, 'manifest.yaml'), 'utf8')).toContain('id: first-change');
    await expect(initializeChangeWorkspace(root, 'first-change')).rejects.toMatchObject({ code: 'EEXIST' });
  });

  test('rejects traversal-like change IDs before creating paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    await expect(initializeChangeWorkspace(root, '../escape')).rejects.toThrow(/change id/i);
  });

  test('rejects a .leo-dev ancestor symlink and leaves no partial artifact when runtime exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    const outside = await mkdtemp(join(tmpdir(), 'leo-dev-outside-'));
    await symlink(outside, join(root, '.leo-dev'));
    await expect(initializeChangeWorkspace(root, 'symlinked')).rejects.toThrow(/symlink|escape/i);

    const cleanRoot = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    await mkdir(join(cleanRoot, '.leo-dev/runtime/existing'), { recursive: true });
    await expect(initializeChangeWorkspace(cleanRoot, 'existing')).rejects.toMatchObject({ code: 'EEXIST' });
    await expect(lstat(join(cleanRoot, '.leo-dev/changes/existing'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('writes all required versioned artifact-envelope fields', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    const workspace = await initializeChangeWorkspace(root, 'envelopes');
    const manifest = await readFile(join(workspace.artifacts, 'manifest.yaml'), 'utf8');
    const spec = await readFile(join(workspace.artifacts, 'spec.yaml'), 'utf8');
    expect(manifest).toContain('specRef: spec.yaml');
    for (const field of ['sourceKind:', 'sourceHash:', 'approvalRef:', 'approvalHash:', 'importMode:']) expect(spec).toContain(field);
    const manifestValidation = validateDocument('change-manifest' as never, YAML.parse(manifest));
    expect(manifestValidation.ok, JSON.stringify(manifestValidation)).toBe(true);
    expect(validateDocument('spec-ref' as never, YAML.parse(spec)).ok).toBe(true);
    expect(validateDocument('task-plan' as never, YAML.parse(await readFile(join(workspace.artifacts, 'tasks.yaml'), 'utf8'))).ok).toBe(true);
  });

  test('recovers a fault-injected crash after runtime creation before publishing artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    await expect(initializeChangeWorkspace(root, 'crashed', { faultAt: 'after-runtime-created' })).rejects.toMatchObject({ code: 'SIMULATED_CRASH' });
    const recovered = await initializeChangeWorkspace(root, 'crashed');
    expect(await readFile(join(recovered.artifacts, 'manifest.yaml'), 'utf8')).toContain('id: crashed');
    expect(await lstat(join(recovered.runtime))).toMatchObject({ isDirectory: expect.any(Function) });
  });

  test('treats a crash after artifact publish as an idempotent completed initialization', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    await expect(initializeChangeWorkspace(root, 'published', { faultAt: 'after-artifact-published' })).rejects.toMatchObject({ code: 'SIMULATED_CRASH' });
    const recovered = await initializeChangeWorkspace(root, 'published');
    expect(await readFile(join(recovered.artifacts, 'manifest.yaml'), 'utf8')).toContain('id: published');
  });

  test('retains controller initialization authority across publication until the journal batch is committed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    const authority = {
      initialized: { specPath: 'approved.md', specHash: 'a'.repeat(64), baseline: { kind: 'filesystem' } },
      manifest: { schemaVersion: 1, id: 'authority', state: 'triage', unresolvedDecisions: [], specRef: 'approved.md', sourceKind: 'repository-file', sourceHash: 'a'.repeat(64), approvalRef: null, approvalHash: null, importMode: 'reference' },
      spec: { schemaVersion: 1, sourceKind: 'repository-file', sourceHash: 'a'.repeat(64), approvalRef: null, approvalHash: null, importMode: 'reference' },
      tasks: { schemaVersion: 1, tasks: [] },
    };
    await expect(initializeChangeWorkspace(root, 'authority', { controllerAuthority: authority, faultAt: 'after-workspace-published' })).rejects.toMatchObject({ code: 'SIMULATED_CRASH' });
    expect(await readControllerInitAuthority(root, 'authority')).toEqual(authority);
    await initializeChangeWorkspace(root, 'authority', { controllerAuthority: authority });
    expect(await readControllerInitAuthority(root, 'authority')).toEqual(authority);
    await completeControllerInitialization(root, 'authority');
    expect(await readControllerInitAuthority(root, 'authority')).toBeUndefined();
  });

  test.each(['after-runtime-created', 'after-workspace-published'] as const)('keeps the first durable controller authority under the initialization lock after %s', async (faultAt) => {
    const root = await mkdtemp(join(tmpdir(), 'leo-dev-workspace-'));
    const first = {
      initialized: { specPath: 'first.md', specHash: 'a'.repeat(64), baseline: { kind: 'filesystem' } },
      manifest: { schemaVersion: 1, id: 'locked-authority', state: 'triage', unresolvedDecisions: [], specRef: 'first.md', sourceKind: 'repository-file', sourceHash: 'a'.repeat(64), approvalRef: null, approvalHash: null, importMode: 'reference' },
      spec: { schemaVersion: 1, sourceKind: 'repository-file', sourceHash: 'a'.repeat(64), approvalRef: null, approvalHash: null, importMode: 'reference' },
      tasks: { schemaVersion: 1, tasks: [] },
    };
    const staleSecond = {
      ...first,
      initialized: { ...first.initialized, specPath: 'second.md', specHash: 'b'.repeat(64) },
      manifest: { ...first.manifest, specRef: 'second.md', sourceHash: 'b'.repeat(64) },
      spec: { ...first.spec, sourceHash: 'b'.repeat(64) },
    };
    await expect(initializeChangeWorkspace(root, 'locked-authority', { controllerAuthority: first, faultAt })).rejects.toMatchObject({ code: 'SIMULATED_CRASH' });

    await expect(initializeChangeWorkspace(root, 'locked-authority', { controllerAuthority: staleSecond })).rejects.toMatchObject({ code: 'INIT_AUTHORITY_MISMATCH' });
    expect(await readControllerInitAuthority(root, 'locked-authority')).toEqual(first);
    if (faultAt === 'after-workspace-published') {
      expect(YAML.parse(await readFile(join(root, '.leo-dev/changes/locked-authority/manifest.yaml'), 'utf8'))).toEqual(first.manifest);
    }

    await expect(initializeChangeWorkspace(root, 'locked-authority', { controllerAuthority: first })).resolves.toMatchObject({ artifacts: expect.stringContaining('locked-authority') });
    expect(await readControllerInitAuthority(root, 'locked-authority')).toEqual(first);
  });
});
