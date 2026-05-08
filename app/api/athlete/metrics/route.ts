export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_INFO, type MetricKey } from '@/lib/metrics';

const SOURCE_MAP: Record<string, { verification_type: string; source_label: string }> = {
  'Pocket Radar':    { verification_type: 'self_reported',           source_label: 'Pocket Radar'   },
  'Coach In-Person': { verification_type: 'coach_verified',          source_label: 'Coach Verified'  },
  'HitTrax':         { verification_type: 'third_party_hittrax',     source_label: 'HitTrax'         },
  'Rapsodo':         { verification_type: 'third_party_rapsodo',     source_label: 'Rapsodo'         },
  'Blast Motion':    { verification_type: 'third_party_blast_motion',source_label: 'Blast Motion'    },
  'Trackman':        { verification_type: 'third_party_trackman',    source_label: 'Trackman'        },
  'Perfect Game':    { verification_type: 'third_party_perfect_game',source_label: 'Perfect Game'    },
};

// GET — fetch all metrics for authenticated athlete
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('athlete_metrics')
    .select('*')
    .eq('athlete_clerk_id', userId)
    .order('recorded_at', { ascending: false });

  if (error) {
    console.error('[athlete/metrics] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch metrics.' }, { status: 500 });
  }

  return NextResponse.json({ metrics: data ?? [] });
}

// POST — submit a new metric value (only saves if it beats the existing personal best)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: { metric_key?: string; metric_value?: unknown; source?: string; date_recorded?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { metric_key, metric_value, source, date_recorded } = body;

  if (!metric_key || !(metric_key in METRIC_INFO)) {
    return NextResponse.json({ error: 'Invalid metric_key.' }, { status: 400 });
  }

  const numValue = Number(metric_value);
  if (!Number.isFinite(numValue) || numValue <= 0) {
    return NextResponse.json({ error: 'Value must be a positive number.' }, { status: 400 });
  }

  const sourceInfo = source ? SOURCE_MAP[source] : null;
  if (!sourceInfo) {
    return NextResponse.json({ error: 'Invalid source.' }, { status: 400 });
  }

  const metricKey = metric_key as MetricKey;
  const info = METRIC_INFO[metricKey];
  const db = createAdminClient();

  // Find current personal best
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
    await db.from('athlete_metrics').update({ is_personal_best: false }).eq('id', currentPB.id);
  }

  const { data: inserted, error } = await db
    .from('athlete_metrics')
    .insert({
      athlete_clerk_id:  userId,
      metric_key:        metricKey,
      value:             numValue,
      unit:              info.unit,
      verification_type: sourceInfo.verification_type,
      source_label:      sourceInfo.source_label,
      is_personal_best:  newIsPB,
      recorded_at:       date_recorded ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[athlete/metrics] POST error:', error.message);
    return NextResponse.json({ error: 'Failed to save metric.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: newIsPB, metric: inserted });
}
