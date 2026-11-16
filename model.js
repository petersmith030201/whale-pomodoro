import { pauseTimer } from './timer.js';

/** Flat, unbounded-depth task tree and versioned local backup format. */
export const DEFAULT_SETTINGS = Object.freeze({
  focus: 25, short: 5, long: 15, longEvery: 4,
  autoBreak: false, autoFocus: false, sound: true, volume: 0.35,
  notify: false, reducedMotion: false, bubbles: true,
});
let idCounter = 0;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const error = message => { throw new Error(message); };
const object = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) error(`${label}必须是对象`);
  return value;
};
const number = (value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) error(`${label}不是有效数字`);
  return value;
};
const integer = (value, label, minimum = 0) => {
  number(value, label, minimum);
  if (!Number.isSafeInteger(value)) error(`${label}必须是整数`);
  return value;
};
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) error(`${label}不能为空`);
  return value.trim();
};
const boolean = (value, label) => {
  if (typeof value !== 'boolean') error(`${label}必须为真或假`);
  return value;
};
const optionalId = (value, label) => value === null ? null : text(value, label);
const nullableTime = (value, label) => value === null ? null : number(value, label);
const freshId = () => globalThis.crypto?.randomUUID?.()
  || `task-${Date.now().toString(36)}-${(++idCounter).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const touch = state => {
  state.updatedAt = Math.max(state.updatedAt || 0, Date.now());
  return state.updatedAt;
};

export function createState(now = Date.now()) {
  now = number(now, '创建时间');
  return {
    version: 1, updatedAt: now, settings: { ...DEFAULT_SETTINGS }, tasks: [], records: [],
    selectedTaskId: null,
    timer: {
      mode: 'focus', status: 'idle', durationMs: 1_500_000, remainingMs: 1_500_000,
      endAt: null, runSince: null, boundTaskId: null, boundTaskTitle: '自由专注',
      sessionId: null, sessionStart: null, cycle: 0, accruedMs: 0,
    },
  };
}

function treeIndex(tasks, validate = false) {
  const byId = new Map();
  const children = new Map([[null, []]]);
  for (const task of tasks) {
    if (byId.has(task.id)) error('任务 ID 重复');
    byId.set(task.id, task);
    if (!children.has(task.parentId)) children.set(task.parentId, []);
    children.get(task.parentId).push(task);
    if (!children.has(task.id)) children.set(task.id, []);
  }
  if (validate) {
    for (const task of tasks) {
      if (task.parentId !== null && !byId.has(task.parentId)) error('存在找不到父级的任务');
      if (task.parentId === task.id) error('任务不能成为自己的父级');
    }
  }
  const ordered = [...(children.get(null) || [])];
  for (let i = 0; i < ordered.length; i++) {
    for (const child of children.get(ordered[i].id) || []) ordered.push(child);
  }
  if (validate && ordered.length !== tasks.length) error('任务父子关系存在循环');
  return { byId, children, ordered };
}

function reconcileParents(state, markUpdated = false) {
  const { children, ordered } = treeIndex(state.tasks, true);
  const now = state.updatedAt;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const task = ordered[i];
    const list = children.get(task.id);
    if (!list?.length) continue;
    const completed = list.every(child => child.completed);
    if (task.completed !== completed) {
      task.completed = completed;
      if (markUpdated) task.updatedAt = now;
    }
  }
}

function findTask(state, id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) error('找不到这个任务');
  return task;
}

export function descendants(state, id) {
  const { byId, children } = treeIndex(state.tasks, true);
  if (!byId.has(id)) return new Set();
  const result = new Set([id]);
  const queue = [id];
  for (let i = 0; i < queue.length; i++) {
    for (const child of children.get(queue[i]) || []) {
      if (!result.has(child.id)) { result.add(child.id); queue.push(child.id); }
    }
  }
  return result;
}

export function addTask(state, title, parentId = null, estimate = 0) {
  title = text(title, '任务名称');
  estimate = integer(estimate, '预计番茄数');
  if (parentId !== null) findTask(state, parentId);
  let id = freshId();
  const ids = new Set(state.tasks.map(task => task.id));
  while (ids.has(id)) id = freshId();
  const now = touch(state);
  let order = 0;
  for (const task of state.tasks) if (task.parentId === parentId) order = Math.max(order, task.order + 1);
  const task = { id, parentId, title, estimate, completed: false, collapsed: false, order, createdAt: now, updatedAt: now };
  state.tasks.push(task);
  reconcileParents(state, true);
  return task;
}

export function updateTask(state, id, patch) {
  object(patch, '任务修改');
  const task = findTask(state, id);
  const values = {};
  if (own(patch, 'title')) values.title = text(patch.title, '任务名称');
  if (own(patch, 'estimate')) values.estimate = integer(patch.estimate, '预计番茄数');
  if (own(patch, 'collapsed')) values.collapsed = boolean(patch.collapsed, '折叠状态');
  if (own(patch, 'completed')) boolean(patch.completed, '完成状态');
  if (own(patch, 'parentId') || own(patch, 'order')) {
    const parentId = own(patch, 'parentId') ? patch.parentId : task.parentId;
    moveTask(state, id, parentId, patch.order);
  }
  Object.assign(task, values, { updatedAt: touch(state) });
  if (own(patch, 'completed')) toggleTask(state, id, patch.completed);
  return task;
}

export function deleteTask(state, id) {
  findTask(state, id);
  const removed = descendants(state, id);
  state.tasks = state.tasks.filter(task => !removed.has(task.id));
  if (removed.has(state.selectedTaskId)) state.selectedTaskId = null;
  // A live round and historical records retain their original task/name snapshot.
  touch(state);
  reconcileParents(state, true);
  return removed.size;
}

export function toggleTask(state, id, completed) {
  const task = findTask(state, id);
  completed = completed === undefined ? !task.completed : boolean(completed, '完成状态');
  const affected = descendants(state, id);
  const now = touch(state);
  for (const item of state.tasks) {
    if (affected.has(item.id)) { item.completed = completed; item.updatedAt = now; }
  }
  reconcileParents(state, true);
  return task;
}

const siblingSort = (a, b) => a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id);

export function moveTask(state, id, parentId, order) {
  const task = findTask(state, id);
  parentId = optionalId(parentId, '父任务 ID');
  if (parentId !== null) findTask(state, parentId);
  if (descendants(state, id).has(parentId)) error('不能将任务移到自身或自己的子任务下面');
  if (order !== undefined) integer(order, '任务位置');
  const oldParentId = task.parentId;
  const siblings = state.tasks.filter(item => item.id !== id && item.parentId === parentId).sort(siblingSort);
  const position = order === undefined ? siblings.length : Math.min(order, siblings.length);
  siblings.splice(position, 0, task);
  const now = touch(state);
  task.parentId = parentId;
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].order !== i || siblings[i].id === id) siblings[i].updatedAt = now;
    siblings[i].order = i;
  }
  if (oldParentId !== parentId) {
    const former = state.tasks.filter(item => item.parentId === oldParentId).sort(siblingSort);
    former.forEach((item, i) => { item.order = i; item.updatedAt = now; });
  }
  reconcileParents(state, true);
  return task;
}

/** Union intervals by session: repeated live backup snapshots never double-count focus. */
export function focusIntervals(records) {
  const groups = new Map();
  for (const record of records) {
    if (!(record.focusMs > 0)) continue;
    const list = groups.get(record.sessionId) || [];
    list.push([record.start, Math.min(record.end, record.start + record.focusMs)]);
    groups.set(record.sessionId, list);
  }
  const result = [];
  for (const [sessionId, list] of groups) {
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let active = null;
    for (const [start, end] of list) {
      if (!active) active = [start, end];
      else if (start <= active[1]) active[1] = Math.max(active[1], end);
      else { result.push({ sessionId, start: active[0], end: active[1] }); active = [start, end]; }
    }
    if (active) result.push({ sessionId, start: active[0], end: active[1] });
  }
  return result;
}

export function aggregates(state, id = null) {
  const scope = id === null ? null : descendants(state, id);
  const tasks = scope ? state.tasks.filter(task => scope.has(task.id)) : state.tasks;
  const records = scope ? state.records.filter(record => scope.has(record.taskId)) : state.records;
  let focusMs = 0;
  for (const interval of focusIntervals(records)) focusMs += interval.end - interval.start;
  const completed = new Set(records.filter(record => record.completed).map(record => record.sessionId));
  const { children, ordered } = treeIndex(state.tasks, true);
  const budgets = new Map();
  for (let i = ordered.length - 1; i >= 0; i--) {
    const task = ordered[i];
    let sum = 0;
    for (const child of children.get(task.id) || []) sum += budgets.get(child.id) || 0;
    budgets.set(task.id, task.estimate > 0 ? task.estimate : sum);
  }
  let estimate = 0;
  if (id !== null) estimate = budgets.get(id) || 0;
  else for (const task of children.get(null) || []) estimate += budgets.get(task.id) || 0;
  return { focusMs, pomodoros: completed.size, done: tasks.filter(task => task.completed).length, total: tasks.length, estimate };
}

function normalizeSettings(raw) {
  object(raw, '设置');
  const settings = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const value = own(raw, key) ? raw[key] : fallback;
    if (typeof fallback === 'boolean') settings[key] = boolean(value, `设置 ${key}`);
    else if (key === 'volume') settings[key] = number(value, '提示音音量', 0, 1);
    else if (key === 'longEvery') settings[key] = integer(value, '长休息间隔', 1);
    else settings[key] = number(value, `设置 ${key}`, Number.MIN_VALUE, Number.MAX_SAFE_INTEGER / 60_000);
  }
  return settings;
}

function normalizeTask(raw) {
  object(raw, '任务');
  return {
    id: text(raw.id, '任务 ID'), parentId: optionalId(raw.parentId, '父任务 ID'),
    title: text(raw.title, '任务名称'), estimate: integer(raw.estimate, '预计番茄数'),
    completed: boolean(raw.completed, '任务完成状态'), collapsed: boolean(raw.collapsed, '任务折叠状态'),
    order: number(raw.order, '任务排序'), createdAt: number(raw.createdAt, '任务创建时间'),
    updatedAt: number(raw.updatedAt, '任务修改时间'),
  };
}

function normalizeRecord(raw) {
  object(raw, '专注记录');
  const record = {
    id: text(raw.id, '记录 ID'), sessionId: text(raw.sessionId, '轮次 ID'),
    taskId: optionalId(raw.taskId, '记录任务 ID'), taskTitle: text(raw.taskTitle, '记录任务名称'),
    start: number(raw.start, '专注开始时间'), end: number(raw.end, '专注结束时间'),
    focusMs: number(raw.focusMs, '实际专注时长'), completed: boolean(raw.completed, '番茄完成状态'),
  };
  if (record.end < record.start || record.focusMs > record.end - record.start + 1) error('专注记录的时间范围不一致');
  return record;
}

function normalizeTimer(raw) {
  object(raw, '计时器');
  if (!['focus', 'short', 'long'].includes(raw.mode)) error('未知计时模式');
  if (!['idle', 'running', 'paused'].includes(raw.status)) error('未知计时状态');
  const timer = {
    mode: raw.mode, status: raw.status, durationMs: number(raw.durationMs, '本轮时长', Number.MIN_VALUE),
    remainingMs: number(raw.remainingMs, '剩余时长'), endAt: nullableTime(raw.endAt, '结束时间'),
    runSince: nullableTime(raw.runSince, '运行开始时间'), boundTaskId: optionalId(raw.boundTaskId, '绑定任务 ID'),
    boundTaskTitle: text(raw.boundTaskTitle, '绑定任务名称'), sessionId: optionalId(raw.sessionId, '本轮 ID'),
    sessionStart: nullableTime(raw.sessionStart, '本轮开始时间'), cycle: integer(raw.cycle, '当前轮次'),
    accruedMs: number(raw.accruedMs, '本轮累计时间'),
  };
  if (timer.remainingMs > timer.durationMs) error('剩余时长不能大于本轮时长');
  if (timer.status === 'running') {
    if (timer.endAt === null || timer.runSince === null || timer.sessionStart === null || !timer.sessionId || timer.endAt < timer.runSince) error('运行中的计时器缺少有效时间信息');
  } else if (timer.endAt !== null || timer.runSince !== null) error('暂停或待机计时器不能包含运行截止时间');
  if (timer.status === 'paused' && (!timer.sessionId || timer.sessionStart === null)) error('暂停计时器缺少本轮信息');
  return timer;
}

function normalizeState(raw) {
  object(raw, '数据');
  if (raw.version !== 1) error('不支持此版本的数据，请使用对应版本的应用');
  if (!Array.isArray(raw.tasks) || !Array.isArray(raw.records)) error('任务和记录必须为列表');
  const state = {
    version: 1, updatedAt: number(raw.updatedAt, '数据修改时间'), settings: normalizeSettings(raw.settings),
    tasks: raw.tasks.map(normalizeTask), records: raw.records.map(normalizeRecord),
    selectedTaskId: optionalId(raw.selectedTaskId, '当前任务 ID'), timer: normalizeTimer(raw.timer),
  };
  const { byId } = treeIndex(state.tasks, true);
  if (state.selectedTaskId !== null && !byId.has(state.selectedTaskId)) error('当前选中的任务不存在');
  const recordIds = new Set();
  for (const record of state.records) {
    if (recordIds.has(record.id)) error('专注记录 ID 重复');
    recordIds.add(record.id);
  }
  reconcileParents(state);
  return state;
}

/** Missing local cache is normal; malformed cached data throws for the UI to report. */
export function loadState(raw) {
  if (raw === null || raw === undefined) return createState();
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { error('本地保存的数据不是有效 JSON'); }
  }
  return normalizeState(raw);
}

/** Export freezes a COPY at the export time; the actual running timer is untouched. */
export function exportBackup(state, now = Date.now()) {
  now = number(now, '导出时间');
  const snapshot = normalizeState(state);
  pauseTimer(snapshot, now);
  snapshot.updatedAt = Math.max(snapshot.updatedAt, now);
  return JSON.stringify({ format: 'whale-pomodoro', version: 1, exportedAt: now, data: snapshot }, null, 2);
}

export function parseBackup(source) {
  if (typeof source !== 'string') error('请选择 JSON 备份文件');
  let backup;
  try { backup = JSON.parse(source); } catch { error('文件不是有效的 JSON 备份'); }
  object(backup, '备份');
  if (backup.format !== 'whale-pomodoro') error('这不是肥鱼专注屋的备份文件');
  if (backup.version !== 1) error('不支持此备份版本');
  number(backup.exportedAt, '备份导出时间');
  const state = normalizeState(backup.data);
  // A version-1 file from an older exporter may still contain a live timer.
  // Freeze it at the FILE's timestamp, never at import time days later.
  if (state.timer.status === 'running') pauseTimer(state, backup.exportedAt);
  return state;
}

/** Returns a validated independent state; current settings, selection and timer win. */
export function mergeBackup(current, incoming) {
  const result = normalizeState(current);
  const source = normalizeState(incoming);
  const tasks = new Map(result.tasks.map(task => [task.id, task]));
  for (const task of source.tasks) {
    const old = tasks.get(task.id);
    if (!old || task.updatedAt > old.updatedAt) tasks.set(task.id, { ...task });
  }
  result.tasks = [...tasks.values()];
  const records = new Map(result.records.map(record => [record.id, record]));
  for (const record of source.records) {
    const old = records.get(record.id);
    if (old && JSON.stringify(old) !== JSON.stringify(record)) error('相同记录 ID 对应不同内容，无法安全合并');
    if (!old) records.set(record.id, { ...record });
  }
  result.records = [...records.values()].sort((a, b) => a.end - b.end || a.id.localeCompare(b.id));
  result.updatedAt = Math.max(result.updatedAt, source.updatedAt, Date.now());
  try { return normalizeState(result); }
  catch (cause) { error(`合并后的数据无效：${cause.message}。可检查备份，或选择替换导入。`); }
}
