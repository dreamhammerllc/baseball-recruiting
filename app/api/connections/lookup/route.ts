import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/lib/auth';

// GET /api/connections/lookup?code=ABC123  — find by 6-char invite code
// GET /api/connections/lookup?id=user_XXX  — find by full Clerk user ID (QR scan)
export async function GET(req: NextRequest) {
  const coachId = await getAuthenticatedUserId(req);
  if (!coachId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const fullId = req.nextUrl.searchParams.get('id')?.trim();
  const code   = req.nextUrl.searchParams.get('code')?.toUpperCase().trim();

  // Fetch ALL athletes — no filters, no ilike, just a plain select
  const { data: all, error } = await supabase
    .from('athletes')
    .select('clerk_user_id, first_name, last_name, photo_url');

  if (error) {
    console.error('[lookup] full error object:', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = all ?? [];

  // ── QR scan: match by full Clerk user ID ─────────────────────────────────
  if (fullId) {
    const athlete = rows.find(r => r.clerk_user_id === fullId);
    if (!athlete) {
      return NextResponse.json({ error: 'No athlete found with that ID' }, { status: 404 });
    }
    return NextResponse.json({
      athleteId: athlete.clerk_user_id,
      name:      [athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || 'Unknown Athlete',
      photo:     athlete.photo_url ?? null,
      position:  null,
      gradYear:  null,
    });
  }

  // ── Invite code: match by last 6 chars of clerk_user_id ──────────────────
  if (!code || code.length !== 6) {
    return NextResponse.json(
      { error: 'Provide a 6-character invite code or full athlete ID' },
      { status: 400 }
    );
  }

  const athlete = rows.find(
    r => r.clerk_user_id?.toUpperCase().endsWith(code.toUpperCase())
  );

  if (!athlete) {
    return NextResponse.json({ error: 'No athlete found with that code' }, { status: 404 });
  }

  return NextResponse.json({
    athleteId: athlete.clerk_user_id,
    name:      [athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || 'Unknown Athlete',
    photo:     athlete.photo_url ?? null,
    position:  null,
    gradYear:  null,
  });
}
