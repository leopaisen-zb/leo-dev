export type BoardColumn = 'queued' | 'active' | 'review' | 'done';
export type CandidateStatus = 'unknown' | 'matches' | 'drifted';

export interface BoardEvidence {
  kind: 'gate' | 'review';
  status: string;
  runId?: string;
  candidateTreeHash?: string;
  evidenceRef?: string;
  recordedAt?: string;
  currentCandidate: CandidateStatus;
}

export interface BoardTaskObservation {
  id: string;
  title: string;
  revision: number;
  state: string;
  column: BoardColumn;
  blocked: boolean;
  requirements: string[];
  runId: string | null;
  assignmentSession: string | null;
  runState: string | null;
  leaseActive: boolean | null;
  lastActivity: string | null;
  blockers: BoardBlocker[];
  gate: BoardEvidence | null;
  review: BoardEvidence | null;
}

export interface RecordedTeamObservation {
  teamId: string;
  revision: number;
  members: Array<{ memberId: string; role: string; access: string; generation: number; threadId: string | null; lastRecordedActivity: string | null }>;
  messages: Array<{ messageId: string; kind: string; status: string; fromMemberId: string; toMemberId: string; recordedAt: string | null }>;
}

export interface BoardBlocker { blockerId: string; reason: string | null; taskId: string | null; recordedAt: string; }

export interface BoardObservation {
  schemaVersion: 1;
  observedAt: string;
  repositoryRoot: string;
  changeId: string;
  availability: 'available' | 'unavailable';
  hostLiveStatus: 'unknown';
  blocker?: { code: string; message: string };
  change?: { state: string; revision: number; revisionId: string | null; blockers: BoardBlocker[] };
  tasks?: BoardTaskObservation[];
  recordedTeam?: RecordedTeamObservation | null;
}
