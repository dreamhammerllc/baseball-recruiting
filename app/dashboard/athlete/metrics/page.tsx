/**
 * BEFORE THIS PAGE WILL WORK — run in Supabase SQL editor:
 *
 *   CREATE TABLE IF NOT EXISTS athlete_positions ( ... )  -- see metrics API route
 *   CREATE TABLE IF NOT EXISTS athlete_metrics ( ... )    -- see metrics API route
 *   CREATE TABLE IF NOT EXISTS metric_sessions ( ... )    -- see metrics API route
 *   CREATE TABLE IF NOT EXISTS highlight_videos ( ... )   -- see metrics API route
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import AthleteSidebar from '@/components/layout/AthleteSidebar';
import MetricsDashboardClient from './MetricsDashboardClient';
import type { AthleteMetric, AthletePosition, HighlightVideo } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export default async function MetricsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const db = createAdminClient();

  const [positionResult, metricsResult, highlightsResult, athleteResult] = await Promise.all([
    db
      .from('athlete_positions')
      .select('*')
      .eq('athlete_clerk_id', userId)
      .maybeSingle(),
    db
      .from('athlete_metrics')
      .select('*')
      .eq('athlete_clerk_id', userId)
      .order('recorded_at', { ascending: false }),
    db
      .from('highlight_videos')
      .select('*')
      .eq('athlete_clerk_id', userId)
      .order('slot_number', { ascending: true }),
    db
      .from('athletes')
      .select('subscription_tier')
      .eq('clerk_user_id', userId)
      .maybeSingle(),
  ]);

  const position = (positionResult.data ?? null) as AthletePosition | null;
  const metrics = (metricsResult.data ?? []) as AthleteMetric[];
  const highlights = (highlightsResult.data ?? []) as HighlightVideo[];

  const tier = athleteResult.data?.subscription_tier ?? 'free';
  const highlightSlotLimit =
    tier === 'athlete_pro' ? 6 : tier === 'athlete' ? 3 : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            My Metrics
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Verified athletic performance data
          </p>
        </div>
        <MetricsDashboardClient
          athleteClerkId={userId!}
          position={position}
          allMetrics={metrics}
          highlights={highlights}
          highlightSlotLimit={highlightSlotLimit}
        />
      </main>
    </div>
  );
}
