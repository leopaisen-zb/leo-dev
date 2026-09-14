import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const app = fileURLToPath(new URL('..', import.meta.url));

async function start(data) {
  const child = spawn(process.execPath, ['server.mjs', '--port', '0', '--data', data], {
    cwd: app, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let timer;
  const ended = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => reject(new Error(`server stopped before readiness: ${code}/${signal}: ${output}`)));
    child.stderr.on('data', data => { output += data; });
    let stdout = '';
    child.stdout.on('data', data => {
      stdout += data;
      for (const line of stdout.split('\n').slice(0, -1)) {
        try {
          const event = JSON.parse(line);
          if (event.event === 'listening') resolve(event.url);
        } catch { /* Wait for a complete listening event. */ }
      }
    });
    timer = setTimeout(() => reject(new Error(`server readiness timed out: ${output}`)), 5000);
  });
  async function stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    const kill = setTimeout(() => child.kill('SIGKILL'), 5000);
    try { await ended; } finally { clearTimeout(kill); }
  }
  try {
    const url = await ready;
    assert.equal(new URL(url).hostname, '127.0.0.1');
    return { url, stop };
  } catch (error) {
    await stop();
    throw error;
  } finally { clearTimeout(timer); }
}

async function json(server, path, method = 'GET', body) {
  const response = await fetch(server.url + path, {
    method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

const future = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString();
for (const [name, createdAt, updatedAt] of [
  ['future creation', future, future],
  ['future update', '2000-01-01T00:00:00.000Z', future],
  ['calendar-boundary offset', '9999-12-31T23:59:59-23:59', '9999-12-31T23:59:59-23:59'],
]) {
  test(`import, edit and restart preserve valid timestamps: ${name}`, async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'mochi-clock-regression-'));
    const data = join(temporary, 'board.json');
    let server = await start(data);
    const task = { id: 'imported_task', title: 'Keep this task readable', notes: '', status: 'todo', priority: 'normal', createdAt, updatedAt };
    try {
      const imported = await json(server, '/api/import', 'POST', { schemaVersion: 1, tasks: [task] });
      assert.deepEqual(imported.tasks, [task], 'Import preserves the accepted values exactly');
      const updated = await json(server, '/api/tasks/imported_task', 'PATCH', { status: 'doing' });
      assert.equal(updated.id, task.id);
      assert.equal(updated.createdAt, task.createdAt);
      assert.equal(updated.status, 'doing');
      assert.ok(Date.parse(updated.updatedAt) >= Date.parse(task.updatedAt), 'Editing must not move updatedAt backwards');
      assert.ok(Date.parse(updated.updatedAt) >= Date.parse(task.createdAt), 'Stored timestamps remain ordered');
      const persisted = JSON.parse(await readFile(data, 'utf8'));
      assert.deepEqual(persisted.tasks, [updated]);
      await server.stop();
      server = await start(data);
      const board = await json(server, '/api/board');
      assert.deepEqual(board.tasks, [updated], 'A new process reads the edited snapshot');
      const exported = await json(server, '/api/export');
      assert.deepEqual(exported, { schemaVersion: 1, tasks: [updated] });
      const again = await json(server, '/api/import', 'POST', exported);
      assert.deepEqual(again.tasks, [updated], 'The exported edited task remains a valid import');
    } finally { await server.stop(); }
  });
}
