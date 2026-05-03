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

  let query = supabase
    .from('athletes')
    .select('clerk_user_id, full_name, photo_url, position, grad_year');

  if (fullId) {
    // Direct lookup by full Clerk user ID (from QR scan)
    query = query.eq('clerk_user_id', fullId);
  } else if (code && code.length === 6) {
    // Lookup by 6-char suffix (manual invite code entry)
    query = query.ilike('clerk_user_id', `%${code}`);
  } else {
    return NextResponse.json({ error: 'Provide a 6-character invite code or full athlete ID' }, { status: 400 });
  }

  const { data: athletes, error } = await query;

  if (error) {
    console.error('Lookup error:', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  if (!athletes || athletes.length === 0) {
    return NextResponse.json({ error: 'No athlete found with that code' }, { status: 404 });
  }

  const a = athletes[0];
  return NextResponse.json({
    athleteId: a.clerk_user_id,
    name: a.full_name ?? 'Unknown Athlete',
    photo: a.photo_url ?? null,
    position: a.position ?? null,
    gradYear: a.grad_year ?? null,
  });
}
