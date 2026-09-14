import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliDirectory = join(root, 'packages', 'cli');
const trustedPathAnchors = [root, tmpdir(), '/tmp', '/private/tmp'].map((path) => resolve(path)).sort((left, right) => right.length - left.length);
export const runtimeManifestName = 'runtime-manifest.json';
export const runtimeCliEntry = 'packages/cli/dist/index.js';
const fail = (message) => { throw new Error(message); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function confined(parent, candidate) {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function assertNoSymlinkAncestors(path) {
  const absolute = resolve(path);
  const anchor = trustedPathAnchors.find((candidate) => absolute === candidate || absolute.startsWith(`${candidate}${sep}`));
  if (!anchor) fail(`Runtime path is outside canonical trusted roots: ${absolute}`);
  let current = anchor;
  for (const part of relative(anchor, absolute).split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) fail(`Runtime symlink escape rejected: ${current}`);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
  }
}

async function regularFiles(directory, prefix = '', { excludeNodeModules = false } = {}) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (excludeNodeModules && entry.name === 'node_modules') continue;
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) fail(`Runtime source symlink rejected: ${path}`);
    if (stat.isDirectory()) files.push(...await regularFiles(path, name, { excludeNodeModules }));
    else if (stat.isFile()) files.push(name);
    else fail(`Runtime source entry rejected: ${path}`);
  }
  return files;
}

async function regularFile(path) {
  await assertNoSymlinkAncestors(path);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`Runtime prerequisite is not a regular file: ${path}`);
}

async function regularDirectory(path, options) {
  await assertNoSymlinkAncestors(path);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`Runtime prerequisite is not a directory: ${path}`);
  return regularFiles(path, '', options);
}

async function copyFile(source, destination) {
  await regularFile(source);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { dereference: false, force: true });
}

async function copyDirectory(source, destination, options) {
  const files = await regularDirectory(source, options);
  for (const file of files) await copyFile(join(source, file), join(destination, file));
}

async function defaultDependencyResolver(name, requester) {
  let current = requester;
  while (confined(root, current)) {
    const candidate = join(current, 'node_modules', name);
    try {
      await regularDirectory(candidate, { excludeNodeModules: true });
      const manifestPath = join(candidate, 'package.json');
      await regularFile(manifestPath);
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (!manifest || typeof manifest !== 'object' || manifest.name !== name) fail(`Runtime dependency resolution is conflicting: ${name}`);
      return candidate;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  fail(`Runtime dependency cannot be resolved: ${name}`);
}

async function sourceInventory() {
  const roots = [
    ['package-lock.json', 'file'],
    ['packages/cli/package.json', 'file'],
    ['packages/cli/src', 'directory'],
    ['schemas', 'directory'],
    ['core/workflows/risk-rules.yaml', 'file'],
  ];
  const files = [];
  for (const [name, kind] of roots) {
    const path = join(root, name);
    if (kind === 'file') {
      await regularFile(path);
      files.push(name);
    } else {
      for (const file of await regularDirectory(path)) files.push(`${name}/${file}`);
    }
  }
  return inventoryFor(root, files);
}

async function inventoryFor(base, files) {
  const inventory = [];
  for (const file of [...files].sort()) {
    const path = join(base, file);
    await regularFile(path);
    inventory.push({ path: file.split(sep).join('/'), sha256: sha256(await readFile(path)) });
  }
  return inventory;
}

function digestInventory(inventory) {
  return sha256(inventory.map((entry) => `${entry.path}\0${entry.sha256}\n`).join(''));
}

function validRuntimePath(value) {
  return typeof value === 'string' && value.length > 0 && !isAbsolute(value) && !value.includes('\\') && !/(?:^|\/)\.\.(?:\/|$)/.test(value);
}

function sameInventory(left, right) {
  return left.length === right.length && left.every((entry, index) => entry.path === right[index].path && entry.sha256 === right[index].sha256);
}

async function dependencyClosure(destination, dependencyResolver = defaultDependencyResolver) {
  const cli = JSON.parse(await readFile(join(cliDirectory, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  if (!lock || typeof lock !== 'object' || !lock.packages || typeof lock.packages !== 'object') fail('Runtime package-lock is invalid');
  const resolved = new Map();
  const rootPackages = new Map();
  const visiting = new Set();
  async function visit(name, requester, runtimeRequester, required, direct = false) {
    if (visiting.has(`${requester}\0${runtimeRequester}\0${name}`)) return;
    visiting.add(`${requester}\0${runtimeRequester}\0${name}`);
    let directory;
    try { directory = await dependencyResolver(name, requester); }
    catch (error) {
      if (!required) return;
      fail(`Runtime dependency cannot be resolved: ${name} (${error instanceof Error ? error.message : String(error)})`);
    }
    if (typeof directory !== 'string' || !isAbsolute(directory) || !confined(root, directory)) fail(`Runtime dependency resolution is unsafe: ${name}`);
    const canonical = resolve(directory);
    await regularDirectory(canonical, { excludeNodeModules: true });
    const packageJson = join(canonical, 'package.json');
    await regularFile(packageJson);
    const manifest = JSON.parse(await readFile(packageJson, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || manifest.name !== name) fail(`Runtime dependency resolution is conflicting: ${name}`);
    const lockPath = relative(root, canonical).split(sep).join('/');
    const lockEntry = lock.packages[lockPath];
    if (!lockPath || !lockEntry || typeof lockEntry !== 'object' || lockEntry.version !== manifest.version) fail(`Runtime dependency is not locked consistently: ${name}`);
    const rootPackage = rootPackages.get(name);
    let runtimeDirectory;
    if (direct || !rootPackage || rootPackage === canonical) {
      runtimeDirectory = join(destination, 'node_modules', name);
      if (!rootPackage) rootPackages.set(name, canonical);
    } else {
      runtimeDirectory = join(runtimeRequester, 'node_modules', name);
    }
    const previous = resolved.get(runtimeDirectory);
    if (previous && previous !== canonical) fail(`Runtime dependency resolution is conflicting: ${name}`);
    if (previous) return;
    resolved.set(runtimeDirectory, canonical);
    const dependencies = { ...(manifest.dependencies ?? {}), ...(manifest.optionalDependencies ?? {}) };
    for (const dependency of Object.keys(dependencies).sort()) await visit(dependency, canonical, runtimeDirectory, !(dependency in (manifest.optionalDependencies ?? {})));
    for (const dependency of Object.keys(manifest.peerDependencies ?? {}).sort()) {
      const optional = manifest.peerDependenciesMeta?.[dependency]?.optional === true;
      await visit(dependency, canonical, runtimeDirectory, !optional);
    }
  }
  for (const dependency of Object.keys(cli.dependencies ?? {}).sort()) await visit(dependency, cliDirectory, join(destination, 'packages/cli'), true, true);
  return [...resolved.entries()].sort(([left], [right]) => left.localeCompare(right));
}

async function trustedRuntimePlan(destination, dependencyResolver = defaultDependencyResolver) {
  const plan = [
    { source: join(cliDirectory, 'dist'), destination: 'packages/cli/dist', kind: 'directory' },
    { source: join(cliDirectory, 'package.json'), destination: 'packages/cli/package.json', kind: 'file' },
    { source: join(root, 'schemas'), destination: 'schemas', kind: 'directory' },
    { source: join(root, 'core/workflows/risk-rules.yaml'), destination: 'core/workflows/risk-rules.yaml', kind: 'file' },
  ];
  for (const [target, source] of await dependencyClosure(destination, dependencyResolver)) {
    if (!confined(destination, target)) fail(`Runtime dependency target is unsafe: ${target}`);
    const relativeTarget = relative(destination, target).split(sep).join('/');
    if (!validRuntimePath(relativeTarget)) fail(`Runtime dependency target is invalid: ${target}`);
    plan.push({ source, destination: relativeTarget, kind: 'directory' });
  }
  return plan;
}

async function trustedRuntimeInventory(destination, dependencyResolver = defaultDependencyResolver) {
  const inventory = [];
  const seen = new Set();
  const add = async (source, target) => {
    if (!validRuntimePath(target) || seen.has(target)) fail(`Runtime trusted inventory is invalid: ${target}`);
    seen.add(target);
    await regularFile(source);
    inventory.push({ path: target, sha256: sha256(await readFile(source)) });
  };
  for (const entry of await trustedRuntimePlan(destination, dependencyResolver)) {
    if (entry.kind === 'file') await add(entry.source, entry.destination);
    else for (const file of await regularDirectory(entry.source, { excludeNodeModules: true })) await add(join(entry.source, file), `${entry.destination}/${file}`);
  }
  return inventory.sort((left, right) => (left.path > right.path) - (left.path < right.path));
}

export async function buildRuntime({ destination, dependencyResolver } = {}) {
  if (typeof destination !== 'string' || !isAbsolute(destination)) fail('Runtime destination must be an absolute path');
  await assertNoSymlinkAncestors(destination);
  await mkdir(destination, { recursive: true });
  await assertNoSymlinkAncestors(destination);
  for (const entry of await trustedRuntimePlan(destination, dependencyResolver)) {
    const target = join(destination, entry.destination);
    if (entry.kind === 'file') await copyFile(entry.source, target);
    else await copyDirectory(entry.source, target, { excludeNodeModules: true });
  }
  const files = await regularFiles(destination);
  if (files.includes(runtimeManifestName)) fail(`Runtime destination contains unexpected ${runtimeManifestName}`);
  const inventory = await inventoryFor(destination, files);
  const manifest = {
    schemaVersion: 1,
    nodePrerequisite: '>=20',
    cliEntry: runtimeCliEntry,
    sourceDigest: digestInventory(await sourceInventory()),
    packageDigest: digestInventory(inventory),
    files: inventory,
  };
  await writeFile(join(destination, runtimeManifestName), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function verifyRuntime(destination) {
  if (typeof destination !== 'string' || !isAbsolute(destination)) fail('Runtime destination must be an absolute path');
  await regularDirectory(destination);
  const manifestPath = join(destination, runtimeManifestName);
  await regularFile(manifestPath);
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch { fail('Runtime manifest is not valid JSON'); }
  const keys = ['schemaVersion', 'nodePrerequisite', 'cliEntry', 'sourceDigest', 'packageDigest', 'files'];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || Object.keys(manifest).sort().join(',') !== keys.slice().sort().join(',')) fail('Runtime manifest fields are invalid');
  if (manifest.schemaVersion !== 1 || manifest.nodePrerequisite !== '>=20' || manifest.cliEntry !== runtimeCliEntry || !/^[a-f0-9]{64}$/.test(manifest.sourceDigest) || !/^[a-f0-9]{64}$/.test(manifest.packageDigest) || !Array.isArray(manifest.files)) fail('Runtime manifest values are invalid');
  if (manifest.files.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).sort().join(',') !== 'path,sha256' || !validRuntimePath(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256))) fail('Runtime manifest inventory is invalid');
  const actualFiles = (await regularFiles(destination)).filter((file) => file !== runtimeManifestName);
  const actualInventory = await inventoryFor(destination, actualFiles);
  const expectedInventory = await trustedRuntimeInventory(destination);
  if (!sameInventory(manifest.files, expectedInventory) || !sameInventory(actualInventory, expectedInventory) || manifest.packageDigest !== digestInventory(expectedInventory)) fail('Runtime trusted inventory mismatch');
  if (manifest.sourceDigest !== digestInventory(await sourceInventory())) fail('Runtime source digest mismatch');
  if (!actualFiles.includes(runtimeCliEntry)) fail('Runtime CLI entry is missing');
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--destination');
  const destination = index === -1 ? undefined : process.argv[index + 1];
  if (index !== -1 && !destination) fail('--destination requires an absolute path');
  buildRuntime({ destination }).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
