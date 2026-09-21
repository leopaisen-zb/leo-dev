import type { BoardColumn, ReviewBadge } from './types.js';

export function boardColumn(state: string): BoardColumn {
  if (state === 'done') return 'done';
  if (state === 'pending' || state === 'ready') return 'todo';
  return 'doing';
}

export function reviewBadge(state: string, lastReviewVerdict?: 'pass' | 'reject'): ReviewBadge {
  if (state === 'review-required' || state === 'reviewing') return 'reviewing';
  if (lastReviewVerdict === 'reject' && (state === 'remediation' || state === 'blocked')) return 'rejected';
  return 'none';
}
