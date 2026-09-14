import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { validateDocument } from '../schema/validate.js';
import { repositoryPath, repositoryRelativePath } from '../security/paths.js';

export interface GateEvidence {
  id: string;
  runId: string;
  taskId: string;
  taskRevision: number;
  leaseGeneration: number;
  gateId: string;
  repositoryIdentity: string;
  treeHash: string;
  inputTreeHash: string;
  writeSurfaceHash: string;
  inputWriteSurfaceHash: string;
  operationFingerprint: string;
  executionFingerprint: string;
  artifactHashes: string[];
  timestamp: string;
  gateDefinitionHash: string;
  exitCode: number | null;
  runStatus: 'succeeded' | 'failed' | 'timed-out' | 'output-capped' | 'undeclared-writes';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stdoutLogPath: string;
  stderrLogPath: string;
}

export interface EvidenceReservation { relativeDirectory: string; absoluteDirectory: string; }
export interface PublishedGateEvidence { evidence: GateEvidence; contentHash: string; pathHash: string; }

export class GateEvidenceError extends Error {
  constructor(readonly code: 'EVIDENCE_COLLISION' | 'EVIDENCE_PUBLISH_FAILED' | 'EVIDENCE_LOAD_FAILED', message: string) { super(message); }
}

const encoded = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export function evidenceDirectory(changeId: string, runId: string, gateId: string): string {
  return `.leo-dev/runtime/c-${encoded(changeId)}/r-${encoded(runId)}/g-${encoded(gateId)}`;
}

export function evidenceFilePath(changeId: string, runId: string, gateId: string): string {
  return `${evidenceDirectory(changeId, runId, gateId)}/evidence.json`;
}

/** Reserve the immutable per-change/run/gate destination before starting a process. */
export async function reserveGateEvidence(root: string, changeId: string, runId: string, gateId: string): Promise<EvidenceReservation> {
  const relativeDirectory = evidenceDirectory(changeId, runId, gateId);
  const target = await repositoryPath(root, relativeDirectory);
  const parent = dirname(target);
  await repositoryPath(root, await repositoryRelativePath(root, parent));
  await mkdir(parent, { recursive: true });
  await repositoryPath(root, await repositoryRelativePath(root, parent), true);
  try {
    await mkdir(target);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'EEXIST') throw new GateEvidenceError('EVIDENCE_COLLISION', `Evidence target already exists: ${relativeDirectory}`);
    throw new GateEvidenceError('EVIDENCE_PUBLISH_FAILED', error instanceof Error ? error.message : 'Unable to reserve evidence target');
  }
  return { relativeDirectory, absoluteDirectory: target };
}

export async function publishGateEvidence(root: string, reservation: EvidenceReservation, evidence: Omit<GateEvidence, 'stdoutLogPath' | 'stderrLogPath'>, stdout: string, stderr: string): Promise<PublishedGateEvidence> {
  try {
    const stdoutPath = join(reservation.absoluteDirectory, 'stdout.log');
    const stderrPath = join(reservation.absoluteDirectory, 'stderr.log');
    const value: GateEvidence = { ...evidence, stdoutLogPath: await repositoryRelativePath(root, stdoutPath), stderrLogPath: await repositoryRelativePath(root, stderrPath) };
    const valid = validateDocument('evidence', value);
    if (!valid.ok) throw new Error(`Evidence schema invalid: ${valid.details.join('; ')}`);
    const serialized = `${JSON.stringify(value)}\n`;
    await writeFile(stdoutPath, stdout, { mode: 0o600, flag: 'wx' });
    await writeFile(stderrPath, stderr, { mode: 0o600, flag: 'wx' });
    await writeFile(join(reservation.absoluteDirectory, 'evidence.json'), serialized, { mode: 0o600, flag: 'wx' });
    return { evidence: value, contentHash: digest(serialized), pathHash: digest(`${reservation.relativeDirectory}/evidence.json`) };
  } catch (error: unknown) {
    throw new GateEvidenceError('EVIDENCE_PUBLISH_FAILED', error instanceof Error ? error.message : 'Unable to publish evidence');
  }
}

/** Load only the immutable artifact derived from controller-owned identities. */
export async function loadGateEvidence(root: string, changeId: string, runId: string, gateId: string): Promise<PublishedGateEvidence> {
  const relativePath = evidenceFilePath(changeId, runId, gateId);
  try {
    const absolutePath = await repositoryPath(root, relativePath, true);
    const serialized = await readFile(absolutePath);
    const value = JSON.parse(serialized.toString('utf8')) as unknown;
    const valid = validateDocument('evidence', value);
    if (!valid.ok) throw new Error(`Evidence schema invalid: ${valid.details.join('; ')}`);
    const evidence = value as GateEvidence;
    const directory = evidenceDirectory(changeId, runId, gateId);
    if (evidence.stdoutLogPath !== `${directory}/stdout.log` || evidence.stderrLogPath !== `${directory}/stderr.log`) throw new Error('Evidence log paths do not match the derived artifact directory');
    return { evidence, contentHash: digest(serialized), pathHash: digest(relativePath) };
  } catch (error: unknown) {
    throw new GateEvidenceError('EVIDENCE_LOAD_FAILED', error instanceof Error ? error.message : 'Unable to load evidence');
  }
}
