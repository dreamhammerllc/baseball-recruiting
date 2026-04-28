/**
 * BEFORE THE VERIFICATION BADGE WILL WORK — run this in the Supabase SQL editor:
 *
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS is_verified  boolean    DEFAULT false;
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS verified_at  timestamptz;
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  try {
    const state = await clerk.authenticateRequest(req, {
      secretKey:      process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
    if (!state.isSignedIn) return null;
    return state.toAuth().userId;
  } catch (err) {
    console.error('[analyze-document] authenticateRequest error:', err);
    return null;
  }
}

// ─── Supabase admin client ────────────────────────────────────────────────────

function getAdminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !serviceKey) throw new Error('Supabase env vars not configured.');
  return createClient(url, serviceKey);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = 'transcript' | 'test_scores';

interface ExtractedTranscript {
  gpa: number | null;
  name: string | null;
}

interface ExtractedTestScores {
  sat: number | null;
  act: number | null;
}

type ExtractedData = ExtractedTranscript | ExtractedTestScores;

// ─── Prompts ──────────────────────────────────────────────────────────────────

const TRANSCRIPT_PROMPT = `You are reading an academic transcript. Extract the following:
1. GPA — cumulative GPA as a decimal number (e.g. 3.8). Prefer weighted GPA if both weighted and unweighted are shown. Return null if not found.
2. Student's full name as it appears on the document. Return null if not visible.

Return ONLY a valid JSON object with no markdown fences, no explanation, no extra text:
{"gpa": <number or null>, "name": "<string or null>"}`;

const TEST_SCORES_PROMPT = `You are reading a standardized test score report. Extract the following:
1. SAT total score — the sum of the Evidence-Based Reading & Writing section and the Math section (e.g. 1320). Return null if not present.
2. ACT composite score — the overall composite score (e.g. 28). Return null if not present.

Return ONLY a valid JSON object with no markdown fences, no explanation, no extra text:
{"sat": <integer or null>, "act": <integer or null>}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Claude supports these image media types natively
const SUPPORTED_IMAGE_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let documentUrl: string;
  let documentType: DocType;
  let athleteId: string;

  try {
    const body = await req.json();
    documentUrl  = body.documentUrl;
    documentType = body.documentType;
    athleteId    = body.athleteId;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!documentUrl || !documentType || !athleteId) {
    return NextResponse.json({ error: 'Missing required fields: documentUrl, documentType, athleteId.' }, { status: 400 });
  }

  if (documentType !== 'transcript' && documentType !== 'test_scores') {
    return NextResponse.json({ error: 'documentType must be "transcript" or "test_scores".' }, { status: 400 });
  }

  // Security: athleteId in the request body must match the authenticated session
  if (athleteId !== userId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // ── Fetch the document from storage ───────────────────────────────────────
  let fileBuffer: ArrayBuffer;
  let contentType: string;

  try {
    const fileRes = await fetch(documentUrl);
    if (!fileRes.ok) {
      throw new Error(`Storage returned HTTP ${fileRes.status}`);
    }
    fileBuffer  = await fileRes.arrayBuffer();
    // Strip parameters like "; charset=utf-8" from the content-type header
    contentType = (fileRes.headers.get('content-type') ?? 'application/octet-stream')
      .split(';')[0]
      .trim();
  } catch (err) {
    console.error('[analyze-document] file fetch failed:', err);
    return NextResponse.json(
      { error: 'Could not retrieve the uploaded file from storage.' },
      { status: 502 },
    );
  }

  // ── Validate that Claude can read this media type ─────────────────────────
  const isPdf   = contentType === 'application/pdf';
  const isImage = SUPPORTED_IMAGE_TYPES.has(contentType);

  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: `File type "${contentType}" cannot be analyzed by Claude. Upload a PDF or a JPEG/PNG/WebP image.` },
      { status: 415 },
    );
  }

  const base64Data = Buffer.from(fileBuffer).toString('base64');

  // ── Build the Claude content block ────────────────────────────────────────
  // PDFs use type:"document"; images use type:"image"
  type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const mediaBlock = isPdf
    ? ({
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: base64Data,
        },
      })
    : ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: contentType as ImageMediaType,
          data: base64Data,
        },
      });

  // ── Call Claude ───────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.APP_AI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  const prompt = documentType === 'transcript' ? TRANSCRIPT_PROMPT : TEST_SCORES_PROMPT;

  let extracted: ExtractedData;
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          mediaBlock,
          { type: 'text', text: prompt },
        ],
      }],
    });

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd   = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`No JSON object found in Claude response: ${raw.slice(0, 200)}`);
    }
    extracted = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as ExtractedData;
  } catch (err) {
    console.error('[analyze-document] Claude extraction failed:', err);
    return NextResponse.json(
      { error: 'Document analysis failed. Please try again.' },
      { status: 500 },
    );
  }

  // ── Write extracted values back to the athletes table ─────────────────────
  const updatePayload: Record<string, unknown> = {};

  if (documentType === 'transcript') {
    const t = extracted as ExtractedTranscript;
    if (t.gpa != null)  updatePayload.gpa_weighted = t.gpa;
    if (t.name != null) {
      const parts = t.name.trim().split(/\s+/);
      updatePayload.first_name = parts[0]             ?? null;
      updatePayload.last_name  = parts.slice(1).join(' ') || null;
    }
  } else {
    const s = extracted as ExtractedTestScores;
    if (s.sat != null) updatePayload.sat_score = s.sat;
    if (s.act != null) updatePayload.act_score = s.act;
  }

  try {
    const db = getAdminClient();

    // Write extracted values (best-effort — don't fail the request if this errors)
    if (Object.keys(updatePayload).length > 0) {
      const { error: dbError } = await db
        .from('athletes')
        .update(updatePayload)
        .eq('clerk_user_id', userId);

      if (dbError) {
        console.error('[analyze-document] athletes update failed:', dbError.message);
      }
    }

    // ── Check if both documents are now uploaded → grant verified status ──────
    // The upload route already set transcript_url / test_scores_url before this
    // route was called, so the row should reflect both URLs if both are uploaded.
    const { data: athlete, error: fetchError } = await db
      .from('athletes')
      .select('transcript_url, test_scores_url, is_verified')
      .eq('clerk_user_id', userId)
      .single();

    if (fetchError) {
      console.error('[analyze-document] athlete fetch for verification check failed:', fetchError.message);
    } else if (
      athlete?.transcript_url &&
      athlete?.test_scores_url &&
      !athlete?.is_verified
    ) {
      // Both documents present and not yet marked verified — grant the badge now
      const { error: verifyError } = await db
        .from('athletes')
        .update({ is_verified: true, verified_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);

      if (verifyError) {
        console.error('[analyze-document] is_verified update failed:', verifyError.message);
      } else {
        console.log('[analyze-document] athlete verified:', userId);
      }
    }
  } catch (err) {
    console.error('[analyze-document] DB client init failed:', err);
  }

  return NextResponse.json({ success: true, extracted });
}
