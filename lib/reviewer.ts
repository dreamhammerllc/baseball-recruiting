/**
 * Reviewer gate.
 *
 * The reviewer queue and the resolve (approve / reject) endpoints for flagged
 * verifications are gated by this single check. At launch, the only signal
 * is `coaches.is_reviewer = true` on the coach row matching the signed-in
 * Clerk user — no Clerk metadata role, no separate reviewer table, no
 * env allowlist. Dream toggles the flag by hand in Supabase.
 *
 * Fail-closed: any missing input, missing coach row, or DB error returns
 * false. Callers can treat a `false` return as "deny access" without further
 * inspection.
 */

import { createAdminClient } from '@/lib/supabase';

export async function isReviewer(clerkUserId: string): Promise<boolean> {
  if (!clerkUserId) return false;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('coaches')
      .select('is_reviewer')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (error) {
      console.error('[lib/reviewer] is_reviewer lookup error:', error.message);
      return false;
    }

    return data?.is_reviewer === true;
  } catch (err) {
    console.error('[lib/reviewer] is_reviewer lookup threw:', err);
    return false;
  }
}
