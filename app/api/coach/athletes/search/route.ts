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
    console.error('[coach/athletes/search] authenticateRequest error:', err);
    return null;
  }
}

export interface AthleteSearchResult {
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  fullName: string;
  photoUrl: string | null;
}

// ─── GET /api/coach/athletes/search?q=... ────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) {
    return NextResponse.json({ users: [] });
  }

  try {
    // Fetch matching users from Clerk
    const result = await clerk.users.getUserList({ query: q.trim(), limit: 10 });
    const users: AthleteSearchResult[] = result.data
      .filter(u => u.id !== userId)
      .map(u => ({
        clerkId:   u.id,
        firstName: u.firstName,
        lastName:  u.lastName,
        username:  u.username,
        fullName:  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.id,
        photoUrl:  u.imageUrl ?? null,
      }));

    // Also fetch which of these are already saved by this coach
    const db = createAdminClient();
    const { data: coach } = await db
      .from('coaches')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    let savedIds: Set<string> = new Set();
    if (coach) {
      const { data: saved } = await db
        .from('saved_athletes')
        .select('athlete_clerk_id')
        .eq('coach_id', coach.id);
      savedIds = new Set((saved ?? []).map(s => s.athlete_clerk_id));
    }

    return NextResponse.json({
      users: users.map(u => ({ ...u, isSaved: savedIds.has(u.clerkId) })),
    });
  } catch (err) {
    console.error('[GET /api/coach/athletes/search] error:', err);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}
