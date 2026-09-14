import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { canonicalTreeHash } from '../repository/tree-hash.js';
import { fingerprint } from '../gates/registry.js';
import { assertContained } from './artifacts.js';

export type ReleaseProof = {
  schemaVersion: 1; proofId: string; changeId: string; integrationTaskId: string; runId: string; taskRevision: number; leaseGeneration: number;
  claimInputTreeHash: string; candidateTreeHash: string; sourceHash: string; specHash: string; planHash: string;
  gateId: string; gateDefinitionHash: string; gateEvidenceRef: string; gateEvidenceHash: string;
  reviewReceiptId: string; reviewReceiptHash: string; reviewProvenance: string; reviewSessionId: string | null; createdAt: string;
};
export type ArchiveContext = Pick<ReleaseProof, 'changeId' | 'integrationTaskId' | 'specHash' | 'candidateTreeHash' | 'gateDefinitionHash'> & { releaseProofHash: string };
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const pathOf = (entry: string): string | undefined => {
  const parts = entry.split('\0');
  return parts.length === 3 && parts[0] && /^[0-7]{3}$/.test(parts[1]!) && /^[a-f0-9]{64}$/.test(parts[2]!) ? parts[0] : undefined;
};
export const releaseProofHash = (proof: ReleaseProof): string => fingerprint(proof);
export const archiveContext = (proof: ReleaseProof): ArchiveContext => ({ changeId: proof.changeId, integrationTaskId: proof.integrationTaskId, specHash: proof.specHash, candidateTreeHash: proof.candidateTreeHash, gateDefinitionHash: proof.gateDefinitionHash, releaseProofHash: releaseProofHash(proof) });

/** The existing canonical policy remains authoritative; this only normalizes exact journal projections on both sides. */
export async function frozenSubjectCurrent(repositoryRoot: string, frozenEntries: unknown, excludedProjectionPaths: Iterable<string>): Promise<boolean> {
  if (!Array.isArray(frozenEntries) || frozenEntries.some((entry) => typeof entry !== 'string' || !pathOf(entry))) return false;
  const excluded = new Set(excludedProjectionPaths);
  const filteredFrozen = frozenEntries.filter((entry) => !excluded.has(pathOf(entry)!));
  if (new Set(filteredFrozen.map((entry) => pathOf(entry)!)).size !== filteredFrozen.length) return false;
  const current = await canonicalTreeHash(repositoryRoot);
  const filteredCurrent = current.entries.filter((entry) => !excluded.has(pathOf(entry)!));
  return filteredFrozen.length === filteredCurrent.length && filteredFrozen.every((entry, index) => entry === filteredCurrent[index]);
}

export async function readRepositoryJson(repositoryRoot: string, reference: string): Promise<{ relativePath: string; bytes: Buffer; value: unknown }> {
  const file = await readRepositoryFile(repositoryRoot, reference);
  return { ...file, value: JSON.parse(file.bytes.toString('utf8')) as unknown };
}
export async function readRepositoryFile(repositoryRoot: string, reference: string): Promise<{ relativePath: string; bytes: Buffer }> {
  const root = await realpath(repositoryRoot);
  let path: string;
  try { path = await realpath(resolve(root, reference)); } catch { throw new Error(`Repository input is not readable: ${reference}`); }
  try { await assertContained(root, path); } catch { throw new Error(`Repository input escapes root: ${reference}`); }
  const bytes = await readFile(path);
  return { relativePath: relative(root, path).split(sep).join('/'), bytes };
}
export const contentHash = digest;
