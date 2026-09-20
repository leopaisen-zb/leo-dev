export type AttemptKind = 'initial' | 'remediation' | 'blocked';

function payload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function failedAttemptCount(events: ReadonlyArray<{ type: string; taskId?: string }>, taskId: string): number {
  return events.filter((event) => event.type === 'task.attempt.failed' && event.taskId === taskId).length;
}

export function previousFindingsHash(
  events: ReadonlyArray<{ type: string; taskId?: string; payload?: unknown }>,
  taskId: string,
): string | undefined {
  const last = events.filter((event) => event.type === 'task.attempt.failed' && event.taskId === taskId).at(-1);
  const findingsHash = payload(last?.payload).findingsHash;
  return typeof findingsHash === 'string' ? findingsHash : undefined;
}

export function decideFailedAttempt(input: {
  priorFailures: number;
  previousFindingsHash?: string;
  currentFindingsHash?: string;
}): { target: 'remediation' | 'blocked'; nextKind: AttemptKind; reason?: 'no-progress' } {
  if (input.priorFailures === 0) return { target: 'remediation', nextKind: 'remediation' };
  if (input.previousFindingsHash === input.currentFindingsHash) {
    return { target: 'blocked', nextKind: 'blocked', reason: 'no-progress' };
  }
  return { target: 'remediation', nextKind: 'remediation' };
}
