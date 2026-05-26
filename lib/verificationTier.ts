/**
 * Verification trust tier — the 7-rung ladder used to rank how trustworthy a
 * single published metric is. Lower numbers are stronger.
 *
 *   1  coach   + device-corroborated + video    (strongest)
 *   2  coach   + device-corroborated + no video
 *   3  athlete + device-corroborated + video
 *   4  athlete + device-corroborated + no video
 *   5  coach   + not corroborated    + video
 *   6  coach   + not corroborated    + no video
 *   7  athlete + not corroborated    (video is ignored at this rung)
 *
 * Pure module: no imports, no I/O, no side effects. Safe to call from any
 * surface (server route, client component, test). The mapping lives here so
 * the decision logic can change in one place and every caller stays in sync.
 */

export type VerificationTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ComputeVerificationTierParams {
  submittedBy:        'coach' | 'athlete';
  deviceCorroborated: boolean;
  hasVideo:           boolean;
}

export function computeVerificationTier(
  params: ComputeVerificationTierParams,
): VerificationTier {
  const { submittedBy, deviceCorroborated, hasVideo } = params;

  // Athlete + not corroborated collapses to the weakest rung regardless of
  // whether a video was attached — self-reported with no device evidence is
  // the floor of the ladder.
  if (submittedBy === 'athlete' && !deviceCorroborated) {
    return 7;
  }

  if (deviceCorroborated) {
    if (submittedBy === 'coach')   return hasVideo ? 1 : 2;
    /* submittedBy === 'athlete' */ return hasVideo ? 3 : 4;
  }

  // Not corroborated, coach-submitted (athlete branch handled above).
  return hasVideo ? 5 : 6;
}
