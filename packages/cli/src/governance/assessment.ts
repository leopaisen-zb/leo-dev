import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import YAML from 'yaml';
import { assertContained } from '../changes/artifacts.js';
import { fingerprint } from '../gates/registry.js';
import { validateDocument } from '../schema/validate.js';

const inputLimit = 256 * 1024;
const evidenceLimit = 1024 * 1024;
const totalEvidenceLimit = 8 * 1024 * 1024;
const maximumEvidenceReferences = 128;
const hex = /^[a-f0-9]{64}$/;

export type AssessmentDisposition = 'ready' | 'local-remediation-required' | 'assessment-required' | 'approval-required';
export interface EvidenceReference { path: string; sha256: string; }
export interface AssessmentFinding { id: string; severity: 'low' | 'medium' | 'high'; relation: 'worsened-by-change' | 'required-by-change' | 'unrelated'; boundary: string; rationale: string; evidence: EvidenceReference[]; repairScope: 'local' | 'material' | 'unknown'; }
export interface AssessmentResolution { findingId: string; rationale: string; evidence: EvidenceReference[]; }
export interface ArchitectureAssessment { schemaVersion: 1; assessmentId: string; changeId: string; taskId: string; specHash: string; subjectTreeHash: string; coverage: 'complete' | 'partial'; findings: AssessmentFinding[]; previousAssessmentFingerprint?: string; resolutions?: AssessmentResolution[]; }
export interface RecordedAssessment { assessment: ArchitectureAssessment; fingerprint: string; disposition: AssessmentDisposition; relativePath: string; }

export class AssessmentError extends Error { constructor(readonly code: 'ASSESSMENT_INVALID' | 'ASSESSMENT_STALE' | 'ASSESSMENT_SUPERSESSION_INVALID', message: string) { super(message); } }

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function relevant(finding: AssessmentFinding): boolean { return finding.relation !== 'unrelated'; }
function relevantHigh(finding: AssessmentFinding): boolean { return relevant(finding) && finding.severity === 'high'; }
function normalizedPath(root: string, absolute: string): string { return relative(root, absolute).split(sep).join('/'); }

async function containedFile(root: string, path: string, label: string, maximum: number): Promise<{ path: string; bytes: Buffer }> {
  const absolute = resolve(root, path);
  try { await assertContained(root, absolute); } catch { throw new AssessmentError('ASSESSMENT_INVALID', `${label} is not repository-contained`); }
  let info;
  try { info = await lstat(absolute); } catch { throw new AssessmentError('ASSESSMENT_INVALID', `${label} is not readable`); }
  if (!info.isFile() || info.isSymbolicLink()) throw new AssessmentError('ASSESSMENT_INVALID', `${label} must be a regular non-symlink file`);
  if (info.size > maximum) throw new AssessmentError('ASSESSMENT_INVALID', `${label} exceeds the bounded size limit`);
  return { path: absolute, bytes: await readFile(absolute) };
}

async function normalizeEvidence(repositoryRoot: string, evidence: EvidenceReference[], label: string, budget: { references: number; bytes: number }): Promise<EvidenceReference[]> {
  if (budget.references + evidence.length > maximumEvidenceReferences) throw new AssessmentError('ASSESSMENT_INVALID', 'Assessment exceeds the bounded evidence reference limit');
  const paths = new Set<string>();
  const normalized: EvidenceReference[] = [];
  for (const reference of evidence) {
    const file = await containedFile(repositoryRoot, reference.path, `${label} evidence`, evidenceLimit);
    if (budget.bytes + file.bytes.length > totalEvidenceLimit) throw new AssessmentError('ASSESSMENT_INVALID', 'Assessment exceeds the bounded total evidence byte limit');
    const path = normalizedPath(repositoryRoot, file.path);
    if (paths.has(path)) throw new AssessmentError('ASSESSMENT_INVALID', `${label} has duplicate evidence references`);
    const byteHash = createHash('sha256').update(file.bytes).digest('hex');
    if (reference.sha256 !== byteHash) throw new AssessmentError('ASSESSMENT_STALE', `${label} evidence hash does not match ${path}`);
    paths.add(path); normalized.push({ path, sha256: byteHash }); budget.references += 1; budget.bytes += file.bytes.length;
  }
  return normalized.sort((a, b) => a.path.localeCompare(b.path));
}

export async function loadAssessmentInput(repositoryRoot: string, runtimeDirectory: string, suppliedPath: string): Promise<ArchitectureAssessment> {
  const root = await realpath(repositoryRoot);
  const runtime = await realpath(runtimeDirectory);
  const input = resolve(root, suppliedPath);
  try { await assertContained(runtime, input); } catch { throw new AssessmentError('ASSESSMENT_INVALID', '--assessment must be inside this change runtime directory'); }
  if (!/\.(?:json|ya?ml)$/i.test(input)) throw new AssessmentError('ASSESSMENT_INVALID', '--assessment must be a JSON, YAML, or YML file');
  const file = await containedFile(runtime, input, '--assessment', inputLimit);
  let parsed: unknown;
  try { parsed = input.toLowerCase().endsWith('.json') ? JSON.parse(file.bytes.toString('utf8')) : YAML.parse(file.bytes.toString('utf8')); }
  catch { throw new AssessmentError('ASSESSMENT_INVALID', '--assessment could not be parsed'); }
  const validation = validateDocument('architecture-assessment', parsed);
  if (!validation.ok) throw new AssessmentError('ASSESSMENT_INVALID', `Assessment is schema-invalid: ${validation.details.join('; ')}`);
  const raw = parsed as ArchitectureAssessment;
  const evidenceBudget = { references: 0, bytes: 0 };
  const findingIds = new Set<string>();
  const findings: AssessmentFinding[] = [];
  for (const finding of raw.findings) {
    if (findingIds.has(finding.id)) throw new AssessmentError('ASSESSMENT_INVALID', 'Assessment has duplicate finding IDs');
    findingIds.add(finding.id);
    findings.push({ ...finding, evidence: await normalizeEvidence(root, finding.evidence, `Finding ${finding.id}`, evidenceBudget) });
  }
  const resolutionIds = new Set<string>();
  const resolutions: AssessmentResolution[] = [];
  for (const resolution of raw.resolutions ?? []) {
    if (resolutionIds.has(resolution.findingId)) throw new AssessmentError('ASSESSMENT_INVALID', 'Assessment has duplicate resolution finding IDs');
    resolutionIds.add(resolution.findingId);
    resolutions.push({ ...resolution, evidence: await normalizeEvidence(root, resolution.evidence, `Resolution ${resolution.findingId}`, evidenceBudget) });
  }
  return {
    schemaVersion: 1, assessmentId: raw.assessmentId, changeId: raw.changeId, taskId: raw.taskId, specHash: raw.specHash,
    subjectTreeHash: raw.subjectTreeHash, coverage: raw.coverage, findings: findings.sort((a, b) => a.id.localeCompare(b.id)),
    ...(raw.previousAssessmentFingerprint ? { previousAssessmentFingerprint: raw.previousAssessmentFingerprint } : {}),
    ...(resolutions.length > 0 ? { resolutions: resolutions.sort((a, b) => a.findingId.localeCompare(b.findingId)) } : {}),
  };
}

function requireSupersession(previous: RecordedAssessment | undefined, candidate: ArchitectureAssessment): void {
  if (!previous) {
    if (candidate.previousAssessmentFingerprint) throw new AssessmentError('ASSESSMENT_SUPERSESSION_INVALID', 'First assessment cannot name a previous assessment');
    if ((candidate.resolutions?.length ?? 0) > 0) throw new AssessmentError('ASSESSMENT_SUPERSESSION_INVALID', 'First assessment cannot contain resolutions');
    return;
  }
  if (candidate.previousAssessmentFingerprint !== previous.fingerprint) throw new AssessmentError('ASSESSMENT_SUPERSESSION_INVALID', 'Successor assessment must name the latest previous assessment fingerprint');
  const current = new Map(candidate.findings.map((finding) => [finding.id, finding]));
  const resolutions = new Map((candidate.resolutions ?? []).map((resolution) => [resolution.findingId, resolution]));
  const priorRelevantHigh = new Map(previous.assessment.findings.filter(relevantHigh).map((finding) => [finding.id, finding]));
  const previousEvidenceHashes = new Set([
    ...previous.assessment.findings.flatMap((finding) => finding.evidence),
    ...(previous.assessment.resolutions ?? []).flatMap((resolution) => resolution.evidence),
  ].map((reference) => reference.sha256));
  for (const findingId of resolutions.keys()) if (!priorRelevantHigh.has(findingId)) throw new AssessmentError('ASSESSMENT_SUPERSESSION_INVALID', `Resolution ${findingId} does not refer to a prior relevant high finding`);
  for (const prior of priorRelevantHigh.values()) {
    const retained = current.get(prior.id);
    if (retained && relevantHigh(retained)) {
      if (resolutions.has(prior.id)) throw new AssessmentError('ASSESSMENT_SUPERSESSION_INVALID', `Resolution ${prior.id} contradicts its retained relevant high finding`);
      continue;
    }
    const resolution = resolutions.get(prior.id);
    if (!resolution) throw new AssessmentError('ASSESSMENT_SUPERSESSION_INVALID', `Prior relevant high finding ${prior.id} requires an explicit resolution`);
    if (!resolution.evidence.some((reference) => !previousEvidenceHashes.has(reference.sha256))) throw new AssessmentError('ASSESSMENT_SUPERSESSION_INVALID', `Resolution for ${prior.id} requires fresh supporting evidence`);
  }
}

export function assess(candidate: ArchitectureAssessment, expected: { changeId: string; taskId: string; specHash: string; subjectTreeHash: string }, previous?: RecordedAssessment): RecordedAssessment {
  if (candidate.changeId !== expected.changeId || candidate.taskId !== expected.taskId || candidate.specHash !== expected.specHash) throw new AssessmentError('ASSESSMENT_STALE', 'Assessment change, task, or specification binding is stale');
  if (candidate.subjectTreeHash !== expected.subjectTreeHash) throw new AssessmentError('ASSESSMENT_STALE', 'Assessment subject tree hash is stale');
  requireSupersession(previous, candidate);
  const material = candidate.findings.some((finding) => relevant(finding) && finding.repairScope === 'material');
  const unknown = candidate.coverage === 'partial' || candidate.findings.some((finding) => relevant(finding) && finding.repairScope === 'unknown');
  const localHigh = candidate.findings.some((finding) => relevantHigh(finding) && finding.repairScope === 'local');
  const disposition: AssessmentDisposition = previous?.disposition === 'approval-required' || material ? 'approval-required' : unknown ? 'assessment-required' : localHigh ? 'local-remediation-required' : 'ready';
  const assessmentFingerprint = fingerprint(candidate);
  return { assessment: candidate, fingerprint: assessmentFingerprint, disposition, relativePath: `.leo-dev/changes/${candidate.changeId}/assessments/${assessmentFingerprint}.yaml` };
}

export function validateRecordedAssessment(value: unknown): RecordedAssessment {
  const record = asRecord(value);
  const validation = validateDocument('architecture-assessment', record.assessment);
  if (!validation.ok) throw new AssessmentError('ASSESSMENT_INVALID', 'Recorded assessment is schema-invalid');
  const assessment = record.assessment as ArchitectureAssessment;
  if (typeof record.fingerprint !== 'string' || !hex.test(record.fingerprint) || record.fingerprint !== fingerprint(assessment)
    || !['ready', 'local-remediation-required', 'assessment-required', 'approval-required'].includes(String(record.disposition))
    || typeof record.relativePath !== 'string' || record.relativePath !== `.leo-dev/changes/${assessment.changeId}/assessments/${record.fingerprint}.yaml`) {
    throw new AssessmentError('ASSESSMENT_INVALID', 'Recorded assessment fingerprint or projection binding is invalid');
  }
  return record as unknown as RecordedAssessment;
}

export function verifyRecordedHistory(records: RecordedAssessment[]): void {
  const fingerprints = new Set<string>();
  const assessmentIds = new Set<string>();
  let previous: RecordedAssessment | undefined;
  for (const record of records) {
    if (fingerprints.has(record.fingerprint) || assessmentIds.has(record.assessment.assessmentId)) throw new AssessmentError('ASSESSMENT_INVALID', 'Recorded assessment history has duplicate immutable identities');
    fingerprints.add(record.fingerprint); assessmentIds.add(record.assessment.assessmentId);
    const recomputed = assess(record.assessment, {
      changeId: record.assessment.changeId,
      taskId: record.assessment.taskId,
      specHash: record.assessment.specHash,
      subjectTreeHash: record.assessment.subjectTreeHash,
    }, previous);
    if (recomputed.disposition !== record.disposition || recomputed.relativePath !== record.relativePath) throw new AssessmentError('ASSESSMENT_INVALID', 'Recorded assessment disposition is not reproducible from its immutable input');
    previous = record;
  }
}
