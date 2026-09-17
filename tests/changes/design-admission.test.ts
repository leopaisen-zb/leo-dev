import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { DesignAdmissionError, rejectDesignReview } from '../../packages/cli/src/changes/design-admission.js';
import { normalizedPlanHash, type RoutedPlan } from '../../packages/cli/src/changes/design-policy.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const temporary: string[] = [];

afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

test('reject admission accepts only an unused independent rejection bound to the current design', async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'leo-dev-design-admission-')); temporary.push(repositoryRoot);
  const source = '# Reviewed design\n'; await writeFile(join(repositoryRoot, 'design.md'), source);
  const routes: RoutedPlan[] = [{ task: { id: 'implementation', revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['src/app.ts'], acceptance: ['passes'], gateIds: ['pass'], risk: 'standard' }, taskHash: hash('task'), registryPath: 'core/gates/default.yaml', gateDefinitionHash: hash('gate') }];
  const context = { changeId: 'change-1', specHash: hash('spec'), planHash: normalizedPlanHash(routes), designPath: 'design.md', designHash: hash(source), designSourceBase64: Buffer.from(source).toString('base64'), producerSession: 'producer' };
  const receipt = { receiptId: 'reject-1', provenance: 'platform-attested' as const, actorLabel: 'reviewer', sessionId: 'reviewer', changeId: context.changeId, specHash: context.specHash, planHash: context.planHash, designHash: context.designHash, producerSession: context.producerSession, findingsHash: hash('findings'), verdict: 'reject' as const, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
  const input = { repositoryRoot, changeId: context.changeId, routes, authority: { specHash: context.specHash }, context: () => context, acquireReceipt: async () => ({ absolutePath: 'receipt.json', relativePath: 'receipt.json', bytes: Buffer.from(JSON.stringify(receipt)), receipt }), receiptIdUsed: () => false };

  await expect(rejectDesignReview({ ...input, acquireReceipt: async () => ({ absolutePath: 'receipt.json', relativePath: 'receipt.json', bytes: Buffer.from(JSON.stringify({ ...receipt, verdict: 'pass' })), receipt: { ...receipt, verdict: 'pass' } }) })).rejects.toMatchObject({ publicCode: 'CONFLICT' } satisfies Partial<DesignAdmissionError>);
  await expect(rejectDesignReview({ ...input, receiptIdUsed: () => true })).rejects.toMatchObject({ publicCode: 'CONFLICT' } satisfies Partial<DesignAdmissionError>);
  await expect(rejectDesignReview(input)).resolves.toMatchObject({ context, acquired: { receipt } });
});
