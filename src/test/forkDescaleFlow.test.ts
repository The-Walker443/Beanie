import type { SteamSettings } from '../api/types';
import { ForkDescaleFeature, type ForkDescaleHost, type ForkDescaleModal } from '../controllers/forkDescaleFlow';
import { readDescaleInterval, readDescaleState, writeDescaleInterval, writeDescaleState } from '../domain/forkDescale';

interface FakeHost extends ForkDescaleHost {
  steam: SteamSettings;
  machine: string | null;
  isDemo: boolean;
  writable: boolean;
  openModalName: string | null;
  statuses: string[];
  renders: number;
  dateValue: string | null;
  descaleStarts: number;
  services: string[];
  steamWrites: SteamSettings[];
  /** Resolves the next steam write only when released (to test late results). */
  holdSteamWrites: boolean;
  release: (() => void) | null;
}

function fakeHost(overrides: Partial<FakeHost> = {}): FakeHost {
  const host: FakeHost = {
    steam: { targetTemperature: 148, duration: 50, flow: 1.5 },
    machine: 'idle',
    isDemo: false,
    writable: true,
    openModalName: null,
    statuses: [],
    renders: 0,
    dateValue: null,
    descaleStarts: 0,
    services: [],
    steamWrites: [],
    holdSteamWrites: false,
    release: null,
    now: () => new Date(2026, 9, 18, 15, 0),
    demo: () => host.isDemo,
    canWriteSettings: () => host.writable,
    modal: () => host.openModalName,
    openModal: (modal: ForkDescaleModal) => {
      host.openModalName = modal;
    },
    closeModal: () => {
      host.openModalName = null;
    },
    showStatus: (status) => {
      host.statuses.push(status);
    },
    requestRender: () => {
      host.renders += 1;
    },
    machineState: () => host.machine,
    steamTemperature: () => 55,
    hasGhc: () => false,
    busy: () => false,
    steamSettings: () => host.steam,
    applySteamSettings: async (steam) => {
      if (host.holdSteamWrites) await new Promise<void>((resolve) => { host.release = resolve; });
      host.steamWrites.push(steam);
      host.steam = steam;
    },
    startDescale: async () => {
      host.descaleStarts += 1;
    },
    startService: async (state) => {
      host.services.push(state);
      return true;
    },
    dateInputValue: () => host.dateValue,
    ...overrides
  };
  return host;
}

function freshSettings(): void {
  writeDescaleState({ lastDescaledAt: null, history: [] });
  writeDescaleInterval(12);
}

async function act(feature: ForkDescaleFeature, action: string, value?: string): Promise<void> {
  const handler = feature.clickActions()[action];
  if (!handler) throw new Error(`No handler for ${action}`);
  await handler({ el: {} as HTMLElement, value });
}

await run('the interval buttons persist only the offered month steps', async () => {
  freshSettings();
  const host = fakeHost();
  const feature = new ForkDescaleFeature(host);
  await act(feature, 'descale-interval', '6');
  equal(readDescaleInterval(), 6);
  equal(feature.barViewModel().interval, 6);
  equal(host.statuses.at(-1), 'Descaling reminder every 6 months');
  await act(feature, 'descale-interval', '7');
  equal(readDescaleInterval(), 6);
  await act(feature, 'descale-interval', '0');
  equal(host.statuses.at(-1), 'Descaling reminder off');
});

await run('the date dialog records a past date, refuses the future, and closes on save', async () => {
  freshSettings();
  const host = fakeHost();
  const feature = new ForkDescaleFeature(host);
  await act(feature, 'descale-open-date');
  equal(host.openModalName, 'descale-date');

  host.dateValue = '2026-10-25';
  await act(feature, 'descale-date-save');
  equal(feature.dateDialogViewModel().note, 'The date cannot be in the future');
  equal(host.openModalName, 'descale-date');

  host.dateValue = '2026-10-03';
  await act(feature, 'descale-date-save');
  equal(host.openModalName, null);
  equal(new Date(readDescaleState().lastDescaledAt ?? '').getDate(), 3);
  equal(readDescaleState().history[0]?.source, 'manual');
  equal(feature.barViewModel().status.kind, 'ok');

  await act(feature, 'descale-open-date');
  await act(feature, 'descale-date-today');
  equal(new Date(readDescaleState().lastDescaledAt ?? '').getDate(), 18);
});

await run('a finished machine descale is recorded once the store is writable', async () => {
  freshSettings();
  const host = fakeHost({ writable: false });
  const feature = new ForkDescaleFeature(host);
  feature.onMachineFrame('descaling', 120, 0);
  feature.onMachineFrame('idle', 120, 6 * 60_000);
  equal(readDescaleState().lastDescaledAt, null);
  host.writable = true;
  feature.onMachineFrame('idle', 120, 6 * 60_000 + 500);
  equal(readDescaleState().history[0]?.source, 'machine');
  equal(new Date(readDescaleState().lastDescaledAt ?? '').valueOf(), 6 * 60_000);
});

await run('the wizard turns the heater off, refuses to descale while it is on, and puts everything back on cancel', async () => {
  freshSettings();
  const host = fakeHost();
  const feature = new ForkDescaleFeature(host);
  await act(feature, 'open-descale-wizard');
  equal(host.openModalName, 'descale-wizard');
  await act(feature, 'descale-wizard-next');
  await act(feature, 'descale-wizard-next');
  await act(feature, 'descale-wizard-start');
  equal(host.descaleStarts, 0);
  equal(feature.wizardViewModel().note, 'Turn the steam heater off and let it cool first (step 1).');

  await act(feature, 'descale-wizard-heater-off');
  equal(host.steam.targetTemperature, 0);
  await act(feature, 'descale-wizard-start');
  equal(host.descaleStarts, 1);

  await act(feature, 'descale-wizard-steam-time');
  equal(host.steam.duration, 100);

  host.machine = 'descaling';
  await act(feature, 'descale-wizard-cancel');
  equal(host.openModalName, 'descale-wizard');
  equal(feature.wizardViewModel().note, 'Wait until the machine has finished this run.');

  host.machine = 'idle';
  await act(feature, 'descale-wizard-cancel');
  equal(host.openModalName, null);
  equal(host.steam.duration, 50);
  equal(host.steam.targetTemperature, 148);
  equal(host.steam.flow, 1.5);
  equal(feature.barViewModel().wizardPaused, false);
  equal(readDescaleState().lastDescaledAt, null);
});

await run('closing the wizard pauses it; finishing records the descale only after a cycle ran', async () => {
  freshSettings();
  const host = fakeHost();
  const feature = new ForkDescaleFeature(host);
  await act(feature, 'open-descale-wizard');
  await act(feature, 'descale-wizard-next');
  host.closeModal();
  equal(feature.barViewModel().wizardPaused, true);
  await act(feature, 'open-descale-wizard');
  equal(feature.wizardViewModel().step, 'solution');

  await act(feature, 'descale-wizard-finish');
  equal(readDescaleState().lastDescaledAt, null);
  equal(host.statuses.at(-1), 'Descale guide finished');

  await act(feature, 'open-descale-wizard');
  const t0 = new Date(2026, 9, 18, 14, 0).valueOf();
  feature.onMachineFrame('descaling', 50, t0);
  feature.onMachineFrame('idle', 50, t0 + 6 * 60_000);
  equal(feature.wizardViewModel().cyclesDone, 1);
  equal(readDescaleState().history[0]?.source, 'machine');
  await act(feature, 'descale-wizard-finish');
  equal(readDescaleState().history[0]?.source, 'wizard');
  equal(readDescaleState().history.length, 1);
  equal(host.statuses.at(-1), 'Descaling complete');
});

await run('demo counts a descale cycle without a machine', async () => {
  freshSettings();
  const host = fakeHost({ isDemo: true, steam: { targetTemperature: 0, duration: 50 } });
  const feature = new ForkDescaleFeature(host);
  await act(feature, 'open-descale-wizard');
  await act(feature, 'descale-wizard-start');
  equal(host.descaleStarts, 0);
  equal(feature.wizardViewModel().cyclesDone, 1);
  equal(host.statuses.at(-1), 'Descale cycle simulated (demo)');
});

await run('a heater that was off before the guide is left to the user', async () => {
  freshSettings();
  const host = fakeHost({ steam: { targetTemperature: 0, duration: 50 } });
  const feature = new ForkDescaleFeature(host);
  await act(feature, 'open-descale-wizard');
  await act(feature, 'descale-wizard-heater-on');
  equal(host.steamWrites.length, 0);
  includes(feature.wizardViewModel().note ?? '', 'already off before this guide');
});

await run('a steam write that resolves after a reset does not revive the session', async () => {
  freshSettings();
  const host = fakeHost({ holdSteamWrites: true });
  const feature = new ForkDescaleFeature(host);
  await act(feature, 'open-descale-wizard');
  const pending = act(feature, 'descale-wizard-heater-off');
  feature.reset();
  host.release?.();
  await pending;
  equal(feature.barViewModel().wizardPaused, false);
  host.holdSteamWrites = false;
  await act(feature, 'open-descale-wizard');
  await act(feature, 'descale-wizard-cancel');
  equal(host.steamWrites.length, 1);
});

async function run(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

function includes(text: string, expected: string): void {
  if (!text.includes(expected)) throw new Error(`Expected ${JSON.stringify(text)} to include ${expected}`);
}
