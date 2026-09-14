import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import YAML from 'yaml';
import { assertContained } from '../changes/artifacts.js';
import { canonicalTreeHash, TREE_IGNORE_POLICY_VERSION } from '../repository/tree-hash.js';
import type { Journal, JournalTransaction } from '../state/journal.js';
import { projectJournalEvents, type ControllerBatchOperation, type ControllerBatchPrepared, type ControllerBatchProjection, type ControllerBatchProjectionState, type ControllerBatchRecovery } from '../state/snapshot.js';
import type { JournalEvent } from '../state/types.js';

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export class ControllerBatchConflictError extends Error { code = 'CONTROLLER_BATCH_CONFLICT' as const; }
export class CommittedProjectionDriftError extends Error { code = 'COMMITTED_PROJECTION_DRIFT' as const; }

export type ControllerBatchFault = 'after-batch-prepared' | 'after-batch-projection';

function simulatedCrash(point: ControllerBatchFault, requested: unknown): void {
  if (requested !== point) return;
  const error = new Error(`Simulated crash at ${point}`) as Error & { code: string };
  error.code = 'SIMULATED_CRASH';
  throw error;
}

function serialize(value: unknown): string {
  return YAML.stringify(value);
}

async function currentHash(path: string): Promise<string> {
  try { return digest(await readFile(path)); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return digest('');
    throw error;
  }
}

async function durableProjectionWrite(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${process.pid}-${randomUUID()}.batch.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(serialize(value)); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, path);
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}

async function projectionState(path: string): Promise<ControllerBatchProjectionState> {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new ControllerBatchConflictError(`Controller batch projection has unsupported path type: ${path}`);
    return { type: 'file', mode: (info.mode & 0o777).toString(8).padStart(3, '0'), bytesBase64: (await readFile(path)).toString('base64') };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { type: 'absent' };
    throw error;
  }
}

function sameState(left: ControllerBatchProjectionState, right: ControllerBatchProjectionState): boolean {
  return left.type === right.type && (left.type === 'absent' || (left.mode === (right as Extract<ControllerBatchProjectionState, { type: 'file' }>).mode && left.bytesBase64 === (right as Extract<ControllerBatchProjectionState, { type: 'file' }>).bytesBase64));
}

function remainderHash(entries: string[], excluded: Set<string>): string {
  return digest(`${TREE_IGNORE_POLICY_VERSION}\n${entries.filter((entry) => !excluded.has(entry.split('\0', 1)[0]!)).join('\n')}`);
}

function stateEntry(relativePath: string, state: ControllerBatchProjectionState): string | undefined {
  return state.type === 'file' ? `${relativePath}\0${state.mode}\0${digest(Buffer.from(state.bytesBase64, 'base64'))}` : undefined;
}

function treeHash(entries: string[]): string {
  const canonicalPathOrder = (left: string, right: string): number => {
    const leftSegments = left.split('\0', 1)[0]!.split('/');
    const rightSegments = right.split('\0', 1)[0]!.split('/');
    for (let index = 0; index < Math.min(leftSegments.length, rightSegments.length); index += 1) {
      const order = Buffer.from(leftSegments[index]!).compare(Buffer.from(rightSegments[index]!));
      if (order !== 0) return order;
    }
    return leftSegments.length - rightSegments.length;
  };
  return digest(`${TREE_IGNORE_POLICY_VERSION}\n${[...entries].sort(canonicalPathOrder).join('\n')}`);
}

async function projectionPath(repositoryRoot: string, changeId: string, projection: ControllerBatchProjection): Promise<string> {
  if (projection.relativePath.split(/[\\/]/).includes('..') || resolve(repositoryRoot, projection.relativePath) === repositoryRoot) {
    throw new ControllerBatchConflictError('Controller batch projection path is not repository-contained');
  }
  const root = await realpath(repositoryRoot);
  const path = resolve(root, projection.relativePath);
  await assertContained(root, path);
  const allowedRoot = join(root, '.leo-dev', 'changes', changeId);
  const allowed = new Set(['manifest.yaml', 'spec.yaml', 'tasks.yaml', 'release.yaml', 'archive.yaml'].map((name) => join(allowedRoot, name)));
  const assessmentRoot = join(allowedRoot, 'assessments');
  const assessmentName = relative(assessmentRoot, path);
  const assessmentProjection = assessmentName !== '' && !assessmentName.startsWith(`..${sep}`) && !assessmentName.includes(sep) && /^[a-f0-9]{64}\.yaml$/.test(assessmentName);
  const revisionRoot = join(allowedRoot, 'spec-revisions');
  const revisionName = relative(revisionRoot, path);
  const revisionProjection = revisionName !== '' && !revisionName.startsWith(`..${sep}`) && !revisionName.includes(sep) && /^[a-f0-9]{64}\.yaml$/.test(revisionName);
  if (!allowed.has(path) && !assessmentProjection && !revisionProjection) throw new ControllerBatchConflictError(`Controller batch projection is outside the change artifacts: ${projection.relativePath}`);
  return path;
}

async function planProjections(repositoryRoot: string, changeId: string, projections: ControllerBatchProjection[]): Promise<Array<{ path: string; projection: ControllerBatchProjection; current: string }>> {
  const planned: Array<{ path: string; projection: ControllerBatchProjection; current: string }> = [];
  for (const projection of projections) {
    if (projection.desiredHash !== digest(serialize(projection.desiredValue))) throw new ControllerBatchConflictError(`Controller batch desired hash is invalid: ${projection.relativePath}`);
    const path = await projectionPath(repositoryRoot, changeId, projection);
    const current = await currentHash(path);
    if (current !== projection.priorHash && current !== projection.desiredHash) throw new ControllerBatchConflictError(`Controller batch projection has a third value: ${projection.relativePath}`);
    planned.push({ path, projection, current });
  }
  return planned;
}

async function applyProjections(repositoryRoot: string, changeId: string, projections: ControllerBatchProjection[]): Promise<void> {
  const planned = await planProjections(repositoryRoot, changeId, projections);
  for (const item of planned) if (item.current === item.projection.priorHash) await durableProjectionWrite(item.path, item.projection.desiredValue);
}

/** Captures only the exact projection values; all other bytes remain represented by the canonical remainder identity. */
// The original revision proof is also used by release finalization; the default preserves the revision contract.
export async function captureSpecRevisionRecovery(repositoryRoot: string, changeId: string, projections: ControllerBatchProjection[], subjectTreeHash: string, sources: Array<{ relativePath: string; sha256: string }>, kind: ControllerBatchRecovery['kind'] = 'spec-revision'): Promise<ControllerBatchRecovery> {
  const snapshots: ControllerBatchRecovery['projections'] = [];
  for (const projection of projections) {
    const path = await projectionPath(repositoryRoot, changeId, projection);
    snapshots.push({ relativePath: projection.relativePath, prior: await projectionState(path), desired: { type: 'file', mode: '600', bytesBase64: Buffer.from(serialize(projection.desiredValue)).toString('base64') } });
  }
  const tree = await canonicalTreeHash(repositoryRoot);
  if (tree.hash !== subjectTreeHash) throw new ControllerBatchConflictError('Spec revision inputs drifted after assessment approval');
  const excluded = new Set(snapshots.map((snapshot) => snapshot.relativePath));
  const remainderEntries = tree.entries.filter((entry) => !excluded.has(entry.split('\0', 1)[0]!));
  return { kind, subjectTreeHash, remainderHash: remainderHash(tree.entries, excluded), remainderEntries, sources, projections: snapshots };
}

export function validateSpecRevisionRecoveryProof(batch: ControllerBatchPrepared): ControllerBatchRecovery | undefined {
  const recovery = batch.recovery;
  if (!['spec-revision', 'release-evidence', 'archive', 'claim-continuation', 'claim-design-review'].includes(batch.kind)) {
    if (recovery) throw new ControllerBatchConflictError('Only a spec-revision batch may carry spec revision recovery proof');
    return undefined;
  }
  if (!recovery) throw new ControllerBatchConflictError('Spec revision batch is missing its required recovery proof');
  if (recovery.kind !== batch.kind) throw new ControllerBatchConflictError('Unsupported controller batch recovery binding');
  if (['claim-continuation', 'claim-design-review'].includes(batch.kind) && batch.projections.length !== 0) throw new ControllerBatchConflictError('Claim continuation recovery cannot project controller artifacts');
  const paths = new Set(batch.projections.map((projection) => projection.relativePath));
  const recoveryPaths = new Set(recovery.projections.map((projection) => projection.relativePath));
  if (paths.size !== batch.projections.length || recoveryPaths.size !== recovery.projections.length || recovery.projections.length !== batch.projections.length
    || recovery.projections.some((projection) => !paths.has(projection.relativePath))) throw new ControllerBatchConflictError('Spec revision recovery projections do not exactly match the pending batch');
  const expectedRemainderHash = digest(`${TREE_IGNORE_POLICY_VERSION}\n${recovery.remainderEntries.join('\n')}`);
  if (recovery.remainderHash !== expectedRemainderHash || recovery.remainderEntries.some((entry) => paths.has(entry.split('\0', 1)[0]!))) {
    throw new ControllerBatchConflictError('Spec revision recovery remainder identity is invalid');
  }
  const priorEntries = [...recovery.remainderEntries];
  for (const projection of batch.projections) {
    const snapshot = recovery.projections.find((candidate) => candidate.relativePath === projection.relativePath)!;
    const desired: ControllerBatchProjectionState = { type: 'file', mode: '600', bytesBase64: Buffer.from(serialize(projection.desiredValue)).toString('base64') };
    const priorHash = snapshot.prior.type === 'absent' ? digest('') : digest(Buffer.from(snapshot.prior.bytesBase64, 'base64'));
    if (!sameState(snapshot.desired, desired) || priorHash !== projection.priorHash) throw new ControllerBatchConflictError(`Spec revision recovery projection proof is invalid: ${projection.relativePath}`);
    const entry = stateEntry(projection.relativePath, snapshot.prior); if (entry) priorEntries.push(entry);
  }
  if (treeHash(priorEntries) !== recovery.subjectTreeHash) throw new ControllerBatchConflictError('Spec revision recovery prior tree does not match the approved subject identity');
  return recovery;
}

async function validateSpecRevisionRecovery(repositoryRoot: string, changeId: string, batch: ControllerBatchPrepared): Promise<void> {
  const recovery = validateSpecRevisionRecoveryProof(batch);
  if (!recovery) return;
  if (new Set(recovery.sources.map((source) => source.relativePath)).size !== recovery.sources.length) throw new ControllerBatchConflictError('Spec revision recovery source identities are duplicated');
  for (const source of recovery.sources) {
    const path = await projectionPathForSource(repositoryRoot, source.relativePath);
    if (digest(await readFile(path)) !== source.sha256) throw new ControllerBatchConflictError(`Spec revision bound source has drifted: ${source.relativePath}`);
  }
  const paths = new Set(batch.projections.map((projection) => projection.relativePath));
  const tree = await canonicalTreeHash(repositoryRoot);
  if (remainderHash(tree.entries, paths) !== recovery.remainderHash) throw new ControllerBatchConflictError('Spec revision recovery remainder tree has drifted');
  for (const snapshot of recovery.projections) {
    const path = await projectionPath(repositoryRoot, changeId, batch.projections.find((projection) => projection.relativePath === snapshot.relativePath)!);
    const current = await projectionState(path);
    if (!sameState(current, snapshot.prior) && !sameState(current, snapshot.desired)) throw new ControllerBatchConflictError(`Spec revision recovery projection has a third value: ${snapshot.relativePath}`);
  }
}

async function projectionPathForSource(repositoryRoot: string, relativePath: string): Promise<string> {
  if (relativePath.split(/[\\/]/).includes('..') || resolve(repositoryRoot, relativePath) === repositoryRoot) throw new ControllerBatchConflictError('Spec revision source path is not repository-contained');
  const root = await realpath(repositoryRoot); const path = resolve(root, relativePath); await assertContained(root, path); return path;
}

export async function preflightControllerBatchRecovery(repositoryRoot: string, changeId: string, rawEvents: JournalEvent[]): Promise<boolean> {
  const projected = projectJournalEvents(rawEvents);
  if (!projected.pending) return false;
  await validateSpecRevisionRecovery(repositoryRoot, changeId, projected.pending.batch);
  await planProjections(repositoryRoot, changeId, projected.pending.batch.projections);
  return true;
}

async function appendPrepared(transaction: JournalTransaction, changeId: string, batch: ControllerBatchPrepared, prepare: (timestamp: string) => void, expectedTailHash?: string): Promise<JournalEvent> {
  const inputAt = (timestamp: string) => { prepare(timestamp); return { changeId, type: 'controller.batch.prepared', payload: batch }; };
  if (expectedTailHash) return transaction.appendIfTailAt(inputAt, expectedTailHash);
  const replay = await transaction.replay();
  if (replay.discardedIncompleteTail || replay.events.length !== 0) throw new ControllerBatchConflictError('Controller batch expected an empty journal');
  return transaction.appendAt(inputAt);
}

export async function buildProjection(repositoryRoot: string, changeId: string, absolutePath: string, desiredValue: unknown): Promise<ControllerBatchProjection> {
  const root = await realpath(repositoryRoot);
  const path = resolve(absolutePath);
  await assertContained(root, path);
  const relativePath = relative(root, path).split(sep).join('/');
  await projectionPath(root, changeId, { relativePath, priorHash: digest(''), desiredHash: digest(serialize(desiredValue)), desiredValue });
  return { relativePath, priorHash: await currentHash(path), desiredHash: digest(serialize(desiredValue)), desiredValue };
}

export interface CommitControllerBatchInput {
  repositoryRoot: string;
  changeId: string;
  journal: Journal;
  priorEvents: JournalEvent[];
  kind: string;
  operations: ControllerBatchOperation[];
  projections?: ControllerBatchProjection[];
  recovery?: ControllerBatchRecovery;
  validatePrepared?: (batch: ControllerBatchPrepared, preparedAt: Date) => void;
  faultAt?: unknown;
}

export async function commitControllerBatch(input: CommitControllerBatchInput): Promise<void> {
  const batch: ControllerBatchPrepared = {
    version: 1,
    batchId: randomUUID(),
    kind: input.kind,
    operations: input.operations,
    projections: input.projections ?? [],
    ...(input.recovery ? { recovery: input.recovery } : {}),
  };
  const expectedTailHash = input.priorEvents.at(-1)?.eventHash;
  await input.journal.withExclusive(async (transaction) => {
    await validateSpecRevisionRecovery(input.repositoryRoot, input.changeId, batch);
    const prepared = await appendPrepared(transaction, input.changeId, batch, (timestamp) => {
      if (input.kind === 'spec-revision' || input.validatePrepared) batch.preparedAt = timestamp;
      input.validatePrepared?.(batch, new Date(timestamp));
    }, expectedTailHash);
    simulatedCrash('after-batch-prepared', input.faultAt);
    await applyProjections(input.repositoryRoot, input.changeId, batch.projections);
    simulatedCrash('after-batch-projection', input.faultAt);
    await transaction.appendIfTail({ changeId: input.changeId, type: 'controller.batch.committed', payload: { version: 1, batchId: batch.batchId, preparedEventHash: prepared.eventHash } }, prepared.eventHash);
  });
}

export async function recoverControllerBatch(repositoryRoot: string, changeId: string, journal: Journal, rawEvents: JournalEvent[]): Promise<boolean> {
  const projected = projectJournalEvents(rawEvents);
  if (!projected.pending) return false;
  const { event: prepared, batch } = projected.pending;
  await journal.withExclusive(async (transaction) => {
    const replay = await transaction.replay();
    const current = projectJournalEvents(replay.events);
    if (!current.pending || current.pending.event.eventHash !== prepared.eventHash || replay.events.at(-1)?.eventHash !== prepared.eventHash) {
      throw new ControllerBatchConflictError('Pending controller batch changed before recovery');
    }
    await validateSpecRevisionRecovery(repositoryRoot, changeId, batch);
    await applyProjections(repositoryRoot, changeId, batch.projections);
    await transaction.appendIfTail({ changeId, type: 'controller.batch.committed', payload: { version: 1, batchId: batch.batchId, preparedEventHash: prepared.eventHash } }, prepared.eventHash);
  });
  return true;
}

export async function assertProjectionValue(path: string, projection: ControllerBatchProjection): Promise<void> {
  const current = await currentHash(path);
  if (current !== projection.desiredHash) throw new CommittedProjectionDriftError(`Committed artifact projection has drifted: ${projection.relativePath}`);
}
