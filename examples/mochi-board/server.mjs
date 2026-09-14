import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { BoardStore, validateImportSnapshot } from './lib/store.mjs';

const MAX_BODY_BYTES = 1024 * 1024;
const STATIC_FILES = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', type: 'text/css; charset=utf-8' }],
  ['/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/mochi.svg', { file: 'mochi.svg', type: 'image/svg+xml' }],
]);
const here = dirname(fileURLToPath(import.meta.url));

function options(argv) {
  let port = 4173;
  let data = resolve(here, '.data/board.json');
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if ((flag !== '--port' && flag !== '--data') || value === undefined) throw new Error('Usage: node server.mjs [--port PORT] [--data FILE]');
    if (flag === '--port') {
      if (!/^\d+$/.test(value) || Number(value) > 65535) throw new Error('port must be an integer from 0 to 65535');
      port = Number(value);
    } else data = resolve(value);
    index += 1;
  }
  return { port, data };
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function error(response, status, message) {
  sendJson(response, status, { error: message });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) tooLarge = true;
    else chunks.push(chunk);
  }
  if (tooLarge) {
    const oversized = new Error('JSON body exceeds 1 MiB');
    oversized.status = 413;
    throw oversized;
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const invalid = new Error('Malformed JSON'); invalid.status = 400; throw invalid; }
}

function validateCreate(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('body must be a JSON object');
  const allowed = new Set(['title', 'notes', 'status', 'priority']);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('unknown create field');
  if (typeof value.title !== 'string') throw new Error('title must be a string');
  const title = value.title.trim();
  if (title.length < 1 || title.length > 120) throw new Error('title must contain 1 to 120 trimmed characters');
  const notes = Object.hasOwn(value, 'notes') ? value.notes : '';
  const status = Object.hasOwn(value, 'status') ? value.status : 'todo';
  const priority = Object.hasOwn(value, 'priority') ? value.priority : 'normal';
  if (typeof notes !== 'string' || notes.length > 2000) throw new Error('notes must be a string of at most 2000 characters');
  if (!['todo', 'doing', 'done'].includes(status)) throw new Error('status must be todo, doing, or done');
  if (!['low', 'normal', 'high'].includes(priority)) throw new Error('priority must be low, normal, or high');
  return { title, notes, status, priority };
}

function validateUpdate(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('body must be a JSON object');
  const allowed = new Set(['title', 'notes', 'status', 'priority']);
  const keys = Object.keys(value);
  if (keys.length === 0) throw new Error('update must include at least one field');
  if (keys.some((key) => !allowed.has(key))) throw new Error('unknown update field');
  const update = {};
  if (Object.hasOwn(value, 'title')) {
    if (typeof value.title !== 'string') throw new Error('title must be a string');
    const title = value.title.trim();
    if (title.length < 1 || title.length > 120) throw new Error('title must contain 1 to 120 trimmed characters');
    update.title = title;
  }
  if (Object.hasOwn(value, 'notes')) {
    if (typeof value.notes !== 'string' || value.notes.length > 2000) throw new Error('notes must be a string of at most 2000 characters');
    update.notes = value.notes;
  }
  if (Object.hasOwn(value, 'status')) {
    if (!['todo', 'doing', 'done'].includes(value.status)) throw new Error('status must be todo, doing, or done');
    update.status = value.status;
  }
  if (Object.hasOwn(value, 'priority')) {
    if (!['low', 'normal', 'high'].includes(value.priority)) throw new Error('priority must be low, normal, or high');
    update.priority = value.priority;
  }
  return update;
}

function foreignOrigin(request, boundPort) {
  const origin = request.headers.origin;
  if (origin === undefined) return false;
  if (typeof origin !== 'string') return true;
  try {
    const parsed = new URL(origin);
    return parsed.origin !== origin
      || parsed.protocol !== 'http:'
      || !['127.0.0.1', 'localhost'].includes(parsed.hostname)
      || parsed.port !== String(boundPort);
  } catch {
    return true;
  }
}

async function sendStatic(response, asset) {
  try {
    const contents = await readFile(join(here, 'public', asset.file));
    response.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store' });
    response.end(contents);
  } catch (cause) {
    if (cause?.code === 'ENOENT') return error(response, 404, 'not found');
    throw cause;
  }
}

async function main() {
  const { port, data } = options(process.argv.slice(2));
  const store = await BoardStore.open(data);
  let boundPort;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    try {
      if (request.method === 'GET' && url.pathname === '/api/board') return sendJson(response, 200, store.snapshot());
      if (request.method === 'GET' && url.pathname === '/api/export') {
        const { schemaVersion, tasks } = store.snapshot();
        return sendJson(response, 200, { schemaVersion, tasks });
      }
      if (request.method === 'POST' && url.pathname === '/api/tasks') {
        if (foreignOrigin(request, boundPort)) return error(response, 403, 'foreign origins are not allowed');
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) return error(response, 415, 'Content-Type must be application/json');
        const task = await store.create(validateCreate(await readJson(request)));
        return sendJson(response, 201, task);
      }
      const taskMatch = /^\/api\/tasks\/([A-Za-z0-9_-]{1,80})$/.exec(url.pathname);
      if (taskMatch && request.method === 'PATCH') {
        if (foreignOrigin(request, boundPort)) return error(response, 403, 'foreign origins are not allowed');
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) return error(response, 415, 'Content-Type must be application/json');
        const task = await store.update(taskMatch[1], validateUpdate(await readJson(request)));
        if (!task) return error(response, 404, 'task not found');
        return sendJson(response, 200, task);
      }
      if (taskMatch && request.method === 'DELETE') {
        if (foreignOrigin(request, boundPort)) return error(response, 403, 'foreign origins are not allowed');
        if (!await store.delete(taskMatch[1])) return error(response, 404, 'task not found');
        response.writeHead(204, { 'cache-control': 'no-store' });
        return response.end();
      }
      if (request.method === 'POST' && url.pathname === '/api/import') {
        if (foreignOrigin(request, boundPort)) return error(response, 403, 'foreign origins are not allowed');
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) return error(response, 415, 'Content-Type must be application/json');
        const tasks = validateImportSnapshot(await readJson(request));
        return sendJson(response, 200, await store.replaceTasks(tasks));
      }
      if (request.method === 'GET' && STATIC_FILES.has(url.pathname)) return sendStatic(response, STATIC_FILES.get(url.pathname));
      return error(response, 404, 'not found');
    } catch (cause) {
      if (cause?.status) return error(response, cause.status, cause.message);
      if (cause instanceof SyntaxError || cause?.message?.startsWith('title') || cause?.message?.startsWith('notes') || cause?.message?.startsWith('status') || cause?.message?.startsWith('priority') || cause?.message?.startsWith('update') || cause?.message?.startsWith('import') || cause?.message?.startsWith('persisted task') || cause?.message?.includes('unknown') || cause?.message?.includes('JSON object')) return error(response, 400, cause.message);
      error(response, 500, 'unable to save board');
    }
  });
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(async () => {
      try { await store.settle(); process.exitCode = 0; }
      catch { process.exitCode = 1; }
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  await new Promise((resolveListening, rejectListening) => {
    server.once('error', rejectListening);
    server.listen({ host: '127.0.0.1', port }, () => {
      server.off('error', rejectListening);
      resolveListening();
    });
  });
  const address = server.address();
  boundPort = address.port;
  process.stdout.write(`${JSON.stringify({ event: 'listening', url: `http://127.0.0.1:${address.port}` })}\n`);
}

main().catch((cause) => { process.stderr.write(`${cause.message}\n`); process.exitCode = 1; });
