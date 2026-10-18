// Fork customization A3 (FORK.md): the guided descale dialog. Pure view over
// domain/forkDescaleWizard.ts; it reuses the backflush wizard's classes so the
// two guides look alike.

import { icon } from '../components/icons';
import { escapeHtml } from '../components/html';
import {
  DESCALE_MAX_CYCLES,
  DESCALE_RINSE_STEAMS,
  DESCALE_RINSE_STEAM_SECONDS,
  DESCALE_STEAM_COOL_C,
  DESCALE_WIZARD_STEP_COUNT,
  descaleWizardStepIndex,
  type DescaleWizardStep
} from '../domain/forkDescaleWizard';

export interface DescaleWizardViewModel {
  step: DescaleWizardStep;
  note: string | null;
  cyclesDone: number;
  descaling: boolean;
  groupRefills: number;
  steamRuns: number;
  steamTemperatureC: number | null;
  steamHeaterOn: boolean;
  /** Steam duration currently set on the machine, seconds. */
  steamTimeSeconds: number | null;
  /** Flush and steam start from the group-head controller, not the app. */
  hasGhc: boolean;
  /** A command from this dialog is still in flight. */
  busy: boolean;
  /** The step's recommendation is met (see descaleWizardStepMet). */
  stepMet: boolean;
  /** "Oct 18, 2027" — when the next descale falls due, for the done step. */
  nextDueLabel: string | null;
}

interface StepCopy {
  eyebrow: string;
  title: string;
  body: string;
}

const STEP_COPY: Record<DescaleWizardStep, StepCopy> = {
  'cool-down': {
    eyebrow: 'Prepare',
    title: 'Cool the steam heater',
    body: `Descale only with a cool steam heater. Turn it off and wait until it is at ${DESCALE_STEAM_COOL_C} °C or below — this can take up to an hour. You can close this guide meanwhile; Run descale picks up where you left off.`
  },
  solution: {
    eyebrow: 'Prepare',
    title: 'Mix the descaling solution',
    body: 'Dissolve 80 g of citric acid in 1,540 ml of soft or distilled water at 20–40 °C (5%). Use citric acid only — other descalers can damage the seals — and never more than 5% on a v1.0/v1.1 machine. Remove the steam tip, empty the drip tray and pour the solution into the water tank.'
  },
  descale: {
    eyebrow: 'Descale',
    title: 'Run the descale cycle',
    body: `The machine pumps the solution through the water lines, the steam line and the group for about 6 minutes; water trickles from the group. Empty the drip tray after each cycle. While solution is left you can run up to ${DESCALE_MAX_CYCLES} cycles.`
  },
  refill: {
    eyebrow: 'Rinse',
    title: 'Refill with fresh water',
    body: 'Turn the steam heater back on. Empty and clean the water tank, then fill it completely with fresh filtered water. The whole rinse takes about 7–8 litres.'
  },
  'rinse-group': {
    eyebrow: 'Rinse',
    title: 'Rinse the group',
    body: 'Flush water through the group until the tank runs dry and the machine asks for a refill. Refill with fresh water and repeat. Taste the water — if it is sour or smells of vitamin C, keep flushing.'
  },
  'rinse-steam': {
    eyebrow: 'Rinse',
    title: 'Rinse the steam line',
    body: `Keep the steam tip off. Run ${DESCALE_RINSE_STEAMS} steams of ${DESCALE_RINSE_STEAM_SECONDS} s each, then taste the water from the wand — if it is still sour, steam some more.`
  },
  done: {
    eyebrow: 'Done',
    title: 'Descaling complete',
    body: 'Screw the steam tip back on. Your steam settings are back to how they were.'
  }
};

export function renderDescaleWizardModal(model: DescaleWizardViewModel): string {
  const copy = STEP_COPY[model.step];
  const index = descaleWizardStepIndex(model.step);
  const done = model.step === 'done';
  const eyebrow = done
    ? copy.eyebrow
    : `Descaling · Step ${Math.min(index + 1, DESCALE_WIZARD_STEP_COUNT)} of ${DESCALE_WIZARD_STEP_COUNT}`;

  const dots = done
    ? ''
    : `<div class="cleaning-wizard-dots">${Array.from({ length: DESCALE_WIZARD_STEP_COUNT }, (_, i) => {
        const cls = i < index ? 'done' : i === index ? 'active' : '';
        return `<span class="cleaning-wizard-dot ${cls}"></span>`;
      }).join('')}</div>`;

  const back = index > 0 && !done
    ? `<button type="button" class="cleaning-wizard-btn ghost" data-action="descale-wizard-back">${icon('chevron-left')}<span>Back</span></button>`
    : '';
  const cancel = !done
    ? `<button type="button" class="cleaning-wizard-btn ghost" data-action="descale-wizard-cancel" title="End the guide and restore your steam settings">Cancel</button>`
    : '';
  const note = model.note ? `<p class="cleaning-wizard-note">${escapeHtml(model.note)}</p>` : '';
  const body = done && model.nextDueLabel
    ? `${copy.body} Next descale is due ${model.nextDueLabel}.`
    : copy.body;
  const { facts, primary, secondary } = stepControls(model);

  return `
    <div class="modal-backdrop cleaning-wizard-backdrop">
      <section class="modal panel cleaning-wizard-modal descale-wizard-modal" role="dialog" aria-modal="true" aria-labelledby="descale-wizard-title">
        <div class="modal-head cleaning-wizard-head">
          <div>
            <span class="cleaning-wizard-eyebrow">${escapeHtml(eyebrow)}</span>
            <h2 id="descale-wizard-title">${escapeHtml(copy.title)}</h2>
          </div>
          <button type="button" class="icon-button" data-action="close-modal" aria-label="Close and continue later">${icon('x')}</button>
        </div>
        <p class="cleaning-wizard-body">${escapeHtml(body)}</p>
        ${facts ? `<div class="descale-wizard-facts">${facts}</div>` : ''}
        ${note}
        ${dots}
        <div class="cleaning-wizard-actions">
          ${back}
          ${cancel}
          <span class="cleaning-wizard-spacer"></span>
          ${secondary}
          ${primary}
        </div>
      </section>
    </div>
  `;
}

interface StepControls {
  facts: string;
  primary: string;
  secondary: string;
}

function stepControls(model: DescaleWizardViewModel): StepControls {
  const disabled = model.busy ? 'disabled' : '';
  const next = (label = 'Next') =>
    `<button type="button" class="cleaning-wizard-btn primary" data-action="descale-wizard-next" ${disabled}><span>${escapeHtml(label)}</span>${icon('chevron-right')}</button>`;
  const ghostNext = (label: string) =>
    `<button type="button" class="cleaning-wizard-btn ghost" data-action="descale-wizard-next" ${disabled}>${escapeHtml(label)}</button>`;
  const action = (name: string, iconName: string, label: string) =>
    `<button type="button" class="cleaning-wizard-btn primary" data-action="${name}" ${disabled}>${icon(iconName)}<span>${escapeHtml(label)}</span></button>`;
  const spinner = (label: string) =>
    `<button type="button" class="cleaning-wizard-btn primary" disabled><span class="cleaning-wizard-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></button>`;

  switch (model.step) {
    case 'cool-down': {
      const temp = model.steamTemperatureC == null ? '–' : `${Math.round(model.steamTemperatureC)} °C`;
      const facts = [
        fact('thermometer', 'Steam heater', temp, model.stepMet),
        fact('power', 'Heater', model.steamHeaterOn ? 'On' : 'Off', !model.steamHeaterOn)
      ].join('');
      if (model.steamHeaterOn) {
        return { facts, primary: action('descale-wizard-heater-off', 'power', 'Turn steam heater off'), secondary: ghostNext('Skip') };
      }
      return { facts, primary: model.stepMet ? next() : next('Continue anyway'), secondary: '' };
    }
    case 'descale': {
      const facts = fact('beaker', 'Cycles done', `${model.cyclesDone} of up to ${DESCALE_MAX_CYCLES}`, model.cyclesDone >= 1);
      if (model.descaling) return { facts, primary: spinner('Descaling…'), secondary: ghostNext('Skip ▸') };
      if (model.cyclesDone === 0) {
        return { facts, primary: action('descale-wizard-start', 'beaker', 'Start descale'), secondary: ghostNext('Skip') };
      }
      const another = model.cyclesDone < DESCALE_MAX_CYCLES
        ? `<button type="button" class="cleaning-wizard-btn ghost" data-action="descale-wizard-start" ${disabled}>Run another cycle</button>`
        : '';
      return { facts, primary: next('Continue to rinse'), secondary: another };
    }
    case 'refill': {
      const facts = fact('power', 'Steam heater', model.steamHeaterOn ? 'On' : 'Off', model.steamHeaterOn);
      if (!model.steamHeaterOn) {
        return { facts, primary: action('descale-wizard-heater-on', 'power', 'Turn steam heater on'), secondary: ghostNext('Skip') };
      }
      return { facts, primary: next(), secondary: '' };
    }
    case 'rinse-group': {
      const facts = fact('droplets', 'Tank run dry', `${model.groupRefills}×`, model.groupRefills >= 1);
      if (model.hasGhc) {
        return { facts: facts + hint('Start the flushes on the group-head controller.'), primary: next('Tastes clean'), secondary: '' };
      }
      return {
        facts,
        primary: next('Tastes clean'),
        secondary: `<button type="button" class="cleaning-wizard-btn ghost" data-action="descale-wizard-flush" ${disabled}>${icon('droplet')}<span>Run flush</span></button>`
      };
    }
    case 'rinse-steam': {
      const timeOk = model.steamTimeSeconds === DESCALE_RINSE_STEAM_SECONDS;
      const facts = [
        fact('waves', 'Steams', `${Math.min(model.steamRuns, DESCALE_RINSE_STEAMS)} of ${DESCALE_RINSE_STEAMS}`, model.stepMet),
        fact('timer', 'Steam time', model.steamTimeSeconds == null ? '–' : `${Math.round(model.steamTimeSeconds)} s`, timeOk)
      ].join('');
      if (!timeOk) {
        return {
          facts,
          primary: action('descale-wizard-steam-time', 'timer', `Set steam to ${DESCALE_RINSE_STEAM_SECONDS} s`),
          secondary: ghostNext('Skip')
        };
      }
      const ghc = model.hasGhc ? hint('Start each steam on the group-head controller.') : '';
      const start = model.hasGhc
        ? ''
        : `<button type="button" class="cleaning-wizard-btn ghost" data-action="descale-wizard-steam" ${disabled}>${icon('waves')}<span>Run steam</span></button>`;
      return { facts: facts + ghc, primary: next('Tastes clean'), secondary: start };
    }
    case 'done':
      return {
        facts: '',
        primary: `<button type="button" class="cleaning-wizard-btn primary" data-action="descale-wizard-finish" ${disabled}>${icon('check')}<span>Done</span></button>`,
        secondary: ''
      };
    case 'solution':
      return { facts: '', primary: next(), secondary: '' };
  }
}

function fact(iconName: string, label: string, value: string, met: boolean): string {
  return `<div class="descale-wizard-fact ${met ? 'met' : ''}">${icon(met ? 'circle-check' : iconName)}<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function hint(text: string): string {
  return `<p class="cleaning-wizard-hint">${escapeHtml(text)}</p>`;
}
