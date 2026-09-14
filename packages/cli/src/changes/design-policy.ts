import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { assertContained } from './artifacts.js';
import { normalizeRepositoryPath } from '../security/paths.js';
import { fingerprint } from '../gates/registry.js';
import type { TaskDefinition } from '../state/types.js';

export type RoutedPlan = { task: TaskDefinition; taskHash: string; registryPath: string; gateDefinitionHash: string };
export type DesignReviewContext = { changeId: string; specHash: string; planHash: string; designPath: string; designHash: string; designSourceBase64: string; producerSession: string };
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');

export const routedRisk = (routes: RoutedPlan[]): 'lite' | 'standard' | 'full' => routes.some((route) => route.task.risk === 'full') ? 'full' : routes.some((route) => route.task.risk === 'standard') ? 'standard' : 'lite';
export const normalizedPlanHash = (routes: RoutedPlan[]): string => fingerprint(routes.map((route) => ({ task: route.task, taskHash: route.taskHash, registryPath: route.registryPath, gateDefinitionHash: route.gateDefinitionHash })));

export async function captureDesignReviewContext(root: string, input: Omit<DesignReviewContext, 'designPath' | 'designHash' | 'designSourceBase64'> & { design: string }): Promise<DesignReviewContext> {
  if (!input.producerSession.trim()) throw new Error('Design review requires a nonempty producer session');
  let reference: string; try { reference = normalizeRepositoryPath(input.design); } catch { throw new Error('Design path must be repository-relative'); }
  const repositoryRoot = await realpath(root); const path = resolve(repositoryRoot, reference);
  try { await assertContained(repositoryRoot, path); } catch { throw new Error('Design path escapes repository'); }
  let bytes: Buffer; try { bytes = await readFile(path); } catch { throw new Error('Design source is not a readable repository file'); }
  return { ...input, designPath: relative(repositoryRoot, path).split(sep).join('/'), designHash: hash(bytes), designSourceBase64: bytes.toString('base64') };
}

export async function designSourceIsCurrent(root: string, context: DesignReviewContext): Promise<boolean> {
  try { const repositoryRoot = await realpath(root); const path = resolve(repositoryRoot, context.designPath); await assertContained(repositoryRoot, path); return hash(await readFile(path)) === context.designHash; } catch { return false; }
}
