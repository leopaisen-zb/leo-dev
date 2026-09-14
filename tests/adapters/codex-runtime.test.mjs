import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

const repository = join(dirname(fileURLToPath(import.meta.url)), '../..');
const temporaryPaths = [];

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryPaths.push(directory);
  return directory;
}

function build(output) {
  return spawnSync(process.execPath, ['scripts/build-adapters.mjs', '--out', output], {
    cwd: repository,
    encoding: 'utf8',
  });
}

function run(entry, args, cwd) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8' });
}

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function runtimeInventory(directory, prefix = '') {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    assert.equal(stat.isSymbolicLink(), false, `test fixture must not contain symlinks: ${name}`);
    if (stat.isDirectory()) files.push(...await runtimeInventory(path, name));
    else if (stat.isFile() && name !== 'runtime-manifest.json') files.push({ path: name, sha256: digest(await readFile(path)) });
  }
  return files.sort((left, right) => (left.path > right.path) - (left.path < right.path));
}

async function rewriteRuntimeManifest(runtime) {
  const path = join(runtime, 'runtime-manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.files = await runtimeInventory(runtime);
  assert.deepEqual(manifest.files.map((entry) => entry.path), (JSON.parse(await readFile(path, 'utf8'))).files.map((entry) => entry.path));
  manifest.packageDigest = digest(manifest.files.map((entry) => `${entry.path}\0${entry.sha256}\n`).join(''));
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

after(async () => Promise.all(temporaryPaths.map((path) => rm(path, { recursive: true, force: true }))));

test('builds a relocatable Codex runtime that initializes and reads status outside the checkout', async () => {
  const dist = await temporaryDirectory('leo-dev-runtime-dist-');
  const isolatedParent = await temporaryDirectory('leo-dev-runtime-isolated-');
  const project = await temporaryDirectory('leo-dev-runtime-project-');
  const built = build(dist);
  assert.equal(built.status, 0, built.stderr);

  const packageRoot = join(dist, 'codex', 'leo-dev');
  const relocated = join(isolatedParent, 'leo-dev');
  await cp(packageRoot, relocated, { recursive: true, dereference: false });
  await writeFile(join(project, 'spec.md'), '# Runtime package proof\n');
  const entry = join(relocated, 'runtime/packages/cli/dist/index.js');

  const init = run(entry, ['init', '--change', 'runtime-proof', '--spec', 'spec.md'], project);
  assert.equal(init.status, 0, init.stderr);
  assert.equal(JSON.parse(init.stdout).code, 'INITIALIZED');

  const status = run(entry, ['status', '--change', 'runtime-proof'], project);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).code, 'STATUS');

  const initialTeam = run(entry, ['team', '--change', 'runtime-proof', '--action', 'status'], project);
  assert.equal(initialTeam.status, 0, initialTeam.stderr);
  const initialTeamEnvelope = JSON.parse(initialTeam.stdout);
  assert.equal(initialTeamEnvelope.code, 'TEAM_STATUS');
  assert.equal(initialTeamEnvelope.state.team, null);
  assert.match(initialTeamEnvelope.state.currentSpecHash, /^[a-f0-9]{64}$/);

  await writeFile(join(project, 'team-open.json'), `${JSON.stringify({
    schemaVersion: 1,
    requestId: 'runtime-open',
    teamId: 'runtime-team',
    expectedRevision: 0,
    specHash: initialTeamEnvelope.state.currentSpecHash,
    operation: {
      type: 'open',
      members: [
        { memberId: 'writer', role: 'runtime package writer', access: 'write' },
        { memberId: 'reviewer', role: 'runtime package reviewer', access: 'read' },
      ],
    },
  })}\n`);
  const openedTeam = run(entry, ['team', '--change', 'runtime-proof', '--action', 'record', '--input', 'team-open.json'], project);
  assert.equal(openedTeam.status, 0, openedTeam.stderr);
  assert.equal(JSON.parse(openedTeam.stdout).code, 'TEAM_RECORDED');

  const persistedTeam = run(entry, ['team', '--change', 'runtime-proof', '--action', 'status'], project);
  assert.equal(persistedTeam.status, 0, persistedTeam.stderr);
  const persistedTeamEnvelope = JSON.parse(persistedTeam.stdout);
  assert.equal(persistedTeamEnvelope.code, 'TEAM_STATUS');
  assert.deepEqual(persistedTeamEnvelope.state.team.members, [
    { memberId: 'writer', role: 'runtime package writer', access: 'write', generation: 0, threadId: null, bindings: [] },
    { memberId: 'reviewer', role: 'runtime package reviewer', access: 'read', generation: 0, threadId: null, bindings: [] },
  ]);
  assert.equal(persistedTeamEnvelope.state.team.revision, 1);
});

test('verifies runtime inventory against the current source and rejects tampering', async () => {
  const output = await temporaryDirectory('leo-dev-runtime-verify-');
  assert.equal(build(output).status, 0);
  const { verify } = await import('../../scripts/verify-packages.mjs');
  const runtime = join(output, 'codex/leo-dev/runtime');

  await writeFile(join(runtime, 'packages/cli/dist/index.js'), 'tampered');
  await assert.rejects(() => verify(output), /runtime|hash|inventory/i);

  assert.equal(build(output).status, 0);
  await writeFile(join(runtime, 'unexpected.txt'), 'unexpected');
  await assert.rejects(() => verify(output), /runtime|unknown|inventory/i);

  assert.equal(build(output).status, 0);
  const manifest = join(runtime, 'runtime-manifest.json');
  const original = JSON.parse(await readFile(manifest, 'utf8'));
  original.files[0].sha256 = '0'.repeat(64);
  await writeFile(manifest, `${JSON.stringify(original)}\n`);
  await assert.rejects(() => verify(output), /runtime|digest|hash|inventory/i);
});

test('rejects runtime code or dependency replacement even when its manifest is recomputed', async () => {
  const output = await temporaryDirectory('leo-dev-runtime-forged-manifest-');
  const { verify } = await import('../../scripts/verify-packages.mjs');

  assert.equal(build(output).status, 0);
  const runtime = join(output, 'codex/leo-dev/runtime');
  await assert.doesNotReject(() => verify(output));
  await writeFile(join(runtime, 'packages/cli/dist/index.js'), 'forged CLI bytes');
  await rewriteRuntimeManifest(runtime);
  await assert.rejects(() => verify(output), /Runtime trusted inventory mismatch/);

  assert.equal(build(output).status, 0);
  await assert.doesNotReject(() => verify(output));
  const manifest = JSON.parse(await readFile(join(runtime, 'runtime-manifest.json'), 'utf8'));
  const dependency = manifest.files.find((entry) => entry.path.startsWith('node_modules/') && entry.path.endsWith('.js'));
  assert.ok(dependency, 'built runtime must include a dependency JavaScript file');
  await writeFile(join(runtime, dependency.path), 'forged dependency bytes');
  await rewriteRuntimeManifest(runtime);
  await assert.rejects(() => verify(output), /Runtime trusted inventory mismatch/);
});

test('rejects injected runtime payloads in thin non-Codex packages', async () => {
  const output = await temporaryDirectory('leo-dev-thin-runtime-payload-');
  const { verify } = await import('../../scripts/verify-packages.mjs');

  for (const platform of ['claude', 'cursor']) {
    assert.equal(build(output).status, 0);
    const payload = join(output, platform, 'leo-dev', 'runtime', 'payload.js');
    await mkdir(dirname(payload), { recursive: true });
    await writeFile(payload, 'injected runtime payload');
    await assert.rejects(() => verify(output), new RegExp(`${platform} package has unknown or missing files`));
  }
});

test('rejects runtime symlinks and refuses to package an unavailable runtime dependency', async () => {
  const output = await temporaryDirectory('leo-dev-runtime-symlink-');
  assert.equal(build(output).status, 0);
  const { verify } = await import('../../scripts/verify-packages.mjs');
  const runtime = join(output, 'codex/leo-dev/runtime');
  await symlink('/etc/hosts', join(runtime, 'escape'));
  await assert.rejects(() => verify(output), /runtime|symlink|escape/i);

  const { buildRuntime } = await import('../../scripts/package-runtime.mjs');
  const destination = join(await temporaryDirectory('leo-dev-runtime-missing-'), 'runtime');
  await assert.rejects(
    () => buildRuntime({ destination, dependencyResolver: () => { throw new Error('missing package'); } }),
    /missing package|dependency/i,
  );
});
