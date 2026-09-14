import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, rm, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { withJournalLock } from '../state/lock.js';
import { assertChangeId, assertContained } from './artifacts.js';

export interface ChangeWorkspace { artifacts: string; runtime: string; }
export interface ControllerInitAuthority { initialized: unknown; manifest: unknown; spec: unknown; tasks: unknown; }
export interface InitOptions { faultAt?: 'after-runtime-created' | 'after-artifact-published' | 'after-workspace-published' | 'after-artifact-published-error'; controllerAuthority?: ControllerInitAuthority; }
interface InitIntent { changeId: string; staging: string; runtime: string; artifacts: string; controllerAuthority?: ControllerInitAuthority; }

async function fsyncDirectory(path: string): Promise<void> { const handle = await open(path, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
async function writeDurable(path: string, contents: string): Promise<void> { const handle = await open(path, 'w'); try { await handle.writeFile(contents); await handle.sync(); } finally { await handle.close(); } }
async function exists(path: string): Promise<boolean> { try { await lstat(path); return true; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }

async function recoverIntent(intentPath: string, expectedAuthority?: ControllerInitAuthority): Promise<boolean> {
  if (!await exists(intentPath)) return false;
  const intent = JSON.parse(await readFile(intentPath, 'utf8')) as InitIntent;
  if (!isDeepStrictEqual(intent.controllerAuthority, expectedAuthority)) {
    const error = new Error('Initialization retry does not match the durable initialization authority') as Error & { code: string };
    error.code = 'INIT_AUTHORITY_MISMATCH';
    throw error;
  }
  const published = await exists(intent.artifacts);
  if (!published) await rm(intent.runtime, { recursive: true, force: true });
  await rm(intent.staging, { recursive: true, force: true });
  if (!intent.controllerAuthority) { await unlink(intentPath); await fsyncDirectory(dirname(intentPath)); }
  return published;
}

export async function readControllerInitAuthority(repositoryRoot: string, changeId: string): Promise<ControllerInitAuthority | undefined> {
  assertChangeId(changeId);
  const root = await realpath(resolve(repositoryRoot));
  const path = join(root, '.leo-dev', 'runtime', '.initialize-intents', `${changeId}.json`);
  try { return (JSON.parse(await readFile(path, 'utf8')) as InitIntent).controllerAuthority; }
  catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

export async function completeControllerInitialization(repositoryRoot: string, changeId: string): Promise<void> {
  const root = await realpath(resolve(repositoryRoot));
  const path = join(root, '.leo-dev', 'runtime', '.initialize-intents', `${changeId}.json`);
  try { await unlink(path); await fsyncDirectory(dirname(path)); }
  catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

export async function initializeChangeWorkspace(repositoryRoot: string, changeId: string, options: InitOptions = {}): Promise<ChangeWorkspace> {
  assertChangeId(changeId);
  const canonicalRoot = await realpath(resolve(repositoryRoot));
  const control = join(canonicalRoot, '.leo-dev'); const artifacts = join(control, 'changes', changeId); const runtime = join(control, 'runtime', changeId);
  await assertContained(canonicalRoot, control); await mkdir(control, { recursive: true });
  const controlInfo = await lstat(control); if (!controlInfo.isDirectory() || controlInfo.isSymbolicLink()) throw new Error('.leo-dev must be a real directory');
  const runtimeRoot = join(control, 'runtime'); await assertContained(canonicalRoot, runtimeRoot); await mkdir(runtimeRoot, { recursive: true }); await assertContained(canonicalRoot, runtimeRoot);
  const intentRoot = join(runtimeRoot, '.initialize-intents'); await mkdir(intentRoot, { recursive: true });
  return withJournalLock(join(runtimeRoot, '.initialize.lock'), async () => {
    const intentPath = join(intentRoot, `${changeId}.json`); if (await recoverIntent(intentPath, options.controllerAuthority)) return { artifacts, runtime };
    await assertContained(canonicalRoot, artifacts); await assertContained(canonicalRoot, runtime);
    if (await exists(artifacts) || await exists(runtime)) { const error = new Error(`Workspace already exists: ${changeId}`) as NodeJS.ErrnoException; error.code = 'EEXIST'; throw error; }
    const changesRoot = join(control, 'changes'); await mkdir(changesRoot, { recursive: true });
    const staging = join(control, `.staging-${changeId}-${randomUUID()}`); const sourceHash = '0'.repeat(64); const intent: InitIntent = { changeId, staging, runtime, artifacts, ...(options.controllerAuthority ? { controllerAuthority: options.controllerAuthority } : {}) };
    let runtimeCreated = false; let simulatedCrash = false; let artifactsPublished = false;
    try {
      await mkdir(staging);
      await writeDurable(join(staging, 'manifest.yaml'), options.controllerAuthority ? JSON.stringify(options.controllerAuthority.manifest) : `schemaVersion: 1\nid: ${changeId}\nstate: triage\nunresolvedDecisions: []\nspecRef: spec.yaml\nsourceKind: repository-file\nsourceHash: '${sourceHash}'\napprovalRef: pending\napprovalHash: '${sourceHash}'\nimportMode: reference\n`);
      await writeDurable(join(staging, 'spec.yaml'), options.controllerAuthority ? JSON.stringify(options.controllerAuthority.spec) : `schemaVersion: 1\nsourceKind: repository-file\nsourceHash: '${sourceHash}'\napprovalRef: pending\napprovalHash: '${sourceHash}'\nimportMode: reference\n`);
      await writeDurable(join(staging, 'tasks.yaml'), options.controllerAuthority ? JSON.stringify(options.controllerAuthority.tasks) : 'schemaVersion: 1\ntasks: []\n'); await fsyncDirectory(staging);
      await writeDurable(intentPath, JSON.stringify(intent)); await fsyncDirectory(intentRoot);
      await mkdir(runtime); runtimeCreated = true; await fsyncDirectory(runtimeRoot);
      if (options.faultAt === 'after-runtime-created') { simulatedCrash = true; const error = new Error('Simulated crash') as Error & { code: string }; error.code = 'SIMULATED_CRASH'; throw error; }
      await rename(staging, artifacts); artifactsPublished = true; await fsyncDirectory(changesRoot);
      if (options.faultAt === 'after-artifact-published' || options.faultAt === 'after-workspace-published') { simulatedCrash = true; const error = new Error('Simulated crash') as Error & { code: string }; error.code = 'SIMULATED_CRASH'; throw error; }
      if (options.faultAt === 'after-artifact-published-error') throw new Error('Post-publish durability failure');
      if (!options.controllerAuthority) { await unlink(intentPath); await fsyncDirectory(intentRoot); }
      return { artifacts, runtime };
    } catch (error) {
      if (!simulatedCrash && !artifactsPublished) { await rm(staging, { recursive: true, force: true }); if (runtimeCreated) await rm(runtime, { recursive: true, force: true }); if (await exists(intentPath)) { await unlink(intentPath); await fsyncDirectory(intentRoot); } }
      throw error;
    }
  });
}
