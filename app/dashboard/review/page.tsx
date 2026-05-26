import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_INFO } from '@/lib/metrics';
import { isReviewer } from '@/lib/reviewer';
import ReviewQueueClient, { type ReviewItem } from './ReviewQueueClient';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  const allowed = await isReviewer(user.id);
  if (!allowed) redirect('/dashboard');

  const db = createAdminClient();

  const { data: sessions } = await db
    .from('metric_sessions')
    .select('id, athlete_clerk_id, coach_clerk_id, metric_key, claimed_value, readout_extracted_value, readout_file_url, video_url, ai_confidence, ai_notes, decision_reason, created_at, review_requested, review_requested_at')
    .eq('status', 'flagged')
    .order('review_requested', { ascending: false })
    .order('created_at', { ascending: false });

  const rows = (sessions ?? []) as any[];

  const athleteIds = Array.from(new Set(rows.map(r => r.athlete_clerk_id).filter(Boolean)));
  const coachIds = Array.from(new Set(rows.map(r => r.coach_clerk_id).filter(Boolean)));

  const athleteNames: Record<string, string> = {};
  if (athleteIds.length) {
    // Name columns match app/api/coach/verifications/route.ts (first_name/last_name).
    const { data: ath } = await db
      .from('athletes')
      .select('clerk_user_id, first_name, last_name')
      .in('clerk_user_id', athleteIds);
    (ath ?? []).forEach((a: any) => {
      athleteNames[a.clerk_user_id] = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.clerk_user_id;
    });
  }

  const coachNames: Record<string, string> = {};
  if (coachIds.length) {
    const { data: cos } = await db
      .from('coaches')
      .select('clerk_user_id, full_name, organization')
      .in('clerk_user_id', coachIds);
    (cos ?? []).forEach((c: any) => {
      coachNames[c.clerk_user_id] = c.organization ? `${c.full_name} (${c.organization})` : c.full_name;
    });
  }

  const items: ReviewItem[] = rows.map((r: any) => ({
    sessionId: r.id,
    athleteName: athleteNames[r.athlete_clerk_id] ?? r.athlete_clerk_id,
    coachName: coachNames[r.coach_clerk_id] ?? r.coach_clerk_id ?? 'Unknown coach',
    metricKey: r.metric_key,
    metricLabel: METRIC_INFO[r.metric_key]?.label ?? r.metric_key,
    unit: METRIC_INFO[r.metric_key]?.unit ?? '',
    claimedValue: Number(r.claimed_value),
    deviceValue: r.readout_extracted_value != null ? Number(r.readout_extracted_value) : null,
    videoUrl: r.video_url ?? null,
    readoutFileUrl: r.readout_file_url ?? null,
    aiConfidence: r.ai_confidence != null ? Number(r.ai_confidence) : null,
    aiNotes: r.ai_notes ?? null,
    decisionReason: r.decision_reason ?? null,
    createdAt: r.created_at,
    reviewRequested: Boolean(r.review_requested),
    reviewRequestedAt: r.review_requested_at ?? null,
  }));

  return <ReviewQueueClient initialItems={items} />;
}
