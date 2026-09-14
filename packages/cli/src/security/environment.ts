import { createHash } from 'node:crypto';

const baselineNames = process.platform === 'win32' ? ['PATH', 'SystemRoot'] : ['PATH'];

/** The launcher needs PATH; every other variable must be explicitly reviewed. */
export function minimalEnvironment(allowlist: readonly string[], source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of new Set([...baselineNames, ...allowlist])) {
    const value = source[name];
    if (typeof value === 'string') result[name] = value;
  }
  return result;
}

export function environmentPolicyFingerprint(allowlist: readonly string[]): string {
  const names = [...new Set([...baselineNames, ...allowlist])].sort();
  return createHash('sha256').update(JSON.stringify({ baseline: baselineNames, allowlist: names })).digest('hex');
}
