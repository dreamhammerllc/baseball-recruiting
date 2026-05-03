import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_INFO } from '@/lib/metrics';
import type { MetricKey } from '@/lib/metrics';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { metricKey, videoUrl, athleteClerkId } = await request.json();

  if (!metricKey || !videoUrl || !athleteClerkId) {
    return NextResponse.json({ error: 'metricKey, videoUrl, and athleteClerkId are required.' }, { status: 400 });
  }

  if (!(metricKey in METRIC_INFO)) {
    return NextResponse.json({ error: `Invalid metricKey: ${metricKey}` }, { status: 400 });
  }

  if (athleteClerkId !== userId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const db = createAdminClient();

  const { data: existingPB } = await db
    .from('athlete_metrics')
    .select('id')
    .eq('athlete_clerk_id', athleteClerkId)
    .eq('metric_key', metricKey)
    .eq('is_personal_best', true)
    .maybeSingle();

  if (existingPB) {
    const { error } = await db
      .from('athlete_metrics')
      .update({ video_url: videoUrl })
      .eq('id', existingPB.id);
    if (error) {
      console.error('[save-video-url] Failed to update video_url:', error.message);
      return NextResponse.json({ error: 'Failed to save video URL.' }, { status: 500 });
    }
  } else {
    const { error } = await db
      .from('athlete_metrics')
      .insert({
        athlete_clerk_id:  athleteClerkId,
        metric_key:        metricKey,
        value:             0,
        unit:              METRIC_INFO[metricKey as MetricKey].unit,
        verification_type: 'self_reported',
        is_personal_best:  true,
        video_url:         videoUrl,
      });
    if (error) {
      console.error('[save-video-url] Failed to insert metric row:', error.message);
      return NextResponse.json({ error: 'Failed to save video URL.' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
