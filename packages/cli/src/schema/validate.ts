import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import * as formatsModule from 'ajv-formats';
import type { TaskDefinition } from '../state/types.js';
import { documentKinds, loadSchemas, type DocumentKind } from './load.js';

export { documentKinds, type DocumentKind } from './load.js';

export type Validation = { ok: true; value: unknown } | { ok: false; code: 'SCHEMA_INVALID' | 'RECEIPT_EXPIRED' | 'RECEIPT_NOT_YET_VALID'; details: string[] };
export type ReceiptKind = Extract<DocumentKind, 'review' | 'design-review' | 'release-ci' | 'approval' | 'waiver' | 'resolution' | 'reconciliation'>;
export type ReceiptValue = Record<string, unknown> & { receiptId: string; provenance: string; actorLabel: string };
export type ReceiptValidation<K extends ReceiptKind = ReceiptKind> =
  | { ok: true; kind: K; value: ReceiptValue }
  | { ok: false; kind: K; code: 'SCHEMA_INVALID' | 'RECEIPT_EXPIRED' | 'RECEIPT_NOT_YET_VALID'; details: string[] };

const ajv = new Ajv2020({ allErrors: true, strict: true });
const addFormats = (formatsModule as unknown as { default: (instance: Ajv2020) => void }).default;
addFormats(ajv);
const schemas = await loadSchemas();
for (const kind of documentKinds) ajv.addSchema(schemas[kind]);
const schemaId = (schema: object) => (schema as { $id?: string }).$id;
const compiled = Object.fromEntries(documentKinds.map((kind) => [kind, ajv.getSchema(schemaId(schemas[kind])!)!])) as Record<DocumentKind, ValidateFunction>;
const details = (errors: ErrorObject[] | null | undefined) => (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'invalid'}`);
const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
const timestamp = (value: unknown) => typeof value === 'string' ? Date.parse(value) : Number.NaN;

function semanticErrors(kind: DocumentKind, value: Record<string, unknown>, now: Date, maxFutureSkewMs: number): string[] {
  const errors: string[] = [];
  const expiresAt = timestamp(value.expiresAt);
  if ('expiresAt' in value && Number.isFinite(expiresAt) && expiresAt <= now.getTime()) errors.push('receipt has expired');
  const startsAt = kind === 'approval' ? timestamp(value.grantedAt) : timestamp(value.timestamp);
  if (['approval', 'review', 'design-review', 'release-ci', 'waiver', 'resolution', 'reconciliation'].includes(kind) && Number.isFinite(startsAt) && startsAt > now.getTime() + maxFutureSkewMs) errors.push('receipt timestamp is in the future');
  if ('expiresAt' in value && Number.isFinite(startsAt) && Number.isFinite(expiresAt) && startsAt >= expiresAt) errors.push('receipt timestamp must be before expiry');
  if (kind === 'reconciliation') {
    if (value.resolvedRunState === 'succeeded' && value.safeToRetry !== false) errors.push('succeeded reconciliation cannot be retried');
    if (value.resolvedRunState === 'succeeded' && value.sideEffectDisposition !== 'completed') errors.push('succeeded reconciliation requires completed side effects');
    if (value.safeToRetry === true && !['failed', 'abandoned'].includes(String(value.resolvedRunState))) errors.push('only failed or abandoned runs can be retried');
    if (value.safeToRetry === true && !['failed', 'not-started', 'side-effects-absent'].includes(String(value.sideEffectDisposition))) errors.push('retry requires known retry-safe side effects');
  }
  if (kind === 'resolution' && value.scope === 'change' && value.targetRecoveryState === 'ready') errors.push('change recovery must return to its stored ChangeState');
  return errors;
}

export function validateDocument(kind: DocumentKind, value: unknown, now = new Date(), maxFutureSkewMs = 0): Validation {
  const validate = compiled[kind];
  if (!validate(value)) return { ok: false, code: 'SCHEMA_INVALID', details: details(validate.errors) };
  if (!Number.isFinite(maxFutureSkewMs) || maxFutureSkewMs < 0) return { ok: false, code: 'SCHEMA_INVALID', details: ['future clock skew must be a non-negative finite duration'] };
  const errors = semanticErrors(kind, asRecord(value), now, maxFutureSkewMs);
  if (errors.length > 0) {
    const nonTemporal = errors.filter((error) => error !== 'receipt has expired' && error !== 'receipt timestamp is in the future');
    const code = nonTemporal.length > 0 ? 'SCHEMA_INVALID' : errors.includes('receipt has expired') ? 'RECEIPT_EXPIRED' : 'RECEIPT_NOT_YET_VALID';
    return { ok: false, code, details: errors };
  }
  const expiresAt = timestamp(asRecord(value).expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) return { ok: false, code: 'RECEIPT_EXPIRED', details: ['receipt has expired'] };
  return { ok: true, value };
}

export function validateReceipt<K extends ReceiptKind>(kind: K, value: unknown, now = new Date(), maxFutureSkewMs = 0): ReceiptValidation<K> {
  const validation = validateDocument(kind, value, now, maxFutureSkewMs);
  return validation.ok
    ? { ok: true, kind, value: validation.value as ReceiptValue }
    : { ...validation, kind };
}

export const validateTaskDefinition = (value: unknown) => validateDocument('task', value) as Validation & { value?: TaskDefinition };
