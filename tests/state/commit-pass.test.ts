import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { TREE_IGNORE_POLICY_VERSION } from '../../packages/cli/src/repository/tree-hash.ts';
import {
  currentIndependentPass,
  independentReviewSession,
  treeMatchesReviewedCandidate,
} from '../../packages/cli/src/state/commit-pass.ts';
import type { JournalEvent } from '../../packages/cli/src/state/types.ts';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function entry(path: string, mode: string, contentHash: string): string {
  return `${path}\0${mode}\0${contentHash}`;
}
function tree(entries: string[]): { hash: string; entries: string[] } {
  return { hash: digest(`${TREE_IGNORE_POLICY_VERSION}\n${entries.join('\n')}`), entries };
}
function journalEvent(sequence: number, type: string, payload: unknown): JournalEvent {
  return {
    sequence, previousEventHash: '0'.repeat(64), changeId: 'work', type,
    timestamp: '2026-01-01T00:00:00.000Z', payloadHash: '1'.repeat(64),
    eventHash: String(sequence).padStart(64, '0'), payload,
  };
}
function candidateBatch(sequence: number, treeHash: string): JournalEvent[] {
  return [
    journalEvent(sequence, 'controller.batch.prepared', {
      version: 1, batchId: `cand-${sequence}`, kind: 'gate',
      operations: [{ type: 'controller.candidate.registered', payload: { treeHash } }],
      projections: [],
    }),
    journalEvent(sequence + 1, 'controller.batch.committed', { version: 1, batchId: `cand-${sequence}` }),
  ];
}
function projectionBatch(sequence: number, relativePath: string, priorHash: string, desiredHash: string): JournalEvent[] {
  return [
    journalEvent(sequence, 'controller.batch.prepared', {
      version: 1, batchId: `proj-${sequence}`, kind: 'review', operations: [],
      projections: [{ relativePath, priorHash, desiredHash, desiredValue: {} }],
    }),
    journalEvent(sequence + 1, 'controller.batch.committed', { version: 1, batchId: `proj-${sequence}` }),
  ];
}

describe('independentReviewSession', () => {
  test('accepts human-confirmed without a claimed session', () => {
    expect(independentReviewSession({ provenance: 'human-confirmed' }, undefined)).toBe(true);
  });

  test('accepts platform-attested only when both sessions are nonempty and differ', () => {
    expect(independentReviewSession({ provenance: 'platform-attested', sessionId: 'reviewer' }, { sessionId: 'implementer' })).toBe(true);
    expect(independentReviewSession({ provenance: 'platform-attested', sessionId: 'same' }, { sessionId: 'same' })).toBe(false);
    expect(independentReviewSession({ provenance: 'platform-attested', sessionId: 'reviewer' }, { sessionId: '' })).toBe(false);
    expect(independentReviewSession({ provenance: 'platform-attested', sessionId: 'reviewer' }, undefined)).toBe(false);
    expect(independentReviewSession({ provenance: 'platform-attested', sessionId: '' }, { sessionId: 'implementer' })).toBe(false);
  });

  test('rejects agent-asserted even with different sessions', () => {
    expect(independentReviewSession({ provenance: 'agent-asserted', sessionId: 'reviewer' }, { sessionId: 'implementer' })).toBe(false);
  });
});

describe('treeMatchesReviewedCandidate', () => {
  const code = digest('code');
  const edited = digest('edited');
  const priorManifest = digest('old-manifest');
  const desiredManifest = digest('new-manifest');
  const artifact = '.leo-dev/changes/work/manifest.yaml';
  const product = 'src/a.ts';

  test('matches an unchanged tree hash', () => {
    const current = tree([entry(product, '644', code)]);
    expect(treeMatchesReviewedCandidate(current, [], current.hash)).toBe(true);
  });

  test('allows a later controller change-artifact projection', () => {
    const candidate = tree([entry(artifact, '600', priorManifest), entry(product, '644', code)]);
    const current = tree([entry(artifact, '600', desiredManifest), entry(product, '644', code)]);
    const rawEvents = [...candidateBatch(1, candidate.hash), ...projectionBatch(3, artifact, priorManifest, desiredManifest)];
    expect(treeMatchesReviewedCandidate(current, rawEvents, candidate.hash)).toBe(true);
  });

  test('rejects a product-file edit after the candidate', () => {
    const candidate = tree([entry(artifact, '600', priorManifest), entry(product, '644', code)]);
    const current = tree([entry(artifact, '600', desiredManifest), entry(product, '644', edited)]);
    const rawEvents = [...candidateBatch(1, candidate.hash), ...projectionBatch(3, artifact, priorManifest, desiredManifest)];
    expect(treeMatchesReviewedCandidate(current, rawEvents, candidate.hash)).toBe(false);
  });

  test('does not undo a later product-file projection', () => {
    const candidate = tree([entry(product, '644', code)]);
    const current = tree([entry(product, '644', edited)]);
    const rawEvents = [...candidateBatch(1, candidate.hash), ...projectionBatch(3, product, code, edited)];
    expect(treeMatchesReviewedCandidate(current, rawEvents, candidate.hash)).toBe(false);
  });
});

describe('currentIndependentPass', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');
  const current = tree([entry('src/a.ts', '644', 'aaa')]);
  const passReceipt = {
    verdict: 'pass', treeHash: current.hash, provenance: 'platform-attested',
    sessionId: 'reviewer', runId: 'run-1', expiresAt: '2026-07-01T00:00:00.000Z',
  };

  test('requires a distinct claimed implementer session for platform-attested', () => {
    const claimed = journalEvent(1, 'run.claimed', { runId: 'run-1', sessionId: 'implementer' });
    const ingested = journalEvent(2, 'receipt.review.ingested', { receipt: passReceipt });
    expect(currentIndependentPass([claimed, ingested], current, [], now)?.sessionId).toBe('reviewer');
    const same = journalEvent(1, 'run.claimed', { runId: 'run-1', sessionId: 'reviewer' });
    expect(currentIndependentPass([same, ingested], current, [], now)).toBeUndefined();
  });

  test('skips an expired pass', () => {
    const claimed = journalEvent(1, 'run.claimed', { runId: 'run-1', sessionId: 'implementer' });
    const ingested = journalEvent(2, 'receipt.review.ingested', { receipt: { ...passReceipt, expiresAt: '2026-01-01T00:00:00.000Z' } });
    expect(currentIndependentPass([claimed, ingested], current, [], now)).toBeUndefined();
  });
});
