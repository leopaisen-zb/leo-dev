import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const TASK_KEYS = ['createdAt', 'id', 'notes', 'priority', 'status', 'title', 'updatedAt'];
const ACTIVITY_ACTIONS = new Set(['create', 'update', 'delete', 'import']);
const STATUSES = new Set(['todo', 'doing', 'done']);
const PRIORITIES = new Set(['low', 'normal', 'high']);

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys) {
  return plainObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, sign, offsetHourText, offsetMinuteText] = parts;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && hour <= 23 && minute <= 59 && second <= 59
    && (!sign || (offsetHour <= 23 && offsetMinute <= 59));
}

export function validateTask(task) {
  if (!exactKeys(task, TASK_KEYS)) throw new Error('persisted task has an invalid shape');
  if (typeof task.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(task.id)) throw new Error('persisted task has an invalid id');
  if (typeof task.title !== 'string' || task.title.trim().length < 1 || task.title.trim().length > 120) throw new Error('persisted task has an invalid title');
  if (typeof task.notes !== 'string' || task.notes.length > 2000) throw new Error('persisted task has invalid notes');
  if (!STATUSES.has(task.status) || !PRIORITIES.has(task.priority)) throw new Error('persisted task has an invalid enum');
  if (!validTimestamp(task.createdAt) || !validTimestamp(task.updatedAt) || Date.parse(task.createdAt) > Date.parse(task.updatedAt)) throw new Error('persisted task has invalid timestamps');
}

export function validateImportSnapshot(snapshot) {
  if (!exactKeys(snapshot, ['schemaVersion', 'tasks']) || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.tasks)) {
    throw new Error('import snapshot must contain schemaVersion 1 and tasks');
  }
  if (snapshot.tasks.length > 500) throw new Error('import snapshot has too many tasks');
  const ids = new Set();
  for (const task of snapshot.tasks) {
    validateTask(task);
    if (ids.has(task.id)) throw new Error('import snapshot has duplicate task ids');
    ids.add(task.id);
  }
  return copy(snapshot.tasks);
}

function validateActivity(item) {
  if (!plainObject(item) || typeof item.id !== 'string' || item.id.length === 0 || !validTimestamp(item.timestamp) || !ACTIVITY_ACTIONS.has(item.action)) {
    throw new Error('persisted activity is invalid');
  }
  if (item.action === 'import') return;
  if (typeof item.taskId !== 'string' || typeof item.title !== 'string' || item.title.length === 0) throw new Error('persisted activity is invalid');
}

function validateBoard(board) {
  if (!exactKeys(board, ['schemaVersion', 'tasks', 'activity']) || board.schemaVersion !== 1 || !Array.isArray(board.tasks) || !Array.isArray(board.activity)) {
    throw new Error('persisted board is invalid');
  }
  const ids = new Set();
  for (const task of board.tasks) {
    validateTask(task);
    if (ids.has(task.id)) throw new Error('persisted board has duplicate task ids');
    ids.add(task.id);
  }
  if (board.activity.length > 100) throw new Error('persisted board has too much activity');
  const activityIds = new Set();
  for (const item of board.activity) {
    validateActivity(item);
    if (activityIds.has(item.id)) throw new Error('persisted board has duplicate activity ids');
    activityIds.add(item.id);
  }
}

function copy(value) {
  return structuredClone(value);
}

export class BoardStore {
  #dataFile;
  #board;
  #tail = Promise.resolve();

  constructor(dataFile, board) {
    this.#dataFile = dataFile;
    this.#board = board;
  }

  static async open(dataFile) {
    let board = { schemaVersion: 1, tasks: [], activity: [] };
    try {
      board = JSON.parse(await readFile(dataFile, 'utf8'));
      validateBoard(board);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new Error(`Unable to load board data: ${error.message}`);
    }
    return new BoardStore(dataFile, board);
  }

  snapshot() {
    return copy(this.#board);
  }

  create(input) {
    return this.#enqueue(async () => {
      const now = new Date().toISOString();
      const task = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
      const next = copy(this.#board);
      next.tasks.push(task);
      next.activity.push({ id: randomUUID(), timestamp: now, action: 'create', taskId: task.id, title: task.title });
      next.activity = next.activity.slice(-100);
      await this.#persist(next);
      this.#board = next;
      return copy(task);
    });
  }

  update(id, changes) {
    return this.#enqueue(async () => {
      const position = this.#board.tasks.findIndex((task) => task.id === id);
      if (position === -1) return undefined;
      const now = new Date().toISOString();
      const next = copy(this.#board);
      const previous = next.tasks[position];
      // Imported timestamps can be ahead of the local clock; retain their valid representation.
      const updatedAt = Date.parse(now) >= Date.parse(previous.updatedAt) ? now : previous.updatedAt;
      const task = { ...previous, ...changes, updatedAt };
      next.tasks[position] = task;
      next.activity.push({ id: randomUUID(), timestamp: now, action: 'update', taskId: task.id, title: task.title });
      next.activity = next.activity.slice(-100);
      await this.#persist(next);
      this.#board = next;
      return copy(task);
    });
  }

  delete(id) {
    return this.#enqueue(async () => {
      const position = this.#board.tasks.findIndex((task) => task.id === id);
      if (position === -1) return false;
      const now = new Date().toISOString();
      const next = copy(this.#board);
      const [task] = next.tasks.splice(position, 1);
      next.activity.push({ id: randomUUID(), timestamp: now, action: 'delete', taskId: task.id, title: task.title });
      next.activity = next.activity.slice(-100);
      await this.#persist(next);
      this.#board = next;
      return true;
    });
  }

  replaceTasks(tasks) {
    return this.#enqueue(async () => {
      const next = copy(this.#board);
      next.tasks = copy(tasks);
      const now = new Date().toISOString();
      next.activity.push({ id: randomUUID(), timestamp: now, action: 'import', count: next.tasks.length });
      next.activity = next.activity.slice(-100);
      await this.#persist(next);
      this.#board = next;
      return copy(next);
    });
  }

  settle() {
    return this.#tail;
  }

  #enqueue(operation) {
    const result = this.#tail.then(operation);
    this.#tail = result.catch(() => {});
    return result;
  }

  async #persist(board) {
    validateBoard(board);
    const directory = dirname(this.#dataFile);
    await mkdir(directory, { recursive: true });
    const temporary = join(directory, `.${basename(this.#dataFile)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify(board)}\n`, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, this.#dataFile);
    } catch (error) {
      try { await import('node:fs/promises').then(({ unlink }) => unlink(temporary)); } catch {}
      throw error;
    }
  }
}
