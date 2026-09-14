export type ChangeState = 'triage' | 'discovery' | 'spec-review' | 'spec-approved' | 'design-review' | 'design-approved' | 'task-ready' | 'executing' | 'integration-review' | 'release-evidence' | 'archived' | 'approval-required' | 'blocked';
export type TaskState = 'pending' | 'ready' | 'leased' | 'implementing' | 'verifying' | 'review-required' | 'reviewing' | 'remediation' | 'done' | 'blocked';
export type RunState = 'created' | 'running' | 'succeeded' | 'failed' | 'timed-out' | 'cancelled' | 'abandoned' | 'unknown';

export interface JournalEvent {
  sequence: number;
  previousEventHash: string;
  changeId: string;
  taskId?: string;
  taskRevision?: number;
  leaseGeneration?: number;
  type: string;
  timestamp: string;
  payloadHash: string;
  eventHash: string;
  payload?: unknown;
}

export interface TaskDefinition {
  id: string;
  revision: number;
  state: TaskState;
  dependsOn: string[];
  allowedPaths: string[];
  acceptance: string[];
  gateIds: string[];
  risk: 'lite' | 'standard' | 'full';
  role?: 'integration';
}
