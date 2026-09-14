import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapters, assertNoSymlinkAncestors, codexOnlyFiles, loadMetadata, portableFiles, validatePortableSkill } from './build-adapters.mjs';
import { runtimeManifestName, verifyRuntime } from './package-runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryUrl = 'https://github.com/leopaisen-zb/leo-dev';
const logo = 'assets/shinchan-logo.png';
const hash = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const commonKeys = ['name', 'version', 'description', 'author', 'license'];
const manifestKeys = { codex: [...commonKeys, 'repository', 'skills', 'interface'], claude: commonKeys, cursor: [...commonKeys, 'displayName', 'skills'], 'open-agent-plugin': [...commonKeys, 'skills'] };
const codexInterfaceKeys = ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'capabilities', 'defaultPrompt', 'composerIcon', 'logo'];
const fail = (message) => { throw new Error(message); };
function confined(parent, candidate) { const path = relative(parent, candidate); return path !== '' && !path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path); }
async function assertNoSymlinkPath(rootPath, relativePath = '') {
  await assertNoSymlinkAncestors(join(rootPath, relativePath));
  let current = rootPath;
  if ((await lstat(current)).isSymbolicLink()) fail(`Package symlink escape rejected: ${current}`);
  for (const segment of relativePath.split('/').filter(Boolean)) {
    current = join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) fail(`Package symlink escape rejected: ${current}`);
  }
}
async function files(directory, prefix = '') {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name); const stat = await lstat(path);
    if (stat.isSymbolicLink()) fail(`Package symlink escape rejected: ${name}`);
    if (stat.isDirectory()) result.push(...await files(path, name)); else if (stat.isFile()) result.push(name); else fail(`Package entry rejected: ${name}`);
  }
  return result.sort();
}
function outputPath(argument) { if (!argument) return join(root, 'dist'); if (!isAbsolute(argument) && (argument === '..' || argument.startsWith(`..${sep}`))) fail('Dist path escape rejected'); return resolve(root, argument); }
function same(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function validPath(value) { return typeof value === 'string' && !isAbsolute(value) && !value.includes('\\') && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/.test(value) && !/(?:^|\/)\.\.(?:\/|$)/.test(value); }
export async function verify(dist = join(root, 'dist')) {
  const metadata = await loadMetadata();
  await assertNoSymlinkPath(dist);
  const expectedHashes = new Map(); for (const file of [...portableFiles, ...codexOnlyFiles]) expectedHashes.set(file, await hash(join(root, 'skills/develop', file)));
  for (const [platform, manifestDirectory] of adapters) {
    const packageRoot = join(dist, platform, metadata.name); if (!confined(dist, packageRoot)) fail('Package path escape rejected');
    await assertNoSymlinkPath(dist, `${platform}/${metadata.name}`);
    const manifestPath = join(packageRoot, manifestDirectory, 'plugin.json'); if (!confined(packageRoot, manifestPath)) fail('Manifest path escape rejected');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!same(Object.keys(manifest).sort(), manifestKeys[platform].slice().sort())) fail(`${platform} manifest has unknown or missing fields`);
    for (const key of commonKeys) { const expected = key === 'author' ? metadata.author : metadata[key]; if (JSON.stringify(manifest[key]) !== JSON.stringify(expected)) fail(`${platform} manifest ${key} does not match package.yaml`); }
    if (platform === 'codex' && manifest.repository !== repositoryUrl) fail('codex manifest repository is invalid');
    if (platform !== 'claude' && !validPath(manifest.skills)) fail(`${platform} manifest skills path escape rejected`);
    if (platform === 'codex' && (!manifest.interface || typeof manifest.interface !== 'object' || !same(Object.keys(manifest.interface).sort(), codexInterfaceKeys.slice().sort()))) fail('codex manifest interface fields are invalid');
    if (platform === 'codex' && (![manifest.interface.composerIcon, manifest.interface.logo].every((path) => path === `./${logo}` && validPath(path)))) fail('codex manifest artwork paths are invalid');
    const expected = new Set([`${manifestDirectory ? `${manifestDirectory}/` : ''}plugin.json`, ...portableFiles.map((file) => `skills/develop/${file}`), ...(platform === 'codex' ? [...codexOnlyFiles.map((file) => `skills/develop/${file}`), logo] : [])]);
    const packageFiles = await files(packageRoot);
    const expectedPackageFiles = platform === 'codex' ? packageFiles.filter((file) => !file.startsWith('runtime/')) : packageFiles;
    if (!same(expectedPackageFiles, [...expected].sort())) fail(`${platform} package has unknown or missing files`);
    if (platform === 'codex') {
      if (await hash(join(packageRoot, logo)) !== await hash(join(root, logo))) fail('codex artwork hash mismatch');
      if (!packageFiles.includes(`runtime/${runtimeManifestName}`)) fail('codex runtime manifest is missing');
      await verifyRuntime(join(packageRoot, 'runtime'));
    }
    await validatePortableSkill(join(packageRoot, 'skills/develop'), { codexAgent: platform === 'codex' });
    for (const file of [...portableFiles, ...(platform === 'codex' ? codexOnlyFiles : [])]) if (await hash(join(packageRoot, 'skills/develop', file)) !== expectedHashes.get(file)) fail(`Portable Skill hash mismatch: ${platform}/${file}`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const index = process.argv.indexOf('--dist'); verify(outputPath(index === -1 ? undefined : process.argv[index + 1])).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }); }
