import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_INFO, type MetricKey } from '@/lib/metrics';

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
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: { metric_key?: string; value?: unknown; video_url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { metric_key, value, video_url } = body;

  if (!metric_key || !(metric_key in METRIC_INFO)) {
    return NextResponse.json({ error: 'Invalid metric_key.' }, { status: 400 });
  }

  const numValue = Number(value);
  if (!Number.isFinite(numValue) || numValue <= 0) {
    return NextResponse.json({ error: 'Value must be a positive number.' }, { status: 400 });
  }

  const metricKey = metric_key as MetricKey;
  const info = METRIC_INFO[metricKey];
  const db = createAdminClient();

  // Find current personal best to update is_personal_best flag
  const { data: currentPB } = await db
    .from('athlete_metrics')
    .select('id, value')
    .eq('athlete_clerk_id', userId)
    .eq('metric_key', metricKey)
    .eq('is_personal_best', true)
    .maybeSingle();

  const newIsPB = !currentPB || (
    info.lowerIsBetter ? numValue < currentPB.value : numValue > currentPB.value
  );

  if (newIsPB && currentPB) {
    await db
      .from('athlete_metrics')
      .update({ is_personal_best: false })
      .eq('id', currentPB.id);
  }

  const cleanVideoUrl =
    video_url && typeof video_url === 'string' && video_url.trim()
      ? video_url.trim()
      : null;

  const { data: inserted, error } = await db
    .from('athlete_metrics')
    .insert({
      athlete_clerk_id: userId,
      metric_key:       metricKey,
      value:            numValue,
      unit:             info.unit,
      verification_type:'self_reported',
      source_label:     'Self Reported',
      is_personal_best: newIsPB,
      video_url:        cleanVideoUrl,
      recorded_at:      new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[self-report-metric] insert error:', error.message);
    return NextResponse.json({ error: 'Failed to save metric.' }, { status: 500 });
  }

  // If new row is personal best, return old PB id so client can update local state
  return NextResponse.json({ metric: inserted, demotedId: newIsPB ? currentPB?.id ?? null : null });
}
