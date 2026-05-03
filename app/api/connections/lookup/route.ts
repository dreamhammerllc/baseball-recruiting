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
      .select('clerk_user_id, full_name, photo_url, position, grad_year')
      .eq('clerk_user_id', fullId)
      .maybeSingle();

    if (error) {
      console.error('[lookup by id] error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!athlete) {
      return NextResponse.json({ error: 'No athlete found with that ID' }, { status: 404 });
    }
    return NextResponse.json({
      athleteId: athlete.clerk_user_id,
      name:      athlete.full_name  ?? 'Unknown Athlete',
      photo:     athlete.photo_url  ?? null,
      position:  athlete.position   ?? null,
      gradYear:  athlete.grad_year  ?? null,
    });
  }

  // ── Lookup by 6-char invite code ──────────────────────────────────────────
  if (!code || code.length !== 6) {
    return NextResponse.json(
      { error: 'Provide a 6-character invite code or full athlete ID' },
      { status: 400 }
    );
  }

  // Fresh direct query — ilike on clerk_user_id with no let-variable reassignment
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('clerk_user_id, full_name, photo_url, position, grad_year')
    .ilike('clerk_user_id', `%${code}`);

  if (error) {
    console.error('[lookup by code] ilike error:', error.message, error.code, error.details);
    // Surface the real Supabase error so it shows in the UI for debugging
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ilike returned rows — find exact suffix match (handles any case issues)
  let match = (athletes ?? []).find(
    a => a.clerk_user_id?.toUpperCase().slice(-6) === code
  );

  // Fallback: if ilike returned nothing, fetch all and filter in JS
  if (!match && (!athletes || athletes.length === 0)) {
    const { data: all, error: allError } = await supabase
      .from('athletes')
      .select('clerk_user_id, full_name, photo_url, position, grad_year');

    if (allError) {
      console.error('[lookup fallback] error:', allError.message, allError.code);
      return NextResponse.json({ error: allError.message }, { status: 500 });
    }

    match = (all ?? []).find(
      a => a.clerk_user_id?.toUpperCase().slice(-6) === code
    );
  }

  if (!match) {
    return NextResponse.json({ error: 'No athlete found with that code' }, { status: 404 });
  }

  return NextResponse.json({
    athleteId: match.clerk_user_id,
    name:      match.full_name  ?? 'Unknown Athlete',
    photo:     match.photo_url  ?? null,
    position:  match.position   ?? null,
    gradYear:  match.grad_year  ?? null,
  });
}
