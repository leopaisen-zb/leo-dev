import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, readlink, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export class GatePathError extends Error {
  readonly code = 'PATH_ESCAPE';
}

export interface WriteSurface { hash: string; entries: string[]; }

const isInside = (root: string, target: string) => target === root || target.startsWith(`${root}${sep}`);

async function nearestExistingAncestor(path: string): Promise<string> {
  let candidate = path;
  for (;;) {
    try {
      await lstat(candidate);
      return candidate;
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== 'ENOENT') throw error;
      const parent = resolve(candidate, '..');
      if (parent === candidate) throw error;
      candidate = parent;
    }
  }
}

/** Resolve a repository-relative path after checking all real filesystem ancestors. */
export async function repositoryPath(root: string, path: string, requireExisting = false): Promise<string> {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path)) throw new GatePathError(`Repository-relative path required: ${String(path)}`);
  const canonicalRoot = await realpath(root);
  const lexicalTarget = resolve(canonicalRoot, path);
  if (!isInside(canonicalRoot, lexicalTarget)) throw new GatePathError(`Path escapes repository: ${path}`);
  const ancestor = await nearestExistingAncestor(lexicalTarget);
  const canonicalAncestor = await realpath(ancestor);
  if (!isInside(canonicalRoot, canonicalAncestor)) throw new GatePathError(`Path uses an escaping symlink: ${path}`);
  if (requireExisting) {
    try {
      const canonicalTarget = await realpath(lexicalTarget);
      if (!isInside(canonicalRoot, canonicalTarget)) throw new GatePathError(`Path uses an escaping symlink: ${path}`);
      return canonicalTarget;
    } catch (error: unknown) {
      if (error instanceof GatePathError) throw error;
      throw new GatePathError(`Path does not exist: ${path}`);
    }
  }
  return lexicalTarget;
}

export async function repositoryRelativePath(root: string, absolutePath: string): Promise<string> {
  const canonicalRoot = await realpath(root);
  const target = await repositoryPath(canonicalRoot, relative(canonicalRoot, absolutePath));
  const result = relative(canonicalRoot, target).split(sep).join('/');
  if (result === '' || result.startsWith('../')) throw new GatePathError(`Path escapes repository: ${absolutePath}`);
  return result;
}

/** Normalizes equivalent portable repository spellings before policy comparison. */
export function normalizeRepositoryPath(path: string): string {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path)) throw new GatePathError(`Repository-relative path required: ${String(path)}`);
  const parts: string[] = [];
  for (const part of path.replaceAll('\\', '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') throw new GatePathError(`Path escapes repository: ${path}`);
    parts.push(part);
  }
  return parts.length === 0 ? '.' : parts.join('/');
}

/**
 * A write-enforcement surface intentionally includes ignored tree-hash paths,
 * empty directories, and symlinks, including the pre-reserved evidence
 * directory. Callers may omit exact controller-owned entries; an omitted
 * directory is still traversed so the option cannot hide its descendants.
 */
export async function writeSurface(root: string, options: { excludePaths?: readonly string[] } = {}): Promise<WriteSurface> {
  const canonicalRoot = await realpath(root);
  const excluded = new Set((options.excludePaths ?? []).map(normalizeRepositoryPath));
  const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  const scan = async (): Promise<WriteSurface> => {
    const entries: string[] = [];
    async function visit(directory: string): Promise<void> {
      for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => Buffer.from(a.name).compare(Buffer.from(b.name)))) {
        const full = resolve(directory, entry.name);
        const rel = relative(canonicalRoot, full).split(sep).join('/');
        const stat = await lstat(full);
        const isExcluded = excluded.has(rel);
        const mode = (stat.mode & 0o777).toString(8).padStart(3, '0');
        if (stat.isSymbolicLink()) { if (!isExcluded) entries.push(`l\0${rel}\0${mode}\0${await readlink(full)}`); }
        else if (stat.isDirectory()) { if (!isExcluded) entries.push(`d\0${rel}\0${mode}`); await visit(full); }
        else if (stat.isFile()) { if (!isExcluded) entries.push(`f\0${rel}\0${mode}\0${digest(await readFile(full))}`); }
        else if (!isExcluded) entries.push(`o\0${rel}\0${mode}`);
      }
    }
    await visit(canonicalRoot);
    return { entries, hash: digest(entries.join('\n')) };
  };
  // Controller lock directories and other bounded runtime entries can vanish
  // after readdir but before lstat/readFile.  A partial scan is never accepted:
  // restart the whole snapshot a bounded number of times, then fail closed.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await scan(); }
    catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || attempt === 2) throw error;
    }
  }
  throw new Error('Unreachable write-surface retry state');
}
