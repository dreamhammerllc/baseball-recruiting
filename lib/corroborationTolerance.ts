/**
 * Corroboration tolerance — how close a coach's typed value must be to the
 * device-extracted value before we treat the two as "in agreement."
 *
 * Single source of truth shared by:
 *   - the live UI warning in the coach verify form (the gentle, non-blocking
 *     "Your entry differs from the device reading" message)
 *   - the server-side corroboration decision in verify-metric (the boolean
 *     that promotes a verification's trust tier when device-corroborated)
 *
 * Both surfaces import from this module so the warning the coach sees while
 * typing and the corroboration decision the server makes at submit time can
 * never disagree.
 *
 * These are STARTING VALUES and intentionally generous. Tune them later as
 * real device readouts come in — change only this file and both surfaces
 * stay in sync automatically.
 *
 * Pure module: no imports, no I/O, no side effects.
 *
 * Unit coverage today (from lib/metrics.METRIC_INFO):
 *   - "mph"               -> max(2, 3% of claimed)
 *   - "rpm"               -> 5% of claimed
 *   - "s" / "sec" / "seconds" -> 0.1 (absolute)
 *   - "deg", "ft", "in", "%", and any other unit -> 5% of claimed (default)
 */

export function corroborationToleranceFor(
  unit: string,
  claimedValue: number,
): number {
  const u = unit.trim().toLowerCase();

  switch (u) {
    case 'mph':
      // Pitch/exit/throw velocities: tolerate the larger of 2 mph or 3%.
      // 2 mph floor stops the 3% rule from getting tiny on low values.
      return Math.max(2, claimedValue * 0.03);

    case 'rpm':
      // Spin-rate readouts vary noticeably between devices.
      return claimedValue * 0.05;

    case 'sec':
    case 's':
    case 'seconds':
      // Sprint / pop times: 0.1 s is roughly one tenth, the standard rounding.
      return 0.1;

    default:
      // deg, ft, in, %, anything else — generic 5% band.
      return claimedValue * 0.05;
  }
}

export function isWithinCorroborationTolerance(
  unit:      string,
  claimed:   number,
  extracted: number,
): boolean {
  return Math.abs(claimed - extracted) <= corroborationToleranceFor(unit, claimed);
}
