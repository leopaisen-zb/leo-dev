import { createHash } from 'node:crypto';
import { mkdir, open, readFile, truncate } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { JournalEvent } from './types.js';
import { withJournalLock } from './lock.js';

export class JournalCorruptError extends Error { code = 'JOURNAL_CORRUPT' as const; }
export class JournalTailMismatchError extends Error { code = 'JOURNAL_TAIL_MISMATCH' as const; }
export interface ReplayResult { events: JournalEvent[]; discardedIncompleteTail: boolean; }
export interface JournalTransaction {
  replay(): Promise<ReplayResult>;
  append(input: Input): Promise<JournalEvent>;
  appendIfTail(input: Input, expectedEventHash: string): Promise<JournalEvent>;
  appendAt(factory: (timestamp: string) => Input): Promise<JournalEvent>;
  appendIfTailAt(factory: (timestamp: string) => Input, expectedEventHash: string): Promise<JournalEvent>;
}
type Input = Omit<JournalEvent, 'sequence' | 'previousEventHash' | 'timestamp' | 'payloadHash' | 'eventHash'> & { payload?: unknown };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function eventHash(event: Omit<JournalEvent, 'eventHash'>): string {
  const { payload, eventHash: _eventHash, ...framed } = event as JournalEvent;
  return hash(JSON.stringify(framed));
}
function validateInput(input: Input): void {
  if (typeof input.changeId !== 'string' || input.changeId.trim().length === 0 || typeof input.type !== 'string' || input.type.trim().length === 0 || (input.taskId !== undefined && (typeof input.taskId !== 'string' || input.taskId.trim().length === 0)) || (input.taskRevision !== undefined && (!Number.isSafeInteger(input.taskRevision) || input.taskRevision < 1)) || (input.leaseGeneration !== undefined && (!Number.isSafeInteger(input.leaseGeneration) || input.leaseGeneration < 1))) { const error = new Error('Invalid journal event input') as Error & { code: string }; error.code = 'JOURNAL_EVENT_INVALID'; throw error; }
}

export class Journal {
  constructor(readonly path: string) {}

  async withExclusive<T>(operation: (transaction: JournalTransaction) => Promise<T>): Promise<T> {
    await mkdir(dirname(this.path), { recursive: true });
    return withJournalLock(this.path, () => operation({
      replay: () => this.#replayUnlocked(),
      append: (input) => this.#appendUnlocked(input),
      appendIfTail: (input, expectedEventHash) => this.#appendIfTailUnlocked(input, expectedEventHash),
      appendAt: (factory) => this.#appendAtUnlocked(factory),
      appendIfTailAt: (factory, expectedEventHash) => this.#appendIfTailAtUnlocked(factory, expectedEventHash),
    }));
  }

  async append(input: Input): Promise<JournalEvent> { return this.withExclusive((transaction) => transaction.append(input)); }
  async appendIfTail(input: Input, expectedEventHash: string): Promise<JournalEvent> {
    return this.withExclusive((transaction) => transaction.appendIfTail(input, expectedEventHash));
  }

  async #appendUnlocked(input: Input): Promise<JournalEvent> {
    validateInput(input);
    const prior = await this.#replayUnlocked();
    return this.#appendAfterReplay(input, prior);
  }

  async #appendIfTailUnlocked(input: Input, expectedEventHash: string): Promise<JournalEvent> {
    validateInput(input);
    const prior = await this.#replayUnlocked(false);
    if (prior.discardedIncompleteTail || prior.events.at(-1)?.eventHash !== expectedEventHash) throw new JournalTailMismatchError('Journal tail does not match the expected event hash');
    return this.#appendAfterReplay(input, prior);
  }

  async #appendAtUnlocked(factory: (timestamp: string) => Input): Promise<JournalEvent> {
    const prior = await this.#replayUnlocked();
    const timestamp = new Date().toISOString();
    const input = factory(timestamp);
    validateInput(input);
    return this.#appendAfterReplay(input, prior, timestamp);
  }

  async #appendIfTailAtUnlocked(factory: (timestamp: string) => Input, expectedEventHash: string): Promise<JournalEvent> {
    const prior = await this.#replayUnlocked(false);
    if (prior.discardedIncompleteTail || prior.events.at(-1)?.eventHash !== expectedEventHash) throw new JournalTailMismatchError('Journal tail does not match the expected event hash');
    const timestamp = new Date().toISOString();
    const input = factory(timestamp);
    validateInput(input);
    return this.#appendAfterReplay(input, prior, timestamp);
  }

  async #appendAfterReplay(input: Input, prior: ReplayResult, timestamp = new Date().toISOString()): Promise<JournalEvent> {
    const previous = prior.events.at(-1);
    const payload = input.payload ?? null;
    const event: JournalEvent = {
      sequence: (previous?.sequence ?? 0) + 1, previousEventHash: previous?.eventHash ?? '0'.repeat(64), changeId: input.changeId,
      ...(input.taskId === undefined ? {} : { taskId: input.taskId }), ...(input.taskRevision === undefined ? {} : { taskRevision: input.taskRevision }), ...(input.leaseGeneration === undefined ? {} : { leaseGeneration: input.leaseGeneration }),
      type: input.type, timestamp, payloadHash: hash(JSON.stringify(payload)), payload, eventHash: '',
    };
    event.eventHash = eventHash(event);
    const handle = await open(this.path, 'a');
    try { await handle.writeFile(`${JSON.stringify(event)}\n`); await handle.sync(); } finally { await handle.close(); }
    const directory = await open(dirname(this.path), 'r'); try { await directory.sync(); } finally { await directory.close(); }
    return event;
  }

  async replay(): Promise<ReplayResult> { return this.withExclusive((transaction) => transaction.replay()); }

  /** Gate recovery inspects an incomplete tail without mutating the ledger. */
  async replayStrict(): Promise<ReplayResult> {
    await mkdir(dirname(this.path), { recursive: true });
    return withJournalLock(this.path, () => this.#replayUnlocked(false));
  }

  async #replayUnlocked(repairIncompleteTail = true): Promise<ReplayResult> {
    let raw: string;
    try { raw = await readFile(this.path, 'utf8'); } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { events: [], discardedIncompleteTail: false }; throw error; }
    let discardedIncompleteTail = false;
    if (raw && !raw.endsWith('\n')) {
      const cut = raw.lastIndexOf('\n');
      raw = cut < 0 ? '' : raw.slice(0, cut + 1);
      if (repairIncompleteTail) {
        await truncate(this.path, Buffer.byteLength(raw));
        const handle = await open(this.path, 'r'); try { await handle.sync(); } finally { await handle.close(); }
      }
      discardedIncompleteTail = true;
    }
    const events: JournalEvent[] = [];
    for (const line of raw.split('\n').filter(Boolean)) {
      let event: JournalEvent;
      try { event = JSON.parse(line) as JournalEvent; } catch { throw new JournalCorruptError('Malformed committed journal frame'); }
      const previous = events.at(-1);
      if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || typeof event.changeId !== 'string' || event.changeId.length === 0 || typeof event.type !== 'string' || event.type.length === 0 || (event.taskId !== undefined && (typeof event.taskId !== 'string' || event.taskId.length === 0)) || Number.isNaN(Date.parse(event.timestamp)) || !/^[a-f0-9]{64}$/.test(event.previousEventHash) || !/^[a-f0-9]{64}$/.test(event.payloadHash) || !/^[a-f0-9]{64}$/.test(event.eventHash) || (event.taskRevision !== undefined && (!Number.isSafeInteger(event.taskRevision) || event.taskRevision < 1)) || (event.leaseGeneration !== undefined && (!Number.isSafeInteger(event.leaseGeneration) || event.leaseGeneration < 1))) throw new JournalCorruptError('Journal frame structure is invalid');
      if (event.sequence !== (previous?.sequence ?? 0) + 1 || event.previousEventHash !== (previous?.eventHash ?? '0'.repeat(64)) || event.payloadHash !== hash(JSON.stringify(event.payload ?? null)) || event.eventHash !== eventHash(event)) throw new JournalCorruptError('Hash chain or sequence is invalid');
      events.push(event);
    }
    return { events, discardedIncompleteTail };
  }
}

/** Controller-facing recovery never mutates an already committed corrupt ledger. */
export async function recoverJournal(journal: Journal): Promise<{ ok: true; replay: ReplayResult } | { ok: false; code: 'JOURNAL_CORRUPT'; changeState: 'blocked'; taskState: 'blocked'; detail: string }> {
  try { return { ok: true, replay: await journal.replay() }; }
  catch (error: unknown) {
    if (error instanceof JournalCorruptError) return { ok: false, code: 'JOURNAL_CORRUPT', changeState: 'blocked', taskState: 'blocked', detail: error.message };
    throw error;
  }
}
