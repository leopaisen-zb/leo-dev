import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validateReceipt, type ReceiptValue } from '../schema/validate.js';

export const riskLevels = ['lite', 'standard', 'full'] as const;
export type RiskLevel = typeof riskLevels[number];
export type DimensionName = 'contract' | 'data' | 'security' | 'infrastructure' | 'reversibility' | 'blastRadius' | 'codeSpread' | 'unresolvedDecisions';
export type RiskFacts = { contract: 'none' | 'local' | 'public-api' | 'new-project'; data: 'none' | 'local' | 'migration'; security: 'none' | 'auth'; infrastructure: 'none' | 'change'; reversibility: 'easy' | 'difficult'; blastRadius: 'local' | 'multi-file' | 'broad'; codeSpread: 'single-file' | 'multi-file'; unresolvedDecisions: number };
export type RiskContribution = { dimension: DimensionName; value: string | number; score: number; reasonCode: string; prose: string };
export type WaiverMetadata = { valid: true; receiptId: string; provenance: string; actorLabel: string; issuerAuthenticated: false } | { valid: false; reason: string };
export type RiskRoute = {
  contributions: RiskContribution[]; totalScore: number; policyFloor: RiskLevel; baselineRisk: RiskLevel; finalRisk: RiskLevel;
  reasonCodes: string[]; explanations: string[]; override: { kind: 'none' } | { kind: 'raise'; requestedRisk: RiskLevel } | { kind: 'waiver'; requestedRisk: RiskLevel; receiptId: string };
  waiver: WaiverMetadata;
};
type RouteClock = { now: Date };
type LoweringMetadataForbidden = { waiver?: never; scope?: never; changeId?: never; taskId?: never };
type RouteWithoutOverride = RouteClock & LoweringMetadataForbidden & { requestedRisk?: undefined };
type RouteRaiseOrEqual = RouteClock & LoweringMetadataForbidden & { requestedRisk: RiskLevel };
type RouteChangeLowering = RouteClock & { requestedRisk: RiskLevel; waiver: unknown; scope: 'change'; changeId: string; taskId?: never };
type RouteTaskLowering = RouteClock & { requestedRisk: RiskLevel; waiver: unknown; scope: 'task'; changeId: string; taskId: string };
export type RouteOptions = RouteWithoutOverride | RouteRaiseOrEqual | RouteChangeLowering | RouteTaskLowering;
type RuleLeaf = { score: number; reasonCode: string; prose: string };
type Rules = { version: 1; levels: readonly RiskLevel[]; thresholds: Record<RiskLevel, number>; limits: { maxUnresolvedDecisions: number }; dimensions: Record<Exclude<DimensionName, 'unresolvedDecisions'>, Record<string, RuleLeaf>> & { unresolvedDecisions: { perUnit: RuleLeaf } }; floors: Record<string, Record<string, RiskLevel>> };

const dimensions: readonly DimensionName[] = ['contract', 'data', 'security', 'infrastructure', 'reversibility', 'blastRadius', 'codeSpread', 'unresolvedDecisions'];
const valueKeys = { contract: ['none', 'local', 'public-api', 'new-project'], data: ['none', 'local', 'migration'], security: ['none', 'auth'], infrastructure: ['none', 'change'], reversibility: ['easy', 'difficult'], blastRadius: ['local', 'multi-file', 'broad'], codeSpread: ['single-file', 'multi-file'] } as const;
const floorKeys = { contract: ['public-api', 'new-project'], data: ['migration'], security: ['auth'], infrastructure: ['change'], codeSpread: ['multi-file'], unresolvedDecisions: ['positive'] } as const;
const frozenThresholds = { lite: 2, standard: 7, full: Number.MAX_SAFE_INTEGER } as const;
const mandatoryFloorMinimums = { contract: { 'public-api': 'standard', 'new-project': 'full' }, data: { migration: 'full' }, security: { auth: 'full' }, infrastructure: { change: 'full' }, codeSpread: { 'multi-file': 'standard' }, unresolvedDecisions: { positive: 'full' } } as const;
const riskRank = (value: RiskLevel) => riskLevels.indexOf(value);
const own = (value: object, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const failure = (message: string): never => { throw new Error(`Risk routing rejected: ${message}`); };

function leaf(value: unknown): RuleLeaf {
  if (!isRecord(value) || !own(value, ['score', 'reasonCode', 'prose'])) failure('invalid rule leaf');
  const { score, reasonCode, prose } = value as Record<string, unknown>;
  if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0 || typeof reasonCode !== 'string' || !/^[A-Z][A-Z0-9_]+$/.test(reasonCode) || reasonCode.startsWith('FLOOR_') || typeof prose !== 'string' || prose.length === 0) failure(reasonCode && typeof reasonCode === 'string' && reasonCode.startsWith('FLOOR_') ? 'reserved reason code' : 'invalid rule leaf');
  return { score: score as number, reasonCode: reasonCode as string, prose: prose as string };
}
function floorMap(value: unknown): Record<string, RiskLevel> {
  if (!isRecord(value) || Object.keys(value).length === 0 || Object.values(value).some((risk) => !riskLevels.includes(risk as RiskLevel))) failure('invalid floor');
  return value as Record<string, RiskLevel>;
}

export function parseRiskRules(value: unknown): Rules {
  if (!isRecord(value) || !own(value, ['version', 'levels', 'thresholds', 'limits', 'dimensions', 'floors'])) failure('unknown rule field');
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || !Array.isArray(raw.levels) || raw.levels.length !== riskLevels.length || raw.levels.some((level: unknown, index: number) => level !== riskLevels[index])) failure('invalid rule version or levels');
  if (!isRecord(raw.thresholds) || !own(raw.thresholds, riskLevels)) failure('invalid thresholds');
  const thresholds = raw.thresholds as Record<RiskLevel, unknown>;
  if (riskLevels.some((level, index) => !Number.isSafeInteger(thresholds[level]) || (thresholds[level] as number) < 0 || (index > 0 && (thresholds[level] as number) <= (thresholds[riskLevels[index - 1]] as number)))) failure('invalid thresholds');
  if (riskLevels.some((level) => thresholds[level] !== frozenThresholds[level])) failure('frozen thresholds');
  if (!isRecord(raw.limits)) failure('invalid limits');
  const rawLimits = raw.limits as Record<string, unknown>;
  if (!own(rawLimits, ['maxUnresolvedDecisions']) || !Number.isSafeInteger(rawLimits.maxUnresolvedDecisions) || (rawLimits.maxUnresolvedDecisions as number) < 0) failure('invalid limits');
  const limits = { maxUnresolvedDecisions: rawLimits.maxUnresolvedDecisions as number };
  if (!isRecord(raw.dimensions) || !own(raw.dimensions, dimensions) || !isRecord(raw.floors) || !own(raw.floors, ['contract', 'data', 'security', 'infrastructure', 'codeSpread', 'unresolvedDecisions'])) failure('invalid rule dimensions or floors');
  const rawDimensions = raw.dimensions as Record<string, unknown>;
  const rawFloors = raw.floors as Record<string, unknown>;
  const parsed = {} as Rules['dimensions'];
  for (const dimension of dimensions) {
    const source = rawDimensions[dimension];
    if (!isRecord(source)) failure(`invalid ${dimension} rules`);
    const sourceRecord = source as Record<string, unknown>;
    if (dimension === 'unresolvedDecisions') {
      if (!own(sourceRecord, ['perUnit'])) failure('invalid unresolvedDecisions rules');
      parsed.unresolvedDecisions = { perUnit: leaf(sourceRecord.perUnit) };
    } else {
      if (!own(sourceRecord, valueKeys[dimension])) failure(`closed value set for ${dimension}`);
      parsed[dimension] = Object.fromEntries(Object.entries(sourceRecord).map(([key, entry]) => [key, leaf(entry)]));
    }
  }
  const floors = Object.fromEntries(Object.entries(rawFloors).map(([key, entry]) => {
    const parsedFloor = floorMap(entry);
    if (!own(parsedFloor, floorKeys[key as keyof typeof floorKeys])) failure(`closed floor set for ${key}`);
    return [key, parsedFloor];
  }));
  for (const [dimension, values] of Object.entries(floors)) for (const floorValue of Object.keys(values)) {
    if (dimension === 'unresolvedDecisions' ? floorValue !== 'positive' : !(floorValue in parsed[dimension as Exclude<DimensionName, 'unresolvedDecisions'>])) failure('floor references unknown value');
  }
  for (const [dimension, values] of Object.entries(mandatoryFloorMinimums)) for (const [key, minimum] of Object.entries(values)) {
    if (riskRank(floors[dimension][key] as RiskLevel) < riskRank(minimum as RiskLevel)) failure('mandatory floor weakened');
  }
  const leaves = [...Object.values(parsed.unresolvedDecisions), ...Object.values(parsed.contract), ...Object.values(parsed.data), ...Object.values(parsed.security), ...Object.values(parsed.infrastructure), ...Object.values(parsed.reversibility), ...Object.values(parsed.blastRadius), ...Object.values(parsed.codeSpread)];
  if (new Set(leaves.map((entry) => entry.reasonCode)).size !== leaves.length) failure('duplicate reason code');
  const fixedMaximum = Math.max(...Object.values(parsed.contract).map((entry) => entry.score)) + Math.max(...Object.values(parsed.data).map((entry) => entry.score)) + Math.max(...Object.values(parsed.security).map((entry) => entry.score)) + Math.max(...Object.values(parsed.infrastructure).map((entry) => entry.score)) + Math.max(...Object.values(parsed.reversibility).map((entry) => entry.score)) + Math.max(...Object.values(parsed.blastRadius).map((entry) => entry.score)) + Math.max(...Object.values(parsed.codeSpread).map((entry) => entry.score));
  const maximumAggregate = fixedMaximum + parsed.unresolvedDecisions.perUnit.score * limits.maxUnresolvedDecisions;
  if (!Number.isSafeInteger(maximumAggregate) || maximumAggregate > (thresholds.full as number)) failure('thresholds do not cover accepted aggregate');
  return { version: 1, levels: riskLevels, thresholds: thresholds as Record<RiskLevel, number>, limits, dimensions: parsed, floors };
}

// Both src/routing and dist/routing sit four levels below the repository root.
const defaultRulesPath = join(dirname(fileURLToPath(import.meta.url)), '../../../..', 'core', 'workflows', 'risk-rules.yaml');
export async function loadRiskRules(path = defaultRulesPath): Promise<Rules> { return parseRiskRules(YAML.parse(await readFile(path, 'utf8'))); }

function facts(input: RiskFacts, rules: Rules): RiskContribution[] {
  if (!isRecord(input) || !own(input, dimensions)) failure('unknown input field');
  if (!Number.isSafeInteger(input.unresolvedDecisions) || input.unresolvedDecisions < 0 || input.unresolvedDecisions > rules.limits.maxUnresolvedDecisions) failure('unresolvedDecisions must be a non-negative safe integer within the accepted range');
  return dimensions.map((dimension) => {
    const value = input[dimension];
    const rule = dimension === 'unresolvedDecisions'
      ? rules.dimensions.unresolvedDecisions.perUnit
      : rules.dimensions[dimension][String(value)];
    if (!rule) failure(`unknown value for ${dimension}`);
    const score = dimension === 'unresolvedDecisions' ? rule.score * input.unresolvedDecisions : rule.score;
    if (!Number.isSafeInteger(score)) failure('unsafe contribution score');
    return { dimension, value, score, reasonCode: rule.reasonCode, prose: rule.prose };
  });
}
function maximum(left: RiskLevel, right: RiskLevel): RiskLevel { return riskRank(left) >= riskRank(right) ? left : right; }
function policyFloor(input: RiskFacts, rules: Rules): RiskLevel {
  let floor: RiskLevel = 'lite';
  for (const [dimension, values] of Object.entries(rules.floors)) {
    const key = dimension === 'unresolvedDecisions' ? input.unresolvedDecisions > 0 ? 'positive' : 'zero' : String(input[dimension as Exclude<DimensionName, 'unresolvedDecisions'>]);
    const candidate = values[key];
    if (candidate !== undefined) floor = maximum(floor, candidate as RiskLevel);
  }
  return floor;
}

export async function routeRisk(input: RiskFacts, options: RouteOptions): Promise<RiskRoute> {
  if (!isRecord(options) || Object.keys(options).some((key) => !['now', 'requestedRisk', 'waiver', 'scope', 'changeId', 'taskId'].includes(key))) failure('unknown option field');
  const optionRecord = options as Record<string, unknown>;
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime())) failure('explicit valid now is required');
  const rules = await loadRiskRules(); const contributions = facts(input, rules); const totalScore = contributions.reduce((total, item) => total + item.score, 0);
  if (!Number.isSafeInteger(totalScore)) failure('unsafe total score');
  const scored = riskLevels.find((risk) => totalScore <= rules.thresholds[risk]); const scoredRisk = scored ?? failure('score exceeds configured range');
  const floor = policyFloor(input, rules); const baselineRisk = maximum(scoredRisk, floor); let finalRisk = baselineRisk;
  let override: RiskRoute['override'] = { kind: 'none' }; let waiver: WaiverMetadata = { valid: false, reason: 'not used' };
  if (options.requestedRisk === undefined) {
    if (!own(options, ['now'])) failure('override options are not valid without a requested risk');
  } else {
    if (!riskLevels.includes(options.requestedRisk)) failure('unknown requested risk');
    if (riskRank(options.requestedRisk) > riskRank(baselineRisk)) { finalRisk = options.requestedRisk; override = { kind: 'raise', requestedRisk: options.requestedRisk }; }
    if (riskRank(options.requestedRisk) >= riskRank(baselineRisk) && !own(options, ['now', 'requestedRisk'])) failure('override options are only valid for lowering');
    if (riskRank(options.requestedRisk) < riskRank(baselineRisk)) {
      const loweringKeys = optionRecord.scope === 'change' ? ['now', 'requestedRisk', 'waiver', 'scope', 'changeId'] : optionRecord.scope === 'task' ? ['now', 'requestedRisk', 'waiver', 'scope', 'changeId', 'taskId'] : undefined;
      if (!loweringKeys || !own(options, loweringKeys) || typeof optionRecord.changeId !== 'string' || optionRecord.changeId.length === 0 || (optionRecord.scope === 'task' && (typeof optionRecord.taskId !== 'string' || optionRecord.taskId.length === 0))) failure('lowering options are not an exact scope and target');
      if (riskRank(options.requestedRisk) < riskRank(floor)) failure('non-waivable policy floor');
      const checked = validateReceipt('waiver', optionRecord.waiver, options.now);
      if (!('value' in checked)) failure(checked.code);
      const receipt = (checked as { value: ReceiptValue }).value;
      if (receipt.risk !== options.requestedRisk) failure('waiver exact target mismatch');
      if (!Array.isArray(receipt.waivedRequirements) || !receipt.waivedRequirements.includes('risk-routing')) failure('waiver does not cover risk-routing');
      const scope = optionRecord.scope as 'change' | 'task';
      if (receipt.scope !== scope) failure('waiver exact scope mismatch');
      if (receipt.changeId !== optionRecord.changeId || (scope === 'task' && receipt.taskId !== optionRecord.taskId)) failure('waiver exact target mismatch');
      finalRisk = options.requestedRisk; override = { kind: 'waiver', requestedRisk: options.requestedRisk, receiptId: receipt.receiptId };
      waiver = { valid: true, receiptId: receipt.receiptId, provenance: receipt.provenance, actorLabel: receipt.actorLabel, issuerAuthenticated: false };
    }
  }
  const reasonCodes = [...new Set(contributions.filter((item) => item.score > 0).map((item) => item.reasonCode))].sort();
  if (floor !== 'lite') reasonCodes.push(`FLOOR_${floor.toUpperCase()}`);
  return { contributions, totalScore, policyFloor: floor, baselineRisk, finalRisk, reasonCodes: [...new Set(reasonCodes)].sort(), explanations: contributions.filter((item) => item.score > 0).map((item) => item.prose), override, waiver };
}
