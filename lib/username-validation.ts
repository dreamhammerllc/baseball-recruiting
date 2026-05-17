// Pure username validation logic. Importable by BOTH client components (the
// onboarding form) and server actions/route handlers (the canonical server-side
// chokepoint). No imports of next/server, Supabase, or Clerk — pure functions
// only so it can run in either environment.

// ── Reserved usernames ────────────────────────────────────────────────────────
// All lowercase. Three groups:
//  - System/route reservations: anything that is (or could become) a top-level
//    route segment, so a username can never shadow or be confused with a page.
//  - Brand reservations: protect the Diamond Verified name from impersonation.
//  - Generic-impersonation reservations: role/authority words that could be used
//    to impersonate staff, scouts, or the platform itself.

export const RESERVED_USERNAMES: readonly string[] = [
  // System / route reservations
  'admin', 'api', 'login', 'signup', 'sign-in', 'sign-up',
  'dashboard', 'profile', 'onboarding', 'settings', 'billing', 'terms',
  'privacy', 'support', 'help', 'about', 'contact', 'home', 'search',
  'discover', 'saved', 'verifications', 'coach', 'athlete', 'scout',
  'official', 'verified', 'team', 'staff',

  // Brand reservations
  'diamondverified', 'diamondverifiedofficial', 'dv', 'dvofficial',
  'diamondverified_official', 'diamond_verified',

  // Generic-impersonation reservations
  'recruiter', 'scoutmaster', 'headcoach', 'moderator', 'root', 'system',
  'null', 'undefined', 'anonymous',
] as const;

const RESERVED_SET = new Set(RESERVED_USERNAMES);

// ── Format ────────────────────────────────────────────────────────────────────
// ASCII lowercase alphanumeric + underscore + hyphen. Must start with a letter,
// no consecutive separators, no trailing separator. Length (3–30) is checked
// separately in validateUsername so the error message can be specific.

export const USERNAME_REGEX = /^[a-z][a-z0-9]*([_-][a-z0-9]+)*$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

// ── validateUsername ──────────────────────────────────────────────────────────
// Lowercases the input first so callers don't have to. Check order is
// length → format → reserved, so the most fundamental problem is reported first.

export interface UsernameValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateUsername(value: string): UsernameValidationResult {
  const username = (value ?? '').toLowerCase();

  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      reason: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Username must be no more than ${USERNAME_MAX_LENGTH} characters.`,
    };
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      reason:
        'Username must start with a letter and use only lowercase letters, ' +
        'numbers, single underscores or hyphens (no spaces, no leading/trailing ' +
        'or repeated separators).',
    };
  }

  if (RESERVED_SET.has(username)) {
    return {
      valid: false,
      reason: 'That username is reserved. Please choose a different one.',
    };
  }

  return { valid: true };
}

// ── suggestUsername ───────────────────────────────────────────────────────────
// Generates a lowercase `first_last` starter handle for the onboarding form.
// If taken, appends 2, 3, … until an available, valid candidate is found.
// `takenChecker` resolves true when a candidate is already in use.
//
// Name parts are reduced to ASCII [a-z0-9] so the seed is always regex-valid
// (handles apostrophes, accents, spaces, etc. in real names). Falls back to a
// safe base when a name sanitizes to nothing.

export type TakenChecker = (candidate: string) => Promise<boolean>;

function sanitizeNamePart(part: string): string {
  return (part ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

function clampToMax(base: string, suffix: string): string {
  // Ensure base + numeric suffix never exceeds USERNAME_MAX_LENGTH by trimming
  // the base, not the suffix (the suffix is what makes it unique).
  const room = USERNAME_MAX_LENGTH - suffix.length;
  return base.slice(0, Math.max(1, room)) + suffix;
}

export async function suggestUsername(
  firstName: string,
  lastName: string,
  takenChecker: TakenChecker,
): Promise<string> {
  const first = sanitizeNamePart(firstName);
  const last = sanitizeNamePart(lastName);

  // Build the preferred `first_last`; degrade gracefully if a part is empty.
  let base =
    first && last ? `${first}_${last}` : first || last || 'athlete';

  // Guarantee the base alone satisfies the regex (must start with a letter,
  // must be within max length). A leading digit can only happen if both name
  // parts were empty/numeric — fall back to a safe prefix in that case.
  if (!/^[a-z]/.test(base)) base = `athlete_${base}`;
  base = base.slice(0, USERNAME_MAX_LENGTH);

  // Try the bare base first, then base2, base3, … with a defensive upper bound
  // so a pathological "all taken" state can't spin forever.
  for (let n = 1; n <= 9999; n++) {
    const candidate = n === 1 ? base : clampToMax(base, String(n));
    if (validateUsername(candidate).valid && !(await takenChecker(candidate))) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: append a high-entropy numeric suffix.
  return clampToMax(base, String(Date.now()).slice(-6));
}
