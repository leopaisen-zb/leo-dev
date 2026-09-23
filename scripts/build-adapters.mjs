import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildRuntime } from './package-runtime.mjs';
import { upstreamPortableFiles, validateUpstreamResources } from './upstream-resources.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryUrl = 'https://github.com/leopaisen-zb/leo-dev';
const logo = 'assets/shinchan-logo.png';
const trustedPathAnchors = [root, tmpdir(), '/tmp', '/private/tmp'].map((path) => resolve(path)).sort((left, right) => right.length - left.length);
export const portableFiles = ['SKILL.md', 'references/acceptance.md', 'references/autonomous-execution.md', 'references/codex-team.md', 'references/components.md', 'references/delivery.md', 'references/gates.md', 'references/host-subagents.md', 'references/lifecycle.md', 'references/review-protocol.md', 'references/upstream-methods.md', 'references/upstream/bmad-team-LICENSE.txt', ...upstreamPortableFiles];
export const codexOnlyFiles = ['agents/openai.yaml'];
export const releaseFiles = ['LICENSE', 'NOTICE'];
export const codexReleaseFiles = ['assets/README.md'];
export const adapters = [['codex', '.codex-plugin'], ['claude', '.claude-plugin'], ['cursor', '.cursor-plugin'], ['open-agent-plugin', '']];
const fail = (message) => { throw new Error(message); };

function under(parent, candidate) {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}
async function assertNoSymlink(path, { allowMissing = false } = {}) {
  try { if ((await lstat(path)).isSymbolicLink()) fail(`Symlink path escape rejected: ${path}`); }
  catch (error) { if (error.code === 'ENOENT' && allowMissing) return; throw error; }
}
export async function assertNoSymlinkAncestors(path) {
  const absolute = resolve(path);
  const anchor = trustedPathAnchors.find((candidate) => absolute === candidate || absolute.startsWith(`${candidate}${sep}`));
  if (!anchor) fail(`Path is outside canonical trusted roots: ${absolute}`);
  const parts = relative(anchor, absolute).split(sep).filter(Boolean);
  let current = anchor;
  for (const part of parts) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) fail(`Symlink ancestor escape rejected: ${current}`);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}
async function inventory(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) fail(`Portable source symlink escape rejected: ${name}`);
    if (stat.isDirectory()) files.push(...await inventory(path, name));
    else if (stat.isFile()) files.push(name);
    else fail(`Portable source entry rejected: ${name}`);
  }
  return files;
}
export async function validatePortableSkill(source, { codexAgent = false } = {}) {
  await assertNoSymlinkAncestors(source);
  await assertNoSymlink(source);
  const expected = new Set([...portableFiles, ...(codexAgent ? codexOnlyFiles : [])]);
  const files = await inventory(resolve(source));
  for (const file of files) if (!expected.has(file)) fail(`Unknown portable source file: ${file}`);
  for (const file of expected) if (!files.includes(file)) fail(`Missing portable source file: ${file}`);
  const skill = await readFile(join(source, 'SKILL.md'), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skill);
  if (!match) fail('Portable SKILL.md must have YAML frontmatter');
  const frontmatter = parse(match[1]);
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter) || Object.keys(frontmatter).some((key) => !['name', 'description'].includes(key)) || frontmatter.name !== 'develop' || typeof frontmatter.description !== 'string' || !frontmatter.description.trim()) fail('Portable SKILL.md frontmatter is nonportable or invalid');
  await validateUpstreamResources(source);
  return files.sort();
}
export async function validateReleaseFiles(source = root) {
  await assertNoSymlinkAncestors(source);
  await assertNoSymlink(source);
  for (const file of releaseFiles) {
    const path = join(source, file);
    await assertNoSymlinkAncestors(path);
    await assertNoSymlink(path);
    let stat;
    try { stat = await lstat(path); } catch (error) { if (error.code === 'ENOENT') fail(`Missing release ${file}`); throw error; }
    if (!stat.isFile()) fail(`Release ${file} must be a regular file`);
  }
  const assetNotice = join(source, codexReleaseFiles[0]);
  await assertNoSymlinkAncestors(assetNotice);
  await assertNoSymlink(assetNotice);
  if (!(await lstat(assetNotice)).isFile()) fail('Codex asset notice must be a regular file');
}
export async function loadMetadata(path = join(root, 'package.yaml')) {
  const data = parse(await readFile(path, 'utf8'));
  const expected = ['name', 'version', 'private', 'license', 'description', 'author'];
  if (!data || typeof data !== 'object' || Array.isArray(data) || expected.some((key) => !(key in data)) || Object.keys(data).some((key) => !expected.includes(key))) fail('package.yaml metadata is invalid');
  if (data.name !== 'leo-dev' || typeof data.version !== 'string' || data.private !== false || data.license !== 'MIT' || typeof data.description !== 'string' || !data.author || typeof data.author.name !== 'string' || Object.keys(data.author).length !== 1) fail('package.yaml metadata is invalid');
  return data;
}
function manifestFor(platform, metadata) {
  const common = { name: metadata.name, version: metadata.version, description: metadata.description, author: { name: metadata.author.name }, license: metadata.license };
  if (platform === 'codex') return { ...common, repository: repositoryUrl, skills: './skills/', interface: { displayName: 'Leo Dev', shortDescription: 'Evidence-aware development workflow for coding agents', longDescription: 'A portable development workflow that preserves approved specifications and reports verified delivery evidence.', developerName: metadata.author.name, category: 'Developer Tools', capabilities: ['Interactive', 'Read', 'Write'], defaultPrompt: ['Use $leo-dev:develop to continue approved development work with verification evidence.'], composerIcon: `./${logo}`, logo: `./${logo}` } };
  if (platform === 'cursor') return { ...common, displayName: 'Leo Dev', skills: './skills/' };
  if (platform === 'open-agent-plugin') return { ...common, skills: './skills/' };
  return common;
}
function parseOutput(argument) {
  if (!argument) return join(root, 'dist');
  if (!isAbsolute(argument) && (argument === '..' || argument.startsWith(`..${sep}`))) fail('Output path must not escape via relative traversal');
  return resolve(root, argument);
}
async function copyFiles(source, destination, files) {
  for (const file of files) { const to = join(destination, file); await mkdir(dirname(to), { recursive: true }); await cp(join(source, file), to, { dereference: false, force: true }); }
}
async function replaceOwnedPackage(staged, target) {
  await assertNoSymlink(dirname(target), { allowMissing: true });
  await mkdir(dirname(target), { recursive: true });
  await assertNoSymlink(dirname(target));
  await assertNoSymlink(target, { allowMissing: true });
  const previous = `${target}.previous-${process.pid}`;
  await rm(previous, { recursive: true, force: true });
  try { await rename(target, previous); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await rename(staged, target); await rm(previous, { recursive: true, force: true }); }
  catch (error) { try { await rename(previous, target); } catch {} throw error; }
}
export async function build({ output = join(root, 'dist') } = {}) {
  const metadata = await loadMetadata();
  const source = join(root, 'skills/develop');
  await validatePortableSkill(source, { codexAgent: true });
  await validateReleaseFiles();
  await assertNoSymlinkAncestors(output);
  await assertNoSymlink(output, { allowMissing: true });
  await mkdir(output, { recursive: true });
  await assertNoSymlinkAncestors(output);
  await assertNoSymlink(output);
  const staging = await mkdtemp(join(dirname(output), `.${metadata.name}-adapter-staging-`));
  try {
    for (const [platform, manifestDirectory] of adapters) {
      const destination = join(staging, platform, metadata.name);
      if (!under(staging, destination)) fail(`Adapter destination escape rejected: ${platform}`);
      await copyFiles(source, join(destination, 'skills/develop'), portableFiles);
      if (platform === 'codex') await copyFiles(source, join(destination, 'skills/develop'), codexOnlyFiles);
      await copyFiles(root, destination, releaseFiles);
      await mkdir(join(destination, manifestDirectory), { recursive: true });
      await writeFile(join(destination, manifestDirectory, 'plugin.json'), `${JSON.stringify(manifestFor(platform, metadata), null, 2)}\n`);
      if (platform === 'codex') {
        await assertNoSymlink(join(root, logo));
        await mkdir(dirname(join(destination, logo)), { recursive: true });
        await cp(join(root, logo), join(destination, logo), { dereference: false, force: true });
        await copyFiles(root, destination, codexReleaseFiles);
      }
      if (platform === 'codex' || platform === 'open-agent-plugin') await buildRuntime({ destination: join(destination, 'runtime') });
    }
    for (const [platform] of adapters) await replaceOwnedPackage(join(staging, platform, metadata.name), join(output, platform, metadata.name));
  } finally { await rm(staging, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--out');
  if (index !== -1 && !process.argv[index + 1]) fail('--out requires a path');
  build({ output: parseOutput(index === -1 ? undefined : process.argv[index + 1]) }).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
