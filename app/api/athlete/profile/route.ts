/**
 * Run once in Supabase SQL editor if columns are missing:
 *
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS photo_url          text;
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS highlight_video_url text;
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS bio                 text;
 *
 * GET  /api/athlete/profile  — returns the signed-in athlete's row
 * PATCH /api/athlete/profile — updates allowed profile fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  try {
    const state = await clerk.authenticateRequest(req, {
      secretKey:      process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
    if (!state.isSignedIn) return null;
    return state.toAuth().userId;
  } catch (err) {
    console.error('[athlete/profile] auth error:', err);
    return null;
  }
}

const PROFILE_FIELDS = [
  'clerk_user_id',
  'username',
  'full_name',
  'grad_year',
  'position',
  'secondary_position',
  'height_inches',
  'weight_lbs',
  'throws',
  'bats',
  'gpa_weighted',
  'gpa_unweighted',
  'home_state',
  'highlight_video_url',
  'division_pref',
  'photo_url',
  'bio',
  'subscription_tier',
  'notification_preferences',
  'gamechanger_url',
  'iscore_url',
  'perfectgame_url',
] as const;

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('athletes')
    .select(PROFILE_FIELDS.join(', '))
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[athlete/profile] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to load profile.' }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

const ALLOWED_PATCH_FIELDS = new Set([
  'full_name',
  'grad_year',
  'position',
  'secondary_position',
  'height_inches',
  'weight_lbs',
  'throws',
  'bats',
  'gpa_weighted',
  'gpa_unweighted',
  'home_state',
  'highlight_video_url',
  'photo_url',
  'bio',
  'gamechanger_url',
  'iscore_url',
  'perfectgame_url',
]);

const URL_FIELDS = new Set(['gamechanger_url', 'iscore_url', 'perfectgame_url', 'highlight_video_url']);

function isValidUrl(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return true;
  if (typeof val !== 'string') return false;
  try {
    const u = new URL(val);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Strip any fields the client is not allowed to update
  const update: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body)) {
    if (ALLOWED_PATCH_FIELDS.has(key)) update[key] = val;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 });
  }

  for (const [key, val] of Object.entries(update)) {
    if (URL_FIELDS.has(key) && !isValidUrl(val)) {
      return NextResponse.json({ error: `Invalid URL for field: ${key}` }, { status: 400 });
    }
  }

  const db = createAdminClient();
  const { error } = await db
    .from('athletes')
    .update(update)
    .eq('clerk_user_id', userId);

  if (error) {
    console.error('[athlete/profile] PATCH error:', error.message);
    return NextResponse.json({ error: 'Failed to save profile.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
