import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoSymlinkAncestors } from './build-adapters.mjs';
import { verify } from './verify-packages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginName = 'leo-dev';
const marketplaceName = 'leo-dev-release';
const fail = (message) => { throw new Error(message); };

function under(parent, candidate) {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function configuredPath(argument, fallback, label) {
  if (!argument) return fallback;
  if (!isAbsolute(argument) && (argument === '..' || argument.startsWith(`..${sep}`))) fail(`${label} path must not escape via relative traversal`);
  return resolve(root, argument);
}

async function assertPlainDirectory(path, { allowMissing = false } = {}) {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) fail(`Symlink path escape rejected: ${path}`);
    if (!stat.isDirectory()) fail(`Expected directory: ${path}`);
  } catch (error) {
    if (error.code === 'ENOENT' && allowMissing) return;
    throw error;
  }
}

async function assertNoSymlinkTree(path) {
  await assertPlainDirectory(path);
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    const stat = await lstat(child);
    if (stat.isSymbolicLink()) fail(`Symlink path escape rejected: ${child}`);
    if (stat.isDirectory()) await assertNoSymlinkTree(child);
    else if (!stat.isFile()) fail(`Marketplace entry rejected: ${child}`);
  }
}

async function isOwnedMarketplace(destination) {
  try { await lstat(destination); }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
  await assertNoSymlinkTree(destination);
  try {
    const entries = (await readdir(destination)).sort();
    if (entries.length === 0) return true;
    if (entries.length !== 2 || entries[0] !== '.agents' || entries[1] !== 'plugins') return false;
    const agents = join(destination, '.agents');
    const plugins = join(destination, 'plugins');
    await assertPlainDirectory(agents);
    await assertPlainDirectory(plugins);
    const agentEntries = (await readdir(agents)).sort();
    const pluginEntries = (await readdir(plugins)).sort();
    if (agentEntries.length !== 1 || agentEntries[0] !== 'plugins' || pluginEntries.length !== 1 || pluginEntries[0] !== pluginName) return false;
    const manifest = JSON.parse(await readFile(join(agents, 'plugins/marketplace.json'), 'utf8'));
    return manifest?.name === marketplaceName;
  } catch (error) {
    if (error instanceof SyntaxError || error.code === 'ENOENT') return false;
    throw error;
  }
}

async function replaceOwnedMarketplace(staging, destination) {
  await assertNoSymlinkAncestors(destination);
  await assertPlainDirectory(destination, { allowMissing: true });
  if (await isOwnedMarketplace(destination) === false) fail(`Refusing to overwrite a destination not owned by ${marketplaceName}`);
  await mkdir(dirname(destination), { recursive: true });
  const previous = `${destination}.previous-${process.pid}`;
  await rm(previous, { recursive: true, force: true });
  try { await rename(destination, previous); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await rename(staging, destination); await rm(previous, { recursive: true, force: true }); }
  catch (error) { try { await rename(previous, destination); } catch {} throw error; }
}

export async function createMarketplace({ dist = join(root, 'dist'), output = join(root, 'dist/marketplace') } = {}) {
  if (!under(root, dist) && !isAbsolute(dist)) fail('Dist path escape rejected');
  await verify(dist);
  const source = join(dist, 'codex', pluginName);
  await assertNoSymlinkAncestors(source);
  await assertPlainDirectory(source);
  await assertNoSymlinkAncestors(output);
  const staging = await mkdtemp(join(dirname(output), `.${marketplaceName}-staging-`));
  try {
    const pluginDestination = join(staging, 'plugins', pluginName);
    if (!under(staging, pluginDestination)) fail('Marketplace plugin destination escape rejected');
    await mkdir(dirname(pluginDestination), { recursive: true });
    await cp(source, pluginDestination, { recursive: true, dereference: false, force: true });
    const marketplace = {
      name: marketplaceName,
      interface: { displayName: 'Leo Dev Release' },
      plugins: [{ name: pluginName, source: { source: 'local', path: `./plugins/${pluginName}` }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Developer Tools' }],
    };
    await mkdir(join(staging, '.agents/plugins'), { recursive: true });
    await writeFile(join(staging, '.agents/plugins/marketplace.json'), `${JSON.stringify(marketplace, null, 2)}\n`);
    await replaceOwnedMarketplace(staging, output);
  } finally { await rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const distIndex = process.argv.indexOf('--dist');
  const outIndex = process.argv.indexOf('--out');
  if (distIndex !== -1 && !process.argv[distIndex + 1]) fail('--dist requires a path');
  if (outIndex !== -1 && !process.argv[outIndex + 1]) fail('--out requires a path');
  createMarketplace({ dist: configuredPath(distIndex === -1 ? undefined : process.argv[distIndex + 1], join(root, 'dist'), 'Dist'), output: configuredPath(outIndex === -1 ? undefined : process.argv[outIndex + 1], join(root, 'dist/marketplace'), 'Output') }).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
