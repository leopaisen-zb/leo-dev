import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import { validateDocument } from '../schema/validate.js';

export interface GateDefinition {
  id: string;
  argv: [string, ...string[]];
  cwd: string;
  timeoutSeconds: number;
  required: boolean;
  replaySafety: 'pure' | 'idempotent' | 'manual-reconcile';
  effectClass: 'local-verification' | 'network-read' | 'external-write' | 'destructive' | 'release';
  network: 'deny' | 'approval-required';
  environmentAllowlist: string[];
  declaredWritePaths: string[];
}

export class GateRegistryError extends Error {
  constructor(readonly code: 'UNKNOWN_GATE' | 'GATE_INVALID', message: string) { super(message); }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function gateDefinitionFingerprint(gate: GateDefinition): string {
  return createHash('sha256').update(canonical(gate)).digest('hex');
}
export function fingerprint(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }

export class GateRegistry {
  private readonly definitions = new Map<string, GateDefinition>();

  constructor(definitions: readonly unknown[]) {
    for (const definition of definitions) {
      if (!definition || typeof definition !== 'object' || !Array.isArray((definition as { argv?: unknown }).argv)) throw new GateRegistryError('GATE_INVALID', 'Gate argv must be a reviewed argv array');
      const validation = validateDocument('gate', definition);
      if (!validation.ok) throw new GateRegistryError('GATE_INVALID', validation.details.join('; '));
      const gate = definition as GateDefinition;
      if (this.definitions.has(gate.id)) throw new GateRegistryError('GATE_INVALID', `Duplicate gate id: ${gate.id}`);
      this.definitions.set(gate.id, Object.freeze({ ...gate, argv: Object.freeze([...gate.argv]) as unknown as GateDefinition['argv'], environmentAllowlist: Object.freeze([...gate.environmentAllowlist]) as unknown as string[], declaredWritePaths: Object.freeze([...gate.declaredWritePaths]) as unknown as string[] }));
    }
  }

  get(id: string): GateDefinition {
    const gate = this.definitions.get(id);
    if (!gate) throw new GateRegistryError('UNKNOWN_GATE', `Unknown gate id: ${id}`);
    return Object.freeze({ ...gate, argv: Object.freeze([...gate.argv]) as unknown as GateDefinition['argv'], environmentAllowlist: Object.freeze([...gate.environmentAllowlist]) as unknown as string[], declaredWritePaths: Object.freeze([...gate.declaredWritePaths]) as unknown as string[] });
  }

  static async fromYaml(path: string): Promise<GateRegistry> {
    const document = YAML.parse(await readFile(path, 'utf8')) as unknown;
    return new GateRegistry(Array.isArray(document) ? document : (document as { gates?: unknown[] }).gates ?? []);
  }
}
