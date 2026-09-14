import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';
import { explainRisk } from '../../packages/cli/src/routing/explain.js';
import { parseRiskRules, routeRisk, type RiskFacts } from '../../packages/cli/src/routing/score.js';

const now = new Date('2026-09-05T12:00:00.000Z');
const testDirectory = dirname(fileURLToPath(import.meta.url));
type CorpusCase = { id: string; input: RiskFacts; expectedRisk: 'lite' | 'standard' | 'full' };

async function corpus(): Promise<CorpusCase[]> {
  const parsed = YAML.parse(await readFile(join(testDirectory, 'corpus.yaml'), 'utf8')) as { version: number; cases: CorpusCase[] };
  expect(parsed.version).toBe(1);
  expect(parsed.cases).toHaveLength(9);
  return parsed.cases;
}

const localBug: RiskFacts = { contract: 'local', data: 'none', security: 'none', infrastructure: 'none', reversibility: 'easy', blastRadius: 'local', codeSpread: 'single-file', unresolvedDecisions: 0 };
const multiFile: RiskFacts = { ...localBug, data: 'local', blastRadius: 'broad' };

describe('deterministic risk routing', () => {
  test('freezes the nine policy corpus routes and stable contribution ordering', async () => {
    for (const entry of await corpus()) {
      const first = await routeRisk(entry.input, { now });
      const second = await routeRisk(entry.input, { now });
      expect(first.finalRisk, entry.id).toBe(entry.expectedRisk);
      expect(second).toEqual(first);
      expect(first.contributions.map((contribution) => contribution.dimension)).toEqual(['contract', 'data', 'security', 'infrastructure', 'reversibility', 'blastRadius', 'codeSpread', 'unresolvedDecisions']);
      expect(first.reasonCodes).toEqual([...first.reasonCodes].sort());
    }
  });

  test('allows a requested raise without a waiver', async () => {
    const result = await routeRisk(localBug, { now, requestedRisk: 'full' });
    expect(result).toMatchObject({ baselineRisk: 'lite', finalRisk: 'full', override: { kind: 'raise', requestedRisk: 'full' } });
  });

  test('routes a multi-file code change to at least Standard without relying on score aggregation', async () => {
    await expect(routeRisk({ ...localBug, codeSpread: 'multi-file' }, { now })).resolves.toMatchObject({ policyFloor: 'standard', finalRisk: 'standard' });
  });

  test('allows a valid exact-target waiver to lower a waivable route', async () => {
    const result = await routeRisk(multiFile, { now, scope: 'task', changeId: 'change', taskId: 'task', requestedRisk: 'lite', waiver: validWaiver('lite') });
    expect(result).toMatchObject({ baselineRisk: 'standard', finalRisk: 'lite', override: { kind: 'waiver', requestedRisk: 'lite', receiptId: 'waiver' } });
    expect(result.waiver).toMatchObject({ valid: true, provenance: 'human-confirmed', issuerAuthenticated: false });
  });

  test('rejects invalid lowering waivers and attempts to cross non-waivable floors', async () => {
    await expect(routeRisk(multiFile, { now, scope: 'task', changeId: 'other', taskId: 'task', requestedRisk: 'lite', waiver: validWaiver('lite') })).rejects.toThrow('exact target');
    await expect(routeRisk(multiFile, { now, scope: 'task', changeId: 'change', taskId: 'task', requestedRisk: 'lite', waiver: { ...validWaiver('lite'), expiresAt: '2026-09-05T11:59:59.000Z' } })).rejects.toThrow('RECEIPT_EXPIRED');
    await expect(routeRisk(multiFile, { now, scope: 'task', changeId: 'change', taskId: 'task', requestedRisk: 'lite', waiver: { ...validWaiver('lite'), scope: 'change' } })).rejects.toThrow('SCHEMA_INVALID');
    await expect(routeRisk(multiFile, { now, scope: 'task', changeId: 'change', taskId: 'task', requestedRisk: 'lite', waiver: { ...validWaiver('standard'), risk: 'standard' } })).rejects.toThrow('exact target');
    await expect(routeRisk(multiFile, { now, scope: 'task', changeId: 'change', taskId: 'task', requestedRisk: 'lite', waiver: { ...validWaiver('lite'), waivedRequirements: ['independent-review'] } })).rejects.toThrow('risk-routing');
    await expect(routeRisk({ ...localBug, security: 'auth' }, { now, scope: 'task', changeId: 'change', taskId: 'task', requestedRisk: 'lite', waiver: validWaiver('lite') })).rejects.toThrow('non-waivable');
  });

  test('accepts only an exact change-scope waiver target', async () => {
    const { taskId: _taskId, ...waiver } = { ...validWaiver('lite'), scope: 'change' };
    await expect(routeRisk(multiFile, { now, scope: 'change', changeId: 'change', requestedRisk: 'lite', waiver })).resolves.toMatchObject({ finalRisk: 'lite', override: { kind: 'waiver' } });
    await expect(routeRisk(multiFile, { now, scope: 'change', changeId: 'other', requestedRisk: 'lite', waiver })).rejects.toThrow('exact target');
  });

  test('rejects targetless, surplus, and cross-target lowering state', async () => {
    const { taskId: _taskId, ...changeWaiver } = { ...validWaiver('lite'), scope: 'change' };
    await expect(routeRisk(multiFile, { now, requestedRisk: 'lite', scope: 'change', waiver: changeWaiver } as unknown as { now: Date })).rejects.toThrow('lowering options');
    await expect(routeRisk(multiFile, { now, requestedRisk: 'lite', scope: 'change', changeId: 'change', taskId: 'surplus', waiver: changeWaiver } as unknown as { now: Date })).rejects.toThrow('lowering options');
    await expect(routeRisk(multiFile, { now, requestedRisk: 'lite', scope: 'change', changeId: 'change', waiver: { ...changeWaiver, taskId: 'surplus' } })).rejects.toThrow('SCHEMA_INVALID');
    await expect(routeRisk(multiFile, { now, requestedRisk: 'lite', scope: 'task', changeId: 'change', waiver: validWaiver('lite') } as unknown as { now: Date })).rejects.toThrow('lowering options');
    await expect(routeRisk(multiFile, { now, requestedRisk: 'lite', scope: 'task', changeId: 'change', taskId: 'other', waiver: validWaiver('lite') })).rejects.toThrow('exact target');
  });

  test('accepts only closed discriminated route option states', async () => {
    await expect(routeRisk(localBug, { now, scope: 'project' } as unknown as { now: Date })).rejects.toThrow('override options');
    await expect(routeRisk(localBug, { now, waiver: validWaiver('lite') } as unknown as { now: Date })).rejects.toThrow('override options');
    await expect(routeRisk(localBug, { now, requestedRisk: 'lite', scope: 'task', changeId: 'change', taskId: 'task', waiver: validWaiver('lite') })).rejects.toThrow('override options');
    await expect(routeRisk(localBug, { now, requestedRisk: 'full', scope: 'task', changeId: 'change', taskId: 'task', waiver: validWaiver('lite') })).rejects.toThrow('override options');
  });

  test('fails closed for unknown fields, prohibited concepts, bad unresolved counts, and invalid rules', async () => {
    await expect(routeRisk({ ...localBug, provider: 'anything' } as unknown as RiskFacts, { now })).rejects.toThrow('unknown input field');
    await expect(routeRisk(localBug, { now, provider: 'anything' } as unknown as { now: Date })).rejects.toThrow('unknown option field');
    await expect(routeRisk({ ...localBug, security: 'oauth' }, { now })).rejects.toThrow('unknown value');
    await expect(routeRisk({ ...localBug, unresolvedDecisions: -1 }, { now })).rejects.toThrow('unresolvedDecisions');
    await expect(routeRisk({ ...localBug, unresolvedDecisions: 1.5 }, { now })).rejects.toThrow('unresolvedDecisions');
    expect(() => parseRiskRules({ version: 1, levels: ['lite'], thresholds: {}, dimensions: {}, floors: {}, platformPermissions: true })).toThrow('unknown rule field');
    const configured = YAML.parse(await readFile(join(testDirectory, '../../core/workflows/risk-rules.yaml'), 'utf8')) as { dimensions: { security: Record<string, unknown> } };
    configured.dimensions.security.auth = { score: 9, reasonCode: 'SCORE_SECURITY_AUTH', prose: 'Authentication or authorization change.', extra: true };
    expect(() => parseRiskRules(configured)).toThrow('invalid rule leaf');
    const missingValue = YAML.parse(await readFile(join(testDirectory, '../../core/workflows/risk-rules.yaml'), 'utf8')) as { dimensions: { security: Record<string, unknown> } };
    delete missingValue.dimensions.security.none;
    expect(() => parseRiskRules(missingValue)).toThrow('closed value set');
    const changedFloor = YAML.parse(await readFile(join(testDirectory, '../../core/workflows/risk-rules.yaml'), 'utf8')) as { floors: { security: Record<string, unknown> } };
    changedFloor.floors.security.none = 'lite';
    expect(() => parseRiskRules(changedFloor)).toThrow('closed floor set');
  });

  test('rejects unsafe or policy-weakening numeric, floor, and reason-code rules', async () => {
    const configured = await rulesFixture();
    configured.dimensions.contract.local.score = Number.MAX_VALUE;
    expect(() => parseRiskRules(configured)).toThrow('invalid rule leaf');
    const uncovered = await rulesFixture();
    uncovered.thresholds = { lite: 0, standard: 1, full: 2 };
    expect(() => parseRiskRules(uncovered)).toThrow('frozen thresholds');
    const unsafeAggregate = await rulesFixture();
    unsafeAggregate.dimensions.unresolvedDecisions.perUnit.score = Number.MAX_SAFE_INTEGER;
    expect(() => parseRiskRules(unsafeAggregate)).toThrow('thresholds do not cover accepted aggregate');
    const invalidLimits = await rulesFixture();
    invalidLimits.limits = { maxUnresolvedDecisions: -1 };
    expect(() => parseRiskRules(invalidLimits)).toThrow('invalid limits');
    const weakFloor = await rulesFixture();
    weakFloor.floors.contract['public-api'] = 'lite';
    expect(() => parseRiskRules(weakFloor)).toThrow('mandatory floor');
    const combinedWeakening = await rulesFixture();
    combinedWeakening.thresholds.standard = 6;
    combinedWeakening.floors.codeSpread['multi-file'] = 'lite';
    expect(() => parseRiskRules(combinedWeakening)).toThrow('frozen thresholds');
    const duplicate = await rulesFixture();
    duplicate.dimensions.data.local.reasonCode = duplicate.dimensions.contract.local.reasonCode;
    expect(() => parseRiskRules(duplicate)).toThrow('duplicate reason code');
    const reserved = await rulesFixture();
    reserved.dimensions.data.local.reasonCode = 'FLOOR_FULL';
    expect(() => parseRiskRules(reserved)).toThrow('reserved reason code');
    await expect(routeRisk({ ...localBug, unresolvedDecisions: Number.MAX_SAFE_INTEGER }, { now })).rejects.toThrow('unresolvedDecisions');
    await expect(routeRisk({ ...localBug, unresolvedDecisions: 1_000_000 }, { now })).resolves.toMatchObject({ finalRisk: 'full', totalScore: 10_000_001 });
  });

  test('explains only portable policy facts in deterministic prose', async () => {
    const explanation = explainRisk(await routeRisk(multiFile, { now }));
    expect(explanation).toContain('Baseline route: Standard. Final route: Standard.');
    expect(explanation).not.toMatch(/provider|model|permission/i);
    expect(JSON.stringify(await routeRisk(multiFile, { now }))).not.toMatch(/provider|model|permission/i);
  });
});

function validWaiver(risk: 'lite' | 'standard' | 'full') {
  return { receiptId: 'waiver', provenance: 'human-confirmed', actorLabel: 'Leo', scope: 'task', changeId: 'change', taskId: 'task', risk, waivedRequirements: ['risk-routing'], timestamp: '2026-09-05T11:00:00.000Z', expiresAt: '2026-09-05T13:00:00.000Z' };
}

async function rulesFixture() {
  return YAML.parse(await readFile(join(testDirectory, '../../core/workflows/risk-rules.yaml'), 'utf8')) as any;
}
