import { createHash } from 'node:crypto';
import { captureDesignReviewContext, designSourceIsCurrent, normalizedPlanHash, routedRisk, type DesignReviewContext, type RoutedPlan } from './design-policy.js';
import { latestDesignReviewContext, latestDesignReviewReceipt, type DesignEventInput, type DesignReviewReceipt } from './design-events.js';
import { validateReceipt } from '../schema/validate.js';

export type DesignAuthority = { specHash: string };
export type DesignAdmissionHistory = { context?: DesignReviewContext; receipt?: DesignReviewReceipt; hasReceipt: boolean };
export type PreparedDesignReceipt = { absolutePath: string; relativePath: string };
export type AcquiredDesignReceipt = { absolutePath: string; relativePath: string; bytes: Buffer; receipt: DesignReviewReceipt };
export type ClaimDesignReceipt = { receipt: DesignReviewReceipt; source: { relativePath: string; sha256: string; bytesBase64: string }; designSource: { relativePath: string; sha256: string } };

export class DesignAdmissionError extends Error {
  constructor(readonly exitCode: 2 | 3 | 5 | 7, readonly publicCode: string, message: string) { super(message); }
}

const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const fail = (exitCode: 2 | 3 | 5 | 7, publicCode: string, message: string): never => { throw new DesignAdmissionError(exitCode, publicCode, message); };

export function decodeDesignAdmissionHistory(events: DesignEventInput[]): DesignAdmissionHistory {
  return {
    context: latestDesignReviewContext(events),
    receipt: latestDesignReviewReceipt(events),
    hasReceipt: events.some((event) => event.type === 'receipt.design-review.ingested'),
  };
}

function requireNonLite(routes: RoutedPlan[], message: string, exitCode: 3 | 7 = 3): void {
  if (routedRisk(routes) === 'lite') fail(exitCode, exitCode === 3 ? 'TRANSITION_FORBIDDEN' : 'BLOCKED', message);
}

function currentContext(changeId: string, routes: RoutedPlan[], authority: DesignAuthority | undefined, context: DesignReviewContext | undefined, sourceDriftMessage: string): DesignReviewContext {
  if (!context || !authority || context.changeId !== changeId || context.specHash !== authority.specHash || context.planHash !== normalizedPlanHash(routes)) {
    return fail(5, 'CONFLICT', sourceDriftMessage);
  }
  return context;
}

function independentBoundReceipt(context: DesignReviewContext, receipt: DesignReviewReceipt, verdict: DesignReviewReceipt['verdict']): void {
  if (receipt.verdict !== verdict || Object.entries({ changeId: context.changeId, specHash: context.specHash, planHash: context.planHash, designHash: context.designHash, producerSession: context.producerSession }).some(([key, value]) => receipt[key] !== value)) {
    fail(5, 'CONFLICT', 'Design review receipt does not exactly match the current immutable context; issuer was not authenticated');
  }
  if (receipt.provenance === 'agent-asserted' || (receipt.provenance === 'platform-attested' && receipt.sessionId === context.producerSession)) {
    fail(5, 'CONFLICT', 'Design review is not independent; issuer was not authenticated');
  }
}

export async function requestDesignReview(input: { repositoryRoot: string; changeId: string; routes: RoutedPlan[]; authority?: DesignAuthority; acquireRequest: () => { design: string; producerSession: string } }): Promise<DesignReviewContext> {
  requireNonLite(input.routes, 'Design transitions are only available for Standard or Full routes');
  const authority = input.authority;
  if (!authority) return fail(7, 'BLOCKED', 'Design transition requires current specification authority');
  const request = input.acquireRequest();
  try {
    return await captureDesignReviewContext(input.repositoryRoot, { changeId: input.changeId, specHash: authority.specHash, planHash: normalizedPlanHash(input.routes), design: request.design, producerSession: request.producerSession });
  } catch (error) {
    return fail(2, 'VALIDATION_ERROR', error instanceof Error ? error.message : String(error));
  }
}

export async function approveDesignReview(input: { repositoryRoot: string; changeId: string; routes: RoutedPlan[]; authority?: DesignAuthority; context: () => DesignReviewContext | undefined; acquireReceipt: () => Promise<AcquiredDesignReceipt>; receiptIdUsed: (receiptId: string) => boolean }): Promise<{ context: DesignReviewContext; acquired: AcquiredDesignReceipt }> {
  requireNonLite(input.routes, 'Design transitions are only available for Standard or Full routes');
  if (!input.authority) return fail(7, 'BLOCKED', 'Design transition requires current specification authority');
  const context = currentContext(input.changeId, input.routes, input.authority, input.context(), 'Design review source or authority has drifted');
  if (!await designSourceIsCurrent(input.repositoryRoot, context)) fail(5, 'CONFLICT', 'Design review source or authority has drifted');
  const acquired = await input.acquireReceipt();
  if (input.receiptIdUsed(acquired.receipt.receiptId)) fail(5, 'CONFLICT', 'Design review receipt ID has already been consumed; issuer was not authenticated');
  independentBoundReceipt(context, acquired.receipt, 'pass');
  return { context, acquired };
}

export async function rejectDesignReview(input: { repositoryRoot: string; changeId: string; routes: RoutedPlan[]; authority?: DesignAuthority; context: () => DesignReviewContext | undefined; acquireReceipt: () => Promise<AcquiredDesignReceipt>; receiptIdUsed: (receiptId: string) => boolean }): Promise<{ context: DesignReviewContext; acquired: AcquiredDesignReceipt }> {
  requireNonLite(input.routes, 'Design transitions are only available for Standard or Full routes');
  if (!input.authority) return fail(7, 'BLOCKED', 'Design transition requires current specification authority');
  const context = currentContext(input.changeId, input.routes, input.authority, input.context(), 'Design review source or authority has drifted');
  if (!await designSourceIsCurrent(input.repositoryRoot, context)) fail(5, 'CONFLICT', 'Design review source or authority has drifted');
  const acquired = await input.acquireReceipt();
  if (input.receiptIdUsed(acquired.receipt.receiptId)) fail(5, 'CONFLICT', 'Design review receipt ID has already been consumed; issuer was not authenticated');
  independentBoundReceipt(context, acquired.receipt, 'reject');
  return { context, acquired };
}

export async function assertFreshApprovedDesign(input: { repositoryRoot: string; changeId: string; routes: RoutedPlan[]; authority?: DesignAuthority; history: DesignAdmissionHistory }): Promise<DesignReviewContext> {
  requireNonLite(input.routes, 'Lite changes do not have a non-Lite design approval context', 7);
  const context = input.history.context; const receipt = input.history.receipt;
  const authority = input.authority;
  if (!context || !receipt || !authority || context.changeId !== input.changeId || context.specHash !== authority.specHash || context.planHash !== normalizedPlanHash(input.routes)) {
    return fail(5, 'CONFLICT', 'Non-Lite design evidence is absent or bound to stale authority');
  }
  if (!await designSourceIsCurrent(input.repositoryRoot, context)) return fail(5, 'CONFLICT', 'Design source has drifted from its immutable reviewed binding');
  const validation = validateReceipt('design-review', receipt);
  if (!validation.ok || receipt.verdict !== 'pass') return fail(5, 'CONFLICT', 'Design review receipt is expired, invalid, or non-passing');
  return context;
}

export async function claimDesignReceiptPlan(input: { repositoryRoot: string; changeId: string; routes: RoutedPlan[]; authority?: DesignAuthority; hasPriorReceipt: () => boolean; context: () => DesignReviewContext | undefined; prepareReceipt: () => Promise<PreparedDesignReceipt>; acquireReceipt: (prepared: PreparedDesignReceipt) => Promise<AcquiredDesignReceipt>; receiptIdUsed: (receiptId: string) => boolean }): Promise<ClaimDesignReceipt> {
  requireNonLite(input.routes, 'Design review receipts are only available for Standard or Full routes');
  if (!input.hasPriorReceipt()) return fail(5, 'CONFLICT', 'Fresh claim design review requires existing approved design history');
  const prepared = await input.prepareReceipt();
  const planned = await approveDesignReview({
    repositoryRoot: input.repositoryRoot,
    changeId: input.changeId,
    routes: input.routes,
    authority: input.authority,
    context: input.context,
    acquireReceipt: () => input.acquireReceipt(prepared),
    receiptIdUsed: input.receiptIdUsed,
  });
  return {
    receipt: planned.acquired.receipt,
    source: { relativePath: planned.acquired.relativePath, sha256: hash(planned.acquired.bytes), bytesBase64: planned.acquired.bytes.toString('base64') },
    designSource: { relativePath: planned.context.designPath, sha256: planned.context.designHash },
  };
}

export function validateClaimDesignEvidence(input: { changeId: string; routes: RoutedPlan[]; authority?: DesignAuthority; history: DesignAdmissionHistory; receipt: DesignReviewReceipt; at: Date; fresh: boolean; receiptIdUsed: boolean }): DesignReviewContext {
  const context = input.history.context;
  if (routedRisk(input.routes) === 'lite' || !context || !input.authority || context.changeId !== input.changeId
    || context.specHash !== input.authority.specHash || context.planHash !== normalizedPlanHash(input.routes)
    || hash(Buffer.from(context.designSourceBase64, 'base64')) !== context.designHash
    || !validateReceipt('design-review', input.receipt, input.at).ok || input.receipt.verdict !== 'pass'
    || Object.entries({ changeId: input.changeId, specHash: context.specHash, planHash: context.planHash, designHash: context.designHash, producerSession: context.producerSession }).some(([key, value]) => input.receipt[key] !== value)
    || input.receipt.provenance === 'agent-asserted' || (input.receipt.provenance === 'platform-attested' && input.receipt.sessionId === context.producerSession)) {
    return fail(5, 'CONFLICT', 'Claim design evidence is invalid, expired, non-independent, or bound to stale authority at preparation');
  }
  if (input.fresh && (!input.history.hasReceipt || input.receiptIdUsed)) {
    return fail(5, 'CONFLICT', 'Fresh claim design receipt requires prior approval and an unused receipt ID');
  }
  return context;
}
