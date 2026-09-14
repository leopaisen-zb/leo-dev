import type { ChangeState, RunState, TaskState } from './types.js';

export type TransitionResult = { ok: true } | { ok: false; code: 'TRANSITION_FORBIDDEN'; detail: string };
const change: Record<ChangeState, readonly ChangeState[]> = {
  triage: ['discovery', 'approval-required', 'blocked'], discovery: ['spec-review', 'approval-required', 'blocked'], 'spec-review': ['spec-approved', 'approval-required', 'blocked'], 'spec-approved': ['task-ready', 'design-review', 'approval-required', 'blocked'], 'design-review': ['design-approved', 'approval-required', 'blocked'], 'design-approved': ['task-ready', 'approval-required', 'blocked'], 'task-ready': ['executing', 'approval-required', 'blocked'], executing: ['integration-review', 'approval-required', 'blocked'], 'integration-review': ['release-evidence', 'approval-required', 'blocked'], 'release-evidence': ['archived', 'approval-required', 'blocked'], archived: [], 'approval-required': [], blocked: [],
};
const task: Record<TaskState, readonly TaskState[]> = {
  pending: ['ready', 'blocked'], ready: ['leased', 'blocked'], leased: ['implementing', 'blocked'], implementing: ['verifying', 'blocked'], verifying: ['review-required', 'remediation', 'blocked'], 'review-required': ['reviewing', 'blocked'], reviewing: ['done', 'remediation', 'blocked'], remediation: ['ready', 'blocked'], done: [], blocked: [],
};
const run: Record<RunState, readonly RunState[]> = {
  created: ['running', 'cancelled'], running: ['succeeded', 'failed', 'timed-out', 'cancelled', 'abandoned', 'unknown'], succeeded: [], failed: [], 'timed-out': [], cancelled: [], abandoned: [], unknown: ['succeeded', 'failed', 'abandoned'],
};
function route<T extends string>(table: Record<T, readonly T[]>, from: T, to: string): TransitionResult {
  return table[from].includes(to as T) ? { ok: true } : { ok: false, code: 'TRANSITION_FORBIDDEN', detail: `${from} -> ${to} is not listed` };
}
export interface TransitionContext { storedPriorState?: ChangeState; receiptMatched?: boolean; approvalDecision?: 'grant' | 'reject'; resolutionDecision?: 'resume'; risk?: 'lite' | 'standard' | 'full'; reviewProvenance?: 'platform-attested' | 'human-confirmed' | 'agent-asserted'; independentSession?: boolean; architectureReceipt?: boolean; securityReceipt?: boolean; nfrReceipt?: boolean; riskRecorded?: boolean; specResolves?: boolean; schemaValid?: boolean; unresolvedDecisionsEmpty?: boolean; approvalReceiptMatches?: boolean; designArtifactResolves?: boolean; reviewReceiptMatches?: boolean; validTasks?: boolean; gateRegistry?: boolean; runtimeWorkspace?: boolean; baseline?: boolean; journalCommitted?: boolean; independentCiMatches?: boolean; reviewReceiptAccepted?: boolean; reconciliationMatched?: boolean; dependenciesDone?: boolean; noActiveLease?: boolean; newLeaseGeneration?: boolean; runMatchesLease?: boolean; candidateMatchesCas?: boolean; gatesCurrent?: boolean; reviewSessionAccepted?: boolean; retryRemaining?: boolean; failureRecorded?: boolean; allTasksDone?: boolean; noActiveOrUnknownRun?: boolean; integrationGatesDeclared?: boolean; integrationEvidenceCurrent?: boolean; archivalManifestMatches?: boolean; authorityRequired?: boolean; blockerRecorded?: boolean; taskDefinitionValid?: boolean; exitEvidenceCommitted?: boolean; cancellationReceipt?: boolean; sideEffectsKnownAbsent?: boolean; leaseFenced?: boolean; outcomeUnknown?: boolean; }
const denied = (detail: string): TransitionResult => ({ ok: false, code: 'TRANSITION_FORBIDDEN', detail });
export function transitionChange(from: ChangeState, to: string, recovery: TransitionContext = {}): TransitionResult {
  if (from === 'blocked') return recovery.resolutionDecision === 'resume' && recovery.receiptMatched && recovery.storedPriorState === to ? { ok: true } : denied('blocked recovery requires matching resolution receipt');
  if (from === 'approval-required') {
    if (from === 'approval-required' && recovery.approvalDecision === 'reject') return to === 'blocked' && recovery.receiptMatched ? { ok: true } : denied('rejection blocks change');
    return recovery.approvalDecision === 'grant' && recovery.receiptMatched === true && recovery.storedPriorState === to ? { ok: true } : denied('grant requires matching exact prior state');
  }
  const adjacent = route(change, from, to); if (!adjacent.ok) return adjacent;
  if (to === 'approval-required') return recovery.authorityRequired ? adjacent : denied('approval-required needs an authority-bound operation');
  if (to === 'blocked') return recovery.blockerRecorded ? adjacent : denied('blocked needs a recorded blocker');
  if (from === 'triage' && to === 'discovery') return recovery.riskRecorded ? adjacent : denied('discovery requires recorded risk reasons');
  if (from === 'discovery' && to === 'spec-review') return recovery.specResolves && recovery.schemaValid && recovery.unresolvedDecisionsEmpty ? adjacent : denied('spec review requires resolved valid specification');
  if (from === 'spec-review' && to === 'spec-approved') return recovery.approvalReceiptMatches ? adjacent : denied('spec approval receipt must match spec');
  if (from === 'spec-approved' && to === 'design-review') return recovery.designArtifactResolves ? adjacent : denied('design artifact required');
  if (from === 'design-review' && to === 'design-approved') return recovery.reviewReceiptMatches ? adjacent : denied('design review receipt must match');
  if ((from === 'spec-approved' || from === 'design-approved') && to === 'task-ready') return recovery.validTasks && recovery.gateRegistry && recovery.runtimeWorkspace && recovery.baseline && (from === 'design-approved' || recovery.risk === 'lite') ? { ok: true } : denied('task-ready requires valid tasks, gates, workspace, baseline, and Lite routing');
  if (from === 'task-ready' && to === 'executing') return recovery.dependenciesDone && recovery.baseline && recovery.journalCommitted ? { ok: true } : denied('executing requires dependency-ready task, baseline, and journal');
  if (from === 'executing' && to === 'integration-review') return recovery.allTasksDone && recovery.noActiveOrUnknownRun && recovery.integrationGatesDeclared ? { ok: true } : denied('integration review requires completed tasks and settled runs');
  if (from === 'integration-review' && to === 'release-evidence') return recovery.integrationEvidenceCurrent ? { ok: true } : denied('release evidence must be current');
  if (from === 'release-evidence' && to === 'archived') return recovery.independentCiMatches && recovery.archivalManifestMatches ? { ok: true } : denied('archive requires independent CI and matching archival manifest');
  return adjacent;
}
export function transitionTask(from: TaskState, to: string, context: TransitionContext = {}): TransitionResult {
  if (from === 'blocked') return to === 'ready' && context.receiptMatched && context.newLeaseGeneration ? { ok: true } : denied('blocked task recovery requires matching resolution and new generation');
  const adjacent = route(task, from, to); if (!adjacent.ok) return adjacent;
  if (to === 'blocked') return context.blockerRecorded ? adjacent : denied('blocked needs a recorded blocker');
  if (from === 'pending' && to === 'ready') return context.dependenciesDone && context.taskDefinitionValid ? adjacent : denied('ready requires completed dependencies and valid task');
  if (from === 'ready' && to === 'leased') return context.noActiveLease && context.newLeaseGeneration ? adjacent : denied('lease requires no active lease and generation');
  if (from === 'leased' && to === 'implementing') return context.runMatchesLease ? adjacent : denied('run must match lease');
  if (from === 'implementing' && to === 'verifying') return context.candidateMatchesCas ? adjacent : denied('candidate must match CAS');
  if (from === 'verifying' && to === 'review-required') return context.gatesCurrent ? adjacent : denied('current gates required');
  const reviewPolicy = context.risk === 'lite' ? ['platform-attested', 'human-confirmed', 'agent-asserted'] : ['platform-attested', 'human-confirmed'];
  if (from === 'review-required' && to === 'reviewing') return context.reviewSessionAccepted && reviewPolicy.includes(context.reviewProvenance ?? '') && (context.risk === 'lite' || context.reviewProvenance === 'human-confirmed' || context.independentSession) ? adjacent : denied('accepted reviewer session required by risk policy');
  if (from === 'reviewing' && to === 'done') return context.reviewReceiptAccepted && reviewPolicy.includes(context.reviewProvenance ?? '') && (context.risk === 'lite' || context.reviewProvenance === 'human-confirmed' || context.independentSession) && (context.risk !== 'full' || (context.architectureReceipt && context.securityReceipt && context.nfrReceipt)) ? adjacent : denied('accepted review receipt required by risk policy');
  if ((from === 'verifying' || from === 'reviewing') && to === 'remediation') return context.retryRemaining && context.failureRecorded ? adjacent : denied('remediation requires recorded failure and retry budget');
  if (from === 'remediation' && to === 'ready') return context.newLeaseGeneration ? adjacent : denied('remediation retry needs a fresh generation');
  return adjacent;
}

export type ReconciliationOutcome = { ok: true; runState: 'succeeded' | 'failed' | 'abandoned'; taskState: TaskState; changeState: ChangeState } | { ok: false; code: 'TRANSITION_FORBIDDEN'; detail: string };
export type TerminalRunOutcome = 'succeeded' | 'failed' | 'timed-out' | 'cancelled' | 'abandoned' | 'unknown';
export type RunOutcome = { runState: TerminalRunOutcome; taskState: TaskState; changeState: ChangeState };
export function reduceRunOutcome(runState: TerminalRunOutcome, context: Pick<TransitionContext, 'retryRemaining' | 'sideEffectsKnownAbsent'> & { priorChangeState: ChangeState; currentTaskState?: TaskState; currentChangeState?: ChangeState; replaySafety?: 'pure' | 'idempotent' | 'manual-reconcile'; safeToRetry?: boolean }): RunOutcome {
  if (!['succeeded', 'failed', 'timed-out', 'cancelled', 'abandoned', 'unknown'].includes(runState)) throw new Error('A terminal run outcome is required');
  if (runState === 'unknown') return { runState, taskState: 'blocked', changeState: 'approval-required' };
  if (runState === 'cancelled') return context.sideEffectsKnownAbsent ? { runState, taskState: 'ready', changeState: context.priorChangeState } : { runState, taskState: 'blocked', changeState: 'approval-required' };
  if (runState === 'failed' || runState === 'timed-out') {
    const safeToRetry = context.safeToRetry ?? (context.replaySafety === 'idempotent' || (context.replaySafety === 'pure' && context.sideEffectsKnownAbsent === true));
    if (context.replaySafety === 'manual-reconcile' || !safeToRetry) return { runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' };
    return context.retryRemaining && (context.replaySafety === 'pure' || context.replaySafety === 'idempotent') ? { runState, taskState: 'remediation', changeState: context.priorChangeState } : { runState, taskState: 'blocked', changeState: 'blocked' };
  }
  if (runState === 'abandoned') return { runState, taskState: context.currentTaskState ?? 'blocked', changeState: context.currentChangeState ?? context.priorChangeState };
  return { runState, taskState: 'verifying', changeState: context.priorChangeState };
}
export function reconcileUnknown(context: TransitionContext & { resolvedRunState: 'succeeded' | 'failed' | 'abandoned'; resumeTaskStateOnSuccess?: 'verifying' | 'review-required' | 'reviewing'; priorChangeState?: ChangeState; safeToRetry?: boolean }): ReconciliationOutcome {
  if (!context.reconciliationMatched || !context.priorChangeState) return denied('unknown reconciliation receipt must match') as ReconciliationOutcome;
  if (context.resolvedRunState === 'succeeded') return context.resumeTaskStateOnSuccess && ['verifying', 'review-required', 'reviewing'].includes(context.resumeTaskStateOnSuccess) ? { ok: true, runState: 'succeeded', taskState: context.resumeTaskStateOnSuccess, changeState: context.priorChangeState } : denied('successful reconciliation requires recorded verifying/review state') as ReconciliationOutcome;
  if (context.resolvedRunState === 'failed') return { ok: true, runState: 'failed', taskState: context.retryRemaining ? 'remediation' : 'blocked', changeState: context.retryRemaining ? context.priorChangeState : 'blocked' };
  return context.safeToRetry && context.newLeaseGeneration ? { ok: true, runState: 'abandoned', taskState: 'ready', changeState: context.priorChangeState } : context.safeToRetry ? denied('safe retry requires a new lease generation') as ReconciliationOutcome : { ok: true, runState: 'abandoned', taskState: 'blocked', changeState: 'approval-required' };
}
export function transitionRun(from: RunState, to: string, context: TransitionContext = {}): TransitionResult {
  const adjacent = route(run, from, to); if (!adjacent.ok) return adjacent;
  if (from === 'created' && to === 'running') return context.runMatchesLease ? adjacent : denied('run identity must be committed');
  if (from === 'created' && to === 'cancelled') return context.cancellationReceipt ? adjacent : denied('unstarted cancellation receipt required');
  if (from === 'running' && (to === 'succeeded' || to === 'failed' || to === 'timed-out')) return context.exitEvidenceCommitted ? adjacent : denied('terminal run evidence required');
  if (from === 'running' && to === 'cancelled') return context.cancellationReceipt && context.sideEffectsKnownAbsent ? adjacent : denied('safe cancellation receipt required');
  if (from === 'running' && to === 'abandoned') return context.leaseFenced ? adjacent : denied('abandon requires lease fencing');
  if (from === 'running' && to === 'unknown') return context.outcomeUnknown ? adjacent : denied('unknown requires indeterminate outcome');
  if (from === 'unknown') return context.reconciliationMatched ? adjacent : denied('unknown run requires matching reconciliation receipt');
  return adjacent;
}
