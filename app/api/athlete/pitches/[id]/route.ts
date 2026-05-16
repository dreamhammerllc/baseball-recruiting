export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { apiError } from '@/lib/apiError';
import type { AthletePitch } from '@/lib/metrics';
import { UPDATEABLE_FIELDS, validatePitchField } from '@/lib/pitchValidation';

// Fields blocked from athlete-side updates once a pitch is coach-verified.
// Only pitch_slot (display ordering) remains athlete-editable on these rows.
const LOCKED_ON_COACH_VERIFIED = new Set<string>([
  'pitch_type',
  'velocity',
  'spin_rate',
  'h_break',
  'v_break',
  'extension',
  'video_url',
  'proof_url',
  'verification_type',
  'source_label',
]);

// ── PATCH /api/athlete/pitches/[id] ──────────────────────────────────────────
// Update a subset of fields on an existing pitch. Athlete must own the pitch.
// Slot-conflict detection runs only when the slot actually changes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing pitch id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const presentFields = UPDATEABLE_FIELDS.filter(f => f in body);
  if (presentFields.length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  const db = createAdminClient();

  // 1. Fetch — confirms existence and ownership before any write.
  const { data: current, error: fetchErr } = await db
    .from('athlete_pitches')
    .select('id, athlete_clerk_id, pitch_slot, verification_type')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    console.error('[athlete/pitches/:id] PATCH fetch error:', fetchErr.message);
    return apiError('Database error.', fetchErr);
  }
  if (!current) return NextResponse.json({ error: 'Pitch not found.' }, { status: 404 });
  const currentRow = current as { athlete_clerk_id: string; pitch_slot: number; verification_type: string };
  if (currentRow.athlete_clerk_id !== userId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Block athlete edits to verification-claim fields on coach-verified rows.
  if (currentRow.verification_type === 'coach_verified') {
    for (const field of presentFields) {
      if (LOCKED_ON_COACH_VERIFIED.has(field)) {
        return NextResponse.json(
          { error: 'field_locked', message: 'This field is locked on coach-verified pitches.', field },
          { status: 403 },
        );
      }
    }
  }

  // 2. Validate per-field, building the update payload.
  const payload: Record<string, unknown> = {};
  for (const field of presentFields) {
    const err = validatePitchField(field, body[field]);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    payload[field] = body[field];
  }

  // 3. Slot-conflict check — only when changing slot.
  if ('pitch_slot' in payload && payload.pitch_slot !== currentRow.pitch_slot) {
    const newSlot = payload.pitch_slot as number;
    const { data: conflict, error: conflictErr } = await db
      .from('athlete_pitches')
      .select('id')
      .eq('athlete_clerk_id', userId)
      .eq('pitch_slot',       newSlot)
      .neq('id',              id)
      .maybeSingle();

    if (conflictErr) {
      console.error('[athlete/pitches/:id] PATCH conflict-check error:', conflictErr.message);
      return apiError('Database error.', conflictErr);
    }
    if (conflict) {
      return NextResponse.json(
        { error: `Slot ${newSlot} is already occupied. Choose an empty slot.` },
        { status: 409 },
      );
    }
  }

  // 4. Stamp last_updated_at (DB DEFAULT NOW() only fires on INSERT) and update.
  //    Defense-in-depth: scope the update to userId in addition to id.
  payload.last_updated_at = new Date().toISOString();

  const { data: updated, error: updateErr } = await db
    .from('athlete_pitches')
    .update(payload)
    .eq('id', id)
    .eq('athlete_clerk_id', userId)
    .select()
    .single();

  if (updateErr) {
    if (updateErr.code === '23505') {
      return NextResponse.json(
        { error: `Slot ${payload.pitch_slot} is already occupied. Choose an empty slot.` },
        { status: 409 },
      );
    }
    console.error('[athlete/pitches/:id] PATCH update error:', updateErr.message);
    return apiError('Failed to update pitch.', updateErr);
  }

  return NextResponse.json({ success: true, pitch: updated as AthletePitch });
}

// ── DELETE /api/athlete/pitches/[id] ─────────────────────────────────────────
// Remove a pitch the athlete owns. 204 No Content on success.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing pitch id.' }, { status: 400 });

  const db = createAdminClient();

  // Fetch first for a clean 404 + ownership check (vs. silent no-op delete).
  const { data: row, error: fetchErr } = await db
    .from('athlete_pitches')
    .select('id, athlete_clerk_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    console.error('[athlete/pitches/:id] DELETE fetch error:', fetchErr.message);
    return apiError('Database error.', fetchErr);
  }
  if (!row) return NextResponse.json({ error: 'Pitch not found.' }, { status: 404 });
  if ((row as { athlete_clerk_id: string }).athlete_clerk_id !== userId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error: deleteErr } = await db
    .from('athlete_pitches')
    .delete()
    .eq('id', id)
    .eq('athlete_clerk_id', userId);

  if (deleteErr) {
    console.error('[athlete/pitches/:id] DELETE error:', deleteErr.message);
    return apiError('Failed to delete pitch.', deleteErr);
  }

  return new NextResponse(null, { status: 204 });
}
