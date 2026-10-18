import {
  forkShotListRowText,
  grindSettingLabel,
  relativeDayLabel,
  shotDateTimeLabel,
  shotRowDayKey
} from '../views/forkShotListRow';

const upstream = { recipeText: '18g → 35.6g', duration: '59s', freshness: '68d', date: 'Oct 18' };
// Weeks after the fixture shots, so their rows show a date rather than today/yesterday.
const later = new Date('2026-11-30T12:00:00.000Z');

run('grind settings read with at least one decimal, other text as entered', () => {
  equal(grindSettingLabel('4'), '4.0');
  equal(grindSettingLabel('3.9'), '3.9');
  equal(grindSettingLabel(' 12 '), '12.0');
  equal(grindSettingLabel('2.25'), '2.25');
  equal(grindSettingLabel('1-3'), '1-3');
  equal(grindSettingLabel(''), null);
  equal(grindSettingLabel(null), null);
});

run('the row title is duration · grind, the subtitle date and time · profile', () => {
  const row = forkShotListRowText(
    { timestamp: '2026-10-18T11:08:00.000Z' },
    { profileTitle: 'D-Flow', grinderSetting: '4' },
    upstream,
    later
  );

  equal(row.title, '59s · 4.0');
  equal(row.subtitle, `${shotDateTimeLabel('2026-10-18T11:08:00.000Z', later)} · D-Flow`);
});

run('the row drops what a shot does not have, keeping upstream text as the last resort', () => {
  const timestamp = '2026-10-18T11:08:00.000Z';
  equal(forkShotListRowText({ timestamp }, { profileTitle: 'D-Flow', grinderSetting: null }, upstream).title, '59s');
  equal(
    forkShotListRowText({ timestamp }, { profileTitle: null, grinderSetting: '4' }, { ...upstream, duration: null }).title,
    '4.0'
  );
  equal(
    forkShotListRowText({ timestamp }, { profileTitle: null, grinderSetting: null }, { ...upstream, duration: null }).title,
    '18g → 35.6g'
  );
  equal(
    forkShotListRowText({ timestamp: 'not a date' }, { profileTitle: null, grinderSetting: null }, upstream).subtitle,
    'Oct 18 · No profile'
  );
});

run('date and time follow the runtime locale', () => {
  const at = new Date('2026-10-18T11:08:00.000Z');
  const expected = `${at.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  equal(shotDateTimeLabel(at.toISOString(), later), expected);
  equal(shotDateTimeLabel('garbage', later), null);
});

run("today's and yesterday's shots read as words instead of a date", () => {
  const now = new Date(2026, 9, 18, 20, 0);
  const time = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const today = new Date(2026, 9, 18, 0, 5);
  const yesterday = new Date(2026, 9, 17, 23, 55);
  const twoDaysAgo = new Date(2026, 9, 16, 12, 0);

  equal(shotDateTimeLabel(today.toISOString(), now), `${relativeDayLabel(today, now)} ${time(today)}`);
  equal(shotDateTimeLabel(yesterday.toISOString(), now), `${relativeDayLabel(yesterday, now)} ${time(yesterday)}`);
  equal(relativeDayLabel(twoDaysAgo, now), null);
  equal(relativeDayLabel(new Date(2026, 9, 19, 8, 0), now), null);

  const language = new Intl.RelativeTimeFormat([]).resolvedOptions().locale.slice(0, 2);
  if (language === 'de') {
    equal(relativeDayLabel(today, now), 'Heute');
    equal(relativeDayLabel(yesterday, now), 'Gestern');
  } else if (language === 'en') {
    equal(relativeDayLabel(today, now), 'Today');
    equal(relativeDayLabel(yesterday, now), 'Yesterday');
  }
});

run('yesterday is a calendar day, also across a daylight-saving switch', () => {
  // Europe leaves summer time on 25 Oct 2026; elsewhere these are ordinary days.
  equal(relativeDayLabel(new Date(2026, 9, 25, 23, 0), new Date(2026, 9, 26, 0, 30)) !== null, true);
  equal(relativeDayLabel(new Date(2026, 9, 24, 23, 59), new Date(2026, 9, 26, 0, 1)), null);
  equal(
    relativeDayLabel(new Date(2026, 9, 25, 1, 0), new Date(2026, 9, 26, 0, 30)),
    relativeDayLabel(new Date(2026, 9, 17, 1, 0), new Date(2026, 9, 18, 0, 30))
  );
});

run('the row day key changes at local midnight, not within a day', () => {
  equal(shotRowDayKey(new Date(2026, 9, 18, 0, 1)), shotRowDayKey(new Date(2026, 9, 18, 23, 59)));
  equal(shotRowDayKey(new Date(2026, 9, 18, 23, 59)) === shotRowDayKey(new Date(2026, 9, 19, 0, 1)), false);
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
