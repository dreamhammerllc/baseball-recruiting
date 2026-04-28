export const METRIC_KEYS = [
  'sixty_yard_dash', 'exit_velocity', 'launch_angle', 'distance', 'vertical_jump', 'bat_speed',
  'fastball_velocity', 'curveball_velocity', 'slider_velocity', 'changeup_velocity',
  'spin_rate', 'vertical_break', 'horizontal_break',
  'pop_time', 'catcher_throwing_velocity',
  'infield_throwing_velocity', 'outfield_throwing_velocity',
] as const;

export type MetricKey = typeof METRIC_KEYS[number];

export const POSITIONS = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'OF', 'DH', 'UTIL', 'TWP'] as const;
export type Position = typeof POSITIONS[number];

export const VERIFICATION_TYPES = [
  'coach_verified',
  'third_party_hittrax',
  'third_party_rapsodo',
  'third_party_blast_motion',
  'third_party_perfect_game',
  'self_reported',
] as const;
export type VerificationType = typeof VERIFICATION_TYPES[number];

// ─── Metric Info ─────────────────────────────────────────────────────────────

export const METRIC_INFO: Record<MetricKey, { label: string; unit: string; lowerIsBetter: boolean; description: string }> = {
  sixty_yard_dash:           { label: 'sixty Yard Dash',                unit: 's',   lowerIsBetter: true,  description: 'Sprint from home plate to second base' },
  exit_velocity:             { label: 'Exit Velocity',                   unit: 'mph', lowerIsBetter: false, description: 'Maximum batted ball exit speed' },
  launch_angle:              { label: 'Launch Angle',                    unit: 'deg', lowerIsBetter: false, description: 'Average batted ball launch angle' },
  distance:                  { label: 'Distance',                        unit: 'ft',  lowerIsBetter: false, description: 'Average batted ball distance' },
  vertical_jump:             { label: 'Vertical Jump',                   unit: 'in',  lowerIsBetter: false, description: 'Vertical leap from flat foot' },
  bat_speed:                 { label: 'Bat Speed',                       unit: 'mph', lowerIsBetter: false, description: 'Bat head speed through the hitting zone' },
  fastball_velocity:         { label: 'Fastball Velocity',               unit: 'mph', lowerIsBetter: false, description: 'Four-seam fastball velocity' },
  curveball_velocity:        { label: 'Curveball Velocity',              unit: 'mph', lowerIsBetter: false, description: 'Curveball pitch velocity' },
  slider_velocity:           { label: 'Slider Velocity',                 unit: 'mph', lowerIsBetter: false, description: 'Slider pitch velocity' },
  changeup_velocity:         { label: 'Changeup Velocity',               unit: 'mph', lowerIsBetter: false, description: 'Changeup pitch velocity' },
  spin_rate:                 { label: 'Spin Rate',                       unit: 'rpm', lowerIsBetter: false, description: 'Pitch spin rate' },
  vertical_break:            { label: 'Vertical Break',                  unit: 'in',  lowerIsBetter: false, description: 'Vertical movement on pitch' },
  horizontal_break:          { label: 'Horizontal Break',                unit: 'in',  lowerIsBetter: false, description: 'Horizontal movement on pitch' },
  pop_time:                  { label: 'Pop Time',                        unit: 's',   lowerIsBetter: true,  description: 'Time from catch to tag at second base' },
  catcher_throwing_velocity: { label: 'Catcher Throwing Velocity',       unit: 'mph', lowerIsBetter: false, description: 'Catcher arm strength throwing to second' },
  infield_throwing_velocity: { label: 'Infield Throwing Velocity',       unit: 'mph', lowerIsBetter: false, description: 'Infield arm strength across the diamond' },
  outfield_throwing_velocity:{ label: 'Outfield Throwing Velocity',      unit: 'mph', lowerIsBetter: false, description: 'Outfield arm strength throwing to home' },
};

// ─── Universal metrics (all positions) ───────────────────────────────────────

export const UNIVERSAL_METRICS: MetricKey[] = [
  'sixty_yard_dash',
  'exit_velocity',
  'launch_angle',
  'distance',
  'vertical_jump',
  'bat_speed',
];

// ─── Pitcher metrics (used by P and TWP) ─────────────────────────────────────

const PITCHER_METRICS: MetricKey[] = [
  'fastball_velocity',
  'curveball_velocity',
  'slider_velocity',
  'changeup_velocity',
  'spin_rate',
  'vertical_break',
  'horizontal_break',
];

// ─── Position additional metrics ─────────────────────────────────────────────

export const POSITION_ADDITIONAL_METRICS: Record<Position, MetricKey[]> = {
  P:    PITCHER_METRICS,
  C:    ['pop_time', 'catcher_throwing_velocity', 'infield_throwing_velocity'],
  '1B': ['infield_throwing_velocity'],
  '2B': ['infield_throwing_velocity'],
  SS:   ['infield_throwing_velocity'],
  '3B': ['infield_throwing_velocity'],
  LF:   ['outfield_throwing_velocity'],
  CF:   ['outfield_throwing_velocity'],
  RF:   ['outfield_throwing_velocity'],
  OF:   ['outfield_throwing_velocity'],
  DH:   [],
  UTIL: [],
  TWP:  [...PITCHER_METRICS, 'infield_throwing_velocity'],
};

// ─── Helper: deduped union of universal + position metrics ───────────────────

export function getMetricsForPositions(
  primary: Position,
  secondary?: Position | null,
): MetricKey[] {
  const seen = new Set<MetricKey>();
  const result: MetricKey[] = [];

  const add = (keys: MetricKey[]) => {
    for (const k of keys) {
      if (!seen.has(k)) {
        seen.add(k);
        result.push(k);
      }
    }
  };

  add(UNIVERSAL_METRICS);
  add(POSITION_ADDITIONAL_METRICS[primary]);
  if (secondary) {
    add(POSITION_ADDITIONAL_METRICS[secondary]);
  }

  return result;
}

// ─── Verification labels ──────────────────────────────────────────────────────

export const VERIFICATION_LABELS: Record<VerificationType, { label: string; shortLabel: string; color: string }> = {
  coach_verified:              { label: 'Coach Verified',               shortLabel: 'Coach',        color: '#e8a020' },
  third_party_hittrax:         { label: '3rd Party - HitTrax',          shortLabel: 'HitTrax',      color: '#58a6ff' },
  third_party_rapsodo:         { label: '3rd Party - Rapsodo',          shortLabel: 'Rapsodo',      color: '#58a6ff' },
  third_party_blast_motion:    { label: '3rd Party - Blast Motion',     shortLabel: 'Blast Motion', color: '#58a6ff' },
  third_party_perfect_game:    { label: '3rd Party - Perfect Game',     shortLabel: 'Perfect Game', color: '#58a6ff' },
  self_reported:               { label: 'Self Reported',                shortLabel: 'Self',         color: '#6b7280' },
};

// ─── TypeScript interfaces ────────────────────────────────────────────────────

export interface AthleteMetric {
  id: string;
  athlete_clerk_id: string;
  metric_key: MetricKey;
  value: number;
  unit: string;
  verification_type: VerificationType;
  source_label: string | null;
  ai_confidence: number | null;
  is_personal_best: boolean;
  video_url: string | null;
  session_id: string | null;
  recorded_at: string;
  created_at: string;
}

export interface MetricSession {
  id: string;
  athlete_clerk_id: string;
  coach_clerk_id: string | null;
  session_date: string;
  verification_type: VerificationType;
  status: 'pending' | 'verified' | 'rejected';
  notes: string | null;
  document_url: string | null;
  created_at: string;
}

export interface AthletePosition {
  athlete_clerk_id: string;
  primary_position: Position;
  secondary_position: Position | null;
  updated_at: string;
}

export interface HighlightVideo {
  id: string;
  athlete_clerk_id: string;
  slot_number: number;
  video_url: string;
  title: string | null;
  uploaded_at: string;
}

// ─── Bunny CDN helpers ────────────────────────────────────────────────────────

export const BUNNY_CDN_BASE = process.env.BUNNY_CDN_HOSTNAME
  ? `https://${process.env.BUNNY_CDN_HOSTNAME}`
  : 'https://diamond-verified-cdn.b-cdn.net';

export function getBunnyVideoPath(athleteClerkId: string, metricKey: MetricKey): string {
  return `/athletes/${athleteClerkId}/${metricKey}/best.mp4`;
}

export function getBunnyHighlightPath(athleteClerkId: string, slot: number): string {
  return `/athletes/${athleteClerkId}/highlights/${slot}.mp4`;
}

export function getBunnyCoachVerificationPath(coachClerkId: string, athleteClerkId: string, metricKey: MetricKey): string {
  return `/coaches/${coachClerkId}/${athleteClerkId}/${metricKey}.mp4`;
}
