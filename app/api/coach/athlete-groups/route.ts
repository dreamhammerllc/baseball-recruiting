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

const GROUP_COLORS = ['#e8a020', '#58a6ff', '#34d399', '#a855f7', '#f87171', '#fb923c'];

// POST /api/coach/athlete-groups — create a group
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { name } = await req.json() as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: 'Group name required.' }, { status: 400 });

  const db = createAdminClient();

  const { data: coach } = await db
    .from('coaches')
    .select('id, subscription_tier')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });
  if (coach.subscription_tier === 'free') {
    return NextResponse.json({ error: 'Groups are a paid feature. Upgrade to create athlete groups.' }, { status: 403 });
  }

  // Pick a color based on existing group count
  const { count } = await db
    .from('athlete_groups')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coach.id);

  const color = GROUP_COLORS[(count ?? 0) % GROUP_COLORS.length];

  const { data, error } = await db
    .from('athlete_groups')
    .insert({ coach_id: coach.id, name: name.trim(), color })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create group.' }, { status: 500 });
  return NextResponse.json({ success: true, group: data });
}

// DELETE /api/coach/athlete-groups?group_id=xxx — delete a group (athletes move to ungrouped)
export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const groupId = new URL(req.url).searchParams.get('group_id');
  if (!groupId) return NextResponse.json({ error: 'group_id required.' }, { status: 400 });

  const db = createAdminClient();

  const { data: coach } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });

  // Athletes in the group move to ungrouped automatically (ON DELETE SET NULL)
  await db
    .from('athlete_groups')
    .delete()
    .eq('id', groupId)
    .eq('coach_id', coach.id);

  return NextResponse.json({ success: true });
}
