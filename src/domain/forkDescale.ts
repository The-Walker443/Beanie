// Fork customization A3 (FORK.md, docs/fork-descale-plan.md): a descaling
// reminder. Descaling is time-driven (Decent: soft water every one to two
// years), so the reminder counts calendar months since the last recorded
// descale instead of shots.
//
// The pure helpers are unit-tested; the read*/write* wrappers persist through
// the synced gateway store like domain/cleaning.ts does.

import { descaleIntervalKey, descaleStateKey } from './forkSettingsKeys';
import { getSyncedItem, setSyncedItem } from './settingsStore';

/** Reminder interval options in months. 0 = reminder off. */
export const DESCALE_INTERVAL_OPTIONS = [0, 3, 6, 12, 24] as const;
export const DEFAULT_DESCALE_INTERVAL = 12;
/** A descale this many days ahead of its due date reads as "due soon". */
export const DESCALE_SOON_DAYS = 14;
/** A descaling run shorter than this was aborted, not a descale (one cycle is ~6 min). */
export const DESCALE_MIN_CYCLE_MS = 3 * 60_000;
export const DESCALE_HISTORY_LIMIT = 10;

export type DescaleSource = 'machine' | 'manual' | 'wizard';

export interface DescaleEntry {
  at: string;
  source: DescaleSource;
}

export interface DescaleState {
  /** ISO timestamp of the last recorded descale, or null if none was recorded. */
  lastDescaledAt: string | null;
  /** Most recent records first, at most DESCALE_HISTORY_LIMIT. */
  history: DescaleEntry[];
}

export type DescaleStatus =
  | { kind: 'off' }
  | { kind: 'unknown' }
  | { kind: 'ok'; dueAt: Date; daysLeft: number }
  | { kind: 'soon'; dueAt: Date; daysLeft: number }
  | { kind: 'due'; dueAt: Date; daysOverdue: number };

const EMPTY_STATE: DescaleState = { lastDescaledAt: null, history: [] };
const DAY_MS = 86_400_000;
const SOURCES = new Set<DescaleSource>(['machine', 'manual', 'wizard']);

/** When the next descale is due: the last one plus `months` calendar months. */
export function descaleDueAt(lastIso: string | null, months: number): Date | null {
  if (!lastIso || months <= 0) return null;
  const last = new Date(lastIso);
  if (Number.isNaN(last.valueOf())) return null;
  return addCalendarMonths(last, months);
}

export function descaleStatus(state: DescaleState, intervalMonths: number, now: Date): DescaleStatus {
  if (intervalMonths <= 0) return { kind: 'off' };
  const dueAt = descaleDueAt(state.lastDescaledAt, intervalMonths);
  if (!dueAt) return { kind: 'unknown' };
  const days = calendarDaysBetween(now, dueAt);
  if (days <= 0) return { kind: 'due', dueAt, daysOverdue: -days };
  if (days <= DESCALE_SOON_DAYS) return { kind: 'soon', dueAt, daysLeft: days };
  return { kind: 'ok', dueAt, daysLeft: days };
}

/** Whether the descaling reminder is due. No recorded date never nags. */
export function descaleDue(state: DescaleState, intervalMonths: number, now: Date): boolean {
  return descaleStatus(state, intervalMonths, now).kind === 'due';
}

/**
 * Record a descale. The record becomes the last descale date, also when it is
 * older than the previous one (a manual correction). A record on the same local
 * day as the newest one replaces it, so several cycles in one session stay one
 * entry.
 */
export function recordDescale(state: DescaleState, atIso: string, source: DescaleSource): DescaleState {
  const at = new Date(atIso);
  if (Number.isNaN(at.valueOf())) return state;
  const entry: DescaleEntry = { at: at.toISOString(), source };
  const newest = state.history[0];
  const rest = newest && sameLocalDay(new Date(newest.at), at) ? state.history.slice(1) : state.history;
  return {
    lastDescaledAt: entry.at,
    history: [entry, ...rest].slice(0, DESCALE_HISTORY_LIMIT)
  };
}

// ---- machine cycle detection ------------------------------------------------

export interface DescaleCycleTracker {
  /** Epoch ms when the machine entered `descaling`, while it is still in it. */
  startedAt: number | null;
}

export const IDLE_DESCALE_TRACKER: DescaleCycleTracker = { startedAt: null };

export interface DescaleCycleStep {
  tracker: DescaleCycleTracker;
  /** Epoch ms of a descaling cycle that just completed, else null. */
  completedAt: number | null;
  /** The machine left `descaling` too early for a full cycle. */
  aborted: boolean;
}

// States the machine does not settle into after a descale: a lost connection
// (null) keeps waiting, an error or reboot is not a completed cycle.
const NOT_A_COMPLETION = new Set(['error', 'booting', 'fwUpgrade']);

/**
 * Feed every machine snapshot state. A run counts once the machine leaves
 * `descaling` after at least DESCALE_MIN_CYCLE_MS.
 */
export function trackDescaleCycle(
  tracker: DescaleCycleTracker,
  machineState: string | null | undefined,
  nowMs: number
): DescaleCycleStep {
  if (machineState === 'descaling') {
    return {
      tracker: tracker.startedAt == null ? { startedAt: nowMs } : tracker,
      completedAt: null,
      aborted: false
    };
  }
  if (tracker.startedAt == null || machineState == null) {
    return { tracker, completedAt: null, aborted: false };
  }
  const long = nowMs - tracker.startedAt >= DESCALE_MIN_CYCLE_MS;
  const completed = long && !NOT_A_COMPLETION.has(machineState);
  return { tracker: IDLE_DESCALE_TRACKER, completedAt: completed ? nowMs : null, aborted: !completed };
}

// ---- persistence -----------------------------------------------------------

export function readDescaleState(): DescaleState {
  const raw = getSyncedItem(descaleStateKey);
  if (!raw) return { ...EMPTY_STATE, history: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<DescaleState>;
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter(isDescaleEntry).slice(0, DESCALE_HISTORY_LIMIT)
      : [];
    const last = typeof parsed.lastDescaledAt === 'string' && !Number.isNaN(Date.parse(parsed.lastDescaledAt))
      ? parsed.lastDescaledAt
      : null;
    return { lastDescaledAt: last, history };
  } catch {
    return { ...EMPTY_STATE, history: [] };
  }
}

export function writeDescaleState(state: DescaleState): boolean {
  return setSyncedItem(descaleStateKey, JSON.stringify(state));
}

export function readDescaleInterval(): number {
  const raw = getSyncedItem(descaleIntervalKey);
  if (raw == null) return DEFAULT_DESCALE_INTERVAL;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_DESCALE_INTERVAL;
}

export function writeDescaleInterval(months: number): boolean {
  return setSyncedItem(descaleIntervalKey, String(Math.max(0, Math.floor(months))));
}

// ---- helpers ----------------------------------------------------------------

function isDescaleEntry(value: unknown): value is DescaleEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<DescaleEntry>;
  return typeof entry.at === 'string' && !Number.isNaN(Date.parse(entry.at)) &&
    typeof entry.source === 'string' && SOURCES.has(entry.source as DescaleSource);
}

// Calendar months, clamped to the target month's length (31 Jan + 1 → 28/29 Feb).
function addCalendarMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1, date.getHours(), date.getMinutes());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

// Whole local calendar days from `from` to `to` (negative when `to` is earlier);
// rounding absorbs the 23- and 25-hour days around daylight-saving switches.
function calendarDaysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.valueOf() - start.valueOf()) / DAY_MS);
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
