import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { canonicalTreeHash } from './tree-hash.js';

const exec = promisify(execFile);
export interface Baseline { treeHash: string; git: { available: boolean; head?: string; reason?: string }; staged: string[]; dirty: string[]; untracked: string[]; renamed: Array<{ from: string; to: string }>; }

export async function captureBaseline(root: string): Promise<Baseline> {
  const tree = await canonicalTreeHash(root);
  let status: string | Buffer;
  try { ({ stdout: status } = await exec('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: 'buffer' })); }
  catch { return { treeHash: tree.hash, git: { available: false, reason: 'status-unavailable' }, staged: [], dirty: [], untracked: [], renamed: [] }; }
  let head: string | undefined;
  try { ({ stdout: head } = await exec('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root })); } catch { head = undefined; }
  const staged: string[] = [], dirty: string[] = [], untracked: string[] = [], renamed: Array<{ from: string; to: string }> = [];
  const records = (Buffer.isBuffer(status) ? status.toString('utf8') : status).split('\0');
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]; if (!record) continue;
    const xy = record.slice(0, 2); const path = record.slice(3);
    if (xy === '??') { untracked.push(path); continue; }
    if (xy[0] !== ' ') staged.push(path);
    if (xy[1] !== ' ') dirty.push(path);
    if (xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C') { const from = records[++index] ?? ''; renamed.push({ from, to: path }); }
  }
  return { treeHash: tree.hash, git: { available: true, ...(head ? { head: head.trim() } : {}) }, staged: staged.sort(), dirty: dirty.sort(), untracked: untracked.sort(), renamed };
}
