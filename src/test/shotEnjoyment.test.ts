import type { ShotRecord } from '../api/types';
import { ENJOYMENT_MAX, enjoymentOnTenScale } from '../domain/shotEnjoyment';
import { shotEditDraftFromShot } from '../domain/shotEditModel';

run('enjoymentOnTenScale keeps 0-10 ratings and the unrated values as they are', () => {
  equal(ENJOYMENT_MAX, 10);
  equal(enjoymentOnTenScale(null), null);
  equal(enjoymentOnTenScale(undefined), null);
  equal(enjoymentOnTenScale(Number.NaN), null);
  equal(enjoymentOnTenScale(0), 0);
  equal(enjoymentOnTenScale(2), 2);
  equal(enjoymentOnTenScale(7.5), 7.5);
  equal(enjoymentOnTenScale(10), 10);
});

run('enjoymentOnTenScale rescales legacy 0-100 ratings like the Decaid migration', () => {
  equal(enjoymentOnTenScale(80), 8);
  equal(enjoymentOnTenScale(75), 7.5);
  equal(enjoymentOnTenScale(100), 10);
  equal(enjoymentOnTenScale(250), 10);
});

run('the shot editor draft never carries a rating the gateway would reject', () => {
  equal(shotEditDraftFromShot(shot(80)).enjoyment, 8);
  equal(shotEditDraftFromShot(shot(6)).enjoyment, 6);
  equal(shotEditDraftFromShot(shot(null)).enjoyment, null);
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
