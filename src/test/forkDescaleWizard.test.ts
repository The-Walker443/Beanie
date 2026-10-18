import {
  DESCALE_MAX_CYCLES,
  DESCALE_RINSE_STEAMS,
  DESCALE_WIZARD_STEPS,
  descaleWizardBack,
  descaleWizardNext,
  descaleWizardOnMachineState,
  descaleWizardStepMet,
  startDescaleWizard,
  type DescaleWizardState,
  type DescaleWizardStep
} from '../domain/forkDescaleWizard';

const at = (step: DescaleWizardStep): DescaleWizardState => ({ ...startDescaleWizard(), step });
const MIN = 60_000;

run('the wizard walks Decent\'s descale order and stops at both ends', () => {
  let state = startDescaleWizard();
  const seen = [state.step];
  for (let i = 0; i < DESCALE_WIZARD_STEPS.length + 2; i++) {
    state = descaleWizardNext(state);
    if (seen.at(-1) !== state.step) seen.push(state.step);
  }
  equal(seen.join(','), 'cool-down,solution,descale,refill,rinse-group,rinse-steam,done');
  equal(descaleWizardBack(startDescaleWizard()).step, 'cool-down');
  equal(descaleWizardBack(at('descale')).step, 'solution');
});

run('cool-down asks for the steam heater at 60 °C or below', () => {
  equal(descaleWizardStepMet(at('cool-down'), 95), false);
  equal(descaleWizardStepMet(at('cool-down'), 60), true);
  equal(descaleWizardStepMet(at('cool-down'), null), false);
  equal(descaleWizardStepMet(at('solution'), 140), true);
});

run('a full descale cycle is counted and reported; a short abort is not', () => {
  let state = at('descale');
  let update = descaleWizardOnMachineState(state, 'descaling', 0);
  state = update.next;
  equal(state.descaling, true);
  equal(descaleWizardStepMet(state, null), false);

  update = descaleWizardOnMachineState(state, 'idle', 6 * MIN);
  state = update.next;
  equal(update.cycleCompletedAt, 6 * MIN);
  equal(state.cyclesDone, 1);
  equal(state.descaling, false);
  equal(descaleWizardStepMet(state, null), true);

  state = descaleWizardOnMachineState(state, 'descaling', 7 * MIN).next;
  update = descaleWizardOnMachineState(state, 'idle', 8 * MIN);
  equal(update.cycleCompletedAt, null);
  equal(update.next.cyclesDone, 1);
});

run('descale cycles stop counting at three', () => {
  let state = at('descale');
  for (let i = 0; i < DESCALE_MAX_CYCLES + 1; i++) {
    state = descaleWizardOnMachineState(state, 'descaling', i * 10 * MIN).next;
    state = descaleWizardOnMachineState(state, 'idle', (i * 10 + 6) * MIN).next;
  }
  equal(state.cyclesDone, DESCALE_MAX_CYCLES);
});

run('a dropped connection mid-cycle keeps the cycle running', () => {
  let state = descaleWizardOnMachineState(at('descale'), 'descaling', 0).next;
  state = descaleWizardOnMachineState(state, null, 2 * MIN).next;
  equal(state.descaling, true);
  const update = descaleWizardOnMachineState(state, 'idle', 6 * MIN);
  equal(update.cycleCompletedAt, 6 * MIN);
});

run('rinsing the group counts each time the tank runs dry', () => {
  let state = at('rinse-group');
  for (const machine of ['flush', 'needsWater', 'needsWater', 'idle', 'flush', 'needsWater']) {
    state = descaleWizardOnMachineState(state, machine, 0).next;
  }
  equal(state.groupRefills, 2);
  const elsewhere = descaleWizardOnMachineState({ ...at('refill'), lastMachineState: 'idle' }, 'needsWater', 0).next;
  equal(elsewhere.groupRefills, 0);
});

run('rinsing the steam line counts full steams only, up to Decent\'s five', () => {
  let state = at('rinse-steam');
  let now = 0;
  const steam = (seconds: number) => {
    state = descaleWizardOnMachineState(state, 'steam', now).next;
    now += seconds * 1000;
    state = descaleWizardOnMachineState(state, 'idle', now).next;
    now += 5000;
  };
  steam(5);
  equal(state.steamRuns, 0);
  for (let i = 0; i < DESCALE_RINSE_STEAMS; i++) steam(100);
  equal(state.steamRuns, DESCALE_RINSE_STEAMS);
  equal(descaleWizardStepMet(state, null), true);

  let other = at('refill');
  other = descaleWizardOnMachineState(other, 'steam', 0).next;
  other = descaleWizardOnMachineState(other, 'idle', 100_000).next;
  equal(other.steamRuns, 0);
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
