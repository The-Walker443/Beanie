import type { RecipeDraft, ShotRecord } from '../api/types';

// Fork customization A1 (FORK.md): a history shot row reads
//   "59s · 4.0"                 duration · grind setting
//   "18. Okt. 13:08 · D-Flow"   date and time · profile
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
  upstream: UpstreamShotRowParts
): ShotRowText {
  const title = [upstream.duration, grindSettingLabel(recipe.grinderSetting)].filter(Boolean).join(' · ');
  const when = shotDateTimeLabel(shot.timestamp) ?? upstream.date;
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

/** "18. Okt. 13:08" in German, "Oct 18 1:08 PM" in US English: the runtime locale decides. */
export function shotDateTimeLabel(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return null;
  const day = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}
