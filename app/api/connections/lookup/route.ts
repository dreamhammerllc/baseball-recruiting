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

  // ── Direct lookup by full Clerk user ID (from QR scan) ───────────────────
  if (fullId) {
    const { data: athlete, error } = await supabase
      .from('athletes')
      .select('clerk_user_id, full_name, photo_url, position, grad_year')
      .eq('clerk_user_id', fullId)
      .maybeSingle();

    if (error) {
      console.error('Lookup error (by id):', error.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    if (!athlete) {
      return NextResponse.json({ error: 'No athlete found with that ID' }, { status: 404 });
    }
    return NextResponse.json({
      athleteId: athlete.clerk_user_id,
      name:      athlete.full_name     ?? 'Unknown Athlete',
      photo:     athlete.photo_url     ?? null,
      position:  athlete.position      ?? null,
      gradYear:  athlete.grad_year     ?? null,
    });
  }

  // ── Lookup by 6-char invite code (suffix of Clerk user ID) ───────────────
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: 'Provide a 6-character invite code or full athlete ID' }, { status: 400 });
  }

  // Fetch all athletes and filter in JS — avoids PostgREST ilike edge cases
  // Athletes table is small so this is fine
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('clerk_user_id, full_name, photo_url, position, grad_year');

  if (error) {
    console.error('Lookup error (by code):', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const match = (athletes ?? []).find(
    a => a.clerk_user_id?.toUpperCase().slice(-6) === code
  );

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
