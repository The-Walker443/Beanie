import {
  DEFAULT_DESCALE_INTERVAL,
  DESCALE_HISTORY_LIMIT,
  IDLE_DESCALE_TRACKER,
  descaleDue,
  descaleDueAt,
  descaleStatus,
  readDescaleInterval,
  readDescaleState,
  recordDescale,
  trackDescaleCycle,
  writeDescaleInterval,
  writeDescaleState,
  type DescaleState
} from '../domain/forkDescale';
import { descaleIntervalKey, descaleStateKey } from '../domain/forkSettingsKeys';
import { SYNCED_SETTING_KEYS, setSyncedItem } from '../domain/settingsStore';

const none: DescaleState = { lastDescaledAt: null, history: [] };
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const descaledOn = (date: Date): DescaleState => ({
  lastDescaledAt: date.toISOString(),
  history: [{ at: date.toISOString(), source: 'manual' }]
});

run('the next descale is due whole calendar months later, clamped to short months', () => {
  equal(descaleDueAt(local(2026, 3, 15).toISOString(), 12)?.toDateString(), local(2027, 3, 15).toDateString());
  equal(descaleDueAt(local(2026, 1, 31).toISOString(), 1)?.toDateString(), local(2026, 2, 28).toDateString());
  equal(descaleDueAt(local(2026, 8, 31).toISOString(), 6)?.toDateString(), local(2027, 2, 28).toDateString());
  equal(descaleDueAt(null, 12), null);
  equal(descaleDueAt(local(2026, 3, 15).toISOString(), 0), null);
  equal(descaleDueAt('not a date', 12), null);
});

run('descale status walks from ok through soon to due', () => {
  const state = descaledOn(local(2026, 1, 10));
  const ok = descaleStatus(state, 6, local(2026, 6, 1));
  equal(ok.kind, 'ok');
  equal(ok.kind === 'ok' ? ok.daysLeft : -1, 39);

  const soon = descaleStatus(state, 6, local(2026, 6, 26));
  equal(soon.kind, 'soon');
  equal(soon.kind === 'soon' ? soon.daysLeft : -1, 14);

  const today = descaleStatus(state, 6, local(2026, 7, 10, 8));
  equal(today.kind, 'due');
  equal(today.kind === 'due' ? today.daysOverdue : -1, 0);

  const overdue = descaleStatus(state, 6, local(2026, 7, 15));
  equal(overdue.kind === 'due' ? overdue.daysOverdue : -1, 5);
});

run('descale status is off without an interval and never nags without a recorded date', () => {
  equal(descaleStatus(descaledOn(local(2020, 1, 1)), 0, local(2026, 10, 18)).kind, 'off');
  equal(descaleStatus(none, 12, local(2026, 10, 18)).kind, 'unknown');
  equal(descaleDue(none, 12, local(2026, 10, 18)), false);
  equal(descaleDue(descaledOn(local(2025, 10, 1)), 12, local(2026, 10, 18)), true);
  equal(descaleDue(descaledOn(local(2025, 10, 1)), 0, local(2026, 10, 18)), false);
});

run('recording a descale sets the date, keeps one entry per day, and caps the history', () => {
  const first = recordDescale(none, local(2026, 10, 18, 9).toISOString(), 'machine');
  equal(first.lastDescaledAt, local(2026, 10, 18, 9).toISOString());
  equal(first.history.length, 1);

  const sameDay = recordDescale(first, local(2026, 10, 18, 9, 30).toISOString(), 'wizard');
  equal(sameDay.history.length, 1);
  equal(sameDay.history[0]?.source, 'wizard');
  equal(sameDay.lastDescaledAt, local(2026, 10, 18, 9, 30).toISOString());

  const corrected = recordDescale(sameDay, local(2026, 10, 3).toISOString(), 'manual');
  equal(corrected.lastDescaledAt, local(2026, 10, 3).toISOString());
  equal(corrected.history.length, 2);

  let many = none;
  for (let day = 1; day <= 15; day++) many = recordDescale(many, local(2026, 1, day).toISOString(), 'manual');
  equal(many.history.length, DESCALE_HISTORY_LIMIT);
  equal(many.history[0]?.at, local(2026, 1, 15).toISOString());

  equal(recordDescale(first, 'garbage', 'manual'), first);
});

run('a descaling run counts only when the machine leaves it after a full cycle', () => {
  const t0 = 1_000_000;
  let step = trackDescaleCycle(IDLE_DESCALE_TRACKER, 'descaling', t0);
  equal(step.tracker.startedAt, t0);
  step = trackDescaleCycle(step.tracker, 'descaling', t0 + 60_000);
  equal(step.tracker.startedAt, t0);
  step = trackDescaleCycle(step.tracker, null, t0 + 120_000);
  equal(step.tracker.startedAt, t0);
  equal(step.completedAt, null);

  const done = trackDescaleCycle(step.tracker, 'idle', t0 + 6 * 60_000);
  equal(done.completedAt, t0 + 6 * 60_000);
  equal(done.aborted, false);
  equal(done.tracker.startedAt, null);

  const short = trackDescaleCycle({ startedAt: t0 }, 'idle', t0 + 60_000);
  equal(short.completedAt, null);
  equal(short.aborted, true);

  const failed = trackDescaleCycle({ startedAt: t0 }, 'error', t0 + 6 * 60_000);
  equal(failed.completedAt, null);
  equal(failed.aborted, true);

  const empty = trackDescaleCycle({ startedAt: t0 }, 'needsWater', t0 + 5 * 60_000);
  equal(empty.completedAt, t0 + 5 * 60_000);

  const unrelated = trackDescaleCycle(IDLE_DESCALE_TRACKER, 'idle', t0);
  equal(unrelated.completedAt, null);
  equal(unrelated.aborted, false);
});

run('descale settings are synced store keys that survive a round trip', () => {
  equal(SYNCED_SETTING_KEYS.includes(descaleStateKey), true);
  equal(SYNCED_SETTING_KEYS.includes(descaleIntervalKey), true);

  equal(readDescaleInterval(), DEFAULT_DESCALE_INTERVAL);
  writeDescaleInterval(6);
  equal(readDescaleInterval(), 6);
  setSyncedItem(descaleIntervalKey, 'junk');
  equal(readDescaleInterval(), DEFAULT_DESCALE_INTERVAL);

  equal(readDescaleState().lastDescaledAt, null);
  const state = recordDescale(none, local(2026, 10, 18).toISOString(), 'manual');
  writeDescaleState(state);
  equal(readDescaleState().lastDescaledAt, state.lastDescaledAt);
  equal(readDescaleState().history.length, 1);

  setSyncedItem(descaleStateKey, JSON.stringify({ lastDescaledAt: 'nope', history: [{ at: 'x', source: 'manual' }, 5] }));
  equal(readDescaleState().lastDescaledAt, null);
  equal(readDescaleState().history.length, 0);
  setSyncedItem(descaleStateKey, '{broken');
  equal(readDescaleState().lastDescaledAt, null);
});

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}
