export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';

// ── Shared helper ─────────────────────────────────────────────────────────────
// Resolves the signed-in coach's internal uuid from their Clerk id.
// 401 if not signed in, 403 if no coach row exists for this clerk id.
async function resolveCoach(): Promise<
  | { ok: true; coachId: string }
  | { ok: false; response: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  const db = createAdminClient();
  const { data: coach, error } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    return { ok: false, response: errorResponse(error) };
  }
  if (!coach) {
    return { ok: false, response: NextResponse.json({ error: 'Coach profile not found.' }, { status: 403 }) };
  }
  return { ok: true, coachId: coach.id as string };
}

function errorResponse(e: unknown): NextResponse {
  const x = e as { message?: string; code?: string; hint?: string; details?: string; stack?: string };
  return NextResponse.json(
    { error: x?.message ?? 'Unknown error', code: x?.code, hint: x?.hint, details: x?.details, stack: x?.stack },
    { status: 500 },
  );
}

type NoteRow = {
  id:               string;
  athlete_clerk_id: string;
  rating:           number | null;
  notes:            string | null;
  created_at:       string;
  updated_at:       string;
};

function shapeNote(row: NoteRow) {
  return {
    id:        row.id,
    athleteId: row.athlete_clerk_id,
    rating:    row.rating,
    notes:     row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────
// GET /api/coach/notes              → list mode, all notes + athlete enrichment
// GET /api/coach/notes?athleteId=x  → single mode, returns { note: ... | null }
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveCoach();
    if (!ctx.ok) return ctx.response;

    const db = createAdminClient();
    const athleteIdParam = req.nextUrl.searchParams.get('athleteId');

    // ── Single mode ──────────────────────────────────────────────────────────
    if (athleteIdParam) {
      const { data: row, error } = await db
        .from('coach_athlete_notes')
        .select('id, athlete_clerk_id, rating, notes, created_at, updated_at')
        .eq('coach_id', ctx.coachId)
        .eq('athlete_clerk_id', athleteIdParam)
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      return NextResponse.json({ note: row ? shapeNote(row as NoteRow) : null });
    }

    // ── List mode ────────────────────────────────────────────────────────────
    // Q1: notes for this coach, newest-edited first
    const { data: rows, error: notesErr } = await db
      .from('coach_athlete_notes')
      .select('id, athlete_clerk_id, rating, notes, created_at, updated_at')
      .eq('coach_id', ctx.coachId)
      .order('updated_at', { ascending: false });
    if (notesErr) throw notesErr;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ notes: [] });
    }

    // Q2: enrich with athlete profile fields. Separate query, JS merge — no JOINs.
    const ids = rows.map(r => r.athlete_clerk_id as string);
    const { data: athletes, error: athErr } = await db
      .from('athletes')
      .select('clerk_user_id, first_name, last_name, position, grad_year, home_state, photo_url')
      .in('clerk_user_id', ids);
    if (athErr) throw athErr;

    const athleteMap = new Map((athletes ?? []).map(a => [a.clerk_user_id as string, a]));

    const notes = rows.map(r => {
      const a = athleteMap.get(r.athlete_clerk_id as string);
      return {
        id:        r.id,
        athleteId: r.athlete_clerk_id,
        athlete: {
          firstName:       a?.first_name        ?? null,
          lastName:        a?.last_name         ?? null,
          position:        a?.position          ?? null,
          graduationYear:  a?.grad_year         ?? null,
          state:           a?.home_state        ?? null,
          profilePhotoUrl: a?.photo_url         ?? null,
        },
        rating:    r.rating,
        notes:     r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    return NextResponse.json({ notes });
  } catch (e) {
    console.error('[GET /api/coach/notes]', e);
    return errorResponse(e);
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────
// Body: { athleteId, rating: 1–10|null, notes: string≤4000|null }
// At least one of rating / notes must be non-null.
export async function PUT(req: NextRequest) {
  try {
    const ctx = await resolveCoach();
    if (!ctx.ok) return ctx.response;

    let body: { athleteId?: unknown; rating?: unknown; notes?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    // Validate athleteId
    const athleteId = body.athleteId;
    if (typeof athleteId !== 'string' || athleteId.trim() === '') {
      return NextResponse.json({ error: 'athleteId is required and must be a non-empty string.' }, { status: 400 });
    }

    // Validate rating
    let rating: number | null;
    if (body.rating === null || body.rating === undefined) {
      rating = null;
    } else if (
      typeof body.rating === 'number' &&
      Number.isInteger(body.rating) &&
      body.rating >= 1 &&
      body.rating <= 10
    ) {
      rating = body.rating;
    } else {
      return NextResponse.json({ error: 'rating must be an integer 1–10, or null.' }, { status: 400 });
    }

    // Validate notes
    let notesValue: string | null;
    if (body.notes === null || body.notes === undefined) {
      notesValue = null;
    } else if (typeof body.notes === 'string' && body.notes.length <= 4000) {
      notesValue = body.notes;
    } else {
      return NextResponse.json({ error: 'notes must be a string ≤ 4000 chars, or null.' }, { status: 400 });
    }

    if (rating === null && notesValue === null) {
      return NextResponse.json({ error: 'Provide at least one of rating or notes.' }, { status: 400 });
    }

    const db = createAdminClient();

    // Confirm the athlete exists before writing the note
    const { data: athleteCheck, error: athErr } = await db
      .from('athletes')
      .select('clerk_user_id')
      .eq('clerk_user_id', athleteId)
      .limit(1)
      .maybeSingle();
    if (athErr) throw athErr;
    if (!athleteCheck) {
      return NextResponse.json({ error: 'Athlete not found.', code: 'ATHLETE_NOT_FOUND' }, { status: 404 });
    }

    // Upsert the note. updated_at is set explicitly because column DEFAULTs only
    // fire on INSERT — a plain UPDATE would leave the timestamp stale.
    const { data: row, error } = await db
      .from('coach_athlete_notes')
      .upsert(
        {
          coach_id:         ctx.coachId,
          athlete_clerk_id: athleteId,
          rating,
          notes:            notesValue,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'coach_id,athlete_clerk_id' },
      )
      .select('id, athlete_clerk_id, rating, notes, created_at, updated_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ note: shapeNote(row as NoteRow) });
  } catch (e) {
    console.error('[PUT /api/coach/notes]', e);
    return errorResponse(e);
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
// DELETE /api/coach/notes?athleteId=user_xxx — idempotent.
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await resolveCoach();
    if (!ctx.ok) return ctx.response;

    const athleteId = req.nextUrl.searchParams.get('athleteId');
    if (!athleteId) {
      return NextResponse.json({ error: 'athleteId is required.' }, { status: 400 });
    }

    const db = createAdminClient();
    const { error } = await db
      .from('coach_athlete_notes')
      .delete()
      .eq('coach_id', ctx.coachId)
      .eq('athlete_clerk_id', athleteId);
    if (error) throw error;

    return NextResponse.json({ deleted: true, athleteId });
  } catch (e) {
    console.error('[DELETE /api/coach/notes]', e);
    return errorResponse(e);
  }
}
