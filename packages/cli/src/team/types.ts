export type TeamAccess = 'read' | 'write';
export type TeamMessageKind = 'contribution' | 'challenge' | 'response' | 'handoff';

export type TeamMember = {
  memberId: string;
  role: string;
  access: TeamAccess;
  generation: number;
  threadId: string | null;
  bindings: Array<{ generation: number; threadId: string; reason: string; handoffMessageId?: string }>;
};

export type TeamMessage = {
  messageId: string;
  kind: TeamMessageKind;
  fromMemberId: string;
  fromGeneration: number;
  toMemberId: string;
  toGeneration: number;
  artifact: { path: string; sha256: string };
  replyTo?: string;
  status: 'pending' | 'delivered';
  hostReference?: string;
};

export type TeamState = {
  schemaVersion: 1;
  teamId: string;
  specHash: string;
  revision: number;
  members: TeamMember[];
  messages: TeamMessage[];
};

export type TeamOpenOperation = { type: 'open'; members: Array<{ memberId: string; role: string; access: TeamAccess }> };
export type TeamBindOperation = { type: 'bind'; memberId: string; threadId: string; expectedGeneration: number; reason: string; handoffMessageId?: string };
export type TeamMessageOperation = {
  type: 'message'; messageId: string; kind: TeamMessageKind; fromMemberId: string; fromGeneration: number;
  toMemberId: string; toGeneration: number; artifact: { path: string; sha256: string }; replyTo?: string;
};
export type TeamAckOperation = { type: 'ack'; messageId: string; recipientGeneration: number; hostReference: string };
export type TeamOperation = TeamOpenOperation | TeamBindOperation | TeamMessageOperation | TeamAckOperation;

export type TeamRecord = {
  schemaVersion: 1;
  requestId: string;
  teamId: string;
  expectedRevision: number;
  specHash: string;
  operation: TeamOperation;
};

export type TeamRecordedPayload = { schemaVersion: 1; canonical: string; record: TeamRecord };
