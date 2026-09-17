import type { DesignReviewContext } from './design-policy.js';
import { validateDocumentShape, type ReceiptValue } from '../schema/validate.js';

export type DesignEventInput = { type: string; payload?: unknown };
export type DesignReviewReceipt = ReceiptValue & { changeId: string; specHash: string; planHash: string; designHash: string; producerSession: string; findingsHash: string; verdict: 'pass' | 'reject'; timestamp: string; expiresAt: string };
export type DesignReviewReceiptSource = { relativePath: string; sha256: string; bytesBase64: string };
export type DecodedDesignReviewEvent =
  | { type: 'controller.design.review.requested'; payload: DesignReviewContext }
  | { type: 'receipt.design-review.ingested'; payload: { receipt: DesignReviewReceipt; issuerAuthenticated: boolean; receiptSource?: DesignReviewReceiptSource } };

const hashPattern = /^[a-f0-9]{64}$/;
const asRecord = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const nonemptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export class DesignEventDecodeError extends Error { readonly code = 'DESIGN_EVENT_INVALID'; }
function invalid(message: string): never { throw new DesignEventDecodeError(`Invalid persisted design-review event: ${message}`); }

function decodeContext(value: unknown): DesignReviewContext {
  const context = asRecord(value);
  if (!context || !nonemptyString(context.changeId)
    || !nonemptyString(context.specHash) || !hashPattern.test(context.specHash)
    || !nonemptyString(context.planHash) || !hashPattern.test(context.planHash)
    || !nonemptyString(context.designPath)
    || !nonemptyString(context.designHash) || !hashPattern.test(context.designHash)
    || typeof context.designSourceBase64 !== 'string' || Buffer.from(context.designSourceBase64, 'base64').toString('base64') !== context.designSourceBase64
    || !nonemptyString(context.producerSession)) invalid('request payload does not match DesignReviewContext');
  return context as DesignReviewContext;
}

function decodeReceipt(value: unknown): DesignReviewReceipt {
  const validation = validateDocumentShape('design-review', value);
  if (!validation.ok) invalid(`receipt schema validation failed: ${validation.details.join('; ')}`);
  return validation.value as DesignReviewReceipt;
}

function decodeSource(value: unknown): DesignReviewReceiptSource {
  const source = asRecord(value);
  if (!source || !nonemptyString(source.relativePath) || !nonemptyString(source.sha256) || !hashPattern.test(source.sha256)
    || !nonemptyString(source.bytesBase64) || Buffer.from(source.bytesBase64, 'base64').toString('base64') !== source.bytesBase64) invalid('receiptSource is malformed');
  return source as DesignReviewReceiptSource;
}

export function decodeDesignReviewEvent(event: DesignEventInput): DecodedDesignReviewEvent | undefined {
  if (event.type === 'controller.design.review.requested') return { type: event.type, payload: decodeContext(event.payload) };
  if (event.type !== 'receipt.design-review.ingested') return undefined;
  const payload = asRecord(event.payload);
  if (!payload || typeof payload.issuerAuthenticated !== 'boolean') invalid('receipt envelope is malformed');
  return { type: event.type, payload: { receipt: decodeReceipt(payload.receipt), issuerAuthenticated: payload.issuerAuthenticated, ...(payload.receiptSource === undefined ? {} : { receiptSource: decodeSource(payload.receiptSource) }) } };
}

export function latestDesignReviewContext(events: DesignEventInput[]): DesignReviewContext | undefined {
  const event = events.filter((candidate) => candidate.type === 'controller.design.review.requested').at(-1);
  if (!event) return undefined;
  const decoded = decodeDesignReviewEvent(event);
  if (!decoded || decoded.type !== 'controller.design.review.requested') invalid('request event was not recognized');
  return decoded.payload;
}

export function latestDesignReviewReceipt(events: DesignEventInput[]): DesignReviewReceipt | undefined {
  const event = events.filter((candidate) => candidate.type === 'receipt.design-review.ingested').at(-1);
  if (!event) return undefined;
  const decoded = decodeDesignReviewEvent(event);
  if (!decoded || decoded.type !== 'receipt.design-review.ingested') invalid('receipt event was not recognized');
  return decoded.payload.receipt;
}
