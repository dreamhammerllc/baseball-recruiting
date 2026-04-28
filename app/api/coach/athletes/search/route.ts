import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';

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
    const result = await clerk.users.getUserList({ query: q.trim(), limit: 10 });
    const users: AthleteSearchResult[] = result.data
      .filter(u => u.id !== userId)
      .map(u => ({
        clerkId:   u.id,
        firstName: u.firstName,
        lastName:  u.lastName,
        username:  u.username,
        fullName:  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.id,
      }));
    return NextResponse.json({ users });
  } catch (err) {
    console.error('[GET /api/coach/athletes/search] error:', err);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}
