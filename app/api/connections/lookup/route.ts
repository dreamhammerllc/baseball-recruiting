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

  // ── Direct lookup by full Clerk user ID (QR scan) ────────────────────────
  if (fullId) {
    const { data: athlete, error } = await supabase
      .from('athletes')
      .select('clerk_user_id, first_name, last_name, photo_url')
      .eq('clerk_user_id', fullId)
      .single();

    if (error) {
      console.error('[lookup by id] error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
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

  // ── Lookup by 6-char invite code ──────────────────────────────────────────
  if (!code || code.length !== 6) {
    return NextResponse.json(
      { error: 'Provide a 6-character invite code or full athlete ID' },
      { status: 400 }
    );
  }

  const { data: athlete, error } = await supabase
    .from('athletes')
    .select('clerk_user_id, first_name, last_name, photo_url')
    .ilike('clerk_user_id', `%${code}`)
    .single();

  if (error) {
    console.error('[lookup by code] error:', error.message, error.code);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
