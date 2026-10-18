// Shot enjoyment lives on the gateway's 0-10 scale. Decaid 0.8.7 moved it there
// from de1app's 0-100 scale: its schema-6 migration rescales every stored
// rating above 10 (80 -> 8), and PUT /api/v1/shots/:id rejects anything above 10.
// 0 is the "not rated" value de1app imports use.
export const ENJOYMENT_MAX = 10;

const LEGACY_ENJOYMENT_MAX = 100;

/**
 * Puts a stored rating on the 0-10 scale. A value above 10 can only be a 0-100
 * rating from a gateway older than 0.8.7 (or a cache filled by one), so it is
 * rescaled the same way Decaid's migration does; every other value passes
 * through unchanged.
 */
export function enjoymentOnTenScale(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= ENJOYMENT_MAX) return value;
  return Math.min((value * ENJOYMENT_MAX) / LEGACY_ENJOYMENT_MAX, ENJOYMENT_MAX);
}
