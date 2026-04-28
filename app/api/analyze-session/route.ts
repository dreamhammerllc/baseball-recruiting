/**
 * Accepts a PDF, CSV, or image of a session report from HitTrax, Rapsodo,
 * Blast Motion, or Perfect Game and uses Claude to extract metric data.
 * Returns extracted metrics for athlete confirmation before saving.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import Anthropic from '@anthropic-ai/sdk';

// /api/* is excluded from clerkMiddleware so auth() has no context here.
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
    console.error('[analyze-session] authenticateRequest error:', err);
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceType = 'hittrax' | 'rapsodo' | 'blast_motion' | 'perfect_game';

interface ExtractedSession {
  athleteName:  string | null;
  sessionDate:  string | null;
  metrics:      Record<string, number>;
  confidence:   number;
  flags:        string[];
}

// ─── Supported media types (same as analyze-document pattern) ─────────────────

const SUPPORTED_IMAGE_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// ─── Source type display labels ───────────────────────────────────────────────

const SOURCE_LABELS: Record<SourceType, string> = {
  hittrax:       'HitTrax',
  rapsodo:       'Rapsodo',
  blast_motion:  'Blast Motion',
  perfect_game:  'Perfect Game',
};

// ─── POST /api/analyze-session ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── Parse multipart form data ─────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });
  }

  const file        = formData.get('file');
  const sourceType  = formData.get('sourceType');
  const athleteName = formData.get('athleteName');

  // ── Validate fields ───────────────────────────────────────────────────────
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing or invalid file field.' }, { status: 400 });
  }

  const validSourceTypes: SourceType[] = ['hittrax', 'rapsodo', 'blast_motion', 'perfect_game'];
  if (!sourceType || !validSourceTypes.includes(sourceType as SourceType)) {
    return NextResponse.json(
      { error: 'sourceType must be one of: hittrax, rapsodo, blast_motion, perfect_game.' },
      { status: 400 },
    );
  }

  if (!athleteName || typeof athleteName !== 'string' || athleteName.trim() === '') {
    return NextResponse.json({ error: 'athleteName is required.' }, { status: 400 });
  }

  const source       = sourceType as SourceType;
  const sourceLabel  = SOURCE_LABELS[source];
  const athleteNameTrimmed = athleteName.trim();

  // ── Read file and determine media type ────────────────────────────────────
  let fileBuffer: ArrayBuffer;
  let contentType: string;

  try {
    fileBuffer  = await file.arrayBuffer();
    contentType = file.type.split(';')[0].trim() || 'application/octet-stream';
  } catch (err) {
    console.error('[analyze-session] Failed to read file:', err);
    return NextResponse.json({ error: 'Failed to read uploaded file.' }, { status: 400 });
  }

  const isPdf   = contentType === 'application/pdf';
  const isImage = SUPPORTED_IMAGE_TYPES.has(contentType);

  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: `File type "${contentType}" cannot be analyzed. Upload a PDF or JPEG/PNG/WebP image.` },
      { status: 415 },
    );
  }

  const base64Data = Buffer.from(fileBuffer).toString('base64');

  // ── Build Claude media block (same pattern as analyze-document) ───────────
  type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const mediaBlock = isPdf
    ? ({
        type: 'document' as const,
        source: {
          type:       'base64' as const,
          media_type: 'application/pdf' as const,
          data:       base64Data,
        },
      })
    : ({
        type: 'image' as const,
        source: {
          type:       'base64' as const,
          media_type: contentType as ImageMediaType,
          data:       base64Data,
        },
      });

  // ── Build Claude prompt ───────────────────────────────────────────────────
  const prompt = `This is a ${sourceLabel} session report.

Extract the following information from the document:

1. Athlete name — the full name of the athlete as it appears on the document. Return null if not found.

2. Session date — the date of the session in YYYY-MM-DD format. Return null if not found.

3. Metrics — extract any of the following metrics that appear in the document (use exact keys):
   - exit_velocity (unit: mph)
   - bat_speed (unit: mph)
   - fastball_velocity (unit: mph)
   - curveball_velocity (unit: mph)
   - slider_velocity (unit: mph)
   - changeup_velocity (unit: mph)
   - spin_rate (unit: rpm)
   - vertical_break (unit: in)
   - horizontal_break (unit: in)
   - sixty_yard_dash (unit: s)

   Only include metrics that are clearly present in the document. Use numeric values only.

4. Confidence — your confidence level (0-100) that the extracted data is accurate and complete.

5. Flags — an array of strings noting any concerns such as:
   - Suspicious or out-of-range values
   - Ambiguous or conflicting data
   - Any other inconsistencies

Return ONLY a valid JSON object with no markdown fences, no explanation, no extra text:
{"athleteName": <string or null>, "sessionDate": <string or null>, "metrics": {<key>: <number>, ...}, "confidence": <number 0-100>, "flags": [<string>, ...]}`;

  // ── Call Claude ───────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.APP_AI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  let extracted: ExtractedSession;
  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{
        role:    'user',
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
      throw new Error(`No JSON found in Claude response: ${raw.slice(0, 200)}`);
    }

    extracted = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as ExtractedSession;

    // Ensure required fields are present with safe defaults
    if (!Array.isArray(extracted.flags))        extracted.flags        = [];
    if (typeof extracted.confidence !== 'number') extracted.confidence = 0;
    if (typeof extracted.metrics    !== 'object') extracted.metrics    = {};
    if (extracted.athleteName === undefined)       extracted.athleteName = null;
    if (extracted.sessionDate  === undefined)       extracted.sessionDate  = null;

  } catch (err) {
    console.error('[analyze-session] Claude extraction failed:', err);
    return NextResponse.json(
      { error: 'Session analysis failed. Please try again.' },
      { status: 500 },
    );
  }

  // ── Cross-reference athlete name ──────────────────────────────────────────
  if (extracted.athleteName !== null) {
    const docName     = extracted.athleteName.toLowerCase().trim();
    const profileName = athleteNameTrimmed.toLowerCase();

    if (docName !== profileName) {
      extracted.flags.push('Name on document does not match profile name');
    }
  }

  // ── Return result ─────────────────────────────────────────────────────────
  return NextResponse.json({
    success:   true,
    extracted,
    verified:  extracted.confidence >= 80,
  });
}
