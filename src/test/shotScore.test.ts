import type { ShotRecord } from '../api/types';
import {
  enjoymentBadge,
  scoreOptionForValue,
  scoreValueFromTap,
  shotScoreControl
} from '../components/shotScore';

run('scoreOptionForValue maps imported values to the nearest label', () => {
  equal(scoreOptionForValue(null), null);
  equal(scoreOptionForValue(0), null);
  equal(scoreOptionForValue(7.4)?.label, 'Good');
  equal(scoreOptionForValue(9.9)?.label, 'Great');
});

run('scoreOptionForValue reads the gateway 0-10 scale, not everything as Bad', () => {
  equal(scoreOptionForValue(2)?.label, 'Bad');
  equal(scoreOptionForValue(4)?.label, 'Meh');
  equal(scoreOptionForValue(6)?.label, 'OK');
  equal(scoreOptionForValue(8)?.label, 'Good');
  equal(scoreOptionForValue(10)?.label, 'Great');
});

run('scoreOptionForValue still reads 0-100 ratings from pre-0.8.7 gateways', () => {
  equal(scoreOptionForValue(20)?.label, 'Bad');
  equal(scoreOptionForValue(74)?.label, 'Good');
  equal(scoreOptionForValue(100)?.label, 'Great');
});

run('score buttons write values the gateway accepts (0-10)', () => {
  const html = shotScoreControl(null, { action: 'set-shot-score', shotId: 'shot-1', variant: 'detail' });
  const values = [...html.matchAll(/data-value="([^"]+)"/g)].map((match) => Number(match[1]));

  equal(values.join(','), '2,4,6,8,10');
});

run('scoreValueFromTap toggles the active score and ignores bad input', () => {
  equal(scoreValueFromTap('8', null), 8);
  equal(scoreValueFromTap('8', 8), null);
  equal(scoreValueFromTap('8', 80), null);
  equal(scoreValueFromTap('nope', 8), null);
});

run('shotScoreControl escapes shot ids and marks the active word', () => {
  const html = shotScoreControl(8, {
    action: 'set-shot-score',
    shotId: 'shot-"1"',
    variant: 'detail'
  });

  includes(html, 'data-id="shot-&quot;1&quot;"');
  includes(html, 'shot-score-word good active');
});

run('enjoymentBadge renders empty row placeholders for unrated shots', () => {
  includes(enjoymentBadge(shot(null)), 'enjoyment-badge empty');
  equal(enjoymentBadge(shot(null), 'detail'), '');
  includes(enjoymentBadge(shot(10)), 'Great');
  includes(enjoymentBadge(shot(8)), 'Good');
});

function shot(enjoyment: number | null): ShotRecord {
  return {
    id: 'shot-1',
    timestamp: '2026-06-05T10:00:00.000Z',
    annotations: { enjoyment },
    measurements: []
  };
}

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

function includes(text: string, expected: string): void {
  if (!text.includes(expected)) {
    throw new Error(`Expected ${JSON.stringify(text.slice(0, 240))} to include ${expected}`);
  }
}
