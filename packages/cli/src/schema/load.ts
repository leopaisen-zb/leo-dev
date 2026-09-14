import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const documentKinds = ['change', 'task', 'run', 'gate', 'evidence', 'release-evidence', 'review', 'design-review', 'release-ci', 'archive-manifest', 'approval', 'waiver', 'resolution', 'reconciliation', 'change-manifest', 'task-plan', 'spec-ref', 'architecture-assessment'] as const;
export type DocumentKind = typeof documentKinds[number];

// Both src/schema and dist/schema sit four levels below the repository root.
const schemaDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../../..', 'schemas');

export async function loadSchema(name: DocumentKind): Promise<unknown> {
  return JSON.parse(await readFile(join(schemaDirectory, `${name}.schema.json`), 'utf8'));
}

export async function loadSchemas(): Promise<Record<DocumentKind, object>> {
  const entries = await Promise.all(documentKinds.map(async (name) => [name, await loadSchema(name)] as const));
  return Object.fromEntries(entries) as Record<DocumentKind, object>;
}
