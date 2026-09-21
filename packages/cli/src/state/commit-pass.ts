import { createHash } from 'node:crypto';
import { TREE_IGNORE_POLICY_VERSION } from '../repository/tree-hash.js';
import type { JournalEvent } from './types.js';

type RecordValue = Record<string, unknown>;
type TreeIdentity = { hash: string; entries: string[] };

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

/** Last-task review may project `.leo-dev/changes/**`; those are controller artifacts, not product drift. */
function isControllerChangeArtifact(relativePath: string): boolean {
  return relativePath === '.leo-dev/changes' || relativePath.startsWith('.leo-dev/changes/');
}

export function independentReviewSession(receipt: RecordValue, claimed: { sessionId?: unknown } | undefined): boolean {
  return receipt.provenance === 'human-confirmed'
    || (receipt.provenance === 'platform-attested'
      && typeof claimed?.sessionId === 'string' && claimed.sessionId.length > 0
      && typeof receipt.sessionId === 'string' && receipt.sessionId.length > 0
      && receipt.sessionId !== claimed.sessionId);
}

export function treeMatchesReviewedCandidate(current: TreeIdentity, rawEvents: readonly JournalEvent[], treeHash: string): boolean {
  if (current.hash === treeHash) return true;
  let afterSequence = -1;
  for (let index = 0; index < rawEvents.length; index += 1) {
    const event = rawEvents[index]!;
    if (event.type !== 'controller.batch.prepared') continue;
    const operations = Array.isArray(record(event.payload).operations) ? record(event.payload).operations as RecordValue[] : [];
    if (operations.some((operation) => record(operation).type === 'controller.candidate.registered' && record(record(operation).payload).treeHash === treeHash)) {
      afterSequence = rawEvents[index + 1]?.sequence ?? event.sequence;
    }
  }
  if (afterSequence < 0) return false;
  const entries = current.entries.slice();
  const undos: Array<{ relativePath: string; priorHash: string; desiredHash: string }> = [];
  for (let index = 0; index < rawEvents.length; index += 1) {
    const event = rawEvents[index]!;
    if (event.type !== 'controller.batch.prepared') continue;
    const committed = rawEvents[index + 1];
    if (committed?.type !== 'controller.batch.committed' || committed.sequence <= afterSequence) continue;
    const projections = Array.isArray(record(event.payload).projections) ? record(event.payload).projections as RecordValue[] : [];
    for (const projection of projections) {
      if (typeof projection.relativePath !== 'string' || typeof projection.priorHash !== 'string' || typeof projection.desiredHash !== 'string') continue;
      if (!isControllerChangeArtifact(projection.relativePath)) continue;
      undos.push({ relativePath: projection.relativePath, priorHash: projection.priorHash, desiredHash: projection.desiredHash });
    }
  }
  for (const projection of undos.reverse()) {
    const index = entries.findIndex((entry) => entry.split('\0', 1)[0] === projection.relativePath);
    if (index < 0) return false;
    const parts = entries[index]!.split('\0');
    if (parts[2] !== projection.desiredHash) return false;
    entries[index] = `${parts[0]}\0${parts[1]}\0${projection.priorHash}`;
  }
  return hash(`${TREE_IGNORE_POLICY_VERSION}\n${entries.join('\n')}`) === treeHash;
}

function claimedForRun(events: readonly JournalEvent[], runId: unknown): RecordValue | undefined {
  if (typeof runId !== 'string' || !runId) return undefined;
  const event = events.filter((candidate) => candidate.type === 'run.claimed' && record(candidate.payload).runId === runId).at(-1);
  return event ? record(event.payload) : undefined;
}

export function currentIndependentPass(
  events: readonly JournalEvent[],
  current: TreeIdentity,
  rawEvents: readonly JournalEvent[],
  at = new Date(),
): RecordValue | undefined {
  let latest: RecordValue | undefined;
  for (const event of events) {
    if (event.type !== 'receipt.review.ingested') continue;
    const receipt = record(record(event.payload).receipt);
    if (receipt.verdict !== 'pass' || typeof receipt.treeHash !== 'string') continue;
    if (!independentReviewSession(receipt, claimedForRun(events, receipt.runId))) continue;
    if (typeof receipt.expiresAt === 'string' && Number.isFinite(Date.parse(receipt.expiresAt)) && Date.parse(receipt.expiresAt) <= at.getTime()) continue;
    if (!treeMatchesReviewedCandidate(current, rawEvents, receipt.treeHash)) continue;
    latest = receipt;
  }
  return latest;
}
