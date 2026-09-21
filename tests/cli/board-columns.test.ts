import { describe, expect, test } from 'vitest';
import { boardColumn, reviewBadge } from '../../packages/cli/src/board/columns.ts';

test('maps controller states onto three columns', () => {
  expect(boardColumn('pending')).toBe('todo');
  expect(boardColumn('ready')).toBe('todo');
  expect(boardColumn('done')).toBe('done');
  for (const state of ['leased', 'implementing', 'verifying', 'review-required', 'reviewing', 'remediation', 'blocked']) {
    expect(boardColumn(state), state).toBe('doing');
  }
});

test('review is a badge, not a column', () => {
  expect(reviewBadge('review-required')).toBe('reviewing');
  expect(reviewBadge('reviewing')).toBe('reviewing');
  expect(reviewBadge('remediation', 'reject')).toBe('rejected');
  expect(reviewBadge('blocked', 'reject')).toBe('rejected');
  expect(reviewBadge('implementing')).toBe('none');
  expect(reviewBadge('ready')).toBe('none');
  expect(reviewBadge('done', 'pass')).toBe('none');
});
