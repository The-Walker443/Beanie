// Fork customization A3 (FORK.md, docs/fork-descale-plan.md): pure state
// machine for the guided descale, following Decent's DE1 descaling
// instructions — cool the steam heater, mix a 5% citric acid solution, run the
// machine's descale cycle (up to three times), refill with fresh water, rinse
// the group until the tank runs dry, rinse the steam line with five 100 s
// steams. The machine actions run in controllers/forkDescaleFlow.ts on the
// user's tap; this module owns the step order and what the live machine state
// tells each step. It sits in domain/ so the wizard view can use its types.

import {
  IDLE_DESCALE_TRACKER,
  trackDescaleCycle,
  type DescaleCycleTracker
} from './forkDescale';

export type DescaleWizardStep =
  | 'cool-down'
  | 'solution'
  | 'descale'
  | 'refill'
  | 'rinse-group'
  | 'rinse-steam'
  | 'done';

export const DESCALE_WIZARD_STEPS: readonly DescaleWizardStep[] = [
  'cool-down',
  'solution',
  'descale',
  'refill',
  'rinse-group',
  'rinse-steam',
  'done'
];

/** Guided steps shown in the progress indicator (everything before 'done'). */
export const DESCALE_WIZARD_STEP_COUNT = DESCALE_WIZARD_STEPS.length - 1;
/** Decent: the steam heater must cool to this before descaling. */
export const DESCALE_STEAM_COOL_C = 60;
/** Decent: one solution fills up to three descale cycles. */
export const DESCALE_MAX_CYCLES = 3;
/** Decent: rinse the steam line with five steams of 100 s each. */
export const DESCALE_RINSE_STEAMS = 5;
export const DESCALE_RINSE_STEAM_SECONDS = 100;
/** Steams shorter than this are taps, not rinse runs. */
export const DESCALE_RINSE_STEAM_MIN_MS = 20_000;

export interface DescaleWizardState {
  step: DescaleWizardStep;
  /** Completed descale cycles in this session (also counted outside the descale step). */
  cyclesDone: number;
  /** The machine is in its descale cycle right now. */
  descaling: boolean;
  /** Times the tank ran dry while rinsing the group. */
  groupRefills: number;
  /** Completed rinse steams in the steam step. */
  steamRuns: number;
  /** Inline dialog message, e.g. why an action could not start. */
  note: string | null;
  descaleTracker: DescaleCycleTracker;
  steamStartedAt: number | null;
  lastMachineState: string | null;
}

export interface DescaleWizardMachineUpdate {
  next: DescaleWizardState;
  /** Epoch ms of a descale cycle that just completed (to record the descale). */
  cycleCompletedAt: number | null;
}

export function startDescaleWizard(): DescaleWizardState {
  return {
    step: 'cool-down',
    cyclesDone: 0,
    descaling: false,
    groupRefills: 0,
    steamRuns: 0,
    note: null,
    descaleTracker: IDLE_DESCALE_TRACKER,
    steamStartedAt: null,
    lastMachineState: null
  };
}

export function descaleWizardStepIndex(step: DescaleWizardStep): number {
  const index = DESCALE_WIZARD_STEPS.indexOf(step);
  return index < 0 ? 0 : index;
}

export function descaleWizardNext(state: DescaleWizardState): DescaleWizardState {
  const index = descaleWizardStepIndex(state.step);
  const step = DESCALE_WIZARD_STEPS[Math.min(index + 1, DESCALE_WIZARD_STEPS.length - 1)]!;
  return { ...state, step, note: null };
}

export function descaleWizardBack(state: DescaleWizardState): DescaleWizardState {
  const index = descaleWizardStepIndex(state.step);
  const step = DESCALE_WIZARD_STEPS[Math.max(index - 1, 0)]!;
  return { ...state, step, note: null };
}

export function descaleWizardNote(state: DescaleWizardState, note: string | null): DescaleWizardState {
  return { ...state, note };
}

/** Feed every machine state the wizard sees while it is open. */
export function descaleWizardOnMachineState(
  state: DescaleWizardState,
  machineState: string | null | undefined,
  nowMs: number
): DescaleWizardMachineUpdate {
  const cycle = trackDescaleCycle(state.descaleTracker, machineState, nowMs);
  let next: DescaleWizardState = {
    ...state,
    descaleTracker: cycle.tracker,
    descaling: machineState === 'descaling' || (machineState == null && state.descaling)
  };
  if (cycle.completedAt != null) {
    next = { ...next, cyclesDone: Math.min(next.cyclesDone + 1, DESCALE_MAX_CYCLES), note: null };
  }

  if (machineState == null) return { next, cycleCompletedAt: cycle.completedAt };

  const previous = state.lastMachineState;
  if (next.step === 'rinse-group' && machineState === 'needsWater' && previous !== 'needsWater') {
    next = { ...next, groupRefills: next.groupRefills + 1 };
  }
  if (machineState === 'steam') {
    if (next.steamStartedAt == null) next = { ...next, steamStartedAt: nowMs };
  } else if (next.steamStartedAt != null) {
    const longEnough = nowMs - next.steamStartedAt >= DESCALE_RINSE_STEAM_MIN_MS;
    next = {
      ...next,
      steamStartedAt: null,
      steamRuns: next.step === 'rinse-steam' && longEnough ? next.steamRuns + 1 : next.steamRuns
    };
  }
  return { next: { ...next, lastMachineState: machineState }, cycleCompletedAt: cycle.completedAt };
}

/** What a step recommends before moving on; Next stays available either way. */
export function descaleWizardStepMet(
  state: DescaleWizardState,
  steamTemperatureC: number | null
): boolean {
  switch (state.step) {
    case 'cool-down':
      return steamTemperatureC != null && steamTemperatureC <= DESCALE_STEAM_COOL_C;
    case 'descale':
      return state.cyclesDone >= 1 && !state.descaling;
    case 'rinse-steam':
      return state.steamRuns >= DESCALE_RINSE_STEAMS;
    default:
      return true;
  }
}
