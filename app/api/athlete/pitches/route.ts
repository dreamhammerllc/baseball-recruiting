export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { apiError } from '@/lib/apiError';
import type { AthletePitch } from '@/lib/metrics';
import {
  UPDATEABLE_FIELDS,
  REQUIRED_ON_CREATE,
  validatePitchField,
} from '@/lib/pitchValidation';

// ── GET — return all pitches for the authenticated athlete, ordered by pitch_slot ASC.
// Mirrors the auth + response shape of /api/athlete/metrics.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('athlete_pitches')
    .select('*')
    .eq('athlete_clerk_id', userId)
    .order('pitch_slot', { ascending: true });

  if (error) {
    console.error('[athlete/pitches] GET error:', error.message);
    return apiError('Failed to fetch pitches.', error);
  }

  return NextResponse.json({ pitches: (data ?? []) as AthletePitch[] });
}

// ── POST — create a new pitch for the authenticated athlete. ─────────────────
// Required fields: pitch_slot, pitch_type, verification_type. Optional fields
// default to null when omitted from the request body. Slot collisions return
// 409 (UNIQUE constraint on (athlete_clerk_id, pitch_slot)).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // Required-field gate (presence). Content validation happens in the loop below.
  for (const f of REQUIRED_ON_CREATE) {
    if (!(f in body)) {
      return NextResponse.json({ error: `${f} is required.` }, { status: 400 });
    }
  }

  // Athletes can't self-assign coach_verified; only a Diamond Verified coach can.
  // Kept out of the shared validator so PATCH can resend it as a no-op.
  if (body.verification_type === 'coach_verified') {
    return NextResponse.json(
      {
        error:   'verification_type_forbidden',
        message: 'Coach-verified pitches can only be created by a Diamond Verified coach.',
      },
      { status: 403 },
    );
  }

  // Per-field validation. Optional fields not in body are written as explicit null.
  const payload: Record<string, unknown> = {
    athlete_clerk_id: userId,
    ai_confidence:    null,
  };
  for (const field of UPDATEABLE_FIELDS) {
    if (field in body) {
      const err = validatePitchField(field, body[field]);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      payload[field] = body[field];
    } else {
      payload[field] = null;
    }
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('athlete_pitches')
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Slot ${body.pitch_slot} is already occupied. Choose an empty slot or edit the existing pitch.` },
        { status: 409 },
      );
    }
    console.error('[athlete/pitches] POST error:', error.message);
    return apiError('Failed to create pitch.', error);
  }

  return NextResponse.json({ success: true, pitch: data as AthletePitch }, { status: 201 });
}
