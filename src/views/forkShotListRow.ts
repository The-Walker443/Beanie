import type { RecipeDraft, ShotRecord } from '../api/types';

// Fork customizations A1 and A2 (FORK.md): a history shot row reads
//   "59s · 4.0"                 duration · grind setting
//   "18. Okt. 13:08 · D-Flow"   date and time · profile ("Heute"/"Gestern" for
//                               today's and yesterday's shots)
// instead of upstream's "18g → 35.6g @ 59s" over "68d · D-Flow · 18. Okt.".
// historyView keeps computing its own row parts and hands them over here, so
// upstream changes to those parts merge without touching this module.

export interface UpstreamShotRowParts {
  /** Upstream's "18g → 35.6g" text; the title when duration and grind are both unknown. */
  recipeText: string;
  /** "59s", or null while the shot has no duration. */
  duration: string | null;
  /** Upstream's roast-age badge, left out of the fork row. */
  freshness: string | null;
  /** Upstream's date-only label, replaced by date and time. */
  date: string | null;
}

export interface ShotRowText {
  title: string;
  subtitle: string;
}

export function forkShotListRowText(
  shot: Pick<ShotRecord, 'timestamp'>,
  recipe: Pick<RecipeDraft, 'profileTitle' | 'grinderSetting'>,
  upstream: UpstreamShotRowParts,
  now: Date = new Date()
): ShotRowText {
  const title = [upstream.duration, grindSettingLabel(recipe.grinderSetting)].filter(Boolean).join(' · ');
  const when = shotDateTimeLabel(shot.timestamp, now) ?? upstream.date;
  return {
    title: title || upstream.recipeText,
    subtitle: [when, recipe.profileTitle ?? 'No profile'].filter(Boolean).join(' · ')
  };
}

/** Numeric grind settings show at least one decimal ("4" → "4.0"); anything else as entered. */
export function grindSettingLabel(setting: string | null | undefined): string | null {
  const text = setting?.trim();
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return text;
  return text.includes('.') ? text : `${text}.0`;
}

/**
 * "Heute 13:08", "Gestern 13:08", then "18. Okt. 13:08" in German ("Today",
 * "Yesterday", "Oct 18" in US English): the runtime locale decides.
 */
export function shotDateTimeLabel(timestamp: string, now: Date = new Date()): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return null;
  const day = relativeDayLabel(date, now) ?? date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

/** The locale's word for today or yesterday, capitalised; null for any other day. */
export function relativeDayLabel(date: Date, now: Date): string | null {
  const daysAgo = calendarDaysBetween(date, now);
  if (daysAgo !== 0 && daysAgo !== 1) return null;
  const word = new Intl.RelativeTimeFormat([], { numeric: 'auto' }).format(-daysAgo, 'day');
  return word.charAt(0).toLocaleUpperCase() + word.slice(1);
}

/**
 * The local calendar day rows were rendered for. historyView memoizes rows per
 * shot, so it compares this key to drop "Heute" rows once the day has changed.
 */
export function shotRowDayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// Whole local calendar days from `earlier` to `later`; rounding absorbs the
// 23- and 25-hour days around daylight-saving switches.
function calendarDaysBetween(earlier: Date, later: Date): number {
  const start = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const end = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((end.valueOf() - start.valueOf()) / 86_400_000);
}
