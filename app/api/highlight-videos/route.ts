import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { TIER_FEATURES, normalizeTier } from '@/lib/pricing';

// POST /api/highlight-videos
//
// Persists a Bunny Stream upload into the highlight_videos slot table. Called
// by the athlete dashboard after VideoUpload's TUS direct-to-Bunny flow
// completes — the legacy multipart /api/upload-video route is dead for the
// highlight path and never gets called from the UI.
//
// Auth is Clerk-based (no Supabase auth), so this route uses createAdminClient()
// for all DB access. RLS is not enabled on highlight_videos and tier enforcement
// happens here at the application layer.

export const runtime = 'nodejs';

interface PostBody {
  slotNumber: number;
  videoUrl:   string;
  title?:     string | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  const { slotNumber, videoUrl, title } = body;

  if (typeof slotNumber !== 'number' || !Number.isInteger(slotNumber) || slotNumber < 1) {
    return NextResponse.json(
      { error: 'slotNumber must be an integer >= 1.' },
      { status: 400 },
    );
  }
  if (typeof videoUrl !== 'string' || videoUrl.trim() === '') {
    return NextResponse.json({ error: 'videoUrl is required.' }, { status: 400 });
  }

  const db = createAdminClient();

  // ── Tier / slot-count enforcement ────────────────────────────────────────
  // Resolve the athlete's tier server-side (UI can't be trusted). Missing
  // athlete row → 'free'. Then bound slotNumber by TIER_FEATURES.highlightSlots.
  const { data: athleteRow } = await db
    .from('athletes')
    .select('subscription_tier')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  const tier     = normalizeTier(
    (athleteRow as { subscription_tier: string | null } | null)?.subscription_tier,
  );
  const maxSlots = TIER_FEATURES[tier].highlightSlots;

  if (maxSlots === 0) {
    return NextResponse.json(
      { error: 'Highlight uploads require a paid plan.' },
      { status: 403 },
    );
  }
  if (slotNumber > maxSlots) {
    return NextResponse.json(
      { error: `Your plan includes ${maxSlots} highlight slots.` },
      { status: 403 },
    );
  }

  // ── Upsert ────────────────────────────────────────────────────────────────
  const { error } = await db
    .from('highlight_videos')
    .upsert(
      {
        athlete_clerk_id: userId,
        slot_number:      slotNumber,
        video_url:        videoUrl,
        title:            title ?? null,
      },
      { onConflict: 'athlete_clerk_id,slot_number' },
    );

  if (error) {
    console.error('[highlight-videos POST] upsert failed:', error.message);
    return NextResponse.json(
      {
        error:   error.message,
        code:    error.code    ?? null,
        hint:    error.hint    ?? null,
        details: error.details ?? null,
        stack:   null,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
