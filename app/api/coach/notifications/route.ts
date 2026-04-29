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
  } catch { return null; }
}

// POST /api/coach/notifications — save notification preferences
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const prefs = await req.json();
  const db = createAdminClient();

  const { error } = await db
    .from('coaches')
    .update({ notification_preferences: prefs, updated_at: new Date().toISOString() })
    .eq('clerk_user_id', userId);

  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
