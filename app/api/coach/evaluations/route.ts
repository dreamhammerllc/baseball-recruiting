import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_INFO, type MetricKey } from '@/lib/metrics';

export interface Evaluation {
  id:              string;
  metricKey:       MetricKey;
  metricLabel:     string;
  metricUnit:      string;
  value:           number;
  athleteName:     string;
  athleteClerkId:  string;
  status:          string;
  aiConfidence:    number | null;
  videoUrl:        string | null;
  recordedAt:      string;
  createdAt:       string;
  approvedAt:      string | null;
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();

  // Get coach row so we have the internal coach.id
  const { data: coach, error: coachErr } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (coachErr || !coach) {
    return NextResponse.json({ error: 'Coach profile not found.' }, { status: 404 });
  }

  const { data, error } = await db
    .from('coach_verifications')
    .select('id, metric_key, value, athlete_clerk_id, status, ai_confidence, video_url, recorded_at, created_at, approved_at')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[GET /api/coach/evaluations] error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch evaluations.' }, { status: 500 });
  }

  // Second query: look up athlete names by clerk_user_id
  const athleteIds = [...new Set((data ?? []).map(r => r.athlete_clerk_id))];
  const nameMap: Record<string, string> = {};

  if (athleteIds.length > 0) {
    const { data: athleteRows } = await db
      .from('athletes')
      .select('clerk_user_id, first_name, last_name')
      .in('clerk_user_id', athleteIds);

    for (const a of athleteRows ?? []) {
      const name = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Unknown Athlete';
      nameMap[a.clerk_user_id] = name;
    }
  }

  const evaluations: Evaluation[] = (data ?? []).map(row => {
    const key = row.metric_key as MetricKey;
    const info = METRIC_INFO[key] ?? { label: key, unit: '' };

    return {
      id:             row.id,
      metricKey:      key,
      metricLabel:    info.label,
      metricUnit:     info.unit,
      value:          Number(row.value),
      athleteName:    nameMap[row.athlete_clerk_id] ?? 'Unknown Athlete',
      athleteClerkId: row.athlete_clerk_id,
      status:         row.status,
      aiConfidence:   row.ai_confidence ?? null,
      videoUrl:       row.video_url ?? null,
      recordedAt:     row.recorded_at as string,
      createdAt:      row.created_at,
      approvedAt:     row.approved_at ?? null,
    };
  });

  return NextResponse.json({ evaluations });
}
