// Fork customization A3 (FORK.md, docs/fork-descale-plan.md): the descaling
// reminder and the guided descale. Owns the reminder's synced state, the
// wizard session and the steam settings it has to put back; everything that
// touches the machine goes through the narrow host port, which app.ts backs
// with its existing owned command paths (machine settings flow for the
// descale state, the machine workflow writer for steam settings, and the
// regular machine actions for flush and steam).

import type { SteamSettings } from '../api/types';
import {
  DESCALE_INTERVAL_OPTIONS,
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
  type DescaleSource,
  type DescaleState
} from '../domain/forkDescale';
import {
  DESCALE_MAX_CYCLES,
  DESCALE_RINSE_STEAM_SECONDS,
  descaleWizardBack,
  descaleWizardNext,
  descaleWizardNote,
  descaleWizardOnMachineState,
  descaleWizardStepMet,
  startDescaleWizard,
  type DescaleWizardState
} from '../domain/forkDescaleWizard';
import { steamHeaterOn } from '../domain/waterSettings';
import type { ClickActionHandler } from './actionContract';

export type ForkDescaleModal = 'descale-wizard' | 'descale-date';

export interface ForkDescaleHost {
  now(): Date;
  demo(): boolean;
  /** Synced settings can be written now (demo, or live with the store available). */
  canWriteSettings(): boolean;
  modal(): string | null;
  openModal(modal: ForkDescaleModal): void;
  closeModal(): void;
  showStatus(status: string): void;
  requestRender(): void;
  machineState(): string | null;
  steamTemperature(): number | null;
  hasGhc(): boolean;
  busy(): boolean;
  steamSettings(): SteamSettings;
  /** Write steam settings through the machine workflow writer (demo simulates). */
  applySteamSettings(steam: SteamSettings, status: string): Promise<void>;
  /** Put the machine into its descale cycle (live only). */
  startDescale(): Promise<void>;
  /** Start a flush or steam through the regular machine action. */
  startService(state: 'flush' | 'steam'): Promise<boolean>;
  /** The value of the descale date input in the open date dialog. */
  dateInputValue(): string | null;
}

/** Steam settings the wizard changed and must put back. */
interface SteamRestore {
  heaterTemperature: number | null;
  duration: number | null;
}

const NO_RESTORE: SteamRestore = { heaterTemperature: null, duration: null };

export class ForkDescaleFeature {
  private descale: DescaleState = { lastDescaledAt: null, history: [] };
  private interval = 0;
  private wizard: DescaleWizardState | null = null;
  private tracker = IDLE_DESCALE_TRACKER;
  private pendingCycleAt: number | null = null;
  private restore: SteamRestore = NO_RESTORE;
  private dateNote: string | null = null;
  private shownTemperature: number | null = null;
  // Bumped whenever the wizard session ends, so a command that resolves late
  // cannot touch a session that is gone.
  private session = 0;

  constructor(private readonly host: ForkDescaleHost) {
    this.reloadSettings();
  }

  /** Re-read the synced reminder state (boot, store poll, leaving demo). */
  reloadSettings(): void {
    this.descale = readDescaleState();
    this.interval = readDescaleInterval();
  }

  /** Drop the session-only state, e.g. when demo authority hands back to the gateway. */
  reset(): void {
    this.session++;
    this.wizard = null;
    this.tracker = IDLE_DESCALE_TRACKER;
    this.pendingCycleAt = null;
    this.restore = NO_RESTORE;
    this.dateNote = null;
    this.reloadSettings();
  }

  due(): boolean {
    return descaleDue(this.descale, this.interval, this.host.now());
  }

  barViewModel() {
    return {
      status: descaleStatus(this.descale, this.interval, this.host.now()),
      lastDescaledAt: this.descale.lastDescaledAt,
      interval: this.interval,
      wizardPaused: this.wizard != null
    };
  }

  dateDialogViewModel() {
    const now = this.host.now();
    const last = this.descale.lastDescaledAt ? new Date(this.descale.lastDescaledAt) : now;
    return { value: dateInputValue(last), max: dateInputValue(now), note: this.dateNote };
  }

  wizardViewModel() {
    const wizard = this.wizard ?? startDescaleWizard();
    const steam = this.host.steamSettings();
    const temperature = this.host.steamTemperature();
    const dueAt = descaleDueAt(this.descale.lastDescaledAt, this.interval);
    return {
      step: wizard.step,
      note: wizard.note,
      cyclesDone: wizard.cyclesDone,
      descaling: wizard.descaling,
      groupRefills: wizard.groupRefills,
      steamRuns: wizard.steamRuns,
      steamTemperatureC: temperature,
      steamHeaterOn: steamHeaterOn(steam),
      steamTimeSeconds: typeof steam.duration === 'number' ? steam.duration : null,
      hasGhc: this.host.hasGhc(),
      busy: this.host.busy(),
      stepMet: descaleWizardStepMet(wizard, temperature),
      nextDueLabel: dueAt ? dueAt.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : null
    };
  }

  /**
   * Feed every live machine frame. Records a finished descale cycle whether or
   * not the wizard is open, and re-renders only when something visible changed.
   */
  onMachineFrame(machineState: string | null | undefined, steamTemperature: number | null | undefined, nowMs: number): void {
    let changed = false;
    const cycle = trackDescaleCycle(this.tracker, machineState, nowMs);
    this.tracker = cycle.tracker;
    if (cycle.completedAt != null) this.pendingCycleAt = cycle.completedAt;
    if (this.pendingCycleAt != null && this.host.canWriteSettings()) {
      changed = this.record(new Date(this.pendingCycleAt), 'machine') || changed;
      this.pendingCycleAt = null;
    }

    if (this.wizard) {
      const before = this.wizard;
      const after = descaleWizardOnMachineState(before, machineState, nowMs).next;
      this.wizard = after;
      changed ||= after.cyclesDone !== before.cyclesDone || after.descaling !== before.descaling ||
        after.groupRefills !== before.groupRefills || after.steamRuns !== before.steamRuns;
      if (after.step === 'cool-down' && this.host.modal() === 'descale-wizard' && typeof steamTemperature === 'number') {
        const shown = Math.round(steamTemperature);
        if (shown !== this.shownTemperature) {
          this.shownTemperature = shown;
          changed = true;
        }
      }
    }
    if (changed) this.host.requestRender();
  }

  clickActions(): Record<string, ClickActionHandler> {
    return {
      'descale-interval': ({ value }) => this.setInterval(Number(value)),
      'descale-open-date': () => {
        this.dateNote = null;
        this.host.openModal('descale-date');
      },
      'descale-date-today': () => this.saveDate(this.host.now()),
      'descale-date-save': () => this.saveDateInput(),
      'open-descale-wizard': () => {
        this.wizard ??= startDescaleWizard();
        this.host.openModal('descale-wizard');
      },
      'descale-wizard-next': () => this.updateWizard(descaleWizardNext),
      'descale-wizard-back': () => this.updateWizard(descaleWizardBack),
      'descale-wizard-heater-off': () => this.turnHeaterOff(),
      'descale-wizard-heater-on': () => this.turnHeaterOn(),
      'descale-wizard-start': () => this.startDescale(),
      'descale-wizard-flush': async () => {
        await this.host.startService('flush');
      },
      'descale-wizard-steam': async () => {
        await this.host.startService('steam');
      },
      'descale-wizard-steam-time': () => this.setRinseSteamTime(),
      'descale-wizard-cancel': () => this.endWizard(false),
      'descale-wizard-finish': () => this.endWizard(true)
    };
  }

  // ---- reminder ---------------------------------------------------------------

  private setInterval(months: number): void {
    if (!(DESCALE_INTERVAL_OPTIONS as readonly number[]).includes(months)) return;
    if (!writeDescaleInterval(months)) return;
    this.interval = months;
    this.host.showStatus(months === 0 ? 'Descaling reminder off' : `Descaling reminder every ${months} months`);
  }

  private saveDateInput(): void {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(this.host.dateInputValue() ?? '');
    if (!match) return this.dateError('Pick a date first');
    // Noon keeps the calendar day stable across time zones and DST.
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0);
    if (Number.isNaN(date.valueOf())) return this.dateError('Pick a date first');
    const now = this.host.now();
    if (date.valueOf() > now.valueOf()) {
      if (dateInputValue(date) !== dateInputValue(now)) return this.dateError('The date cannot be in the future');
      return this.saveDate(now);
    }
    this.saveDate(date);
  }

  private saveDate(date: Date): void {
    if (!this.record(date, 'manual')) return this.dateError('Could not save — synced settings are unavailable');
    this.dateNote = null;
    this.host.closeModal();
    this.host.showStatus('Descale date saved');
  }

  private dateError(note: string): void {
    this.dateNote = note;
    this.host.requestRender();
  }

  private record(date: Date, source: DescaleSource): boolean {
    const next = recordDescale(this.descale, date.toISOString(), source);
    if (next === this.descale || !writeDescaleState(next)) return false;
    this.descale = next;
    return true;
  }

  // ---- wizard -----------------------------------------------------------------

  private updateWizard(step: (state: DescaleWizardState) => DescaleWizardState): void {
    if (!this.wizard) return;
    this.wizard = step(this.wizard);
    this.host.requestRender();
  }

  private note(note: string | null): void {
    if (!this.wizard) return;
    this.wizard = descaleWizardNote(this.wizard, note);
    this.host.requestRender();
  }

  private async turnHeaterOff(): Promise<void> {
    const steam = this.host.steamSettings();
    if (!steamHeaterOn(steam)) return this.note(null);
    const previous = steam.targetTemperature ?? null;
    const session = this.session;
    await this.host.applySteamSettings({ ...steam, targetTemperature: 0 }, 'Steam heater off for descaling');
    if (session !== this.session) return;
    if (steamHeaterOn(this.host.steamSettings())) return this.note('Could not turn the steam heater off — try again.');
    this.restore = { ...this.restore, heaterTemperature: previous };
    this.note(null);
  }

  private async turnHeaterOn(): Promise<void> {
    const steam = this.host.steamSettings();
    if (steamHeaterOn(steam)) return this.note(null);
    const temperature = this.restore.heaterTemperature;
    if (temperature == null) {
      return this.note('The heater was already off before this guide — pick a steam preset on the Steam lane to turn it on.');
    }
    const session = this.session;
    await this.host.applySteamSettings({ ...steam, targetTemperature: temperature }, 'Steam heater back on');
    if (session !== this.session) return;
    if (!steamHeaterOn(this.host.steamSettings())) return this.note('Could not turn the steam heater on — try again.');
    this.restore = { ...this.restore, heaterTemperature: null };
    this.note(null);
  }

  private async setRinseSteamTime(): Promise<void> {
    const steam = this.host.steamSettings();
    if (steam.duration === DESCALE_RINSE_STEAM_SECONDS) return this.note(null);
    const previous = typeof steam.duration === 'number' ? steam.duration : null;
    const session = this.session;
    await this.host.applySteamSettings({ ...steam, duration: DESCALE_RINSE_STEAM_SECONDS }, `Steam time ${DESCALE_RINSE_STEAM_SECONDS} s for rinsing`);
    if (session !== this.session) return;
    if (this.host.steamSettings().duration !== DESCALE_RINSE_STEAM_SECONDS) {
      return this.note('Could not change the steam time — try again.');
    }
    if (this.restore.duration == null) this.restore = { ...this.restore, duration: previous };
    this.note(null);
  }

  private async startDescale(): Promise<void> {
    if (!this.wizard) return;
    if (this.wizard.cyclesDone >= DESCALE_MAX_CYCLES) return this.note('Three cycles are the most one solution allows.');
    if (steamHeaterOn(this.host.steamSettings())) {
      return this.note('Turn the steam heater off and let it cool first (step 1).');
    }
    if (this.host.demo()) {
      // Demo has no descaling simulation: count the cycle right away.
      this.wizard = { ...this.wizard, cyclesDone: this.wizard.cyclesDone + 1, note: null };
      this.record(this.host.now(), 'machine');
      this.host.showStatus('Descale cycle simulated (demo)');
      return;
    }
    this.note(null);
    await this.host.startDescale();
  }

  private async endWizard(finished: boolean): Promise<void> {
    if (!this.wizard) return;
    const machine = this.host.machineState();
    if (machine === 'descaling' || machine === 'steam') {
      return this.note('Wait until the machine has finished this run.');
    }
    const session = this.session;
    if (this.restore.duration != null) {
      const steam = this.host.steamSettings();
      await this.host.applySteamSettings({ ...steam, duration: this.restore.duration }, 'Steam time restored');
      if (session !== this.session) return;
      if (this.host.steamSettings().duration !== this.restore.duration) {
        return this.note('Could not restore the steam time — try again.');
      }
      this.restore = { ...this.restore, duration: null };
    }
    if (this.restore.heaterTemperature != null) {
      await this.turnHeaterOn();
      if (session !== this.session || this.restore.heaterTemperature != null) return;
    }
    const recorded = finished && this.wizard.cyclesDone >= 1 && this.record(this.host.now(), 'wizard');
    this.session++;
    this.wizard = null;
    this.restore = NO_RESTORE;
    this.host.closeModal();
    this.host.showStatus(finished ? (recorded ? 'Descaling complete' : 'Descale guide finished') : 'Descale guide cancelled');
  }
}

function dateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
