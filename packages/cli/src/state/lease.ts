import type { Journal } from './journal.js';
import { canonicalTreeHash } from '../repository/tree-hash.js';

export interface Lease { taskId: string; taskRevision: number; generation: number; inputTreeHash: string; expiresAt: string; }
export type CasResult = { ok: true; lease: Lease } | { ok: false; code: 'STALE_LEASE' | 'STALE_REVISION' | 'STALE_TREE' | 'EXPIRED_LEASE'; detail: string };

type LeasePayload = { lease: Lease };
const latestClaim = (events: Array<{ type: string; payload?: unknown }>, taskId: string): Lease | undefined => {
  const matching = events.filter((event) => event.type === 'lease.claimed' && typeof event.payload === 'object' && event.payload !== null && ((event.payload as LeasePayload).lease?.taskId === taskId));
  return matching.at(-1) ? (matching.at(-1)!.payload as LeasePayload).lease : undefined;
};
const activeLeases = (events: Array<{ type: string; taskId?: string; payload?: unknown }>, changeId: string): Lease[] => {
  const active = new Map<string, Lease>();
  for (const event of events) {
    if (event.type === 'lease.claimed' && event.taskId && typeof event.payload === 'object' && event.payload) active.set(event.taskId, (event.payload as LeasePayload).lease);
    if ((event.type === 'lease.released' || event.type === 'lease.abandoned') && event.taskId) active.delete(event.taskId);
  }
  return [...active.values()];
};

export class LeaseManager {
  constructor(private readonly journal: Journal, private readonly repositoryRoot: string, private readonly changeId = 'change') {}

  async claimPersistent(taskId: string, taskRevision: number, ttlMs: number, now = new Date()): Promise<Lease> {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) { const error = new Error('Lease TTL must be positive') as Error & { code: string }; error.code = 'INVALID_LEASE_TTL'; throw error; }
    return this.journal.withExclusive(async (transaction) => {
      const events = (await transaction.replay()).events;
      const prior = latestClaim(events, taskId);
      const active = activeLeases(events.filter((event) => event.changeId === this.changeId), this.changeId).find((lease) => Date.parse(lease.expiresAt) > now.getTime());
      if (active) { const error = new Error('Active serial lease exists') as Error & { code: string }; error.code = 'ACTIVE_LEASE'; throw error; }
      const inputTreeHash = (await canonicalTreeHash(this.repositoryRoot)).hash;
      const lease: Lease = { taskId, taskRevision, inputTreeHash, generation: (prior?.generation ?? 0) + 1, expiresAt: new Date(now.getTime() + ttlMs).toISOString() };
      await transaction.append({ changeId: this.changeId, taskId, taskRevision, leaseGeneration: lease.generation, type: 'lease.claimed', payload: { lease } });
      return lease;
    });
  }

  async assertCurrentPersistent(candidate: Pick<Lease, 'taskId' | 'taskRevision' | 'generation' | 'inputTreeHash'>, now = new Date()): Promise<CasResult> {
    return this.journal.withExclusive(async (transaction) => {
      const current = activeLeases(await transaction.replay().then((replay) => replay.events), this.changeId).find((lease) => lease.taskId === candidate.taskId);
      if (!current || current.generation !== candidate.generation) return { ok: false, code: 'STALE_LEASE', detail: 'lease generation is not current' };
      if (current.taskRevision !== candidate.taskRevision) return { ok: false, code: 'STALE_REVISION', detail: 'task revision changed' };
      if (Date.parse(current.expiresAt) <= now.getTime()) return { ok: false, code: 'EXPIRED_LEASE', detail: 'lease expired' };
      const actualTree = (await canonicalTreeHash(this.repositoryRoot)).hash;
      if (current.inputTreeHash !== candidate.inputTreeHash || candidate.inputTreeHash !== actualTree) return { ok: false, code: 'STALE_TREE', detail: 'input tree changed' };
      return { ok: true, lease: current };
    });
  }
  async assertReviewPersistent(candidate: Pick<Lease, 'taskId' | 'taskRevision' | 'generation' | 'inputTreeHash'>): Promise<CasResult> { return this.assertCurrentPersistent(candidate); }
  async releasePersistent(taskId: string, generation: number, abandoned = false): Promise<void> {
    await this.journal.withExclusive(async (transaction) => {
      const current = activeLeases(await transaction.replay().then((replay) => replay.events), this.changeId).find((lease) => lease.taskId === taskId);
      if (!current || current.generation !== generation) { const error = new Error('Lease is stale') as Error & { code: string }; error.code = 'STALE_LEASE'; throw error; }
      await transaction.append({ changeId: this.changeId, taskId, taskRevision: current.taskRevision, leaseGeneration: generation, type: abandoned ? 'lease.abandoned' : 'lease.released', payload: { lease: current } });
    });
  }
}
