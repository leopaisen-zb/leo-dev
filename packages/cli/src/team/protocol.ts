import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import YAML from 'yaml';
import { assertContained } from '../changes/artifacts.js';
import type { JournalEvent } from '../state/types.js';
import type { TeamAckOperation, TeamBindOperation, TeamMember, TeamMessage, TeamMessageOperation, TeamOpenOperation, TeamOperation, TeamRecord, TeamRecordedPayload, TeamState } from './types.js';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const sha256 = /^[a-f0-9]{64}$/;
const messageKinds = new Set(['contribution', 'challenge', 'response', 'handoff']);
const controllerRuntimeArtifact = /^\.leo-dev\/runtime\/[^/]+\/(?:snapshot\.json|journal\.ndjson|journal\.ndjson\.lock|lease\.json)$/i;

export class TeamProtocolError extends Error {
  constructor(readonly kind: 'validation' | 'conflict', message: string) { super(message); }
}

function fail(kind: 'validation' | 'conflict', message: string): never { throw new TeamProtocolError(kind, message); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('validation', `${label} must be an object`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, fields: readonly string[], label: string): void {
  if (Object.keys(value).some((key) => !fields.includes(key)) || fields.some((key) => !Object.hasOwn(value, key))) fail('validation', `${label} has missing or unknown fields`);
}
function optionalExact(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], label: string): void {
  if (Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key)) || required.some((key) => !Object.hasOwn(value, key))) fail('validation', `${label} has missing or unknown fields`);
}
function boundedString(value: unknown, label: string, maximum: number, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximum || (pattern && !pattern.test(value))) fail('validation', `${label} is invalid`);
  return value;
}
function nonnegative(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail('validation', `${label} must be a non-negative integer`);
  return value as number;
}
function parseArtifact(value: unknown): { path: string; sha256: string } {
  const artifact = object(value, 'artifact'); exact(artifact, ['path', 'sha256'], 'artifact');
  const path = boundedString(artifact.path, 'artifact.path', 512);
  if (isAbsolute(path) || path !== path.replaceAll('\\', '/') || path.split('/').some((part) => part === '' || part === '.' || part === '..')) fail('validation', 'artifact.path must be a normalized repository-relative path');
  const contentHash = boundedString(artifact.sha256, 'artifact.sha256', 64);
  if (!sha256.test(contentHash)) fail('validation', 'artifact.sha256 must be a lowercase SHA256');
  return { path, sha256: contentHash };
}

function parseOpen(value: Record<string, unknown>): TeamOpenOperation {
  exact(value, ['type', 'members'], 'open operation');
  if (value.type !== 'open' || !Array.isArray(value.members) || value.members.length < 2 || value.members.length > 12) fail('validation', 'open requires 2 to 12 members');
  const members = value.members.map((candidate) => {
    const member = object(candidate, 'member'); exact(member, ['memberId', 'role', 'access'], 'member');
    const memberId = boundedString(member.memberId, 'member.memberId', 80, identifier);
    const role = boundedString(member.role, 'member.role', 160);
    if (member.role !== role.trim()) fail('validation', 'member.role must not have surrounding whitespace');
    if (member.access !== 'read' && member.access !== 'write') fail('validation', 'member.access is invalid');
    return { memberId, role, access: member.access } as const;
  });
  if (new Set(members.map((member) => member.memberId)).size !== members.length) fail('validation', 'open members must have unique memberId values');
  if (members.filter((member) => member.access === 'write').length > 1) fail('validation', 'open allows at most one writer');
  return { type: 'open', members };
}
function parseBind(value: Record<string, unknown>): TeamBindOperation {
  optionalExact(value, ['type', 'memberId', 'threadId', 'expectedGeneration', 'reason'], ['handoffMessageId'], 'bind operation');
  if (value.type !== 'bind') fail('validation', 'bind operation type is invalid');
  const output: TeamBindOperation = {
    type: 'bind', memberId: boundedString(value.memberId, 'bind.memberId', 80, identifier), threadId: boundedString(value.threadId, 'bind.threadId', 256),
    expectedGeneration: nonnegative(value.expectedGeneration, 'bind.expectedGeneration'), reason: boundedString(value.reason, 'bind.reason', 512),
  };
  if (value.reason !== output.reason.trim()) fail('validation', 'bind.reason must not have surrounding whitespace');
  if (value.handoffMessageId !== undefined) output.handoffMessageId = boundedString(value.handoffMessageId, 'bind.handoffMessageId', 80, identifier);
  return output;
}
function parseMessage(value: Record<string, unknown>): TeamMessageOperation {
  optionalExact(value, ['type', 'messageId', 'kind', 'fromMemberId', 'fromGeneration', 'toMemberId', 'toGeneration', 'artifact'], ['replyTo'], 'message operation');
  if (value.type !== 'message' || !messageKinds.has(String(value.kind))) fail('validation', 'message.kind is invalid');
  const output: TeamMessageOperation = {
    type: 'message', messageId: boundedString(value.messageId, 'message.messageId', 80, identifier), kind: value.kind as TeamMessageOperation['kind'],
    fromMemberId: boundedString(value.fromMemberId, 'message.fromMemberId', 80, identifier), fromGeneration: nonnegative(value.fromGeneration, 'message.fromGeneration'),
    toMemberId: boundedString(value.toMemberId, 'message.toMemberId', 80, identifier), toGeneration: nonnegative(value.toGeneration, 'message.toGeneration'), artifact: parseArtifact(value.artifact),
  };
  if (value.replyTo !== undefined) output.replyTo = boundedString(value.replyTo, 'message.replyTo', 80, identifier);
  if (output.kind === 'response' && !output.replyTo) fail('validation', 'response requires replyTo');
  if (output.kind !== 'response' && output.replyTo !== undefined) fail('validation', 'only response may include replyTo');
  return output;
}
function parseAck(value: Record<string, unknown>): TeamAckOperation {
  exact(value, ['type', 'messageId', 'recipientGeneration', 'hostReference'], 'ack operation');
  if (value.type !== 'ack') fail('validation', 'ack operation type is invalid');
  return { type: 'ack', messageId: boundedString(value.messageId, 'ack.messageId', 80, identifier), recipientGeneration: nonnegative(value.recipientGeneration, 'ack.recipientGeneration'), hostReference: boundedString(value.hostReference, 'ack.hostReference', 512) };
}

export function canonicalTeamRecord(record: TeamRecord): string {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, sort((value as Record<string, unknown>)[key])]));
    return value;
  };
  return JSON.stringify(sort(record));
}
export function parseTeamRecord(value: unknown): TeamRecord {
  const candidate = object(value, 'team record'); exact(candidate, ['schemaVersion', 'requestId', 'teamId', 'expectedRevision', 'specHash', 'operation'], 'team record');
  if (candidate.schemaVersion !== 1) fail('validation', 'team record schemaVersion must be 1');
  const operationValue = object(candidate.operation, 'operation');
  const type = operationValue.type;
  const operation: TeamOperation = type === 'open' ? parseOpen(operationValue) : type === 'bind' ? parseBind(operationValue) : type === 'message' ? parseMessage(operationValue) : type === 'ack' ? parseAck(operationValue) : fail('validation', 'operation.type is invalid');
  const specHash = boundedString(candidate.specHash, 'specHash', 64);
  if (!sha256.test(specHash)) fail('validation', 'specHash must be a lowercase SHA256');
  return { schemaVersion: 1, requestId: boundedString(candidate.requestId, 'requestId', 128, identifier), teamId: boundedString(candidate.teamId, 'teamId', 80, identifier), expectedRevision: nonnegative(candidate.expectedRevision, 'expectedRevision'), specHash, operation };
}

export async function loadTeamRecord(repositoryRoot: string, relativeInput: unknown): Promise<TeamRecord> {
  const input = boundedString(relativeInput, '--input', 512);
  if (isAbsolute(input) || input !== input.replaceAll('\\', '/') || input.split('/').some((part) => part === '' || part === '.' || part === '..')) fail('validation', '--input must be a normalized repository-relative path');
  const path = resolve(repositoryRoot, input);
  try { await assertContained(repositoryRoot, path); const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink()) fail('validation', '--input must reference a contained regular file');
    const text = await readFile(path, 'utf8'); let parsed: unknown;
    try { const document = YAML.parseDocument(text); if (document.errors.length > 0) fail('validation', 'input is not valid JSON or YAML'); parsed = document.toJS(); } catch (error) { if (error instanceof TeamProtocolError) throw error; fail('validation', 'input is not valid JSON or YAML'); }
    return parseTeamRecord(parsed);
  } catch (error: unknown) { if (error instanceof TeamProtocolError) throw error; fail('validation', `--input is not a contained regular file: ${error instanceof Error ? error.message : String(error)}`); }
}

async function validateArtifact(repositoryRoot: string, artifact: { path: string; sha256: string }, errorKind: 'validation' | 'conflict' = 'validation'): Promise<void> {
  if (controllerRuntimeArtifact.test(artifact.path)) fail(errorKind, 'message artifact must not reference controller-owned runtime state');
  const path = resolve(repositoryRoot, artifact.path);
  try {
    await assertContained(repositoryRoot, path); const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) fail(errorKind, 'message artifact must be a contained regular file');
    if (info.size > 32 * 1024) fail(errorKind, 'message artifact exceeds 32 KiB');
    if ((info.mode & 0o111) !== 0) fail(errorKind, 'message artifact must not be executable');
    const content = await readFile(path);
    if (content.includes(0) || content.subarray(0, 2).toString('utf8') === '#!') fail(errorKind, 'message artifact is not bounded engineering text');
    if (hash(content) !== artifact.sha256) fail(errorKind, 'message artifact SHA256 does not match');
  } catch (error: unknown) { if (error instanceof TeamProtocolError) throw error; fail(errorKind, `message artifact is not a contained regular file: ${error instanceof Error ? error.message : String(error)}`); }
}

function clone<T>(value: T): T { return structuredClone(value); }
function member(state: TeamState, memberId: string): TeamMember | undefined { return state.members.find((candidate) => candidate.memberId === memberId); }
function message(state: TeamState, messageId: string): TeamMessage | undefined { return state.messages.find((candidate) => candidate.messageId === messageId); }

function apply(state: TeamState | null, record: TeamRecord): TeamState {
  const operation = record.operation;
  if (operation.type === 'open') {
    if (state) fail('conflict', 'team is already open');
    if (record.expectedRevision !== 0) fail('conflict', 'open requires expectedRevision 0');
    return { schemaVersion: 1, teamId: record.teamId, specHash: record.specHash, revision: 1, members: operation.members.map((candidate) => ({ ...candidate, generation: 0, threadId: null, bindings: [] })), messages: [] };
  }
  if (!state) fail('conflict', 'team is not open');
  if (state.teamId !== record.teamId) fail('conflict', 'teamId does not match the open team');
  if (state.specHash !== record.specHash) fail('conflict', 'record specHash does not match the open team');
  if (record.expectedRevision !== state.revision) fail('conflict', 'expectedRevision is stale');
  const next = clone(state);
  if (operation.type === 'bind') {
    const target = member(next, operation.memberId);
    if (!target) fail('conflict', 'bind references an unknown member');
    if (target.generation !== operation.expectedGeneration) fail('conflict', 'bind expectedGeneration is stale');
    if (next.members.some((candidate) => candidate.bindings.some((binding) => binding.threadId === operation.threadId))) fail('conflict', 'threadId has already been bound; use followup for an existing handle');
    if (target.generation >= 1) {
      if (!operation.handoffMessageId) fail('conflict', 'lost-member replacement requires handoffMessageId');
      const handoff = message(next, operation.handoffMessageId);
      if (!handoff || handoff.kind !== 'handoff' || (handoff.fromMemberId !== target.memberId && handoff.toMemberId !== target.memberId)) fail('conflict', 'lost-member replacement requires a handoff addressed to or from the member');
      const handoffGeneration = handoff.fromMemberId === target.memberId ? handoff.fromGeneration : handoff.toGeneration;
      if (handoffGeneration !== target.generation) fail('conflict', 'lost-member replacement requires a handoff from the member current generation');
    } else if (operation.handoffMessageId !== undefined) fail('validation', 'first bind must not include handoffMessageId');
    target.generation += 1; target.threadId = operation.threadId; target.bindings.push({ generation: target.generation, threadId: operation.threadId, reason: operation.reason, ...(operation.handoffMessageId ? { handoffMessageId: operation.handoffMessageId } : {}) });
  } else if (operation.type === 'message') {
    const from = member(next, operation.fromMemberId); const to = member(next, operation.toMemberId);
    if (!from || !to || from.memberId === to.memberId || from.threadId === null || to.threadId === null) fail('conflict', 'message requires two distinct currently bound members');
    if (from.generation !== operation.fromGeneration || to.generation !== operation.toGeneration) fail('conflict', 'message member generation is fenced');
    if (message(next, operation.messageId)) fail('conflict', 'messageId has already been used');
    if (operation.kind === 'response') {
      const challenge = operation.replyTo ? message(next, operation.replyTo) : undefined;
      if (!challenge || challenge.kind !== 'challenge' || challenge.fromMemberId !== to.memberId || challenge.fromGeneration !== to.generation || challenge.toMemberId !== from.memberId || challenge.toGeneration !== from.generation) fail('conflict', 'response replyTo does not reference the reversed prior challenge');
    }
    next.messages.push({ ...operation, status: 'pending' });
  } else {
    const target = message(next, operation.messageId);
    if (!target) fail('conflict', 'ack references an unknown message');
    if (target.status !== 'pending') fail('conflict', 'message is already acknowledged');
    const from = member(next, target.fromMemberId); const to = member(next, target.toMemberId);
    if (!from || !to || from.generation !== target.fromGeneration || to.generation !== target.toGeneration || target.toGeneration !== operation.recipientGeneration) fail('conflict', 'ack references a fenced member generation');
    target.status = 'delivered'; target.hostReference = operation.hostReference;
  }
  next.revision += 1;
  return next;
}

function storedRecord(event: JournalEvent): TeamRecord {
  const payload = event.payload as Partial<TeamRecordedPayload> | null;
  if (payload?.schemaVersion !== 1 || typeof payload.canonical !== 'string') fail('conflict', 'team journal payload is malformed');
  const record = parseTeamRecord(payload.record);
  if (canonicalTeamRecord(record) !== payload.canonical) fail('conflict', 'team journal payload canonical record is malformed');
  return record;
}
export function projectTeam(events: JournalEvent[]): TeamState | null {
  let state: TeamState | null = null;
  for (const event of events.filter((candidate) => candidate.type === 'team.operation.recorded')) state = apply(state, storedRecord(event));
  return state;
}

async function validateCurrentBindHandoff(repositoryRoot: string, state: TeamState | null, record: TeamRecord): Promise<void> {
  if (!state || record.operation.type !== 'bind') return;
  const target = member(state, record.operation.memberId);
  if (!target || target.generation < 1 || !record.operation.handoffMessageId) return;
  const handoff = message(state, record.operation.handoffMessageId);
  if (!handoff || handoff.kind !== 'handoff' || (handoff.fromMemberId !== target.memberId && handoff.toMemberId !== target.memberId)) return;
  const handoffGeneration = handoff.fromMemberId === target.memberId ? handoff.fromGeneration : handoff.toGeneration;
  if (handoffGeneration !== target.generation) fail('conflict', 'lost-member replacement requires a handoff from the member current generation');
  await validateArtifact(repositoryRoot, handoff.artifact, 'conflict');
}

export async function planTeamRecord(repositoryRoot: string, events: JournalEvent[], currentSpecHash: string, record: TeamRecord): Promise<{ replay: boolean; state: TeamState; payload?: TeamRecordedPayload }> {
  const state = projectTeam(events);
  const canonical = canonicalTeamRecord(record);
  const prior = events.filter((event) => event.type === 'team.operation.recorded').map(storedRecord).find((candidate) => candidate.requestId === record.requestId);
  if (prior) {
    if (canonicalTeamRecord(prior) !== canonical) fail('conflict', 'requestId has already been used with a different payload');
    if (state?.specHash !== currentSpecHash) fail('conflict', 'current specification differs from the open team');
    return { replay: true, state: state! };
  }
  if (state?.specHash !== undefined && state.specHash !== currentSpecHash) fail('conflict', 'current specification differs from the open team');
  if (record.specHash !== currentSpecHash) fail('conflict', 'record specHash does not match the current specification');
  if (record.operation.type === 'message') await validateArtifact(repositoryRoot, record.operation.artifact);
  await validateCurrentBindHandoff(repositoryRoot, state, record);
  const next = apply(state, record);
  return { replay: false, state: next, payload: { schemaVersion: 1, canonical, record } };
}
