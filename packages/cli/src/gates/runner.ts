import { execa } from 'execa';
import { mkdir, realpath } from 'node:fs/promises';
import { dirname, relative, sep } from 'node:path';
import { canonicalTreeHash } from '../repository/tree-hash.js';
import { runtimePaths } from '../runtime/paths.js';
import { validateReceipt } from '../schema/validate.js';
import { environmentPolicyFingerprint, minimalEnvironment } from '../security/environment.js';
import { normalizeRepositoryPath, repositoryPath, writeSurface } from '../security/paths.js';
import { hasSecretShape, redact } from '../security/redact.js';
import { reduceRunOutcome, type RunOutcome } from '../state/transition.js';
import { Journal, JournalTailMismatchError } from '../state/journal.js';
import type { ChangeState, JournalEvent } from '../state/types.js';
import { evidenceDirectory, evidenceFilePath, loadGateEvidence, publishGateEvidence, reserveGateEvidence, type EvidenceReservation, type GateEvidence, type PublishedGateEvidence } from './evidence.js';
import { gateLauncherSource } from './launcher.js';
import { fingerprint, gateDefinitionFingerprint, GateRegistry, type GateDefinition } from './registry.js';

export class GateRunError extends Error {
  constructor(readonly code: 'STALE_TREE' | 'STALE_GATE' | 'APPROVAL_REQUIRED' | 'APPROVAL_MISMATCH' | 'PATH_ESCAPE' | 'GATE_INVALID' | 'NETWORK_ISOLATION_UNAVAILABLE' | 'PROCESS_CONTAINMENT_UNAVAILABLE' | 'RECOVERY_INVALID' | 'RECOVERY_IN_PROGRESS', message: string) { super(message); }
}

export class GateRunIndeterminateError extends Error {
  readonly code = 'GATE_RECORD_INDETERMINATE' as const;
  readonly outcome = reduceRunOutcome('unknown', { priorChangeState: 'executing' });
  constructor(message: string) { super(message); }
}

export interface NetworkIsolation {
  prepare(command: string, args: readonly string[]): Promise<{ command: string; args: string[]; fingerprint: string }>;
}

/** macOS's sandbox-exec is used only after a real probe; lack of enforcement fails closed. */
class SystemNetworkIsolation implements NetworkIsolation {
  async prepare(command: string, args: readonly string[]): Promise<{ command: string; args: string[]; fingerprint: string }> {
    // This is audit metadata for an already-enforced parent seatbelt, not a
    // credential and not an environment value passed to the gate process.
    if (process.env.CODEX_SANDBOX === 'seatbelt' && process.env.CODEX_SANDBOX_NETWORK_DISABLED === '1') {
      return { command, args: [...args], fingerprint: fingerprint({ parentCapability: 'codex-seatbelt-network-disabled' }) };
    }
    if (process.platform !== 'darwin') throw new GateRunError('NETWORK_ISOLATION_UNAVAILABLE', 'No enforceable network-deny sandbox is available on this platform');
    const profile = '(version 1) (allow default) (deny network*)';
    try {
      const probe = await execa('/usr/bin/sandbox-exec', ['-p', profile, '--', '/usr/bin/true'], { shell: false, reject: false, timeout: 1_000, extendEnv: false, env: minimalEnvironment([]) });
      if (probe.exitCode !== 0) throw new Error(probe.stderr || `sandbox probe exited ${probe.exitCode}`);
    } catch (error: unknown) {
      if (error instanceof GateRunError) throw error;
      throw new GateRunError('NETWORK_ISOLATION_UNAVAILABLE', `macOS network sandbox cannot be applied: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { command: '/usr/bin/sandbox-exec', args: ['-p', profile, '--', command, ...args], fingerprint: fingerprint({ sandbox: 'sandbox-exec', profile }) };
  }
}

interface GateJournal {
  append(input: Parameters<Journal['append']>[0]): ReturnType<Journal['append']>;
  appendIfTail(input: Parameters<Journal['append']>[0], expectedEventHash: string): ReturnType<Journal['appendIfTail']>;
  replay(): ReturnType<Journal['replay']>;
  replayStrict(): ReturnType<Journal['replayStrict']>;
}

interface GateAttemptBoundary { attemptId: string; event: JournalEvent; }
export interface GateAttemptLifecycle {
  afterPrepared?(boundary: GateAttemptBoundary): void | Promise<void>;
  afterStarted?(boundary: GateAttemptBoundary): void | Promise<void>;
  afterAborted?(boundary: GateAttemptBoundary): void | Promise<void>;
  afterProcessExit?(attemptId: string): void | Promise<void>;
  afterEvidencePublished?(attemptId: string): void | Promise<void>;
}

export interface GateProcessIdentity { pid: number; processGroupId: number; commandFingerprint: string; reviewedCommandFingerprint: string; observedAt: string; }
export interface GateLauncherOwnership {
  version: 3;
  attemptId: string;
  runId: string;
  changeId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  gateId: string;
  repositoryIdentity: string;
  process: GateProcessIdentity;
}
export interface GateRunnerDependencies {
  clock?: () => Date;
  networkIsolation?: NetworkIsolation;
  journalFactory?: (path: string) => GateJournal;
  attemptLifecycle?: GateAttemptLifecycle;
  processLiveness?: (identity: GateLauncherOwnership) => boolean | Promise<boolean>;
  processContainment?: (identity: GateLauncherOwnership) => void | Promise<void>;
  platform?: NodeJS.Platform;
}

export interface GateRunRequest {
  repositoryRoot: string;
  registry: GateRegistry;
  gateId: string;
  expectedInputTreeHash: string;
  expectedGateDefinitionHash: string;
  runId: string;
  changeId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  maxOutputBytes: number;
  approvalReceipt?: unknown;
}

/**
 * Read-only admission context for a reviewed gate.  It deliberately contains
 * policy fingerprints and paths, never approval receipts or environment
 * values.
 */
export interface GatePreflight {
  canonicalRoot: string;
  repositoryIdentity: string;
  gate: GateDefinition;
  gateDefinitionHash: string;
  cwd: string;
  declaredWritePaths: string[];
  inputTreeHash: string;
  execution: { command: string; args: string[]; fingerprint: string };
}

export type GateRunStatus = 'succeeded' | 'failed' | 'timed-out' | 'output-capped' | 'undeclared-writes';
export type GateRunResult = { status: GateRunStatus; exitCode: number | null; evidence: GateEvidence; undeclaredWrites?: string[]; outcome: RunOutcome } | { status: 'evidence-blocked-secret' | 'unknown'; exitCode: number | null; outcome: RunOutcome } | { status: 'approval-expired'; exitCode: null; outcome: RunOutcome };
export interface GateRecoveryRequest { previousRunId: string; request: GateRunRequest; }
export type GateRecoveryResult = { restarted: true; result: GateRunResult } | { restarted: false; outcome: RunOutcome };
export type GateSettlementStatus = GateRunStatus | 'unknown' | 'approval-expired';
export interface GateSettlementInspectionRequest extends Omit<GateRunRequest, 'maxOutputBytes' | 'approvalReceipt'> {}
export interface VerifiedGateSettlement {
  attemptId: string;
  operationFingerprint: string;
  inputTreeHash: string;
  status: GateSettlementStatus;
  exitCode: number | null;
  outcome: RunOutcome;
  evidence?: PublishedGateEvidence;
  evidenceRef?: string;
  phaseEventHashes: string[];
}
export interface VerifiedGateIndeterminateAttempt {
  attemptId: string;
  operationFingerprint: string;
  inputTreeHash: string;
  phaseEventHashes: string[];
}

interface GateAttemptIdentity {
  version: 3;
  attemptId: string;
  runId: string;
  changeId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  gateId: string;
  repositoryIdentity: string;
}

interface GateExecutionPolicy {
  replaySafety: GateDefinition['replaySafety'];
  effectClass: GateDefinition['effectClass'];
  network: GateDefinition['network'];
  argvFingerprint: string;
  cwdFingerprint: string;
  environmentFingerprint: string;
  declaredWritePathsFingerprint: string;
  timeoutSeconds: number;
  maxOutputBytes: number;
}

interface GateAttemptPreparedRecord extends GateAttemptIdentity {
  gateDefinitionHash: string;
  inputTreeHash: string;
  executionFingerprint: string;
  processCommandFingerprint: string;
  launcherCommandFingerprint: string;
  operationFingerprint: string;
  recoveryWriteSurfaceHash: string;
  executionPolicy: GateExecutionPolicy;
}

interface GateAttemptStartedRecord extends GateAttemptIdentity {
  preparedEventHash: string;
  process: GateProcessIdentity;
}

interface GateAttemptReleasedRecord extends GateAttemptIdentity {
  preparedEventHash: string;
  startedEventHash: string;
  processGroupId: number;
}

interface GateAttemptAbortedRecord extends GateAttemptIdentity {
  preparedEventHash: string;
  priorPhase: 'prepared' | 'started' | 'released';
  priorEventHash: string;
  reason: 'recovery-fence' | 'controller-containment';
  processGroupId?: number;
  successorRunId: string;
  successorLeaseGeneration: number;
  successorAttemptId: string;
}

interface GateAttemptDeniedRecord extends GateAttemptIdentity {
  preparedEventHash: string;
  startedEventHash: string;
  reason: 'approval-expired';
  outcome: RunOutcome;
}

interface GateAttemptSettledRecord extends GateAttemptIdentity {
  preparedEventHash: string;
  startedEventHash: string;
  releasedEventHash: string;
  gateDefinitionHash: string;
  inputTreeHash: string;
  status: GateRunStatus | 'unknown';
  exitCode: number | null;
  outcome: RunOutcome;
  evidence?: { contentHash: string; pathHash: string };
}

interface VerifiedPreparedAttempt {
  replay: { events: JournalEvent[]; discardedIncompleteTail: boolean };
  canonicalRoot: string;
  repositoryIdentity: string;
  gate: GateDefinition;
  preparedEvent: JournalEvent;
  prepared: GateAttemptPreparedRecord;
  scope: (value: unknown) => value is Partial<GateAttemptIdentity>;
}

const hashPattern = /^[a-f0-9]{64}$/;
const gateStatuses = new Set<GateAttemptSettledRecord['status']>(['succeeded', 'failed', 'timed-out', 'output-capped', 'undeclared-writes', 'unknown']);
const runStates = new Set(['succeeded', 'failed', 'timed-out', 'unknown']);
const taskStates = new Set(['verifying', 'remediation', 'blocked']);
const changeStates = new Set(['executing', 'approval-required']);

function attemptIdFor(identity: Omit<GateAttemptIdentity, 'version' | 'attemptId'>): string {
  return fingerprint({
    repositoryIdentity: identity.repositoryIdentity,
    changeId: identity.changeId,
    runId: identity.runId,
    gateId: identity.gateId,
    taskId: identity.taskId,
    taskRevision: identity.taskRevision,
    leaseGeneration: identity.leaseGeneration,
  });
}

function asAttemptIdentity(value: unknown): GateAttemptIdentity | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<GateAttemptIdentity>;
  if (record.version !== 3 || !hashPattern.test(record.attemptId ?? '') || typeof record.runId !== 'string' || record.runId.length === 0 || typeof record.changeId !== 'string' || record.changeId.length === 0 || typeof record.taskId !== 'string' || record.taskId.length === 0 || !Number.isSafeInteger(record.taskRevision) || record.taskRevision! < 1 || !Number.isSafeInteger(record.leaseGeneration) || record.leaseGeneration! < 1 || typeof record.gateId !== 'string' || record.gateId.length === 0 || !hashPattern.test(record.repositoryIdentity ?? '')) return undefined;
  const identity = record as GateAttemptIdentity;
  return identity.attemptId === attemptIdFor(identity) ? identity : undefined;
}

function asPreparedRecord(value: unknown): GateAttemptPreparedRecord | undefined {
  const identity = asAttemptIdentity(value);
  if (!identity) return undefined;
  const record = value as Partial<GateAttemptPreparedRecord>;
  const policy = record.executionPolicy as Partial<GateExecutionPolicy> | undefined;
  if (!hashPattern.test(record.gateDefinitionHash ?? '') || !hashPattern.test(record.inputTreeHash ?? '') || !hashPattern.test(record.executionFingerprint ?? '') || !hashPattern.test(record.processCommandFingerprint ?? '') || !hashPattern.test(record.launcherCommandFingerprint ?? '') || !hashPattern.test(record.operationFingerprint ?? '') || !hashPattern.test(record.recoveryWriteSurfaceHash ?? '') || !policy || !['pure', 'idempotent', 'manual-reconcile'].includes(policy.replaySafety ?? '') || !['local-verification', 'network-read', 'external-write', 'destructive', 'release'].includes(policy.effectClass ?? '') || !['deny', 'approval-required'].includes(policy.network ?? '') || !hashPattern.test(policy.argvFingerprint ?? '') || !hashPattern.test(policy.cwdFingerprint ?? '') || !hashPattern.test(policy.environmentFingerprint ?? '') || !hashPattern.test(policy.declaredWritePathsFingerprint ?? '') || !Number.isFinite(policy.timeoutSeconds) || policy.timeoutSeconds! <= 0 || !Number.isSafeInteger(policy.maxOutputBytes) || policy.maxOutputBytes! < 1) return undefined;
  return record as GateAttemptPreparedRecord;
}

function asStartedRecord(value: unknown): GateAttemptStartedRecord | undefined {
  const identity = asAttemptIdentity(value);
  if (!identity) return undefined;
  const record = value as Partial<GateAttemptStartedRecord>;
  const processIdentity = record.process as Partial<GateProcessIdentity> | undefined;
  if (!hashPattern.test(record.preparedEventHash ?? '') || !processIdentity || !Number.isSafeInteger(processIdentity.pid) || processIdentity.pid! < 1 || !Number.isSafeInteger(processIdentity.processGroupId) || processIdentity.processGroupId !== processIdentity.pid || !hashPattern.test(processIdentity.commandFingerprint ?? '') || !hashPattern.test(processIdentity.reviewedCommandFingerprint ?? '') || typeof processIdentity.observedAt !== 'string' || Number.isNaN(Date.parse(processIdentity.observedAt))) return undefined;
  return record as GateAttemptStartedRecord;
}

function asReleasedRecord(value: unknown): GateAttemptReleasedRecord | undefined {
  const identity = asAttemptIdentity(value);
  if (!identity) return undefined;
  const record = value as Partial<GateAttemptReleasedRecord>;
  if (!hashPattern.test(record.preparedEventHash ?? '') || !hashPattern.test(record.startedEventHash ?? '') || !Number.isSafeInteger(record.processGroupId) || record.processGroupId! < 1) return undefined;
  return record as GateAttemptReleasedRecord;
}

function asAbortedRecord(value: unknown): GateAttemptAbortedRecord | undefined {
  const identity = asAttemptIdentity(value);
  if (!identity) return undefined;
  const record = value as Partial<GateAttemptAbortedRecord>;
  if (!hashPattern.test(record.preparedEventHash ?? '') || !hashPattern.test(record.priorEventHash ?? '') || !['prepared', 'started', 'released'].includes(record.priorPhase ?? '') || !['recovery-fence', 'controller-containment'].includes(record.reason ?? '') || (record.processGroupId !== undefined && (!Number.isSafeInteger(record.processGroupId) || record.processGroupId < 1)) || typeof record.successorRunId !== 'string' || record.successorRunId.length === 0 || !Number.isSafeInteger(record.successorLeaseGeneration) || record.successorLeaseGeneration! <= identity.leaseGeneration || !hashPattern.test(record.successorAttemptId ?? '')) return undefined;
  const expectedSuccessor = attemptIdFor({
    repositoryIdentity: identity.repositoryIdentity,
    changeId: identity.changeId,
    runId: record.successorRunId,
    gateId: identity.gateId,
    taskId: identity.taskId,
    taskRevision: identity.taskRevision,
    leaseGeneration: record.successorLeaseGeneration!,
  });
  return record.successorAttemptId === expectedSuccessor ? record as GateAttemptAbortedRecord : undefined;
}

function asDeniedRecord(value: unknown): GateAttemptDeniedRecord | undefined {
  const identity = asAttemptIdentity(value);
  if (!identity) return undefined;
  const record = value as Partial<GateAttemptDeniedRecord>;
  const outcome = record.outcome as Partial<RunOutcome> | undefined;
  if (!hashPattern.test(record.preparedEventHash ?? '') || !hashPattern.test(record.startedEventHash ?? '') || record.reason !== 'approval-expired'
    || outcome?.runState !== 'cancelled' || outcome.taskState !== 'blocked' || outcome.changeState !== 'approval-required') return undefined;
  return record as GateAttemptDeniedRecord;
}

function asSettledRecord(value: unknown): GateAttemptSettledRecord | undefined {
  const identity = asAttemptIdentity(value);
  if (!identity) return undefined;
  const record = value as Partial<GateAttemptSettledRecord>;
  const outcome = record.outcome as Partial<RunOutcome> | undefined;
  const evidence = record.evidence;
  const validEvidence = evidence === undefined || (typeof evidence === 'object' && evidence !== null && hashPattern.test((evidence as { contentHash?: string }).contentHash ?? '') && hashPattern.test((evidence as { pathHash?: string }).pathHash ?? ''));
  if (!hashPattern.test(record.preparedEventHash ?? '') || !hashPattern.test(record.startedEventHash ?? '') || !hashPattern.test(record.releasedEventHash ?? '') || !hashPattern.test(record.gateDefinitionHash ?? '') || !hashPattern.test(record.inputTreeHash ?? '') || !gateStatuses.has(record.status as GateAttemptSettledRecord['status']) || !(record.exitCode === null || Number.isInteger(record.exitCode)) || !outcome || !runStates.has(outcome.runState ?? '') || !taskStates.has(outcome.taskState ?? '') || !changeStates.has(outcome.changeState ?? '') || !validEvidence) return undefined;
  return record as GateAttemptSettledRecord;
}

const automaticallyRunnable = (gate: GateDefinition) => gate.effectClass === 'local-verification' && gate.network === 'deny';
const automaticWritePath = (path: string) => /(^|\/)(?:\.leo-dev\/runtime|\.cache|cache|tmp|temp|build|dist|coverage)(?:\/|$)/.test(path);
const declared = (path: string, paths: readonly string[]) => paths.some((allowed) => allowed === '.' || path === allowed || path.startsWith(`${allowed}/`));
const changedSurfacePaths = (before: readonly string[], after: readonly string[]) => {
  const oldEntries = new Map(before.map((entry) => [entry.split('\0', 3)[1], entry]));
  const newEntries = new Map(after.map((entry) => [entry.split('\0', 3)[1], entry]));
  return [...new Set([...oldEntries.keys(), ...newEntries.keys()])].filter((path) => oldEntries.get(path) !== newEntries.get(path)).sort();
};

function controllerWriteExclusions(canonicalRoot: string, changeId: string, runId: string, gateId: string): string[] {
  const journal = relative(canonicalRoot, runtimePaths(canonicalRoot, changeId).journal).split(sep).join('/');
  const evidence = evidenceDirectory(changeId, runId, gateId);
  return [journal, evidence, `${evidence}/stdout.log`, `${evidence}/stderr.log`, `${evidence}/evidence.json`];
}

interface ActiveLauncherEntry {
  ownership: GateLauncherOwnership;
  handle: PromiseLike<unknown>;
}

type ProcessGroupSignal = (pid: number, signal: NodeJS.Signals | 0) => void;

function launcherOwnershipFingerprint(ownership: GateLauncherOwnership): string {
  return fingerprint({
    version: ownership.version,
    attemptId: ownership.attemptId,
    repositoryIdentity: ownership.repositoryIdentity,
    changeId: ownership.changeId,
    runId: ownership.runId,
    gateId: ownership.gateId,
    taskId: ownership.taskId,
    taskRevision: ownership.taskRevision,
    leaseGeneration: ownership.leaseGeneration,
    process: ownership.process,
  });
}

export class GateLauncherOwnershipRegistry {
  readonly #entries = new Map<number, ActiveLauncherEntry>();

  register(ownership: GateLauncherOwnership, handle: PromiseLike<unknown>): void {
    const processGroupId = ownership.process.processGroupId;
    const existing = this.#entries.get(processGroupId);
    if (existing) {
      if (launcherOwnershipFingerprint(existing.ownership) === launcherOwnershipFingerprint(ownership) && existing.handle === handle) return;
      throw new Error('process group is already bound to a different gate attempt or subprocess handle');
    }
    this.#entries.set(processGroupId, { ownership, handle });
  }

  lookup(ownership: GateLauncherOwnership): { state: 'missing' } | { state: 'collision' } | { state: 'owned'; entry: ActiveLauncherEntry } {
    const entry = this.#entries.get(ownership.process.processGroupId);
    if (!entry) return { state: 'missing' };
    return launcherOwnershipFingerprint(entry.ownership) === launcherOwnershipFingerprint(ownership) ? { state: 'owned', entry } : { state: 'collision' };
  }

  delete(ownership: GateLauncherOwnership, handle: PromiseLike<unknown>): void {
    const owned = this.lookup(ownership);
    if (owned.state === 'owned' && owned.entry.handle === handle) this.#entries.delete(ownership.process.processGroupId);
  }
}

const activeLaunchers = new GateLauncherOwnershipRegistry();
const signalProcessGroup: ProcessGroupSignal = (pid, signal) => { process.kill(pid, signal); };

export async function defaultLauncherLiveness(identity: GateLauncherOwnership, registry = activeLaunchers, signalGroup: ProcessGroupSignal = signalProcessGroup): Promise<boolean> {
  if (process.platform === 'win32') throw new Error('POSIX process-group liveness is unavailable');
  const ownership = registry.lookup(identity);
  if (ownership.state === 'collision') throw new Error('live process group is owned by a different gate attempt');
  try {
    signalGroup(-identity.process.processGroupId, 0);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
  // A live group is safe to signal only while this controller still owns the
  // exact launcher handle. Cross-controller PID/PGID reuse cannot be ruled out
  // from signal 0 alone, so recovery blocks instead of falling back to PID.
  if (ownership.state !== 'owned') throw new Error('live process group identity is not owned by this controller');
  return true;
}

async function waitForGroupExit(processGroupId: number, signalGroup: ProcessGroupSignal = signalProcessGroup): Promise<boolean> {
  for (let turn = 0; turn < 200; turn += 1) {
    try { signalGroup(-processGroupId, 0); }
    catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') return true;
      // EPERM and every other result remain unconfirmed. Keep the bounded
      // probe active because an orphaned zombie may shortly be reaped, but
      // never convert a non-ESRCH result into success.
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

async function containProcessGroup(identity: GateLauncherOwnership, subprocess?: PromiseLike<unknown>, registry = activeLaunchers, signalGroup: ProcessGroupSignal = signalProcessGroup): Promise<void> {
  if (process.platform === 'win32') throw new GateRunIndeterminateError('POSIX process-group containment is unavailable on win32');
  const ownership = registry.lookup(identity);
  if (ownership.state === 'collision') throw new Error('live process group is owned by a different gate attempt');
  const ownedLauncher = subprocess ?? (ownership.state === 'owned' ? ownership.entry.handle : undefined);
  const processGroupId = identity.process.processGroupId;
  if (ownership.state === 'missing' && ownedLauncher) {
    try { signalGroup(-processGroupId, 0); }
    catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
        try { await ownedLauncher; } catch { /* prior exact containment is expected */ }
        return;
      }
      throw error;
    }
  }
  if (!ownedLauncher || ownership.state !== 'owned' || ownership.entry.handle !== ownedLauncher) throw new Error('live process group identity is not owned by this controller');
  try { signalGroup(-processGroupId, 'SIGKILL'); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw new GateRunIndeterminateError(`Gate process group could not be terminated: ${error instanceof Error ? error.message : String(error)}`);
  }
  try { await ownedLauncher; } catch { /* termination is expected */ }
  if (!(await waitForGroupExit(processGroupId, signalGroup))) throw new GateRunIndeterminateError('Gate process-group termination could not be confirmed');
  registry.delete(identity, ownedLauncher);
}

export async function defaultLauncherContainment(identity: GateLauncherOwnership, registry = activeLaunchers, signalGroup: ProcessGroupSignal = signalProcessGroup): Promise<void> {
  await containProcessGroup(identity, undefined, registry, signalGroup);
}

function matchesAttemptScope(record: Partial<GateAttemptIdentity>, repositoryIdentity: string, previousRunId: string, request: Pick<GateRunRequest, 'changeId' | 'gateId' | 'taskId' | 'taskRevision'>): boolean {
  return record.repositoryIdentity === repositoryIdentity
    && record.changeId === request.changeId
    && record.runId === previousRunId
    && record.gateId === request.gateId
    && record.taskId === request.taskId
    && record.taskRevision === request.taskRevision;
}

function eventMatchesIdentity(event: JournalEvent, record: GateAttemptIdentity): boolean {
  return event.changeId === record.changeId
    && event.taskId === record.taskId
    && event.taskRevision === record.taskRevision
    && event.leaseGeneration === record.leaseGeneration;
}

export function approvalFingerprintFields(request: GateRunRequest, gate: GateDefinition, cwd: string): Record<string, string> {
  return {
    decisionFingerprint: fingerprint({ operationKind: 'gate-run', changeId: request.changeId, taskId: request.taskId, taskRevision: request.taskRevision, leaseGeneration: request.leaseGeneration, gateId: gate.id }),
    gateDefinitionFingerprint: gateDefinitionFingerprint(gate), argvFingerprint: fingerprint(gate.argv), cwdFingerprint: fingerprint(cwd),
    environmentFingerprint: environmentPolicyFingerprint(gate.environmentAllowlist), inputFingerprint: request.expectedInputTreeHash,
  };
}

interface GateOutputStreamProof { observedBytes: number; forwardedBytes: number; omittedPrefix: Buffer }

function expectedUtf8SequenceLength(lead: number): number {
  return lead >= 0xc2 && lead <= 0xdf ? 2 : lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 0;
}

function parseOutputStreamProof(value: unknown): GateOutputStreamProof | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as { observedBytes?: unknown; forwardedBytes?: unknown; omittedPrefix?: unknown };
  if (!Number.isSafeInteger(record.observedBytes) || (record.observedBytes as number) < 0
    || !Number.isSafeInteger(record.forwardedBytes) || (record.forwardedBytes as number) < 0
    || (record.forwardedBytes as number) > (record.observedBytes as number)
    || !Array.isArray(record.omittedPrefix) || record.omittedPrefix.length > 3
    || !record.omittedPrefix.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 0xff)) return undefined;
  const omittedBytes = (record.observedBytes as number) - (record.forwardedBytes as number);
  if (record.omittedPrefix.length !== Math.min(3, omittedBytes)) return undefined;
  return { observedBytes: record.observedBytes as number, forwardedBytes: record.forwardedBytes as number, omittedPrefix: Buffer.from(record.omittedPrefix) };
}

function incompleteUtf8SuffixLength(value: Buffer): number {
  for (let start = Math.max(0, value.byteLength - 3); start < value.byteLength; start += 1) {
    const lead = value[start]!;
    const expected = expectedUtf8SequenceLength(lead);
    const available = value.byteLength - start;
    if (expected === 0 || available >= expected) continue;
    let validPrefix = true;
    for (let offset = 1; offset < available; offset += 1) {
      const byte = value[start + offset]!;
      if (byte < 0x80 || byte > 0xbf
        || (offset === 1 && lead === 0xe0 && byte < 0xa0)
        || (offset === 1 && lead === 0xed && byte > 0x9f)
        || (offset === 1 && lead === 0xf0 && byte < 0x90)
        || (offset === 1 && lead === 0xf4 && byte > 0x8f)) {
        validPrefix = false;
        break;
      }
    }
    if (validPrefix) return available;
  }
  return 0;
}

function decodeGateOutput(value: Buffer, proof: GateOutputStreamProof): { valid: true; text: string } | { valid: false } {
  const decodeStrict = (bytes: Buffer): string => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  try { return { valid: true, text: decodeStrict(value) }; }
  catch {
    const incompleteSuffix = incompleteUtf8SuffixLength(value);
    if (incompleteSuffix === 0 || proof.observedBytes === proof.forwardedBytes) return { valid: false };
    const suffixStart = value.byteLength - incompleteSuffix;
    const suffix = value.subarray(suffixStart);
    const requiredContinuationBytes = expectedUtf8SequenceLength(suffix[0]!) - suffix.byteLength;
    if (requiredContinuationBytes < 1 || proof.omittedPrefix.byteLength < requiredContinuationBytes) return { valid: false };
    try {
      const scalar = decodeStrict(Buffer.concat([suffix, proof.omittedPrefix.subarray(0, requiredContinuationBytes)]));
      if ([...scalar].length !== 1) return { valid: false };
      return { valid: true, text: decodeStrict(value.subarray(0, suffixStart)) };
    }
    catch { return { valid: false }; }
  }
}

function truncateUtf8(text: string, limit: number): string {
  if (limit <= 0 || text.length === 0) return '';
  const target = Buffer.allocUnsafe(Math.min(limit, Buffer.byteLength(text)));
  const { written } = new TextEncoder().encodeInto(text, target);
  return target.subarray(0, written).toString('utf8');
}

function boundedLogs(stdout: string, stderr: string, limit: number): { stdout: string; stderr: string } {
  const boundedStdout = truncateUtf8(stdout, limit);
  const remaining = Math.max(0, limit - Buffer.byteLength(boundedStdout));
  return { stdout: boundedStdout, stderr: truncateUtf8(stderr, remaining) };
}

function isJournalTailMismatch(error: unknown): boolean {
  const cause = (error as { cause?: unknown } | null)?.cause;
  return cause instanceof JournalTailMismatchError || (cause as { code?: unknown } | null)?.code === 'JOURNAL_TAIL_MISMATCH';
}

export class GateRunner {
  private readonly clock: () => Date;
  private readonly networkIsolation: NetworkIsolation;
  private readonly journalFactory: (path: string) => GateJournal;
  private readonly attemptLifecycle: GateAttemptLifecycle;
  private readonly processLiveness: (identity: GateLauncherOwnership) => boolean | Promise<boolean>;
  private readonly processContainment: (identity: GateLauncherOwnership) => void | Promise<void>;
  private readonly platform: NodeJS.Platform;

  constructor(dependencies: GateRunnerDependencies = {}) {
    this.clock = dependencies.clock ?? (() => new Date());
    this.networkIsolation = dependencies.networkIsolation ?? new SystemNetworkIsolation();
    this.journalFactory = dependencies.journalFactory ?? ((path) => new Journal(path));
    this.attemptLifecycle = dependencies.attemptLifecycle ?? {};
    this.processLiveness = dependencies.processLiveness ?? defaultLauncherLiveness;
    this.processContainment = dependencies.processContainment ?? defaultLauncherContainment;
    this.platform = dependencies.platform ?? process.platform;
  }

  private now(): Date {
    const now = this.clock();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new GateRunError('GATE_INVALID', 'Trusted clock returned an invalid date');
    return now;
  }

  private verifyApproval(request: GateRunRequest, gate: GateDefinition, cwd: string, now: Date): void {
    if (automaticallyRunnable(gate)) return;
    if (!request.approvalReceipt) throw new GateRunError('APPROVAL_REQUIRED', `Gate ${gate.id} requires an approval receipt`);
    const receipt = validateReceipt('approval', request.approvalReceipt, now);
    if (!receipt.ok) throw new GateRunError('APPROVAL_MISMATCH', receipt.details.join('; '));
    const value = receipt.value as Record<string, unknown>;
    const grantedAt = typeof value.grantedAt === 'string' ? Date.parse(value.grantedAt) : Number.NaN;
    if (!Number.isFinite(grantedAt) || grantedAt > now.getTime()) throw new GateRunError('APPROVAL_MISMATCH', 'Approval grant is in the future');
    const expected = approvalFingerprintFields(request, gate, cwd);
    const mismatches = Object.entries(expected).filter(([key, expectedValue]) => value[key] !== expectedValue).map(([key]) => key);
    const matches = value.decision === 'grant' && value.changeId === request.changeId && value.taskId === request.taskId && value.scope === 'gate' && value.operationKind === 'gate-run' && mismatches.length === 0;
    if (!matches) throw new GateRunError('APPROVAL_MISMATCH', `Approval receipt does not exactly authorize gate ${gate.id}${mismatches.length ? ` (${mismatches.join(', ')})` : ''}`);
  }

  /** Validates a run without creating controller artifacts or starting the gate. */
  async preflight(request: GateRunRequest): Promise<GatePreflight> {
    if (this.platform === 'win32') throw new GateRunError('PROCESS_CONTAINMENT_UNAVAILABLE', 'Reviewed gates require POSIX process-group containment; win32 fails closed');
    const gate = request.registry.get(request.gateId);
    if (!Array.isArray(gate.argv) || gate.argv.length === 0 || gate.argv.some((item) => typeof item !== 'string')) throw new GateRunError('GATE_INVALID', 'Gate argv must be an array of strings');
    if (!Number.isInteger(request.maxOutputBytes) || request.maxOutputBytes < 1) throw new GateRunError('GATE_INVALID', 'maxOutputBytes must be a positive integer');
    const canonicalRoot = await realpath(request.repositoryRoot);
    const repositoryIdentity = fingerprint({ canonicalRepositoryRoot: canonicalRoot });
    const gateDefinitionHash = gateDefinitionFingerprint(gate);
    const normalizedCwd = normalizeRepositoryPath(gate.cwd);
    const declaredWritePaths = gate.declaredWritePaths.map(normalizeRepositoryPath);
    let cwd: string;
    try {
      cwd = await repositoryPath(canonicalRoot, normalizedCwd, true);
      for (const path of declaredWritePaths) await repositoryPath(canonicalRoot, path);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'PATH_ESCAPE') throw error;
      throw new GateRunError('PATH_ESCAPE', error instanceof Error ? error.message : 'Repository path validation failed');
    }
    if (automaticallyRunnable(gate) && declaredWritePaths.some((path) => !automaticWritePath(path))) throw new GateRunError('GATE_INVALID', 'Automatic gates may write only declared temporary, cache, build, or runtime paths');
    const beforeTree = await canonicalTreeHash(canonicalRoot);
    if (beforeTree.hash !== request.expectedInputTreeHash) throw new GateRunError('STALE_TREE', 'Expected input tree hash is stale');
    if (gateDefinitionHash !== request.expectedGateDefinitionHash) throw new GateRunError('STALE_GATE', 'Expected gate definition hash is stale');
    this.verifyApproval(request, gate, cwd, this.now());
    let execution = { command: gate.argv[0], args: gate.argv.slice(1), fingerprint: fingerprint({ argv: gate.argv, sandbox: 'none' }) };
    if (gate.network === 'deny') execution = await this.networkIsolation.prepare(gate.argv[0], gate.argv.slice(1));
    return { canonicalRoot, repositoryIdentity, gate, gateDefinitionHash, cwd, declaredWritePaths, inputTreeHash: beforeTree.hash, execution };
  }

  private async appendAttempt(
    canonicalRoot: string,
    type: 'gate.attempt.prepared' | 'gate.attempt.started' | 'gate.attempt.released' | 'gate.attempt.settled' | 'gate.attempt.aborted' | 'gate.attempt.denied',
    record: GateAttemptPreparedRecord | GateAttemptStartedRecord | GateAttemptReleasedRecord | GateAttemptSettledRecord | GateAttemptAbortedRecord | GateAttemptDeniedRecord,
    expectedEventHash?: string,
  ): Promise<JournalEvent> {
    try {
      const journal = this.journalFactory(runtimePaths(canonicalRoot, record.changeId).journal);
      const input = {
        changeId: record.changeId,
        taskId: record.taskId,
        taskRevision: record.taskRevision,
        leaseGeneration: record.leaseGeneration,
        type,
        payload: record,
      };
      return expectedEventHash === undefined ? await journal.append(input) : await journal.appendIfTail(input, expectedEventHash);
    } catch (error: unknown) {
      const indeterminate = new GateRunIndeterminateError(`Gate ${type.slice('gate.attempt.'.length)} record could not be persisted: ${error instanceof Error ? error.message : String(error)}`) as GateRunIndeterminateError & { cause?: unknown };
      indeterminate.cause = error;
      throw indeterminate;
    }
  }

  /**
   * Verifies a durable terminal attempt without starting or recovering a Gate.
   * Controller recovery consumes only this fully bound view of the raw phases.
   */
  async inspectSettlement(request: GateSettlementInspectionRequest): Promise<VerifiedGateSettlement> {
    return this.inspectSettlementJournal(request, false);
  }

  /**
   * Dry recovery inspection for a hash-verified journal prefix followed by one
   * incomplete frame. The incomplete frame is never treated as a Gate claim.
   */
  async inspectSettlementBeforeIncompleteTail(request: GateSettlementInspectionRequest): Promise<VerifiedGateSettlement> {
    return this.inspectSettlementJournal(request, true);
  }

  /**
   * Verifies the durable non-terminal Gate prefix used by Controller's
   * thrown-indeterminate mapping. No process is started or recovered.
   */
  async inspectIndeterminateAttempt(request: GateSettlementInspectionRequest, expectedPhaseEventHashes: readonly string[], allowIncompleteTail = false): Promise<VerifiedGateIndeterminateAttempt> {
    const inspected = await this.inspectPreparedAttempt(request, allowIncompleteTail);
    const { replay, preparedEvent, prepared, scope } = inspected;
    const phaseTypes = new Set(['gate.attempt.started', 'gate.attempt.released', 'gate.attempt.settled', 'gate.attempt.aborted', 'gate.attempt.denied']);
    const claims = replay.events.filter((event) => phaseTypes.has(event.type) && scope(event.payload));
    const one = (type: string) => {
      const values = claims.filter((event) => event.type === type);
      if (values.length > 1) throw new GateRunError('RECOVERY_INVALID', `The current Gate contains duplicate ${type} claims`);
      return values[0];
    };
    const startedEvent = one('gate.attempt.started');
    const releasedEvent = one('gate.attempt.released');
    if (one('gate.attempt.settled') || one('gate.attempt.aborted') || one('gate.attempt.denied')) {
      throw new GateRunError('RECOVERY_INVALID', 'The indeterminate Gate attempt has a terminal phase claim');
    }
    const started = startedEvent ? asStartedRecord(startedEvent.payload) : undefined;
    const released = releasedEvent ? asReleasedRecord(releasedEvent.payload) : undefined;
    if (startedEvent && (!started || started.attemptId !== prepared.attemptId || !eventMatchesIdentity(startedEvent, started)
      || startedEvent.previousEventHash !== preparedEvent.eventHash || started.preparedEventHash !== preparedEvent.eventHash
      || started.process.commandFingerprint !== prepared.launcherCommandFingerprint || started.process.reviewedCommandFingerprint !== prepared.processCommandFingerprint)) {
      throw new GateRunError('RECOVERY_INVALID', 'The indeterminate started attempt is malformed or unlinked');
    }
    if (releasedEvent && (!released || !startedEvent || !started || released.attemptId !== prepared.attemptId
      || !eventMatchesIdentity(releasedEvent, released) || releasedEvent.previousEventHash !== startedEvent.eventHash
      || released.preparedEventHash !== preparedEvent.eventHash || released.startedEventHash !== startedEvent.eventHash
      || released.processGroupId !== started.process.processGroupId)) {
      throw new GateRunError('RECOVERY_INVALID', 'The indeterminate release attempt is malformed or unlinked');
    }
    const phaseEventHashes = [preparedEvent.eventHash, ...(startedEvent ? [startedEvent.eventHash] : []), ...(releasedEvent ? [releasedEvent.eventHash] : [])];
    if (fingerprint(phaseEventHashes) !== fingerprint(expectedPhaseEventHashes)) {
      throw new GateRunError('RECOVERY_INVALID', 'The indeterminate Gate context does not exactly bind its durable phase prefix');
    }
    return { attemptId: prepared.attemptId, operationFingerprint: prepared.operationFingerprint, inputTreeHash: prepared.inputTreeHash, phaseEventHashes };
  }

  private async inspectPreparedAttempt(request: GateSettlementInspectionRequest, allowIncompleteTail: boolean): Promise<VerifiedPreparedAttempt> {
    const canonicalRoot = await realpath(request.repositoryRoot);
    const repositoryIdentity = fingerprint({ canonicalRepositoryRoot: canonicalRoot });
    const gate = request.registry.get(request.gateId);
    const gateDefinitionHash = gateDefinitionFingerprint(gate);
    if (gateDefinitionHash !== request.expectedGateDefinitionHash) throw new GateRunError('RECOVERY_INVALID', 'The current reviewed gate definition is stale');
    const cwd = await repositoryPath(canonicalRoot, normalizeRepositoryPath(gate.cwd), true);
    const replay = await this.journalFactory(runtimePaths(canonicalRoot, request.changeId).journal).replayStrict();
    if (replay.discardedIncompleteTail && !allowIncompleteTail) throw new GateRunError('RECOVERY_INVALID', 'The gate journal has an incomplete tail');
    const scope = (value: unknown): value is Partial<GateAttemptIdentity> => !!value && typeof value === 'object'
      && matchesAttemptScope(value as Partial<GateAttemptIdentity>, repositoryIdentity, request.runId, request)
      && (value as Partial<GateAttemptIdentity>).leaseGeneration === request.leaseGeneration;
    const preparedEvents = replay.events.filter((event) => event.type === 'gate.attempt.prepared' && scope(event.payload));
    if (preparedEvents.length !== 1) throw new GateRunError('RECOVERY_INVALID', 'The current Gate has no unique prepared attempt');
    const preparedEvent = preparedEvents[0]!;
    const prepared = asPreparedRecord(preparedEvent.payload);
    if (!prepared || !eventMatchesIdentity(preparedEvent, prepared)) throw new GateRunError('RECOVERY_INVALID', 'The current prepared attempt is malformed');
    if (prepared.taskRevision !== request.taskRevision || prepared.inputTreeHash !== request.expectedInputTreeHash || prepared.gateDefinitionHash !== gateDefinitionHash) throw new GateRunError('RECOVERY_INVALID', 'The current attempt does not match the Run/task/lease/Gate inputs');
    const expectedPolicy: GateExecutionPolicy = {
      replaySafety: gate.replaySafety,
      effectClass: gate.effectClass,
      network: gate.network,
      argvFingerprint: fingerprint(gate.argv),
      cwdFingerprint: fingerprint(cwd),
      environmentFingerprint: environmentPolicyFingerprint(gate.environmentAllowlist),
      declaredWritePathsFingerprint: fingerprint(gate.declaredWritePaths.map(normalizeRepositoryPath)),
      timeoutSeconds: gate.timeoutSeconds,
      maxOutputBytes: prepared.executionPolicy.maxOutputBytes,
    };
    const expectedOperation = fingerprint({ gate: gateDefinitionHash, argv: gate.argv, cwd, environment: expectedPolicy.environmentFingerprint, input: prepared.inputTreeHash, execution: prepared.executionFingerprint });
    const expectedLauncherFingerprint = fingerprint({ command: process.execPath, args: ['--eval', gateLauncherSource] });
    if (fingerprint(prepared.executionPolicy) !== fingerprint(expectedPolicy) || prepared.operationFingerprint !== expectedOperation || prepared.launcherCommandFingerprint !== expectedLauncherFingerprint) throw new GateRunError('RECOVERY_INVALID', 'The prepared execution policy is not bound to the reviewed Gate and launcher');

    return { replay, canonicalRoot, repositoryIdentity, gate, preparedEvent, prepared, scope };
  }

  private async inspectSettlementJournal(request: GateSettlementInspectionRequest, allowIncompleteTail: boolean): Promise<VerifiedGateSettlement> {
    const { replay, canonicalRoot, gate, preparedEvent, prepared, scope } = await this.inspectPreparedAttempt(request, allowIncompleteTail);

    const phaseTypes = new Set(['gate.attempt.started', 'gate.attempt.released', 'gate.attempt.settled', 'gate.attempt.aborted', 'gate.attempt.denied']);
    const claims = replay.events.filter((event) => phaseTypes.has(event.type) && scope(event.payload));
    const one = (type: string) => {
      const values = claims.filter((event) => event.type === type);
      if (values.length > 1) throw new GateRunError('RECOVERY_INVALID', `The current Gate contains duplicate ${type} claims`);
      return values[0];
    };
    const startedEvent = one('gate.attempt.started');
    const releasedEvent = one('gate.attempt.released');
    const settledEvent = one('gate.attempt.settled');
    const abortedEvent = one('gate.attempt.aborted');
    const deniedEvent = one('gate.attempt.denied');
    const started = startedEvent ? asStartedRecord(startedEvent.payload) : undefined;
    const released = releasedEvent ? asReleasedRecord(releasedEvent.payload) : undefined;
    const settled = settledEvent ? asSettledRecord(settledEvent.payload) : undefined;
    const denied = deniedEvent ? asDeniedRecord(deniedEvent.payload) : undefined;
    if (!startedEvent || !started || started.attemptId !== prepared.attemptId || !eventMatchesIdentity(startedEvent, started)
      || startedEvent.previousEventHash !== preparedEvent.eventHash || started.preparedEventHash !== preparedEvent.eventHash
      || started.process.commandFingerprint !== prepared.launcherCommandFingerprint || started.process.reviewedCommandFingerprint !== prepared.processCommandFingerprint) {
      throw new GateRunError('RECOVERY_INVALID', 'The current started attempt is malformed or unlinked');
    }
    if (abortedEvent || (settledEvent && deniedEvent)) throw new GateRunError('RECOVERY_INVALID', 'The current Gate has conflicting terminal phase claims');
    if (deniedEvent) {
      if (!denied || releasedEvent || settledEvent || denied.attemptId !== prepared.attemptId || !eventMatchesIdentity(deniedEvent, denied)
        || deniedEvent.previousEventHash !== startedEvent.eventHash || denied.preparedEventHash !== preparedEvent.eventHash || denied.startedEventHash !== startedEvent.eventHash) {
        throw new GateRunError('RECOVERY_INVALID', 'The current approval denial is malformed or unlinked');
      }
      return { attemptId: prepared.attemptId, operationFingerprint: prepared.operationFingerprint, inputTreeHash: prepared.inputTreeHash, status: 'approval-expired', exitCode: null, outcome: denied.outcome, phaseEventHashes: [preparedEvent.eventHash, startedEvent.eventHash, deniedEvent.eventHash] };
    }
    if (!releasedEvent || !released || !settledEvent || !settled || released.attemptId !== prepared.attemptId || settled.attemptId !== prepared.attemptId
      || !eventMatchesIdentity(releasedEvent, released) || !eventMatchesIdentity(settledEvent, settled)
      || releasedEvent.previousEventHash !== startedEvent.eventHash || released.preparedEventHash !== preparedEvent.eventHash || released.startedEventHash !== startedEvent.eventHash
      || released.processGroupId !== started.process.processGroupId || settledEvent.previousEventHash !== releasedEvent.eventHash
      || settled.preparedEventHash !== preparedEvent.eventHash || settled.startedEventHash !== startedEvent.eventHash || settled.releasedEventHash !== releasedEvent.eventHash) {
      throw new GateRunError('RECOVERY_INVALID', 'The current settlement is malformed or unlinked');
    }
    const phaseEventHashes = [preparedEvent.eventHash, startedEvent.eventHash, releasedEvent.eventHash, settledEvent.eventHash];
    if (settled.status === 'unknown') {
      const expected = reduceRunOutcome('unknown', { priorChangeState: 'executing' });
      if (settled.evidence !== undefined || fingerprint(settled.outcome) !== fingerprint(expected)) throw new GateRunError('RECOVERY_INVALID', 'The unknown settlement is not canonical');
      return { attemptId: prepared.attemptId, operationFingerprint: prepared.operationFingerprint, inputTreeHash: prepared.inputTreeHash, status: 'unknown', exitCode: settled.exitCode, outcome: expected, phaseEventHashes };
    }
    if (!settled.evidence) throw new GateRunError('RECOVERY_INVALID', 'A determinate settlement requires immutable evidence');
    let published: PublishedGateEvidence;
    try { published = await loadGateEvidence(canonicalRoot, request.changeId, request.runId, request.gateId); }
    catch (error: unknown) { throw new GateRunError('RECOVERY_INVALID', `Settlement evidence cannot be verified: ${error instanceof Error ? error.message : String(error)}`); }
    if (published.contentHash !== settled.evidence.contentHash || published.pathHash !== settled.evidence.pathHash) throw new GateRunError('RECOVERY_INVALID', 'Settlement evidence does not match its journaled hashes');
    const evidence = published.evidence;
    const fieldsMatch = evidence.runId === settled.runId && evidence.taskId === settled.taskId && evidence.taskRevision === settled.taskRevision
      && evidence.leaseGeneration === settled.leaseGeneration && evidence.gateId === settled.gateId && evidence.repositoryIdentity === settled.repositoryIdentity
      && evidence.gateDefinitionHash === settled.gateDefinitionHash && evidence.inputTreeHash === settled.inputTreeHash && evidence.exitCode === settled.exitCode
      && evidence.runStatus === settled.status;
    if (!fieldsMatch) throw new GateRunError('RECOVERY_INVALID', 'Settlement evidence does not exactly bind the journaled attempt');
    const effectsAbsent = evidence.inputWriteSurfaceHash === evidence.writeSurfaceHash;
    const terminal = settled.status === 'succeeded' ? 'succeeded' : settled.status === 'timed-out' ? 'timed-out' : 'failed';
    const expected = terminal === 'succeeded'
      ? reduceRunOutcome('succeeded', { priorChangeState: 'executing' })
      : reduceRunOutcome(terminal, { priorChangeState: 'executing', replaySafety: gate.replaySafety, retryRemaining: gate.replaySafety !== 'manual-reconcile', sideEffectsKnownAbsent: effectsAbsent, safeToRetry: gate.replaySafety === 'idempotent' || (gate.replaySafety === 'pure' && effectsAbsent) });
    if (fingerprint(settled.outcome) !== fingerprint(expected)) throw new GateRunError('RECOVERY_INVALID', 'Settlement outcome does not match immutable evidence and reviewed replay policy');
    return { attemptId: prepared.attemptId, operationFingerprint: prepared.operationFingerprint, inputTreeHash: prepared.inputTreeHash, status: settled.status, exitCode: settled.exitCode, outcome: expected, evidence: published, evidenceRef: evidenceFilePath(request.changeId, request.runId, request.gateId), phaseEventHashes };
  }

  async recover(recovery: GateRecoveryRequest): Promise<GateRecoveryResult> {
    const { previousRunId, request } = recovery;
    if (typeof previousRunId !== 'string' || previousRunId.length === 0 || previousRunId === request.runId) throw new GateRunError('RECOVERY_INVALID', 'Recovery requires a distinct prior run identity');
    const canonicalRoot = await realpath(request.repositoryRoot);
    const repositoryIdentity = fingerprint({ canonicalRepositoryRoot: canonicalRoot });
    const gate = request.registry.get(request.gateId);
    const currentGateHash = gateDefinitionFingerprint(gate);
    if (currentGateHash !== request.expectedGateDefinitionHash) throw new GateRunError('RECOVERY_INVALID', 'The current reviewed gate definition is stale');

    let events: JournalEvent[];
    try {
      const replay = await this.journalFactory(runtimePaths(canonicalRoot, request.changeId).journal).replayStrict();
      if (replay.discardedIncompleteTail) throw new Error('incomplete journal tail');
      events = replay.events;
    }
    catch (error: unknown) { throw new GateRunError('RECOVERY_INVALID', `The gate journal cannot be verified: ${error instanceof Error ? error.message : String(error)}`); }
    const preparedEvents = events.filter((event) => {
      if (event.type !== 'gate.attempt.prepared') return false;
      return !!event.payload && typeof event.payload === 'object' && matchesAttemptScope(event.payload as Partial<GateAttemptIdentity>, repositoryIdentity, previousRunId, request);
    });
    if (preparedEvents.length !== 1) throw new GateRunError('RECOVERY_INVALID', 'The prior gate has no unique verified prepared attempt');
    const preparedEvent = preparedEvents[0];
    const prepared = asPreparedRecord(preparedEvent.payload);
    if (!prepared || !eventMatchesIdentity(preparedEvent, prepared)) throw new GateRunError('RECOVERY_INVALID', 'The prior prepared attempt is malformed');
    if (request.leaseGeneration <= prepared.leaseGeneration) throw new GateRunError('RECOVERY_INVALID', 'Recovery requires a newer lease generation');
    const successorAttemptId = attemptIdFor({
      repositoryIdentity,
      changeId: request.changeId,
      runId: request.runId,
      gateId: request.gateId,
      taskId: request.taskId,
      taskRevision: request.taskRevision,
      leaseGeneration: request.leaseGeneration,
    });
    if (prepared.gateDefinitionHash !== currentGateHash) throw new GateRunError('RECOVERY_INVALID', 'The reviewed gate definition changed since the prior run');
    const expectedPolicy: GateExecutionPolicy = {
      replaySafety: gate.replaySafety,
      effectClass: gate.effectClass,
      network: gate.network,
      argvFingerprint: fingerprint(gate.argv),
      cwdFingerprint: fingerprint(await repositoryPath(canonicalRoot, normalizeRepositoryPath(gate.cwd), true)),
      environmentFingerprint: environmentPolicyFingerprint(gate.environmentAllowlist),
      declaredWritePathsFingerprint: fingerprint(gate.declaredWritePaths.map(normalizeRepositoryPath)),
      timeoutSeconds: gate.timeoutSeconds,
      maxOutputBytes: prepared.executionPolicy.maxOutputBytes,
    };
    const expectedOperation = fingerprint({ gate: currentGateHash, argv: gate.argv, cwd: await repositoryPath(canonicalRoot, normalizeRepositoryPath(gate.cwd), true), environment: expectedPolicy.environmentFingerprint, input: prepared.inputTreeHash, execution: prepared.executionFingerprint });
    const expectedLauncherFingerprint = fingerprint({ command: process.execPath, args: ['--eval', gateLauncherSource] });
    if (fingerprint(prepared.executionPolicy) !== fingerprint(expectedPolicy) || prepared.operationFingerprint !== expectedOperation || prepared.launcherCommandFingerprint !== expectedLauncherFingerprint) throw new GateRunError('RECOVERY_INVALID', 'The prepared execution policy is not bound to the reviewed gate and launcher');

    // Collect raw phase claims by the complete original scope before trusting
    // attemptId.  A damaged/missing attemptId must fence recovery, not make a
    // same-scope started/released/settled claim disappear.
    const phaseTypes = new Set(['gate.attempt.started', 'gate.attempt.released', 'gate.attempt.settled', 'gate.attempt.aborted', 'gate.attempt.denied']);
    const scopeClaims = events.filter((event) => {
      if (!phaseTypes.has(event.type) || !event.payload || typeof event.payload !== 'object') return false;
      const claim = event.payload as Partial<GateAttemptIdentity>;
      return matchesAttemptScope(claim, repositoryIdentity, previousRunId, request) && claim.leaseGeneration === prepared.leaseGeneration;
    });
    const claims = (type: string) => scopeClaims.filter((event) => event.type === type);
    const startedEvents = claims('gate.attempt.started');
    const releasedEvents = claims('gate.attempt.released');
    const settledEvents = claims('gate.attempt.settled');
    const abortedEvents = claims('gate.attempt.aborted');
    const deniedEvents = claims('gate.attempt.denied');
    if ([startedEvents, releasedEvents, settledEvents, abortedEvents, deniedEvents].some((group) => group.length > 1)) throw new GateRunError('RECOVERY_INVALID', 'The prior gate attempt contains duplicate phase claims');

    const startedEvent = startedEvents[0];
    const releasedEvent = releasedEvents[0];
    const settledEvent = settledEvents[0];
    const abortedEvent = abortedEvents[0];
    const deniedEvent = deniedEvents[0];
    const started = startedEvent ? asStartedRecord(startedEvent.payload) : undefined;
    const released = releasedEvent ? asReleasedRecord(releasedEvent.payload) : undefined;
    const record = settledEvent ? asSettledRecord(settledEvent.payload) : undefined;
    const aborted = abortedEvent ? asAbortedRecord(abortedEvent.payload) : undefined;
    const denied = deniedEvent ? asDeniedRecord(deniedEvent.payload) : undefined;
    if (startedEvent && (!started || started.attemptId !== prepared.attemptId || !eventMatchesIdentity(startedEvent, started) || startedEvent.previousEventHash !== preparedEvent.eventHash || started.preparedEventHash !== preparedEvent.eventHash || started.process.commandFingerprint !== prepared.launcherCommandFingerprint || started.process.reviewedCommandFingerprint !== prepared.processCommandFingerprint)) throw new GateRunError('RECOVERY_INVALID', 'The prior started attempt is malformed or unlinked');
    if (releasedEvent && (!released || released.attemptId !== prepared.attemptId || !startedEvent || !started || !eventMatchesIdentity(releasedEvent, released) || releasedEvent.previousEventHash !== startedEvent.eventHash || released.preparedEventHash !== preparedEvent.eventHash || released.startedEventHash !== startedEvent.eventHash || released.processGroupId !== started.process.processGroupId)) throw new GateRunError('RECOVERY_INVALID', 'The prior release attempt is malformed or unlinked');
    if (settledEvent && (!record || record.attemptId !== prepared.attemptId || !releasedEvent || !released || !eventMatchesIdentity(settledEvent, record) || settledEvent.previousEventHash !== releasedEvent.eventHash || record.preparedEventHash !== preparedEvent.eventHash || record.startedEventHash !== startedEvent!.eventHash || record.releasedEventHash !== releasedEvent.eventHash)) throw new GateRunError('RECOVERY_INVALID', 'The prior settlement is malformed or unlinked');
    if (abortedEvent) {
      const expectedPrior = aborted?.priorPhase === 'released' ? releasedEvent : aborted?.priorPhase === 'started' ? startedEvent : preparedEvent;
      const validProcessGroup = aborted?.priorPhase === 'prepared'
        ? aborted.processGroupId === undefined
        : !!started && aborted?.processGroupId === started.process.processGroupId;
      if (!aborted || aborted.attemptId !== prepared.attemptId || !eventMatchesIdentity(abortedEvent, aborted) || !expectedPrior || abortedEvent.previousEventHash !== expectedPrior.eventHash || aborted.priorEventHash !== expectedPrior.eventHash || aborted.preparedEventHash !== preparedEvent.eventHash || !validProcessGroup) throw new GateRunError('RECOVERY_INVALID', 'The prior abort fence is malformed or unlinked');
    }
    if (deniedEvent && (!denied || !startedEvent || !started || releasedEvent || settledEvent || abortedEvent || denied.attemptId !== prepared.attemptId || !eventMatchesIdentity(deniedEvent, denied) || deniedEvent.previousEventHash !== startedEvent.eventHash || denied.preparedEventHash !== preparedEvent.eventHash || denied.startedEventHash !== startedEvent.eventHash)) throw new GateRunError('RECOVERY_INVALID', 'The prior approval denial is malformed or unlinked');
    if ((record && aborted) || (denied && (record || aborted))) throw new GateRunError('RECOVERY_INVALID', 'The prior gate attempt has conflicting terminal phase claims');

    const expectedUnknown = reduceRunOutcome('unknown', { priorChangeState: 'executing' });
    if (denied) return { restarted: false, outcome: denied.outcome };
    if (!record) {
      let durableAbort = aborted;
      let durableAbortEvent = abortedEvent;
      if (durableAbort) {
        const sameSuccessor = durableAbort.successorRunId === request.runId
          && durableAbort.successorLeaseGeneration === request.leaseGeneration
          && durableAbort.successorAttemptId === successorAttemptId;
        if (!sameSuccessor) throw new GateRunError('RECOVERY_INVALID', 'The prior abort fence is bound to a different successor');
      } else {
        const priorPhase = releasedEvent ? 'released' : startedEvent ? 'started' : 'prepared';
        const priorEvent = releasedEvent ?? startedEvent ?? preparedEvent;
        const abortRecord: GateAttemptAbortedRecord = {
          ...prepared,
          preparedEventHash: preparedEvent.eventHash,
          priorPhase,
          priorEventHash: priorEvent.eventHash,
          reason: 'recovery-fence',
          ...(started ? { processGroupId: started.process.processGroupId } : {}),
          successorRunId: request.runId,
          successorLeaseGeneration: request.leaseGeneration,
          successorAttemptId,
        };
        try {
          durableAbortEvent = await this.appendAttempt(canonicalRoot, 'gate.attempt.aborted', abortRecord, priorEvent.eventHash);
          durableAbort = abortRecord;
        } catch (error: unknown) {
          const code = isJournalTailMismatch(error) ? 'RECOVERY_IN_PROGRESS' : 'RECOVERY_INVALID';
          throw new GateRunError(code, `The interrupted gate could not be fenced: ${error instanceof Error ? error.message : String(error)}`);
        }
        await this.attemptLifecycle.afterAborted?.({ attemptId: prepared.attemptId, event: durableAbortEvent });
      }

      const successorPreparedEvents = events.filter((event) => {
        if (event.type !== 'gate.attempt.prepared' || !event.payload || typeof event.payload !== 'object') return false;
        const claim = event.payload as Partial<GateAttemptIdentity>;
        return matchesAttemptScope(claim, repositoryIdentity, request.runId, request)
          && claim.leaseGeneration === request.leaseGeneration;
      });
      if (successorPreparedEvents.length > 0) {
        if (successorPreparedEvents.length !== 1) throw new GateRunError('RECOVERY_INVALID', 'The bound successor contains duplicate prepared claims');
        const successorPrepared = asPreparedRecord(successorPreparedEvents[0].payload);
        if (!successorPrepared || successorPrepared.attemptId !== successorAttemptId || !eventMatchesIdentity(successorPreparedEvents[0], successorPrepared)) throw new GateRunError('RECOVERY_INVALID', 'The bound successor prepared claim is malformed');
        throw new GateRunError('RECOVERY_IN_PROGRESS', `Successor gate run ${request.runId} was already prepared; recover that run with a newer generation if it did not settle`);
      }

      if (started) {
        let active = true;
        try { active = await this.processLiveness(started); }
        catch (error: unknown) {
          throw new GateRunError('RECOVERY_INVALID', `The interrupted gate liveness is uncertain: ${error instanceof Error ? error.message : String(error)}`);
        }
        try { if (active) await this.processContainment(started); }
        catch (error: unknown) { throw new GateRunError('RECOVERY_INVALID', `The interrupted gate containment is uncertain: ${error instanceof Error ? error.message : String(error)}`); }
      }
      if (gate.replaySafety === 'manual-reconcile') return { restarted: false, outcome: expectedUnknown };
      if (gate.replaySafety === 'pure') {
        const currentSurface = await writeSurface(canonicalRoot, { excludePaths: controllerWriteExclusions(canonicalRoot, prepared.changeId, prepared.runId, prepared.gateId) });
        if (currentSurface.hash !== prepared.recoveryWriteSurfaceHash) throw new GateRunError('RECOVERY_INVALID', 'The interrupted pure gate recovery surface changed');
      }
      return { restarted: true, result: await this.execute(request, durableAbortEvent!.eventHash) };
    }

    if (record.gateDefinitionHash !== prepared.gateDefinitionHash || record.inputTreeHash !== prepared.inputTreeHash) throw new GateRunError('RECOVERY_INVALID', 'The settlement does not bind the prepared gate inputs');
    if (gate.replaySafety === 'manual-reconcile') {
      if (record.status !== 'unknown' || record.evidence !== undefined || fingerprint(record.outcome) !== fingerprint(expectedUnknown)) throw new GateRunError('RECOVERY_INVALID', 'Manual reconciliation applies only to a journaled indeterminate run');
      return { restarted: false, outcome: expectedUnknown };
    }
    if (!record.evidence || !['failed', 'timed-out', 'output-capped'].includes(record.status)) throw new GateRunError('RECOVERY_INVALID', 'Only evidence-backed failed, timed-out, or output-capped runs may auto-recover');
    let published: PublishedGateEvidence;
    try { published = await loadGateEvidence(canonicalRoot, record.changeId, record.runId, record.gateId); }
    catch (error: unknown) { throw new GateRunError('RECOVERY_INVALID', `Prior evidence cannot be verified: ${error instanceof Error ? error.message : String(error)}`); }
    if (published.contentHash !== record.evidence.contentHash || published.pathHash !== record.evidence.pathHash) throw new GateRunError('RECOVERY_INVALID', 'Prior evidence does not match its journaled content and path hashes');
    const evidence = published.evidence;
    const fieldsMatch = evidence.runId === record.runId
      && evidence.taskId === record.taskId
      && evidence.taskRevision === record.taskRevision
      && evidence.leaseGeneration === record.leaseGeneration
      && evidence.gateId === record.gateId
      && evidence.repositoryIdentity === record.repositoryIdentity
      && evidence.gateDefinitionHash === record.gateDefinitionHash
      && evidence.inputTreeHash === record.inputTreeHash
      && evidence.exitCode === record.exitCode
      && evidence.runStatus === record.status;
    if (!fieldsMatch) throw new GateRunError('RECOVERY_INVALID', 'Prior evidence does not exactly bind the journaled gate attempt');
    const effectsAbsent = evidence.inputWriteSurfaceHash === evidence.writeSurfaceHash;
    const safeToRetry = gate.replaySafety === 'idempotent' || (gate.replaySafety === 'pure' && effectsAbsent);
    const expectedOutcome = reduceRunOutcome(record.status === 'timed-out' ? 'timed-out' : 'failed', { priorChangeState: 'executing', replaySafety: gate.replaySafety, retryRemaining: true, sideEffectsKnownAbsent: effectsAbsent, safeToRetry });
    if (fingerprint(expectedOutcome) !== fingerprint(record.outcome)) throw new GateRunError('RECOVERY_INVALID', 'Prior outcome does not match the journaled evidence and replay policy');
    if (!safeToRetry) throw new GateRunError('RECOVERY_INVALID', 'Prior effects do not permit automatic recovery');
    return { restarted: true, result: await this.run(request) };
  }

  async run(request: GateRunRequest): Promise<GateRunResult> {
    return this.execute(request, undefined, await this.preflight(request));
  }

  private async execute(request: GateRunRequest, expectedPreparedTailHash?: string, preflight?: GatePreflight): Promise<GateRunResult> {
    const admission = preflight ?? await this.preflight(request);
    const { canonicalRoot, repositoryIdentity, gate, gateDefinitionHash, cwd, declaredWritePaths, inputTreeHash, execution } = admission;
    let reservation: EvidenceReservation | undefined;
    if (expectedPreparedTailHash === undefined) reservation = await reserveGateEvidence(canonicalRoot, request.changeId, request.runId, gate.id);
    else {
      // Recovery must win the journal CAS before reserving its immutable
      // evidence target.  Create and verify only deterministic parent
      // directories up front so that controller-owned scaffolding is part of
      // the baseline rather than being attributed to the reviewed gate.
      const target = await repositoryPath(canonicalRoot, evidenceDirectory(request.changeId, request.runId, gate.id));
      const parent = dirname(target);
      const parentRelative = relative(canonicalRoot, parent).split(sep).join('/');
      await repositoryPath(canonicalRoot, parentRelative);
      await mkdir(parent, { recursive: true });
      await repositoryPath(canonicalRoot, parentRelative, true);
    }
    await mkdir(dirname(runtimePaths(canonicalRoot, request.changeId).journal), { recursive: true });
    const surfaceExclusions = controllerWriteExclusions(canonicalRoot, request.changeId, request.runId, gate.id);
    const beforeSurface = await writeSurface(canonicalRoot, { excludePaths: surfaceExclusions });
    const executionPolicy: GateExecutionPolicy = {
      replaySafety: gate.replaySafety,
      effectClass: gate.effectClass,
      network: gate.network,
      argvFingerprint: fingerprint(gate.argv),
      cwdFingerprint: fingerprint(cwd),
      environmentFingerprint: environmentPolicyFingerprint(gate.environmentAllowlist),
      declaredWritePathsFingerprint: fingerprint(declaredWritePaths),
      timeoutSeconds: gate.timeoutSeconds,
      maxOutputBytes: request.maxOutputBytes,
    };
    const processCommandFingerprint = fingerprint({ command: execution.command, args: execution.args, execution: execution.fingerprint });
    const launcherCommandFingerprint = fingerprint({ command: process.execPath, args: ['--eval', gateLauncherSource] });
    const operationFingerprint = fingerprint({ gate: gateDefinitionHash, argv: gate.argv, cwd, environment: executionPolicy.environmentFingerprint, input: inputTreeHash, execution: execution.fingerprint });
    const identityFields = {
      runId: request.runId,
      changeId: request.changeId,
      taskId: request.taskId,
      taskRevision: request.taskRevision,
      leaseGeneration: request.leaseGeneration,
      gateId: gate.id,
      repositoryIdentity,
    };
    const identity: GateAttemptIdentity = { version: 3, attemptId: attemptIdFor(identityFields), ...identityFields };
    const preparedRecord: GateAttemptPreparedRecord = {
      ...identity,
      gateDefinitionHash,
      inputTreeHash,
      executionFingerprint: execution.fingerprint,
      processCommandFingerprint,
      launcherCommandFingerprint,
      operationFingerprint,
      recoveryWriteSurfaceHash: beforeSurface.hash,
      executionPolicy,
    };
    let preparedEvent: JournalEvent;
    try { preparedEvent = await this.appendAttempt(canonicalRoot, 'gate.attempt.prepared', preparedRecord, expectedPreparedTailHash); }
    catch (error: unknown) {
      if (expectedPreparedTailHash !== undefined && isJournalTailMismatch(error)) throw new GateRunError('RECOVERY_IN_PROGRESS', `Successor gate run ${request.runId} was already claimed or prepared`);
      throw error;
    }
    reservation ??= await reserveGateEvidence(canonicalRoot, request.changeId, request.runId, gate.id);
    await this.attemptLifecycle.afterPrepared?.({ attemptId: identity.attemptId, event: preparedEvent });
    const started = this.now();
    // Only the one-shot barrier starts here. The reviewed argv is sent over
    // IPC after both started and released have won their journal tail CAS.
    const subprocess = execa(process.execPath, ['--eval', gateLauncherSource], {
      cwd,
      env: minimalEnvironment([]),
      extendEnv: false,
      shell: false,
      detached: true,
      cleanup: false,
      ipc: true,
      reject: false,
      timeout: gate.timeoutSeconds * 1000 + 2_000,
      maxBuffer: request.maxOutputBytes + 1_024,
      all: false,
      encoding: 'buffer',
      stripFinalNewline: false,
    });
    const pid = subprocess.pid;
    if (!Number.isSafeInteger(pid) || (pid ?? 0) < 1) {
      try { subprocess.kill('SIGKILL'); } catch { /* no durable group identity */ }
      try { await subprocess; } catch { /* termination is expected */ }
      throw new GateRunIndeterminateError('Gate process was spawned without a durable process identity');
    }
    const processGroupId = pid!;
    const processIdentity: GateProcessIdentity = { pid: pid!, processGroupId, commandFingerprint: launcherCommandFingerprint, reviewedCommandFingerprint: processCommandFingerprint, observedAt: this.now().toISOString() };
    const launcherOwnership: GateLauncherOwnership = { ...identity, process: processIdentity };
    try { activeLaunchers.register(launcherOwnership, subprocess); }
    catch (error: unknown) {
      throw new GateRunIndeterminateError(`Gate launcher ownership is ambiguous: ${error instanceof Error ? error.message : String(error)}`);
    }
    let readyMessage: unknown;
    try { readyMessage = await subprocess.getOneMessage(); }
    catch (error: unknown) {
      await containProcessGroup(launcherOwnership, subprocess);
      throw new GateRunIndeterminateError(`Gate launcher readiness is indeterminate: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!readyMessage || typeof readyMessage !== 'object' || (readyMessage as { type?: unknown }).type !== 'launcher-ready' || (readyMessage as { pid?: unknown }).pid !== pid || (readyMessage as { processGroupId?: unknown }).processGroupId !== processGroupId) {
      await containProcessGroup(launcherOwnership, subprocess);
      throw new GateRunIndeterminateError('Gate launcher returned an invalid process-group identity');
    }
    const startedRecord: GateAttemptStartedRecord = { ...identity, preparedEventHash: preparedEvent.eventHash, process: processIdentity };
    let startedEvent: JournalEvent;
    try {
      startedEvent = await this.appendAttempt(canonicalRoot, 'gate.attempt.started', startedRecord, preparedEvent.eventHash);
    } catch (error: unknown) {
      await containProcessGroup(launcherOwnership, subprocess);
      throw error;
    }
    await this.attemptLifecycle.afterStarted?.({ attemptId: identity.attemptId, event: startedEvent });
    if (!automaticallyRunnable(gate)) {
      try {
        this.verifyApproval(request, gate, cwd, this.now());
      } catch (error: unknown) {
        await containProcessGroup(launcherOwnership, subprocess);
        if (!(error instanceof GateRunError) || error.code !== 'APPROVAL_MISMATCH') throw error;
        const outcome: RunOutcome = { runState: 'cancelled', taskState: 'blocked', changeState: 'approval-required' };
        const deniedRecord: GateAttemptDeniedRecord = {
          ...identity,
          preparedEventHash: preparedEvent.eventHash,
          startedEventHash: startedEvent.eventHash,
          reason: 'approval-expired',
          outcome,
        };
        await this.appendAttempt(canonicalRoot, 'gate.attempt.denied', deniedRecord, startedEvent.eventHash);
        return { status: 'approval-expired', exitCode: null, outcome };
      }
    }
    const releasedRecord: GateAttemptReleasedRecord = { ...identity, preparedEventHash: preparedEvent.eventHash, startedEventHash: startedEvent.eventHash, processGroupId };
    let releasedEvent: JournalEvent;
    try {
      releasedEvent = await this.appendAttempt(canonicalRoot, 'gate.attempt.released', releasedRecord, startedEvent.eventHash);
      await subprocess.sendMessage({
        type: 'release',
        attemptId: identity.attemptId,
        startedEventHash: startedEvent.eventHash,
        releaseEventHash: releasedEvent.eventHash,
        journalPath: runtimePaths(canonicalRoot, request.changeId).journal,
        command: execution.command,
        args: execution.args,
        cwd,
        env: minimalEnvironment(gate.environmentAllowlist),
        timeoutMs: gate.timeoutSeconds * 1000,
        maxOutputBytes: request.maxOutputBytes,
      });
    } catch (error: unknown) {
      await containProcessGroup(launcherOwnership, subprocess);
      if (error instanceof GateRunIndeterminateError) throw error;
      throw new GateRunIndeterminateError(`Gate release could not be delivered: ${error instanceof Error ? error.message : String(error)}`);
    }
    const protocolOutcome = await subprocess.getOneMessage().catch((error: unknown) => ({ type: 'launcher-error', message: error instanceof Error ? error.message : String(error) }));
    let stdout = Buffer.alloc(0); let stderr = Buffer.alloc(0); let exitCode: number | null = null; let timedOut = false; let capped = false;
    const gateExitConfirmed = !!protocolOutcome && typeof protocolOutcome === 'object' && (protocolOutcome as { type?: unknown }).type === 'gate-exit';
    if (gateExitConfirmed) {
      const protocolExitCode = (protocolOutcome as { code?: unknown }).code;
      exitCode = Number.isInteger(protocolExitCode) ? protocolExitCode as number : null;
      timedOut = (protocolOutcome as { timedOut?: unknown }).timedOut === true;
      capped = (protocolOutcome as { capped?: unknown }).capped === true;
    }
    try { await containProcessGroup(launcherOwnership); }
    catch (error: unknown) { throw error instanceof GateRunIndeterminateError ? error : new GateRunIndeterminateError(String(error)); }
    try {
      const result = await subprocess;
      stdout = Buffer.from(result.stdout); stderr = Buffer.from(result.stderr); exitCode ??= result.exitCode ?? null; timedOut ||= result.timedOut; capped ||= result.isMaxBuffer;
    } catch (error: unknown) {
      const result = error as { stdout?: Uint8Array; stderr?: Uint8Array; exitCode?: number; timedOut?: boolean; isMaxBuffer?: boolean };
      stdout = result.stdout instanceof Uint8Array ? Buffer.from(result.stdout) : Buffer.alloc(0);
      stderr = result.stderr instanceof Uint8Array ? Buffer.from(result.stderr) : Buffer.alloc(0);
      exitCode ??= result.exitCode ?? null; timedOut ||= result.timedOut === true; capped ||= result.isMaxBuffer === true;
    }
    if (!gateExitConfirmed) {
      throw new GateRunIndeterminateError(`Gate launcher protocol did not confirm execution: ${(protocolOutcome as { message?: unknown } | null)?.message ?? 'missing gate-exit message'}`);
    }
    const protocol = protocolOutcome as { code?: unknown; signal?: unknown; timedOut?: unknown; capped?: unknown; drainComplete?: unknown; observedOutputBytes?: unknown; outputStreams?: unknown };
    const exitedNormally = Number.isSafeInteger(protocol.code) && (protocol.code as number) >= 0 && protocol.signal === null;
    const exitedBySignal = protocol.code === null && typeof protocol.signal === 'string' && /^SIG[A-Z0-9]+$/.test(protocol.signal);
    if (!((exitedNormally || exitedBySignal)
      && typeof protocol.timedOut === 'boolean'
      && typeof protocol.capped === 'boolean'
      && typeof protocol.drainComplete === 'boolean'
      && Number.isSafeInteger(protocol.observedOutputBytes)
      && (protocol.observedOutputBytes as number) >= 0
      && protocol.outputStreams && typeof protocol.outputStreams === 'object' && !Array.isArray(protocol.outputStreams))) {
      throw new GateRunIndeterminateError('Gate launcher returned an invalid output protocol shape');
    }
    const outputStreams = protocol.outputStreams as { stdout?: unknown; stderr?: unknown };
    const stdoutProof = parseOutputStreamProof(outputStreams.stdout);
    const stderrProof = parseOutputStreamProof(outputStreams.stderr);
    if (!stdoutProof || !stderrProof) throw new GateRunIndeterminateError('Gate launcher returned invalid per-stream output proof');
    const capturedOutputBytes = stdout.byteLength + stderr.byteLength;
    const observedOutputBytes = stdoutProof.observedBytes + stderrProof.observedBytes;
    const forwardedOutputBytes = stdoutProof.forwardedBytes + stderrProof.forwardedBytes;
    const outputCountValid = Number.isSafeInteger(observedOutputBytes)
      && protocol.observedOutputBytes === observedOutputBytes
      && stdoutProof.forwardedBytes === stdout.byteLength
      && stderrProof.forwardedBytes === stderr.byteLength
      && forwardedOutputBytes === capturedOutputBytes
      && capturedOutputBytes <= request.maxOutputBytes
      && capped === protocol.capped
      && (protocol.capped
        ? observedOutputBytes > request.maxOutputBytes && forwardedOutputBytes === request.maxOutputBytes
        : observedOutputBytes <= request.maxOutputBytes && forwardedOutputBytes === observedOutputBytes);
    if (!outputCountValid) throw new GateRunIndeterminateError('Gate launcher output byte count is inconsistent with the captured output and cap');
    if (protocol.drainComplete !== true) throw new GateRunIndeterminateError('Gate launcher output drain did not complete before containment');
    await this.attemptLifecycle.afterProcessExit?.(identity.attemptId);
    const unknownOutcome = reduceRunOutcome('unknown', { priorChangeState: 'executing' });
    const settlementBase = { ...identity, preparedEventHash: preparedEvent.eventHash, startedEventHash: startedEvent.eventHash, releasedEventHash: releasedEvent.eventHash, gateDefinitionHash, inputTreeHash };
    const recordUnknown = async (): Promise<void> => { await this.appendAttempt(canonicalRoot, 'gate.attempt.settled', { ...settlementBase, status: 'unknown', exitCode, outcome: unknownOutcome }, releasedEvent.eventHash); };
    let afterTree; let afterSurface;
    try { afterTree = await canonicalTreeHash(canonicalRoot); afterSurface = await writeSurface(canonicalRoot, { excludePaths: surfaceExclusions }); }
    catch { await recordUnknown(); return { status: 'unknown', exitCode, outcome: unknownOutcome }; }
    const changed = changedSurfacePaths(beforeSurface.entries, afterSurface.entries);
    const undeclaredWrites = changed.filter((path) => !declared(path, declaredWritePaths));
    const decodedStdout = decodeGateOutput(stdout, stdoutProof);
    const decodedStderr = decodeGateOutput(stderr, stderrProof);
    if (!decodedStdout.valid || !decodedStderr.valid) { await recordUnknown(); return { status: 'unknown', exitCode, outcome: unknownOutcome }; }
    const scannedStdout = redact(decodedStdout.text).text; const scannedStderr = redact(decodedStderr.text).text;
    if (hasSecretShape(scannedStdout) || hasSecretShape(scannedStderr)) { await recordUnknown(); return { status: 'evidence-blocked-secret', exitCode, outcome: unknownOutcome }; }
    const bounded = boundedLogs(scannedStdout, scannedStderr, request.maxOutputBytes);
    const redactedStdout = bounded.stdout; const redactedStderr = bounded.stderr;
    if (hasSecretShape(redactedStdout) || hasSecretShape(redactedStderr)) { await recordUnknown(); return { status: 'evidence-blocked-secret', exitCode, outcome: unknownOutcome }; }
    const status: GateRunStatus = timedOut ? 'timed-out' : capped || capturedOutputBytes > request.maxOutputBytes ? 'output-capped' : undeclaredWrites.length > 0 ? 'undeclared-writes' : exitCode === 0 ? 'succeeded' : 'failed';
    const finished = this.now();
    const evidenceBase: Omit<GateEvidence, 'stdoutLogPath' | 'stderrLogPath'> = {
      id: fingerprint({ runId: request.runId, gate: gate.id, tree: afterTree.hash }), runId: request.runId, taskId: request.taskId, taskRevision: request.taskRevision, leaseGeneration: request.leaseGeneration, gateId: gate.id,
      repositoryIdentity,
      treeHash: afterTree.hash, inputTreeHash, writeSurfaceHash: afterSurface.hash, inputWriteSurfaceHash: beforeSurface.hash,
      operationFingerprint, executionFingerprint: execution.fingerprint,
      artifactHashes: [gateDefinitionHash], timestamp: finished.toISOString(), gateDefinitionHash, exitCode, runStatus: status, startedAt: started.toISOString(), finishedAt: finished.toISOString(), durationMs: finished.getTime() - started.getTime(),
    };
    let published: PublishedGateEvidence;
    try {
      published = await publishGateEvidence(canonicalRoot, reservation, evidenceBase, redactedStdout, redactedStderr);
    } catch {
      await recordUnknown();
      return { status: 'unknown', exitCode, outcome: unknownOutcome };
    }
    await this.attemptLifecycle.afterEvidencePublished?.(identity.attemptId);
    const sideEffectsKnownAbsent = changed.length === 0;
    const outcome = status === 'succeeded' ? reduceRunOutcome('succeeded', { priorChangeState: 'executing' }) : reduceRunOutcome(status === 'timed-out' ? 'timed-out' : 'failed', { priorChangeState: 'executing', replaySafety: gate.replaySafety, retryRemaining: gate.replaySafety !== 'manual-reconcile', sideEffectsKnownAbsent, safeToRetry: gate.replaySafety === 'idempotent' || (gate.replaySafety === 'pure' && sideEffectsKnownAbsent) });
    await this.appendAttempt(canonicalRoot, 'gate.attempt.settled', {
      ...settlementBase, status, exitCode, outcome,
      evidence: { contentHash: published.contentHash, pathHash: published.pathHash },
    }, releasedEvent.eventHash);
    return { status, exitCode, evidence: published.evidence, ...(undeclaredWrites.length > 0 ? { undeclaredWrites } : {}), outcome };
  }
}

export function recoverGateRun(replaySafety: GateDefinition['replaySafety'], terminal: 'failed' | 'timed-out' | 'unknown', priorChangeState: ChangeState, effectsKnownAbsent = false): RunOutcome {
  return reduceRunOutcome(terminal, { priorChangeState, replaySafety, retryRemaining: replaySafety !== 'manual-reconcile', sideEffectsKnownAbsent: effectsKnownAbsent, safeToRetry: replaySafety === 'idempotent' || (replaySafety === 'pure' && effectsKnownAbsent) });
}

const defaultRunner = new GateRunner();
export const runGate = (request: GateRunRequest) => defaultRunner.run(request);
