export type ExitCode = 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface PublicError {
  code: string;
  message: string;
}

export interface Envelope {
  ok: boolean;
  code: string;
  state: unknown;
  errors: PublicError[];
  evidenceRefs: string[];
}

export interface CommandResult {
  exitCode: ExitCode;
  envelope: Envelope;
}

export type CommandOptions = Record<string, unknown> & {
  repo?: string;
  json?: boolean;
  dryRun?: boolean;
  change?: string;
  task?: string;
  recoverReview?: boolean;
  receipt?: string;
  goal?: string;
};

export class ControllerError extends Error {
  constructor(readonly exitCode: ExitCode, readonly publicCode: string, message: string, readonly state: unknown = null, readonly evidenceRefs: string[] = []) {
    super(message);
  }
}

export function result(code: string, state: unknown = null, evidenceRefs: string[] = []): CommandResult {
  return { exitCode: 0, envelope: { ok: true, code, state, errors: [], evidenceRefs } };
}

export function failure(error: ControllerError): CommandResult {
  return {
    exitCode: error.exitCode,
    envelope: {
      ok: false,
      code: error.publicCode,
      state: error.state,
      errors: [{ code: error.publicCode, message: error.message }],
      evidenceRefs: error.evidenceRefs,
    },
  };
}
