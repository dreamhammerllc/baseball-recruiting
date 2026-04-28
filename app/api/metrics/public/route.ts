/**
 * GET /api/metrics/public
 *
 * Public (unauthenticated) endpoint for fetching athlete metric history.
 * Used by the public athlete profile page to power the MetricsGraph modal.
 *
 * Query params:
 *   athleteId  — required, the athlete's Clerk user ID
 *   metricKey  — required, the metric key to fetch history for
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_KEYS, type AthleteMetric, type MetricKey } from '@/lib/metrics';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId');
  const metricKey = searchParams.get('metricKey') as MetricKey | null;

  if (!athleteId) {
    return NextResponse.json({ error: 'athleteId is required.' }, { status: 400 });
  }

  if (!metricKey || !METRIC_KEYS.includes(metricKey)) {
    return NextResponse.json({ error: 'Valid metricKey is required.' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data, error } = await db
    .from('athlete_metrics')
    .select('*')
    .eq('athlete_clerk_id', athleteId)
    .eq('metric_key', metricKey)
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('[GET /api/metrics/public] fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch metric history.' }, { status: 500 });
  }

  return NextResponse.json({
    metrics: (data ?? []) as AthleteMetric[],
  });
}
