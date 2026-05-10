export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/connections/lookup?code=ABC123  — find by 6-char invite code
// GET /api/connections/lookup?id=user_XXX  — find by full Clerk user ID (QR scan)
export async function GET(req: NextRequest) {
  try {
    const { userId: coachId } = await auth();
    if (!coachId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fullId = req.nextUrl.searchParams.get('id')?.trim();
    const code   = req.nextUrl.searchParams.get('code')?.toUpperCase().trim();

    if (!fullId && (!code || code.length !== 6)) {
      return NextResponse.json(
        { error: 'Provide a 6-character invite code or full athlete ID' },
        { status: 400 }
      );
    }

    // Fetch athletes by exact ID or by last-6 suffix — two separate simple queries, no JOINs
    let rows: Array<{
      clerk_user_id: string;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      photo_url: string | null;
      position: string | null;
      grad_year: number | null;
    }> = [];

    if (fullId) {
      // QR scan — single row by exact clerk_user_id
      const { data, error } = await supabase
        .from('athletes')
        .select('clerk_user_id, full_name, first_name, last_name, photo_url, position, grad_year')
        .eq('clerk_user_id', fullId)
        .maybeSingle();

      if (error) {
        console.error('[connections/lookup] ID fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: 'No athlete found with that ID' }, { status: 404 });
      }
      rows = [data];
    } else {
      // Invite code — fetch all, match by last-6 suffix in JS (avoids ilike/computed filter issues)
      const { data, error } = await supabase
        .from('athletes')
        .select('clerk_user_id, full_name, first_name, last_name, photo_url, position, grad_year');

      if (error) {
        console.error('[connections/lookup] Code fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rows = data ?? [];
    }

    // ── QR scan result ────────────────────────────────────────────────────────
    if (fullId) {
      const a = rows[0];
      return NextResponse.json({
        athleteId: a.clerk_user_id,
        name:      a.full_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Unknown Athlete',
        photo:     a.photo_url ?? null,
        position:  a.position ?? null,
        gradYear:  a.grad_year ?? null,
      });
    }

    // ── Invite code: match by last 6 chars of clerk_user_id ──────────────────
    const athlete = rows.find(
      r => r.clerk_user_id?.toUpperCase().endsWith(code!.toUpperCase())
    );

    if (!athlete) {
      return NextResponse.json({ error: 'No athlete found with that code' }, { status: 404 });
    }

    return NextResponse.json({
      athleteId: athlete.clerk_user_id,
      name:      athlete.full_name || [athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || 'Unknown Athlete',
      photo:     athlete.photo_url ?? null,
      position:  athlete.position ?? null,
      gradYear:  athlete.grad_year ?? null,
    });

  } catch (e: unknown) {
    const err = e as { message?: string; code?: string; hint?: string; details?: string; stack?: string };
    console.error('LOOKUP_ROUTE_ERROR:', e);
    return NextResponse.json({
      error:   err?.message   ?? String(e),
      code:    err?.code,
      hint:    err?.hint,
      details: err?.details,
      stack:   err?.stack,
    }, { status: 500 });
  }
}
