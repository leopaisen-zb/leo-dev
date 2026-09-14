import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export const provenancePath = 'references/upstream/provenance.json';
const packagedPathFor = (repository, sourcePath) => `references/upstream/${repository}/${sourcePath.replace(/\/SKILL\.md$/, '/RESOURCE.md')}`;
export const upstreamResources = Object.freeze([
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/agents/codex-skills/skills/kiro-spec-requirements/SKILL.md', '087a26e66d535fccd15592286605016001bf2f9e94bcaed665997e3d91e0be3f', 'none', '087a26e66d535fccd15592286605016001bf2f9e94bcaed665997e3d91e0be3f'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/agents/codex-skills/skills/kiro-spec-design/SKILL.md', '6c11cde14877a4825d6fc55329c30241d7817ebe82f666313e3e327ff45222ac', 'none', '6c11cde14877a4825d6fc55329c30241d7817ebe82f666313e3e327ff45222ac'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/agents/codex-skills/skills/kiro-spec-tasks/SKILL.md', '8654394d5f34876b9bf324bf1c710e18193548c4368019edc0205613e4ef3e8b', 'none', '8654394d5f34876b9bf324bf1c710e18193548c4368019edc0205613e4ef3e8b'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/rules/ears-format.md', 'beacb49075f3e149e978e6793f437f3241475807fa0eb065b81aa97b96fc75c0', 'none', 'beacb49075f3e149e978e6793f437f3241475807fa0eb065b81aa97b96fc75c0'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/rules/requirements-review-gate.md', '80d3820e2c80af43fb114c54434940f4ded2cde0a5024fab247e6fa0b18c2f37', 'none', '80d3820e2c80af43fb114c54434940f4ded2cde0a5024fab247e6fa0b18c2f37'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/rules/design-principles.md', '5033327db3fc6b93d2381a1795b27e4bb6e9f73561e84128a83dca54671d1bfe', 'none', '5033327db3fc6b93d2381a1795b27e4bb6e9f73561e84128a83dca54671d1bfe'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/rules/design-discovery-light.md', 'cc96d009e42e2d4a030e24b72ba92025a520d35354684fa93a9d68e9a3e3947e', 'append-final-newline-only', 'c24547b4daad847850f19991496159216cb7e2b113294377abab3aa9785ef3ab'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/rules/design-synthesis.md', 'e2b38d4a652973344ff5b69fab56798c8eebaecdf86df16024305e666ba0ba83', 'none', 'e2b38d4a652973344ff5b69fab56798c8eebaecdf86df16024305e666ba0ba83'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/rules/design-review-gate.md', '05f885b59a064cb236f511d159ea3452a06885ca97334283cf21e758d6a8d4dd', 'none', '05f885b59a064cb236f511d159ea3452a06885ca97334283cf21e758d6a8d4dd'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/rules/tasks-generation.md', 'd9be9998dcb6dc9ef7cbc348fd2f64350eb45a67aa16226a59510aa4fdcb8aaa', 'none', 'd9be9998dcb6dc9ef7cbc348fd2f64350eb45a67aa16226a59510aa4fdcb8aaa'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/templates/specs/requirements.md', '876aed0185db39e9fd160331a408b84e856d1f0ad1143036615b663742ddbdca', 'none', '876aed0185db39e9fd160331a408b84e856d1f0ad1143036615b663742ddbdca'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/templates/specs/design.md', '0b9e3cbd75e4543880aa3b58e4c194670543b39287f5cb5c9d80d9a5f9ff99ff', 'none', '0b9e3cbd75e4543880aa3b58e4c194670543b39287f5cb5c9d80d9a5f9ff99ff'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/templates/specs/research.md', 'a77becba2f120a2d020004a08ad331a602fb0cb30c5fa3c7cc9fa8acc8da0fde', 'none', 'a77becba2f120a2d020004a08ad331a602fb0cb30c5fa3c7cc9fa8acc8da0fde'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'tools/cc-sdd/templates/shared/settings/templates/specs/tasks.md', '6ed02fcc9b90988c594c4b4698c178ef8a1124371b80170a44faab9430996214', 'none', '6ed02fcc9b90988c594c4b4698c178ef8a1124371b80170a44faab9430996214'],
  ['cc-sdd', '29aee950f4addc36f9aeecb9881c46540e71ecc9', 'LICENSE', 'b63b38d2dd9673c2321c1d7cab50d2b970b264e7a3aa23ecf2dc26baad21ab07', 'none', 'b63b38d2dd9673c2321c1d7cab50d2b970b264e7a3aa23ecf2dc26baad21ab07'],
  ['spec-kit', '4a7341a93d944d6efe153b71da4a1adb9c2b578c', 'templates/commands/analyze.md', 'ef9850532cc69f972025e5e742d0dd833ba1d28c31e6798d5edd3c5af73b2e7c', 'none', 'ef9850532cc69f972025e5e742d0dd833ba1d28c31e6798d5edd3c5af73b2e7c'],
  ['spec-kit', '4a7341a93d944d6efe153b71da4a1adb9c2b578c', 'LICENSE', '2510b446bc1f0cf9702453075d20cd88631e20e5642658edb7325d9c1eb534f7', 'none', '2510b446bc1f0cf9702453075d20cd88631e20e5642658edb7325d9c1eb534f7'],
].map(([repository, revision, sourcePath, sourceSha256, transformation, packagedSha256]) => Object.freeze({
  repository, revision, sourcePath, sourceSha256, transformation,
  packagedPath: packagedPathFor(repository, sourcePath),
  packagedSha256,
})));

export const upstreamPortableFiles = Object.freeze([provenancePath, ...upstreamResources.map(({ packagedPath }) => packagedPath)]);
const scope = 'production-only pinned upstream resources for optional host references; trial material excluded';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => { throw new Error(message); };
const validRelativePath = (value) => typeof value === 'string' && value.length > 0 && !isAbsolute(value) && !value.includes('\\') && !/(?:^|\/)\.\.(?:\/|$)/.test(value);
const manifestKeys = ['schemaVersion', 'scope', 'sources'];
const resourceKeys = ['repository', 'revision', 'sourcePath', 'sourceSha256', 'transformation', 'packagedPath', 'packagedSha256'];
const upstreamByPackagedPath = new Map(upstreamResources.map((resource) => [resource.packagedPath, resource]));
const exactFieldSet = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const samePinnedResource = (candidate, expected) => resourceKeys.every((key) => candidate[key] === expected[key]);

function confined(parent, candidate) {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function regularFile(path, label) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) fail(`Upstream resource symlink rejected: ${label}`);
  if (!stat.isFile()) fail(`Upstream resource is not a regular file: ${label}`);
}

export function productionProvenance() {
  return { schemaVersion: 1, scope, sources: upstreamResources };
}

export async function validateUpstreamResources(skillDirectory) {
  const root = resolve(skillDirectory);
  const manifestPath = join(root, provenancePath);
  if (!confined(root, manifestPath)) fail('Upstream provenance path escape rejected');
  await regularFile(manifestPath, provenancePath);
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch { fail('Upstream provenance JSON is invalid'); }
  if (!exactFieldSet(manifest, manifestKeys) || manifest.schemaVersion !== 1 || manifest.scope !== scope || !Array.isArray(manifest.sources) || manifest.sources.length !== upstreamResources.length) fail('Upstream provenance manifest does not match pinned inventory');
  const manifestPaths = new Set();
  for (const candidate of manifest.sources) {
    if (!exactFieldSet(candidate, resourceKeys)) fail('Upstream provenance resource fields are invalid');
    if (!validRelativePath(candidate.sourcePath) || !validRelativePath(candidate.packagedPath) || candidate.packagedPath !== packagedPathFor(candidate.repository, candidate.sourcePath)) fail('Upstream provenance has malformed or escaping paths');
    if (manifestPaths.has(candidate.packagedPath)) fail('Upstream provenance has duplicate packaged paths');
    manifestPaths.add(candidate.packagedPath);
    const expected = upstreamByPackagedPath.get(candidate.packagedPath);
    if (!expected) fail(`Upstream provenance has unknown packaged path: ${candidate.packagedPath}`);
    if (!samePinnedResource(candidate, expected)) fail(`Upstream provenance pin mismatch: ${candidate.packagedPath}`);
  }
  if (manifestPaths.size !== upstreamResources.length) fail('Upstream provenance has missing packaged paths');
  const paths = new Set();
  for (const resource of upstreamResources) {
    if (!validRelativePath(resource.sourcePath) || !validRelativePath(resource.packagedPath) || resource.packagedPath !== packagedPathFor(resource.repository, resource.sourcePath) || paths.has(resource.packagedPath)) fail('Upstream provenance has malformed, duplicate, or escaping paths');
    paths.add(resource.packagedPath);
    const path = join(root, resource.packagedPath);
    if (!confined(root, path)) fail(`Upstream resource path escape rejected: ${resource.packagedPath}`);
    await regularFile(path, resource.packagedPath);
    const bytes = await readFile(path);
    if (sha256(bytes) !== resource.packagedSha256) fail(`Upstream resource packaged hash mismatch: ${resource.packagedPath}`);
    if (resource.transformation === 'none') {
      if (resource.packagedSha256 !== resource.sourceSha256) fail(`Upstream resource source hash mismatch: ${resource.packagedPath}`);
    } else if (resource.transformation === 'append-final-newline-only') {
      if (bytes.length === 0 || bytes.at(-1) !== 0x0a || sha256(bytes.subarray(0, -1)) !== resource.sourceSha256) fail(`Upstream resource final-newline transformation mismatch: ${resource.packagedPath}`);
    } else fail(`Upstream resource transformation is unsupported: ${resource.packagedPath}`);
  }
  return upstreamPortableFiles;
}
