import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_KEYS, type MetricKey } from '@/lib/metrics';

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
  } catch (err) {
    console.error('[coach/verification-details] authenticateRequest error:', err);
    return null;
  }
}

export interface VerificationDetails {
  fullName:        string;
  organization:    string;
  title:           string;
  approvedAt:      string;
  email:           string;
  bio:             string | null;
  yearsExperience: number | null;
  photoUrl:        string | null;
}

// ─── GET /api/coach/verification-details?metricKey=exit_velocity ─────────────

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const metricKey = new URL(req.url).searchParams.get('metricKey') as MetricKey | null;
  if (!metricKey || !METRIC_KEYS.includes(metricKey)) {
    return NextResponse.json({ error: 'Invalid or missing metricKey.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('coach_verifications')
    .select(`
      approved_at,
      status,
      coaches (
        full_name,
        organization,
        title,
        email,
        bio,
        years_experience,
        photo_url
      )
    `)
    .eq('athlete_clerk_id', userId)
    .eq('metric_key', metricKey)
    .order('approved_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[GET /api/coach/verification-details] error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch verification details.' }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ details: [] });
  }

  type CoachRow = {
    full_name: string;
    organization: string;
    title: string;
    email: string;
    bio: string | null;
    years_experience: number | null;
    photo_url: string | null;
  };

  const details: VerificationDetails[] = data
    .filter(row => row.coaches != null)
    .map(row => {
      const coach = row.coaches as CoachRow;
      return {
        fullName:        coach.full_name,
        organization:    coach.organization,
        title:           coach.title,
        approvedAt:      row.approved_at as string,
        email:           coach.email,
        bio:             coach.bio ?? null,
        yearsExperience: coach.years_experience ?? null,
        photoUrl:        coach.photo_url ?? null,
      };
    });

  return NextResponse.json({ details });
}
