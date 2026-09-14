import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { assertContained } from './artifacts.js';
import { GateRegistry, fingerprint, gateDefinitionFingerprint } from '../gates/registry.js';
import { TaskPlanError, validateTaskPlan } from './task-plan.js';
import { normalizeRepositoryPath } from '../security/paths.js';
import type { TaskDefinition } from '../state/types.js';

export type RevisionRoute = { task: TaskDefinition; taskHash: string; registryPath: string; gateDefinitionHash: string };
export type RevisionAuthority = { revision: number; revisionId: string; specHash: string; previousRevisionId: string | null; previousSpecHash: string; previousSource: { path: string; sourceHash: string; sourceBase64: string | null; bytesUnavailable: boolean }; specPath: string; sourceHash: string; sourceBase64: string; constitutionPath: string | null; constitutionHash: string | null; constitutionBase64: string | null; routes: RevisionRoute[] };
export type SpecRevisionRecord = { schemaVersion: 1; authority: RevisionAuthority };

export class SpecRevisionError extends Error {}
export class SpecRevisionConflictError extends SpecRevisionError {}

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const normalized = (root: string, path: string) => relative(root, path).split(sep).join('/');

function taskHash(task: TaskDefinition): string { return fingerprint({ ...task, state: undefined }); }

function validateTasks(value: unknown, previous: RevisionRoute[]): TaskDefinition[] {
  const old = new Map(previous.map((route) => [route.task.id, route.task]));
  let tasks: TaskDefinition[];
  try { tasks = validateTaskPlan(value, (task) => { const prior = old.get(task.id); return prior ? (task.revision === prior.revision + 1 ? undefined : `Task ${task.id} must advance exactly one revision`) : (task.revision === 1 ? undefined : `New task ${task.id} must start at revision 1`); }); }
  catch (error) { throw new SpecRevisionError(error instanceof TaskPlanError ? error.message : String(error)); }
  const ids = new Set(tasks.map((task) => task.id));
  for (const oldId of old.keys()) if (!ids.has(oldId)) throw new SpecRevisionError(`Revision cannot remove existing task ${oldId}`);
  return tasks;
}

async function source(root: string, reference: string | undefined, label: string): Promise<{ path: string; bytes: Buffer; hash: string } | null> {
  if (reference === undefined) return null;
  const absolute = resolve(root, reference);
  try { await assertContained(root, absolute); } catch { throw new SpecRevisionError(`${label} path escapes repository`); }
  try { const bytes = await readFile(absolute); return { path: normalized(root, absolute), bytes, hash: hash(bytes) }; }
  catch { throw new SpecRevisionError(`${label} is not a readable repository file`); }
}

export async function prepareSpecRevision(input: {
  repositoryRoot: string; previousRevision: number; previousRevisionId: string | null; previousSpecHash: string; previousRoutes: RevisionRoute[];
  previousSpecPath: string; previousSourceHash: string; previousSourceBase64?: string | null;
  spec: string; plan: string; constitution?: string; previousConstitutionPath?: string | null; previousConstitutionHash?: string | null; registry?: string;
}): Promise<SpecRevisionRecord> {
  const root = await realpath(input.repositoryRoot);
  let previousSourceBase64 = input.previousSourceBase64 ?? null;
  if (previousSourceBase64 === null) {
    try { const bytes = await readFile(resolve(root, input.previousSpecPath)); if (hash(bytes) === input.previousSourceHash) previousSourceBase64 = bytes.toString('base64'); } catch { /* explicit unavailable state below */ }
  }
  const previousSource = { path: input.previousSpecPath, sourceHash: input.previousSourceHash, sourceBase64: previousSourceBase64, bytesUnavailable: previousSourceBase64 === null };
  const spec = await source(root, input.spec, 'Specification');
  const constitution = await source(root, input.constitution ?? input.previousConstitutionPath ?? undefined, 'Constitution');
  if (input.constitution === undefined && constitution && input.previousConstitutionHash !== constitution.hash) {
    throw new SpecRevisionConflictError('Currently bound constitution has drifted and must not be silently revised when --constitution is omitted');
  }
  if (!spec) throw new SpecRevisionError('Specification is required');
  const planFile = await source(root, input.plan, 'Plan');
  if (!planFile) throw new SpecRevisionError('Plan is required');
  let parsed: unknown;
  try { parsed = JSON.parse(planFile.bytes.toString('utf8')); } catch { try { const YAML = (await import('yaml')).default; parsed = YAML.parse(planFile.bytes.toString('utf8')); } catch { throw new SpecRevisionError('Plan is not valid JSON or YAML'); } }
  const tasks = validateTasks(parsed, input.previousRoutes);
  const existingRegistries = [...new Set(input.previousRoutes.map((route) => route.registryPath))];
  const registryReference = input.registry ?? (existingRegistries.length === 1 ? existingRegistries[0] : undefined);
  if (!registryReference) throw new SpecRevisionError('Revision requires an explicit --registry because current routes are ambiguous');
  const registrySource = await source(root, registryReference, 'Registry');
  if (!registrySource) throw new SpecRevisionError('Registry is required');
  const registry = await GateRegistry.fromYaml(resolve(root, registrySource.path));
  const routes = tasks.map((task) => {
    const gate = registry.get(task.gateIds[0]!);
    return { task, taskHash: taskHash(task), registryPath: registrySource.path, gateDefinitionHash: gateDefinitionFingerprint(gate) };
  });
  const semantic = {
    schemaVersion: 1, revision: input.previousRevision + 1, previousRevisionId: input.previousRevisionId, previousSpecHash: input.previousSpecHash,
    specPath: spec.path, sourceHash: spec.hash, constitutionPath: constitution?.path ?? null, constitutionHash: constitution?.hash ?? null,
    routes: routes.map((route) => ({ task: route.task, taskHash: route.taskHash, registryPath: route.registryPath, gateDefinitionHash: route.gateDefinitionHash })),
  };
  const revisionId = fingerprint(semantic);
  return { schemaVersion: 1, authority: {
    revision: input.previousRevision + 1, revisionId, specHash: revisionId, previousRevisionId: input.previousRevisionId, previousSpecHash: input.previousSpecHash,
    previousSource, specPath: spec.path, sourceHash: spec.hash, sourceBase64: spec.bytes.toString('base64'), constitutionPath: constitution?.path ?? null,
    constitutionHash: constitution?.hash ?? null, constitutionBase64: constitution?.bytes.toString('base64') ?? null, routes,
  } };
}

export function revisionApprovalContext(input: { changeId: string; repositoryRoot: string; authority: RevisionAuthority; previousJournalTailHash: string; subjectTreeHash: string; assessmentFingerprint: string }): Record<string, string> {
  return {
    decisionFingerprint: fingerprint({ operationKind: 'spec-revision', changeId: input.changeId, revisionId: input.authority.revisionId, previousJournalTailHash: input.previousJournalTailHash, subjectTreeHash: input.subjectTreeHash, assessmentFingerprint: input.assessmentFingerprint }),
    gateDefinitionFingerprint: fingerprint(input.authority.routes.map((route) => ({ taskId: route.task.id, gateId: route.task.gateIds[0], gateDefinitionHash: route.gateDefinitionHash }))),
    argvFingerprint: fingerprint([]), cwdFingerprint: fingerprint(input.repositoryRoot), environmentFingerprint: fingerprint([]), inputFingerprint: input.authority.revisionId,
  };
}

/** Pure historic-record validation: no current source file is consulted. */
export function validateSpecRevisionRecord(value: unknown): SpecRevisionRecord | undefined {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<SpecRevisionRecord> : undefined;
  const authority = record?.authority;
  if (!record || record.schemaVersion !== 1 || !authority || typeof authority !== 'object') return undefined;
  const candidate = authority as RevisionAuthority;
  if (!Number.isSafeInteger(candidate.revision) || candidate.revision < 2 || !/^[a-f0-9]{64}$/.test(candidate.revisionId)
    || candidate.specHash !== candidate.revisionId || !/^[a-f0-9]{64}$/.test(candidate.previousSpecHash)
    || !candidate.previousSource || typeof candidate.previousSource.path !== 'string' || normalizeRepositoryPath(candidate.previousSource.path) !== candidate.previousSource.path || !/^[a-f0-9]{64}$/.test(candidate.previousSource.sourceHash)
    || typeof candidate.previousSource.bytesUnavailable !== 'boolean' || (candidate.previousSource.sourceBase64 === null) !== candidate.previousSource.bytesUnavailable
    || (candidate.previousSource.sourceBase64 !== null && hash(Buffer.from(candidate.previousSource.sourceBase64, 'base64')) !== candidate.previousSource.sourceHash)
    || !/^[a-f0-9]{64}$/.test(candidate.sourceHash) || typeof candidate.specPath !== 'string' || !candidate.specPath || normalizeRepositoryPath(candidate.specPath) !== candidate.specPath
    || typeof candidate.sourceBase64 !== 'string' || hash(Buffer.from(candidate.sourceBase64, 'base64')) !== candidate.sourceHash
    || (candidate.constitutionPath === null) !== (candidate.constitutionHash === null)
    || (candidate.constitutionPath === null) !== (candidate.constitutionBase64 === null)
    || (candidate.constitutionPath !== null && normalizeRepositoryPath(candidate.constitutionPath) !== candidate.constitutionPath)
    || (candidate.constitutionHash !== null && (!/^[a-f0-9]{64}$/.test(candidate.constitutionHash) || hash(Buffer.from(candidate.constitutionBase64!, 'base64')) !== candidate.constitutionHash))
    || !Array.isArray(candidate.routes) || candidate.routes.length === 0) return undefined;
  const ids = new Set<string>();
  for (const route of candidate.routes) {
    if (!route || typeof route !== 'object' || !route.task || typeof route.registryPath !== 'string' || !route.registryPath
      || !/^[a-f0-9]{64}$/.test(route.taskHash) || !/^[a-f0-9]{64}$/.test(route.gateDefinitionHash)
      || normalizeRepositoryPath(route.registryPath) !== route.registryPath
      || ids.has(route.task.id) || route.task.revision < 1 || taskHash(route.task) !== route.taskHash) return undefined;
    ids.add(route.task.id);
  }
  try { validateTaskPlan({ schemaVersion: 1, tasks: candidate.routes.map((route) => route.task) }, (task) => Number.isSafeInteger(task.revision) && task.revision >= 1 ? undefined : `Task ${task.id} revision is invalid`); }
  catch { return undefined; }
  const semantic = {
    schemaVersion: 1, revision: candidate.revision, previousRevisionId: candidate.previousRevisionId, previousSpecHash: candidate.previousSpecHash,
    specPath: candidate.specPath, sourceHash: candidate.sourceHash, constitutionPath: candidate.constitutionPath, constitutionHash: candidate.constitutionHash,
    routes: candidate.routes.map((route) => ({ task: route.task, taskHash: route.taskHash, registryPath: route.registryPath, gateDefinitionHash: route.gateDefinitionHash })),
  };
  return fingerprint(semantic) === candidate.revisionId ? record as SpecRevisionRecord : undefined;
}
