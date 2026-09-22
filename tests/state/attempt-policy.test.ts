import { describe, expect, test } from 'vitest';
import { decideFailedAttempt, failedAttemptCount, previousFindingsHash } from '../../packages/cli/src/state/attempt-policy.ts';

describe('attempt-policy', () => {
  test('first failure remediates', () => {
    expect(decideFailedAttempt({ priorFailures: 0, currentFindingsHash: 'aaa' }))
      .toEqual({ target: 'remediation', nextKind: 'remediation' });
  });

  test('later failure with a new findings hash remediates past four attempts', () => {
    expect(decideFailedAttempt({ priorFailures: 6, previousFindingsHash: 'old', currentFindingsHash: 'new' }))
      .toEqual({ target: 'remediation', nextKind: 'remediation' });
  });

  test('same findings hash after a prior failure blocks as no-progress', () => {
    expect(decideFailedAttempt({ priorFailures: 1, previousFindingsHash: 'same', currentFindingsHash: 'same' }))
      .toEqual({ target: 'blocked', nextKind: 'blocked', reason: 'no-progress' });
  });

  test('second failure with no findings hash blocks as no-progress', () => {
    expect(decideFailedAttempt({ priorFailures: 0 })).toEqual({ target: 'remediation', nextKind: 'remediation' });
    expect(decideFailedAttempt({ priorFailures: 1 })).toEqual({ target: 'blocked', nextKind: 'blocked', reason: 'no-progress' });
    expect(decideFailedAttempt({ priorFailures: 1, previousFindingsHash: '', currentFindingsHash: '' })).toEqual({ target: 'blocked', nextKind: 'blocked', reason: 'no-progress' });
  });

  test('a new nonempty findings hash still remediates when the other side has none', () => {
    expect(decideFailedAttempt({ priorFailures: 1, previousFindingsHash: 'old', currentFindingsHash: 'new' }))
      .toEqual({ target: 'remediation', nextKind: 'remediation' });
    expect(decideFailedAttempt({ priorFailures: 1, currentFindingsHash: 'new' }))
      .toEqual({ target: 'remediation', nextKind: 'remediation' });
    expect(decideFailedAttempt({ priorFailures: 1, previousFindingsHash: 'old' }))
      .toEqual({ target: 'remediation', nextKind: 'remediation' });
  });

  test('reads the last findingsHash for a task', () => {
    const events = [
      { type: 'task.attempt.failed', taskId: 't', payload: { findingsHash: 'one' } },
      { type: 'task.attempt.failed', taskId: 't', payload: { findingsHash: 'two' } },
      { type: 'task.attempt.failed', taskId: 'other', payload: { findingsHash: 'nope' } },
    ];
    expect(failedAttemptCount(events, 't')).toBe(2);
    expect(previousFindingsHash(events, 't')).toBe('two');
  });
});
