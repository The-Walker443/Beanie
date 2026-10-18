// Fork customization A3 (FORK.md): the "Descaling" bar under the backflush
// cleaning bar on the Steam · Water · Flush page, and the dialog that records
// or corrects the last descale date. Reuses the cleaning bar's classes so both
// bars look alike; fork.css only adds what differs.

import { icon } from '../components/icons';
import { escapeAttr, escapeHtml } from '../components/html';
import { DESCALE_INTERVAL_OPTIONS, type DescaleStatus } from '../domain/forkDescale';

export interface DescaleBarViewModel {
  status: DescaleStatus;
  lastDescaledAt: string | null;
  interval: number;
  /** A guided descale was started and closed before it finished. */
  wizardPaused: boolean;
}

export function renderDescaleBar(model: DescaleBarViewModel): string {
  const due = model.status.kind === 'due';
  const soon = model.status.kind === 'soon';
  const last = model.lastDescaledAt ? descaleDateLabel(model.lastDescaledAt) : null;

  const intervalButtons = DESCALE_INTERVAL_OPTIONS.map((months) => {
    const active = model.interval === months;
    return `<button type="button" class="${active ? 'active' : ''}" data-action="descale-interval" data-value="${months}" aria-pressed="${active}">${
      months === 0 ? 'Off' : String(months)
    }</button>`;
  }).join('');

  const runLabel = model.wizardPaused ? 'Resume descale' : 'Run descale';
  return `
    <section class="cleaning-bar descale-bar ${due ? 'due' : ''} ${soon ? 'soon' : ''}">
      <div class="cleaning-bar-info">
        <span class="cleaning-bar-icon">${icon('beaker')}</span>
        <div class="cleaning-bar-text">
          <strong>Descaling</strong>
          <small class="${due ? 'due' : ''}">${escapeHtml(descaleStatusLine(model.status, last))}</small>
        </div>
      </div>
      <div class="cleaning-bar-field">
        <span>Last</span>
        <button type="button" class="cleaning-profile-button descale-date-button" data-action="descale-open-date" aria-label="${escapeAttr(last ? `Last descaled ${last}, change` : 'Set the last descale date')}">
          <span>${escapeHtml(last ?? 'Set date')}</span>
          ${icon('pencil')}
        </button>
      </div>
      <div class="cleaning-bar-field">
        <span>Remind · months</span>
        <div class="settings-segmented cleaning-threshold descale-interval" role="group" aria-label="Descaling reminder interval in months">${intervalButtons}</div>
      </div>
      <button type="button" class="cleaning-run" data-action="open-descale-wizard" title="Open the guided descale — cool the steam heater, citric acid solution, descale cycle, then rinse the group and the steam line. Your steam settings are restored afterwards.">
        ${icon('beaker')}<span>${escapeHtml(runLabel)}</span>
      </button>
    </section>`;
}

export function descaleStatusLine(status: DescaleStatus, lastLabel: string | null): string {
  const lastText = lastLabel ? `last descaled ${lastLabel}` : 'never recorded · set the date';
  switch (status.kind) {
    case 'off':
      return `${lastText} · reminder off`;
    case 'unknown':
      return lastText;
    case 'ok':
    case 'soon':
      return `${lastText} · due in ${durationLabel(status.daysLeft)}`;
    case 'due':
      return status.daysOverdue === 0
        ? `${lastText} · due today`
        : `${lastText} · overdue by ${durationLabel(status.daysOverdue)}`;
  }
}

export interface DescaleDateDialogViewModel {
  /** Pre-filled date, YYYY-MM-DD in local time. */
  value: string;
  /** Latest selectable date (today), YYYY-MM-DD. */
  max: string;
  note: string | null;
}

export function renderDescaleDateDialog(model: DescaleDateDialogViewModel): string {
  return `
    <div class="modal-backdrop descale-date-backdrop">
      <section class="modal panel descale-date-modal" role="dialog" aria-modal="true" aria-labelledby="descale-date-title">
        <div class="modal-head">
          <div>
            <span class="cleaning-wizard-eyebrow">Descaling</span>
            <h2 id="descale-date-title">When did you last descale?</h2>
          </div>
          <button type="button" class="icon-button" data-action="close-modal" aria-label="Close">${icon('x')}</button>
        </div>
        <label class="descale-date-field">
          <span>Date</span>
          <input type="date" data-field="descale-date" value="${escapeAttr(model.value)}" max="${escapeAttr(model.max)}" />
        </label>
        ${model.note ? `<p class="cleaning-wizard-note">${escapeHtml(model.note)}</p>` : ''}
        <div class="cleaning-wizard-actions">
          <button type="button" class="cleaning-wizard-btn ghost" data-action="descale-date-today">Today</button>
          <span class="cleaning-wizard-spacer"></span>
          <button type="button" class="cleaning-wizard-btn ghost" data-action="close-modal">Cancel</button>
          <button type="button" class="cleaning-wizard-btn primary" data-action="descale-date-save">${icon('check')}<span>Save</span></button>
        </div>
      </section>
    </div>
  `;
}

/** "3. Okt. 2026" in German, "Oct 3, 2026" in US English. */
export function descaleDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function durationLabel(days: number): string {
  if (days >= 60) {
    const months = Math.round(days / 30.44);
    return `${months} months`;
  }
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
