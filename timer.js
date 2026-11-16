/** Deadline-based timer and local-date statistics. All public actions mutate state. */
const MODES = new Set(['focus', 'short', 'long']);
const DEFAULT_MINUTES = { focus: 25, short: 5, long: 15 };
let fallbackId = 0;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clock = value => Math.max(0, finite(value, Date.now()));
const cycleLength = state => Math.max(1, Math.floor(finite(state.settings?.longEvery, 4)));
const timerOf = state => {
  if (!state || !state.timer) throw new TypeError('缺少计时器状态');
  return state.timer;
};
const touch = (state, now) => { state.updatedAt = Math.max(finite(state.updatedAt), now); };
const sessionId = () => globalThis.crypto?.randomUUID?.() || `session-${Date.now().toString(36)}-${(++fallbackId).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function durationFor(state, mode) {
  if (!MODES.has(mode)) throw new RangeError('未知计时模式');
  const minutes = finite(state.settings?.[mode], DEFAULT_MINUTES[mode]);
  return Math.max(1000, Math.round((minutes > 0 ? minutes : DEFAULT_MINUTES[mode]) * 60_000));
}

/** Reads remaining milliseconds without creating a record or modifying state. */
export function remaining(state, now = Date.now()) {
  const timer = timerOf(state);
  const duration = Math.max(0, finite(timer.durationMs, durationFor(state, timer.mode)));
  const stored = Math.min(duration, Math.max(0, finite(timer.remainingMs, duration)));
  if (timer.status !== 'running') return stored;
  return Math.min(stored, Math.max(0, finite(timer.endAt, clock(now)) - clock(now)));
}

function idleTimer(state, mode, cycle) {
  const durationMs = durationFor(state, mode);
  return {
    mode, status: 'idle', durationMs, remainingMs: durationMs,
    endAt: null, runSince: null, boundTaskId: null,
    boundTaskTitle: '自由专注', sessionId: null, sessionStart: null,
    cycle: Math.max(0, Math.floor(finite(cycle))), accruedMs: 0,
  };
}

function alreadyCompleted(state, id) {
  return Boolean(id && (state.records || []).some(record => record.sessionId === id && record.completed));
}

/** Records only an actual running focus interval; intervals end at the deadline. */
function recordSegment(state, at, completed) {
  const timer = timerOf(state);
  if (timer.mode !== 'focus' || !timer.sessionId) return;
  const runSince = finite(timer.runSince, at);
  const deadline = finite(timer.endAt, at);
  const end = Math.max(runSince, Math.min(at, deadline));
  const start = runSince;
  const focusMs = Math.max(0, end - start);
  if (!focusMs && !completed) return;
  state.records ||= [];
  const id = `${timer.sessionId}:${start}:${end}:${completed ? 'complete' : 'segment'}`;
  if (state.records.some(record => record.id === id)) return;
  state.records.push({
    id, sessionId: timer.sessionId, taskId: timer.boundTaskId || null,
    taskTitle: timer.boundTaskTitle || '自由专注', start, end, focusMs,
    completed: Boolean(completed),
  });
  timer.accruedMs = Math.max(0, finite(timer.accruedMs)) + focusMs;
}

export function startTimer(state, now = Date.now()) {
  now = clock(now);
  const timer = timerOf(state);
  if (timer.status === 'running') return null;
  const resume = timer.status === 'paused' && Boolean(timer.sessionId);
  if (!resume) {
    // New durations are picked up when a fresh round begins, never mid-round.
    timer.durationMs = durationFor(state, timer.mode);
    timer.remainingMs = timer.durationMs;
    timer.sessionId = sessionId();
    timer.sessionStart = now;
    timer.accruedMs = 0;
    const task = timer.mode === 'focus'
      ? (state.tasks || []).find(item => item.id === state.selectedTaskId)
      : null;
    timer.boundTaskId = task?.id || null;
    timer.boundTaskTitle = task?.title || '自由专注';
  }
  const milliseconds = Math.max(0, finite(timer.remainingMs, timer.durationMs));
  timer.status = 'running';
  timer.runSince = now;
  timer.endAt = now + milliseconds;
  touch(state, now);
  if (milliseconds === 0) return tickTimer(state, now, { restoring: true });
  return null;
}

export function pauseTimer(state, now = Date.now()) {
  now = clock(now);
  const timer = timerOf(state);
  if (timer.status !== 'running') return null;
  // A click at/after the deadline still counts a naturally finished round.
  if (now >= finite(timer.endAt, now)) return tickTimer(state, now, { restoring: true });
  const milliseconds = remaining(state, now);
  recordSegment(state, now, false);
  timer.remainingMs = milliseconds;
  timer.status = 'paused';
  timer.endAt = null;
  timer.runSince = null;
  touch(state, now);
  return null;
}

export function resetTimer(state, now = Date.now()) {
  now = clock(now);
  const event = pauseTimer(state, now);
  const timer = timerOf(state);
  state.timer = idleTimer(state, timer.mode, timer.cycle);
  touch(state, now);
  return event;
}

export function switchMode(state, mode, now = Date.now()) {
  if (!MODES.has(mode)) throw new RangeError('未知计时模式');
  now = clock(now);
  const event = pauseTimer(state, now);
  const timer = timerOf(state);
  // Skipping an earned long break starts a new set, just as finishing it does.
  const cycle = timer.mode === 'long' && mode !== 'long' && timer.cycle >= cycleLength(state)
    ? 0 : timer.cycle;
  state.timer = idleTimer(state, mode, cycle);
  touch(state, now);
  return event;
}

/** At most one round is completed per call. Background delays never invent rounds. */
export function tickTimer(state, now = Date.now(), { restoring = false } = {}) {
  now = clock(now);
  const timer = timerOf(state);
  if (timer.status !== 'running') return null;
  timer.remainingMs = remaining(state, now);
  if (now < finite(timer.endAt, now)) return null;

  const completedMode = timer.mode;
  const id = timer.sessionId;
  const duplicate = completedMode === 'focus' && alreadyCompleted(state, id);
  if (!duplicate) recordSegment(state, finite(timer.endAt, now), true);

  let cycle = Math.max(0, Math.floor(finite(timer.cycle)));
  let nextMode;
  if (completedMode === 'focus') {
    // A merged backup may already contain this session's completed record while
    // the current device still has its pre-completion timer. Advance that timer
    // once; replacing it below makes subsequent ticks idempotent.
    cycle = (cycle % cycleLength(state)) + 1;
    nextMode = cycle >= cycleLength(state) ? 'long' : 'short';
  } else {
    nextMode = 'focus';
    if (completedMode === 'long') cycle = 0;
  }
  state.timer = idleTimer(state, nextMode, cycle);
  touch(state, now);
  const autoStart = nextMode === 'focus' ? state.settings?.autoFocus : state.settings?.autoBreak;
  if (autoStart && !restoring) startTimer(state, now);
  return { completedMode, nextMode, sessionId: id };
}

/** Refresh/reopen: retain a live deadline, or settle this round and wait for a click. */
export function restoreTimer(state, now = Date.now()) {
  return tickTimer(state, clock(now), { restoring: true });
}

function addInterval(groups, key, start, end, dayStart, dayEnd) {
  const lo = Math.max(start, dayStart);
  const hi = Math.min(end, dayEnd);
  if (hi <= lo) return;
  const list = groups.get(key) || [];
  list.push([lo, hi]);
  groups.set(key, list);
}

/** Today's actual focus time, including a live unsaved segment. Local calendar dates. */
export function dailyStats(state, now = Date.now()) {
  now = clock(now);
  const current = new Date(now);
  const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
  const dayEnd = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1).getTime();
  const groups = new Map();
  const completed = new Set();
  for (const record of state.records || []) {
    const start = finite(record.start);
    const end = Math.max(start, finite(record.end, start));
    const key = record.sessionId || record.id;
    // Imported snapshots of the same live segment can overlap; count their union.
    if (finite(record.focusMs) > 0) {
      const focusedEnd = Math.min(end, start + Math.max(0, finite(record.focusMs)));
      addInterval(groups, key, start, focusedEnd, dayStart, dayEnd);
    }
    if (record.completed && end >= dayStart && end < dayEnd) completed.add(key);
  }
  const timer = state.timer;
  if (timer?.mode === 'focus' && timer.status === 'running' && timer.sessionId) {
    const start = finite(timer.runSince, now);
    const end = Math.max(start, Math.min(now, finite(timer.endAt, now)));
    addInterval(groups, timer.sessionId, start, end, dayStart, dayEnd);
  }
  let focusMs = 0;
  for (const intervals of groups.values()) {
    intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let start = null;
    let end = null;
    for (const [lo, hi] of intervals) {
      if (start === null) { start = lo; end = hi; }
      else if (lo <= end) end = Math.max(end, hi);
      else { focusMs += end - start; start = lo; end = hi; }
    }
    if (start !== null) focusMs += end - start;
  }
  return { focusMs, pomodoros: completed.size };
}
