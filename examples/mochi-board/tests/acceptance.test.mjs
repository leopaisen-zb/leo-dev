import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import test from 'node:test';

const APP_DIR = fileURLToPath(new URL('..', import.meta.url));
const MAX_BODY_BYTES = 1024 * 1024;
const TASK_KEYS = ['createdAt', 'id', 'notes', 'priority', 'status', 'title', 'updatedAt'];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function within(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function iso(value) {
  assert.equal(typeof value, 'string');
  assert.match(value, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Number.isFinite(Date.parse(value)), `expected ISO date-time, got ${value}`);
}

function assertTask(task, { title, notes = '', status = 'todo', priority = 'normal' } = {}) {
  assert.deepEqual(Object.keys(task).sort(), TASK_KEYS);
  assert.match(task.id, /^[A-Za-z0-9_-]{1,80}$/);
  assert.equal(task.title, title);
  assert.equal(task.notes, notes);
  assert.equal(task.status, status);
  assert.equal(task.priority, priority);
  iso(task.createdAt);
  iso(task.updatedAt);
  assert.ok(Date.parse(task.createdAt) <= Date.parse(task.updatedAt));
}

function parseListeningLine(line) {
  try {
    const event = JSON.parse(line);
    if (event?.event !== 'listening' || typeof event.url !== 'string') return undefined;
    const url = new URL(event.url);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

async function startServer(dataFile, { expectFailure = false } = {}) {
  const child = spawn(process.execPath, ['server.mjs', '--port', '0', '--data', dataFile], {
    cwd: APP_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = deferred();
  let output = '';
  let stdoutBuffer = '';
  let exited = false;
  let exitCode;

  const consume = (chunk, isStdout) => {
    const text = chunk.toString();
    output += text;
    if (!isStdout) return;
    stdoutBuffer += text;
    let newline;
    while ((newline = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      const url = parseListeningLine(line);
      if (url) ready.resolve(url);
    }
  };
  child.stdout.on('data', (chunk) => consume(chunk, true));
  child.stderr.on('data', (chunk) => consume(chunk, false));
  const exitedPromise = new Promise((resolve) => {
    child.once('error', (error) => {
      exited = true;
      if (!expectFailure) ready.reject(error);
      resolve({ code: null, signal: null, error });
    });
    child.once('exit', (code, signal) => {
    exited = true;
    exitCode = { code, signal };
    if (!expectFailure) ready.reject(new Error(`server exited before listening: ${JSON.stringify(exitCode)}\n${output}`));
    resolve(exitCode);
    });
  });

  async function stop() {
    if (exited) return;
    child.kill('SIGTERM');
    const result = await within(exitedPromise, 5000, 'server did not exit after SIGTERM').catch(() => undefined);
    if (!result && !exited) {
      child.kill('SIGKILL');
      await exitedPromise;
    }
  }

  try {
    if (expectFailure) {
      const result = await within(exitedPromise, 5000, `server did not fail startup within 5000ms\n${output}`);
      assert.equal(result.error, undefined, 'server executable must start');
      assert.notEqual(result.code, 0, `corrupt data must make startup fail\n${output}`);
      return { child, output, exited: true };
    }
    const url = await within(ready.promise, 5000, `server did not announce listening within 5000ms\n${output}`);
    return { child, url, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function withServer(t, fn) {
  const directory = await mkdtemp(join(tmpdir(), 'mochi-board-acceptance-'));
  const dataFile = join(directory, 'board.json');
  let server;
  try {
    server = await startServer(dataFile);
    await fn({ dataFile, server, restart: async () => {
      await server.stop();
      server = await startServer(dataFile);
      return server;
    } });
  } finally {
    await server?.stop();
  }
}

async function request(server, path, { method = 'GET', json, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  let requestBody = body;
  if (json !== undefined) {
    requestHeaders['content-type'] ??= 'application/json';
    requestBody = JSON.stringify(json);
  }
  return fetch(`${server.url}${path}`, { method, headers: requestHeaders, body: requestBody, signal: AbortSignal.timeout(10_000) });
}

async function json(response, expectedStatus) {
  const text = await response.text();
  assert.equal(response.status, expectedStatus, text);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
  return JSON.parse(text);
}

async function board(server) {
  return json(await request(server, '/api/board'), 200);
}

async function create(server, value) {
  return json(await request(server, '/api/tasks', { method: 'POST', json: value }), 201);
}

function assertBoardShape(value) {
  assert.equal(value.schemaVersion, 1);
  assert.ok(Array.isArray(value.tasks));
  assert.ok(Array.isArray(value.activity));
}

function assertActivity(item) {
  assert.equal(typeof item.id, 'string');
  assert.ok(item.id.length > 0);
  assert.ok(['create', 'update', 'delete', 'import'].includes(item.action));
  iso(item.timestamp);
  if (item.action !== 'import') {
    assert.equal(typeof item.taskId, 'string');
    assert.equal(typeof item.title, 'string');
    assert.ok(item.title.length > 0, 'task activity needs a readable title');
  }
}

function fixtureTask(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    notes: '',
    status: 'todo',
    priority: 'normal',
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

test('M1 create defaults, validates input, and preserves state after rejected creates', async (t) => {
  await withServer(t, async ({ server }) => {
    assert.deepEqual(await board(server), { schemaVersion: 1, tasks: [], activity: [] });

    const task = await create(server, { title: '  Buy mochi  ' });
    assertTask(task, { title: 'Buy mochi' });

    for (const value of [
      {},
      { title: '   ' },
      { title: 9 },
      { title: 'x'.repeat(121) },
      { title: 'ok', notes: 9 },
      { title: 'ok', notes: 'x'.repeat(2001) },
      { title: 'ok', status: 'later' },
      { title: 'ok', priority: 'urgent' },
      { title: 'ok', extra: true },
    ]) {
      const response = await request(server, '/api/tasks', { method: 'POST', json: value });
      const error = await json(response, 400);
      assert.equal(typeof error.error, 'string');
      assert.ok(error.error.length > 0);
    }
    const current = await board(server);
    assert.equal(current.tasks.length, 1);
    assert.equal(current.activity.length, 1);
  });
});

test('M1 serializes concurrent creates and persists board across a fresh process', async (t) => {
  await withServer(t, async ({ server, restart }) => {
    const titles = Array.from({ length: 12 }, (_, index) => `concurrent-${index}`);
    const tasks = await Promise.all(titles.map((title) => create(server, { title })));
    assert.equal(new Set(tasks.map((task) => task.id)).size, titles.length);
    assert.deepEqual(new Set((await board(server)).tasks.map((task) => task.title)), new Set(titles));

    const secondServer = await restart();
    const afterRestart = await board(secondServer);
    assert.deepEqual(new Set(afterRestart.tasks.map((task) => task.title)), new Set(titles));
    assert.equal(afterRestart.activity.length, titles.length);
  });
});

test('M1 corrupt existing data makes startup fail and leaves exact bytes intact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mochi-board-corrupt-'));
  const dataFile = join(directory, 'board.json');
  const corrupt = '{ definitely not JSON';
  await writeFile(dataFile, corrupt);
  await startServer(dataFile, { expectFailure: true });
  assert.equal(await readFile(dataFile, 'utf8'), corrupt);
});

test('M2 patches fields, rejects invalid mutations, deletes, and records bounded history', async (t) => {
  await withServer(t, async ({ server, restart }) => {
    const task = await create(server, { title: 'Original', notes: 'before', status: 'todo', priority: 'low' });
    const updateResponse = await request(server, `/api/tasks/${task.id}`, {
      method: 'PATCH', json: { title: ' Updated ', notes: 'after', status: 'doing', priority: 'high' },
    });
    const updated = await json(updateResponse, 200);
    assertTask(updated, { title: 'Updated', notes: 'after', status: 'doing', priority: 'high' });
    assert.equal(updated.id, task.id);
    assert.equal(updated.createdAt, task.createdAt);
    assert.ok(Date.parse(updated.updatedAt) >= Date.parse(task.updatedAt));

    const beforeRejectedPatch = await board(server);
    for (const invalid of [{}, { nope: true }, { status: 'blocked' }, { title: ' ' }]) {
      const response = await request(server, `/api/tasks/${task.id}`, { method: 'PATCH', json: invalid });
      assert.equal(response.status, 400);
    }
    assert.deepEqual(await board(server), beforeRejectedPatch);
    for (const method of ['PATCH', 'DELETE']) {
      const response = await request(server, `/api/tasks/missing_123`, {
        method,
        ...(method === 'PATCH' ? { json: { status: 'done' } } : {}),
      });
      assert.equal(response.status, 404);
    }
    const beforeInvalid = await board(server);
    const malformed = await request(server, `/api/tasks/${task.id}`, {
      method: 'PATCH', body: '{', headers: { 'content-type': 'application/json' },
    });
    assert.equal(malformed.status, 400);
    const unsupported = await request(server, '/api/tasks', { method: 'POST', body: 'title=x', headers: { 'content-type': 'text/plain' } });
    assert.equal(unsupported.status, 415);
    const foreign = await request(server, `/api/tasks/${task.id}`, {
      method: 'PATCH', json: { status: 'done' }, headers: { origin: 'https://foreign.example' },
    });
    assert.equal(foreign.status, 403);
    const huge = await request(server, '/api/tasks', {
      method: 'POST', json: { title: 'too large', notes: 'x'.repeat(MAX_BODY_BYTES) },
    });
    assert.equal(huge.status, 413);
    assert.deepEqual(await board(server), beforeInvalid);

    const deletion = await request(server, `/api/tasks/${task.id}`, { method: 'DELETE' });
    assert.equal(deletion.status, 204);
    assert.equal(await deletion.text(), '');
    const afterDeletion = await board(server);
    assert.ok(afterDeletion.activity.some((item) => item.action === 'update' && item.taskId === task.id));
    assert.ok(afterDeletion.activity.some((item) => item.action === 'delete' && item.taskId === task.id));

    for (let index = 0; index < 100; index += 1) await create(server, { title: `history-${index}` });
    const current = await board(server);
    assert.equal(current.activity.length, 100);
    current.activity.forEach(assertActivity);
    assert.equal(new Set(current.activity.map((item) => item.id)).size, 100);
    const persisted = await board(await restart());
    assert.deepEqual(persisted.activity, current.activity);
  });
});

test('M2 rejects arbitrary static paths and does not publish wildcard CORS', async (t) => {
  await withServer(t, async ({ server }) => {
    const response = await request(server, '/not-a-static-asset.txt');
    assert.equal(response.status, 404);
    const api = await request(server, '/api/board');
    assert.notEqual(api.headers.get('access-control-allow-origin'), '*');
  });
});

test('M4 exports and imports exact semantic task values, then accepts empty snapshot without erasing history', async (t) => {
  await withServer(t, async ({ server }) => {
    const textPayload = '<img src=x onerror=alert(1)> & plain text';
    const created = await create(server, { title: 'Code-looking text', notes: textPayload, status: 'done', priority: 'high' });
    const exported = await json(await request(server, '/api/export'), 200);
    assert.deepEqual(Object.keys(exported).sort(), ['schemaVersion', 'tasks']);
    assert.equal(exported.schemaVersion, 1);
    assert.deepEqual(exported.tasks, [created]);

    const snapshotTask = fixtureTask('portable_1', { title: 'Imported text', notes: textPayload, status: 'doing', priority: 'low' });
    const imported = await json(await request(server, '/api/import', { method: 'POST', json: { schemaVersion: 1, tasks: [snapshotTask] } }), 200);
    assertBoardShape(imported);
    assert.deepEqual(imported.tasks, [snapshotTask]);
    assert.equal(imported.activity.at(-1).action, 'import');
    const emptied = await json(await request(server, '/api/import', { method: 'POST', json: { schemaVersion: 1, tasks: [] } }), 200);
    assert.deepEqual(emptied.tasks, []);
    assert.equal(emptied.activity.length, 3);
    assert.equal(emptied.activity.at(-1).action, 'import');
  });
});

test('M4 rejects invalid snapshots atomically and leaves persisted bytes unchanged', async (t) => {
  await withServer(t, async ({ server, dataFile }) => {
    await create(server, { title: 'Keep me' });
    const good = fixtureTask('snapshot_1', { title: 'Imported', notes: 'safe text' });
    const cases = [
      { schemaVersion: 1, tasks: [good, { ...good }] },
      { schemaVersion: 1, tasks: [{ ...good, id: 'bad id' }] },
      { schemaVersion: 1, tasks: [{ ...good, extra: true }] },
      { schemaVersion: 1, tasks: [{ ...good, notes: undefined }] },
      { schemaVersion: 1, tasks: [{ ...good, createdAt: 'not-a-date' }] },
      { schemaVersion: 1, tasks: [{ ...good, createdAt: '2026-09-15T00:00:00.000Z' }] },
      { schemaVersion: 2, tasks: [good] },
      { schemaVersion: 1, tasks: [], extra: true },
      { schemaVersion: 1, tasks: Array.from({ length: 501 }, (_, index) => fixtureTask(`n${index}`)) },
    ];
    for (const snapshot of cases) {
      const beforeBoard = await board(server);
      const beforeBytes = await readFile(dataFile);
      const response = await request(server, '/api/import', { method: 'POST', json: snapshot });
      const error = await json(response, 400);
      assert.equal(typeof error.error, 'string');
      assert.deepEqual(await board(server), beforeBoard);
      assert.deepEqual(await readFile(dataFile), beforeBytes);
    }
  });
});
