import { descaleStatusLine, renderDescaleBar, renderDescaleDateDialog } from '../views/forkDescaleBar';
import { renderDescaleWizardModal, type DescaleWizardViewModel } from '../views/forkDescaleWizardView';

const dueAt = new Date(2027, 9, 3);

run('the descaling bar shows the interval, the last date, and its due state', () => {
  const html = renderDescaleBar({
    status: { kind: 'due', dueAt, daysOverdue: 5 },
    lastDescaledAt: new Date(2026, 9, 3, 12).toISOString(),
    interval: 12,
    wizardPaused: false
  });
  includes(html, 'class="cleaning-bar descale-bar due');
  includes(html, '<strong>Descaling</strong>');
  includes(html, 'data-action="descale-interval" data-value="12" aria-pressed="true"');
  includes(html, 'data-action="descale-interval" data-value="0" aria-pressed="false">Off</button>');
  includes(html, 'data-action="descale-open-date"');
  includes(html, 'data-action="open-descale-wizard"');
  includes(html, 'Run descale');
  includes(html, 'overdue by 5 days');
});

run('the descaling bar asks for a date when none is recorded and offers to resume a paused guide', () => {
  const html = renderDescaleBar({ status: { kind: 'unknown' }, lastDescaledAt: null, interval: 12, wizardPaused: true });
  includes(html, 'never recorded · set the date');
  includes(html, '<span>Set date</span>');
  includes(html, 'Resume descale');
  excludes(html, 'descale-bar due');
});

run('status lines count days close to the due date and months further out', () => {
  equal(descaleStatusLine({ kind: 'ok', dueAt, daysLeft: 270 }, '3 Oct 2026'), 'last descaled 3 Oct 2026 · due in 9 months');
  equal(descaleStatusLine({ kind: 'soon', dueAt, daysLeft: 12 }, '3 Oct 2026'), 'last descaled 3 Oct 2026 · due in 12 days');
  equal(descaleStatusLine({ kind: 'soon', dueAt, daysLeft: 1 }, 'x'), 'last descaled x · due in 1 day');
  equal(descaleStatusLine({ kind: 'due', dueAt, daysOverdue: 0 }, 'x'), 'last descaled x · due today');
  equal(descaleStatusLine({ kind: 'off' }, 'x'), 'last descaled x · reminder off');
  equal(descaleStatusLine({ kind: 'unknown' }, null), 'never recorded · set the date');
});

run('the date dialog offers today, a bounded date input, and save', () => {
  const html = renderDescaleDateDialog({ value: '2026-10-03', max: '2026-10-18', note: 'The date cannot be in the future' });
  includes(html, 'type="date" data-field="descale-date" value="2026-10-03" max="2026-10-18"');
  includes(html, 'data-action="descale-date-today"');
  includes(html, 'data-action="descale-date-save"');
  includes(html, 'data-action="close-modal"');
  includes(html, 'The date cannot be in the future');
});

const base: DescaleWizardViewModel = {
  step: 'cool-down',
  note: null,
  cyclesDone: 0,
  descaling: false,
  groupRefills: 0,
  steamRuns: 0,
  steamTemperatureC: 142,
  steamHeaterOn: true,
  steamTimeSeconds: 50,
  hasGhc: false,
  busy: false,
  stepMet: false,
  nextDueLabel: '18 Oct 2027'
};

run('cool-down turns the heater off first, then waits for 60 °C', () => {
  const on = renderDescaleWizardModal(base);
  includes(on, 'Descaling · Step 1 of 6');
  includes(on, 'data-action="descale-wizard-heater-off"');
  includes(on, '142 °C');
  includes(on, 'data-action="close-modal" aria-label="Close and continue later"');
  includes(on, 'data-action="descale-wizard-cancel"');

  const cooling = renderDescaleWizardModal({ ...base, steamHeaterOn: false, steamTemperatureC: 88 });
  includes(cooling, 'Continue anyway');
  excludes(cooling, 'descale-wizard-heater-off');

  const cool = renderDescaleWizardModal({ ...base, steamHeaterOn: false, steamTemperatureC: 58, stepMet: true });
  includes(cool, 'descale-wizard-fact met');
  includes(cool, '<span>Next</span>');
});

run('the descale step starts a cycle, shows it running, and offers another', () => {
  const start = renderDescaleWizardModal({ ...base, step: 'descale', steamHeaterOn: false });
  includes(start, 'data-action="descale-wizard-start"');
  includes(start, '0 of up to 3');

  const running = renderDescaleWizardModal({ ...base, step: 'descale', descaling: true });
  includes(running, 'Descaling…');
  includes(running, 'disabled');

  const once = renderDescaleWizardModal({ ...base, step: 'descale', cyclesDone: 1, stepMet: true });
  includes(once, 'Run another cycle');
  includes(once, 'Continue to rinse');

  const max = renderDescaleWizardModal({ ...base, step: 'descale', cyclesDone: 3, stepMet: true });
  excludes(max, 'Run another cycle');
});

run('rinse steps start flush and steam in the app, or point to the group-head controller', () => {
  const group = renderDescaleWizardModal({ ...base, step: 'rinse-group', groupRefills: 2 });
  includes(group, 'data-action="descale-wizard-flush"');
  includes(group, '2×');
  const groupGhc = renderDescaleWizardModal({ ...base, step: 'rinse-group', hasGhc: true });
  excludes(groupGhc, 'descale-wizard-flush');
  includes(groupGhc, 'group-head controller');

  const steamTime = renderDescaleWizardModal({ ...base, step: 'rinse-steam' });
  includes(steamTime, 'data-action="descale-wizard-steam-time"');
  includes(steamTime, 'Set steam to 100 s');

  const steam = renderDescaleWizardModal({ ...base, step: 'rinse-steam', steamTimeSeconds: 100, steamRuns: 3 });
  includes(steam, 'data-action="descale-wizard-steam"');
  includes(steam, '3 of 5');
});

run('refill turns the heater back on, and done names the next due date', () => {
  const refill = renderDescaleWizardModal({ ...base, step: 'refill', steamHeaterOn: false });
  includes(refill, 'data-action="descale-wizard-heater-on"');
  const done = renderDescaleWizardModal({ ...base, step: 'done' });
  includes(done, 'data-action="descale-wizard-finish"');
  includes(done, 'Next descale is due 18 Oct 2027.');
  excludes(done, 'descale-wizard-cancel');
});

run('every button is disabled while a command is in flight', () => {
  const html = renderDescaleWizardModal({ ...base, step: 'descale', steamHeaterOn: false, busy: true });
  includes(html, 'data-action="descale-wizard-start" disabled');
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
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

function includes(text: string, expected: string): void {
  if (!text.includes(expected)) throw new Error(`Expected markup to include ${expected}`);
}

function excludes(text: string, unexpected: string): void {
  if (text.includes(unexpected)) throw new Error(`Expected markup not to include ${unexpected}`);
}
