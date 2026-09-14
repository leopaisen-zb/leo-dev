import { createHash, randomUUID } from 'node:crypto';
import { open, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import YAML from 'yaml';
import type { JournalEvent } from './types.js';
import type { Journal } from './journal.js';

export interface Snapshot { lastSequence: number; lastEventHash: string; state: unknown; stateDigest: string; }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contentDigest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export interface ControllerBatchOperation {
  type: string;
  taskId?: string;
  taskRevision?: number;
  leaseGeneration?: number;
  payload?: unknown;
}
export interface ControllerBatchProjection {
  relativePath: string;
  priorHash: string;
  desiredHash: string;
  desiredValue: unknown;
}
export type ControllerBatchProjectionState = { type: 'absent' } | { type: 'file'; mode: string; bytesBase64: string };
export interface ControllerBatchRecovery {
  kind: 'spec-revision' | 'release-evidence' | 'archive' | 'claim-continuation' | 'claim-design-review';
  subjectTreeHash: string;
  remainderHash: string;
  remainderEntries: string[];
  sources: Array<{ relativePath: string; sha256: string }>;
  projections: Array<{ relativePath: string; prior: ControllerBatchProjectionState; desired: ControllerBatchProjectionState }>;
}
export interface ControllerBatchPrepared {
  version: 1;
  batchId: string;
  kind: string;
  preparedAt?: string;
  operations: ControllerBatchOperation[];
  projections: ControllerBatchProjection[];
  recovery?: ControllerBatchRecovery;
}
export class ControllerBatchInvalidError extends Error { code = 'CONTROLLER_BATCH_INVALID' as const; }
const postRevisionEvidenceTypes = new Set([
  'run.claimed', 'controller.candidate.registered', 'controller.submit.accepted', 'controller.gate.result',
  'gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.released', 'gate.attempt.settled', 'gate.attempt.aborted', 'gate.attempt.denied',
]);

function preparedPayload(event: JournalEvent): ControllerBatchPrepared {
  const value = event.payload as Partial<ControllerBatchPrepared> | null;
  const validOperation = (operation: unknown): operation is ControllerBatchOperation => {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return false;
    const candidate = operation as ControllerBatchOperation;
    return typeof candidate.type === 'string' && candidate.type.length > 0 && !candidate.type.startsWith('controller.batch.');
  };
  const validProjection = (projection: unknown): projection is ControllerBatchProjection => {
    if (!projection || typeof projection !== 'object' || Array.isArray(projection)) return false;
    const candidate = projection as ControllerBatchProjection;
    return typeof candidate.relativePath === 'string' && candidate.relativePath.length > 0
      && /^[a-f0-9]{64}$/.test(candidate.priorHash) && /^[a-f0-9]{64}$/.test(candidate.desiredHash)
      && Object.hasOwn(candidate, 'desiredValue') && candidate.desiredHash === contentDigest(YAML.stringify(candidate.desiredValue));
  };
  const validState = (state: unknown): state is ControllerBatchProjectionState => {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
    const candidate = state as Record<string, unknown>;
    if (candidate.type === 'absent') return Object.keys(candidate).length === 1;
    return candidate.type === 'file' && typeof candidate.mode === 'string' && /^[0-7]{3}$/.test(candidate.mode)
      && typeof candidate.bytesBase64 === 'string' && Buffer.from(candidate.bytesBase64, 'base64').toString('base64') === candidate.bytesBase64;
  };
  const validRecovery = (recovery: unknown): recovery is ControllerBatchRecovery => {
    if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) return false;
    const candidate = recovery as Partial<ControllerBatchRecovery>;
    return ['spec-revision', 'release-evidence', 'archive', 'claim-continuation', 'claim-design-review'].includes(String(candidate.kind)) && typeof candidate.subjectTreeHash === 'string' && /^[a-f0-9]{64}$/.test(candidate.subjectTreeHash)
      && typeof candidate.remainderHash === 'string' && /^[a-f0-9]{64}$/.test(candidate.remainderHash)
      && Array.isArray(candidate.remainderEntries) && candidate.remainderEntries.every((entry) => typeof entry === 'string')
      && Array.isArray(candidate.sources) && candidate.sources.every((source) => source && typeof source === 'object' && !Array.isArray(source)
        && typeof (source as { relativePath?: unknown }).relativePath === 'string' && /^[a-f0-9]{64}$/.test(String((source as { sha256?: unknown }).sha256)))
      && Array.isArray(candidate.projections) && (candidate.projections.length > 0 || candidate.kind === 'claim-continuation' || candidate.kind === 'claim-design-review')
      && candidate.projections.every((projection) => projection && typeof projection === 'object' && !Array.isArray(projection)
        && typeof (projection as { relativePath?: unknown }).relativePath === 'string'
        && validState((projection as { prior?: unknown }).prior) && validState((projection as { desired?: unknown }).desired));
  };
  if (value?.version !== 1 || typeof value.batchId !== 'string' || !value.batchId || typeof value.kind !== 'string' || !value.kind
    || (value.preparedAt !== undefined && (typeof value.preparedAt !== 'string' || Number.isNaN(Date.parse(value.preparedAt))))
    || !Array.isArray(value.operations) || !value.operations.every(validOperation)
    || !Array.isArray(value.projections) || !value.projections.every(validProjection)
    || (value.recovery !== undefined && !validRecovery(value.recovery))) {
    throw new ControllerBatchInvalidError('Controller batch prepared frame is invalid');
  }
  return value as ControllerBatchPrepared;
}

// Only events projected from an actual batch may carry the special recovery transition.
const projectedContinuationGuards = new WeakSet<JournalEvent>();

export function projectJournalEvents(events: JournalEvent[]): { events: JournalEvent[]; committedProjections: ControllerBatchProjection[]; pending?: { event: JournalEvent; batch: ControllerBatchPrepared } } {
  const projected: JournalEvent[] = [];
  const committedProjections: ControllerBatchProjection[] = [];
  const seen = new Set<string>();
  let pending: { event: JournalEvent; batch: ControllerBatchPrepared } | undefined;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (event.type === 'controller.batch.prepared') {
      const batch = preparedPayload(event);
      if (seen.has(batch.batchId)) throw new ControllerBatchInvalidError(`Duplicate controller batch ${batch.batchId}`);
      seen.add(batch.batchId);
      const next = events[index + 1];
      if (!next) { pending = { event, batch }; break; }
      if (next.type !== 'controller.batch.committed') throw new ControllerBatchInvalidError(`Controller batch ${batch.batchId} commit is not adjacent`);
      const commit = next.payload as Record<string, unknown> | null;
      if (commit?.version !== 1 || commit.batchId !== batch.batchId || commit.preparedEventHash !== event.eventHash || next.changeId !== event.changeId) {
        throw new ControllerBatchInvalidError(`Controller batch ${batch.batchId} commit binding is invalid`);
      }
      for (const operation of batch.operations) {
        const logical: JournalEvent = {
          sequence: next.sequence,
          previousEventHash: next.previousEventHash,
          changeId: event.changeId,
          ...(operation.taskId === undefined ? {} : { taskId: operation.taskId }),
          ...(operation.taskRevision === undefined ? {} : { taskRevision: operation.taskRevision }),
          ...(operation.leaseGeneration === undefined ? {} : { leaseGeneration: operation.leaseGeneration }),
          type: operation.type,
          timestamp: next.timestamp,
          payloadHash: next.payloadHash,
          payload: operation.payload ?? null,
          eventHash: next.eventHash,
        };
        if (operation.type === 'task.continuation.recovered') {
          if (batch.kind !== 'claim-continuation') throw new ControllerBatchInvalidError('Continuation guard belongs to a different batch kind');
          projectedContinuationGuards.add(logical);
        }
        projected.push(logical);
      }
      committedProjections.push(...batch.projections);
      index += 1;
      continue;
    }
    if (event.type === 'task.continuation.recovered' && !projectedContinuationGuards.has(event)) throw new ControllerBatchInvalidError('Unbatched continuation guard');
    if (event.type === 'controller.batch.committed') throw new ControllerBatchInvalidError('Orphan or duplicate controller batch commit');
    projected.push(event);
  }
  return { events: projected, committedProjections, ...(pending ? { pending } : {}) };
}
export interface LifecycleSnapshotState { changeId?: string; changeState: string; tasks: Record<string, { state: string; revision?: number; leaseGeneration?: number }>; runs: Record<string, { state: string; taskId?: string }>; leases: Record<string, { generation: number; active: boolean }>; blockers: string[]; }
export function reduceJournal(events: JournalEvent[]): LifecycleSnapshotState {
  const state: LifecycleSnapshotState = { changeState: 'triage', tasks: {}, runs: {}, leases: {}, blockers: [] };
  const taskRevisions = new Map<string, number>();
  const runOwners = new Map<string, { taskId: string; taskRevision: number; leaseGeneration?: number }>();
  let revisedEpoch = false;
  for (const event of projectJournalEvents(events).events) {
    state.changeId ??= event.changeId;
    const payload = event.payload as Record<string, unknown> | null;
    if (event.type === 'controller.spec.revised') revisedEpoch = true;
    if (revisedEpoch && postRevisionEvidenceTypes.has(event.type)) {
      const currentRevision = typeof event.taskId === 'string' ? taskRevisions.get(event.taskId) : undefined;
      const owner = event.type === 'run.claimed' ? payload?.lease as Record<string, unknown> | undefined : payload;
      const ownerGeneration = event.type === 'run.claimed' ? owner?.generation : owner?.leaseGeneration;
      if (typeof event.taskId !== 'string' || currentRevision === undefined || event.taskRevision !== currentRevision || !Number.isSafeInteger(event.leaseGeneration)
        || owner?.taskId !== event.taskId || owner.taskRevision !== event.taskRevision || ownerGeneration !== event.leaseGeneration) {
        throw new ControllerBatchInvalidError(`Post-revision ${event.type} evidence is missing or mismatches its current task authority envelope`);
      }
    }
    if (revisedEpoch && event.type === 'run.transition'
      && (typeof event.taskId !== 'string' || !Number.isSafeInteger(event.taskRevision) || !Number.isSafeInteger(event.leaseGeneration))) {
      throw new ControllerBatchInvalidError('Post-revision Run transition is missing its task, revision, or lease-generation envelope');
    }
    if (event.type === 'route.selected' && event.taskId && event.taskRevision && payload && typeof payload.task === 'object' && payload.task !== null) {
      const task = payload.task as Record<string, unknown>;
      if (typeof task.state === 'string') {
        const prior = taskRevisions.get(event.taskId);
        if (prior !== undefined && event.taskRevision <= prior) throw new ControllerBatchInvalidError(`Task ${event.taskId} route revision did not advance`);
        taskRevisions.set(event.taskId, event.taskRevision);
      }
    } else if (revisedEpoch && event.taskId) {
      const currentRevision = taskRevisions.get(event.taskId);
      if (currentRevision === undefined || event.taskRevision !== currentRevision) throw new ControllerBatchInvalidError(`Post-revision event for ${event.taskId} does not bind the current task revision`);
      const lease = payload?.lease as Record<string, unknown> | undefined;
      if (lease && (lease.taskId !== event.taskId || lease.taskRevision !== currentRevision || (event.leaseGeneration !== undefined && lease.generation !== event.leaseGeneration))) {
        throw new ControllerBatchInvalidError(`Post-revision lease event for ${event.taskId} has a stale or spoofed lease binding`);
      }
      if (event.type === 'run.transition' && typeof payload?.runId === 'string') {
        const owner = runOwners.get(payload.runId);
        const leaseGeneration = state.leases[event.taskId]?.generation;
        if (!Number.isSafeInteger(event.leaseGeneration) || event.leaseGeneration !== leaseGeneration
          || (owner && (owner.taskId !== event.taskId || owner.taskRevision !== currentRevision || owner.leaseGeneration !== event.leaseGeneration))) {
          throw new ControllerBatchInvalidError(`Post-revision Run ${payload.runId} belongs to an earlier task revision`);
        }
      }
      if (event.type === 'lease.claimed') {
        const previousGeneration = state.leases[event.taskId]?.generation ?? 0;
        if (!Number.isSafeInteger(event.leaseGeneration) || event.leaseGeneration! <= previousGeneration) {
          throw new ControllerBatchInvalidError(`Post-revision lease claim for ${event.taskId} did not advance its generation`);
        }
      }
      if (event.type === 'lease.released' || event.type === 'lease.abandoned') {
        const currentLease = state.leases[event.taskId];
        if (!currentLease?.active || !Number.isSafeInteger(event.leaseGeneration) || event.leaseGeneration !== currentLease.generation) {
          throw new ControllerBatchInvalidError(`Post-revision lease release for ${event.taskId} is not the current active generation`);
        }
      }
    }
    if (event.type === 'change.transition' && typeof payload?.to === 'string') state.changeState = payload.to;
    if (event.type === 'route.selected' && event.taskId && event.taskRevision && payload && typeof payload.task === 'object' && payload.task !== null) {
      const task = payload.task as Record<string, unknown>;
      if (typeof task.state === 'string') state.tasks[event.taskId] = { state: task.state, revision: event.taskRevision };
    }
    if (event.type === 'task.transition' && event.taskId && typeof payload?.to === 'string') state.tasks[event.taskId] = { state: payload.to, revision: event.taskRevision, leaseGeneration: event.leaseGeneration };
    if (event.type === 'task.continuation.recovered' && event.taskId && Number.isSafeInteger(event.taskRevision)) {
      state.tasks[event.taskId] = { state: 'ready', revision: event.taskRevision, leaseGeneration: event.leaseGeneration };
    }
    if (event.type === 'run.transition' && typeof payload?.runId === 'string' && typeof payload?.to === 'string') {
      const owner = runOwners.get(payload.runId);
      if (!owner && event.taskId && event.taskRevision) runOwners.set(payload.runId, { taskId: event.taskId, taskRevision: event.taskRevision, ...(event.leaseGeneration === undefined ? {} : { leaseGeneration: event.leaseGeneration }) });
      state.runs[payload.runId] = { state: payload.to, taskId: event.taskId };
    }
    if (event.type === 'lease.claimed' && event.taskId && event.leaseGeneration) state.leases[event.taskId] = { generation: event.leaseGeneration, active: true };
    if ((event.type === 'lease.released' || event.type === 'lease.abandoned') && event.taskId) state.leases[event.taskId] = { generation: event.leaseGeneration ?? state.leases[event.taskId]?.generation ?? 0, active: false };
    if (event.type === 'blocker.recorded' && typeof payload?.blockerId === 'string') state.blockers.push(payload.blockerId);
  }
  return state;
}
export async function writeSnapshot(path: string, journal: Journal): Promise<Snapshot> {
  return journal.withExclusive(async (transaction) => {
    const events = (await transaction.replay()).events;
    const event = events.at(-1); const state = reduceJournal(events);
    const snapshot = { lastSequence: event?.sequence ?? 0, lastEventHash: event?.eventHash ?? '0'.repeat(64), state, stateDigest: digest(state) };
    const temporary = join(dirname(path), `.snapshot-${process.pid}-${randomUUID()}.tmp`);
    const handle = await open(temporary, 'w'); try { await handle.writeFile(JSON.stringify(snapshot)); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, path);
    const directory = await open(dirname(path), 'r'); try { await directory.sync(); } finally { await directory.close(); }
    return snapshot;
  });
}

/** Snapshots are caches only: disagreement always falls back to verified journal replay. */
export async function recoverSnapshot(path: string, journal: Journal): Promise<{ snapshot?: Snapshot; events: JournalEvent[]; replayed: boolean }> {
  return journal.withExclusive(async (transaction) => {
    const replay = await transaction.replay(); const last = replay.events.at(-1); const state = reduceJournal(replay.events);
    try {
      const snapshot = JSON.parse(await readFile(path, 'utf8')) as Snapshot;
      if (snapshot.lastSequence === (last?.sequence ?? 0) && snapshot.lastEventHash === (last?.eventHash ?? '0'.repeat(64)) && snapshot.stateDigest === digest(state) && JSON.stringify(snapshot.state) === JSON.stringify(state)) return { snapshot, events: replay.events, replayed: false };
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    return { events: replay.events, replayed: true };
  });
}
