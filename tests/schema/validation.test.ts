import { describe, expect, test } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';
import { loadSchema } from '../../packages/cli/src/schema/load.js';
import { documentKinds, validateDocument, validateReceipt } from '../../packages/cli/src/schema/validate.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));

describe('controller schemas', () => {
  test('rejects unknown state and free-form task commands at changing boundaries', () => {
    expect(validateDocument('change', { id: 'c', state: 'made-up' }).code).toBe('SCHEMA_INVALID');
    expect(validateDocument('task', { id: 't', revision: 1, state: 'ready', command: 'rm -rf /', dependsOn: [], allowedPaths: ['src'], acceptance: [], gateIds: [], risk: 'lite' }).code).toBe('SCHEMA_INVALID');
  });

  test('rejects traversal allowed paths and expired approvals', () => {
    expect(validateDocument('task', { id: 't', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['../src'], acceptance: [], gateIds: [], risk: 'lite' }).code).toBe('SCHEMA_INVALID');
    expect(validateDocument('approval', { receiptId: 'a', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2020-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z', changeId: 'c', scope: 'change', operationKind: 'external-write', decisionFingerprint: 'a'.repeat(64), gateDefinitionFingerprint: 'b'.repeat(64), argvFingerprint: 'c'.repeat(64), cwdFingerprint: 'd'.repeat(64), environmentFingerprint: 'e'.repeat(64), inputFingerprint: 'f'.repeat(64) }).code).toBe('RECEIPT_EXPIRED');
  });

  test('rejects POSIX, Windows, and mixed-separator path escapes', () => {
    for (const allowedPath of ['/tmp', '\\server\\share', 'C:\\temp', '..\\src', 'src\\..\\secret', 'src/../secret']) {
      expect(validateDocument('task', { id: 't', revision: 1, state: 'ready', dependsOn: [], allowedPaths: [allowedPath], acceptance: [], gateIds: [], risk: 'lite' }).code, allowedPath).toBe('SCHEMA_INVALID');
    }
  });

  test('loads and compiles every JSON schema as the runtime authority', async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const kind of documentKinds) {
      const schema = await loadSchema(kind);
      expect(() => ajv.addSchema(schema)).not.toThrow();
    }
    for (const kind of documentKinds) {
      const schema = await loadSchema(kind) as { $id: string };
      expect(ajv.getSchema(schema.$id), kind).toBeDefined();
    }
    expect(JSON.stringify(await loadSchema('task-plan'))).toContain('"$ref":"urn:leo-dev:task"');
  });

  test('uses the injected clock for every receipt expiry decision', () => {
    const approval = {
      receiptId: 'a', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2019-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z', changeId: 'c', scope: 'change', operationKind: 'external-write', decisionFingerprint: 'a'.repeat(64), gateDefinitionFingerprint: 'b'.repeat(64), argvFingerprint: 'c'.repeat(64), cwdFingerprint: 'd'.repeat(64), environmentFingerprint: 'e'.repeat(64), inputFingerprint: 'f'.repeat(64)
    };
    expect(validateDocument('approval', approval, new Date('2019-06-01T00:00:00.000Z')).ok).toBe(true);
  });

  test('returns a discriminated receipt result for transition consumers', () => {
    const now = new Date();
    const result = validateReceipt('resolution', {
      receiptId: 'resolution', blockerId: 'blocker', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'resume', scope: 'task', changeId: 'change', taskId: 'task', taskRevision: 1, leaseGeneration: 1, artifactHashes: ['a'.repeat(64)], targetRecoveryState: 'ready', timestamp: new Date(now.getTime() - 60_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString()
    });
    expect(result).toMatchObject({ ok: true, kind: 'resolution' });
  });

  test('rejects otherwise-valid receipt issue times in the future using the injected trusted clock', async () => {
    const now = new Date('2026-09-05T12:00:00.000Z');
    for (const [kind, startField] of [
      ['approval', 'grantedAt'],
      ['review', 'timestamp'],
      ['waiver', 'timestamp'],
      ['resolution', 'timestamp'],
      ['reconciliation', 'timestamp'],
    ] as const) {
      const value = JSON.parse(await readFile(join(testDirectory, '../fixtures/schema/valid', `${kind}.json`), 'utf8')) as Record<string, unknown>;
      value[startField] = '2026-09-05T12:00:01.000Z';
      value.expiresAt = '2026-09-05T13:00:00.000Z';
      expect(validateDocument(kind, value, now).code, kind).toBe('RECEIPT_NOT_YET_VALID');
    }
  });

  test('requires mutually exclusive exact waiver targets by scope', () => {
    const base = { receiptId: 'waiver', provenance: 'human-confirmed', actorLabel: 'Leo', risk: 'lite', waivedRequirements: ['risk-routing'], timestamp: '2026-09-05T11:00:00.000Z', expiresAt: '2026-09-05T13:00:00.000Z' };
    const clock = new Date('2026-09-05T12:00:00.000Z');
    expect(validateReceipt('waiver', { ...base, scope: 'change' }, clock).ok).toBe(false);
    expect(validateReceipt('waiver', { ...base, scope: 'change', changeId: 'change', taskId: 'surplus' }, clock).ok).toBe(false);
    expect(validateReceipt('waiver', { ...base, scope: 'change', changeId: 'change' }, clock).ok).toBe(true);
    expect(validateReceipt('waiver', { ...base, scope: 'task', changeId: 'change' }, clock).ok).toBe(false);
    expect(validateReceipt('waiver', { ...base, scope: 'task', changeId: 'change', taskId: 'task' }, clock).ok).toBe(true);
  });

  test('enforces RFC3339 receipt times and receipt ordering', () => {
    const approval = {
      receiptId: 'a', provenance: 'human-confirmed', actorLabel: 'Leo', decision: 'grant', grantedAt: '2099-01-02T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z', changeId: 'c', taskId: 't', scope: 'task', operationKind: 'external-write', decisionFingerprint: 'a'.repeat(64), gateDefinitionFingerprint: 'b'.repeat(64), argvFingerprint: 'c'.repeat(64), cwdFingerprint: 'd'.repeat(64), environmentFingerprint: 'e'.repeat(64), inputFingerprint: 'f'.repeat(64)
    };
    expect(validateDocument('approval', approval).code).toBe('SCHEMA_INVALID');
    expect(validateDocument('evidence', { id: 'e', runId: 'r', taskId: 't', taskRevision: 1, leaseGeneration: 1, treeHash: 'a'.repeat(64), operationFingerprint: 'b'.repeat(64), artifactHashes: ['c'.repeat(64)], timestamp: 'not-a-date' }).code).toBe('SCHEMA_INVALID');
  });

  test('rejects under-constrained receipt hashes and inconsistent reconciliation', () => {
    const reconciliation = {
      receiptId: 'r', runId: 'run', taskId: 'task', taskRevision: 1, leaseGeneration: 1, operationFingerprint: 'a'.repeat(64), inputTreeHash: 'b'.repeat(64), evidenceHashes: ['c'.repeat(64)], resolvedRunState: 'succeeded', sideEffectDisposition: 'completed', safeToRetry: true, provenance: 'human-confirmed', actorLabel: 'Leo', timestamp: '2099-01-01T00:00:00.000Z', expiresAt: '2099-01-02T00:00:00.000Z'
    };
    expect(validateDocument('reconciliation', reconciliation).code).toBe('SCHEMA_INVALID');
    expect(validateDocument('review', { receiptId: 'review', provenance: 'agent-asserted', actorLabel: 'agent', sessionId: 's', runId: 'r', taskId: 't', taskRevision: 1, leaseGeneration: 1, specHash: 'short', taskHash: 'a'.repeat(64), treeHash: 'b'.repeat(64), findingsHash: 'c'.repeat(64), verdict: 'pass', timestamp: '2099-01-01T00:00:00.000Z', expiresAt: '2099-01-02T00:00:00.000Z' }).code).toBe('SCHEMA_INVALID');
  });

  test('validates artifact templates against explicit artifact-envelope schemas', async () => {
    const templates = [
      ['manifest', 'change-manifest'],
      ['tasks', 'task-plan'],
      ['spec', 'spec-ref'],
    ] as const;
    for (const [template, kind] of templates) {
      const value = YAML.parse(await readFile(join(testDirectory, '../../core/templates', `${template}.yaml`), 'utf8'));
      expect(validateDocument(kind, value).ok, template).toBe(true);
    }
  });

  test('accepts a gate-referenced task without an arbitrary command field', () => {
    expect(validateDocument('task', { id: 't', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/**'], acceptance: ['works'], gateIds: ['unit'], risk: 'lite' }).ok).toBe(true);
  });

  test('covers every receipt and operational document fixture', async () => {
    const fixtures = join(testDirectory, '../fixtures/schema');
    const fixtureKind = (name: string) => {
      const stem = name.replace(/\.json$/, '');
      const kind = [...documentKinds].sort((left, right) => right.length - left.length).find((candidate) => stem === candidate || stem.startsWith(`${candidate}-`));
      if (!kind) throw new Error(`fixture has no document kind: ${name}`);
      return kind;
    };
    for (const name of await readdir(join(fixtures, 'valid'))) {
      const kind = fixtureKind(name);
      expect(validateDocument(kind, JSON.parse(await readFile(join(fixtures, 'valid', name), 'utf8')), new Date('2099-01-01T12:00:00.000Z')).ok, name).toBe(true);
    }
    for (const name of await readdir(join(fixtures, 'invalid'))) {
      const kind = fixtureKind(name);
      expect(validateDocument(kind, JSON.parse(await readFile(join(fixtures, 'invalid', name), 'utf8')), new Date('2099-01-01T12:00:00.000Z')).ok, name).toBe(false);
    }
  });
});
