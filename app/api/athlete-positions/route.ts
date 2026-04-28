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
    console.error('[athlete-positions] authenticateRequest error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let primaryPosition: string;
  let secondaryPosition: string | null;

  try {
    const body = await req.json();
    primaryPosition   = body.primaryPosition;
    secondaryPosition = body.secondaryPosition ?? null;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!primaryPosition || typeof primaryPosition !== 'string') {
    return NextResponse.json({ error: 'primaryPosition is required.' }, { status: 400 });
  }

  const db = createAdminClient();

  const { error } = await db
    .from('athlete_positions')
    .upsert(
      {
        athlete_clerk_id:   userId,
        primary_position:   primaryPosition,
        secondary_position: secondaryPosition,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'athlete_clerk_id' },
    );

  if (error) {
    console.error('[athlete-positions] upsert failed:', error.message);
    return NextResponse.json({ error: 'Database error.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
