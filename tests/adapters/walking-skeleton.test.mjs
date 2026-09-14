import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, cp, lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';

const repository = join(dirname(fileURLToPath(import.meta.url)), '../..');
const temporaryPaths = [];
const portableFiles = [
  'SKILL.md',
  'references/acceptance.md',
  'references/autonomous-execution.md',
  'references/components.md',
  'references/codex-team.md',
  'references/delivery.md',
  'references/gates.md',
  'references/lifecycle.md',
  'references/review-protocol.md',
  'references/upstream/bmad-team-LICENSE.txt',
];

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryPaths.push(directory);
  return directory;
}

async function digest(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function skillEntrypoints(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await skillEntrypoints(join(directory, entry.name), path));
    else if (entry.isFile() && entry.name === 'SKILL.md') result.push(path);
  }
  return result.sort();
}

after(async () => Promise.all(temporaryPaths.map((path) => rm(path, { recursive: true, force: true }))));

test('builds deterministic three-client packages from package.yaml and physically copies develop', async () => {
  const first = await temporaryDirectory('leo-dev-first-');
  const second = await temporaryDirectory('leo-dev-second-');

  for (const output of [first, second]) {
    const result = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], {
      cwd: repository,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  }

  const metadata = await readFile(join(repository, 'package.yaml'), 'utf8');
  assert.match(metadata, /^name: leo-dev$/m);

  for (const [platform, manifestDirectory] of [
    ['codex', '.codex-plugin'],
    ['claude', '.claude-plugin'],
    ['cursor', '.cursor-plugin'],
    ['open-agent-plugin', ''],
  ]) {
    const root = join(first, platform, 'leo-dev');
    const manifest = JSON.parse(await readFile(join(root, manifestDirectory, 'plugin.json'), 'utf8'));
    assert.equal(manifest.name, 'leo-dev');
    assert.equal(manifest.version, '0.2.0');
    assert.equal(manifest.license, 'UNLICENSED');
    for (const file of portableFiles) {
      assert.equal(await readFile(join(root, 'skills/develop', file), 'utf8'), await readFile(join(repository, 'skills/develop', file), 'utf8'));
      assert.equal(await digest(join(root, 'skills/develop', file)), await digest(join(second, platform, 'leo-dev/skills/develop', file)));
    }
  }

  const verification = spawnSync(process.execPath, ['scripts/verify-packages.mjs', '--dist', first], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.equal(verification.status, 0, verification.stderr);
});

test('relocates declared upstream resources with every portable package', async () => {
  const output = await temporaryDirectory('leo-dev-upstream-relocation-');
  const result = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const { productionProvenance, upstreamResources } = await import('../../scripts/upstream-resources.mjs');
  for (const platform of ['codex', 'claude', 'cursor', 'open-agent-plugin']) {
    const upstream = join(output, platform, 'leo-dev/skills/develop/references/upstream');
    assert.deepEqual(JSON.parse(await readFile(join(upstream, 'provenance.json'), 'utf8')), productionProvenance());
    for (const resource of upstreamResources) {
      const packaged = join(output, platform, 'leo-dev/skills/develop', resource.packagedPath);
      assert.equal(await digest(packaged), resource.packagedSha256);
      assert.deepEqual(await readFile(packaged), await readFile(join(repository, 'skills/develop', resource.packagedPath)));
    }
    await assert.rejects(access(join(upstream, 'experiments')));
  }
  const { verify } = await import('../../scripts/verify-packages.mjs');
  await assert.doesNotReject(() => verify(output));
});

test('ships exactly one discoverable SKILL.md sentinel per portable package', async () => {
  const output = await temporaryDirectory('leo-dev-single-sentinel-');
  const result = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  for (const platform of ['codex', 'claude', 'cursor', 'open-agent-plugin']) {
    assert.deepEqual(
      await skillEntrypoints(join(output, platform, 'leo-dev', 'skills')),
      ['develop/SKILL.md'],
    );
  }
});

test('rejects tampered upstream bytes and invalid provenance paths on temporary source copies', async () => {
  const { validateUpstreamResources, upstreamResources } = await import('../../scripts/upstream-resources.mjs');
  const source = join(await temporaryDirectory('leo-dev-upstream-source-tamper-'), 'develop');
  await cp(join(repository, 'skills/develop'), source, { recursive: true, dereference: false });
  await writeFile(join(source, upstreamResources[0].packagedPath), 'tampered upstream bytes');
  await assert.rejects(() => validateUpstreamResources(source), /hash/i);

  const invalid = join(await temporaryDirectory('leo-dev-upstream-provenance-path-'), 'develop');
  await cp(join(repository, 'skills/develop'), invalid, { recursive: true, dereference: false });
  const provenance = join(invalid, 'references/upstream/provenance.json');
  await writeFile(provenance, (await readFile(provenance, 'utf8')).replace('references/upstream/cc-sdd/', 'references/upstream/cc-sdd/../'));
  await assert.rejects(() => validateUpstreamResources(invalid), /provenance|pinned|path/i);
});

test('accepts semantically identical upstream provenance despite source key and list ordering', async () => {
  const { validateUpstreamResources } = await import('../../scripts/upstream-resources.mjs');
  const source = join(await temporaryDirectory('leo-dev-upstream-provenance-order-'), 'develop');
  await cp(join(repository, 'skills/develop'), source, { recursive: true, dereference: false });
  const path = join(source, 'references/upstream/provenance.json');
  const provenance = JSON.parse(await readFile(path, 'utf8'));
  const sources = provenance.sources.reverse().map((resource) => ({
    packagedSha256: resource.packagedSha256,
    packagedPath: resource.packagedPath,
    transformation: resource.transformation,
    sourceSha256: resource.sourceSha256,
    sourcePath: resource.sourcePath,
    revision: resource.revision,
    repository: resource.repository,
  }));
  await writeFile(path, `${JSON.stringify({ sources, scope: provenance.scope, schemaVersion: provenance.schemaVersion }, null, 2)}\n`);
  await assert.doesNotReject(() => validateUpstreamResources(source));
});

test('verify refuses tampered packaged upstream resources', async () => {
  const output = await temporaryDirectory('leo-dev-upstream-package-tamper-');
  const result = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  await writeFile(join(output, 'cursor/leo-dev/skills/develop/references/upstream/spec-kit/LICENSE'), 'tampered upstream license');
  const { verify } = await import('../../scripts/verify-packages.mjs');
  await assert.rejects(() => verify(output), /hash|portable|inventory/i);
});

test('rejects output paths outside the requested build root', () => {
  const result = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', '../escape'], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /relative|escape/i);
});

test('rejects symlink escapes and unknown portable source files', async () => {
  const { validatePortableSkill } = await import('../../scripts/build-adapters.mjs');
  const source = await temporaryDirectory('leo-dev-source-');
  await mkdir(join(source, 'skills/develop'), { recursive: true });
  await writeFile(join(source, 'skills/develop/SKILL.md'), '---\nname: develop\ndescription: test\n---\n');
  await writeFile(join(source, 'skills/develop/unexpected.md'), 'not declared');
  await assert.rejects(() => validatePortableSkill(join(source, 'skills/develop')), /unknown/i);

  await rm(join(source, 'skills/develop/unexpected.md'));
  await symlink('/etc/hosts', join(source, 'skills/develop/escape.md'));
  await assert.rejects(() => validatePortableSkill(join(source, 'skills/develop')), /symlink|escape/i);
});

test('uses YAML metadata and keeps Codex-only agent material out of other portable cores', async () => {
  const { loadMetadata } = await import('../../scripts/build-adapters.mjs');
  const yaml = join(await temporaryDirectory('leo-dev-metadata-'), 'package.yaml');
  await writeFile(yaml, 'name: leo-dev\nversion: "1.2.3"\nprivate: true\nlicense: UNLICENSED\ndescription: "quoted: metadata"\nauthor:\n  name: "Leo Example"\n');
  assert.deepEqual(await loadMetadata(yaml), {
    name: 'leo-dev', version: '1.2.3', private: true, license: 'UNLICENSED',
    description: 'quoted: metadata', author: { name: 'Leo Example' },
  });

  const output = await temporaryDirectory('leo-dev-platform-core-');
  const built = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], { cwd: repository, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  for (const platform of ['claude', 'cursor', 'open-agent-plugin']) {
    await assert.rejects(access(join(output, platform, 'leo-dev/skills/develop/agents/openai.yaml')));
  }
  await access(join(output, 'codex/leo-dev/skills/develop/agents/openai.yaml'));
  const codex = JSON.parse(await readFile(join(output, 'codex/leo-dev/.codex-plugin/plugin.json')));
  assert.equal('hooks' in codex, false);
  assert.equal(codex.interface.displayName, 'Leo Dev');
  assert.equal(codex.interface.category, 'Developer Tools');
  assert.equal(codex.repository, 'https://github.com/leopaisen-zb/leo-dev');
  assert.equal(codex.interface.composerIcon, './assets/shinchan-logo.png');
  assert.equal(codex.interface.logo, './assets/shinchan-logo.png');
  await access(join(output, 'codex/leo-dev/assets/shinchan-logo.png'));
});

test('generates a self-contained local Codex marketplace from the built package', async () => {
  const dist = await temporaryDirectory('leo-dev-marketplace-dist-');
  const marketplaceParent = await temporaryDirectory('leo-dev-marketplace-');
  const marketplace = join(marketplaceParent, 'new-marketplace');
  const built = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', dist], { cwd: repository, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);

  const generated = spawnSync(process.execPath, ['scripts/create-codex-marketplace.mjs', '--dist', dist, '--out', marketplace], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.equal(generated.status, 0, generated.stderr);
  const manifest = JSON.parse(await readFile(join(marketplace, '.agents/plugins/marketplace.json'), 'utf8'));
  assert.deepEqual(manifest, {
    name: 'leo-dev-release',
    interface: { displayName: 'Leo Dev Release' },
    plugins: [{
      name: 'leo-dev',
      source: { source: 'local', path: './plugins/leo-dev' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Developer Tools',
    }],
  });
  const plugin = join(marketplace, 'plugins/leo-dev');
  assert.deepEqual(await readFile(join(plugin, '.codex-plugin/plugin.json')), await readFile(join(dist, 'codex/leo-dev/.codex-plugin/plugin.json')));
  await assert.rejects(access(join(plugin, 'runtime', 'missing')));

  const repeated = spawnSync(process.execPath, ['scripts/create-codex-marketplace.mjs', '--dist', dist, '--out', marketplace], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.equal(repeated.status, 0, repeated.stderr);

  const unowned = join(marketplaceParent, 'unowned-marketplace');
  await mkdir(unowned);
  await writeFile(join(unowned, 'user-file.txt'), 'must not be replaced');
  const refused = spawnSync(process.execPath, ['scripts/create-codex-marketplace.mjs', '--dist', dist, '--out', unowned], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /refusing|owned/i);
  assert.equal(await readFile(join(unowned, 'user-file.txt'), 'utf8'), 'must not be replaced');

  const symlinked = join(marketplaceParent, 'symlinked-marketplace');
  await mkdir(symlinked);
  await symlink('/tmp', join(symlinked, 'escape'));
  const symlinkRefused = spawnSync(process.execPath, ['scripts/create-codex-marketplace.mjs', '--dist', dist, '--out', symlinked], {
    cwd: repository,
    encoding: 'utf8',
  });
  assert.notEqual(symlinkRefused.status, 0);
  assert.match(symlinkRefused.stderr, /symlink|escape/i);
  assert.equal((await lstat(join(symlinked, 'escape'))).isSymbolicLink(), true);
});

test('replaces owned adapter packages and verify rejects tampered package contents', async () => {
  const output = await temporaryDirectory('leo-dev-verify-');
  const build = () => spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], { cwd: repository, encoding: 'utf8' });
  assert.equal(build().status, 0);
  const staleHook = join(output, 'codex/leo-dev/hooks/hooks.json');
  await mkdir(dirname(staleHook), { recursive: true });
  await writeFile(staleHook, '{}');
  assert.equal(build().status, 0);
  await assert.rejects(access(staleHook));

  const { verify } = await import('../../scripts/verify-packages.mjs');
  const codexRoot = join(output, 'codex/leo-dev');
  const manifest = join(codexRoot, '.codex-plugin/plugin.json');
  const originalManifest = await readFile(manifest, 'utf8');
  await writeFile(manifest, originalManifest.replace('"./skills/"', '"../skills/"'));
  await assert.rejects(() => verify(output), /path|escape|confine/i);

  assert.equal(build().status, 0);
  await writeFile(join(codexRoot, 'skills/develop/references/acceptance.md'), 'tampered');
  await assert.rejects(() => verify(output), /hash|portable|inventory/i);

  assert.equal(build().status, 0);
  await writeFile(join(codexRoot, 'skills/develop/references/upstream/spec-kit/LICENSE'), 'tampered upstream license');
  await assert.rejects(() => verify(output), /hash|portable|inventory/i);

  assert.equal(build().status, 0);
  await writeFile(join(codexRoot, 'unexpected.txt'), 'unknown');
  await assert.rejects(() => verify(output), /unknown|inventory/i);

  assert.equal(build().status, 0);
  await writeFile(join(codexRoot, 'hooks.json'), '{}');
  await assert.rejects(() => verify(output), /unknown|field|inventory/i);

  assert.equal(build().status, 0);
  const hooksManifest = JSON.parse(await readFile(manifest, 'utf8'));
  hooksManifest.hooks = {};
  await writeFile(manifest, JSON.stringify(hooksManifest));
  await assert.rejects(() => verify(output), /unknown|field|inventory/i);

  assert.equal(build().status, 0);
  const interfaceManifest = JSON.parse(await readFile(manifest, 'utf8'));
  interfaceManifest.interface.undeclared = true;
  await writeFile(manifest, JSON.stringify(interfaceManifest));
  await assert.rejects(() => verify(output), /interface|field/i);
});

test('rejects Windows and POSIX manifest path escapes', async () => {
  const output = await temporaryDirectory('leo-dev-path-escapes-');
  const build = () => spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], { cwd: repository, encoding: 'utf8' });
  const { verify } = await import('../../scripts/verify-packages.mjs');
  const manifestPath = join(output, 'codex/leo-dev/.codex-plugin/plugin.json');
  for (const escapedPath of ['/absolute/skills', 'C:\\skills', '\\\\server\\share', '..\\skills']) {
    assert.equal(build().status, 0);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.skills = escapedPath;
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(() => verify(output), /path|escape/i, escapedPath);
  }
});

test('rejects symlinked adapter ancestors and a symlinked dist root', async () => {
  const output = await temporaryDirectory('leo-dev-symlink-output-');
  const target = await temporaryDirectory('leo-dev-symlink-target-');
  await symlink(target, join(output, 'codex'));
  const build = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], { cwd: repository, encoding: 'utf8' });
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /symlink|escape/i);

  const valid = await temporaryDirectory('leo-dev-valid-dist-');
  const built = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', valid], { cwd: repository, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  const linkedDist = join(await temporaryDirectory('leo-dev-dist-link-'), 'dist');
  await symlink(valid, linkedDist);
  const { verify } = await import('../../scripts/verify-packages.mjs');
  await assert.rejects(() => verify(linkedDist), /symlink|escape/i);

  const outside = await temporaryDirectory('leo-dev-outside-');
  const linkedParent = join(await temporaryDirectory('leo-dev-parent-link-'), 'linked');
  await symlink(outside, linkedParent);
  const nestedOutput = join(linkedParent, 'out');
  const nestedBuild = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', nestedOutput], { cwd: repository, encoding: 'utf8' });
  assert.notEqual(nestedBuild.status, 0);
  assert.match(nestedBuild.stderr, /symlink|escape/i);

  const nestedValid = join(outside, 'verified-output');
  const nestedValidBuild = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', nestedValid], { cwd: repository, encoding: 'utf8' });
  assert.equal(nestedValidBuild.status, 0, nestedValidBuild.stderr);
  await assert.rejects(() => verify(nestedOutput.replace(/out$/, 'verified-output')), /symlink|escape/i);
});

test('hashes Codex-only generated source files and validates portable frontmatter as YAML', async () => {
  const output = await temporaryDirectory('leo-dev-agent-hash-');
  const built = spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], { cwd: repository, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  const { verify } = await import('../../scripts/verify-packages.mjs');
  await writeFile(join(output, 'codex/leo-dev/skills/develop/agents/openai.yaml'), 'tampered: true\n');
  await assert.rejects(() => verify(output), /hash/i);

  const { validatePortableSkill } = await import('../../scripts/build-adapters.mjs');
  const skill = join(await temporaryDirectory('leo-dev-frontmatter-'), 'develop');
  await cp(join(repository, 'skills/develop'), skill, { recursive: true, dereference: false });
  await writeFile(join(skill, 'SKILL.md'), '---\nname: [develop]\ndescription: okay\nextra: no\n---\n');
  await assert.rejects(() => validatePortableSkill(skill), /frontmatter|name|unknown/i);
});
