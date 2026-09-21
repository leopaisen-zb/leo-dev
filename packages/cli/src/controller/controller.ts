import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { assertChangeId, assertContained } from '../changes/artifacts.js';
import { completeControllerInitialization, initializeChangeWorkspace, readControllerInitAuthority, type ControllerInitAuthority } from '../changes/init.js';
import { prepareSpecRevision, revisionApprovalContext, SpecRevisionConflictError, SpecRevisionError, validateSpecRevisionRecord, type RevisionAuthority, type RevisionRoute, type SpecRevisionRecord } from '../changes/spec-revision.js';
import { TaskPlanError, validateTaskPlan } from '../changes/task-plan.js';
import { normalizedPlanHash, routedRisk, type DesignReviewContext } from '../changes/design-policy.js';
import { DesignEventDecodeError, decodeDesignReviewEvent, latestDesignReviewContext, type DesignEventInput, type DesignReviewReceipt } from '../changes/design-events.js';
import { DesignAdmissionError, approveDesignReview, assertFreshApprovedDesign, claimDesignReceiptPlan, decodeDesignAdmissionHistory, rejectDesignReview, requestDesignReview, validateClaimDesignEvidence, type AcquiredDesignReceipt, type DesignAdmissionHistory, type PreparedDesignReceipt } from '../changes/design-admission.js';
import { archiveContext, contentHash, frozenSubjectCurrent, readRepositoryFile, readRepositoryJson, releaseProofHash, type ReleaseProof } from '../changes/release-proof.js';
import { evidenceFilePath, GateEvidenceError, loadGateEvidence } from '../gates/evidence.js';
import { GateRegistry, GateRegistryError, fingerprint, gateDefinitionFingerprint } from '../gates/registry.js';
import { approvalFingerprintFields, GateRunError, GateRunIndeterminateError, GateRunner, type GateSettlementInspectionRequest, type VerifiedGateSettlement } from '../gates/runner.js';
import { assess, AssessmentError, loadAssessmentInput, validateRecordedAssessment, verifyRecordedHistory, type RecordedAssessment } from '../governance/assessment.js';
import { captureBaseline, type Baseline } from '../repository/baseline.js';
import { canonicalTreeHash, TREE_IGNORE_POLICY_VERSION } from '../repository/tree-hash.js';
import { runtimePaths } from '../runtime/paths.js';
import { normalizeRepositoryPath } from '../security/paths.js';
import { loadSchema } from '../schema/load.js';
import { validateDocument, validateReceipt, validateTaskDefinition, type ReceiptKind } from '../schema/validate.js';
import { decideFailedAttempt, failedAttemptCount, previousFindingsHash } from '../state/attempt-policy.js';
import { currentIndependentPass, independentReviewSession } from '../state/commit-pass.js';
import { Journal, JournalCorruptError, JournalTailMismatchError, recoverJournal, type JournalObservation } from '../state/journal.js';
import { boardColumn, reviewBadge } from '../board/columns.js';
import type { BoardBlocker, BoardEvidence, BoardObservation, BoardTaskObservation, RecordedTeamObservation } from '../board/types.js';
import type { Lease } from '../state/lease.js';
import { ControllerBatchInvalidError, projectJournalEvents, recoverSnapshot, reduceJournal, type ControllerBatchOperation, type ControllerBatchPrepared, type LifecycleSnapshotState } from '../state/snapshot.js';
import { reconcileUnknown, transitionChange, transitionRun, transitionTask, type TransitionResult } from '../state/transition.js';
import type { ChangeState, JournalEvent, TaskDefinition } from '../state/types.js';
import { ControllerError, result, type CommandOptions, type CommandResult, type ExitCode } from './types.js';
import { assertProjectionValue, buildProjection, captureSpecRevisionRecovery, commitControllerBatch, CommittedProjectionDriftError, ControllerBatchConflictError, preflightControllerBatchRecovery, recoverControllerBatch, validateSpecRevisionRecoveryProof } from './batch.js';
import { TeamProtocolError, loadTeamRecord, planTeamRecord, projectTeam } from '../team/protocol.js';

type RecordValue = Record<string, unknown>;
type Routed = { task: TaskDefinition; taskHash: string; registryPath: string; gateDefinitionHash: string };
type Initialized = { baseline: Baseline; specPath: string; specHash: string };
type Claimed = { runId: string; lease: Lease; operationFingerprint: string; inputEntries?: string[]; sessionId?: string; attemptKind?: 'initial' | 'remediation' | 'fresh-debug' };
type ClaimDesignReceipt = { receipt: RecordValue; source: { relativePath: string; sha256: string; bytesBase64: string }; designSource: { relativePath: string; sha256: string } };
type ClaimContinuation = { claimed: Claimed; inputTree: { hash: string; entries: string[] } };
type ClaimPlan = {
  routed: Routed;
  currentTaskState: 'ready' | 'remediation';
  nextKind: 'initial' | 'remediation' | 'fresh-debug';
  sessionId?: string;
  inputTree: { hash: string; entries: string[] };
  continuation?: ClaimContinuation;
  designReceipt?: ClaimDesignReceipt;
};
type CandidateBinding = {
  runId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  claimInputTreeHash: string;
  treeHash: string;
  specHash: string;
  taskHash: string;
};
type SubmittedCandidate = {
  runId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  specHash: string;
  taskHash: string;
  treeHash: string;
};
type ReleaseRecord = { proof: ReleaseProof; proofHash: string };
type ReviewRecoveryPayload = SubmittedCandidate & {
  schemaVersion: 1;
  recoveryId: string;
  claimEventHash: string;
  candidateEventHash: string;
  gateResultEventHash: string;
  submitEventHash: string;
  gateAttemptId: string;
  gateTerminalEventHash: string;
  gateId: string;
  gateStatus: 'succeeded';
  gateEvidenceRef: string;
};
type ReviewRecoveryRecord = { event: JournalEvent; payload: ReviewRecoveryPayload };
type BoardReviewSelection = {
  receiptEvent: JournalEvent;
  submittedEvent: JournalEvent;
  submitted: SubmittedCandidate;
  claimed: Claimed;
  candidate: CandidateBinding;
};
type UnknownContext = {
  runId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  operationFingerprint: string;
  inputTreeHash: string;
  evidenceHashes: string[];
  priorChangeState: ChangeState;
  resumeTaskStateOnSuccess: 'verifying' | 'review-required' | 'reviewing';
  retryRemaining: boolean;
};

const moduleRepositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const stateChanging = new Set(['init', 'route', 'start', 'revise', 'transition', 'claim', 'run-gates', 'submit', 'review', 'approve', 'waive', 'resolve', 'reconcile', 'resume']);
const maxGateOutputBytes = 64 * 1024;
type JournalInput = ControllerBatchOperation & { changeId?: string };

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

function stringOption(options: CommandOptions, name: string, required = true): string | undefined {
  const value = options[name];
  if (typeof value === 'string' && value.trim()) return value;
  if (!required) return undefined;
  throw new ControllerError(2, 'VALIDATION_ERROR', `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
}

function positiveInteger(value: unknown, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  const number = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(number) || (number as number) < 1) throw new ControllerError(2, 'VALIDATION_ERROR', `${label} must be a positive integer`);
  return number as number;
}

function boundedGateOutput(value: unknown): number {
  const bytes = positiveInteger(value, maxGateOutputBytes, '--max-output-bytes');
  if (bytes > maxGateOutputBytes) throw new ControllerError(2, 'VALIDATION_ERROR', `--max-output-bytes cannot exceed the controller hard cap of ${maxGateOutputBytes}`);
  return bytes;
}

function latestPayload<T>(events: JournalEvent[], type: string): T | undefined {
  const event = events.filter((candidate) => candidate.type === type).at(-1);
  return event ? record(event.payload) as T : undefined;
}

function latestTaskPayload<T>(events: JournalEvent[], type: string, taskId: string): T | undefined {
  const event = events.filter((candidate) => candidate.type === type && candidate.taskId === taskId).at(-1);
  return event ? record(event.payload) as T : undefined;
}

function currentStartAuthorization(events: JournalEvent[]): { goal: string; goalHash: string } | undefined {
  let latestIndex = -1;
  for (let index = 0; index < events.length; index += 1) {
    if (events[index]!.type === 'controller.start.authorized') latestIndex = index;
  }
  if (latestIndex < 0) return undefined;
  const competingReject = events.slice(latestIndex + 1).some((event) => {
    if (event.type !== 'receipt.approval.ingested') return false;
    const receipt = record(record(event.payload).receipt);
    return receipt.operationKind === 'spec-approval' && receipt.decision === 'reject';
  });
  if (competingReject) return undefined;
  const payload = record(events[latestIndex]!.payload);
  if (typeof payload.goal !== 'string' || typeof payload.goalHash !== 'string') return undefined;
  return { goal: payload.goal, goalHash: payload.goalHash };
}

export function teamMutationBarrierReason(events: JournalEvent[]): string | undefined {
  let latestGateEvent: JournalEvent | undefined;
  for (const event of events) {
    if (!event.type.startsWith('gate.attempt.')) continue;
    const attemptId = record(event.payload).attemptId;
    if (typeof attemptId !== 'string' || !attemptId) return 'Gate lifecycle has an unidentifiable attempt; team mutation is fenced pending reviewed recovery';
    latestGateEvent = event;
  }
  const lifecycle = reduceJournal(events);
  if (latestGateEvent && ['gate.attempt.prepared', 'gate.attempt.started', 'gate.attempt.released', 'gate.attempt.aborted'].includes(latestGateEvent.type)) {
    const runId = record(latestGateEvent.payload).runId;
    const contexts = typeof runId === 'string' && runId
      ? events.filter((event) => event.type === 'run.unknown.context' && record(event.payload).runId === runId)
      : [];
    const context = contexts.length === 1 ? record(contexts[0]!.payload) : undefined;
    const reconciledTerminal = context
      && Array.isArray(context.evidenceHashes)
      && context.evidenceHashes.includes(latestGateEvent.eventHash)
      && ['succeeded', 'failed', 'abandoned'].includes(lifecycle.runs[runId as string]?.state ?? '');
    if (!reconciledTerminal) return 'Gate lifecycle is in progress or awaiting recovery; team mutation is fenced';
  }
  if (Object.values(lifecycle.runs).some((run) => run.state === 'unknown')) {
    return 'A Run has an unresolved unknown outcome; team mutation is fenced pending reconciliation';
  }
  return undefined;
}

function assertTeamMutationBarrier(events: JournalEvent[]): void {
  const reason = teamMutationBarrierReason(events);
  if (reason) throw new ControllerError(7, 'BLOCKED', reason);
}

function candidateForRun(events: JournalEvent[], taskId: string, runId: string): CandidateBinding | undefined {
  const event = events.filter((candidate) => candidate.type === 'controller.candidate.registered' && candidate.taskId === taskId && record(candidate.payload).runId === runId).at(-1);
  return event ? record(event.payload) as CandidateBinding : undefined;
}

function routedTasks(events: JournalEvent[]): Routed[] {
  const revised = revisionAuthority(events);
  if (revised) return revised.routes;
  const current = new Map<string, Routed>();
  for (const event of events.filter((candidate) => candidate.type === 'route.selected')) {
    const route = record(event.payload) as Routed;
    if (route.task?.id && (!current.has(route.task.id) || current.get(route.task.id)!.task.revision < route.task.revision)) current.set(route.task.id, route);
  }
  return [...current.values()];
}

function routedTask(events: JournalEvent[], taskId: string): Routed | undefined {
  return routedTasks(events).find((candidate) => candidate.task.id === taskId);
}

function revisionAuthority(events: JournalEvent[]): RevisionAuthority | undefined {
  const event = events.filter((candidate) => candidate.type === 'controller.spec.revised').at(-1);
  const authority = event ? record(record(event.payload).authority) as RevisionAuthority : undefined;
  return authority && typeof authority.revisionId === 'string' && typeof authority.specHash === 'string' && typeof authority.specPath === 'string' && typeof authority.sourceHash === 'string' && Array.isArray(authority.routes) ? authority : undefined;
}

function currentAuthority(events: JournalEvent[]): { revision: number; revisionId: string | null; specHash: string; specPath: string; sourceHash: string; sourceBase64: string | null; constitutionPath: string | null; constitutionHash: string | null } | undefined {
  const revised = revisionAuthority(events);
  if (revised) return { revision: revised.revision, revisionId: revised.revisionId, specHash: revised.specHash, specPath: revised.specPath, sourceHash: revised.sourceHash, sourceBase64: revised.sourceBase64, constitutionPath: revised.constitutionPath, constitutionHash: revised.constitutionHash };
  const initialized = latestPayload<Initialized>(events, 'controller.initialized');
  return initialized ? { revision: 1, revisionId: null, specHash: initialized.specHash, specPath: initialized.specPath, sourceHash: initialized.specHash, sourceBase64: null, constitutionPath: null, constitutionHash: null } : undefined;
}

function specRevisionAdmissionBarrier(events: JournalEvent[], lifecycle: LifecycleSnapshotState): string | undefined {
  if (['archived', 'blocked', 'approval-required'].includes(lifecycle.changeState)) return 'current change state is not revisable';
  if (Object.values(lifecycle.leases).some((lease) => lease.active)) return 'an active lease remains';
  if (Object.values(lifecycle.runs).some((run) => run.state === 'running' || run.state === 'unknown')) return 'a Run is active or unknown';
  if (Object.values(lifecycle.tasks).some((task) => !['pending', 'ready', 'done', 'remediation'].includes(task.state))) return 'a task is not settled';
  const gateAttempts = new Map<string, Set<string>>();
  for (const event of events.filter((candidate) => candidate.type.startsWith('gate.attempt.'))) {
    const attemptId = record(event.payload).attemptId;
    if (typeof attemptId !== 'string' || !attemptId) return 'a Gate attempt is unidentifiable';
    const phases = gateAttempts.get(attemptId) ?? new Set<string>(); phases.add(event.type); gateAttempts.set(attemptId, phases);
  }
  if ([...gateAttempts.values()].some((phases) => (phases.has('gate.attempt.prepared') || phases.has('gate.attempt.started') || phases.has('gate.attempt.released'))
    && !phases.has('gate.attempt.settled') && !phases.has('gate.attempt.aborted') && !phases.has('gate.attempt.denied'))) return 'a Gate lifecycle is unfinished';
  return undefined;
}

function revisionRouteSubstance(routes: RevisionRoute[]): unknown {
  return routes.map((route) => ({ task: { ...route.task, revision: undefined, state: undefined }, registryPath: route.registryPath, gateDefinitionHash: route.gateDefinitionHash }));
}

function sameRevisionSubstance(authority: Pick<RevisionAuthority, 'specPath' | 'sourceHash' | 'constitutionPath' | 'constitutionHash' | 'routes'>,
  previous: { specPath: string; sourceHash: string; constitutionPath: string | null; constitutionHash: string | null }, previousRoutes: RevisionRoute[]): boolean {
  return authority.specPath === previous.specPath && authority.sourceHash === previous.sourceHash
    && authority.constitutionPath === previous.constitutionPath && authority.constitutionHash === previous.constitutionHash
    && fingerprint(revisionRouteSubstance(authority.routes)) === fingerprint(revisionRouteSubstance(previousRoutes));
}

function entryPath(entry: string): string {
  return entry.split('\0', 1)[0] ?? '';
}

function pathMatches(path: string, pattern: string): boolean {
  if (pattern === '.') return true;
  const normalized = normalizeRepositoryPath(pattern);
  const source = normalized.split('/').map((segment) => segment === '**' ? '.*' : segment.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replaceAll('*', '[^/]*')).join('/');
  return new RegExp(`^${source}$`).test(path);
}

function validatePlanTasks(value: unknown): TaskDefinition[] {
  try { return validateTaskPlan(value, (task) => task.revision === 1 ? undefined : `Task ${task.id} must start at revision 1`); }
  catch (error) { throw new ControllerError(2, 'VALIDATION_ERROR', error instanceof TaskPlanError ? error.message : String(error)); }
}

function planAssessmentTaskId(tasks: TaskDefinition[]): string {
  return `plan:${fingerprint(tasks)}`;
}

const journalHashPattern = /^[a-f0-9]{64}$/;
const gateSettlementStatuses = new Set(['succeeded', 'failed', 'timed-out', 'output-capped', 'undeclared-writes', 'unknown']);

type GateTerminalClaim = {
  event: JournalEvent;
  attemptId: string;
  runId: string;
  changeId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  gateId: string;
  status: string;
  outcome: RecordValue;
  evidenceRef?: string;
};
type GateResultClaim = {
  event: JournalEvent;
  payload: RecordValue;
  batch?: { prepared: JournalEvent; committed: JournalEvent; kind: string; operations: ControllerBatchOperation[] };
};
type MappedGateHandoff = { terminal: GateTerminalClaim; result: GateResultClaim };
type GateHandoffClassification =
  | { kind: 'clean'; mapped: MappedGateHandoff[]; standalone: GateResultClaim[] }
  | { kind: 'pending'; terminal: GateTerminalClaim; mapped: MappedGateHandoff[]; standalone: GateResultClaim[] }
  | { kind: 'invalid'; reason: string };

function gateTerminalClaim(event: JournalEvent): GateTerminalClaim | string {
  const payload = record(event.payload);
  const identity = {
    attemptId: payload.attemptId,
    runId: payload.runId,
    changeId: payload.changeId,
    taskId: payload.taskId,
    taskRevision: payload.taskRevision,
    leaseGeneration: payload.leaseGeneration,
    gateId: payload.gateId,
  };
  if (payload.version !== 3 || !journalHashPattern.test(String(identity.attemptId))
    || typeof identity.runId !== 'string' || !identity.runId
    || typeof identity.changeId !== 'string' || !identity.changeId
    || typeof identity.taskId !== 'string' || !identity.taskId
    || !Number.isSafeInteger(identity.taskRevision) || (identity.taskRevision as number) < 1
    || !Number.isSafeInteger(identity.leaseGeneration) || (identity.leaseGeneration as number) < 1
    || typeof identity.gateId !== 'string' || !identity.gateId) return 'Gate terminal identity is malformed';
  if (event.changeId !== identity.changeId || event.taskId !== identity.taskId || event.taskRevision !== identity.taskRevision || event.leaseGeneration !== identity.leaseGeneration) {
    return 'Gate terminal journal envelope does not match its identity';
  }
  const outcome = record(payload.outcome);
  if (typeof outcome.runState !== 'string' || typeof outcome.taskState !== 'string' || typeof outcome.changeState !== 'string') return 'Gate terminal outcome is malformed';
  let status: string;
  let evidenceRef: string | undefined;
  if (event.type === 'gate.attempt.denied') {
    if (payload.reason !== 'approval-expired' || outcome.runState !== 'cancelled' || outcome.taskState !== 'blocked' || outcome.changeState !== 'approval-required' || payload.evidence !== undefined) {
      return 'Gate approval denial terminal is malformed';
    }
    status = 'approval-expired';
  } else {
    if (!gateSettlementStatuses.has(String(payload.status))) return 'Gate settlement status is malformed';
    status = String(payload.status);
    if (status === 'unknown') {
      if (payload.evidence !== undefined) return 'Unknown Gate settlement must not claim determinate evidence';
    } else {
      const evidence = record(payload.evidence);
      if (!journalHashPattern.test(String(evidence.contentHash)) || !journalHashPattern.test(String(evidence.pathHash))) return 'Determinate Gate settlement evidence binding is malformed';
      evidenceRef = evidenceFilePath(identity.changeId, identity.runId, identity.gateId);
    }
  }
  return {
    event,
    attemptId: identity.attemptId as string,
    runId: identity.runId,
    changeId: identity.changeId,
    taskId: identity.taskId,
    taskRevision: identity.taskRevision as number,
    leaseGeneration: identity.leaseGeneration as number,
    gateId: identity.gateId,
    status,
    outcome,
    ...(evidenceRef ? { evidenceRef } : {}),
  };
}

function resultBatches(rawEvents: JournalEvent[]): Map<string, GateResultClaim['batch']> {
  const batches = new Map<string, GateResultClaim['batch']>();
  for (let index = 0; index < rawEvents.length - 1; index += 1) {
    const prepared = rawEvents[index]!;
    const committed = rawEvents[index + 1]!;
    if (prepared.type !== 'controller.batch.prepared' || committed.type !== 'controller.batch.committed') continue;
    const payload = record(prepared.payload);
    const operations = Array.isArray(payload.operations) ? payload.operations : [];
    if (operations.some((operation) => record(operation).type === 'controller.gate.result') && typeof payload.kind === 'string') {
      batches.set(committed.eventHash, { prepared, committed, kind: payload.kind, operations: operations as ControllerBatchOperation[] });
    }
  }
  return batches;
}

function gateResultCompatible(terminal: GateTerminalClaim, event: JournalEvent, payload: RecordValue, legacy: boolean): string | undefined {
  if (terminal.event.sequence >= event.sequence) return 'Controller Gate result does not follow its terminal';
  if (event.changeId !== terminal.changeId || event.taskId !== terminal.taskId || event.taskRevision !== terminal.taskRevision || event.leaseGeneration !== terminal.leaseGeneration) {
    return 'Controller Gate result envelope does not match its terminal';
  }
  if (payload.runId !== terminal.runId) return 'Controller Gate result Run identity does not match its terminal';
  if (!legacy && (payload.changeId !== terminal.changeId || payload.taskId !== terminal.taskId || payload.taskRevision !== terminal.taskRevision
    || payload.leaseGeneration !== terminal.leaseGeneration || payload.gateId !== terminal.gateId)) return 'Controller Gate result payload identity does not match its terminal';
  const compatibleStatus = payload.status === terminal.status || (legacy && terminal.status === 'unknown' && payload.status === 'evidence-blocked-secret');
  if (!compatibleStatus) return 'Controller Gate result status does not match its terminal';
  if (fingerprint(payload.outcome) !== fingerprint(terminal.outcome)) return 'Controller Gate result outcome does not match its terminal';
  if (terminal.evidenceRef === undefined ? payload.evidenceRef !== undefined : payload.evidenceRef !== terminal.evidenceRef) return 'Controller Gate result evidence reference does not match its terminal';
  return undefined;
}

function validThrownIndeterminateResult(event: JournalEvent, payload: RecordValue, batchKind: string | undefined): boolean {
  const outcome = record(payload.outcome);
  const ownerFieldsAreAbsent = payload.changeId === undefined && payload.taskId === undefined
    && payload.taskRevision === undefined && payload.leaseGeneration === undefined && payload.gateId === undefined;
  const ownerFieldsMatchEnvelope = payload.changeId === event.changeId && payload.taskId === event.taskId
    && payload.taskRevision === event.taskRevision && payload.leaseGeneration === event.leaseGeneration;
  return batchKind === 'unknown-outcome' && payload.attemptId === undefined && payload.terminalEventHash === undefined
    && typeof payload.runId === 'string' && payload.runId.length > 0 && payload.status === 'unknown' && typeof payload.error === 'string' && payload.error.length > 0
    && outcome.runState === 'unknown' && outcome.taskState === 'blocked' && outcome.changeState === 'approval-required'
    && typeof event.taskId === 'string' && Number.isSafeInteger(event.taskRevision) && Number.isSafeInteger(event.leaseGeneration)
    && (ownerFieldsAreAbsent || ownerFieldsMatchEnvelope);
}

function classifyGateHandoffs(rawEvents: JournalEvent[]): GateHandoffClassification {
  const logical = projectJournalEvents(rawEvents).events;
  const terminals: GateTerminalClaim[] = [];
  const terminalByAttempt = new Map<string, GateTerminalClaim>();
  for (const event of rawEvents) {
    if (event.type !== 'gate.attempt.settled' && event.type !== 'gate.attempt.denied') continue;
    const claim = gateTerminalClaim(event);
    if (typeof claim === 'string') return { kind: 'invalid', reason: claim };
    if (terminalByAttempt.has(claim.attemptId)) return { kind: 'invalid', reason: `Gate attempt ${claim.attemptId} has duplicate terminal claims` };
    terminalByAttempt.set(claim.attemptId, claim);
    terminals.push(claim);
  }

  const batches = resultBatches(rawEvents);
  const usedTerminals = new Set<string>();
  const standaloneRuns = new Set<string>();
  const mapped: MappedGateHandoff[] = [];
  const standalone: GateResultClaim[] = [];
  const results = logical.filter((event) => event.type === 'controller.gate.result');
  for (const event of results) {
    const payload = record(event.payload);
    const resultClaim: GateResultClaim = { event, payload, ...(batches.get(event.eventHash) ? { batch: batches.get(event.eventHash)! } : {}) };
    const attemptId = payload.attemptId;
    if (attemptId !== undefined) {
      if (!journalHashPattern.test(String(attemptId)) || !journalHashPattern.test(String(payload.terminalEventHash)) || resultClaim.batch?.kind !== 'gate-result') {
        return { kind: 'invalid', reason: 'Controller Gate result has an invalid durable terminal binding' };
      }
      const terminal = terminalByAttempt.get(attemptId as string);
      if (!terminal || payload.terminalEventHash !== terminal.event.eventHash) return { kind: 'invalid', reason: 'Controller Gate result references an absent or different terminal' };
      if (usedTerminals.has(terminal.attemptId)) return { kind: 'invalid', reason: `Gate attempt ${terminal.attemptId} has duplicate Controller results` };
      const mismatch = gateResultCompatible(terminal, event, payload, false);
      if (mismatch) return { kind: 'invalid', reason: mismatch };
      usedTerminals.add(terminal.attemptId);
      mapped.push({ terminal, result: resultClaim });
      continue;
    }
    if (payload.terminalEventHash !== undefined) return { kind: 'invalid', reason: 'Legacy Controller Gate result has a terminal hash without an attempt identity' };
    const candidates = terminals.filter((terminal) => terminal.runId === payload.runId);
    if (candidates.length === 0) {
      if (!validThrownIndeterminateResult(event, payload, resultClaim.batch?.kind)) return { kind: 'invalid', reason: 'Controller Gate result is orphaned from a terminal' };
      if (standaloneRuns.has(payload.runId as string)) return { kind: 'invalid', reason: `Run ${String(payload.runId)} has duplicate standalone Controller Gate results` };
      standaloneRuns.add(payload.runId as string);
      standalone.push(resultClaim);
      continue;
    }
    if (candidates.length !== 1) return { kind: 'invalid', reason: 'Legacy Controller Gate result does not identify one unique terminal' };
    const terminal = candidates[0]!;
    if (usedTerminals.has(terminal.attemptId)) return { kind: 'invalid', reason: `Gate attempt ${terminal.attemptId} has duplicate Controller results` };
    const mismatch = gateResultCompatible(terminal, event, payload, true);
    if (mismatch) return { kind: 'invalid', reason: mismatch };
    usedTerminals.add(terminal.attemptId);
    mapped.push({ terminal, result: resultClaim });
  }

  const unmatched = terminals.filter((terminal) => !usedTerminals.has(terminal.attemptId));
  if (unmatched.length > 1) return { kind: 'invalid', reason: 'Journal contains multiple unmatched Gate terminals' };
  return unmatched.length === 1 ? { kind: 'pending', terminal: unmatched[0]!, mapped, standalone } : { kind: 'clean', mapped, standalone };
}

async function durableWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${process.pid}-${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(contents); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, path);
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}

async function writeSnapshotStrict(path: string, journal: Journal): Promise<void> {
  const replay = await journal.replayStrict();
  if (replay.discardedIncompleteTail) throw new ControllerError(7, 'BLOCKED', 'Journal has an incomplete tail; refusing to project a snapshot');
  const event = replay.events.at(-1);
  const state = reduceJournal(replay.events);
  await durableWrite(path, JSON.stringify({
    lastSequence: event?.sequence ?? 0,
    lastEventHash: event?.eventHash ?? '0'.repeat(64),
    state,
    stateDigest: hash(JSON.stringify(state)),
  }));
}

function taskDefinitionHash(value: TaskDefinition): string {
  return fingerprint({ ...value, state: undefined });
}

async function loadYaml(path: string): Promise<unknown> {
  return YAML.parse(await readFile(path, 'utf8')) as unknown;
}

function validationError(details: string[], prefix = 'Document'): never {
  throw new ControllerError(2, 'SCHEMA_INVALID', `${prefix} is schema-invalid; issuer was not authenticated: ${details.join('; ')}`);
}

function mapKnownError(error: unknown): ControllerError {
  if (error instanceof ControllerError) return error;
  if (error instanceof AssessmentError) {
    if (error.code === 'ASSESSMENT_STALE') return new ControllerError(5, 'CONFLICT', error.message);
    return new ControllerError(2, 'SCHEMA_INVALID', error.message);
  }
  if (error instanceof GateRunIndeterminateError) return new ControllerError(7, 'BLOCKED', error.message, error.outcome);
  if (error instanceof GateRunError) {
    if (['APPROVAL_REQUIRED', 'APPROVAL_MISMATCH'].includes(error.code)) return new ControllerError(6, 'APPROVAL_REQUIRED', error.message);
    if (['STALE_TREE', 'STALE_GATE', 'RECOVERY_IN_PROGRESS'].includes(error.code)) return new ControllerError(5, 'CONFLICT', error.message);
    if (['NETWORK_ISOLATION_UNAVAILABLE', 'PROCESS_CONTAINMENT_UNAVAILABLE'].includes(error.code)) return new ControllerError(8, 'PREREQUISITE_FAILED', error.message);
    if (error.code === 'RECOVERY_INVALID') return new ControllerError(7, 'BLOCKED', error.message);
    return new ControllerError(2, 'VALIDATION_ERROR', error.message);
  }
  if (error instanceof GateRegistryError) return new ControllerError(2, error.code === 'UNKNOWN_GATE' ? 'VALIDATION_ERROR' : 'SCHEMA_INVALID', error.message);
  if (error instanceof GateEvidenceError || error instanceof JournalTailMismatchError) return new ControllerError(5, 'CONFLICT', error.message);
  if (error instanceof JournalCorruptError) return new ControllerError(7, 'BLOCKED', error.message);
  if (error instanceof ControllerBatchInvalidError || error instanceof ControllerBatchConflictError) return new ControllerError(7, 'BLOCKED', error.message);
  if (error instanceof CommittedProjectionDriftError) return new ControllerError(5, 'CONFLICT', error.message);
  if (error instanceof TeamProtocolError) return new ControllerError(error.kind === 'validation' ? 2 : 5, error.kind === 'validation' ? 'VALIDATION_ERROR' : 'CONFLICT', error.message);
  const code = record(error).code;
  const message = error instanceof Error ? error.message : String(error);
  if (['EEXIST', 'INIT_AUTHORITY_MISMATCH', 'ACTIVE_LEASE', 'STALE_LEASE', 'STALE_REVISION', 'STALE_TREE', 'EXPIRED_LEASE'].includes(String(code))) return new ControllerError(5, 'CONFLICT', message);
  if (['ENOENT', 'ENOTDIR'].includes(String(code))) return new ControllerError(8, 'PREREQUISITE_FAILED', message);
  if (String(code).startsWith('INVALID_') || /Invalid change id|Path escapes repository/.test(message)) return new ControllerError(2, 'VALIDATION_ERROR', message);
  return new ControllerError(9, 'INTERNAL_ERROR', message || 'Unexpected controller failure');
}

export class Controller {
  async execute(command: string, options: CommandOptions): Promise<CommandResult> {
    try {
      if (command === 'resume') {
        const hasTask = options.task !== undefined;
        const recoverReview = options.recoverReview === true;
        if (hasTask !== recoverReview) throw new ControllerError(2, 'VALIDATION_ERROR', '--task and --recover-review must be provided together');
        if (recoverReview) stringOption(options, 'task');
      }
      if (stateChanging.has(command) && options.dryRun === true) return await this.dryRun(command, options);
      const handler = (this as unknown as Record<string, unknown>)[command.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())];
      if (typeof handler !== 'function') throw new ControllerError(2, 'VALIDATION_ERROR', `Unknown command: ${command}`);
      return await (handler as (options: CommandOptions) => Promise<CommandResult>).call(this, options);
    } catch (error: unknown) {
      throw mapKnownError(error);
    }
  }

  private repository(options: CommandOptions): string {
    return resolve(typeof options.repo === 'string' ? options.repo : process.cwd());
  }

  private changeId(options: CommandOptions): string {
    const changeId = stringOption(options, 'change')!;
    try { assertChangeId(changeId); } catch (error: unknown) { throw new ControllerError(2, 'VALIDATION_ERROR', error instanceof Error ? error.message : String(error)); }
    return changeId;
  }

  private async planInitialization(repositoryRoot: string, changeId: string, options: CommandOptions): Promise<{ specPath: string; normalizedSpec: string; sourceHash: string; baseline: Baseline; authority: ControllerInitAuthority; pendingAuthority: boolean }> {
    const specReference = stringOption(options, 'spec')!;
    const specPath = resolve(repositoryRoot, specReference);
    try { await assertContained(repositoryRoot, specPath); }
    catch { throw new ControllerError(2, 'VALIDATION_ERROR', `Spec path escapes repository: ${specPath}`); }
    const sourceHash = hash(await readFile(specPath));
    const normalizedSpec = relative(repositoryRoot, specPath).split(sep).join('/');
    const existing = await readControllerInitAuthority(repositoryRoot, changeId);
    const baseline = existing ? record(existing.initialized).baseline as Baseline : await captureBaseline(repositoryRoot);
    const initialized = { baseline, specPath: normalizedSpec, specHash: sourceHash } satisfies Initialized;
    const manifest = { schemaVersion: 1, id: changeId, state: 'triage', unresolvedDecisions: [], specRef: normalizedSpec, sourceKind: 'repository-file', sourceHash, approvalRef: null, approvalHash: null, importMode: 'reference' };
    const spec = { schemaVersion: 1, sourceKind: 'repository-file', sourceHash, approvalRef: null, approvalHash: null, importMode: 'reference' };
    const authority: ControllerInitAuthority = { initialized, manifest, spec, tasks: { schemaVersion: 1, tasks: [] } };
    if (existing) {
      if (fingerprint(existing) !== fingerprint(authority)) throw new ControllerError(5, 'CONFLICT', 'Initialization retry does not match the durable initialization authority');
      await this.assertInitializationAuthorityRecoverable(repositoryRoot, changeId, existing);
      return { specPath, normalizedSpec, sourceHash, baseline, authority, pendingAuthority: true };
    }
    const paths = this.paths(repositoryRoot, changeId);
    for (const candidate of [paths.artifacts, paths.runtime.directory]) {
      try { await lstat(candidate); throw new ControllerError(5, 'CONFLICT', `Change workspace already exists: ${relative(repositoryRoot, candidate)}`); }
      catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    return { specPath, normalizedSpec, sourceHash, baseline, authority, pendingAuthority: false };
  }

  private async assertInitializationAuthorityRecoverable(repositoryRoot: string, changeId: string, authority: ControllerInitAuthority): Promise<void> {
    const initialized = record(authority.initialized);
    if (typeof initialized.specPath !== 'string' || typeof initialized.specHash !== 'string') throw new ControllerError(7, 'BLOCKED', 'Initialization authority is invalid');
    const sourcePath = resolve(repositoryRoot, initialized.specPath);
    try { await assertContained(repositoryRoot, sourcePath); }
    catch { throw new ControllerError(5, 'CONFLICT', 'Initialization authority source is no longer repository-contained'); }
    try { if (hash(await readFile(sourcePath)) !== initialized.specHash) throw new ControllerError(5, 'CONFLICT', 'Initialization authority source has drifted'); }
    catch (error: unknown) { if (error instanceof ControllerError) throw error; throw new ControllerError(5, 'CONFLICT', 'Initialization authority source is no longer readable'); }
    const paths = this.paths(repositoryRoot, changeId);
    try {
      const info = await lstat(paths.artifacts);
      if (!info.isDirectory()) throw new ControllerError(5, 'CONFLICT', 'Initialization artifact path is not a directory');
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const [path, expected] of [[paths.manifest, authority.manifest], [paths.spec, authority.spec], [paths.tasks, authority.tasks]] as const) {
      let value: unknown;
      try { value = await loadYaml(path); }
      catch { throw new ControllerError(5, 'CONFLICT', 'Published initialization artifacts are incomplete'); }
      if (fingerprint(value) !== fingerprint(expected)) throw new ControllerError(5, 'CONFLICT', `Published initialization artifact drifted: ${relative(repositoryRoot, path)}`);
    }
  }

  private async assertResumePrerequisite(repositoryRoot: string, changeId: string): Promise<ControllerInitAuthority | undefined> {
    const initialization = await readControllerInitAuthority(repositoryRoot, changeId);
    if (initialization) return initialization;
    const runtime = runtimePaths(repositoryRoot, changeId);
    for (const [path, kind] of [[runtime.directory, 'directory'], [runtime.journal, 'file']] as const) {
      let info;
      try { info = await lstat(path); }
      catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ControllerError(8, 'PREREQUISITE_FAILED', `Change workspace is incomplete or not initialized: ${relative(repositoryRoot, path)}`);
        throw error;
      }
      if (kind === 'directory' ? !info.isDirectory() : !info.isFile()) throw new ControllerError(8, 'PREREQUISITE_FAILED', `Change workspace has an invalid runtime path: ${relative(repositoryRoot, path)}`);
    }
    return undefined;
  }

  private async dryRun(command: string, options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = command === 'init' || options.change !== undefined ? this.changeId(options) : undefined;
    if (command === 'revise') return this.revise({ ...options, dryRun: true });
    if (command === 'transition' && options.scope === 'change' && options.to === 'release-evidence') return this.recordReleaseEvidence(options);
    if (command === 'transition' && options.scope === 'change' && options.to === 'archived') return this.archiveRelease(options);
    if (command === 'run-gates') boundedGateOutput(options.maxOutputBytes);
    if (command === 'claim') positiveInteger(options.ttl, 300_000, '--ttl');
    let plannedRecovery = false;
    let routeDryRunState: RecordValue | undefined;
    if (command === 'init') {
      plannedRecovery = (await this.planInitialization(repositoryRoot, changeId!, options)).pendingAuthority;
    }
    let receipt: RecordValue | undefined;
    if (options.receipt !== undefined) {
      const receiptKinds: Partial<Record<string, ReceiptKind>> = { review: 'review', approve: 'approval', waive: 'waiver', resolve: 'resolution', reconcile: 'reconciliation', ...(command === 'transition' && options.to === 'design-approved' ? { transition: 'design-review' } : {}) };
      const kind = receiptKinds[command];
      if (kind) receipt = await this.readReceipt(kind, stringOption(options, 'receipt')!);
    }
    if (command === 'resume' && changeId && options.recoverReview === true) {
      const initialization = await this.assertResumePrerequisite(repositoryRoot, changeId);
      if (initialization) throw new ControllerError(7, 'BLOCKED', 'Review recovery cannot repair an incomplete initialization');
      const strict = await new Journal(runtimePaths(repositoryRoot, changeId).journal).replayStrict();
      if (strict.discardedIncompleteTail || projectJournalEvents(strict.events).pending) {
        throw new ControllerError(7, 'BLOCKED', 'Dry-run review recovery refuses incomplete or pending history without repairing it');
      }
      const events = await this.readEvents(repositoryRoot, changeId);
      const taskId = stringOption(options, 'task')!;
      await this.reviewRecoveryPlan(repositoryRoot, changeId, taskId, events, new Date());
      return result('DRY_RUN', { ...(await this.state(repositoryRoot, changeId, events)), command, changeId, planned: true, plannedRecovery: true, writes: [] });
    }
    if (command === 'resume' && changeId) {
      const initialization = await this.assertResumePrerequisite(repositoryRoot, changeId);
      if (initialization) {
        await this.assertInitializationAuthorityRecoverable(repositoryRoot, changeId, initialization);
        return result('DRY_RUN', { command, changeId, planned: true, plannedRecovery: true, writes: [] });
      }
      const runtime = runtimePaths(repositoryRoot, changeId);
      const strict = await new Journal(runtime.journal).replayStrict();
      this.verifySpecRevisionHistory(repositoryRoot, changeId, strict.events, true);
      const pendingReviewBatch = projectJournalEvents(strict.events).pending;
      this.verifyReviewRecoveryHistory(pendingReviewBatch ? strict.events.slice(0, -1) : strict.events);
      if (pendingReviewBatch?.batch.kind === 'expired-review-recovery'
        || pendingReviewBatch?.batch.operations.some((operation) => operation.type === 'controller.review.recovered')) {
        await this.validatePendingReviewRecovery(repositoryRoot, changeId, String(pendingReviewBatch.batch.operations[0]?.taskId ?? ''), strict.events);
      }
      const handoff = classifyGateHandoffs(strict.events);
      if (handoff.kind === 'invalid') throw new ControllerError(7, 'BLOCKED', handoff.reason);
      await this.verifyGateHandoffHistory(repositoryRoot, changeId, strict.events, handoff, strict.discardedIncompleteTail);
      if (await preflightControllerBatchRecovery(repositoryRoot, changeId, strict.events)) return result('DRY_RUN', { command, changeId, planned: true, plannedRecovery: true, writes: [] });
      if (handoff.kind === 'pending') {
        const events = await this.readEvents(repositoryRoot, changeId, strict.discardedIncompleteTail, true);
        const taskId = handoff.terminal.taskId;
        const routed = routedTask(events, taskId);
        const claimed = taskId ? latestTaskPayload<Claimed>(events, 'run.claimed', taskId) : undefined;
        if (!routed || !taskId || !claimed) throw new ControllerError(7, 'BLOCKED', 'Pending Gate handoff has no current routed Run/task authority');
        const registry = await GateRegistry.fromYaml(resolve(repositoryRoot, routed.registryPath));
        const runner = new GateRunner();
        const request = this.gateSettlementRequest(repositoryRoot, changeId, taskId, routed, claimed, registry, candidateForRun(events, taskId, claimed.runId));
        if (strict.discardedIncompleteTail) await runner.inspectSettlementBeforeIncompleteTail(request);
        else await runner.inspectSettlement(request);
        return result('DRY_RUN', { command, changeId, planned: true, plannedRecovery: true, writes: [] });
      }
    }
    if (command !== 'init' && changeId) {
      const events = await this.readEvents(repositoryRoot, changeId, command === 'resume');
      if (!receipt && command === 'transition' && options.scope === 'change' && options.to === 'spec-approved'
        && reduceJournal(events).changeState === 'design-review' && options.receipt !== undefined) {
        receipt = await this.readReceipt('design-review', stringOption(options, 'receipt')!);
      }
      if (receipt) this.assertRevisionReceiptIdReserved(events, receipt);
      const lifecycle = reduceJournal(events);
      const latestRouted = latestPayload<Routed>(events, 'route.selected');
      const taskId = typeof options.task === 'string' ? options.task : latestRouted?.task.id;
      const routed = taskId ? routedTask(events, taskId) : undefined;
      if (command === 'route') {
        const planReference = stringOption(options, 'plan', false);
        const routeTaskId = stringOption(options, 'task', false);
        const gateId = stringOption(options, 'gate', false);
        if (planReference ? routeTaskId !== undefined || gateId !== undefined : routeTaskId === undefined || gateId === undefined) throw new ControllerError(2, 'VALIDATION_ERROR', 'Route requires either --plan or the legacy --task with --gate');
        const registryPath = resolve(repositoryRoot, typeof options.registry === 'string' ? options.registry : 'core/gates/default.yaml');
        await assertContained(repositoryRoot, registryPath);
        const registry = await GateRegistry.fromYaml(registryPath);
        if (lifecycle.changeState !== 'triage') throw new ControllerError(3, 'TRANSITION_FORBIDDEN', 'Routing is only available from triage', lifecycle);
        if (latestPayload<Routed>(events, 'route.selected')) throw new ControllerError(5, 'CONFLICT', 'This change is already routed', lifecycle);
        if (planReference) {
          const planPath = resolve(repositoryRoot, planReference);
          try { await assertContained(repositoryRoot, planPath); } catch { throw new ControllerError(2, 'VALIDATION_ERROR', `Plan path escapes repository: ${planPath}`); }
          const tasks = validatePlanTasks(await loadYaml(planPath));
          for (const task of tasks) registry.get(task.gateIds[0]!);
          const governance = await this.governanceAdmission(repositoryRoot, changeId, planAssessmentTaskId(tasks), options, events);
          const planAssessmentContext = await this.planAssessmentContext(repositoryRoot, changeId, events, planAssessmentTaskId(tasks), governance.recorded);
          if (!governance.recorded && governance.previous) this.governanceRefusal(governance.previous.disposition === 'approval-required' ? 'approval-required' : 'assessment-required', { ...(await this.state(repositoryRoot, changeId, events)), planAssessmentContext });
          if (governance.recorded && governance.recorded.disposition !== 'ready') this.governanceRefusal(governance.recorded.disposition, { ...(await this.state(repositoryRoot, changeId, events)), planAssessmentContext });
          routeDryRunState = { ...(await this.state(repositoryRoot, changeId, events)), planAssessmentContext };
        } else {
          registry.get(gateId!);
          const governance = await this.governanceAdmission(repositoryRoot, changeId, routeTaskId!, options, events);
          if (!governance.recorded && governance.previous) this.governanceRefusal(governance.previous.disposition === 'approval-required' ? 'approval-required' : 'assessment-required', await this.state(repositoryRoot, changeId, events));
          if (governance.recorded && governance.recorded.disposition !== 'ready') this.governanceRefusal(governance.recorded.disposition, await this.state(repositoryRoot, changeId, events));
        }
      }
      if (command === 'transition') {
        if (options.scope !== 'change') throw new ControllerError(2, 'VALIDATION_ERROR', 'The Task 2.4 public transition seam is fail-closed to change scope');
        await this.planChangeTransition(repositoryRoot, changeId, String(options.to), events, options);
      }
      if (command === 'claim') await this.planClaim(repositoryRoot, changeId, options, events);
      if (command === 'run-gates') {
        const claimed = taskId ? latestTaskPayload<Claimed>(events, 'run.claimed', taskId) : undefined;
        if (!taskId || !routed || !claimed || lifecycle.tasks[taskId]?.state !== 'implementing' || lifecycle.runs[claimed.runId]?.state !== 'running') throw new ControllerError(7, 'BLOCKED', 'Task has no active implementing run', lifecycle);
        const projectedLease = lifecycle.leases[taskId];
        if (!projectedLease?.active || projectedLease.generation !== claimed.lease.generation || Date.parse(claimed.lease.expiresAt) <= Date.now()) throw new ControllerError(5, 'CONFLICT', 'Run lease binding is stale', lifecycle);
        const suppliedRunId = stringOption(options, 'run', false);
        if (suppliedRunId !== undefined && suppliedRunId !== claimed.runId) throw new ControllerError(5, 'CONFLICT', 'Supplied --run does not match the active claimed Run', lifecycle);
        const current = await canonicalTreeHash(repositoryRoot);
        const candidate = candidateForRun(events, taskId, claimed.runId);
        if (candidate) {
          this.assertCandidateBinding(candidate, taskId, routed, claimed, events);
          if (candidate.treeHash !== current.hash) throw new ControllerError(5, 'CONFLICT', 'Registered candidate tree has drifted and cannot be refreshed', lifecycle);
        }
        if ((candidate?.treeHash ?? current.hash) !== claimed.lease.inputTreeHash && suppliedRunId === undefined) throw new ControllerError(5, 'CONFLICT', 'Changed candidate requires an explicit matching --run', lifecycle);
        if (!candidate && current.hash !== claimed.lease.inputTreeHash) {
          if (!claimed.inputEntries) throw new ControllerError(5, 'CONFLICT', 'Historical claim has no input-entry baseline for a changed candidate', lifecycle);
          const authority = currentAuthority(events);
          if (!authority) throw new ControllerError(7, 'BLOCKED', 'Candidate registration requires initialized specification authority', lifecycle);
          this.assertCandidatePaths(current.entries, claimed.inputEntries, routed, authority);
        }
        const registry = await GateRegistry.fromYaml(resolve(repositoryRoot, routed.registryPath));
        const gate = registry.get(routed.task.gateIds[0]!);
        const approvalReceipt = options.approvalReceipt === undefined ? undefined : await this.readReceipt('approval', stringOption(options, 'approvalReceipt')!);
        if (approvalReceipt) this.gateApprovalNeedsRecord(events, claimed, approvalReceipt);
        const request = { repositoryRoot, registry, gateId: gate.id, expectedInputTreeHash: candidate?.treeHash ?? current.hash, expectedGateDefinitionHash: routed.gateDefinitionHash, runId: claimed.runId, changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, maxOutputBytes: boundedGateOutput(options.maxOutputBytes), ...(approvalReceipt ? { approvalReceipt } : {}) };
        const gateApprovalContext = (gate.network !== 'deny' || gate.effectClass !== 'local-verification') ? { changeId, taskId, runId: claimed.runId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, gateId: gate.id, ...approvalFingerprintFields(request, gate, await realpath(resolve(repositoryRoot, gate.cwd))) } : null;
        let missingPrerequisites: string[] = [];
        try { await new GateRunner().preflight(request); }
        catch (error) {
          if (!approvalReceipt && gateApprovalContext && error instanceof GateRunError && error.code === 'APPROVAL_REQUIRED') missingPrerequisites = ['approval-receipt'];
          else throw error;
        }
        return result('DRY_RUN', { ...(await this.state(repositoryRoot, changeId, events)), command, changeId, planned: true, writes: [], gateApprovalContext, missingPrerequisites });
      }
      if (command === 'submit') {
        if (!taskId) throw new ControllerError(2, 'VALIDATION_ERROR', '--task is required');
        await this.assertSubmitCandidate(repositoryRoot, taskId, events);
      }
      if (command === 'review') {
        if (!taskId || !receipt) throw new ControllerError(2, 'VALIDATION_ERROR', 'Review task and receipt are required');
        await this.assertReviewCandidate(repositoryRoot, changeId, taskId, receipt, events);
      }
      if (['approve', 'waive', 'resolve'].includes(command) && receipt && typeof receipt.changeId === 'string' && receipt.changeId !== changeId) throw new ControllerError(5, 'CONFLICT', 'Receipt change scope does not match; issuer was not authenticated', lifecycle);
      if (command === 'reconcile') {
        if (!receipt) throw new ControllerError(2, 'VALIDATION_ERROR', '--receipt is required');
        this.reconciliationPlan(events, receipt);
      }
      if (command === 'resume') {
        const strict = await new Journal(runtimePaths(repositoryRoot, changeId).journal).replayStrict();
        const gateAttempts = new Map<string, Set<string>>();
        for (const event of strict.events.filter((candidate) => candidate.type.startsWith('gate.attempt.'))) {
          const attemptId = record(event.payload).attemptId;
          if (typeof attemptId !== 'string') continue;
          const phases = gateAttempts.get(attemptId) ?? new Set<string>();
          phases.add(event.type);
          gateAttempts.set(attemptId, phases);
        }
        if ([...gateAttempts.values()].some((phases) => phases.has('gate.attempt.prepared') && !phases.has('gate.attempt.settled') && !phases.has('gate.attempt.aborted') && !phases.has('gate.attempt.denied'))) throw new ControllerError(7, 'BLOCKED', 'Gate lifecycle recovery is not repaired by resume; use the reviewed Gate recovery/reconciliation seam', lifecycle);
        if (strict.discardedIncompleteTail) {
          const activeRun = Object.values(lifecycle.runs).some((run) => run.state === 'running' || run.state === 'unknown');
          const activeTask = Object.values(lifecycle.tasks).some((task) => task.state === 'implementing' || task.state === 'verifying');
          if (activeRun && activeTask) throw new ControllerError(7, 'BLOCKED', 'Gate lifecycle recovery is not repaired by resume; use the reviewed Gate recovery/reconciliation seam', lifecycle);
          plannedRecovery = true;
        }
      }
    }
    return result('DRY_RUN', { ...(routeDryRunState ?? {}), command, changeId: changeId ?? null, planned: true, plannedRecovery, writes: [] });
  }

  private async readEvents(repositoryRoot: string, changeId: string, allowIncompleteTail = false, allowPendingGateHandoff = false, allowSpecDrift = false, allowPendingControllerBatch = false, observed?: JournalObservation): Promise<JournalEvent[]> {
    const paths = this.paths(repositoryRoot, changeId);
    if (await readControllerInitAuthority(repositoryRoot, changeId)) throw new ControllerError(7, 'BLOCKED', 'Initialization has a pending durable authority intent; use resume');
    for (const path of [paths.runtime.directory, paths.runtime.journal]) {
      let info;
      try { info = await lstat(path); }
      catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ControllerError(8, 'PREREQUISITE_FAILED', `Change workspace is incomplete or not initialized: ${relative(repositoryRoot, path)}`); throw error; }
      if (path === paths.runtime.directory ? !info.isDirectory() : !info.isFile()) throw new ControllerError(9, 'INTERNAL_ERROR', `Change workspace path has the wrong type: ${relative(repositoryRoot, path)}`);
    }
    const replay = observed ?? await new Journal(paths.runtime.journal).replayStrict();
    if (replay.discardedIncompleteTail && !allowIncompleteTail) throw new ControllerError(7, 'BLOCKED', 'Journal has an incomplete tail; use resume for ordinary lifecycle recovery or the reviewed Gate recovery/reconciliation seam');
    const projection = projectJournalEvents(replay.events);
    if (projection.pending && !allowPendingControllerBatch) throw new ControllerError(7, 'BLOCKED', 'Journal has a pending controller batch; use resume');
    const committedRawEvents = projection.pending ? replay.events.slice(0, -1) : replay.events;
    this.verifySpecRevisionHistory(repositoryRoot, changeId, committedRawEvents);
    const handoff = classifyGateHandoffs(replay.events);
    if (handoff.kind === 'invalid') throw new ControllerError(7, 'BLOCKED', handoff.reason);
    await this.verifyGateHandoffHistory(repositoryRoot, changeId, replay.events, handoff, replay.discardedIncompleteTail, observed);
    if (handoff.kind === 'pending' && !allowPendingGateHandoff) throw new ControllerError(7, 'BLOCKED', 'Gate settlement has a pending Controller handoff; use resume');
    this.verifyReviewRecoveryHistory(committedRawEvents);
    for (const path of [paths.artifacts, paths.manifest, paths.spec, paths.tasks]) {
      let info;
      try { info = await lstat(path); }
      catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ControllerError(8, 'PREREQUISITE_FAILED', `Change workspace is incomplete or not initialized: ${relative(repositoryRoot, path)}`); throw error; }
      if (path === paths.artifacts ? !info.isDirectory() : !info.isFile()) throw new ControllerError(9, 'INTERNAL_ERROR', `Change workspace path has the wrong type: ${relative(repositoryRoot, path)}`);
    }
    const manifest = await loadYaml(paths.manifest);
    const manifestValidation = validateDocument('change-manifest', manifest);
    if (!manifestValidation.ok) validationError(manifestValidation.details, 'change-manifest');
    const spec = await loadYaml(paths.spec);
    const specValidation = validateDocument('spec-ref', spec);
    if (!specValidation.ok) validationError(specValidation.details, 'spec-ref');
    const tasks = await loadYaml(paths.tasks);
    const tasksValidation = validateDocument('task-plan', tasks);
    if (!tasksValidation.ok) validationError(tasksValidation.details, 'task-plan');
    const manifestRecord = record(manifest);
    const specRecord = record(spec);
    const tasksRecord = record(tasks);
    if (manifestRecord.id !== changeId) throw new ControllerError(5, 'CONFLICT', 'Manifest change id does not match the requested change');
    const expectedArtifacts = new Map(projection.committedProjections.map((entry) => [entry.relativePath, entry]));
    for (const expected of expectedArtifacts.values()) await assertProjectionValue(resolve(repositoryRoot, expected.relativePath), expected);
    const events = projection.events;
    const lifecycle = reduceJournal(events);
    if (manifestRecord.state !== lifecycle.changeState) throw new ControllerError(7, 'BLOCKED', `Manifest state ${String(manifestRecord.state)} disagrees with journal state ${lifecycle.changeState}`);
    const initialized = latestPayload<Initialized>(events, 'controller.initialized');
    const authority = currentAuthority(events);
    if (!initialized || !authority
      || manifestRecord.specRef !== authority.specPath
      || manifestRecord.sourceHash !== authority.sourceHash
      || manifestRecord.sourceKind !== 'repository-file'
      || manifestRecord.importMode !== 'reference'
      || specRecord.sourceHash !== authority.sourceHash
      || specRecord.sourceKind !== manifestRecord.sourceKind
      || specRecord.importMode !== manifestRecord.importMode) {
      throw new ControllerError(5, 'CONFLICT', 'Manifest/spec artifacts do not match the initialized source commitment');
    }
    const sourcePath = resolve(repositoryRoot, authority.specPath);
    try { await assertContained(repositoryRoot, sourcePath); }
    catch { throw new ControllerError(5, 'CONFLICT', 'Initialized specification source is no longer repository-contained'); }
    let currentSourceHash: string | undefined;
    try { currentSourceHash = hash(await readFile(sourcePath)); }
    catch { if (!allowSpecDrift) throw new ControllerError(5, 'CONFLICT', 'Initialized specification source is no longer readable'); }
    if (currentSourceHash !== undefined && currentSourceHash !== authority.sourceHash && !allowSpecDrift) throw new ControllerError(5, 'CONFLICT', 'Referenced specification source has drifted from its committed hash');
    if (authority.constitutionPath && authority.constitutionHash) {
      const constitutionPath = resolve(repositoryRoot, authority.constitutionPath);
      try {
        await assertContained(repositoryRoot, constitutionPath);
        if (hash(await readFile(constitutionPath)) !== authority.constitutionHash && !allowSpecDrift) throw new ControllerError(5, 'CONFLICT', 'Referenced constitution source has drifted from its committed hash');
      } catch (error: unknown) {
        if (error instanceof ControllerError) throw error;
        if (!allowSpecDrift) throw new ControllerError(5, 'CONFLICT', 'Referenced constitution source is no longer readable');
      }
    }
    const manifestProjection = relative(repositoryRoot, paths.manifest).split(sep).join('/');
    const specProjection = relative(repositoryRoot, paths.spec).split(sep).join('/');
    if (!expectedArtifacts.has(manifestProjection) || !expectedArtifacts.has(specProjection)) {
      if (!Array.isArray(manifestRecord.unresolvedDecisions) || manifestRecord.unresolvedDecisions.length !== 0) throw new ControllerError(5, 'CONFLICT', 'Legacy manifest has unresolved decisions without a committed artifact projection');
      if (manifestRecord.approvalRef !== specRecord.approvalRef || manifestRecord.approvalHash !== specRecord.approvalHash) throw new ControllerError(5, 'CONFLICT', 'Legacy manifest/spec approval fields disagree');
      const crossedApproval = events.some((event) => event.type === 'change.transition' && record(event.payload).to === 'spec-approved');
      const approval = latestPayload<{ receipt: RecordValue }>(events, 'receipt.approval.ingested')?.receipt;
      if (crossedApproval) {
        const expectedRef = approval ? `receipt:${String(approval.receiptId)}` : null;
        const expectedHash = approval ? fingerprint(approval) : null;
        if (!approval || manifestRecord.approvalRef !== expectedRef || manifestRecord.approvalHash !== expectedHash) throw new ControllerError(5, 'CONFLICT', 'Legacy approval artifact does not match the committed approval receipt/state');
      } else if (manifestRecord.approvalRef !== null || manifestRecord.approvalHash !== null) {
        throw new ControllerError(5, 'CONFLICT', 'Legacy approval artifact exists before a committed approved state');
      }
    }
    const routes = routedTasks(events);
    const artifactTasks = Array.isArray(tasksRecord.tasks) ? tasksRecord.tasks : [];
    if (routes.length === 0 && artifactTasks.length !== 0) throw new ControllerError(5, 'CONFLICT', 'Task artifact exists without a committed route');
    if (routes.length > 0) {
      if (artifactTasks.length !== routes.length || new Set(routes.map((route) => route.task.id)).size !== routes.length) throw new ControllerError(5, 'CONFLICT', 'Task artifact does not match the committed Lite route');
      const artifactsById = new Map<string, TaskDefinition>();
      for (const artifact of artifactTasks) {
        const taskValidation = validateTaskDefinition(artifact);
        if (!taskValidation.ok) validationError(taskValidation.details, 'task');
        const artifactTask = taskValidation.value as TaskDefinition;
        if (artifactsById.has(artifactTask.id)) throw new ControllerError(5, 'CONFLICT', 'Task artifact has duplicate task identities');
        artifactsById.set(artifactTask.id, artifactTask);
      }
      for (const route of routes) {
        const artifactTask = artifactsById.get(route.task.id);
        if (!artifactTask || taskDefinitionHash(artifactTask) !== route.taskHash || JSON.stringify(artifactTask) !== JSON.stringify(route.task)) throw new ControllerError(5, 'CONFLICT', 'Task artifact has drifted from its committed route/hash');
      }
    }
    this.verifyAssessmentHistory(events, expectedArtifacts);
    return events;
  }

  private assessmentHistory(events: JournalEvent[]): RecordedAssessment[] {
    const records = events.filter((event) => event.type === 'architecture.assessment.recorded').map((event) => validateRecordedAssessment(event.payload));
    verifyRecordedHistory(records);
    return records;
  }

  private verifyPreparedSpecRevision(repositoryRoot: string, changeId: string, priorRawEvents: JournalEvent[], batch: ControllerBatchPrepared, timestamp: string): void {
    const prior = priorRawEvents.at(-1);
    const preparedHash = 'e'.repeat(64); const committedHash = 'f'.repeat(64);
    const prepared: JournalEvent = { sequence: (prior?.sequence ?? 0) + 1, previousEventHash: prior?.eventHash ?? '0'.repeat(64), changeId,
      type: 'controller.batch.prepared', timestamp, payloadHash: hash(JSON.stringify(batch)), payload: batch, eventHash: preparedHash };
    const committed: JournalEvent = { sequence: prepared.sequence + 1, previousEventHash: preparedHash, changeId, type: 'controller.batch.committed', timestamp,
      payloadHash: hash(''), payload: { version: 1, batchId: batch.batchId, preparedEventHash: preparedHash }, eventHash: committedHash };
    this.verifySpecRevisionHistory(repositoryRoot, changeId, [...priorRawEvents, prepared, committed]);
  }

  private claimDesignEvidence(changeId: string, events: JournalEvent[], receipt: RecordValue, at: Date, fresh: boolean): DesignReviewContext {
    if (fresh) this.assertRevisionReceiptIdReserved(events, receipt);
    return this.designAdmission(() => validateClaimDesignEvidence({
      changeId,
      routes: routedTasks(events),
      authority: currentAuthority(events),
      history: this.designHistory(events),
      receipt: receipt as DesignReviewReceipt,
      at,
      fresh,
      receiptIdUsed: this.receiptIdUsed(events, receipt.receiptId),
    }));
  }

  /** Re-derive admission from prior authority and the immutable inputs at preparation, never recovery wall time. */
  private validateClaimBatch(changeId: string, prior: JournalEvent[], batch: ControllerBatchPrepared, at: Date): void {
    const recovery = validateSpecRevisionRecoveryProof(batch);
    if (!recovery || !['claim-continuation', 'claim-design-review'].includes(batch.kind) || batch.preparedAt !== at.toISOString()
      || batch.projections.length !== 0 || recovery.projections.length !== 0) throw new ControllerError(5, 'CONFLICT', 'Claim is missing its exact preparation proof');
    const operations = batch.operations;
    const newClaims = operations.filter((operation) => operation.type === 'run.claimed');
    const newClaim = newClaims[0]; const value = record(newClaim?.payload) as Claimed;
    if (newClaims.length !== 1 || typeof newClaim?.taskId !== 'string' || typeof value.runId !== 'string' || !value.runId
      || !value.lease || !Number.isFinite(Date.parse(value.lease.expiresAt)) || Date.parse(value.lease.expiresAt) <= at.getTime()
      || prior.some((event) => record(event.payload).runId === value.runId)
      || (value.sessionId !== undefined && (typeof value.sessionId !== 'string' || !value.sessionId.trim()))) {
      throw new ControllerError(5, 'CONFLICT', 'Claim successor Run identity, session or expiry is invalid');
    }
    const taskId = newClaim.taskId; const sessionId = value.sessionId;
    const inputTree = { hash: recovery.subjectTreeHash, entries: recovery.remainderEntries };
    if (hash(`${TREE_IGNORE_POLICY_VERSION}\n${inputTree.entries.join('\n')}`) !== inputTree.hash
      || new Set(inputTree.entries.map(entryPath)).size !== inputTree.entries.length) throw new ControllerError(5, 'CONFLICT', 'Claim input entries are not the canonical recovery identity');
    const lifecycle = reduceJournal(prior);
    let plan: ClaimPlan;
    if (batch.kind === 'claim-continuation') {
      const oldRunId = record(operations[0]?.payload).runId;
      if (typeof oldRunId !== 'string') throw new ControllerError(5, 'CONFLICT', 'Continuation is missing its prior Run fence');
      const admitted = this.claimContinuationAdmission(prior, lifecycle, taskId, oldRunId, sessionId, inputTree, at);
      plan = { ...admitted, currentTaskState: 'ready', sessionId, inputTree };
    } else {
      plan = { ...this.claimAdmission(prior, lifecycle, taskId), sessionId, inputTree };
    }
    const authority = currentAuthority(prior);
    const entries = new Map(inputTree.entries.map((entry) => [entryPath(entry), entry.split('\0')[2]]));
    if (!authority || entries.get(authority.specPath) !== authority.sourceHash
      || (authority.constitutionPath && entries.get(authority.constitutionPath) !== authority.constitutionHash)
      || taskDefinitionHash(plan.routed.task) !== plan.routed.taskHash) throw new ControllerError(5, 'CONFLICT', 'Claim tree and route do not bind current specification authority');
    const receiptOperations = operations.filter((operation) => operation.type === 'receipt.design-review.ingested');
    const receiptOperation = receiptOperations[0];
    let sources: Array<{ relativePath: string; sha256: string }> = [];
    if (receiptOperations.length > 1 || (batch.kind === 'claim-design-review' && !receiptOperation)) throw new ControllerError(5, 'CONFLICT', 'Claim must contain its single fresh design receipt');
    if (receiptOperation) {
      const decoded = this.decodedDesignEvent(receiptOperation);
      if (!decoded || decoded.type !== 'receipt.design-review.ingested') throw new ControllerError(5, 'CONFLICT', 'Claim has an unrecognized design receipt event');
      const receipt = decoded.payload.receipt; const source = decoded.payload.receiptSource;
      const context = this.claimDesignEvidence(changeId, prior, receipt, at, true);
      if (!source) throw new ControllerError(5, 'CONFLICT', 'Claim receipt source bytes are missing');
      const bytes = Buffer.from(source.bytesBase64, 'base64');
      let parsed: unknown;
      try { parsed = YAML.parse(bytes.toString('utf8')); }
      catch { throw new ControllerError(5, 'CONFLICT', 'Claim receipt source cannot be parsed'); }
      if (bytes.toString('base64') !== source.bytesBase64 || hash(bytes) !== source.sha256 || fingerprint(parsed) !== fingerprint(receipt)) throw new ControllerError(5, 'CONFLICT', 'Embedded claim receipt does not match its exact source bytes');
      plan.designReceipt = { receipt, source: { relativePath: source.relativePath, sha256: source.sha256, bytesBase64: source.bytesBase64 }, designSource: { relativePath: context.designPath, sha256: context.designHash } };
      sources = [plan.designReceipt.designSource, { relativePath: source.relativePath, sha256: source.sha256 }];
    } else if (routedRisk(routedTasks(prior)) !== 'lite') {
      const receipt = this.designHistory(prior).receipt;
      const context = this.claimDesignEvidence(changeId, prior, receipt ?? {}, at, false);
      sources = [{ relativePath: context.designPath, sha256: context.designHash }];
    }
    if (fingerprint(recovery.sources) !== fingerprint(sources)) throw new ControllerError(5, 'CONFLICT', 'Claim recovery sources do not exactly bind its review authority');
    for (const source of sources) {
      if (entries.has(source.relativePath) && entries.get(source.relativePath) !== source.sha256) throw new ControllerError(5, 'CONFLICT', 'Claim referenced source differs from its canonical tree entry');
    }
    const lease: Lease = { taskId, taskRevision: plan.routed.task.revision, inputTreeHash: inputTree.hash,
      generation: this.nextClaimGeneration(prior, taskId), expiresAt: value.lease.expiresAt };
    if (!Number.isSafeInteger(lease.generation) || lease.generation < 1 || fingerprint(operations) !== fingerprint(this.claimOperations(changeId, plan, lease, value.runId))) {
      throw new ControllerError(5, 'CONFLICT', 'Claim operations are not the exact admitted fence and successor');
    }
  }

  private nextClaimGeneration(events: JournalEvent[], taskId: string): number {
    return events.filter((event) => event.type === 'lease.claimed' && event.taskId === taskId)
      .reduce((maximum, event) => Math.max(maximum, event.leaseGeneration ?? 0), 0) + 1;
  }

  private verifyClaimContinuationHistory(changeId: string, rawEvents: JournalEvent[], allowPending: boolean): void {
    for (let index = 0; index < rawEvents.length; index += 1) {
      const prepared = rawEvents[index]!;
      if (prepared.type === 'task.continuation.recovered') throw new ControllerError(7, 'BLOCKED', 'Unbatched continuation guard');
      if (prepared.type !== 'controller.batch.prepared') continue;
      const batch = record(prepared.payload) as unknown as ControllerBatchPrepared;
      const operations = Array.isArray(batch.operations) ? batch.operations : [];
      const guarded = ['claim-continuation', 'claim-design-review'].includes(batch.kind);
      const containsGuard = operations.some((operation) => operation.type === 'task.continuation.recovered');
      const containsFreshReceipt = operations.some((operation) => operation.type === 'receipt.design-review.ingested')
        && (batch.kind === 'claim' || operations.some((operation) => operation.type === 'run.claimed'));
      if (!guarded && !containsGuard && !containsFreshReceipt) continue;
      const committed = rawEvents[index + 1];
      if (!guarded || prepared.changeId !== changeId || (!committed && !allowPending)
        || (committed && (committed.type !== 'controller.batch.committed' || committed.changeId !== changeId))) throw new ControllerError(7, 'BLOCKED', 'Claim evidence must belong to its exact guarded batch');
      try { this.validateClaimBatch(changeId, projectJournalEvents(rawEvents.slice(0, index)).events, batch, new Date(prepared.timestamp)); }
      catch (error) { throw new ControllerError(7, 'BLOCKED', `Invalid claim preparation: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }

  private verifySpecRevisionHistory(repositoryRoot: string, changeId: string, rawEvents: JournalEvent[], allowPending = false): void {
    this.verifyClaimContinuationHistory(changeId, rawEvents, allowPending);
    if (rawEvents.some((event) => event.type === 'controller.spec.revised' || event.type === 'receipt.spec-revision.ingested')) throw new ControllerError(7, 'BLOCKED', 'Specification revision authority and receipt must belong to the exact controller batch');
    const projection = projectJournalEvents(rawEvents);
    const logicalReceipts = projection.events.filter((event) => event.type.startsWith('receipt.') && event.type.endsWith('.ingested'));
    const pendingBatchReceipts = projection.pending
      ? projection.pending.batch.operations.filter((operation) => operation.type.startsWith('receipt.') && operation.type.endsWith('.ingested')).map((operation) => ({ type: operation.type, payload: operation.payload }))
      : [];
    const receiptEvents = [...logicalReceipts, ...pendingBatchReceipts];
    const receiptIdCounts = new Map<string, number>();
    for (const event of receiptEvents) {
      const receiptId = record(record(event.payload).receipt).receiptId;
      if (typeof receiptId === 'string') receiptIdCounts.set(receiptId, (receiptIdCounts.get(receiptId) ?? 0) + 1);
    }
    for (const event of receiptEvents.filter((candidate) => candidate.type === 'receipt.spec-revision.ingested')) {
      const receiptId = record(record(event.payload).receipt).receiptId;
      if (typeof receiptId !== 'string' || receiptId.length === 0 || receiptIdCounts.get(receiptId) !== 1) throw new ControllerError(7, 'BLOCKED', 'Specification revision receipt identity is invalid or has been consumed more than once');
    }
    let revisionBatchSeen = false;
    for (const event of rawEvents) {
      if (event.type === 'route.selected' && revisionBatchSeen) throw new ControllerError(7, 'BLOCKED', 'Replacement routes cannot be reused outside their specification revision batch');
      if (event.type !== 'controller.batch.prepared') continue;
      const batch = record(event.payload); const operations = Array.isArray(batch.operations) ? batch.operations.map(record) : [];
      const hasRevision = operations.some((operation) => operation.type === 'controller.spec.revised');
      const hasRevisionReceipt = operations.some((operation) => operation.type === 'receipt.spec-revision.ingested');
      const projections = Array.isArray(batch.projections) ? batch.projections.map(record) : [];
      const hasImmutableRevisionProjection = projections.some((projection) => new RegExp(`^\\.leo-dev/changes/${changeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/spec-revisions/[a-f0-9]{64}\\.yaml$`).test(String(projection.relativePath)));
      if (batch.recovery !== undefined && !['spec-revision', 'release-evidence', 'archive', 'claim-continuation', 'claim-design-review'].includes(String(batch.kind))) throw new ControllerError(7, 'BLOCKED', 'Controller recovery proof is attached to an unrelated batch');
      if (['release-evidence', 'archive'].includes(String(batch.kind))) {
        try { validateSpecRevisionRecoveryProof(batch as unknown as ControllerBatchPrepared); }
        catch { throw new ControllerError(7, 'BLOCKED', 'Release recovery proof is missing or invalid'); }
      }
      if (hasImmutableRevisionProjection && (!hasRevision || batch.kind !== 'spec-revision')) throw new ControllerError(7, 'BLOCKED', 'Immutable specification revision projection is orphaned outside its exact revision batch');
      if (hasRevisionReceipt && (!hasRevision || batch.kind !== 'spec-revision')) throw new ControllerError(7, 'BLOCKED', 'Specification revision receipt is orphaned outside its exact revision batch');
      if (revisionBatchSeen && !hasRevision && operations.some((operation) => operation.type === 'route.selected')) throw new ControllerError(7, 'BLOCKED', 'Replacement routes cannot be reused outside their specification revision batch');
      if (hasRevision) revisionBatchSeen = true;
    }
    let records = 0;
    for (let index = 0; index < rawEvents.length; index += 1) {
      const prepared = rawEvents[index]!;
      if (prepared.type !== 'controller.batch.prepared') continue;
      const batch = record(prepared.payload);
      const operations = Array.isArray(batch.operations) ? batch.operations.map(record) : [];
      const revisionOperations = operations.filter((operation) => operation.type === 'controller.spec.revised');
      if (revisionOperations.length === 0) continue;
      const committed = rawEvents[index + 1];
      const pending = committed === undefined;
      if (prepared.changeId !== changeId || prepared.taskId !== undefined || prepared.taskRevision !== undefined || prepared.leaseGeneration !== undefined
        || batch.kind !== 'spec-revision' || revisionOperations.length !== 1 || (!pending && (committed?.type !== 'controller.batch.committed' || committed.changeId !== changeId
          || committed.taskId !== undefined || committed.taskRevision !== undefined || committed.leaseGeneration !== undefined)) || (pending && !allowPending)) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision has invalid batch provenance');
      }
      const revision = validateSpecRevisionRecord(revisionOperations[0]!.payload);
      if (!revision) throw new ControllerError(7, 'BLOCKED', 'Specification revision record is malformed or has an invalid semantic fingerprint');
      const authority = revision.authority;
      const prior = projectJournalEvents(rawEvents.slice(0, index)).events;
      const previous = currentAuthority(prior);
      const previousRoutes = routedTasks(prior);
      if (!previous || authority.revision !== previous.revision + 1 || authority.previousRevisionId !== previous.revisionId || authority.previousSpecHash !== previous.specHash
        || authority.previousSource.path !== previous.specPath || authority.previousSource.sourceHash !== previous.sourceHash
        || (previous.sourceBase64 !== null && (authority.previousSource.bytesUnavailable || authority.previousSource.sourceBase64 !== previous.sourceBase64))) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision prior-authority chain is invalid');
      }
      if (sameRevisionSubstance(authority, previous, previousRoutes)) throw new ControllerError(7, 'BLOCKED', 'Specification revision history contains a semantic no-op');
      const priorById = new Map(previousRoutes.map((route) => [route.task.id, route]));
      if (authority.routes.some((route) => {
        const old = priorById.get(route.task.id); return old ? route.task.revision !== old.task.revision + 1 : route.task.revision !== 1;
      }) || [...priorById.keys()].some((id) => !authority.routes.some((route) => route.task.id === id))) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision task closure or exact revision increment is invalid');
      }
      const assessmentOperation = operations.filter((operation) => operation.type === 'architecture.assessment.recorded');
      const receiptOperation = operations.filter((operation) => operation.type === 'receipt.spec-revision.ingested');
      const routeOperations = operations.filter((operation) => operation.type === 'route.selected');
      const transitionOperations = operations.filter((operation) => operation.type === 'change.transition');
      if (assessmentOperation.length !== 1 || receiptOperation.length !== 1 || routeOperations.length !== authority.routes.length || transitionOperations.length !== 1) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision batch operation closure is invalid');
      }
      let assessment: RecordedAssessment;
      try { assessment = validateRecordedAssessment(assessmentOperation[0]!.payload); } catch { throw new ControllerError(7, 'BLOCKED', 'Specification revision assessment is malformed'); }
      try { verifyRecordedHistory([...this.assessmentHistory(prior), assessment]); } catch { throw new ControllerError(7, 'BLOCKED', 'Specification revision assessment does not preserve its prior governance history'); }
      const taskId = `plan:${fingerprint(authority.routes.map((route) => route.task))}`;
      if (assessment.disposition !== 'ready' || assessment.assessment.changeId !== changeId || assessment.assessment.taskId !== taskId || assessment.assessment.specHash !== authority.specHash) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision assessment does not bind its authority');
      }
      const receiptPayload = record(receiptOperation[0]!.payload); const receipt = record(receiptPayload.receipt);
      const context = record(receiptPayload.approvalContext);
      const tail = rawEvents[index - 1]?.eventHash ?? '0'.repeat(64);
      const expectedContext = revisionApprovalContext({ changeId, repositoryRoot, authority, previousJournalTailHash: tail, subjectTreeHash: assessment.assessment.subjectTreeHash, assessmentFingerprint: assessment.fingerprint });
      const preparedAt = typeof batch.preparedAt === 'string' ? new Date(batch.preparedAt) : new Date(Number.NaN);
      if (Number.isNaN(preparedAt.getTime()) || batch.preparedAt !== prepared.timestamp
        || fingerprint(receiptPayload) !== fingerprint({ receipt, issuerAuthenticated: false, approvalContext: context }) || receipt.taskId !== undefined
        || !validateReceipt('approval', receipt, preparedAt).ok || receipt.decision !== 'grant' || receipt.changeId !== changeId || receipt.scope !== 'change' || receipt.operationKind !== 'spec-revision'
        || fingerprint(context) !== fingerprint(expectedContext) || !Object.entries(expectedContext).every(([key, value]) => receipt[key] === value)) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision approval receipt/context is invalid');
      }
      if (routeOperations.some((operation, routeIndex) => operation.taskId !== authority.routes[routeIndex]?.task.id || operation.taskRevision !== authority.routes[routeIndex]?.task.revision || fingerprint(operation.payload) !== fingerprint(authority.routes[routeIndex]))) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision replacement routes are invalid');
      }
      const transition = transitionOperations[0]!;
      if (transition.payload === undefined || record(transition.payload).to !== 'spec-approved' || record(transition.payload).revisionReset !== true) throw new ControllerError(7, 'BLOCKED', 'Specification revision does not reset the change to spec-approved');
      const lifecycle = reduceJournal(prior);
      if (specRevisionAdmissionBarrier(prior, lifecycle)) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision batch violates its prefix admission barriers');
      }
      const expectedOperations: ControllerBatchOperation[] = [
        { type: 'architecture.assessment.recorded', payload: assessment },
        { type: 'receipt.spec-revision.ingested', payload: { receipt, issuerAuthenticated: false, approvalContext: context } },
        { type: 'controller.spec.revised', payload: revision },
        ...authority.routes.map((route) => ({ taskId: route.task.id, taskRevision: route.task.revision, type: 'route.selected', payload: route })),
        { type: 'change.transition', payload: { from: lifecycle.changeState, to: 'spec-approved', revisionReset: true } },
      ];
      if (fingerprint(operations) !== fingerprint(expectedOperations)) throw new ControllerError(7, 'BLOCKED', 'Specification revision batch operation sequence is not the exact authorized replacement');
      const projections = Array.isArray(batch.projections) ? batch.projections.map(record) : [];
      const manifestPath = `.leo-dev/changes/${changeId}/manifest.yaml`;
      const specPath = `.leo-dev/changes/${changeId}/spec.yaml`;
      const tasksPath = `.leo-dev/changes/${changeId}/tasks.yaml`;
      const revisionPath = `.leo-dev/changes/${changeId}/spec-revisions/${authority.revisionId}.yaml`;
      const exactProjectionPaths = new Set([manifestPath, specPath, tasksPath, revisionPath, assessment.relativePath]);
      if ([authority.specPath, authority.constitutionPath, ...authority.routes.map((route) => route.registryPath)]
        .some((path) => typeof path === 'string' && exactProjectionPaths.has(path))) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision history binds an authority input to its generated projection');
      }
      const priorProjections = projectJournalEvents(rawEvents.slice(0, index)).committedProjections;
      const priorProjection = (path: string) => priorProjections.filter((projection) => projection.relativePath === path).at(-1);
      const recovery = record(batch.recovery);
      const recoveryProjections = Array.isArray(recovery.projections) ? recovery.projections.map(record) : [];
      const recoveredPrior = (path: string) => record(recoveryProjections.find((projection) => projection.relativePath === path)?.prior);
      const priorValue = (path: string): unknown => {
        const committedProjection = priorProjection(path);
        if (committedProjection) return committedProjection.desiredValue;
        const snapshot = recoveredPrior(path);
        if (snapshot.type !== 'file' || typeof snapshot.bytesBase64 !== 'string') return undefined;
        try { return YAML.parse(Buffer.from(snapshot.bytesBase64, 'base64').toString('utf8')); } catch { return undefined; }
      };
      const priorHash = (path: string): string => {
        const committedProjection = priorProjection(path);
        if (committedProjection) return committedProjection.desiredHash;
        const snapshot = recoveredPrior(path);
        return snapshot.type === 'file' && typeof snapshot.bytesBase64 === 'string' ? hash(Buffer.from(snapshot.bytesBase64, 'base64')) : hash('');
      };
      const priorManifest = record(priorValue(manifestPath));
      const priorSpec = record(priorValue(specPath));
      if (!Array.isArray(priorManifest.unresolvedDecisions) || priorManifest.unresolvedDecisions.length !== 0) throw new ControllerError(7, 'BLOCKED', 'Specification revision prefix has unresolved manifest decisions');
      const approvalRef = `receipt:${String(receipt.receiptId)}`; const approvalHash = fingerprint(receipt);
      const desiredValues: Array<[string, unknown]> = [
        [manifestPath, { ...priorManifest, state: 'spec-approved', specRef: authority.specPath, sourceHash: authority.sourceHash, approvalRef, approvalHash }],
        [specPath, { ...priorSpec, sourceHash: authority.sourceHash, approvalRef, approvalHash }],
        [tasksPath, { schemaVersion: 1, tasks: authority.routes.map((route) => route.task) }],
        [revisionPath, revision],
        [assessment.relativePath, assessment.assessment],
      ];
      const expectedProjections = desiredValues.map(([relativePath, desiredValue]) => ({
        relativePath,
        priorHash: priorHash(relativePath),
        desiredHash: hash(YAML.stringify(desiredValue)),
        desiredValue,
      }));
      if (fingerprint(projections) !== fingerprint(expectedProjections)) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision immutable projections are invalid');
      }
      const sources = Array.isArray(recovery.sources) ? recovery.sources : [];
      const expectedSources = [{ relativePath: authority.specPath, sha256: authority.sourceHash }, ...(authority.constitutionPath && authority.constitutionHash ? [{ relativePath: authority.constitutionPath, sha256: authority.constitutionHash }] : [])];
      if (recovery.kind !== 'spec-revision' || recovery.subjectTreeHash !== assessment.assessment.subjectTreeHash
        || fingerprint(sources) !== fingerprint(expectedSources) || !Array.isArray(recovery.remainderEntries)
        || !Array.isArray(recovery.projections) || recovery.projections.length !== expectedProjections.length) {
        throw new ControllerError(7, 'BLOCKED', 'Specification revision recovery proof is missing or does not bind the approved inputs');
      }
      try { validateSpecRevisionRecoveryProof(batch as unknown as ControllerBatchPrepared); }
      catch { throw new ControllerError(7, 'BLOCKED', 'Specification revision recovery proof is structurally or cryptographically invalid'); }
      if (!pending) { records += 1; index += 1; }
    }
    if (records !== projectJournalEvents(rawEvents).events.filter((event) => event.type === 'controller.spec.revised').length) throw new ControllerError(7, 'BLOCKED', 'Specification revision history contains an orphaned authority event');
  }

  private verifyAssessmentHistory(events: JournalEvent[], projections: Map<string, { desiredValue: unknown }>): void {
    const records = this.assessmentHistory(events);
    for (const assessment of records) {
      const projection = projections.get(assessment.relativePath);
      if (!projection || fingerprint(projection.desiredValue) !== fingerprint(assessment.assessment)) {
        throw new ControllerError(7, 'BLOCKED', 'Recorded assessment has no matching immutable normalized projection');
      }
    }
  }

  private async governanceAdmission(repositoryRoot: string, changeId: string, taskId: string, options: CommandOptions, events: JournalEvent[]): Promise<{ recorded?: RecordedAssessment; previous?: RecordedAssessment; subjectTreeHash: string }> {
    const initialized = currentAuthority(events);
    if (!initialized) throw new ControllerError(7, 'BLOCKED', 'Governance admission requires initialized change authority');
    const history = this.assessmentHistory(events);
    const previous = history.at(-1);
    const subjectTreeHash = (await canonicalTreeHash(repositoryRoot)).hash;
    const input = stringOption(options, 'assessment', false);
    if (!input) return { previous, subjectTreeHash };
    const runtime = runtimePaths(repositoryRoot, changeId);
    const candidate = await loadAssessmentInput(repositoryRoot, runtime.directory, input);
    const recorded = assess(candidate, { changeId, taskId, specHash: initialized.specHash, subjectTreeHash }, previous);
    verifyRecordedHistory([...history, recorded]);
    return { previous, subjectTreeHash, recorded };
  }

  private async governanceState(repositoryRoot: string, changeId: string, events: JournalEvent[]): Promise<RecordValue> {
    const initialized = currentAuthority(events);
    const latest = this.assessmentHistory(events).at(-1);
    return {
      changeId,
      specHash: initialized?.specHash ?? null,
      subjectTreeHash: (await canonicalTreeHash(repositoryRoot)).hash,
      status: latest?.disposition ?? 'not-assessed',
      latestAssessmentFingerprint: latest?.fingerprint ?? null,
      recordedSubjectTreeHash: latest?.assessment.subjectTreeHash ?? null,
      latest: latest ? { assessmentId: latest.assessment.assessmentId, fingerprint: latest.fingerprint, disposition: latest.disposition, relativePath: latest.relativePath } : null,
    };
  }

  private async planAssessmentContext(repositoryRoot: string, changeId: string, events: JournalEvent[], taskId: string, candidate?: RecordedAssessment): Promise<RecordValue> {
    const context = await this.governanceState(repositoryRoot, changeId, events);
    return { ...context, taskId, status: candidate?.disposition ?? context.status };
  }

  private governanceRefusal(disposition: 'approval-required' | 'assessment-required' | 'local-remediation-required', state: unknown): never {
    if (disposition === 'approval-required') throw new ControllerError(6, 'APPROVAL_REQUIRED', 'Governance admission requires a scope-specific user decision; an ordinary receipt or later ready assessment cannot authorize material work', state);
    if (disposition === 'local-remediation-required') throw new ControllerError(7, 'LOCAL_REMEDIATION_REQUIRED', 'Governance assessment requires a bounded local repair before Lite task admission', state);
    throw new ControllerError(7, 'ASSESSMENT_REQUIRED', 'Governance assessment is incomplete, uncertain, or was previously recorded and cannot be bypassed by omission', state);
  }

  private historicalGateAuthority(logical: JournalEvent[], beforeSequence: number, identity: {
    changeId: string;
    runId: string;
    taskId: string;
    taskRevision: number;
    leaseGeneration: number;
    gateId?: string;
  }): { routed: Routed; claimed: Claimed; routeEvent: JournalEvent; claimEvent: JournalEvent } {
    const claims = logical.filter((event) => event.type === 'run.claimed'
      && (record(event.payload).runId === identity.runId
        || (event.taskId === identity.taskId && event.taskRevision === identity.taskRevision && event.leaseGeneration === identity.leaseGeneration)));
    if (claims.length !== 1) throw new ControllerError(7, 'BLOCKED', `Run ${identity.runId} has no unique durable claim authority`);
    const claimEvent = claims[0]!;
    const claimed = record(claimEvent.payload) as Claimed;
    const lease = record(claimed.lease);
    if (claimEvent.sequence >= beforeSequence || claimEvent.changeId !== identity.changeId || claimEvent.taskId !== identity.taskId || claimEvent.taskRevision !== identity.taskRevision || claimEvent.leaseGeneration !== identity.leaseGeneration
      || claimed.runId !== identity.runId || !journalHashPattern.test(String(claimed.operationFingerprint))
      || lease.taskId !== identity.taskId || lease.taskRevision !== identity.taskRevision || lease.generation !== identity.leaseGeneration
      || !journalHashPattern.test(String(lease.inputTreeHash)) || typeof lease.expiresAt !== 'string' || Number.isNaN(Date.parse(lease.expiresAt))) {
      throw new ControllerError(7, 'BLOCKED', `Run ${identity.runId} claim authority is malformed or mismatched`);
    }
    const routes = logical.filter((event) => {
      if (event.type !== 'route.selected' || event.changeId !== identity.changeId || event.taskId !== identity.taskId || event.taskRevision !== identity.taskRevision) return false;
      const routed = record(event.payload) as Routed;
      return routed.task?.id === identity.taskId && routed.task.revision === identity.taskRevision
        && (identity.gateId === undefined || routed.task.gateIds?.[0] === identity.gateId);
    });
    if (routes.length !== 1) throw new ControllerError(7, 'BLOCKED', `Run ${identity.runId} has no unique durable route authority`);
    const routeEvent = routes[0]!;
    const routed = record(routeEvent.payload) as Routed;
    if (routeEvent.sequence >= beforeSequence || routeEvent.changeId !== claimEvent.changeId || !journalHashPattern.test(String(routed.taskHash)) || routed.taskHash !== taskDefinitionHash(routed.task)
      || !journalHashPattern.test(String(routed.gateDefinitionHash)) || typeof routed.registryPath !== 'string' || !routed.registryPath
      || !Array.isArray(routed.task.gateIds) || routed.task.gateIds.length !== 1 || typeof routed.task.gateIds[0] !== 'string') {
      throw new ControllerError(7, 'BLOCKED', `Run ${identity.runId} route authority is malformed or mismatched`);
    }
    return { routed, claimed, routeEvent, claimEvent };
  }

  private async gateAuthorityRequest(repositoryRoot: string, changeId: string, taskId: string, routed: Routed, claimed: Claimed, candidate?: CandidateBinding): Promise<GateSettlementInspectionRequest> {
    const registryPath = resolve(repositoryRoot, routed.registryPath);
    let registry: GateRegistry;
    try {
      await assertContained(repositoryRoot, registryPath);
      registry = await GateRegistry.fromYaml(registryPath);
    } catch {
      throw new ControllerError(7, 'BLOCKED', 'Durable Gate registry authority is missing, invalid, or not repository-contained');
    }
    return this.gateSettlementRequest(repositoryRoot, changeId, taskId, routed, claimed, registry, candidate);
  }

  private async verifyStandaloneUnknown(repositoryRoot: string, changeId: string, rawEvents: JournalEvent[], logical: JournalEvent[], claim: GateResultClaim, allowIncompleteTail: boolean, observation?: JournalObservation): Promise<void> {
    const { event, payload, batch } = claim;
    if (!batch || batch.kind !== 'unknown-outcome') throw new ControllerError(7, 'BLOCKED', 'Standalone unknown result has no durable unknown-outcome batch');
    const runId = String(payload.runId);
    const taskId = event.taskId;
    const taskRevision = event.taskRevision;
    const leaseGeneration = event.leaseGeneration;
    if (!taskId || !Number.isSafeInteger(taskRevision) || !Number.isSafeInteger(leaseGeneration)) throw new ControllerError(7, 'BLOCKED', 'Standalone unknown result envelope is malformed');
    const contexts = logical.filter((candidate) => candidate.type === 'run.unknown.context'
      && (record(candidate.payload).runId === runId
        || (candidate.taskId === taskId && candidate.taskRevision === taskRevision && candidate.leaseGeneration === leaseGeneration)));
    if (contexts.length !== 1 || contexts[0]!.eventHash !== event.eventHash) throw new ControllerError(7, 'BLOCKED', `Run ${runId} has no unique batch-bound unknown context`);
    const contextEvent = contexts[0]!;
    const context = record(contextEvent.payload) as UnknownContext;
    if (contextEvent.taskId !== taskId || contextEvent.taskRevision !== taskRevision || contextEvent.leaseGeneration !== leaseGeneration
      || context.runId !== runId || context.taskId !== taskId || context.taskRevision !== taskRevision || context.leaseGeneration !== leaseGeneration
      || !journalHashPattern.test(String(context.operationFingerprint)) || !journalHashPattern.test(String(context.inputTreeHash))
      || !Array.isArray(context.evidenceHashes) || context.evidenceHashes.length < 1 || !context.evidenceHashes.every((value) => journalHashPattern.test(String(value)))
      || context.resumeTaskStateOnSuccess !== 'verifying' || context.retryRemaining !== true) {
      throw new ControllerError(7, 'BLOCKED', `Run ${runId} unknown context is malformed or mismatched`);
    }
    const sameRunPrepared = rawEvents.filter((candidate) => candidate.type === 'gate.attempt.prepared'
      && (record(candidate.payload).runId === runId
        || (candidate.taskId === taskId && candidate.taskRevision === taskRevision && candidate.leaseGeneration === leaseGeneration)));
    if (sameRunPrepared.length !== 1) throw new ControllerError(7, 'BLOCKED', `Run ${runId} has no unique durable prepared Gate attempt`);
    const preparedEvent = sameRunPrepared[0]!;
    if (preparedEvent.sequence >= batch.prepared.sequence) throw new ControllerError(7, 'BLOCKED', `Run ${runId} Gate attempt does not precede its unknown-outcome batch`);
    const { routed, claimed, claimEvent } = this.historicalGateAuthority(logical, preparedEvent.sequence, { changeId, runId, taskId, taskRevision, leaseGeneration });
    const ownerFieldsPresent = payload.changeId !== undefined || payload.taskId !== undefined
      || payload.taskRevision !== undefined || payload.leaseGeneration !== undefined || payload.gateId !== undefined;
    if (ownerFieldsPresent && (payload.changeId !== changeId || payload.taskId !== taskId || payload.taskRevision !== taskRevision
      || payload.leaseGeneration !== leaseGeneration || payload.gateId !== routed.task.gateIds[0])) {
      throw new ControllerError(7, 'BLOCKED', `Run ${runId} unknown result payload ownership is malformed or mismatched`);
    }
    const sameRunPhases = rawEvents.filter((candidate) => candidate.type.startsWith('gate.attempt.')
      && (record(candidate.payload).runId === runId
        || (candidate.taskId === taskId && candidate.taskRevision === taskRevision && candidate.leaseGeneration === leaseGeneration)));
    if (fingerprint(sameRunPhases.map((candidate) => candidate.eventHash)) !== fingerprint(context.evidenceHashes)) {
      throw new ControllerError(7, 'BLOCKED', `Run ${runId} unknown context does not enumerate its exact durable Gate phase history`);
    }
    const request = await this.gateAuthorityRequest(repositoryRoot, changeId, taskId, routed, claimed, candidateForRun(logical, taskId, runId));
    const verified = await new GateRunner().inspectIndeterminateAttempt(request, context.evidenceHashes, allowIncompleteTail, observation);
    if (record(preparedEvent.payload).attemptId !== verified.attemptId || verified.operationFingerprint !== context.operationFingerprint || verified.inputTreeHash !== context.inputTreeHash) {
      throw new ControllerError(7, 'BLOCKED', `Run ${runId} unknown context does not match its verified Gate attempt`);
    }
    const priorRaw = rawEvents.filter((candidate) => candidate.sequence < batch.prepared.sequence);
    const priorLogical = projectJournalEvents(priorRaw).events;
    const priorState = reduceJournal(priorLogical);
    const priorTask = priorState.tasks[taskId];
    const priorRun = priorState.runs[runId];
    const priorLease = priorState.leases[taskId];
    if (context.priorChangeState !== priorState.changeState
      || priorTask?.state !== 'implementing' || priorTask.revision !== taskRevision || priorTask.leaseGeneration !== leaseGeneration
      || priorRun?.state !== 'running' || priorRun.taskId !== taskId
      || priorLease?.active !== true || priorLease.generation !== leaseGeneration) {
      throw new ControllerError(7, 'BLOCKED', `Run ${runId} unknown-outcome batch has invalid immediate lifecycle authority`);
    }
    const matchingLeaseClaims = priorLogical.filter((candidate) => candidate.type === 'lease.claimed' && candidate.taskId === taskId
      && candidate.taskRevision === taskRevision && candidate.leaseGeneration === leaseGeneration);
    if (matchingLeaseClaims.length !== 1 || fingerprint(record(matchingLeaseClaims[0]!.payload).lease) !== fingerprint(claimed.lease)
      || priorLogical.some((candidate) => (candidate.type === 'lease.released' || candidate.type === 'lease.abandoned')
        && candidate.taskId === taskId && candidate.leaseGeneration === leaseGeneration && candidate.sequence > claimEvent.sequence)) {
      throw new ControllerError(7, 'BLOCKED', `Run ${runId} unknown-outcome batch does not retain its exact active lease authority`);
    }
    const blockerId = `run-unknown:${runId}`;
    const scope = { taskId, taskRevision, leaseGeneration };
    const expectedOperations: ControllerBatchOperation[] = [
      { ...scope, type: 'task.transition', payload: { from: 'implementing', to: 'verifying' } },
      { ...scope, type: 'run.transition', payload: { runId, from: 'running', to: 'unknown' } },
      { ...scope, type: 'controller.gate.result', payload },
      { ...scope, type: 'run.unknown.context', payload: context },
      { ...scope, type: 'blocker.recorded', payload: { blockerId, reason: 'run outcome unknown' } },
      { ...scope, type: 'task.transition', payload: { from: 'verifying', to: 'blocked', blockerId } },
      { type: 'change.transition', payload: { from: priorState.changeState, to: 'approval-required', storedPriorState: priorState.changeState, reason: 'run outcome unknown' } },
    ];
    if (fingerprint(batch.operations) !== fingerprint(expectedOperations)) {
      throw new ControllerError(7, 'BLOCKED', `Run ${runId} unknown-outcome batch mapping is malformed`);
    }
  }

  private async verifyGateHandoffHistory(repositoryRoot: string, changeId: string, rawEvents: JournalEvent[], handoff: Exclude<GateHandoffClassification, { kind: 'invalid' }>, allowIncompleteTail: boolean, observation?: JournalObservation): Promise<void> {
    const logical = projectJournalEvents(rawEvents).events;
    const runner = new GateRunner();
    const verifyTerminal = async (terminal: GateTerminalClaim): Promise<VerifiedGateSettlement> => {
      const { routed, claimed } = this.historicalGateAuthority(logical, terminal.event.sequence, {
        changeId,
        runId: terminal.runId,
        taskId: terminal.taskId,
        taskRevision: terminal.taskRevision,
        leaseGeneration: terminal.leaseGeneration,
        gateId: terminal.gateId,
      });
      const request = await this.gateAuthorityRequest(repositoryRoot, changeId, terminal.taskId, routed, claimed, candidateForRun(logical, terminal.taskId, terminal.runId));
      const verified = allowIncompleteTail
        ? await runner.inspectSettlementBeforeIncompleteTail(request, observation)
        : await runner.inspectSettlement(request, observation);
      if (verified.attemptId !== terminal.attemptId || verified.status !== terminal.status
        || fingerprint(verified.outcome) !== fingerprint(terminal.outcome) || verified.evidenceRef !== terminal.evidenceRef
        || verified.phaseEventHashes.at(-1) !== terminal.event.eventHash) {
        throw new ControllerError(7, 'BLOCKED', `Mapped Gate attempt ${terminal.attemptId} does not match its verified settlement`);
      }
      return verified;
    };
    for (const mapped of handoff.mapped) {
      await verifyTerminal(mapped.terminal);
    }
    if (handoff.kind === 'pending') await verifyTerminal(handoff.terminal);
    for (const standalone of handoff.standalone) await this.verifyStandaloneUnknown(repositoryRoot, changeId, rawEvents, logical, standalone, allowIncompleteTail, observation);
    const unknownResults = logical.filter((event) => event.type === 'controller.gate.result'
      && ['unknown', 'evidence-blocked-secret'].includes(String(record(event.payload).status)));
    const contextsByRun = new Map<string, JournalEvent[]>();
    for (const context of logical.filter((event) => event.type === 'run.unknown.context')) {
      const runId = record(context.payload).runId;
      if (typeof runId !== 'string' || !runId) throw new ControllerError(7, 'BLOCKED', 'Run-unknown context has no valid Run identity');
      const contexts = contextsByRun.get(runId) ?? [];
      contexts.push(context);
      contextsByRun.set(runId, contexts);
    }
    for (const [runId, contexts] of contextsByRun) {
      const results = unknownResults.filter((event) => record(event.payload).runId === runId);
      if (contexts.length !== 1 || results.length !== 1) throw new ControllerError(7, 'BLOCKED', `Run ${runId} has duplicate or orphaned unknown mapping claims`);
    }
  }

  private paths(repositoryRoot: string, changeId: string) {
    const artifacts = join(repositoryRoot, '.leo-dev', 'changes', changeId);
    return { artifacts, manifest: join(artifacts, 'manifest.yaml'), spec: join(artifacts, 'spec.yaml'), tasks: join(artifacts, 'tasks.yaml'), runtime: runtimePaths(repositoryRoot, changeId) };
  }

  private designHistory(events: JournalEvent[]): DesignAdmissionHistory {
    try { return decodeDesignAdmissionHistory(events); }
    catch (error) { this.throwMalformedDesignEvent(error); }
  }

  private designContext(events: JournalEvent[]): DesignReviewContext | undefined {
    try { return latestDesignReviewContext(events); }
    catch (error) { this.throwMalformedDesignEvent(error); }
  }

  private decodedDesignEvent(event: DesignEventInput) {
    try { return decodeDesignReviewEvent(event); }
    catch (error) { this.throwMalformedDesignEvent(error); }
  }

  private throwMalformedDesignEvent(error: unknown): never {
    if (error instanceof DesignEventDecodeError) throw new ControllerError(7, 'BLOCKED', error.message);
    throw error;
  }

  private designAdmission<T>(operation: () => T): T {
    try { return operation(); }
    catch (error) { this.throwDesignAdmissionError(error); }
  }

  private async designAdmissionAsync<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) { this.throwDesignAdmissionError(error); }
  }

  private throwDesignAdmissionError(error: unknown): never {
    if (error instanceof DesignAdmissionError) throw new ControllerError(error.exitCode, error.publicCode, error.message);
    throw error;
  }

  private receiptIdUsed(events: JournalEvent[], receiptId: unknown): boolean {
    if (typeof receiptId !== 'string' || !receiptId) return false;
    return events.some((event) => {
      const payload = record(event.payload); const receipt = record(payload.receipt);
      if (receipt.receiptId === receiptId) return true;
      const assessments = Array.isArray(receipt.assessments) ? receipt.assessments : [];
      return assessments.some((assessment) => record(assessment).receiptId === receiptId);
    });
  }

  private gateApprovalNeedsRecord(events: JournalEvent[], claimed: Claimed, receipt: RecordValue): boolean {
    this.assertRevisionReceiptIdReserved(events, receipt);
    if (!this.receiptIdUsed(events, receipt.receiptId)) return true;
    const previous = events.find((event) => event.type === 'receipt.gate-approval.ingested' && record(record(event.payload).receipt).receiptId === receipt.receiptId);
    if (previous && previous.taskId === claimed.lease.taskId && previous.taskRevision === claimed.lease.taskRevision && previous.leaseGeneration === claimed.lease.generation
      && record(previous.payload).runId === claimed.runId && fingerprint(record(previous.payload).receipt) === fingerprint(receipt)) return false;
    throw new ControllerError(5, 'CONFLICT', 'Gate approval receipt ID has already been consumed for another binding; issuer was not authenticated');
  }

  private async acquireDesignReceipt(repositoryRoot: string, reference: string): Promise<AcquiredDesignReceipt> {
    const absolutePath = resolve(reference);
    const source: { bytes?: Buffer } = {};
    const receipt = await this.readReceipt('design-review', reference, source);
    if (!source.bytes) throw new ControllerError(7, 'BLOCKED', 'Fresh claim design review has no immutable approval context or source bytes');
    return { absolutePath, relativePath: relative(repositoryRoot, absolutePath).split(sep).join('/'), bytes: source.bytes, receipt: receipt as DesignReviewReceipt };
  }

  private async prepareContainedDesignReceipt(repositoryRoot: string, reference: string): Promise<PreparedDesignReceipt> {
    let absolutePath: string;
    try {
      absolutePath = await realpath(resolve(repositoryRoot, reference));
      await assertContained(repositoryRoot, absolutePath);
    } catch {
      throw new ControllerError(2, 'VALIDATION_ERROR', 'Design review receipt must be a readable repository-contained file');
    }
    return { absolutePath, relativePath: relative(repositoryRoot, absolutePath).split(sep).join('/') };
  }

  private async acquirePreparedDesignReceipt(prepared: PreparedDesignReceipt): Promise<AcquiredDesignReceipt> {
    const source: { bytes?: Buffer } = {};
    const receipt = await this.readReceipt('design-review', prepared.absolutePath, source);
    if (!source.bytes) throw new ControllerError(7, 'BLOCKED', 'Fresh claim design review has no immutable approval context or source bytes');
    return { ...prepared, bytes: source.bytes, receipt: receipt as DesignReviewReceipt };
  }

  private async planDesignTransition(repositoryRoot: string, changeId: string, to: string, events: JournalEvent[], options: CommandOptions): Promise<{ context?: DesignReviewContext; receipt?: RecordValue }> {
    const routes = routedTasks(events); const authority = currentAuthority(events);
    if (to === 'design-review') {
      const context = await this.designAdmissionAsync(() => requestDesignReview({ repositoryRoot, changeId, routes, authority, acquireRequest: () => ({ design: stringOption(options, 'design')!, producerSession: stringOption(options, 'session')! }) }));
      return { context };
    }
    if (to === 'spec-approved') {
      const planned = await this.designAdmissionAsync(() => rejectDesignReview({ repositoryRoot, changeId, routes, authority, context: () => this.designContext(events), acquireReceipt: () => this.acquireDesignReceipt(repositoryRoot, stringOption(options, 'receipt')!), receiptIdUsed: (receiptId) => this.receiptIdUsed(events, receiptId) }));
      return { context: planned.context, receipt: planned.acquired.receipt };
    }
    const planned = await this.designAdmissionAsync(() => approveDesignReview({ repositoryRoot, changeId, routes, authority, context: () => this.designContext(events), acquireReceipt: () => this.acquireDesignReceipt(repositoryRoot, stringOption(options, 'receipt')!), receiptIdUsed: (receiptId) => this.receiptIdUsed(events, receiptId) }));
    return { context: planned.context, receipt: planned.acquired.receipt };
  }

  private async planFreshClaimDesignReceipt(repositoryRoot: string, changeId: string, events: JournalEvent[], reference: string): Promise<ClaimDesignReceipt> {
    const receipt = await this.designAdmissionAsync(() => claimDesignReceiptPlan({ repositoryRoot, changeId, routes: routedTasks(events), authority: currentAuthority(events), hasPriorReceipt: () => events.some((event) => event.type === 'receipt.design-review.ingested'), context: () => this.designContext(events), prepareReceipt: () => this.prepareContainedDesignReceipt(repositoryRoot, reference), acquireReceipt: (prepared) => this.acquirePreparedDesignReceipt(prepared), receiptIdUsed: (receiptId) => this.receiptIdUsed(events, receiptId) }));
    this.assertRevisionReceiptIdReserved(events, receipt.receipt);
    return receipt;
  }

  private async releaseProofPlan(repositoryRoot: string, changeId: string, events: JournalEvent[]): Promise<ReleaseProof> {
    const lifecycle = reduceJournal(events);
    const routes = routedTasks(events); const integrations = routes.filter((route) => route.task.role === 'integration');
    if (lifecycle.changeState !== 'integration-review' || integrations.length !== 1) throw new ControllerError(5, 'CONFLICT', 'Release evidence requires one completed final integration task', lifecycle);
    const routed = integrations[0]!; const taskId = routed.task.id;
    if (lifecycle.tasks[taskId]?.state !== 'done' || routes.some((route) => lifecycle.tasks[route.task.id]?.state !== 'done')) throw new ControllerError(5, 'CONFLICT', 'Release evidence requires all routed tasks to be done', lifecycle);
    const submittedEvent = events.filter((event) => event.type === 'controller.submit.accepted' && event.taskId === taskId).at(-1);
    const submitted = submittedEvent ? record(submittedEvent.payload) as SubmittedCandidate : undefined;
    const candidate = submitted ? candidateForRun(events, taskId, submitted.runId) : undefined;
    const claimEvents = submitted ? events.filter((event) => event.type === 'run.claimed' && event.taskId === taskId && record(event.payload).runId === submitted.runId) : [];
    const claimed = claimEvents.length === 1 ? record(claimEvents[0]!.payload) as Claimed : undefined;
    if (!submitted || !candidate || !claimed || candidate.treeHash !== claimed.lease.inputTreeHash || candidate.claimInputTreeHash !== claimed.lease.inputTreeHash
      || candidate.taskRevision !== routed.task.revision || candidate.leaseGeneration !== claimed.lease.generation || submitted.treeHash !== candidate.treeHash) {
      throw new ControllerError(5, 'CONFLICT', 'Integration task has no verification-only candidate bound to its current claim', lifecycle);
    }
    await this.assertReleaseSubjectCurrent(repositoryRoot, changeId, claimed, lifecycle);
    const registry = await GateRegistry.fromYaml(resolve(repositoryRoot, routed.registryPath));
    const settlement = await new GateRunner().inspectSettlement(this.gateSettlementRequest(repositoryRoot, changeId, taskId, routed, claimed, registry, candidate));
    if (settlement.status !== 'succeeded' || !settlement.evidenceRef || !settlement.evidence || settlement.inputTreeHash !== candidate.treeHash) throw new ControllerError(5, 'CONFLICT', 'Integration Gate settlement is not a current successful candidate-bound result', lifecycle);
    const evidence = await loadGateEvidence(repositoryRoot, changeId, claimed.runId, routed.task.gateIds[0]!);
    if (evidence.contentHash !== settlement.evidence.contentHash || evidence.evidence.treeHash !== candidate.treeHash || evidence.evidence.gateDefinitionHash !== routed.gateDefinitionHash) throw new ControllerError(5, 'CONFLICT', 'Integration Gate evidence has drifted or does not bind the aggregate candidate', lifecycle);
    const reviewEvents = events.filter((event) => event.type === 'receipt.review.ingested' && event.taskId === taskId && record(record(event.payload).receipt).runId === claimed.runId);
    const review = reviewEvents.length === 1 ? record(record(reviewEvents[0]!.payload).receipt) : undefined;
    const independent = review?.provenance === 'human-confirmed' || (review?.provenance === 'platform-attested' && typeof review.sessionId === 'string' && review.sessionId !== claimed.sessionId);
    if (!review || review.verdict !== 'pass' || !independent || !validateReceipt('review', review).ok) throw new ControllerError(5, 'CONFLICT', 'Integration task lacks an accepted independent Standard review', lifecycle);
    const authority = currentAuthority(events);
    if (!authority || submitted.specHash !== authority.specHash || candidate.specHash !== authority.specHash) throw new ControllerError(5, 'CONFLICT', 'Integration evidence does not bind the current source authority', lifecycle);
    return { schemaVersion: 1, proofId: randomUUID(), changeId, integrationTaskId: taskId, runId: claimed.runId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation,
      claimInputTreeHash: claimed.lease.inputTreeHash, candidateTreeHash: candidate.treeHash, sourceHash: authority.sourceHash, specHash: authority.specHash, planHash: normalizedPlanHash(routes),
      gateId: routed.task.gateIds[0]!, gateDefinitionHash: routed.gateDefinitionHash, gateEvidenceRef: settlement.evidenceRef, gateEvidenceHash: evidence.contentHash,
      reviewReceiptId: String(review.receiptId), reviewReceiptHash: fingerprint(review), reviewProvenance: String(review.provenance), reviewSessionId: typeof review.sessionId === 'string' ? review.sessionId : null, createdAt: new Date().toISOString() };
  }

  private async assertReleaseSubjectCurrent(repositoryRoot: string, changeId: string, claimed: Claimed, lifecycle: LifecycleSnapshotState): Promise<void> {
    const raw = (await new Journal(runtimePaths(repositoryRoot, changeId).journal).replayStrict()).events;
    const projections = projectJournalEvents(raw).committedProjections.map((projection) => projection.relativePath);
    if (!await frozenSubjectCurrent(repositoryRoot, claimed.inputEntries, projections)) throw new ControllerError(5, 'CONFLICT', 'Current source does not match the frozen integration claim subject', lifecycle);
  }

  private async recordReleaseEvidence(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options)); const changeId = this.changeId(options); const events = await this.readEvents(repositoryRoot, changeId);
    const admissionTreeHash = (await canonicalTreeHash(repositoryRoot)).hash;
    const proof = await this.releaseProofPlan(repositoryRoot, changeId, events); const transition = transitionChange('integration-review', 'release-evidence', { integrationEvidenceCurrent: true });
    if (!transition.ok) throw new ControllerError(3, transition.code, transition.detail);
    if (options.dryRun === true) return result('DRY_RUN', { ...(await this.state(repositoryRoot, changeId, events)), command: 'transition', changeId, planned: true, writes: [] });
    const paths = this.paths(repositoryRoot, changeId); const manifest = record(await loadYaml(paths.manifest)); const proofHash = releaseProofHash(proof);
    const journal = new Journal(paths.runtime.journal); const releasePath = join(paths.artifacts, 'release.yaml');
    const projections = [await buildProjection(repositoryRoot, changeId, releasePath, proof), await buildProjection(repositoryRoot, changeId, paths.manifest, { ...manifest, state: 'release-evidence' })];
    const recovery = await captureSpecRevisionRecovery(repositoryRoot, changeId, projections, admissionTreeHash, [{ relativePath: proof.gateEvidenceRef, sha256: proof.gateEvidenceHash }], 'release-evidence');
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'release-evidence', faultAt: options.faultAt,
      projections, recovery,
      operations: [{ type: 'controller.release.evidence.recorded', payload: { proof, proofHash } }, { type: 'change.transition', payload: { from: 'integration-review', to: 'release-evidence' } }] });
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    return result('RELEASE_EVIDENCE_RECORDED', await this.state(repositoryRoot, changeId));
  }

  private async archiveRelease(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options)); const changeId = this.changeId(options); const events = await this.readEvents(repositoryRoot, changeId);
    const admissionTreeHash = (await canonicalTreeHash(repositoryRoot)).hash;
    const lifecycle = reduceJournal(events); const recordEvent = events.filter((event) => event.type === 'controller.release.evidence.recorded').at(-1); const stored = recordEvent ? record(recordEvent.payload).proof as ReleaseProof : undefined;
    if (lifecycle.changeState !== 'release-evidence') throw new ControllerError(3, 'TRANSITION_FORBIDDEN', `${lifecycle.changeState} -> archived requires release-evidence first`, lifecycle);
    if (!stored || stored.changeId !== changeId) throw new ControllerError(5, 'CONFLICT', 'Archive requires current release evidence', lifecycle);
    const paths = this.paths(repositoryRoot, changeId); const releaseFile = record(await loadYaml(join(paths.artifacts, 'release.yaml')));
    if (releaseProofHash(releaseFile as ReleaseProof) !== releaseProofHash(stored)) throw new ControllerError(5, 'CONFLICT', 'Release proof projection has drifted', lifecycle);
    const expected = archiveContext(stored); const ciFile = await readRepositoryJson(repositoryRoot, stringOption(options, 'receipt')!);
    const ci = validateReceipt('release-ci', ciFile.value); if (!ci.ok) throw new ControllerError(2, 'SCHEMA_INVALID', ci.details.join('; '));
    this.assertRevisionReceiptIdReserved(events, ci.value);
    const integrationClaim = events.find((event) => event.type === 'run.claimed' && record(event.payload).runId === stored.runId);
    const producerSession = integrationClaim ? record(integrationClaim.payload).sessionId : undefined;
    if (!integrationClaim || currentAuthority(events)?.specHash !== stored.specHash) throw new ControllerError(5, 'CONFLICT', 'Release proof does not bind the current integration authority', lifecycle);
    await this.assertReleaseSubjectCurrent(repositoryRoot, changeId, record(integrationClaim.payload) as Claimed, lifecycle);
    if (ci.value.sessionId === producerSession || ci.value.sessionId === stored.reviewSessionId) throw new ControllerError(5, 'CONFLICT', 'Archive verifier session is not independent from integration production/review', lifecycle);
    const receiptBinding = { changeId: expected.changeId, specHash: expected.specHash, candidateTreeHash: expected.candidateTreeHash, releaseProofHash: expected.releaseProofHash };
    if (this.receiptIdUsed(events, ci.value.receiptId) || Object.entries(receiptBinding).some(([key, value]) => ci.value[key] !== value)) throw new ControllerError(5, 'CONFLICT', 'Archive receipt is stale, replayed, or does not match release proof', lifecycle);
    const verifier = await readRepositoryJson(repositoryRoot, String(ci.value.evidenceRef)); const verifierValidation = validateDocument('release-evidence', verifier.value);
    if (!verifierValidation.ok || contentHash(verifier.bytes) !== ci.value.evidenceHash) throw new ControllerError(5, 'CONFLICT', 'Archive verifier evidence is invalid or has drifted', lifecycle);
    const report = record(verifier.value); const required = ['changeId', 'specHash', 'candidateTreeHash', 'sessionId', 'verifierRunId', 'provider'];
    if (report.status !== 'passed' || required.some((key) => report[key] !== ci.value[key]) || !Array.isArray(report.checks) || !report.checks.some((check) => record(check).gateDefinitionHash === stored.gateDefinitionHash)) throw new ControllerError(5, 'CONFLICT', 'Archive verifier result does not attest the release proof', lifecycle);
    const archive = await readRepositoryJson(repositoryRoot, stringOption(options, 'archive')!); const manifestValidation = validateDocument('archive-manifest', archive.value);
    if (!manifestValidation.ok) throw new ControllerError(2, 'SCHEMA_INVALID', manifestValidation.details.join('; '));
    const manifest = record(archive.value); if (manifest.changeId !== changeId || manifest.releaseProofHash !== expected.releaseProofHash) throw new ControllerError(5, 'CONFLICT', 'Archive manifest does not bind current release proof', lifecycle);
    const artifacts = [...(manifest.artifacts as unknown[]), manifest.retrospective];
    const archiveWrites = new Set([paths.manifest, join(paths.artifacts, 'archive.yaml'), paths.runtime.journal, paths.runtime.snapshot].map((path) => relative(repositoryRoot, path).split(sep).join('/')));
    const boundSources = new Map<string, string>([[ciFile.relativePath, contentHash(ciFile.bytes)], [verifier.relativePath, contentHash(verifier.bytes)], [archive.relativePath, contentHash(archive.bytes)], [stored.gateEvidenceRef, stored.gateEvidenceHash]]);
    for (const reference of boundSources.keys()) if (archiveWrites.has(reference)) throw new ControllerError(5, 'CONFLICT', `Archive input is rewritten by this transition: ${reference}`);
    for (const artifact of artifacts) {
      const item = record(artifact); const file = await readRepositoryFile(repositoryRoot, String(item.path));
      if (archiveWrites.has(file.relativePath)) throw new ControllerError(5, 'CONFLICT', `Archive artifact is rewritten by this transition: ${file.relativePath}`);
      if (contentHash(file.bytes) !== item.sha256) throw new ControllerError(5, 'CONFLICT', `Archive artifact has drifted: ${String(item.path)}`);
      if (boundSources.has(file.relativePath) && boundSources.get(file.relativePath) !== item.sha256) throw new ControllerError(5, 'CONFLICT', `Archive inputs disagree about the same file: ${file.relativePath}`);
      boundSources.set(file.relativePath, String(item.sha256));
    }
    const decision = transitionChange('release-evidence', 'archived', { independentCiMatches: true, archivalManifestMatches: true }); if (!decision.ok) throw new ControllerError(3, decision.code, decision.detail);
    if (options.dryRun === true) return result('DRY_RUN', { ...(await this.state(repositoryRoot, changeId, events)), command: 'transition', changeId, planned: true, writes: [] });
    const journal = new Journal(paths.runtime.journal); const currentManifest = record(await loadYaml(paths.manifest));
    const projections = [await buildProjection(repositoryRoot, changeId, join(paths.artifacts, 'archive.yaml'), { schemaVersion: 1, changeId, releaseProofHash: expected.releaseProofHash, ciReceiptHash: fingerprint(ci.value), ciEvidenceHash: ci.value.evidenceHash, archiveManifestHash: contentHash(archive.bytes) }), await buildProjection(repositoryRoot, changeId, paths.manifest, { ...currentManifest, state: 'archived' })];
    const recovery = await captureSpecRevisionRecovery(repositoryRoot, changeId, projections, admissionTreeHash, [...boundSources].map(([relativePath, sha256]) => ({ relativePath, sha256 })), 'archive');
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'archive', faultAt: options.faultAt,
      projections, recovery,
      operations: [{ type: 'receipt.release-ci.ingested', payload: { receipt: ci.value, issuerAuthenticated: false } }, { type: 'controller.archive.recorded', payload: { releaseProofHash: expected.releaseProofHash, archiveManifestHash: contentHash(archive.bytes) } }, { type: 'change.transition', payload: { from: 'release-evidence', to: 'archived' } }] });
    await writeSnapshotStrict(paths.runtime.snapshot, journal); return result('ARCHIVED', await this.state(repositoryRoot, changeId));
  }

  private async planChangeTransition(repositoryRoot: string, changeId: string, to: string, events: JournalEvent[], options: CommandOptions = {}): Promise<{ lifecycle: LifecycleSnapshotState; from: ChangeState; manifest: RecordValue; spec: RecordValue; approvalMatches: boolean; approval?: RecordValue; approvalHash?: string; designContext?: DesignReviewContext; designReceipt?: RecordValue }> {
    const lifecycle = reduceJournal(events);
    const from = lifecycle.changeState as ChangeState;
    const initialized = latestPayload<Initialized>(events, 'controller.initialized');
    const routes = routedTasks(events);
    const paths = this.paths(repositoryRoot, changeId);
    const manifest = record(await loadYaml(paths.manifest));
    const spec = record(await loadYaml(paths.spec));
    const approval = latestPayload<{ receipt: RecordValue }>(events, 'receipt.approval.ingested')?.receipt;
    const approvalContext = record((await this.state(repositoryRoot, changeId, events)).approvalContext);
    let approvalMatches = !!approval && approval.decision === 'grant' && approval.changeId === changeId && approval.scope === 'change' && approval.operationKind === 'spec-approval' && Object.entries(approvalContext).every(([key, value]) => approval[key] === value);
    if (approvalMatches) {
      const current = validateReceipt('approval', approval);
      if (!current.ok) approvalMatches = false;
    }
    let gateRegistry = false;
    if (routes.length > 0) {
      try {
        gateRegistry = (await Promise.all(routes.map(async (routed) => {
          const registry = await GateRegistry.fromYaml(resolve(repositoryRoot, routed.registryPath));
          return gateDefinitionFingerprint(registry.get(routed.task.gateIds[0]!)) === routed.gateDefinitionHash;
        }))).every(Boolean);
      } catch { gateRegistry = false; }
    }
    const risk = routedRisk(routes);
    const design = (to === 'design-review' || to === 'design-approved' || (from === 'design-review' && to === 'spec-approved')) ? await this.planDesignTransition(repositoryRoot, changeId, to, events, options) : undefined;
    if (to === 'task-ready' && risk !== 'lite') await this.designAdmissionAsync(() => assertFreshApprovedDesign({ repositoryRoot, changeId, routes, authority: currentAuthority(events), history: this.designHistory(events) }));
    const decision = transitionChange(from, to, {
      riskRecorded: routes.length > 0,
      specResolves: !!initialized,
      schemaValid: true,
      unresolvedDecisionsEmpty: Array.isArray(manifest.unresolvedDecisions) && manifest.unresolvedDecisions.length === 0,
      approvalReceiptMatches: approvalMatches || currentStartAuthorization(events) !== undefined,
      validTasks: routes.length > 0,
      gateRegistry,
      runtimeWorkspace: true,
      baseline: !!initialized?.baseline,
      risk,
      designArtifactResolves: to === 'design-review' ? !!design?.context : undefined,
      reviewReceiptMatches: to === 'design-approved' ? !!design?.receipt : undefined,
      rejectReviewReceiptMatches: from === 'design-review' && to === 'spec-approved' ? !!design?.receipt : undefined,
      dependenciesDone: routes.length > 0 && routes.filter((routed) => routed.task.dependsOn.length === 0).every((routed) => lifecycle.tasks[routed.task.id]?.state === 'ready'),
      journalCommitted: events.length > 0,
      allTasksDone: routes.length > 0 && routes.every((routed) => lifecycle.tasks[routed.task.id]?.state === 'done'),
      noActiveOrUnknownRun: Object.values(lifecycle.runs).every((run) => run.state !== 'running' && run.state !== 'unknown') && Object.values(lifecycle.leases).every((lease) => !lease.active),
      integrationGatesDeclared: routes.length > 0,
    });
    if (!decision.ok) {
      const approvalNeeded = from === 'spec-review' && to === 'spec-approved';
      throw new ControllerError(approvalNeeded ? 6 : (to === 'task-ready' && routes.length > 0 && !gateRegistry ? 5 : 3), approvalNeeded ? 'APPROVAL_REQUIRED' : to === 'task-ready' && routes.length > 0 && !gateRegistry ? 'CONFLICT' : decision.code, decision.detail, lifecycle);
    }
    return { lifecycle, from, manifest, spec, approvalMatches, ...(approvalMatches && approval ? { approval, approvalHash: fingerprint(approval) } : {}), ...(design?.context ? { designContext: design.context } : {}), ...(design?.receipt ? { designReceipt: design.receipt } : {}) };
  }

  private reviewRecoveryBinding(changeId: string, taskId: string, events: JournalEvent[], recoveredAt: Date): Omit<ReviewRecoveryPayload, 'schemaVersion' | 'recoveryId'> {
    const lifecycle = reduceJournal(events);
    const laneBarrier = teamMutationBarrierReason(events);
    if (laneBarrier || Object.values(lifecycle.runs).some((run) => run.state === 'running')
      || Object.entries(lifecycle.leases).some(([id, lease]) => id !== taskId && lease.active)) {
      throw new ControllerError(7, 'BLOCKED', 'Review recovery requires a settled, unambiguous execution lane', lifecycle);
    }
    const submittedEvents = events.filter((event) => event.type === 'controller.submit.accepted' && event.taskId === taskId);
    const submittedEvent = submittedEvents.at(-1);
    const submitted = submittedEvent ? record(submittedEvent.payload) as SubmittedCandidate : undefined;
    if (!submittedEvent || !submitted) {
      throw new ControllerError(7, 'BLOCKED', 'Task has no committed submitted candidate to recover', lifecycle);
    }
    if (lifecycle.changeState !== 'executing' || lifecycle.tasks[taskId]?.state !== 'review-required'
      || lifecycle.runs[submitted.runId]?.state !== 'succeeded' || lifecycle.leases[taskId]?.active !== true
      || lifecycle.leases[taskId]?.generation !== submitted.leaseGeneration) {
      throw new ControllerError(7, 'BLOCKED', 'Task is not awaiting an expired successful submitted candidate review', lifecycle);
    }
    const submittedPrefix = events.slice(0, events.indexOf(submittedEvent) + 1);
    const routed = routedTask(submittedPrefix, taskId);
    const authority = currentAuthority(submittedPrefix);
    const claimEvents = events.filter((event) => event.type === 'run.claimed' && record(event.payload).runId === submitted.runId);
    const candidateEvents = events.filter((event) => event.type === 'controller.candidate.registered' && event.taskId === taskId && record(event.payload).runId === submitted.runId);
    const gateResultEvents = events.filter((event) => event.type === 'controller.gate.result' && event.taskId === taskId && record(event.payload).runId === submitted.runId);
    const runSubmitEvents = submittedEvents.filter((event) => record(event.payload).runId === submitted.runId);
    if (!routed || !authority || claimEvents.length !== 1 || candidateEvents.length !== 1 || gateResultEvents.length !== 1 || runSubmitEvents.length !== 1) {
      throw new ControllerError(7, 'BLOCKED', 'Recovery requires unique route, claim, candidate, Gate result and submission history', lifecycle);
    }
    const claimEvent = claimEvents[0]!;
    const claimed = record(claimEvent.payload) as Claimed;
    const candidateEvent = candidateEvents[0]!;
    const candidate = record(candidateEvent.payload) as CandidateBinding;
    const gateResultEvent = gateResultEvents[0]!;
    const gateResult = record(gateResultEvent.payload);
    const gateTerminalEvents = events.filter((event) => event.eventHash === gateResult.terminalEventHash && event.type === 'gate.attempt.settled');
    const terminal = gateTerminalEvents.length === 1 ? record(gateTerminalEvents[0]!.payload) : undefined;
    if (!terminal) throw new ControllerError(7, 'BLOCKED', 'Successful Controller Gate result has no unique settled terminal', lifecycle);
    const matchingLeaseClaims = events.filter((event) => event.type === 'lease.claimed' && event.taskId === taskId
      && event.taskRevision === submitted.taskRevision && event.leaseGeneration === submitted.leaseGeneration);
    const submitTransition = events.filter((event) => event.type === 'task.transition' && event.eventHash === submittedEvent.eventHash
      && event.taskId === taskId && record(event.payload).from === 'verifying' && record(event.payload).to === 'review-required');
    const released = events.some((event) => (event.type === 'lease.released' || event.type === 'lease.abandoned') && event.taskId === taskId
      && event.leaseGeneration === submitted.leaseGeneration && event.sequence >= claimEvent.sequence);
    const expectedSubmitted: SubmittedCandidate = {
      runId: claimed.runId,
      taskId,
      taskRevision: routed.task.revision,
      leaseGeneration: claimed.lease.generation,
      specHash: authority.specHash,
      taskHash: routed.taskHash,
      treeHash: candidate.treeHash,
    };
    const envelopeMatches = [claimEvent, candidateEvent, gateResultEvent, submittedEvent].every((event) => event.changeId === changeId
      && event.taskId === taskId && event.taskRevision === routed.task.revision && event.leaseGeneration === claimed.lease.generation);
    const ordered = claimEvent.sequence < candidateEvent.sequence && candidateEvent.sequence < gateResultEvent.sequence && gateResultEvent.sequence < submittedEvent.sequence;
    const gateMatches = gateResult.status === 'succeeded' && gateResult.runId === claimed.runId && gateResult.changeId === changeId
      && gateResult.taskId === taskId && gateResult.taskRevision === routed.task.revision && gateResult.leaseGeneration === claimed.lease.generation
      && gateResult.gateId === routed.task.gateIds[0] && journalHashPattern.test(String(gateResult.attemptId))
      && journalHashPattern.test(String(gateResult.terminalEventHash)) && typeof gateResult.evidenceRef === 'string' && gateResult.evidenceRef.length > 0
      && terminal.attemptId === gateResult.attemptId && terminal.runId === claimed.runId && terminal.changeId === changeId
      && terminal.taskId === taskId && terminal.taskRevision === routed.task.revision && terminal.leaseGeneration === claimed.lease.generation
      && terminal.gateId === gateResult.gateId && terminal.status === 'succeeded';
    if (!envelopeMatches || !ordered || submitTransition.length !== 1 || matchingLeaseClaims.length !== 1 || released
      || fingerprint(record(matchingLeaseClaims[0]!.payload).lease) !== fingerprint(claimed.lease)
      || claimed.lease.taskId !== taskId || claimed.lease.taskRevision !== routed.task.revision || claimed.lease.generation !== submitted.leaseGeneration
      || candidate.runId !== claimed.runId || candidate.taskId !== taskId || candidate.taskRevision !== routed.task.revision
      || candidate.leaseGeneration !== claimed.lease.generation || candidate.claimInputTreeHash !== claimed.lease.inputTreeHash
      || candidate.specHash !== authority.specHash || candidate.taskHash !== routed.taskHash
      || fingerprint(submitted) !== fingerprint(expectedSubmitted) || !gateMatches) {
      throw new ControllerError(7, 'BLOCKED', 'Submitted review recovery history is malformed, stale or ambiguously bound', lifecycle);
    }
    if (Number.isNaN(recoveredAt.getTime()) || Number.isNaN(Date.parse(claimed.lease.expiresAt)) || Date.parse(claimed.lease.expiresAt) > recoveredAt.getTime()) {
      throw new ControllerError(5, 'CONFLICT', 'Submitted candidate lease has not expired', lifecycle);
    }
    return {
      ...expectedSubmitted,
      claimEventHash: claimEvent.eventHash,
      candidateEventHash: candidateEvent.eventHash,
      gateResultEventHash: gateResultEvent.eventHash,
      submitEventHash: submittedEvent.eventHash,
      gateAttemptId: gateResult.attemptId as string,
      gateTerminalEventHash: gateResult.terminalEventHash as string,
      gateId: gateResult.gateId as string,
      gateStatus: 'succeeded',
      gateEvidenceRef: gateResult.evidenceRef as string,
    };
  }

  private verifyReviewRecoveryHistory(rawEvents: JournalEvent[]): ReviewRecoveryRecord[] {
    const logical = projectJournalEvents(rawEvents).events;
    if (rawEvents.some((event) => event.type === 'controller.review.recovered')) {
      throw new ControllerError(7, 'BLOCKED', 'Review recovery must belong to a committed controller batch');
    }
    const records: ReviewRecoveryRecord[] = [];
    for (let index = 0; index < rawEvents.length; index += 1) {
      const prepared = rawEvents[index]!;
      if (prepared.type !== 'controller.batch.prepared') continue;
      const batch = record(prepared.payload);
      const operations = Array.isArray(batch.operations) ? batch.operations.map(record) : [];
      const recoveryOperations = operations.filter((operation) => operation.type === 'controller.review.recovered');
      if (recoveryOperations.length === 0) continue;
      const committed = rawEvents[index + 1];
      if (batch.kind !== 'expired-review-recovery' || operations.length !== 1 || recoveryOperations.length !== 1
        || !Array.isArray(batch.projections) || batch.projections.length !== 0 || committed?.type !== 'controller.batch.committed') {
        throw new ControllerError(7, 'BLOCKED', 'Review recovery has invalid committed batch provenance');
      }
      const operation = recoveryOperations[0]!;
      const payload = record(operation.payload) as ReviewRecoveryPayload;
      const recoveredAt = new Date(committed.timestamp);
      const priorLogical = projectJournalEvents(rawEvents.slice(0, index)).events;
      const expected = this.reviewRecoveryBinding(prepared.changeId, String(operation.taskId ?? ''), priorLogical, recoveredAt);
      const expectedPayload: ReviewRecoveryPayload = { schemaVersion: 1, recoveryId: payload.recoveryId, ...expected };
      if (prepared.changeId !== committed.changeId || operation.taskId !== expected.taskId || operation.taskRevision !== expected.taskRevision
        || operation.leaseGeneration !== expected.leaseGeneration || typeof payload.recoveryId !== 'string' || payload.recoveryId.length === 0
        || fingerprint(payload) !== fingerprint(expectedPayload)) {
        throw new ControllerError(7, 'BLOCKED', 'Review recovery operation does not exactly bind its submitted candidate history');
      }
      records.push({
        event: { sequence: committed.sequence, previousEventHash: committed.previousEventHash, changeId: committed.changeId,
          taskId: operation.taskId, taskRevision: operation.taskRevision, leaseGeneration: operation.leaseGeneration,
          type: 'controller.review.recovered', timestamp: committed.timestamp, payloadHash: committed.payloadHash,
          payload, eventHash: committed.eventHash },
        payload,
      });
      index += 1;
    }
    const submitHashes = new Set<string>();
    const recoveryIds = new Set<string>();
    for (const recordValue of records) {
      if (submitHashes.has(recordValue.payload.submitEventHash) || recoveryIds.has(recordValue.payload.recoveryId)) {
        throw new ControllerError(7, 'BLOCKED', 'Review recovery history contains duplicate recovery contexts');
      }
      submitHashes.add(recordValue.payload.submitEventHash);
      recoveryIds.add(recordValue.payload.recoveryId);
    }
    const logicalRecoveries = logical.filter((event) => event.type === 'controller.review.recovered');
    if (logicalRecoveries.length !== records.length) throw new ControllerError(7, 'BLOCKED', 'Review recovery history contains an orphaned context');
    return records;
  }

  private currentReviewRecovery(events: JournalEvent[], taskId: string): ReviewRecoveryRecord | undefined {
    const submitted = events.filter((event) => event.type === 'controller.submit.accepted' && event.taskId === taskId).at(-1);
    if (!submitted) return undefined;
    const recovery = events.filter((event) => event.type === 'controller.review.recovered' && event.taskId === taskId
      && record(event.payload).submitEventHash === submitted.eventHash).at(-1);
    return recovery ? { event: recovery, payload: record(recovery.payload) as ReviewRecoveryPayload } : undefined;
  }

  private reviewRecoveryReceiptBinding(events: JournalEvent[], submittedEvent: JournalEvent, receipt: RecordValue, receiptBoundary = events.length): {
    recovery?: ReviewRecoveryRecord;
    problem?: 'unexpected-recovery' | 'recovery-mismatch';
  } {
    const recoveryEvents = events.filter((event) => event.type === 'controller.review.recovered' && event.taskId === submittedEvent.taskId
      && record(event.payload).submitEventHash === submittedEvent.eventHash);
    if (recoveryEvents.length > 1) return { problem: 'recovery-mismatch' };
    const recoveryEvent = recoveryEvents[0];
    if (!recoveryEvent) return receipt.recoveryId === undefined ? {} : { problem: 'unexpected-recovery' };
    const recovery = { event: recoveryEvent, payload: record(recoveryEvent.payload) as ReviewRecoveryPayload };
    const submittedIndex = events.indexOf(submittedEvent);
    const recoveryIndex = events.indexOf(recoveryEvent);
    const receiptTimestamp = Date.parse(String(receipt.timestamp));
    if (submittedIndex < 0 || recoveryIndex <= submittedIndex || recoveryIndex >= receiptBoundary || receipt.recoveryId !== recovery.payload.recoveryId
      || !Number.isFinite(receiptTimestamp) || receiptTimestamp < Date.parse(recoveryEvent.timestamp)) {
      return { problem: 'recovery-mismatch' };
    }
    return { recovery };
  }

  private async reviewRecoveryPlan(repositoryRoot: string, changeId: string, taskId: string, events: JournalEvent[], recoveredAt: Date): Promise<{
    binding: Omit<ReviewRecoveryPayload, 'schemaVersion' | 'recoveryId'>;
    existing?: ReviewRecoveryRecord;
  }> {
    const binding = this.reviewRecoveryBinding(changeId, taskId, events, recoveredAt);
    if ((await canonicalTreeHash(repositoryRoot)).hash !== binding.treeHash) {
      throw new ControllerError(5, 'CONFLICT', 'Controlled tree has drifted from the submitted Gate-bound candidate', reduceJournal(events));
    }
    const existing = this.currentReviewRecovery(events, taskId);
    return { binding, ...(existing ? { existing } : {}) };
  }

  private async validatePendingReviewRecovery(repositoryRoot: string, changeId: string, taskId: string, rawEvents: JournalEvent[]): Promise<ReviewRecoveryPayload> {
    const projected = projectJournalEvents(rawEvents);
    const pending = projected.pending;
    if (!pending || pending.batch.kind !== 'expired-review-recovery' || pending.batch.operations.length !== 1
      || pending.batch.operations[0]?.type !== 'controller.review.recovered' || pending.batch.projections.length !== 0) {
      throw new ControllerError(7, 'BLOCKED', 'Review recovery found an unsupported pending controller batch');
    }
    const operation = pending.batch.operations[0]!;
    const payload = record(operation.payload) as ReviewRecoveryPayload;
    const events = await this.readEvents(repositoryRoot, changeId, true, false, false, true);
    const { binding, existing } = await this.reviewRecoveryPlan(repositoryRoot, changeId, taskId, events, new Date());
    const expected: ReviewRecoveryPayload = { schemaVersion: 1, recoveryId: payload.recoveryId, ...binding };
    if (existing || pending.event.changeId !== changeId || operation.taskId !== taskId || operation.taskRevision !== binding.taskRevision
      || operation.leaseGeneration !== binding.leaseGeneration || typeof payload.recoveryId !== 'string' || payload.recoveryId.length === 0
      || fingerprint(payload) !== fingerprint(expected)) {
      throw new ControllerError(7, 'BLOCKED', 'Pending review recovery does not exactly bind the current submitted candidate');
    }
    return payload;
  }

  private async assertReviewCandidate(repositoryRoot: string, changeId: string, taskId: string, receipt: RecordValue, events: JournalEvent[]): Promise<{ routed: Routed; claimed: Claimed; submitted: SubmittedCandidate; lifecycle: LifecycleSnapshotState }> {
    const lifecycle = reduceJournal(events);
    if (this.receiptIdUsed(events, receipt.receiptId)) {
      throw new ControllerError(5, 'CONFLICT', 'Review receipt ID has already been consumed; issuer was not authenticated', lifecycle);
    }
    const routed = routedTask(events, taskId);
    const claimed = latestTaskPayload<Claimed>(events, 'run.claimed', taskId);
    const submittedEvent = events.filter((event) => event.type === 'controller.submit.accepted' && event.taskId === taskId).at(-1);
    const submitted = submittedEvent ? record(submittedEvent.payload) as SubmittedCandidate : undefined;
    const candidate = claimed ? candidateForRun(events, taskId, claimed.runId) : undefined;
    if (!routed || !claimed || !submitted || lifecycle.tasks[taskId]?.state !== 'review-required') throw new ControllerError(7, 'BLOCKED', 'Task is not awaiting a committed submitted candidate review', lifecycle);
    if (submitted.runId !== claimed.runId || submitted.taskId !== taskId || submitted.taskRevision !== routed.task.revision || submitted.leaseGeneration !== claimed.lease.generation) throw new ControllerError(5, 'CONFLICT', 'Submitted candidate does not match the current Run/task/lease binding', lifecycle);
    if (!candidate || candidate.treeHash !== submitted.treeHash || candidate.taskHash !== submitted.taskHash || candidate.specHash !== submitted.specHash) throw new ControllerError(5, 'CONFLICT', 'Submitted candidate does not match the durable candidate binding', lifecycle);
    const receiptMatches = Object.entries(submitted).every(([key, value]) => receipt[key] === value);
    if (!receiptMatches) throw new ControllerError(5, 'CONFLICT', 'Review receipt is stale or does not match the submitted candidate; issuer was not authenticated', lifecycle);
    const recoveryBinding = this.reviewRecoveryReceiptBinding(events, submittedEvent!, receipt);
    if (recoveryBinding.problem === 'unexpected-recovery') throw new ControllerError(5, 'CONFLICT', 'Review receipt claims a recovery that was never committed; issuer was not authenticated', lifecycle);
    if (recoveryBinding.problem === 'recovery-mismatch') {
      throw new ControllerError(5, 'CONFLICT', 'Review receipt does not match the current recovery epoch; issuer was not authenticated', lifecycle);
    }
    const recovery = recoveryBinding.recovery;
    const projectedLease = lifecycle.leases[taskId];
    if (!projectedLease?.active || projectedLease.generation !== claimed.lease.generation || (!recovery && Date.parse(claimed.lease.expiresAt) <= Date.now())) throw new ControllerError(5, 'CONFLICT', 'Submitted candidate lease is no longer current', lifecycle);
    if ((await canonicalTreeHash(repositoryRoot)).hash !== submitted.treeHash) throw new ControllerError(5, 'CONFLICT', 'Controlled tree has drifted from the submitted Gate-bound candidate', lifecycle);
    const independent = independentReviewSession(receipt, claimed);
    if (!independent) {
      throw new ControllerError(5, 'CONFLICT', 'Platform review cannot prove an independent session from the claimed implementation; issuer was not authenticated', lifecycle);
    }
    if (routed.task.risk === 'full' && !this.fullReviewAssessments(receipt, submitted, claimed, events)) {
      throw new ControllerError(5, 'CONFLICT', 'Full review requires current independently attributable architecture, security, and NFR assessments bound to this candidate; issuer was not authenticated', lifecycle);
    }
    this.reviewPolicy(routed, claimed, receipt, lifecycle);
    return { routed, claimed, submitted, lifecycle };
  }

  private reviewPolicy(routed: Routed, claimed: Claimed, receipt: RecordValue, lifecycle: LifecycleSnapshotState) {
    const provenance = receipt.provenance as 'platform-attested' | 'human-confirmed' | 'agent-asserted';
    const integrationReview = routed.task.role === 'integration';
    const independentSession = provenance === 'human-confirmed' || (typeof claimed.sessionId === 'string' && typeof receipt.sessionId === 'string' && claimed.sessionId !== receipt.sessionId);
    if (integrationReview && (provenance === 'agent-asserted' || !independentSession)) throw new ControllerError(5, 'CONFLICT', 'Integration review requires independent platform-attested or human-confirmed provenance', lifecycle);
    const effectiveRisk = integrationReview ? (routed.task.risk === 'full' ? 'full' : 'standard') : routed.task.risk;
    const reviewing = transitionTask('review-required', 'reviewing', { risk: effectiveRisk, reviewSessionAccepted: true, reviewProvenance: provenance, independentSession });
    if (!reviewing.ok) throw new ControllerError(3, reviewing.code, reviewing.detail, lifecycle);
    return { provenance, effectiveRisk, independentSession, fullAssessments: routed.task.risk === 'full' };
  }

  private fullReviewAssessments(receipt: RecordValue, submitted: SubmittedCandidate, claimed: Claimed, events: JournalEvent[], evaluationTime = new Date()): boolean {
    const assessments: RecordValue[] = Array.isArray(receipt.assessments) ? receipt.assessments.map(record) : [];
    const evaluatedAt = evaluationTime.getTime();
    if (assessments.length !== 3 || new Set(assessments.map((assessment) => assessment.area)).size !== 3
      || !Number.isFinite(evaluatedAt) || !['architecture', 'security', 'nfr'].every((area) => assessments.some((assessment) => assessment.area === area))) return false;
    const ids = new Set<string>([String(receipt.receiptId)]); const sessions = new Set<string>();
    return assessments.every((assessment) => {
      const id = assessment.receiptId; const provenance = assessment.provenance;
      if (typeof id !== 'string' || !id || ids.has(id) || this.receiptIdUsed(events, id)) return false;
      ids.add(id);
      if (!['platform-attested', 'human-confirmed'].includes(String(provenance)) || (assessment.verdict !== 'pass' && !(receipt.verdict === 'reject' && assessment.verdict === 'reject'))
        || typeof assessment.actorLabel !== 'string' || !assessment.actorLabel || typeof assessment.findingsHash !== 'string'
        || !/^[a-f0-9]{64}$/.test(assessment.findingsHash) || !Number.isFinite(Date.parse(String(assessment.timestamp)))
        || !Number.isFinite(Date.parse(String(assessment.expiresAt))) || Date.parse(String(assessment.expiresAt)) <= evaluatedAt
        || Date.parse(String(assessment.timestamp)) > evaluatedAt
        || Date.parse(String(assessment.timestamp)) >= Date.parse(String(assessment.expiresAt))) return false;
      if (Object.entries(submitted).some(([key, value]) => assessment[key] !== value)) return false;
      if (provenance === 'platform-attested') {
        if (!claimed.sessionId || typeof assessment.sessionId !== 'string' || assessment.sessionId === claimed.sessionId || assessment.sessionId === receipt.sessionId || sessions.has(assessment.sessionId)) return false;
        sessions.add(assessment.sessionId);
      }
      return true;
    });
  }

  private async legacyReconciledCandidate(repositoryRoot: string, taskId: string, routed: Routed, claimed: Claimed, context: UnknownContext, events: JournalEvent[]): Promise<CandidateBinding> {
    const initialized = latestPayload<Initialized>(events, 'controller.initialized');
    if (claimed.inputEntries !== undefined || !initialized
      || context.runId !== claimed.runId || context.taskId !== taskId || context.taskRevision !== routed.task.revision
      || context.leaseGeneration !== claimed.lease.generation || context.inputTreeHash !== claimed.lease.inputTreeHash) {
      throw new ControllerError(7, 'BLOCKED', 'Historical reconciliation cannot synthesize a candidate without an exact immutable lease/context binding', reduceJournal(events));
    }
    const current = await canonicalTreeHash(repositoryRoot);
    if (current.hash !== context.inputTreeHash) throw new ControllerError(5, 'CONFLICT', 'Historical reconciliation tree drifted from its immutable lease/context binding', reduceJournal(events));
    return {
      runId: claimed.runId,
      taskId,
      taskRevision: routed.task.revision,
      leaseGeneration: claimed.lease.generation,
      claimInputTreeHash: claimed.lease.inputTreeHash,
      treeHash: context.inputTreeHash,
      specHash: initialized.specHash,
      taskHash: routed.taskHash,
    };
  }

  private async assertSubmitCandidate(repositoryRoot: string, taskId: string, events: JournalEvent[]): Promise<{ lifecycle: LifecycleSnapshotState; routed: Routed; claimed: Claimed; gate?: { runId: string; status: string; evidenceRef?: string }; reconciliation?: RecordValue; reconciledSuccess: boolean; candidateTreeHash: string }> {
    const lifecycle = reduceJournal(events);
    const routed = routedTask(events, taskId);
    const claimed = latestTaskPayload<Claimed>(events, 'run.claimed', taskId);
    const candidate = claimed ? candidateForRun(events, taskId, claimed.runId) : undefined;
    const gate = latestTaskPayload<{ runId: string; status: string; evidenceRef?: string }>(events, 'controller.gate.result', taskId);
    const unknownContext = latestTaskPayload<UnknownContext>(events, 'run.unknown.context', taskId);
    const reconciliation = latestTaskPayload<{ receipt: RecordValue }>(events, 'receipt.reconciliation.ingested', taskId)?.receipt;
    const reconciledSuccess = !!unknownContext && reconciliation?.resolvedRunState === 'succeeded'
      && reconciliation.runId === claimed?.runId
      && reconciliation.taskRevision === unknownContext.taskRevision
      && reconciliation.leaseGeneration === unknownContext.leaseGeneration
      && reconciliation.operationFingerprint === unknownContext.operationFingerprint
      && reconciliation.inputTreeHash === unknownContext.inputTreeHash
      && JSON.stringify(reconciliation.evidenceHashes) === JSON.stringify(unknownContext.evidenceHashes)
      && lifecycle.runs[claimed?.runId ?? '']?.state === 'succeeded';
    const gateSucceeded = gate?.status === 'succeeded' && gate.runId === claimed?.runId;
    if (!routed || !claimed || lifecycle.tasks[taskId]?.state !== 'verifying' || (!gateSucceeded && !reconciledSuccess)) throw new ControllerError(7, 'BLOCKED', 'Current successful Gate or matching successful reconciliation evidence is required before submit', lifecycle, gate?.evidenceRef ? [gate.evidenceRef] : []);
    const legacyCandidate = !candidate && reconciledSuccess && unknownContext
      ? await this.legacyReconciledCandidate(repositoryRoot, taskId, routed, claimed, unknownContext, events)
      : undefined;
    const candidateTreeHash = candidate?.treeHash ?? legacyCandidate?.treeHash;
    const projectedLease = lifecycle.leases[taskId];
    if (!projectedLease?.active || projectedLease.generation !== claimed.lease.generation || Date.parse(claimed.lease.expiresAt) <= Date.now()) throw new ControllerError(5, 'CONFLICT', 'Current active lease is required before submit', lifecycle);
    if (!candidateTreeHash || (await canonicalTreeHash(repositoryRoot)).hash !== candidateTreeHash) throw new ControllerError(5, 'CONFLICT', 'Submitted candidate tree no longer matches the Gate/reconciliation binding', lifecycle);
    return { lifecycle, routed, claimed, gate, reconciliation, reconciledSuccess, candidateTreeHash };
  }

  private reconciliationPlan(events: JournalEvent[], receipt: RecordValue): { lifecycle: LifecycleSnapshotState; runId: string; taskId: string; claimed: Claimed; context: UnknownContext; outcome: Extract<ReturnType<typeof reconcileUnknown>, { ok: true }>; safeToRetry: boolean; resolvedRunState: 'succeeded' | 'failed' | 'abandoned' } {
    const lifecycle = reduceJournal(events);
    const runId = String(receipt.runId);
    const taskId = String(receipt.taskId);
    const claimed = latestTaskPayload<Claimed>(events, 'run.claimed', taskId);
    const context = latestTaskPayload<UnknownContext>(events, 'run.unknown.context', taskId);
    if (!claimed || !context || context.runId !== runId || lifecycle.runs[runId]?.state !== 'unknown' || lifecycle.tasks[taskId]?.state !== 'blocked' || lifecycle.changeState !== 'approval-required') throw new ControllerError(7, 'BLOCKED', 'Receipt does not address the unique current unknown Run; issuer was not authenticated', lifecycle);
    const matches = receipt.taskRevision === context.taskRevision
      && receipt.leaseGeneration === context.leaseGeneration
      && receipt.inputTreeHash === context.inputTreeHash
      && receipt.operationFingerprint === context.operationFingerprint
      && JSON.stringify(receipt.evidenceHashes) === JSON.stringify(context.evidenceHashes);
    if (!matches) throw new ControllerError(5, 'CONFLICT', 'Reconciliation receipt does not match Run revision/generation/operation/tree; issuer was not authenticated', lifecycle);
    const resolvedRunState = receipt.resolvedRunState as 'succeeded' | 'failed' | 'abandoned';
    const safeToRetry = receipt.safeToRetry === true;
    if (resolvedRunState === 'abandoned' && safeToRetry) {
      const released = events.some((event) => event.type === 'gate.attempt.released'
        && event.taskId === taskId
        && record(event.payload).runId === runId
        && context.evidenceHashes.includes(event.eventHash));
      if (receipt.sideEffectDisposition !== 'not-started' || released) {
        throw new ControllerError(7, 'BLOCKED', 'Safe abandoned reconciliation requires not-started effects and a bound Gate history with no argv release; issuer was not authenticated', lifecycle);
      }
    }
    // The unknown context deliberately records that a retry was initially possible;
    // reconciliation must recalculate progress from the previous failure evidence.
    const retryRemaining = resolvedRunState === 'failed'
      ? decideFailedAttempt({
        priorFailures: failedAttemptCount(events, taskId),
        previousFindingsHash: previousFindingsHash(events, taskId),
        currentFindingsHash: typeof receipt.findingsHash === 'string' ? receipt.findingsHash : undefined,
      }).target === 'remediation'
      : context.retryRemaining;
    const outcome = reconcileUnknown({ reconciliationMatched: true, resolvedRunState, priorChangeState: context.priorChangeState, resumeTaskStateOnSuccess: context.resumeTaskStateOnSuccess, retryRemaining, safeToRetry, newLeaseGeneration: resolvedRunState === 'abandoned' && safeToRetry });
    if (!outcome.ok) throw new ControllerError(3, outcome.code, `${outcome.detail}; issuer was not authenticated`, lifecycle);
    return { lifecycle, runId, taskId, claimed, context, outcome, safeToRetry, resolvedRunState };
  }

  private async state(repositoryRoot: string, changeId: string, events?: JournalEvent[]): Promise<LifecycleSnapshotState & RecordValue> {
    const replay = events ?? await this.readEvents(repositoryRoot, changeId);
    const lifecycle = reduceJournal(replay);
    const initialized = currentAuthority(replay);
    const routes = routedTasks(replay);
    const routed = routes.at(-1);
    const epoch = replay.reduce((latest, event, index) => event.type === 'controller.spec.revised' ? index : latest, -1);
    const currentEvents = epoch < 0 ? replay : replay.slice(epoch);
    const historicalEvents = epoch < 0 ? [] : replay.slice(0, epoch);
    const claimedEvent = currentEvents.filter((event) => event.type === 'run.claimed').at(-1);
    const claimed = claimedEvent ? record(claimedEvent.payload) as Claimed : undefined;
    const submittedEvent = currentEvents.filter((event) => event.type === 'controller.submit.accepted').at(-1);
    const submitted = submittedEvent ? record(submittedEvent.payload) as SubmittedCandidate : undefined;
    const reconciliationContext = claimed ? latestTaskPayload<UnknownContext>(currentEvents, 'run.unknown.context', claimed.lease.taskId) : undefined;
    const evidence = (source: JournalEvent[]) => source.filter((event) => event.type === 'controller.gate.result').flatMap((event) => {
      const value = record(event.payload).evidenceRef;
      return typeof value === 'string' ? [value] : [];
    });
    const evidenceRefs = evidence(currentEvents);
    const approvalContext = initialized ? {
      decisionFingerprint: fingerprint({ operationKind: 'spec-approval', changeId, sourceHash: initialized.specHash }),
      gateDefinitionFingerprint: fingerprint({ operationKind: 'spec-approval', gate: null }),
      argvFingerprint: fingerprint([]),
      cwdFingerprint: fingerprint(repositoryRoot),
      environmentFingerprint: fingerprint([]),
      inputFingerprint: initialized.specHash,
    } : null;
    let gateApprovalContext: RecordValue | null = null;
    if (claimed && routes.length > 0 && lifecycle.tasks[claimed.lease.taskId]?.state === 'implementing') {
      const route = routes.find((candidate) => candidate.task.id === claimed.lease.taskId);
      if (route) try {
        const registry = await GateRegistry.fromYaml(resolve(repositoryRoot, route.registryPath)); const gate = registry.get(route.task.gateIds[0]!);
        if (gate.network !== 'deny' || gate.effectClass !== 'local-verification') {
          const candidate = candidateForRun(replay, route.task.id, claimed.runId);
          const request = { repositoryRoot, registry, gateId: gate.id, expectedInputTreeHash: candidate?.treeHash ?? (await canonicalTreeHash(repositoryRoot)).hash, expectedGateDefinitionHash: route.gateDefinitionHash, runId: claimed.runId, changeId, taskId: route.task.id, taskRevision: route.task.revision, leaseGeneration: claimed.lease.generation, maxOutputBytes: maxGateOutputBytes };
          gateApprovalContext = { changeId, taskId: route.task.id, runId: claimed.runId, taskRevision: route.task.revision, leaseGeneration: claimed.lease.generation, gateId: gate.id, ...approvalFingerprintFields(request, gate, await realpath(resolve(repositoryRoot, gate.cwd))) };
        }
      } catch { gateApprovalContext = null; }
    }
    const recovery = submitted ? this.currentReviewRecovery(currentEvents, submitted.taskId) : undefined;
    const reviewContext = submitted ? { ...submitted, ...(recovery ? { recoveryId: recovery.payload.recoveryId } : {}) } : null;
    // Status is a durable-history consumer too: validate both decoded event types,
    // while intentionally exposing only the request context in public JSON.
    const designHistory = this.designHistory(replay);
    const designReviewContext = designHistory.context ?? null;
    const release = latestPayload<ReleaseRecord>(replay, 'controller.release.evidence.recorded');
    const reviewRecovery = recovery ? {
      recoveryId: recovery.payload.recoveryId,
      recoveredAt: recovery.event.timestamp,
      eventHash: recovery.event.eventHash,
      evidence: {
        claimEventHash: recovery.payload.claimEventHash,
        candidateEventHash: recovery.payload.candidateEventHash,
        gateResultEventHash: recovery.payload.gateResultEventHash,
        submitEventHash: recovery.payload.submitEventHash,
        gateAttemptId: recovery.payload.gateAttemptId,
        gateTerminalEventHash: recovery.payload.gateTerminalEventHash,
        gateId: recovery.payload.gateId,
        gateStatus: recovery.payload.gateStatus,
        gateEvidenceRef: recovery.payload.gateEvidenceRef,
      },
    } : null;
    const attempts = Object.fromEntries(routes.map((route) => {
      const consumed = failedAttemptCount(replay, route.task.id);
      const nextKind = lifecycle.tasks[route.task.id]?.state === 'blocked' ? 'blocked' : consumed === 0 ? 'initial' : 'remediation';
      return [route.task.id, { consumed, maximum: null, nextKind }];
    }));
    const historicClaimEvent = historicalEvents.filter((event) => event.type === 'run.claimed').at(-1);
    const historicClaim = historicClaimEvent ? record(historicClaimEvent.payload) as Claimed : undefined;
    const historicSubmitEvent = historicalEvents.filter((event) => event.type === 'controller.submit.accepted').at(-1);
    const historicSubmit = historicSubmitEvent ? record(historicSubmitEvent.payload) as SubmittedCandidate : undefined;
    const historicalEvidence = epoch < 0 ? null : {
      run: historicClaim ?? null,
      reviewContext: historicSubmit ?? null,
      reviewRecovery: historicSubmit ? this.currentReviewRecovery(historicalEvents, historicSubmit.taskId) ?? null : null,
      reconciliationContext: historicClaim ? latestTaskPayload<UnknownContext>(historicalEvents, 'run.unknown.context', historicClaim.lease.taskId) ?? null : null,
      evidenceRefs: evidence(historicalEvents),
    };
    const publicAuthority = initialized ? (({ sourceBase64: _archivedSourceBytes, ...summary }) => summary)(initialized) : null;
    return { ...lifecycle, authority: publicAuthority, risk: routes.length > 0 ? routedRisk(routes) : null, route: routed ?? null, routes: routes.length > 1 ? routes : undefined, run: claimed ?? null, attempts, approvalContext, gateApprovalContext, designReviewContext, archiveContext: release?.proof ? archiveContext(release.proof) : null, reviewContext, reviewRecovery, reconciliationContext: reconciliationContext ?? null, historicalEvidence, assessmentContext: await this.governanceState(repositoryRoot, changeId, replay), evidenceRefs };
  }

  async init(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const plan = await this.planInitialization(repositoryRoot, changeId, options);
    const paths = this.paths(repositoryRoot, changeId);
    const faultAt = ['after-runtime-created', 'after-artifact-published', 'after-workspace-published', 'after-artifact-published-error'].includes(String(options.faultAt)) ? options.faultAt as 'after-runtime-created' | 'after-artifact-published' | 'after-workspace-published' | 'after-artifact-published-error' : undefined;
    const workspace = await initializeChangeWorkspace(repositoryRoot, changeId, { controllerAuthority: plan.authority, ...(faultAt ? { faultAt } : {}) });
    const journal = new Journal(paths.runtime.journal);
    const projections = await Promise.all([
      buildProjection(repositoryRoot, changeId, paths.manifest, plan.authority.manifest),
      buildProjection(repositoryRoot, changeId, paths.spec, plan.authority.spec),
      buildProjection(repositoryRoot, changeId, paths.tasks, plan.authority.tasks),
    ]);
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: [], kind: 'initialize', projections, faultAt: options.faultAt, operations: [{ type: 'controller.initialized', payload: plan.authority.initialized }] });
    await completeControllerInitialization(repositoryRoot, changeId);
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    return result('INITIALIZED', { changeId, changeState: 'triage', artifacts: relative(repositoryRoot, workspace.artifacts), runtime: relative(repositoryRoot, workspace.runtime), baseline: plan.baseline });
  }

  async inspect(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const paths = this.paths(repositoryRoot, changeId);
    const manifest = await loadYaml(paths.manifest);
    const spec = await loadYaml(paths.spec);
    const tasks = await loadYaml(paths.tasks);
    for (const [kind, value] of [['change-manifest', manifest], ['spec-ref', spec], ['task-plan', tasks]] as const) {
      const validation = validateDocument(kind, value);
      if (!validation.ok) validationError(validation.details, kind);
    }
    const events = await this.readEvents(repositoryRoot, changeId);
    return result('INSPECTED', { ...(await this.state(repositoryRoot, changeId, events)), artifacts: { manifest, spec, tasks } });
  }

  async route(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const planReference = stringOption(options, 'plan', false);
    const taskId = stringOption(options, 'task', false);
    const gateId = stringOption(options, 'gate', false);
    if (planReference ? taskId !== undefined || gateId !== undefined : taskId === undefined || gateId === undefined) throw new ControllerError(2, 'VALIDATION_ERROR', 'Route requires either --plan or the legacy --task with --gate');
    const events = await this.readEvents(repositoryRoot, changeId);
    const lifecycle = reduceJournal(events);
    if (lifecycle.changeState !== 'triage') throw new ControllerError(3, 'TRANSITION_FORBIDDEN', 'Routing is only available from triage', lifecycle);
    if (latestPayload<Routed>(events, 'route.selected')) throw new ControllerError(5, 'CONFLICT', 'This change is already routed', lifecycle);
    let tasks: TaskDefinition[] | undefined;
    if (planReference) {
      const planPath = resolve(repositoryRoot, planReference);
      try { await assertContained(repositoryRoot, planPath); } catch { throw new ControllerError(2, 'VALIDATION_ERROR', `Plan path escapes repository: ${planPath}`); }
      tasks = validatePlanTasks(await loadYaml(planPath));
    }
    const registryPath = resolve(repositoryRoot, typeof options.registry === 'string' ? options.registry : 'core/gates/default.yaml');
    await assertContained(repositoryRoot, registryPath);
    const registry = await GateRegistry.fromYaml(registryPath);
    if (tasks) for (const task of tasks) registry.get(task.gateIds[0]!);
    const governance = await this.governanceAdmission(repositoryRoot, changeId, tasks ? planAssessmentTaskId(tasks) : taskId!, options, events);
    if (!governance.recorded && governance.previous) {
      const state = await this.state(repositoryRoot, changeId, events);
      this.governanceRefusal(governance.previous.disposition === 'approval-required' ? 'approval-required' : 'assessment-required', state);
    }
    tasks ??= [{ id: taskId!, revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['.'], acceptance: ['The approved Lite task acceptance is satisfied'], gateIds: [gateId!], risk: 'lite' }];
    const routeds = tasks.map((task) => {
      const validation = validateTaskDefinition(task);
      if (!validation.ok) validationError(validation.details, 'task');
      const gate = registry.get(task.gateIds[0]!);
      return { task, taskHash: taskDefinitionHash(task), registryPath: relative(repositoryRoot, registryPath).split(sep).join('/'), gateDefinitionHash: gateDefinitionFingerprint(gate) } satisfies Routed;
    });
    const paths = this.paths(repositoryRoot, changeId);
    const journal = new Journal(paths.runtime.journal);
    const assessmentProjection = governance.recorded
      ? await buildProjection(repositoryRoot, changeId, resolve(repositoryRoot, governance.recorded.relativePath), governance.recorded.assessment)
      : undefined;
    const assessmentOperation = governance.recorded ? [{ type: 'architecture.assessment.recorded', payload: governance.recorded }] : [];
    const refusal = governance.recorded?.disposition;
    if (refusal && refusal !== 'ready') {
      await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'governance-assessment', projections: assessmentProjection ? [assessmentProjection] : [], faultAt: options.faultAt, operations: assessmentOperation });
      await writeSnapshotStrict(paths.runtime.snapshot, journal);
      this.governanceRefusal(refusal, await this.state(repositoryRoot, changeId));
    }
    const transition = transitionTask('pending', 'ready', { dependenciesDone: true, taskDefinitionValid: true });
    if (!transition.ok) throw new ControllerError(3, transition.code, transition.detail);
    const tasksProjection = await buildProjection(repositoryRoot, changeId, paths.tasks, { schemaVersion: 1, tasks });
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: governance.recorded ? 'governance-route' : 'route', projections: [...(assessmentProjection ? [assessmentProjection] : []), tasksProjection], faultAt: options.faultAt, operations: [
      ...assessmentOperation,
      ...routeds.map((routed) => ({ taskId: routed.task.id, taskRevision: 1, type: 'route.selected', payload: routed })),
      ...routeds.filter((routed) => routed.task.dependsOn.length === 0).map((routed) => ({ taskId: routed.task.id, taskRevision: 1, type: 'task.transition', payload: { from: 'pending', to: 'ready' } })),
    ] });
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    return result(`ROUTED_${routedRisk(routeds).toUpperCase()}`, await this.state(repositoryRoot, changeId));
  }

  async start(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const goal = stringOption(options, 'goal')!;
    const events = await this.readEvents(repositoryRoot, changeId);
    const goalHash = hash(goal);
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'start', faultAt: options.faultAt, operations: [{ type: 'controller.start.authorized', payload: { goal, goalHash } }] });
    await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
    return result('START_AUTHORIZED', { ...(await this.state(repositoryRoot, changeId)), goal, goalHash });
  }

  async commit(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const message = stringOption(options, 'message')!;
    const events = await this.readEvents(repositoryRoot, changeId);
    const baseline = await captureBaseline(repositoryRoot);
    const current = await canonicalTreeHash(repositoryRoot);
    const rawEvents = (await new Journal(runtimePaths(repositoryRoot, changeId).journal).replayStrict()).events;
    if (!baseline.git.available) throw new ControllerError(7, 'BLOCKED', 'not a git repository');
    if (!currentIndependentPass(events, current, rawEvents)) throw new ControllerError(7, 'BLOCKED', 'independent review pass bound to the current tree is required');
    if (baseline.staged.length === 0) throw new ControllerError(7, 'BLOCKED', 'nothing staged');
    if (options.dryRun === true) return result('DRY_RUN', { planned: true, pushed: false });
    const recorded = spawnSync('git', ['commit', '-m', message], { cwd: repositoryRoot, encoding: 'utf8' });
    if (recorded.status !== 0) throw new ControllerError(7, 'BLOCKED', (recorded.stderr || recorded.stdout || 'git commit failed').trim());
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' });
    const commit = head.stdout.trim();
    if (head.status !== 0 || !/^[0-9a-f]{40}$/i.test(commit)) throw new ControllerError(7, 'BLOCKED', 'git commit did not produce a revision');
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'commit', faultAt: options.faultAt, operations: [{ type: 'controller.commit.recorded', payload: { commit, message, pushed: false } }] });
    await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
    return result('COMMITTED', { commit, pushed: false });
  }

  async revise(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    // A same-path revision necessarily changes the currently bound source before
    // admission; the new source is rebound by the immutable revision record.
    const events = await this.readEvents(repositoryRoot, changeId, false, false, true);
    const lifecycle = reduceJournal(events);
    const previous = currentAuthority(events);
    const previousRoutes = routedTasks(events) as RevisionRoute[];
    if (!previous || previousRoutes.length === 0) throw new ControllerError(7, 'BLOCKED', 'Specification revision requires an initialized, routed current Lite authority', lifecycle);
    let revision: SpecRevisionRecord;
    try {
      revision = await prepareSpecRevision({
        repositoryRoot, previousRevision: previous.revision, previousRevisionId: previous.revisionId, previousSpecHash: previous.specHash, previousRoutes,
        previousSpecPath: previous.specPath, previousSourceHash: previous.sourceHash, previousSourceBase64: previous.sourceBase64,
        spec: stringOption(options, 'spec')!, plan: stringOption(options, 'plan')!, constitution: stringOption(options, 'constitution', false),
        previousConstitutionPath: previous.constitutionPath, previousConstitutionHash: previous.constitutionHash, registry: stringOption(options, 'registry', false),
      });
    } catch (error: unknown) {
      if (error instanceof SpecRevisionConflictError) throw new ControllerError(5, 'CONFLICT', error.message, lifecycle);
      if (error instanceof SpecRevisionError) throw new ControllerError(2, 'VALIDATION_ERROR', error.message, lifecycle);
      throw error;
    }
    const authority = revision.authority;
    if (sameRevisionSubstance(authority, previous, previousRoutes)) {
      throw new ControllerError(5, 'CONFLICT', 'Specification revision is a no-op apart from revision bookkeeping', lifecycle);
    }
    const subjectTreeHash = (await canonicalTreeHash(repositoryRoot)).hash;
    const taskId = `plan:${fingerprint(authority.routes.map((route) => route.task))}`;
    const history = this.assessmentHistory(events);
    const assessmentInput = stringOption(options, 'assessment', false);
    const assessment = assessmentInput
      ? assess(await loadAssessmentInput(repositoryRoot, runtimePaths(repositoryRoot, changeId).directory, assessmentInput), { changeId, taskId, specHash: authority.specHash, subjectTreeHash }, history.at(-1))
      : undefined;
    const tail = events.at(-1)?.eventHash ?? '0'.repeat(64);
    const approvalContext = assessment?.disposition === 'ready'
      ? revisionApprovalContext({ changeId, repositoryRoot, authority, previousJournalTailHash: tail, subjectTreeHash, assessmentFingerprint: assessment.fingerprint })
      : undefined;
    const suppliedReceipt = options.receipt === undefined ? undefined : await this.readReceipt('approval', stringOption(options, 'receipt')!);
    const suppliedReceiptMatches = !!approvalContext && !!suppliedReceipt && suppliedReceipt.decision === 'grant'
      && suppliedReceipt.changeId === changeId && suppliedReceipt.taskId === undefined && suppliedReceipt.scope === 'change' && suppliedReceipt.operationKind === 'spec-revision'
      && Object.entries(approvalContext).every(([key, value]) => suppliedReceipt[key] === value);
    const revisionContext = {
      revision: authority.revision, revisionId: authority.revisionId, previousRevisionId: authority.previousRevisionId,
      previousSpecHash: authority.previousSpecHash, spec: { path: authority.specPath, sourceHash: authority.sourceHash },
      constitution: { path: authority.constitutionPath, sourceHash: authority.constitutionHash }, routes: authority.routes,
      authorityHash: authority.specHash, taskId, subjectTreeHash, assessment: assessment ? { fingerprint: assessment.fingerprint, disposition: assessment.disposition, taskId, subjectTreeHash } : null,
      missingPrerequisites: assessment ? (assessment.disposition === 'ready' ? (suppliedReceiptMatches ? [] : ['approval']) : [assessment.disposition]) : ['assessment'],
    };
    const paths = this.paths(repositoryRoot, changeId);
    const revisionPath = resolve(paths.artifacts, 'spec-revisions', `${authority.revisionId}.yaml`);
    const projectionPaths = new Set([paths.manifest, paths.spec, paths.tasks, revisionPath, ...(assessment ? [resolve(repositoryRoot, assessment.relativePath)] : [])].map((path) => resolve(path)));
    const repositoryInputReferences = [authority.specPath, authority.constitutionPath, stringOption(options, 'plan')!, ...authority.routes.map((route) => route.registryPath), assessmentInput].filter((value): value is string => typeof value === 'string');
    const receiptInput = stringOption(options, 'receipt', false);
    const inputPaths = [...repositoryInputReferences.map((reference) => resolve(repositoryRoot, reference)), ...(receiptInput ? [resolve(receiptInput)] : [])];
    if (inputPaths.some((path) => projectionPaths.has(path))) {
      throw new ControllerError(2, 'VALIDATION_ERROR', 'Specification revision input collides with an exact generated projection path', lifecycle);
    }
    const consumed = suppliedReceipt ? events.some((event) => String(record(record(event.payload).receipt).receiptId) === String(suppliedReceipt.receiptId)) : false;
    if (suppliedReceipt && (!suppliedReceiptMatches || consumed)) throw new ControllerError(5, 'CONFLICT', 'Specification revision receipt is stale, rejected, duplicate, or does not match the current approval context; issuer was not authenticated', lifecycle);
    if (specRevisionAdmissionBarrier(events, lifecycle)) {
      throw new ControllerError(7, 'BLOCKED', 'Specification revision requires a quiescent settled current authority', lifecycle);
    }
    const manifest = record(await loadYaml(paths.manifest));
    if (!Array.isArray(manifest.unresolvedDecisions) || manifest.unresolvedDecisions.length !== 0) throw new ControllerError(7, 'BLOCKED', 'Specification revision requires all manifest decisions to be resolved', lifecycle);
    if (options.dryRun === true) return result('DRY_RUN', { ...(await this.state(repositoryRoot, changeId, events)), command: 'revise', changeId, planned: true, writes: [], revisionContext, ...(approvalContext ? { revisionApprovalContext: approvalContext } : {}) });
    const journal = new Journal(paths.runtime.journal);
    const rawPriorEvents = (await journal.replayStrict()).events;
    if (!assessment || assessment.disposition !== 'ready' || !approvalContext) {
      if (assessment) {
        const projection = await buildProjection(repositoryRoot, changeId, resolve(repositoryRoot, assessment.relativePath), assessment.assessment);
        await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'governance-assessment', projections: [projection], faultAt: options.faultAt, operations: [{ type: 'architecture.assessment.recorded', payload: assessment }] });
        await writeSnapshotStrict(paths.runtime.snapshot, journal);
      }
      this.governanceRefusal(assessment?.disposition === 'approval-required' ? 'approval-required' : assessment?.disposition === 'local-remediation-required' ? 'local-remediation-required' : 'assessment-required', await this.state(repositoryRoot, changeId));
    }
    const receipt = suppliedReceipt ?? await this.readReceipt('approval', stringOption(options, 'receipt')!);
    const desiredManifest = { ...record(await loadYaml(paths.manifest)), state: 'spec-approved', specRef: authority.specPath, sourceHash: authority.sourceHash, approvalRef: `receipt:${String(receipt.receiptId)}`, approvalHash: fingerprint(receipt) };
    const desiredSpec = { ...record(await loadYaml(paths.spec)), sourceHash: authority.sourceHash, approvalRef: `receipt:${String(receipt.receiptId)}`, approvalHash: fingerprint(receipt) };
    const projections = await Promise.all([
      buildProjection(repositoryRoot, changeId, paths.manifest, desiredManifest), buildProjection(repositoryRoot, changeId, paths.spec, desiredSpec),
      buildProjection(repositoryRoot, changeId, paths.tasks, { schemaVersion: 1, tasks: authority.routes.map((route) => route.task) }),
      buildProjection(repositoryRoot, changeId, revisionPath, revision), buildProjection(repositoryRoot, changeId, resolve(repositoryRoot, assessment.relativePath), assessment.assessment),
    ]);
    const recovery = await captureSpecRevisionRecovery(repositoryRoot, changeId, projections, subjectTreeHash, [
      { relativePath: authority.specPath, sha256: authority.sourceHash },
      ...(authority.constitutionPath && authority.constitutionHash ? [{ relativePath: authority.constitutionPath, sha256: authority.constitutionHash }] : []),
    ]);
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'spec-revision', projections, recovery, faultAt: options.faultAt,
      validatePrepared: (batch, preparedAt) => {
        if (!validateReceipt('approval', receipt, preparedAt).ok) throw new ControllerError(5, 'CONFLICT', 'Specification revision receipt expired or became invalid before durable preparation', lifecycle);
        this.verifyPreparedSpecRevision(repositoryRoot, changeId, rawPriorEvents, batch, preparedAt.toISOString());
      }, operations: [
      { type: 'architecture.assessment.recorded', payload: assessment }, { type: 'receipt.spec-revision.ingested', payload: { receipt, issuerAuthenticated: false, approvalContext } },
      { type: 'controller.spec.revised', payload: revision }, ...authority.routes.map((route) => ({ taskId: route.task.id, taskRevision: route.task.revision, type: 'route.selected', payload: route })),
      { type: 'change.transition', payload: { from: lifecycle.changeState, to: 'spec-approved', revisionReset: true } },
    ] });
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    return result('SPEC_REVISED_UNAUTHENTICATED', { ...(await this.state(repositoryRoot, changeId)), revisionContext, issuerAuthenticated: false });
  }

  async status(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    return result('STATUS', await this.state(repositoryRoot, changeId));
  }

  private async boardCandidateStatus(repositoryRoot: string, authority: ReturnType<typeof currentAuthority>, route: Routed, claimed: Claimed | undefined, candidate: CandidateBinding | undefined): Promise<'unknown' | 'matches' | 'drifted'> {
    if (!authority || !claimed || !candidate || claimed.lease.taskId !== route.task.id || candidate.runId !== claimed.runId
      || claimed.lease.taskRevision !== route.task.revision || candidate.taskId !== route.task.id || candidate.taskRevision !== route.task.revision || candidate.leaseGeneration !== claimed.lease.generation || candidate.claimInputTreeHash !== claimed.lease.inputTreeHash
      || candidate.taskHash !== route.taskHash || candidate.specHash !== authority.specHash) return 'unknown';
    try { return (await canonicalTreeHash(repositoryRoot)).hash === candidate.treeHash ? 'matches' : 'drifted'; }
    catch { return 'unknown'; }
  }

  private async boardEvidenceCandidateStatus(repositoryRoot: string, authority: ReturnType<typeof currentAuthority>, route: Routed, events: JournalEvent[], event: JournalEvent, payload: RecordValue): Promise<{ runId?: string; candidate?: CandidateBinding; status: 'unknown' | 'matches' | 'drifted' }> {
    const runId = typeof payload.runId === 'string' ? payload.runId : undefined;
    if (!runId || event.taskId !== route.task.id || event.taskRevision !== route.task.revision || !Number.isSafeInteger(event.leaseGeneration)
      || payload.taskId !== route.task.id || payload.taskRevision !== route.task.revision || payload.leaseGeneration !== event.leaseGeneration) throw new ControllerError(7, 'BLOCKED', 'Recorded evidence does not bind its current task/revision/lease envelope');
    const claimEvent = events.filter((candidate) => candidate.type === 'run.claimed' && candidate.taskId === route.task.id && record(candidate.payload).runId === runId).at(-1);
    const claimed = claimEvent ? record(claimEvent.payload) as Claimed : undefined;
    const candidate = candidateForRun(events, route.task.id, runId);
    if (!claimed || !candidate) throw new ControllerError(7, 'BLOCKED', 'Recorded evidence has no durable claimed candidate binding');
    this.assertCandidateBinding(candidate, route.task.id, route, claimed, events);
    return { runId, ...(candidate ? { candidate } : {}), status: await this.boardCandidateStatus(repositoryRoot, authority, route, claimed, candidate) };
  }

  private assertBoardSubmitBinding(route: Routed, events: JournalEvent[], submitted: SubmittedCandidate): { claimed: Claimed; candidate: CandidateBinding } {
    const claimEvent = events.filter((event) => event.type === 'run.claimed' && event.taskId === route.task.id && record(event.payload).runId === submitted.runId).at(-1);
    const claimed = claimEvent ? record(claimEvent.payload) as Claimed : undefined;
    const candidate = candidateForRun(events, route.task.id, submitted.runId);
    if (!claimed || !candidate || submitted.taskId !== route.task.id || submitted.taskRevision !== route.task.revision || submitted.leaseGeneration !== claimed.lease.generation
      || candidate.treeHash !== submitted.treeHash || candidate.taskHash !== submitted.taskHash || candidate.specHash !== submitted.specHash) {
      throw new ControllerError(7, 'BLOCKED', 'Recorded review submission does not bind its claimed candidate');
    }
    this.assertCandidateBinding(candidate, route.task.id, route, claimed, events);
    return { claimed, candidate };
  }

  private validateBoardReviewHistory(routes: Routed[], events: JournalEvent[], currentEvents: JournalEvent[]): Map<JournalEvent, BoardReviewSelection> {
    const routesByTask = new Map(routes.map((route) => [route.task.id, route]));
    const selections = new Map<JournalEvent, BoardReviewSelection>();
    for (const receiptEvent of currentEvents.filter((event) => event.type === 'receipt.review.ingested')) {
      const route = receiptEvent.taskId ? routesByTask.get(receiptEvent.taskId) : undefined;
      if (!route || receiptEvent.taskRevision !== route.task.revision || !Number.isSafeInteger(receiptEvent.leaseGeneration)) {
        throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt has no current task/revision/lease envelope');
      }
      const receipt = record(record(receiptEvent.payload).receipt);
      const receiptValidation = validateReceipt('review', receipt, new Date(receiptEvent.timestamp));
      if (!receiptValidation.ok) throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt is malformed or was not valid when ingested');
      const runId = receipt.runId;
      if (typeof runId !== 'string' || !runId) throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt has no Run binding');
      const submittedEvents = currentEvents.filter((event) => event.type === 'controller.submit.accepted' && record(event.payload).runId === runId);
      if (submittedEvents.length !== 1) throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt does not bind exactly one current-revision submitted candidate');
      const submittedEvent = submittedEvents[0]!;
      const submitted = record(submittedEvent.payload) as SubmittedCandidate;
      const candidateEvents = currentEvents.filter((event) => event.type === 'controller.candidate.registered' && record(event.payload).runId === runId);
      const claimEvents = currentEvents.filter((event) => event.type === 'run.claimed' && record(event.payload).runId === runId);
      if (candidateEvents.length !== 1 || claimEvents.length !== 1) throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt lacks a unique durable claim/candidate sequence');
      const candidateEvent = candidateEvents[0]!;
      const claimedEvent = claimEvents[0]!;
      const candidate = record(candidateEvent.payload) as CandidateBinding;
      const claimed = record(claimedEvent.payload) as Claimed;
      this.assertCandidateBinding(candidate, route.task.id, route, claimed, events);
      const claimedIndex = currentEvents.indexOf(claimedEvent);
      const candidateIndex = currentEvents.indexOf(candidateEvent);
      const submittedIndex = currentEvents.indexOf(submittedEvent);
      const receiptIndex = currentEvents.indexOf(receiptEvent);
      const ordered = claimedIndex < candidateIndex && candidateIndex < submittedIndex && submittedIndex < receiptIndex;
      const exactEnvelopes = [claimedEvent, candidateEvent, submittedEvent, receiptEvent].every((event) => event.taskId === route.task.id
        && event.taskRevision === route.task.revision && event.leaseGeneration === claimed.lease.generation);
      if (!ordered || !exactEnvelopes || claimed.lease.taskId !== route.task.id || claimed.lease.taskRevision !== route.task.revision
        || submitted.runId !== claimed.runId || submitted.taskId !== route.task.id || submitted.taskRevision !== route.task.revision || submitted.leaseGeneration !== claimed.lease.generation
        || candidate.treeHash !== submitted.treeHash || candidate.taskHash !== submitted.taskHash || candidate.specHash !== submitted.specHash
        || receiptEvent.taskRevision !== submittedEvent.taskRevision || receiptEvent.leaseGeneration !== submittedEvent.leaseGeneration
        || Object.entries(submitted).some(([key, value]) => receipt[key] !== value)) {
        throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt does not exactly bind its submitted candidate');
      }
      const strictPrefix = events.slice(0, events.indexOf(receiptEvent));
      if (this.receiptIdUsed(strictPrefix, receipt.receiptId)) throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt ID was already consumed');
      if (this.reviewRecoveryReceiptBinding(events, submittedEvent, receipt, events.indexOf(receiptEvent)).problem) {
        throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt does not match its submitted candidate recovery epoch');
      }
      const provenance = receipt.provenance as 'platform-attested' | 'human-confirmed' | 'agent-asserted';
      const integration = route.task.role === 'integration';
      const independentSession = provenance === 'human-confirmed' || (typeof claimed.sessionId === 'string' && typeof receipt.sessionId === 'string' && claimed.sessionId !== receipt.sessionId);
      if (integration && (provenance === 'agent-asserted' || !independentSession)) throw new ControllerError(7, 'BLOCKED', 'Recorded integration review lacks its required independent provenance');
      const reviewing = transitionTask('review-required', 'reviewing', { risk: integration ? (route.task.risk === 'full' ? 'full' : 'standard') : route.task.risk, reviewSessionAccepted: true, reviewProvenance: provenance, independentSession });
      if (!reviewing.ok || (route.task.risk === 'full' && !this.fullReviewAssessments(receipt, submitted, claimed, strictPrefix, new Date(receiptEvent.timestamp)))) {
        throw new ControllerError(7, 'BLOCKED', 'Recorded review receipt does not satisfy the recorded review policy');
      }
      if (selections.has(submittedEvent)) throw new ControllerError(7, 'BLOCKED', 'Recorded review history has multiple receipts for one submitted candidate');
      selections.set(submittedEvent, { receiptEvent, submittedEvent, submitted, claimed, candidate });
    }
    return selections;
  }

  private async boardObservationState(repositoryRoot: string, changeId: string, events: JournalEvent[]): Promise<Omit<BoardObservation, 'schemaVersion' | 'observedAt' | 'repositoryRoot' | 'changeId' | 'availability' | 'hostLiveStatus'>> {
    if (events.some((event) => event.changeId !== changeId)) throw new ControllerError(7, 'BLOCKED', 'Observed journal contains an event for a different change');
    const lifecycle = reduceJournal(events);
    const authority = currentAuthority(events);
    if (!authority) throw new ControllerError(7, 'BLOCKED', 'Observation requires initialized change authority');
    const epoch = events.reduce((latest, event, index) => event.type === 'controller.spec.revised' ? index + 1 : latest, 0);
    const currentEvents = events.slice(epoch);
    const validatedReviews = this.validateBoardReviewHistory(routedTasks(events), events, currentEvents);
    const tasks: BoardTaskObservation[] = [];
    for (const route of routedTasks(events)) {
      const taskId = route.task.id;
      const task = lifecycle.tasks[taskId];
      const claimedEvent = currentEvents.filter((event) => event.type === 'run.claimed' && event.taskId === taskId).at(-1);
      const claimed = claimedEvent ? record(claimedEvent.payload) as Claimed : undefined;
      const gateEvent = currentEvents.filter((event) => event.type === 'controller.gate.result' && event.taskId === taskId).at(-1);
      const gatePayload = gateEvent ? record(gateEvent.payload) : {};
      const submittedEvent = currentEvents.filter((event) => event.type === 'controller.submit.accepted' && event.taskId === taskId).at(-1);
      const submitted = submittedEvent ? record(submittedEvent.payload) as SubmittedCandidate : undefined;
      const gateBinding = gateEvent ? await this.boardEvidenceCandidateStatus(repositoryRoot, authority, route, events, gateEvent, gatePayload) : undefined;
      const gate: BoardEvidence | null = gateEvent ? {
        kind: 'gate', status: typeof gatePayload.status === 'string' ? gatePayload.status : 'recorded',
        ...(gateBinding?.runId ? { runId: gateBinding.runId } : {}),
        ...(gateBinding?.candidate ? { candidateTreeHash: gateBinding.candidate.treeHash } : {}),
        ...(typeof gatePayload.evidenceRef === 'string' ? { evidenceRef: gatePayload.evidenceRef } : {}),
        recordedAt: gateEvent.timestamp, currentCandidate: gateBinding?.status ?? 'unknown',
      } : null;
      const validatedReview = submittedEvent ? validatedReviews.get(submittedEvent) : undefined;
      const submitBinding = submittedEvent && submitted ? validatedReview ?? this.assertBoardSubmitBinding(route, events, submitted) : undefined;
      const reviewReceipt = validatedReview?.receiptEvent;
      const reviewPayload = reviewReceipt ? record(record(reviewReceipt.payload).receipt) : undefined;
      const reviewBinding = submittedEvent && submitted && submitBinding ? {
        runId: submitted.runId, candidate: submitBinding.candidate,
        status: await this.boardCandidateStatus(repositoryRoot, authority, route, submitBinding.claimed, submitBinding.candidate),
      } : undefined;
      const review: BoardEvidence | null = submittedEvent ? {
        kind: 'review', status: typeof reviewPayload?.verdict === 'string' ? reviewPayload.verdict : 'submitted', runId: reviewBinding?.runId,
        candidateTreeHash: reviewBinding?.candidate?.treeHash, ...(typeof reviewPayload?.receiptId === 'string' ? { evidenceRef: `receipt:${reviewPayload.receiptId}` } : {}),
        recordedAt: reviewReceipt?.timestamp ?? submittedEvent.timestamp, currentCandidate: reviewBinding?.status ?? 'unknown',
      } : null;
      const activity = currentEvents.filter((event) => event.taskId === taskId).at(-1)?.timestamp ?? null;
      const state = task?.state ?? route.task.state;
      const lastReview = currentEvents.filter((event) => event.type === 'receipt.review.ingested' && event.taskId === taskId).at(-1);
      const lastReviewVerdictRaw = lastReview ? record(record(lastReview.payload).receipt).verdict : undefined;
      const lastReviewVerdict = lastReviewVerdictRaw === 'pass' || lastReviewVerdictRaw === 'reject' ? lastReviewVerdictRaw : undefined;
      const taskBlockers = currentEvents.filter((event) => event.type === 'blocker.recorded' && event.taskId === taskId).map((event) => ({ blockerId: typeof record(event.payload).blockerId === 'string' ? record(event.payload).blockerId as string : 'unknown', reason: typeof record(event.payload).reason === 'string' ? record(event.payload).reason as string : null, taskId, recordedAt: event.timestamp }));
      const lease = claimed ? lifecycle.leases[taskId] : undefined;
      tasks.push({ id: taskId, title: taskId, revision: route.task.revision, state, column: boardColumn(state), reviewBadge: reviewBadge(state, lastReviewVerdict), blocked: state === 'blocked', requirements: route.task.acceptance, runId: claimed?.runId ?? null, assignmentSession: claimed?.sessionId ?? null, runState: claimed ? lifecycle.runs[claimed.runId]?.state ?? 'unknown' : null, leaseActive: claimed ? lease?.generation === claimed.lease.generation ? lease.active : false : null, lastActivity: activity, blockers: taskBlockers, gate, review });
    }
    const projectedTeam = projectTeam(currentEvents);
    const memberActivity = new Map<string, string>(); const messageActivity = new Map<string, { recordedAt: string; fromMemberId: string; toMemberId: string }>();
    const touch = (memberId: unknown, timestamp: string) => { if (typeof memberId === 'string' && memberId) memberActivity.set(memberId, timestamp); };
    for (const event of currentEvents.filter((candidate) => candidate.type === 'team.operation.recorded')) {
      const operation = record(record(record(event.payload).record).operation);
      if (operation.type === 'open' && Array.isArray(operation.members)) for (const member of operation.members) touch(record(member).memberId, event.timestamp);
      if (operation.type === 'bind') touch(operation.memberId, event.timestamp);
      if (operation.type === 'message') { touch(operation.fromMemberId, event.timestamp); touch(operation.toMemberId, event.timestamp); if (typeof operation.messageId === 'string') messageActivity.set(operation.messageId, { recordedAt: event.timestamp, fromMemberId: String(operation.fromMemberId), toMemberId: String(operation.toMemberId) }); }
      if (operation.type === 'ack' && typeof operation.messageId === 'string') { const message = messageActivity.get(operation.messageId); if (message) { touch(message.fromMemberId, event.timestamp); touch(message.toMemberId, event.timestamp); } }
    }
    const recordedTeam: RecordedTeamObservation | null = projectedTeam ? {
      teamId: projectedTeam.teamId, revision: projectedTeam.revision,
      members: projectedTeam.members.map((member) => ({ memberId: member.memberId, role: member.role, access: member.access, generation: member.generation, threadId: member.threadId, lastRecordedActivity: memberActivity.get(member.memberId) ?? null })),
      messages: projectedTeam.messages.map((message) => ({ messageId: message.messageId, kind: message.kind, status: message.status, fromMemberId: message.fromMemberId, toMemberId: message.toMemberId, recordedAt: messageActivity.get(message.messageId)?.recordedAt ?? null })),
    } : null;
    const blockers: BoardBlocker[] = currentEvents.filter((event) => event.type === 'blocker.recorded').map((event) => ({ blockerId: typeof record(event.payload).blockerId === 'string' ? record(event.payload).blockerId as string : 'unknown', reason: typeof record(event.payload).reason === 'string' ? record(event.payload).reason as string : null, taskId: event.taskId ?? null, recordedAt: event.timestamp }));
    return { change: { state: lifecycle.changeState, revision: authority.revision, revisionId: authority.revisionId, blockers }, tasks, recordedTeam };
  }

  async observe(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const unavailable = (error: unknown): CommandResult => {
      const mapped = mapKnownError(error);
      const observation: BoardObservation = {
        schemaVersion: 1, observedAt: new Date().toISOString(), repositoryRoot, changeId, availability: 'unavailable', hostLiveStatus: 'unknown',
        blocker: { code: mapped.publicCode, message: mapped.message },
      };
      return result('OBSERVATION_UNAVAILABLE', observation);
    };
    try {
      const journal = new Journal(this.paths(repositoryRoot, changeId).runtime.journal);
      const first = await journal.observe();
      const events = await this.readEvents(repositoryRoot, changeId, false, false, false, false, first);
      const state = await this.boardObservationState(repositoryRoot, changeId, events);
      const last = await journal.observe();
      if (first.identity.device !== last.identity.device || first.identity.inode !== last.identity.inode || first.identity.size !== last.identity.size || first.identity.modifiedMs !== last.identity.modifiedMs || first.identity.digest !== last.identity.digest) {
        return unavailable(new ControllerError(7, 'BLOCKED', 'Journal changed during observation; refresh explicitly to retry'));
      }
      const observation: BoardObservation = { schemaVersion: 1, observedAt: new Date().toISOString(), repositoryRoot, changeId, availability: 'available', hostLiveStatus: 'unknown', ...state };
      return result('OBSERVATION', observation);
    } catch (error: unknown) { return unavailable(error); }
  }

  async team(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const actionName = stringOption(options, 'action')!;
    if (actionName !== 'status' && actionName !== 'record') throw new ControllerError(2, 'VALIDATION_ERROR', '--action must be status or record');
    if (actionName === 'status' && options.input !== undefined) throw new ControllerError(2, 'VALIDATION_ERROR', '--input is only valid for action=record');
    const events = await this.readEvents(repositoryRoot, changeId, false, false, true);
    const initialized = currentAuthority(events);
    if (!initialized) throw new ControllerError(7, 'BLOCKED', 'Team status requires initialized change authority');
    let currentSourceHash: string | null = null;
    let currentConstitutionHash: string | null = initialized.constitutionPath ? null : initialized.constitutionHash;
    try {
      const source = resolve(repositoryRoot, initialized.specPath);
      await assertContained(repositoryRoot, source);
      currentSourceHash = hash(await readFile(source));
      if (initialized.constitutionPath) {
        const constitution = resolve(repositoryRoot, initialized.constitutionPath);
        await assertContained(repositoryRoot, constitution);
        currentConstitutionHash = hash(await readFile(constitution));
      }
    } catch { currentSourceHash = null; currentConstitutionHash = null; }
    const epoch = events.reduce((latest, event, index) => event.type === 'controller.spec.revised' ? index + 1 : latest, 0);
    const previousRevision = epoch > 0 ? events.slice(0, epoch - 1).reduce((latest, event, index) => event.type === 'controller.spec.revised' ? index + 1 : latest, 0) : 0;
    const archivedEvents = epoch > 0 ? events.slice(previousRevision, epoch - 1) : [];
    const epochEvents = events.slice(epoch);
    const team = projectTeam(epochEvents);
    const archivedTeam = archivedEvents.length > 0 ? projectTeam(archivedEvents) : null;
    const sourceStale = currentSourceHash !== initialized.sourceHash || currentConstitutionHash !== initialized.constitutionHash;
    const state = (value: typeof team) => ({ team: value, archivedTeam, currentSpecHash: initialized.specHash, currentSourceHash, stale: sourceStale || (value !== null && value.specHash !== initialized.specHash), provenance: 'host-reported-not-authenticated' as const });
    if (actionName === 'status') return result('TEAM_STATUS', state(team));
    if (options.input === undefined) throw new ControllerError(2, 'VALIDATION_ERROR', '--input is required for action=record');
    const teamRecord = await loadTeamRecord(repositoryRoot, options.input);
    assertTeamMutationBarrier(events);
    if (sourceStale) throw new ControllerError(5, 'CONFLICT', 'Current specification or constitution no longer matches its committed authority');
    const oldRequest = events.slice(0, epoch).some((event) => event.type === 'team.operation.recorded' && record(record(event.payload).record).requestId === teamRecord.requestId);
    if (oldRequest) throw new ControllerError(5, 'CONFLICT', 'requestId belongs to an earlier specification epoch and cannot be replayed');
    const plan = await planTeamRecord(repositoryRoot, epochEvents, initialized.specHash, teamRecord);
    if (options.dryRun === true) return result('DRY_RUN', { ...state(plan.state), command: 'team', changeId, planned: true, writes: [] });
    if (plan.replay) return result('TEAM_REPLAYED', state(plan.state));
    const paths = this.paths(repositoryRoot, changeId);
    const journal = new Journal(paths.runtime.journal);
    try {
      await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'team-operation', faultAt: options.faultAt, operations: [{ type: 'team.operation.recorded', payload: plan.payload }] });
    } catch (error: unknown) {
      if (error instanceof ControllerBatchConflictError) throw new ControllerError(5, 'CONFLICT', 'Team revision changed before the record could be committed');
      throw error;
    }
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    return result('TEAM_RECORDED', state(plan.state));
  }

  async transition(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const scope = stringOption(options, 'scope')!;
    const to = stringOption(options, 'to')!;
    if (scope === 'change' && to === 'release-evidence') return this.recordReleaseEvidence(options);
    if (scope === 'change' && to === 'archived') return this.archiveRelease(options);
    const paths = this.paths(repositoryRoot, changeId);
    const events = await this.readEvents(repositoryRoot, changeId);
    const journal = new Journal(paths.runtime.journal);
    if (scope === 'change') {
      const plan = await this.planChangeTransition(repositoryRoot, changeId, to, events, options);
      const approvalProjection = to === 'spec-approved' && plan.from !== 'design-review' && plan.approvalMatches && plan.approval && plan.approvalHash
        ? { approvalRef: `receipt:${String(plan.approval.receiptId)}`, approvalHash: plan.approvalHash }
        : {};
      const desiredManifest = { ...plan.manifest, state: to, ...approvalProjection };
      const projections = [await buildProjection(repositoryRoot, changeId, paths.manifest, desiredManifest)];
      if (to === 'spec-approved') projections.push(await buildProjection(repositoryRoot, changeId, paths.spec, { ...plan.spec, ...approvalProjection }));
      await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'transition', projections, faultAt: options.faultAt, operations: [
        ...(plan.designContext && to === 'design-review' ? [{ type: 'controller.design.review.requested', payload: plan.designContext }] : []),
        ...(plan.designReceipt && (to === 'design-approved' || (plan.from === 'design-review' && to === 'spec-approved')) ? [{ type: 'receipt.design-review.ingested', payload: { receipt: plan.designReceipt, issuerAuthenticated: false } }] : []),
        { type: 'change.transition', payload: { from: plan.from, to } },
      ] });
    } else throw new ControllerError(2, 'VALIDATION_ERROR', 'The Task 2.4 public transition seam is fail-closed to change scope; Task/Run transitions are controller-owned');
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    return result('TRANSITIONED', await this.state(repositoryRoot, changeId));
  }

  private claimAttemptKind(events: JournalEvent[], taskId: string): ClaimPlan['nextKind'] {
    return failedAttemptCount(events, taskId) === 0 ? 'initial' : 'remediation';
  }

  private claimAdmission(events: JournalEvent[], lifecycle: LifecycleSnapshotState, taskId: string | undefined): { routed: Routed; currentTaskState: 'ready' | 'remediation'; nextKind: 'initial' | 'remediation' | 'fresh-debug' } {
    const routed = taskId ? routedTask(events, taskId) : undefined;
    const currentTaskState = taskId ? lifecycle.tasks[taskId]?.state : undefined;
    if (lifecycle.changeState !== 'executing' || !routed || routed.task.id !== taskId || (currentTaskState !== 'ready' && currentTaskState !== 'remediation')) {
      const conflict = currentTaskState === 'leased' || currentTaskState === 'implementing' || Object.values(lifecycle.leases).some((lease) => lease.active);
      throw new ControllerError(conflict ? 5 : 3, conflict ? 'CONFLICT' : 'TRANSITION_FORBIDDEN', 'Task is not claimable', lifecycle);
    }
    const nextKind = this.claimAttemptKind(events, taskId);
    if (Object.values(lifecycle.leases).some((lease) => lease.active)) throw new ControllerError(5, 'CONFLICT', 'Active serial lease exists', lifecycle);
    return { routed, currentTaskState, nextKind };
  }

  private claimContinuationAdmission(events: JournalEvent[], lifecycle: LifecycleSnapshotState, taskId: string, supersededRunId: string, sessionId: string | undefined, inputTree: ClaimPlan['inputTree'], at: Date): { routed: Routed; continuation: ClaimContinuation; nextKind: ClaimPlan['nextKind'] } {
    const routed = routedTask(events, taskId);
    const claimed = latestTaskPayload<Claimed>(events, 'run.claimed', taskId);
    const lease = lifecycle.leases[taskId];
    const claimEvent = events.filter((event) => event.type === 'run.claimed' && event.taskId === taskId).at(-1);
    const leaseEvent = events.filter((event) => event.type === 'lease.claimed' && event.taskId === taskId).at(-1);
    if (!routed || !claimed || !claimEvent || !leaseEvent || claimed.runId !== supersededRunId || lifecycle.changeState !== 'executing'
      || lifecycle.tasks[taskId]?.state !== 'implementing' || lifecycle.runs[supersededRunId]?.state !== 'running'
      || !lease?.active || lease.generation !== claimed.lease?.generation || !Number.isFinite(Date.parse(claimed.lease.expiresAt)) || Date.parse(claimed.lease.expiresAt) > at.getTime()
      || !Number.isSafeInteger(claimed.lease.generation) || claimed.lease.generation < 1
      || claimEvent.taskRevision !== routed.task.revision || claimEvent.leaseGeneration !== claimed.lease.generation
      || leaseEvent.taskRevision !== routed.task.revision || leaseEvent.leaseGeneration !== claimed.lease.generation
      || claimed.operationFingerprint !== fingerprint({ changeId: claimEvent.changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, runId: supersededRunId })
      || claimed.lease.taskId !== taskId || claimed.lease.taskRevision !== routed.task.revision || lifecycle.tasks[taskId]?.revision !== routed.task.revision
      || lifecycle.runs[supersededRunId]?.taskId !== taskId
      || fingerprint(latestTaskPayload<{ lease: Lease }>(events, 'lease.claimed', taskId)?.lease) !== fingerprint(claimed.lease)) {
      throw new ControllerError(5, 'CONFLICT', 'Supersession requires the explicit current expired pre-Gate implementing Run', lifecycle);
    }
    if (!sessionId || !claimed.sessionId || sessionId === claimed.sessionId) {
      throw new ControllerError(5, 'CONFLICT', 'Supersession requires a distinct nonempty --session identity', lifecycle);
    }
    if (Object.entries(lifecycle.leases).some(([candidateTaskId, candidateLease]) => candidateTaskId !== taskId && candidateLease.active)) {
      throw new ControllerError(5, 'CONFLICT', 'Supersession refuses another active serial lease', lifecycle);
    }
    const runHistory = events.filter((event) => record(event.payload).runId === supersededRunId);
    const transitions = runHistory.filter((event) => event.type === 'run.transition');
    if (runHistory.some((event) => event.changeId !== lifecycle.changeId || event.taskId !== taskId || event.taskRevision !== routed.task.revision || event.leaseGeneration !== claimed.lease.generation)
      || runHistory.filter((event) => event.type === 'run.claimed').length !== 1
      || transitions.length !== 2 || record(transitions[0]?.payload).from !== null || record(transitions[0]?.payload).to !== 'created'
      || record(transitions[1]?.payload).from !== 'created' || record(transitions[1]?.payload).to !== 'running'
      || claimed.lease.generation !== this.nextClaimGeneration(events, taskId) - 1) {
      throw new ControllerError(5, 'CONFLICT', 'Supersession requires exact current Run creation and claim history');
    }
    const hasOutcome = events.some((event) => record(event.payload).runId === supersededRunId
      && (event.type === 'controller.candidate.registered' || event.type === 'controller.gate.result' || event.type === 'controller.submit.accepted'
        || event.type === 'run.unknown.context' || event.type.startsWith('gate.attempt.')));
    if (hasOutcome) throw new ControllerError(5, 'CONFLICT', 'Supersession refuses Runs with candidate, Gate, submit, or unknown-outcome history', lifecycle);
    const nextKind = this.claimAttemptKind(events, taskId);
    if (claimed.inputEntries && (!Array.isArray(claimed.inputEntries) || !claimed.inputEntries.every((entry) => typeof entry === 'string') || hash(`${TREE_IGNORE_POLICY_VERSION}\n${claimed.inputEntries.join('\n')}`) !== claimed.lease.inputTreeHash)) throw new ControllerError(5, 'CONFLICT', 'Old claim input entries do not match its tree identity');
    if (inputTree.hash !== claimed.lease.inputTreeHash) {
      if (!claimed.inputEntries) throw new ControllerError(5, 'CONFLICT', 'Supersession cannot adopt changed source without the old claim input entries', lifecycle);
      const authority = currentAuthority(events);
      if (!authority) throw new ControllerError(7, 'BLOCKED', 'Supersession requires current specification authority', lifecycle);
      this.assertCandidatePaths(inputTree.entries, claimed.inputEntries, routed, authority);
    }
    return { routed, continuation: { claimed, inputTree }, nextKind };
  }

  private async planClaim(repositoryRoot: string, changeId: string, options: CommandOptions, events: JournalEvent[]): Promise<ClaimPlan> {
    const lifecycle = reduceJournal(events);
    const taskId = stringOption(options, 'task')!;
    const sessionId = stringOption(options, 'session', false);
    const designReference = stringOption(options, 'designReviewReceipt', false);
    const designReceipt = designReference === undefined ? undefined : await this.planFreshClaimDesignReceipt(repositoryRoot, changeId, events, designReference);
    if (routedRisk(routedTasks(events)) !== 'lite' && !designReceipt) await this.designAdmissionAsync(() => assertFreshApprovedDesign({ repositoryRoot, changeId, routes: routedTasks(events), authority: currentAuthority(events), history: this.designHistory(events) }));
    const supersededRunId = stringOption(options, 'supersede', false);
    if (supersededRunId !== undefined) {
      const admitted = this.claimContinuationAdmission(events, lifecycle, taskId, supersededRunId, sessionId, await canonicalTreeHash(repositoryRoot), new Date());
      return { routed: admitted.routed, currentTaskState: 'ready', nextKind: admitted.nextKind, sessionId, inputTree: admitted.continuation.inputTree, continuation: admitted.continuation, designReceipt };
    }
    const admitted = this.claimAdmission(events, lifecycle, taskId);
    return { ...admitted, sessionId, inputTree: await canonicalTreeHash(repositoryRoot), designReceipt };
  }

  private claimOperations(changeId: string, plan: ClaimPlan, lease: Lease, runId: string): ControllerBatchOperation[] {
    const { routed, currentTaskState, nextKind, sessionId, inputTree, continuation } = plan;
    const taskId = routed.task.id;
    const operationFingerprint = fingerprint({ changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: lease.generation, runId });
    return [
      ...(continuation ? [
        { changeId, taskId, taskRevision: continuation.claimed.lease.taskRevision, leaseGeneration: continuation.claimed.lease.generation, type: 'run.transition', payload: { runId: continuation.claimed.runId, from: 'running', to: 'abandoned' } },
        { changeId, taskId, taskRevision: continuation.claimed.lease.taskRevision, leaseGeneration: continuation.claimed.lease.generation, type: 'lease.abandoned', payload: { lease: continuation.claimed.lease, reason: 'expired-pre-gate-continuation' } },
        { changeId, taskId, taskRevision: continuation.claimed.lease.taskRevision, leaseGeneration: continuation.claimed.lease.generation, type: 'task.continuation.recovered', payload: { oldRunId: continuation.claimed.runId, oldLease: continuation.claimed.lease, adoptedTreeHash: inputTree.hash, previousSessionId: continuation.claimed.sessionId, sessionId } },
      ] : []),
      ...(plan.designReceipt ? [{ changeId, taskId, taskRevision: routed.task.revision, type: 'receipt.design-review.ingested', payload: { receipt: plan.designReceipt.receipt, receiptSource: plan.designReceipt.source, issuerAuthenticated: false } }] : []),
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: lease.generation, type: 'lease.claimed', payload: { lease } },
      ...(currentTaskState === 'remediation' ? [{ changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: lease.generation, type: 'task.transition', payload: { from: 'remediation', to: 'ready' } }] : []),
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: lease.generation, type: 'task.transition', payload: { from: 'ready', to: 'leased' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: lease.generation, type: 'run.transition', payload: { runId, from: null, to: 'created' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: lease.generation, type: 'run.transition', payload: { runId, from: 'created', to: 'running' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: lease.generation, type: 'run.claimed', payload: { runId, lease, operationFingerprint, inputEntries: inputTree.entries, ...(sessionId ? { sessionId } : {}), attemptKind: nextKind } satisfies Claimed },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: lease.generation, type: 'task.transition', payload: { from: 'leased', to: 'implementing' } },
    ].map(({ changeId: _changeId, ...operation }) => operation);
  }

  async claim(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const taskId = stringOption(options, 'task')!;
    const events = await this.readEvents(repositoryRoot, changeId);
    const plan = await this.planClaim(repositoryRoot, changeId, options, events);
    const { routed, currentTaskState, sessionId, inputTree } = plan;
    const ttlMs = positiveInteger(options.ttl, 300_000, '--ttl');
    const paths = this.paths(repositoryRoot, changeId);
    const journal = new Journal(paths.runtime.journal);
    const lease: Lease = {
      taskId,
      taskRevision: routed.task.revision,
      inputTreeHash: inputTree.hash,
      generation: this.nextClaimGeneration(events, taskId),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };
    const retryReady: TransitionResult = currentTaskState === 'remediation' ? transitionTask('remediation', 'ready', { newLeaseGeneration: true }) : { ok: true };
    const leased = transitionTask('ready', 'leased', { noActiveLease: true, newLeaseGeneration: true });
    const implementing = transitionTask('leased', 'implementing', { runMatchesLease: true });
    if (!retryReady.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', retryReady.detail);
    if (!leased.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', leased.detail);
    if (!implementing.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', implementing.detail);
    const runId = `run-${randomUUID()}`;
    const runDecision = transitionRun('created', 'running', { runMatchesLease: true });
    if (!runDecision.ok) throw new ControllerError(3, runDecision.code, runDecision.detail);
    const continuation = plan.continuation;
    if (continuation) {
      const abandoned = transitionRun('running', 'abandoned', { leaseFenced: true });
      if (!abandoned.ok) throw new ControllerError(3, abandoned.code, abandoned.detail);
    }
    const recoverySources = continuation || plan.designReceipt ? [
      ...(plan.designReceipt ? [plan.designReceipt.designSource, plan.designReceipt.source] : (routedRisk(routedTasks(events)) === 'lite' ? [] : (() => {
        const context = this.designHistory(events).context;
        if (!context) throw new ControllerError(7, 'BLOCKED', 'Claim continuation has no immutable design-review source');
        return [{ relativePath: context.designPath, sha256: context.designHash }];
      })())),
    ] : [];
    const recovery = continuation || plan.designReceipt
      ? await captureSpecRevisionRecovery(repositoryRoot, changeId, [], inputTree.hash, recoverySources.map(({ relativePath, sha256 }) => ({ relativePath, sha256 })), continuation ? 'claim-continuation' : 'claim-design-review')
      : undefined;
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events,
      kind: continuation ? 'claim-continuation' : plan.designReceipt ? 'claim-design-review' : 'claim', recovery, faultAt: options.faultAt,
      operations: this.claimOperations(changeId, plan, lease, runId),
      validatePrepared: (batch, preparedAt) => {
        // TTL starts at durable admission; recovery later uses this recorded admission time.
        if (recovery) lease.expiresAt = new Date(preparedAt.getTime() + ttlMs).toISOString();
        if (recovery) this.validateClaimBatch(changeId, events, batch, preparedAt);
        else this.claimAdmission(events, reduceJournal(events), taskId);
      },
    });
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    return result('CLAIMED', await this.state(repositoryRoot, changeId));
  }

  private gateSettlementRequest(repositoryRoot: string, changeId: string, taskId: string, routed: Routed, claimed: Claimed, registry: GateRegistry, candidate?: CandidateBinding): GateSettlementInspectionRequest {
    return {
      repositoryRoot,
      registry,
      gateId: routed.task.gateIds[0]!,
      expectedInputTreeHash: candidate?.treeHash ?? claimed.lease.inputTreeHash,
      expectedGateDefinitionHash: routed.gateDefinitionHash,
      runId: claimed.runId,
      changeId,
      taskId,
      taskRevision: routed.task.revision,
      leaseGeneration: claimed.lease.generation,
    };
  }

  private assertCandidatePaths(candidateEntries: string[], inputEntries: string[], routed: Routed, initialized: { specPath: string; constitutionPath?: string | null }): void {
    const before = new Map(inputEntries.map((entry) => [entryPath(entry), entry]));
    const after = new Map(candidateEntries.map((entry) => [entryPath(entry), entry]));
    const changed = new Set<string>();
    for (const [path, entry] of before) if (after.get(path) !== entry) changed.add(path);
    for (const [path, entry] of after) if (before.get(path) !== entry) changed.add(path);
    for (const path of changed) {
      if (path === initialized.specPath || path === initialized.constitutionPath || path === routed.registryPath || path === '.leo-dev' || path.startsWith('.leo-dev/')) {
        throw new ControllerError(5, 'CONFLICT', `Candidate changes protected controller/spec/Gate binding: ${path}`);
      }
      if (!routed.task.allowedPaths.some((pattern) => pathMatches(path, pattern))) {
        throw new ControllerError(5, 'CONFLICT', `Candidate change is outside the task allowed paths: ${path}`);
      }
    }
  }

  private assertCandidateBinding(candidate: CandidateBinding, taskId: string, routed: Routed, claimed: Claimed, events: JournalEvent[]): void {
    if (candidate.runId !== claimed.runId || candidate.taskId !== taskId || candidate.taskRevision !== routed.task.revision || candidate.leaseGeneration !== claimed.lease.generation
      || candidate.claimInputTreeHash !== claimed.lease.inputTreeHash || candidate.specHash !== currentAuthority(events)?.specHash || candidate.taskHash !== routed.taskHash) {
      throw new ControllerError(7, 'BLOCKED', 'Registered candidate does not match the current Run/task/spec authority');
    }
  }

  private async registerCandidate(repositoryRoot: string, changeId: string, taskId: string, routed: Routed, claimed: Claimed, events: JournalEvent[], suppliedRunId: string | undefined, faultAt?: unknown, approvalReceipt?: RecordValue): Promise<CandidateBinding> {
    if (suppliedRunId !== undefined && suppliedRunId !== claimed.runId) throw new ControllerError(5, 'CONFLICT', 'Supplied --run does not match the active claimed Run');
    const current = await canonicalTreeHash(repositoryRoot);
    const existing = candidateForRun(events, taskId, claimed.runId);
    const changed = (existing?.treeHash ?? current.hash) !== claimed.lease.inputTreeHash;
    const receiptOperations = approvalReceipt ? [{ taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'receipt.gate-approval.ingested', payload: { receipt: approvalReceipt, runId: claimed.runId, issuerAuthenticated: false } }] : [];
    if (changed && suppliedRunId === undefined) throw new ControllerError(5, 'CONFLICT', 'Changed candidate requires an explicit matching --run');
    if (existing) {
      this.assertCandidateBinding(existing, taskId, routed, claimed, events);
      if (current.hash !== existing.treeHash) throw new ControllerError(5, 'CONFLICT', 'Registered candidate tree has drifted and cannot be refreshed');
      if (receiptOperations.length) {
        const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
        await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'gate-approval', faultAt, operations: receiptOperations });
        await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
      }
      return existing;
    }
    if (changed && !claimed.inputEntries) throw new ControllerError(5, 'CONFLICT', 'Historical claim has no input-entry baseline for a changed candidate');
    const initialized = currentAuthority(events);
    if (!initialized) throw new ControllerError(7, 'BLOCKED', 'Candidate registration requires initialized specification authority');
    if (changed) this.assertCandidatePaths(current.entries, claimed.inputEntries!, routed, initialized);
    const candidate: CandidateBinding = {
      runId: claimed.runId,
      taskId,
      taskRevision: routed.task.revision,
      leaseGeneration: claimed.lease.generation,
      claimInputTreeHash: claimed.lease.inputTreeHash,
      treeHash: current.hash,
      specHash: initialized.specHash,
      taskHash: routed.taskHash,
    };
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'candidate-registration', faultAt, operations: [
      { taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'controller.candidate.registered', payload: candidate },
      ...receiptOperations,
    ] });
    await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
    return candidate;
  }

  private async commitGateSettlementHandoff(repositoryRoot: string, changeId: string, taskId: string, routed: Routed, claimed: Claimed, rawEvents: JournalEvent[], settlement: VerifiedGateSettlement, faultAt?: unknown): Promise<LifecycleSnapshotState & RecordValue> {
    const logical = projectJournalEvents(rawEvents).events;
    const lifecycle = reduceJournal(logical);
    if (lifecycle.tasks[taskId]?.state !== 'implementing' || lifecycle.runs[claimed.runId]?.state !== 'running'
      || lifecycle.leases[taskId]?.active !== true || lifecycle.leases[taskId]?.generation !== claimed.lease.generation) {
      throw new ControllerError(7, 'BLOCKED', 'Gate settlement does not address the current implementing Run/task/lease', lifecycle);
    }
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    const evidenceRef = settlement.evidenceRef;
    const terminalEventHash = settlement.phaseEventHashes.at(-1);
    if (!terminalEventHash || !journalHashPattern.test(terminalEventHash)) throw new ControllerError(7, 'BLOCKED', 'Verified Gate settlement has no durable terminal event hash');
    const gateRecord = {
      attemptId: settlement.attemptId,
      terminalEventHash,
      runId: claimed.runId,
      changeId,
      taskId,
      taskRevision: routed.task.revision,
      leaseGeneration: claimed.lease.generation,
      gateId: routed.task.gateIds[0]!,
      status: settlement.status,
      outcome: settlement.outcome,
      ...(evidenceRef ? { evidenceRef } : {}),
    };
    const inputs: JournalInput[] = [];
    let projection;

    if (settlement.status === 'approval-expired') {
      const cancelRun = transitionRun('running', 'cancelled', { cancellationReceipt: true, sideEffectsKnownAbsent: true });
      const blockTask = transitionTask('implementing', 'blocked', { blockerRecorded: true });
      const requireApproval = transitionChange(lifecycle.changeState as ChangeState, 'approval-required', { authorityRequired: true });
      if (!cancelRun.ok || !blockTask.ok || !requireApproval.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', 'Expired Gate authority cannot be mapped from the current lifecycle');
      const blockerId = `gate-approval-expired:${claimed.runId}`;
      inputs.push(
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'run.transition', payload: { runId: claimed.runId, from: 'running', to: 'cancelled', sideEffectsKnownAbsent: true } },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'controller.gate.result', payload: gateRecord },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'blocker.recorded', payload: { blockerId, reason: 'Gate approval expired before argv release' } },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'implementing', to: 'blocked', blockerId } },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'lease.released', payload: { lease: claimed.lease, reason: 'not-started' } },
        { changeId, type: 'change.transition', payload: { from: lifecycle.changeState, to: 'approval-required', storedPriorState: lifecycle.changeState, reason: 'Gate approval expired before argv release' } },
      );
      const paths = this.paths(repositoryRoot, changeId);
      const manifest = record(await loadYaml(paths.manifest));
      projection = await buildProjection(repositoryRoot, changeId, paths.manifest, { ...manifest, state: 'approval-required' });
    } else if (settlement.outcome.runState === 'unknown') {
      const runDecision = transitionRun('running', 'unknown', { outcomeUnknown: true });
      const verifying = transitionTask('implementing', 'verifying', { candidateMatchesCas: true });
      const blockTask = transitionTask('verifying', 'blocked', { blockerRecorded: true });
      const requireApproval = transitionChange(lifecycle.changeState as ChangeState, 'approval-required', { authorityRequired: true });
      if (!runDecision.ok || !verifying.ok || !blockTask.ok || !requireApproval.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', 'Unique Run-unknown propagation is not valid from the current lifecycle');
      const blockerId = `run-unknown:${claimed.runId}`;
      const unknownContext: UnknownContext = {
        runId: claimed.runId,
        taskId,
        taskRevision: routed.task.revision,
        leaseGeneration: claimed.lease.generation,
        operationFingerprint: settlement.operationFingerprint,
        inputTreeHash: settlement.inputTreeHash,
        evidenceHashes: settlement.phaseEventHashes,
        priorChangeState: lifecycle.changeState as ChangeState,
        resumeTaskStateOnSuccess: 'verifying',
        retryRemaining: true,
      };
      inputs.push(
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'implementing', to: 'verifying' } },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'run.transition', payload: { runId: claimed.runId, from: 'running', to: 'unknown' } },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'controller.gate.result', payload: gateRecord },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'run.unknown.context', payload: unknownContext },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'blocker.recorded', payload: { blockerId, reason: 'run outcome unknown' } },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'verifying', to: 'blocked', blockerId } },
        { changeId, type: 'change.transition', payload: { from: lifecycle.changeState, to: 'approval-required', storedPriorState: lifecycle.changeState, reason: 'run outcome unknown' } },
      );
      const paths = this.paths(repositoryRoot, changeId);
      const manifest = record(await loadYaml(paths.manifest));
      projection = await buildProjection(repositoryRoot, changeId, paths.manifest, { ...manifest, state: 'approval-required' });
    } else {
      const terminal = settlement.outcome.runState;
      const runDecision = transitionRun('running', terminal, { exitEvidenceCommitted: true });
      const verifying = transitionTask('implementing', 'verifying', { candidateMatchesCas: true });
      if (!runDecision.ok || !verifying.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', 'Determinate Gate settlement cannot be mapped from the current lifecycle');
      inputs.push(
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'implementing', to: 'verifying' } },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'run.transition', payload: { runId: claimed.runId, from: 'running', to: terminal } },
        { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'controller.gate.result', payload: gateRecord },
      );
      if (settlement.status !== 'succeeded') {
        const priorFailures = failedAttemptCount(logical, taskId);
        const decision = decideFailedAttempt({
          priorFailures,
          previousFindingsHash: previousFindingsHash(logical, taskId),
        });
        const target = decision.target;
        const failureOrdinal = priorFailures + 1;
        const blockerId = target === 'blocked' ? `no-progress:${taskId}` : undefined;
        if (blockerId) inputs.push({ changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'blocker.recorded', payload: { blockerId, reason: 'no new evidence since the previous failure' } });
        inputs.push({ changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.attempt.failed', payload: { runId: claimed.runId, status: settlement.status, ordinal: failureOrdinal, nextAttempt: decision.nextKind } });
        const taskFailure = transitionTask('verifying', target, target === 'blocked' ? { blockerRecorded: true } : { retryRemaining: true, failureRecorded: true });
        if (!taskFailure.ok) throw new ControllerError(3, taskFailure.code, taskFailure.detail);
        inputs.push({ changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'verifying', to: target, ...(blockerId ? { blockerId } : {}) } });
        inputs.push({ changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'lease.released', payload: { lease: claimed.lease, reason: 'gate-failed' } });
        if (target === 'blocked') {
          const changeBlock = transitionChange(lifecycle.changeState as ChangeState, 'blocked', { blockerRecorded: true });
          if (!changeBlock.ok) throw new ControllerError(3, changeBlock.code, changeBlock.detail);
          inputs.push({ changeId, type: 'change.transition', payload: { from: lifecycle.changeState, to: 'blocked', blockerId } });
          const paths = this.paths(repositoryRoot, changeId);
          const manifest = record(await loadYaml(paths.manifest));
          projection = await buildProjection(repositoryRoot, changeId, paths.manifest, { ...manifest, state: 'blocked' });
        }
      }
    }
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: rawEvents, kind: 'gate-result', operations: inputs.map(({ changeId: _changeId, ...operation }) => operation), ...(projection ? { projections: [projection] } : {}), faultAt });
    await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
    return this.state(repositoryRoot, changeId);
  }

  async runGates(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const taskId = stringOption(options, 'task')!;
    const outputBytes = boundedGateOutput(options.maxOutputBytes);
    const events = await this.readEvents(repositoryRoot, changeId);
    const lifecycle = reduceJournal(events);
    const routed = routedTask(events, taskId);
    const claimed = latestTaskPayload<Claimed>(events, 'run.claimed', taskId);
    if (!routed || routed.task.id !== taskId || !claimed || lifecycle.tasks[taskId]?.state !== 'implementing' || lifecycle.runs[claimed.runId]?.state !== 'running') throw new ControllerError(7, 'BLOCKED', 'Task has no active implementing run', lifecycle);
    const projectedLease = lifecycle.leases[taskId];
    if (!projectedLease?.active || projectedLease.generation !== claimed.lease.generation || Date.parse(claimed.lease.expiresAt) <= Date.now()) throw new ControllerError(5, 'CONFLICT', 'Run lease binding is stale', lifecycle);
    const approvalReceipt = options.approvalReceipt === undefined ? undefined : await this.readReceipt('approval', stringOption(options, 'approvalReceipt')!);
    const approvalNeedsRecord = approvalReceipt ? this.gateApprovalNeedsRecord(events, claimed, approvalReceipt) : false;
    const registry = await GateRegistry.fromYaml(resolve(repositoryRoot, routed.registryPath));
    const gate = registry.get(routed.task.gateIds[0]!);
    const preflightTree = await canonicalTreeHash(repositoryRoot);
    await new GateRunner().preflight({ repositoryRoot, registry, gateId: routed.task.gateIds[0]!, expectedInputTreeHash: preflightTree.hash, expectedGateDefinitionHash: routed.gateDefinitionHash, runId: claimed.runId, changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, maxOutputBytes: outputBytes, ...(approvalReceipt ? { approvalReceipt } : {}) });
    const candidate = await this.registerCandidate(repositoryRoot, changeId, taskId, routed, claimed, events, stringOption(options, 'run', false), options.faultAt, approvalNeedsRecord && (gate.network !== 'deny' || gate.effectClass !== 'local-verification') ? approvalReceipt : undefined);
    const runner = new GateRunner();
    const gateRequest = { repositoryRoot, registry, gateId: routed.task.gateIds[0]!, expectedInputTreeHash: candidate.treeHash, expectedGateDefinitionHash: routed.gateDefinitionHash, runId: claimed.runId, changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, maxOutputBytes: outputBytes, ...(approvalReceipt ? { approvalReceipt } : {}) };
    try {
      await runner.run(gateRequest);
    } catch (error: unknown) {
      if (!(error instanceof GateRunIndeterminateError)) throw error;
      const state = await this.persistUnknownOutcome(repositoryRoot, changeId, taskId, routed, claimed, lifecycle, { status: 'unknown', outcome: error.outcome, error: error.message }, options.faultAt);
      throw new ControllerError(7, 'BLOCKED', error.message, state);
    }
    const rawEvents = (await new Journal(runtimePaths(repositoryRoot, changeId).journal).replayStrict()).events;
    const settlement = await runner.inspectSettlement(this.gateSettlementRequest(repositoryRoot, changeId, taskId, routed, claimed, registry, candidate));
    const state = await this.commitGateSettlementHandoff(repositoryRoot, changeId, taskId, routed, claimed, rawEvents, settlement, options.faultAt);
    const evidenceRefs = settlement.evidenceRef ? [settlement.evidenceRef] : [];
    if (settlement.status === 'succeeded') return result('GATES_PASSED', state, evidenceRefs);
    if (settlement.status === 'approval-expired') throw new ControllerError(6, 'APPROVAL_REQUIRED', 'Gate approval expired before argv release', state);
    if (settlement.outcome.runState === 'unknown') throw new ControllerError(7, 'BLOCKED', `Gate outcome is ${settlement.status} with indeterminate effects`, state, evidenceRefs);
    throw new ControllerError(4, 'GATE_FAILED', `Gate ended ${settlement.status}`, state, evidenceRefs);
  }

  private async persistUnknownOutcome(repositoryRoot: string, changeId: string, taskId: string, routed: Routed, claimed: Claimed, lifecycle: LifecycleSnapshotState, gateRecord: RecordValue, faultAt?: unknown): Promise<LifecycleSnapshotState & RecordValue> {
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    const strict = await journal.replayStrict();
    if (strict.discardedIncompleteTail) throw new ControllerError(7, 'BLOCKED', 'Gate indeterminate outcome cannot be mapped over an incomplete journal tail');
    const prepared = strict.events.filter((event) => event.type === 'gate.attempt.prepared' && record(event.payload).runId === claimed.runId).at(-1);
    if (!prepared) throw new ControllerError(7, 'BLOCKED', 'Gate indeterminate outcome has no durable prepared attempt to reconcile');
    const preparedPayload = record(prepared.payload);
    const attemptId = preparedPayload.attemptId;
    const evidenceHashes = strict.events
      .filter((event) => event.type.startsWith('gate.attempt.') && typeof attemptId === 'string' && record(event.payload).attemptId === attemptId)
      .map((event) => event.eventHash);
    const unknownContext: UnknownContext = {
      runId: claimed.runId,
      taskId,
      taskRevision: routed.task.revision,
      leaseGeneration: claimed.lease.generation,
      operationFingerprint: typeof preparedPayload.operationFingerprint === 'string' ? preparedPayload.operationFingerprint : claimed.operationFingerprint,
      inputTreeHash: typeof preparedPayload.inputTreeHash === 'string' ? preparedPayload.inputTreeHash : claimed.lease.inputTreeHash,
      evidenceHashes: evidenceHashes.length > 0 ? evidenceHashes : [prepared.eventHash],
      priorChangeState: lifecycle.changeState as ChangeState,
      resumeTaskStateOnSuccess: 'verifying',
      retryRemaining: true,
    };
    const blockerId = `run-unknown:${claimed.runId}`;
    const runDecision = transitionRun('running', 'unknown', { outcomeUnknown: true });
    const verifying = transitionTask('implementing', 'verifying', { candidateMatchesCas: true });
    const blockTask = transitionTask('verifying', 'blocked', { blockerRecorded: true });
    const requireApproval = transitionChange(lifecycle.changeState as ChangeState, 'approval-required', { authorityRequired: true });
    if (!runDecision.ok || !verifying.ok || !blockTask.ok || !requireApproval.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', 'Unique Run-unknown propagation is not valid from the current lifecycle');
    const paths = this.paths(repositoryRoot, changeId);
    const manifest = record(await loadYaml(paths.manifest));
    const projection = await buildProjection(repositoryRoot, changeId, paths.manifest, { ...manifest, state: 'approval-required' });
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: strict.events, kind: 'unknown-outcome', projections: [projection], faultAt, operations: [
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'implementing', to: 'verifying' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'run.transition', payload: { runId: claimed.runId, from: 'running', to: 'unknown' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'controller.gate.result', payload: {
        ...gateRecord,
        runId: claimed.runId,
        changeId,
        taskId,
        taskRevision: routed.task.revision,
        leaseGeneration: claimed.lease.generation,
        gateId: routed.task.gateIds[0]!,
      } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'run.unknown.context', payload: unknownContext },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'blocker.recorded', payload: { blockerId, reason: 'run outcome unknown' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'verifying', to: 'blocked', blockerId } },
      { changeId, type: 'change.transition', payload: { from: lifecycle.changeState, to: 'approval-required', storedPriorState: lifecycle.changeState, reason: 'run outcome unknown' } },
    ].map(({ changeId: _changeId, ...operation }) => operation) });
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    return this.state(repositoryRoot, changeId);
  }

  async submit(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const taskId = stringOption(options, 'task')!;
    let events = await this.readEvents(repositoryRoot, changeId);
    let admission = await this.assertSubmitCandidate(repositoryRoot, taskId, events);
    if (admission.reconciledSuccess && !candidateForRun(events, taskId, admission.claimed.runId)) {
      const context = latestTaskPayload<UnknownContext>(events, 'run.unknown.context', taskId);
      if (!context) throw new ControllerError(7, 'BLOCKED', 'Historical reconciliation has no immutable Run-unknown context');
      const candidate = await this.legacyReconciledCandidate(repositoryRoot, taskId, admission.routed, admission.claimed, context, events);
      const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
      await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'legacy-candidate-recovery', faultAt: options.faultAt, operations: [
        { taskId, taskRevision: admission.routed.task.revision, leaseGeneration: admission.claimed.lease.generation, type: 'controller.candidate.registered', payload: candidate },
      ] });
      await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
      events = await this.readEvents(repositoryRoot, changeId);
      admission = await this.assertSubmitCandidate(repositoryRoot, taskId, events);
    }
    const { routed, claimed, gate, reconciliation, reconciledSuccess, candidateTreeHash } = admission;
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    const reviewRequired = transitionTask('verifying', 'review-required', { gatesCurrent: true });
    if (!reviewRequired.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', reviewRequired.detail);
    const authority = currentAuthority(events);
    if (!authority) throw new ControllerError(7, 'BLOCKED', 'Submission requires current specification authority');
    const submitted: SubmittedCandidate = { runId: claimed.runId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, specHash: authority.specHash, taskHash: routed.taskHash, treeHash: candidateTreeHash };
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'submit', faultAt: options.faultAt, operations: [
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'verifying', to: 'review-required' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'controller.submit.accepted', payload: submitted },
    ].map(({ changeId: _changeId, ...operation }) => operation) });
    await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
    const evidenceRefs = gate?.evidenceRef ? [gate.evidenceRef] : reconciledSuccess ? [`receipt:${String(reconciliation?.receiptId)}`] : [];
    return result('SUBMITTED_FOR_REVIEW', await this.state(repositoryRoot, changeId), evidenceRefs);
  }

  private async readReceipt(kind: ReceiptKind, path: string, source?: { bytes?: Buffer }): Promise<RecordValue> {
    let value: unknown;
    try {
      const bytes = await readFile(resolve(path));
      value = YAML.parse(bytes.toString('utf8')) as unknown;
      if (source) source.bytes = bytes;
    }
    catch (error: unknown) { throw new ControllerError(2, 'SCHEMA_INVALID', `Receipt could not be parsed; issuer was not authenticated: ${error instanceof Error ? error.message : String(error)}`); }
    const validation = validateReceipt(kind, value);
    if (!validation.ok) validationError(validation.details, 'Receipt');
    return validation.value;
  }

  private assertRevisionReceiptIdReserved(events: JournalEvent[], receipt: RecordValue): void {
    const receiptId = receipt.receiptId;
    if (typeof receiptId === 'string' && events.some((event) => event.type === 'receipt.spec-revision.ingested'
      && record(record(event.payload).receipt).receiptId === receiptId)) {
      throw new ControllerError(5, 'CONFLICT', 'Receipt ID is reserved by a consumed specification revision receipt; issuer was not authenticated');
    }
  }

  async review(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const taskId = stringOption(options, 'task')!;
    const receipt = await this.readReceipt('review', stringOption(options, 'receipt')!);
    const events = await this.readEvents(repositoryRoot, changeId);
    this.assertRevisionReceiptIdReserved(events, receipt);
    const { lifecycle, routed, claimed } = await this.assertReviewCandidate(repositoryRoot, changeId, taskId, receipt, events);
    const { provenance, effectiveRisk, independentSession, fullAssessments } = this.reviewPolicy(routed, claimed, receipt, lifecycle);
    if (receipt.verdict === 'reject') {
      const priorFailures = failedAttemptCount(events, taskId);
      const currentFindingsHash = typeof receipt.findingsHash === 'string' ? receipt.findingsHash : undefined;
      const decision = decideFailedAttempt({
        priorFailures,
        previousFindingsHash: previousFindingsHash(events, taskId),
        currentFindingsHash,
      });
      const target = decision.target;
      const failureOrdinal = priorFailures + 1;
      const remediation = transitionTask('reviewing', target, target === 'blocked' ? { blockerRecorded: true } : { retryRemaining: true, failureRecorded: true });
      if (!remediation.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', remediation.detail);
      const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
      const paths = this.paths(repositoryRoot, changeId);
      const manifest = record(await loadYaml(paths.manifest));
      const projection = target === 'blocked' ? await buildProjection(repositoryRoot, changeId, paths.manifest, { ...manifest, state: 'blocked' }) : undefined;
      const blockerId = target === 'blocked' ? `no-progress:${taskId}` : undefined;
      await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'review-rejected', projections: projection ? [projection] : [], faultAt: options.faultAt, operations: [
        { taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'receipt.review.ingested', payload: { receipt, issuerAuthenticated: false } },
        { taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.attempt.failed', payload: { receiptId: receipt.receiptId, findingsHash: receipt.findingsHash, ordinal: failureOrdinal, nextAttempt: decision.nextKind } },
        { taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'review-required', to: 'reviewing' } },
        ...(blockerId ? [{ taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'blocker.recorded', payload: { blockerId, reason: 'no new evidence since the previous failure' } }] : []),
        { taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'reviewing', to: target, ...(blockerId ? { blockerId } : {}) } },
        { taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'lease.released', payload: { lease: claimed.lease, reason: 'review-rejected' } },
        ...(target === 'blocked' ? [{ type: 'change.transition', payload: { from: lifecycle.changeState, to: 'blocked', blockerId } }] : []),
      ].map((value) => {
        const { changeId: _changeId, ...operation } = value as ControllerBatchOperation & { changeId?: string };
        return operation;
      }) });
      await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
      return result('REVIEW_REJECTED', { ...(await this.state(repositoryRoot, changeId)), issuerAuthenticated: false });
    }
    const done = transitionTask('reviewing', 'done', { risk: effectiveRisk, reviewReceiptAccepted: true, reviewProvenance: provenance, independentSession,
      architectureReceipt: fullAssessments, securityReceipt: fullAssessments, nfrReceipt: fullAssessments });
    if (!done.ok) throw new ControllerError(3, 'TRANSITION_FORBIDDEN', done.detail);
    const routes = routedTasks(events);
    const completed = new Set(routes.filter((route) => route.task.id === taskId || lifecycle.tasks[route.task.id]?.state === 'done').map((route) => route.task.id));
    const unlocked = routes.filter((route) => lifecycle.tasks[route.task.id]?.state === 'pending' && route.task.dependsOn.every((dependency) => completed.has(dependency)));
    const integration = routes.length > 0 && routes.every((route) => completed.has(route.task.id));
    if (integration) {
      const changeDecision = transitionChange(lifecycle.changeState as ChangeState, 'integration-review', { allTasksDone: true, noActiveOrUnknownRun: true, integrationGatesDeclared: true });
      if (!changeDecision.ok) throw new ControllerError(3, changeDecision.code, changeDecision.detail);
    }
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    const paths = this.paths(repositoryRoot, changeId);
    const manifest = record(await loadYaml(paths.manifest));
    const projection = integration ? await buildProjection(repositoryRoot, changeId, paths.manifest, { ...manifest, state: 'integration-review' }) : undefined;
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'review', projections: projection ? [projection] : [], faultAt: options.faultAt, operations: [
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'receipt.review.ingested', payload: { receipt, issuerAuthenticated: false } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'review-required', to: 'reviewing' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'task.transition', payload: { from: 'reviewing', to: 'done' } },
      { changeId, taskId, taskRevision: routed.task.revision, leaseGeneration: claimed.lease.generation, type: 'lease.released', payload: { lease: claimed.lease } },
      ...unlocked.map((successor) => ({ taskId: successor.task.id, taskRevision: successor.task.revision, type: 'task.transition', payload: { from: 'pending', to: 'ready' } })),
      ...(integration ? [{ type: 'change.transition', payload: { from: lifecycle.changeState, to: 'integration-review' } }] : []),
    ].map((value) => {
      const { changeId: _changeId, ...operation } = value as ControllerBatchOperation & { changeId?: string };
      return operation;
    }) });
    await writeSnapshotStrict(paths.runtime.snapshot, journal);
    const state = await this.state(repositoryRoot, changeId);
    return result(routed.task.role === 'integration' ? 'INTEGRATION_REVIEW_ACCEPTED_UNAUTHENTICATED' : 'LITE_REVIEW_ACCEPTED_UNAUTHENTICATED', { ...state, issuerAuthenticated: false, releaseReady: false }, state.evidenceRefs as string[]);
  }

  private async ingest(kind: ReceiptKind, command: string, options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const receipt = await this.readReceipt(kind, stringOption(options, 'receipt')!);
    const events = await this.readEvents(repositoryRoot, changeId);
    this.assertRevisionReceiptIdReserved(events, receipt);
    if (typeof receipt.changeId === 'string' && receipt.changeId !== changeId) throw new ControllerError(5, 'CONFLICT', 'Receipt change scope does not match; issuer was not authenticated');
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: `receipt-${kind}`, faultAt: options.faultAt, operations: [{ taskId: typeof receipt.taskId === 'string' ? receipt.taskId : undefined, taskRevision: typeof receipt.taskRevision === 'number' ? receipt.taskRevision : undefined, leaseGeneration: typeof receipt.leaseGeneration === 'number' ? receipt.leaseGeneration : undefined, type: `receipt.${kind}.ingested`, payload: { receipt, issuerAuthenticated: false } }] });
    await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
    return result('RECEIPT_ACCEPTED_UNAUTHENTICATED', { command, receiptKind: kind, receiptId: receipt.receiptId, issuerAuthenticated: false, applied: false });
  }

  async approve(options: CommandOptions): Promise<CommandResult> { return this.ingest('approval', 'approve', options); }
  async waive(options: CommandOptions): Promise<CommandResult> { return this.ingest('waiver', 'waive', options); }
  async resolve(options: CommandOptions): Promise<CommandResult> { return this.ingest('resolution', 'resolve', options); }

  async reconcile(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const receipt = await this.readReceipt('reconciliation', stringOption(options, 'receipt')!);
    const events = await this.readEvents(repositoryRoot, changeId);
    this.assertRevisionReceiptIdReserved(events, receipt);
    const { lifecycle, runId, taskId, claimed, context, outcome, safeToRetry, resolvedRunState } = this.reconciliationPlan(events, receipt);
    const journal = new Journal(runtimePaths(repositoryRoot, changeId).journal);
    const inputs: JournalInput[] = [];
    if (resolvedRunState === 'abandoned' && safeToRetry) inputs.push({ changeId, taskId, taskRevision: claimed.lease.taskRevision, leaseGeneration: claimed.lease.generation, type: 'lease.abandoned', payload: { lease: claimed.lease } });
    const priorFailures = resolvedRunState === 'failed' ? failedAttemptCount(events, taskId) : undefined;
    const decision = priorFailures === undefined ? undefined : decideFailedAttempt({
      priorFailures,
      previousFindingsHash: previousFindingsHash(events, taskId),
      currentFindingsHash: typeof receipt.findingsHash === 'string' ? receipt.findingsHash : undefined,
    });
    const failureOrdinal = priorFailures === undefined ? undefined : priorFailures + 1;
    const blockerId = decision?.target === 'blocked' ? `no-progress:${taskId}` : undefined;
    inputs.push(
      { changeId, taskId, taskRevision: claimed.lease.taskRevision, leaseGeneration: claimed.lease.generation, type: 'receipt.reconciliation.ingested', payload: { receipt, issuerAuthenticated: false } },
      { changeId, taskId, taskRevision: claimed.lease.taskRevision, leaseGeneration: claimed.lease.generation, type: 'run.transition', payload: { runId, from: 'unknown', to: outcome.runState } },
    );
    if (failureOrdinal !== undefined && decision) {
      inputs.push(
        { changeId, taskId, taskRevision: claimed.lease.taskRevision, leaseGeneration: claimed.lease.generation, type: 'task.attempt.failed', payload: { runId, status: 'failed', ordinal: failureOrdinal, nextAttempt: decision.nextKind } },
        { changeId, taskId, taskRevision: claimed.lease.taskRevision, leaseGeneration: claimed.lease.generation, type: 'lease.released', payload: { lease: claimed.lease, reason: 'reconciled-failed' } },
      );
    }
    if (blockerId) inputs.push({ changeId, taskId, taskRevision: claimed.lease.taskRevision, leaseGeneration: claimed.lease.generation, type: 'blocker.recorded', payload: { blockerId, reason: 'no new evidence since the previous failure' } });
    if (outcome.taskState !== 'blocked') inputs.push({ changeId, taskId, taskRevision: claimed.lease.taskRevision, leaseGeneration: context.leaseGeneration, type: 'task.transition', payload: { from: 'blocked', to: outcome.taskState } });
    if (outcome.changeState !== lifecycle.changeState) inputs.push({ changeId, type: 'change.transition', payload: { from: lifecycle.changeState, to: outcome.changeState, ...(blockerId ? { blockerId } : {}) } });
    const paths = this.paths(repositoryRoot, changeId);
    const manifest = record(await loadYaml(paths.manifest));
    const projection = await buildProjection(repositoryRoot, changeId, paths.manifest, { ...manifest, state: outcome.changeState });
    await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: events, kind: 'reconcile', projections: [projection], faultAt: options.faultAt, operations: inputs.map(({ changeId: _changeId, ...operation }) => operation) });
    await writeSnapshotStrict(runtimePaths(repositoryRoot, changeId).snapshot, journal);
    return result('RUN_RECONCILED_UNAUTHENTICATED', { ...(await this.state(repositoryRoot, changeId)), issuerAuthenticated: false, outcome });
  }

  private onlyCommittedSafeUnreleasedAbandonments(rawEvents: JournalEvent[], logical: JournalEvent[], lifecycle: LifecycleSnapshotState): boolean {
    const prepared = rawEvents.filter((event) => event.type === 'gate.attempt.prepared');
    const unsettled = prepared.filter((event) => {
      const attemptId = record(event.payload).attemptId;
      return typeof attemptId === 'string' && !rawEvents.some((candidate) => record(candidate.payload).attemptId === attemptId
        && ['gate.attempt.settled', 'gate.attempt.aborted', 'gate.attempt.denied'].includes(candidate.type));
    });
    if (unsettled.length === 0) return false;
    return unsettled.every((attempt) => {
      const payload = record(attempt.payload);
      const attemptId = payload.attemptId;
      const runId = payload.runId;
      if (typeof attemptId !== 'string' || typeof runId !== 'string' || rawEvents.some((candidate) => candidate.type === 'gate.attempt.released' && record(candidate.payload).attemptId === attemptId)) return false;
      const taskId = attempt.taskId;
      const taskRevision = attempt.taskRevision;
      const leaseGeneration = attempt.leaseGeneration;
      const phases = rawEvents.filter((candidate) => record(candidate.payload).attemptId === attemptId && candidate.type.startsWith('gate.attempt.'));
      if (!taskId || !Number.isSafeInteger(taskRevision) || !Number.isSafeInteger(leaseGeneration)
        || phases.filter((candidate) => candidate.type === 'gate.attempt.prepared').length !== 1
        || phases.filter((candidate) => candidate.type === 'gate.attempt.started').length > 1
        || phases.some((candidate) => !['gate.attempt.prepared', 'gate.attempt.started'].includes(candidate.type))) return false;
      const claimedEvent = logical.filter((event) => event.type === 'run.claimed' && event.taskId === taskId && record(event.payload).runId === runId).at(-1);
      const claimed = claimedEvent ? record(claimedEvent.payload) as Claimed : undefined;
      const contextEvent = logical.filter((event) => event.type === 'run.unknown.context' && event.taskId === taskId && record(event.payload).runId === runId).at(-1);
      const context = contextEvent ? record(contextEvent.payload) as UnknownContext : undefined;
      if (!claimed || !context || claimed.runId !== runId || context.runId !== runId || context.taskRevision !== taskRevision || context.leaseGeneration !== leaseGeneration
        || !context.evidenceHashes.includes(attempt.eventHash) || lifecycle.runs[runId]?.state !== 'abandoned') return false;
      const batchEvent = rawEvents.find((event) => event.type === 'controller.batch.prepared' && record(event.payload).kind === 'reconcile' && (() => {
        const operations = record(event.payload).operations;
        if (!Array.isArray(operations)) return false;
        const receiptOperations = operations.filter((operation) => record(operation).type === 'receipt.reconciliation.ingested');
        const abandonedOperations = operations.filter((operation) => record(operation).type === 'lease.abandoned');
        const runOperations = operations.filter((operation) => record(operation).type === 'run.transition');
        const taskOperations = operations.filter((operation) => record(operation).type === 'task.transition');
        if (receiptOperations.length !== 1 || abandonedOperations.length !== 1 || runOperations.length !== 1 || taskOperations.length !== 1) return false;
        const receipt = receiptOperations[0];
        const receiptValue = record(record(receipt).payload).receipt;
        const receiptMatches = record(receiptValue).runId === runId && record(receiptValue).taskRevision === context.taskRevision
          && record(receiptValue).leaseGeneration === context.leaseGeneration && record(receiptValue).inputTreeHash === context.inputTreeHash
          && record(receiptValue).operationFingerprint === context.operationFingerprint && JSON.stringify(record(receiptValue).evidenceHashes) === JSON.stringify(context.evidenceHashes)
          && record(receiptValue).resolvedRunState === 'abandoned' && record(receiptValue).sideEffectDisposition === 'not-started' && record(receiptValue).safeToRetry === true;
        const abandoned = record(abandonedOperations[0]);
        const run = record(runOperations[0]);
        const task = record(taskOperations[0]);
        return receiptMatches && abandoned.taskId === taskId && abandoned.taskRevision === taskRevision && abandoned.leaseGeneration === leaseGeneration
          && fingerprint(record(record(abandoned).payload).lease) === fingerprint(claimed.lease)
          && run.taskId === taskId && run.taskRevision === taskRevision && run.leaseGeneration === leaseGeneration && record(run.payload).runId === runId && record(run.payload).from === 'unknown' && record(run.payload).to === 'abandoned'
          && task.taskId === taskId && task.taskRevision === taskRevision && task.leaseGeneration === leaseGeneration && record(task.payload).from === 'blocked' && record(task.payload).to === 'ready';
      })());
      return !!batchEvent && rawEvents.some((event) => event.type === 'controller.batch.committed' && record(event.payload).batchId === record(batchEvent.payload).batchId && record(event.payload).preparedEventHash === batchEvent.eventHash);
    });
  }

  private async recoverSubmittedReview(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const taskId = stringOption(options, 'task')!;
    if (await this.assertResumePrerequisite(repositoryRoot, changeId)) {
      throw new ControllerError(7, 'BLOCKED', 'Review recovery cannot repair an incomplete initialization');
    }
    const paths = runtimePaths(repositoryRoot, changeId);
    const journal = new Journal(paths.journal);
    try {
      const strict = await journal.replayStrict();
      const pending = projectJournalEvents(strict.events).pending;
      if (pending?.batch.kind === 'expired-review-recovery'
        || pending?.batch.operations.some((operation) => operation.type === 'controller.review.recovered')) {
        await this.validatePendingReviewRecovery(repositoryRoot, changeId, taskId, strict.events);
      }
      // Ordinary recovery is invoked only for genuinely incomplete history. On a
      // clean journal even invalid requests must leave the snapshot untouched.
      if (strict.discardedIncompleteTail || pending || classifyGateHandoffs(strict.events).kind === 'pending') {
        await this.resume({ ...options, task: undefined, recoverReview: false });
      }
      const events = await this.readEvents(repositoryRoot, changeId);
      const { binding, existing } = await this.reviewRecoveryPlan(repositoryRoot, changeId, taskId, events, new Date());
      if (existing) return result('REVIEW_RECOVERY_REPLAYED', await this.state(repositoryRoot, changeId, events));
      const payload: ReviewRecoveryPayload = { schemaVersion: 1, recoveryId: randomUUID(), ...binding };
      await commitControllerBatch({
        repositoryRoot, changeId, journal, priorEvents: events, kind: 'expired-review-recovery', faultAt: options.faultAt,
        operations: [{ type: 'controller.review.recovered', taskId, taskRevision: binding.taskRevision,
          leaseGeneration: binding.leaseGeneration, payload }],
      });
      await writeSnapshotStrict(paths.snapshot, journal);
      return result('REVIEW_RECOVERED', await this.state(repositoryRoot, changeId));
    } catch (error) {
      // Do not change the historical error mapping of other controller commands.
      if (error instanceof JournalTailMismatchError || error instanceof ControllerBatchConflictError) {
        throw new ControllerError(5, 'CONFLICT', 'Review recovery history changed concurrently; reread the current context');
      }
      throw error;
    }
  }

  async resume(options: CommandOptions): Promise<CommandResult> {
    if (options.recoverReview === true) return this.recoverSubmittedReview(options);
    const repositoryRoot = await realpath(this.repository(options));
    const changeId = this.changeId(options);
    const initialization = await this.assertResumePrerequisite(repositoryRoot, changeId);
    const paths = runtimePaths(repositoryRoot, changeId);
    const journal = new Journal(paths.journal);
    let strict = await journal.replayStrict();
    this.verifySpecRevisionHistory(repositoryRoot, changeId, strict.events, true);
    const pendingReviewBatch = projectJournalEvents(strict.events).pending;
    this.verifyReviewRecoveryHistory(pendingReviewBatch ? strict.events.slice(0, -1) : strict.events);
    if (pendingReviewBatch?.batch.kind === 'expired-review-recovery'
      || pendingReviewBatch?.batch.operations.some((operation) => operation.type === 'controller.review.recovered')) {
      const operation = pendingReviewBatch.batch.operations[0];
      await this.validatePendingReviewRecovery(repositoryRoot, changeId, String(operation?.taskId ?? ''), strict.events);
    }
    let handoff = classifyGateHandoffs(strict.events);
    if (handoff.kind === 'invalid') throw new ControllerError(7, 'BLOCKED', handoff.reason);
    await this.verifyGateHandoffHistory(repositoryRoot, changeId, strict.events, handoff, strict.discardedIncompleteTail);
    if (strict.discardedIncompleteTail && projectJournalEvents(strict.events).pending) {
      await preflightControllerBatchRecovery(repositoryRoot, changeId, strict.events);
      const repaired = await recoverJournal(journal);
      if (!repaired.ok) throw new ControllerError(7, 'BLOCKED', repaired.detail);
      await recoverControllerBatch(repositoryRoot, changeId, journal, repaired.replay.events);
      strict = await journal.replayStrict();
      handoff = classifyGateHandoffs(strict.events);
      if (handoff.kind === 'invalid') throw new ControllerError(7, 'BLOCKED', handoff.reason);
      await this.verifyGateHandoffHistory(repositoryRoot, changeId, strict.events, handoff, strict.discardedIncompleteTail);
    }
    if (initialization) {
      await this.assertInitializationAuthorityRecoverable(repositoryRoot, changeId, initialization);
      await initializeChangeWorkspace(repositoryRoot, changeId, { controllerAuthority: initialization });
      if (strict.discardedIncompleteTail) throw new ControllerError(7, 'BLOCKED', 'Initialization journal has an ambiguous incomplete tail');
      const projected = projectJournalEvents(strict.events);
      if (projected.pending) await recoverControllerBatch(repositoryRoot, changeId, journal, strict.events);
      else if (strict.events.length === 0) {
        const artifactPaths = this.paths(repositoryRoot, changeId);
        const projections = await Promise.all([
          buildProjection(repositoryRoot, changeId, artifactPaths.manifest, initialization.manifest),
          buildProjection(repositoryRoot, changeId, artifactPaths.spec, initialization.spec),
          buildProjection(repositoryRoot, changeId, artifactPaths.tasks, initialization.tasks),
        ]);
        await commitControllerBatch({ repositoryRoot, changeId, journal, priorEvents: [], kind: 'initialize', projections, operations: [{ type: 'controller.initialized', payload: initialization.initialized }] });
      }
      await completeControllerInitialization(repositoryRoot, changeId);
      strict = await journal.replayStrict();
      handoff = classifyGateHandoffs(strict.events);
      if (handoff.kind === 'invalid') throw new ControllerError(7, 'BLOCKED', handoff.reason);
      await this.verifyGateHandoffHistory(repositoryRoot, changeId, strict.events, handoff, strict.discardedIncompleteTail);
    }
    if (!strict.discardedIncompleteTail && projectJournalEvents(strict.events).pending) {
      await recoverControllerBatch(repositoryRoot, changeId, journal, strict.events);
      strict = await journal.replayStrict();
      handoff = classifyGateHandoffs(strict.events);
      if (handoff.kind === 'invalid') throw new ControllerError(7, 'BLOCKED', handoff.reason);
      await this.verifyGateHandoffHistory(repositoryRoot, changeId, strict.events, handoff, strict.discardedIncompleteTail);
    }
    if (strict.discardedIncompleteTail && handoff.kind === 'pending') {
      const events = await this.readEvents(repositoryRoot, changeId, true, true);
      const taskId = handoff.terminal.taskId;
      const routed = routedTask(events, taskId);
      const claimed = taskId ? latestTaskPayload<Claimed>(events, 'run.claimed', taskId) : undefined;
      if (!routed || !taskId || !claimed) throw new ControllerError(7, 'BLOCKED', 'Pending Gate handoff has no current routed Run/task authority');
      const registry = await GateRegistry.fromYaml(resolve(repositoryRoot, routed.registryPath));
      await new GateRunner().inspectSettlementBeforeIncompleteTail(this.gateSettlementRequest(repositoryRoot, changeId, taskId, routed, claimed, registry, candidateForRun(events, taskId, claimed.runId)));
      const repaired = await recoverJournal(journal);
      if (!repaired.ok) throw new ControllerError(7, 'BLOCKED', repaired.detail);
      strict = await journal.replayStrict();
      handoff = classifyGateHandoffs(strict.events);
      if (handoff.kind === 'invalid') throw new ControllerError(7, 'BLOCKED', handoff.reason);
      await this.verifyGateHandoffHistory(repositoryRoot, changeId, strict.events, handoff, strict.discardedIncompleteTail);
    }
    if (handoff.kind === 'pending') {
      const events = await this.readEvents(repositoryRoot, changeId, false, true);
      const taskId = handoff.terminal.taskId;
      const routed = routedTask(events, taskId);
      const claimed = taskId ? latestTaskPayload<Claimed>(events, 'run.claimed', taskId) : undefined;
      if (!routed || !taskId || !claimed) throw new ControllerError(7, 'BLOCKED', 'Pending Gate handoff has no current routed Run/task authority');
      const registry = await GateRegistry.fromYaml(resolve(repositoryRoot, routed.registryPath));
      const runner = new GateRunner();
      const settlement = await runner.inspectSettlement(this.gateSettlementRequest(repositoryRoot, changeId, taskId, routed, claimed, registry, candidateForRun(events, taskId, claimed.runId)));
      await this.commitGateSettlementHandoff(repositoryRoot, changeId, taskId, routed, claimed, strict.events, settlement);
      strict = await journal.replayStrict();
      handoff = classifyGateHandoffs(strict.events);
      if (handoff.kind !== 'clean') throw new ControllerError(7, 'BLOCKED', handoff.kind === 'invalid' ? handoff.reason : 'Gate settlement handoff remained pending after Controller mapping');
      await this.verifyGateHandoffHistory(repositoryRoot, changeId, strict.events, handoff, strict.discardedIncompleteTail);
    }
    const logical = projectJournalEvents(strict.events).events;
    const lifecycleBeforeRecovery = reduceJournal(logical);
    const gateAttempts = new Map<string, Set<string>>();
    for (const event of strict.events.filter((candidate) => candidate.type.startsWith('gate.attempt.'))) {
      const attemptId = record(event.payload).attemptId;
      if (typeof attemptId !== 'string') continue;
      const phases = gateAttempts.get(attemptId) ?? new Set<string>();
      phases.add(event.type);
      gateAttempts.set(attemptId, phases);
    }
    const unsettledGate = [...gateAttempts.values()].some((phases) => phases.has('gate.attempt.prepared') && !phases.has('gate.attempt.settled') && !phases.has('gate.attempt.aborted') && !phases.has('gate.attempt.denied'));
    if (unsettledGate && !Object.values(lifecycleBeforeRecovery.runs).some((run) => run.state === 'unknown')
      && !this.onlyCommittedSafeUnreleasedAbandonments(strict.events, logical, lifecycleBeforeRecovery)) throw new ControllerError(7, 'BLOCKED', 'Gate lifecycle recovery is not repaired by resume; use the reviewed Gate recovery/reconciliation seam');
    if (strict.discardedIncompleteTail) {
      const lifecycle = reduceJournal(strict.events);
      const activeRun = Object.values(lifecycle.runs).some((run) => run.state === 'running' || run.state === 'unknown');
      const activeTask = Object.values(lifecycle.tasks).some((task) => task.state === 'implementing' || task.state === 'verifying');
      if (activeRun && activeTask) throw new ControllerError(7, 'BLOCKED', 'Gate lifecycle recovery is not repaired by resume; use the reviewed Gate recovery/reconciliation seam');
    }
    const recovery = await recoverJournal(journal);
    if (!recovery.ok) throw new ControllerError(7, 'BLOCKED', recovery.detail, { changeState: recovery.changeState, taskState: recovery.taskState });
    let recoveredEvents = recovery.replay.events;
    if (projectJournalEvents(recoveredEvents).pending) {
      await recoverControllerBatch(repositoryRoot, changeId, journal, recoveredEvents);
      recoveredEvents = (await journal.replayStrict()).events;
    }
    await this.readEvents(repositoryRoot, changeId);
    const snapshot = await recoverSnapshot(paths.snapshot, journal);
    await writeSnapshotStrict(paths.snapshot, journal);
    const recoveredLogical = projectJournalEvents(recoveredEvents).events;
    return result('RESUMED', { ...(await this.state(repositoryRoot, changeId, recoveredLogical)), discardedIncompleteTail: recovery.replay.discardedIncompleteTail, snapshotReplayed: snapshot.replayed });
  }

  async doctor(options: CommandOptions): Promise<CommandResult> {
    const repositoryRoot = await realpath(this.repository(options));
    const checks: Array<{ name: string; ok: boolean | null; detail: string }> = [];
    const major = Number(process.versions.node.split('.')[0]);
    checks.push({ name: 'node', ok: major >= 20, detail: `observed ${process.version}; requires >=20` });
    try { await loadSchema('change'); checks.push({ name: 'schemas', ok: true, detail: `loaded from ${relative(moduleRepositoryRoot, join(moduleRepositoryRoot, 'schemas')) || 'schemas'}` }); }
    catch (error: unknown) { checks.push({ name: 'schemas', ok: false, detail: error instanceof Error ? error.message : String(error) }); }
    const registryPath = resolve(repositoryRoot, typeof options.registry === 'string' ? options.registry : 'core/gates/default.yaml');
    try { await GateRegistry.fromYaml(registryPath); checks.push({ name: 'gate-registry', ok: true, detail: registryPath }); }
    catch (error: unknown) { checks.push({ name: 'gate-registry', ok: false, detail: error instanceof Error ? error.message : String(error) }); }
    checks.push({ name: 'client-loading', ok: null, detail: 'not run: real Claude/Cursor/Codex client loading was not exercised' });
    checks.push({ name: 'node20-runtime', ok: major === 20 ? true : null, detail: major === 20 ? 'observed Node 20' : `not run: Node 20 runtime was not executed (host ${process.version}); compatibility is static/package-contract evidence` });
    const ok = checks.filter((check) => ['node', 'schemas', 'gate-registry'].includes(check.name)).every((check) => check.ok === true);
    if (!ok) throw new ControllerError(8, 'PREREQUISITE_FAILED', 'One or more required local prerequisites failed', { checks, hostNode: process.version });
    return result('DOCTOR_OK', { checks, hostNode: process.version, requiredNode: '>=20', realClientLoadingTested: false, node20RuntimeTested: major === 20 });
  }
}
