export interface RedactionResult { text: string; redacted: boolean; }

const knownSecrets = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~-]{16,}\b/gi,
  /\b(api[_-]?key|token)\s*[:=]\s*[^\s"']{12,}/gi,
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g,
];
const residualSecrets = [...knownSecrets, /\bpassword\s*[:=]\s*[^\s"']{8,}/gi];

export function redact(text: string): RedactionResult {
  let result = text;
  for (const pattern of knownSecrets) result = result.replace(pattern, '[REDACTED]');
  return { text: result, redacted: result !== text };
}

/** A deliberately broader final scan; a match means evidence must not be published. */
export function hasSecretShape(text: string): boolean {
  return residualSecrets.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}
