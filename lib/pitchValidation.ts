import { PITCH_TYPES, VERIFICATION_TYPES } from '@/lib/metrics';

// Shared between /api/athlete/pitches/route.ts (POST) and
// /api/athlete/pitches/[id]/route.ts (PATCH). Hoisted out of the route files
// because Next.js 15's generated route-type shadows reject non-handler named
// exports from app/api/**/route.ts — keeping the helpers here also avoids
// duplicating ranges/labels across the two routes.

export const UPDATEABLE_FIELDS = [
  'pitch_slot',
  'pitch_type',
  'velocity',
  'spin_rate',
  'h_break',
  'v_break',
  'extension',
  'verification_type',
  'source_label',
  'video_url',
  'proof_url',
] as const;
export type UpdateableField = typeof UPDATEABLE_FIELDS[number];

export const REQUIRED_ON_CREATE: UpdateableField[] = [
  'pitch_slot',
  'pitch_type',
  'verification_type',
];

const MAX_SOURCE_LABEL_LEN = 200;
const MAX_VIDEO_URL_LEN    = 500;
const MAX_PROOF_URL_LEN    = 500;

const NUMERIC_RANGES: Record<string, [number, number]> = {
  velocity:  [0, 110],
  spin_rate: [0, 3500],
  h_break:   [-25, 25],
  v_break:   [-25, 25],
  extension: [4, 7],
};

/**
 * Per-field validation. Returns a human-readable error message string, or null
 * if the value is acceptable. `null` is the explicit "no measurement" value and
 * is accepted for telemetry fields and optional strings — required fields
 * (pitch_slot, pitch_type, verification_type) reject null via their typeof/range
 * checks.
 */
export function validatePitchField(field: UpdateableField, value: unknown): string | null {
  if (field === 'pitch_slot') {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) {
      return 'pitch_slot must be an integer between 1 and 5.';
    }
    return null;
  }
  if (field === 'pitch_type') {
    if (typeof value !== 'string' || !(PITCH_TYPES as readonly string[]).includes(value)) {
      return `pitch_type must be one of: ${PITCH_TYPES.join(', ')}.`;
    }
    return null;
  }
  if (field === 'verification_type') {
    if (typeof value !== 'string' || !(VERIFICATION_TYPES as readonly string[]).includes(value)) {
      return `verification_type must be one of: ${VERIFICATION_TYPES.join(', ')}.`;
    }
    return null;
  }
  if (
    field === 'velocity'  || field === 'spin_rate' ||
    field === 'h_break'   || field === 'v_break'   ||
    field === 'extension'
  ) {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${field} must be a finite number or null.`;
    }
    const [lo, hi] = NUMERIC_RANGES[field];
    if (value < lo || value > hi) {
      return `${field} must be between ${lo} and ${hi}.`;
    }
    return null;
  }
  if (field === 'source_label') {
    if (value === null) return null;
    if (typeof value !== 'string' || value.length > MAX_SOURCE_LABEL_LEN) {
      return `source_label must be a string (max ${MAX_SOURCE_LABEL_LEN} chars) or null.`;
    }
    return null;
  }
  if (field === 'video_url') {
    if (value === null) return null;
    if (typeof value !== 'string' || value.length > MAX_VIDEO_URL_LEN) {
      return `video_url must be a string (max ${MAX_VIDEO_URL_LEN} chars) or null.`;
    }
    return null;
  }
  if (field === 'proof_url') {
    if (value === null) return null;
    if (typeof value !== 'string' || value.length > MAX_PROOF_URL_LEN) {
      return `proof_url must be a string (max ${MAX_PROOF_URL_LEN} chars) or null.`;
    }
    return null;
  }
  return `Unknown field: ${field}.`;
}
