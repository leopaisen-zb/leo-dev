import { describe, expect, test } from 'vitest';
import { reconcileUnknown, reduceRunOutcome, transitionChange, transitionRun, transitionTask } from '../../packages/cli/src/state/transition.js';

describe('normative state machines', () => {
  test('permits a listed change route and rejects every unlisted route', () => {
    expect(transitionChange('triage', 'discovery', { riskRecorded: true }).ok).toBe(true);
    expect(transitionChange('design-review', 'spec-approved', { rejectReviewReceiptMatches: true }).ok).toBe(true);
    expect(transitionChange('design-review', 'spec-approved')).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
    expect(transitionChange('design-review', 'spec-approved', { reviewReceiptMatches: true })).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
    expect(transitionChange('triage', 'archived')).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
    expect(transitionChange('archived', 'triage')).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
  });

  test('has no failed task state and requires remediation or blocked after verification failure', () => {
    expect(transitionTask('verifying', 'remediation', { retryRemaining: true, failureRecorded: true }).ok).toBe(true);
    expect(transitionTask('verifying', 'failed')).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
  });

  test('only permits documented run recovery from unknown', () => {
    expect(transitionRun('unknown', 'succeeded', { reconciliationMatched: true }).ok).toBe(true);
    expect(transitionRun('unknown', 'running')).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
  });

  test('requires a matching receipt and exact stored state for change recovery', () => {
    expect(transitionChange('approval-required', 'task-ready', { approvalDecision: 'grant', storedPriorState: 'task-ready', receiptMatched: true }).ok).toBe(true);
    expect(transitionChange('approval-required', 'executing', { approvalDecision: 'grant', storedPriorState: 'task-ready', receiptMatched: true })).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
    expect(transitionChange('blocked', 'task-ready', { approvalDecision: 'grant', storedPriorState: 'task-ready', receiptMatched: false })).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
  });

  test('enforces non-adjacency guards and reconciliation before success', () => {
    expect(transitionChange('release-evidence', 'archived', { independentCiMatches: false })).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
    expect(transitionChange('spec-approved', 'task-ready', { risk: 'lite', validTasks: false, runtimeWorkspace: true, baseline: true, gateRegistry: true })).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
    expect(transitionTask('reviewing', 'done', { reviewReceiptAccepted: false })).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
    expect(transitionRun('unknown', 'succeeded', { reconciliationMatched: false })).toMatchObject({ ok: false, code: 'TRANSITION_FORBIDDEN' });
  });

  test('applies the review matrix and blocks task recovery without a matching resolution', () => {
    expect(transitionTask('reviewing', 'done', { risk: 'lite', reviewReceiptAccepted: true, reviewProvenance: 'agent-asserted', independentSession: true })).toMatchObject({ ok: false });
    expect(transitionTask('reviewing', 'done', { risk: 'standard', reviewReceiptAccepted: true, reviewProvenance: 'agent-asserted', independentSession: true })).toMatchObject({ ok: false });
    expect(transitionTask('reviewing', 'done', { risk: 'standard', reviewReceiptAccepted: true, reviewProvenance: 'platform-attested', independentSession: true }).ok).toBe(true);
    expect(transitionTask('blocked', 'ready', { receiptMatched: false, newLeaseGeneration: true })).toMatchObject({ ok: false });
    expect(transitionTask('blocked', 'ready', { receiptMatched: true, newLeaseGeneration: true }).ok).toBe(true);
    expect(transitionTask('reviewing', 'done', { risk: 'full', reviewReceiptAccepted: true, reviewProvenance: 'human-confirmed' })).toMatchObject({ ok: false });
    expect(transitionTask('reviewing', 'done', { risk: 'full', reviewReceiptAccepted: true, reviewProvenance: 'human-confirmed', architectureReceipt: true, securityReceipt: true, nfrReceipt: true }).ok).toBe(true);
    expect(transitionChange('approval-required', 'blocked', { approvalDecision: 'reject', receiptMatched: true }).ok).toBe(true);
  });

  test('maps unknown reconciliation to the unique cross-layer outcome', () => {
    expect(reconcileUnknown({ resolvedRunState: 'succeeded', reconciliationMatched: false, priorChangeState: 'executing', resumeTaskStateOnSuccess: 'verifying' })).toMatchObject({ ok: false });
    expect(reconcileUnknown({ resolvedRunState: 'succeeded', reconciliationMatched: true, priorChangeState: 'executing', resumeTaskStateOnSuccess: 'verifying' })).toEqual({ ok: true, runState: 'succeeded', taskState: 'verifying', changeState: 'executing' });
    expect(reconcileUnknown({ resolvedRunState: 'abandoned', reconciliationMatched: true, priorChangeState: 'executing', safeToRetry: false })).toEqual({ ok: true, runState: 'abandoned', taskState: 'blocked', changeState: 'approval-required' });
    expect(reconcileUnknown({ resolvedRunState: 'succeeded', reconciliationMatched: true, priorChangeState: 'executing', resumeTaskStateOnSuccess: 'done' as never })).toMatchObject({ ok: false });
    expect(reconcileUnknown({ resolvedRunState: 'abandoned', reconciliationMatched: true, priorChangeState: 'executing', safeToRetry: true })).toMatchObject({ ok: false });
  });

  test('maps unknown, cancellation, and failed runs across all controller layers', () => {
    expect(reduceRunOutcome('unknown', { priorChangeState: 'executing' })).toEqual({ runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' });
    expect(reduceRunOutcome('cancelled', { priorChangeState: 'executing', sideEffectsKnownAbsent: true })).toEqual({ runState: 'cancelled', taskState: 'ready', changeState: 'executing' });
    expect(reduceRunOutcome('failed', { priorChangeState: 'executing', retryRemaining: false })).toEqual({ runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' });
  });

  test('only remediates terminal failures with replay-safe known-absent side effects', () => {
    expect(reduceRunOutcome('failed', { priorChangeState: 'executing', retryRemaining: true, replaySafety: 'manual-reconcile', sideEffectsKnownAbsent: true })).toEqual({ runState: 'unknown', taskState: 'blocked', changeState: 'approval-required' });
    expect(reduceRunOutcome('timed-out', { priorChangeState: 'executing', retryRemaining: true, replaySafety: 'pure', sideEffectsKnownAbsent: true })).toEqual({ runState: 'timed-out', taskState: 'remediation', changeState: 'executing' });
    expect(() => reduceRunOutcome('running' as never, { priorChangeState: 'executing' } as never)).toThrow(/terminal/i);
    expect(reduceRunOutcome('abandoned', { priorChangeState: 'executing', currentTaskState: 'implementing', currentChangeState: 'executing' })).toEqual({ runState: 'abandoned', taskState: 'implementing', changeState: 'executing' });
    expect(reduceRunOutcome('failed', { priorChangeState: 'executing', retryRemaining: true, replaySafety: 'idempotent', sideEffectsKnownAbsent: false })).toEqual({ runState: 'failed', taskState: 'remediation', changeState: 'executing' });
  });

  test('uses human resolution and review provenance rules without a boolean bypass', () => {
    expect(transitionTask('review-required', 'reviewing', { risk: 'standard', reviewSessionAccepted: true, reviewProvenance: 'human-confirmed' }).ok).toBe(true);
    expect(transitionTask('review-required', 'reviewing', { risk: 'standard', reviewSessionAccepted: true, reviewProvenance: 'platform-attested', independentSession: false })).toMatchObject({ ok: false });
    expect(transitionChange('blocked', 'task-ready', { resolutionDecision: 'resume', storedPriorState: 'task-ready', receiptMatched: true }).ok).toBe(true);
    expect(transitionChange('blocked', 'task-ready', { approvalDecision: 'grant', storedPriorState: 'task-ready', receiptMatched: true })).toMatchObject({ ok: false });
  });

  test('does not permit any state-machine edge from adjacency alone', () => {
    const changeStates = ['triage','discovery','spec-review','spec-approved','design-review','design-approved','task-ready','executing','integration-review','release-evidence','archived','approval-required','blocked'] as const;
    const taskStates = ['pending','ready','leased','implementing','verifying','review-required','reviewing','remediation','done','blocked'] as const;
    const runStates = ['created','running','succeeded','failed','timed-out','cancelled','abandoned','unknown'] as const;
    for (const from of changeStates) for (const to of changeStates) expect(transitionChange(from, to).ok, `${from}->${to}`).toBe(false);
    for (const from of taskStates) for (const to of taskStates) expect(transitionTask(from, to).ok, `${from}->${to}`).toBe(false);
    for (const from of runStates) for (const to of runStates) expect(transitionRun(from, to).ok, `${from}->${to}`).toBe(false);
  });
});
