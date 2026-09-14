import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export interface TreeIdentity { hash: string; entries: string[]; policyVersion: typeof TREE_IGNORE_POLICY_VERSION; }
export const TREE_IGNORE_POLICY_VERSION = 'v1';
const ignoredSegments = new Set(['.git', 'node_modules', 'dist', 'coverage']);

function digest(value: string | Buffer): string { return createHash('sha256').update(value).digest('hex'); }
function ignored(relativePath: string): boolean { return relativePath === '.leo-dev/runtime' || relativePath.startsWith('.leo-dev/runtime/') || relativePath.split('/').some((segment) => ignoredSegments.has(segment)); }

export async function canonicalTreeHash(root: string): Promise<TreeIdentity> {
  const resolvedRoot = await realpath(root);
  const entries: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => Buffer.from(a.name).compare(Buffer.from(b.name)))) {
      const full = join(directory, entry.name);
      const rel = relative(resolvedRoot, full).split(sep).join('/');
      if (ignored(rel)) continue;
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) {
        const target = await realpath(full);
        if (!target.startsWith(`${resolvedRoot}${sep}`)) throw new Error(`Symlink escape: ${rel}`);
        throw new Error(`Symlink is not part of canonical tree: ${rel}`);
      }
      if (stat.isDirectory()) {
        if (rel === '.leo-dev/runtime' || rel.startsWith('.leo-dev/runtime/')) continue;
        await visit(full);
      } else if (stat.isFile()) {
        const mode = (stat.mode & 0o777).toString(8).padStart(3, '0');
        entries.push(`${rel}\0${mode}\0${digest(await readFile(full))}`);
      }
    }
  }
  await visit(resolvedRoot);
  return { hash: digest(`${TREE_IGNORE_POLICY_VERSION}\n${entries.join('\n')}`), entries, policyVersion: TREE_IGNORE_POLICY_VERSION };
}
