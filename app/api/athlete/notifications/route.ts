/**
 * Run once in Supabase SQL editor if the column is missing:
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}';
 *
 * GET  /api/athlete/notifications  — returns current preferences
 * POST /api/athlete/notifications  — saves preferences (full replace)
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
    console.error('[athlete/notifications] auth error:', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('athletes')
    .select('notification_preferences')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[athlete/notifications] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to load preferences.' }, { status: 500 });
  }

  return NextResponse.json({ preferences: (data?.notification_preferences as Record<string, boolean>) ?? {} });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: Record<string, boolean>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('athletes')
    .update({ notification_preferences: body })
    .eq('clerk_user_id', userId);

  if (error) {
    console.error('[athlete/notifications] POST error:', error.message);
    return NextResponse.json({ error: 'Failed to save preferences.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
