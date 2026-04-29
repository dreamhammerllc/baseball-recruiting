import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';
import webpush from 'web-push';

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

// Configure VAPID keys (set these env vars in .env.local and Vercel)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@diamondverified.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

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

// POST /api/notifications/subscribe — store a push subscription
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { subscription } = await req.json() as { subscription: PushSubscriptionJSON };
  if (!subscription) return NextResponse.json({ error: 'Subscription required.' }, { status: 400 });

  const db = createAdminClient();

  // Try athletes table first, then coaches
  const { data: athlete } = await db.from('athletes').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (athlete) {
    await db.from('athletes').update({ push_subscription: subscription, notifications_enabled: true }).eq('clerk_user_id', userId);
  } else {
    await db.from('coaches').update({ push_subscription: subscription, notifications_enabled: true }).eq('clerk_user_id', userId);
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/notifications/subscribe — remove push subscription (toggle off)
export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();

  const { data: athlete } = await db.from('athletes').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (athlete) {
    await db.from('athletes').update({ push_subscription: null, notifications_enabled: false }).eq('clerk_user_id', userId);
  } else {
    await db.from('coaches').update({ push_subscription: null, notifications_enabled: false }).eq('clerk_user_id', userId);
  }

  return NextResponse.json({ success: true });
}
