'use server';

import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { validateUsername } from '@/lib/username-validation';

// Canonical server-side username chokepoint for the onboarding flow.
//
// Returns plain `{ ok, error }` objects (NOT the apiError/NextResponse shape) —
// these are React server actions consumed directly by a client component, not
// HTTP route handlers.

// ── isUsernameTaken ───────────────────────────────────────────────────────────
// Case-insensitive existence check. Usernames are stored lowercase (seed-script
// convention + setUsername lowercases on write) and migration 010 enforces
// case-insensitive uniqueness, so an exact `.eq` on the lowered value is
// correct. Deliberately NOT `.ilike`: usernames legally contain `_`, which
// ILIKE treats as a single-char wildcard ('a_b' would match 'axb').
export async function isUsernameTaken(candidate: string): Promise<boolean> {
  const lowered = (candidate ?? '').toLowerCase();
  if (!lowered) return false;

  const db = createAdminClient();
  const { data } = await db
    .from('athletes')
    .select('clerk_user_id')
    .eq('username', lowered)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

// ── checkUsernameAvailable ────────────────────────────────────────────────────
// Debounced availability probe for the form. Re-validates server-side so we
// never query with malformed input; the client also validates for instant
// feedback.
export async function checkUsernameAvailable(
  raw: string,
): Promise<{ available: boolean }> {
  const lowered = (raw ?? '').toLowerCase();
  if (!validateUsername(lowered).valid) return { available: false };
  return { available: !(await isUsernameTaken(lowered)) };
}

// ── setUsername ───────────────────────────────────────────────────────────────
// Option A: upsert the athletes row (it may not exist yet — rows are created
// lazily by the calculator action). Clerk is written FIRST so the identity
// provider is the source of truth; only on success do we persist to Supabase.
// Race-guard: we never overwrite an already-set username.
export async function setUsername(
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };
  const userId = user.id;

  const lowered = (raw ?? '').toLowerCase();

  const v = validateUsername(lowered);
  if (!v.valid) return { ok: false, error: v.reason ?? 'Invalid username.' };

  // Defense-in-depth; the DB unique index on lower(username) is the real guard.
  if (await isUsernameTaken(lowered)) {
    return { ok: false, error: 'That username is already taken.' };
  }

  const db = createAdminClient();

  // Race-guard: if a row already exists WITH a username, refuse to overwrite.
  const { data: existing } = await db
    .from('athletes')
    .select('username')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (existing?.username != null) {
    return {
      ok: false,
      error: "You already have a username — it can't be changed.",
    };
  }

  // Clerk FIRST. May reject if the username collides with another Clerk user
  // or the username feature is disabled on the instance.
  try {
    const client = await clerkClient();
    await client.users.updateUser(userId, { username: lowered });
  } catch (e) {
    console.error('[onboarding/username] Clerk updateUser failed:', e);
    return {
      ok: false,
      error:
        'Could not reserve that username. It may already be in use. Please try another.',
    };
  }

  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  // Upsert: insert the row if the athlete never ran the calculator, or update
  // the existing (username-null) row. onConflict on clerk_user_id.
  const { error: dbError } = await db
    .from('athletes')
    .upsert(
      { clerk_user_id: userId, username: lowered, email },
      { onConflict: 'clerk_user_id' },
    );

  if (dbError) {
    // Clerk already has the username; surface a retryable error. The next
    // submit re-validates and the upsert is idempotent for this user.
    console.error('[onboarding/username] Supabase upsert failed:', dbError);
    return { ok: false, error: 'Could not save your username. Please try again.' };
  }

  return { ok: true };
}
