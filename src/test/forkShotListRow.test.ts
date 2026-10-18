import { forkShotListRowText, grindSettingLabel, shotDateTimeLabel } from '../views/forkShotListRow';

const upstream = { recipeText: '18g → 35.6g', duration: '59s', freshness: '68d', date: 'Oct 18' };

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
    upstream
  );

  equal(row.title, '59s · 4.0');
  equal(row.subtitle, `${shotDateTimeLabel('2026-10-18T11:08:00.000Z')} · D-Flow`);
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

  equal(shotDateTimeLabel(at.toISOString()), expected);
  equal(shotDateTimeLabel('garbage'), null);
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
