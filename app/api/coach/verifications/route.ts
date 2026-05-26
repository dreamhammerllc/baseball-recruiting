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
  athleteUsername: string | null;
  status:          string;
  aiConfidence:    number | null;
  videoUrl:        string | null;
  recordedAt:      string;
  createdAt:       string;
  approvedAt:      string | null;
  sessionId:       string | null;
  decisionReason:  string | null;
  reviewRequested: boolean;
  reviewNote:      string | null;
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();

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
    .select('id, metric_key, value, athlete_clerk_id, status, video_url, recorded_at, created_at, approved_at, session_id')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[GET /api/coach/verifications] error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch evaluations.' }, { status: 500 });
  }

  const rows = data ?? [];

  // Athlete names
  const athleteIds = [...new Set(rows.map(r => r.athlete_clerk_id))];
  const nameMap: Record<string, string> = {};
  const usernameMap: Record<string, string | null> = {};
  if (athleteIds.length > 0) {
    const { data: athleteRows } = await db
      .from('athletes')
      .select('clerk_user_id, first_name, last_name, username')
      .in('clerk_user_id', athleteIds);
    for (const a of athleteRows ?? []) {
      nameMap[a.clerk_user_id] = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Unknown Athlete';
      usernameMap[a.clerk_user_id] = a.username ?? null;
    }
  }

  // Review context from the linked metric_sessions bundles
  const sessionIds = [...new Set(rows.map(r => r.session_id).filter(Boolean))] as string[];
  const bundleMap: Record<string, { decisionReason: string | null; reviewRequested: boolean; reviewNote: string | null; aiConfidence: number | null }> = {};
  if (sessionIds.length > 0) {
    const { data: bundleRows } = await db
      .from('metric_sessions')
      .select('id, decision_reason, review_requested, review_note, ai_confidence')
      .in('id', sessionIds);
    for (const b of bundleRows ?? []) {
      bundleMap[b.id] = {
        decisionReason:  b.decision_reason ?? null,
        reviewRequested: Boolean(b.review_requested),
        reviewNote:      b.review_note ?? null,
        aiConfidence:    b.ai_confidence != null ? Number(b.ai_confidence) : null,
      };
    }
  }

  const evaluations: Evaluation[] = rows.map(row => {
    const key = row.metric_key as MetricKey;
    const info = METRIC_INFO[key] ?? { label: key, unit: '' };
    const bundle = row.session_id ? bundleMap[row.session_id] : undefined;
    return {
      id:              row.id,
      metricKey:       key,
      metricLabel:     info.label,
      metricUnit:      info.unit,
      value:           Number(row.value),
      athleteName:     nameMap[row.athlete_clerk_id] ?? 'Unknown Athlete',
      athleteClerkId:  row.athlete_clerk_id,
      athleteUsername: usernameMap[row.athlete_clerk_id] ?? null,
      status:          row.status,
      aiConfidence:    bundle?.aiConfidence ?? null,
      videoUrl:        row.video_url ?? null,
      recordedAt:      row.recorded_at as string,
      createdAt:       row.created_at,
      approvedAt:      row.approved_at ?? null,
      sessionId:       row.session_id ?? null,
      decisionReason:  bundle?.decisionReason ?? null,
      reviewRequested: bundle?.reviewRequested ?? false,
      reviewNote:      bundle?.reviewNote ?? null,
    };
  });

  return NextResponse.json({ evaluations });
}
