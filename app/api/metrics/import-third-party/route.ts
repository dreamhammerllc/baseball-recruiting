import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import Anthropic from '@anthropic-ai/sdk';

// /api/* is excluded from clerkMiddleware — use authenticateRequest directly.
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
    console.error('[import-third-party] authenticateRequest error:', err);
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolType = 'hittrax' | 'rapsodo' | 'blast_motion';
type ImageMediaType = 'image/png' | 'image/jpeg';

// ─── Per-tool system prompts ──────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<ToolType, string> = {
  hittrax: `You are analyzing a HitTrax session report screenshot or PDF. Extract the following metrics if they are visible:
- exit_velocity: max exit velocity in mph (numeric only)
- launch_angle: launch angle in degrees (numeric only)
- distance: hit distance in feet (numeric only)

Respond ONLY with a valid JSON object where keys are metric names and values are numbers. Example: {"exit_velocity": 98.4, "launch_angle": 12, "distance": 340}. If a metric is not clearly present in the image, omit it entirely. No extra text, no markdown fences, no explanation.`,

  rapsodo: `You are analyzing a Rapsodo pitching session screenshot or PDF. Extract the following metrics if they are visible:
- fastball_velocity: four-seam fastball velocity in mph (numeric only)
- curveball_velocity: curveball velocity in mph (numeric only)
- slider_velocity: slider velocity in mph (numeric only)

Respond ONLY with a valid JSON object where keys are metric names and values are numbers. Example: {"fastball_velocity": 88.2, "slider_velocity": 82.1}. If a metric is not clearly present in the image, omit it entirely. No extra text, no markdown fences, no explanation.`,

  blast_motion: `You are analyzing a Blast Motion swing data screenshot or PDF. Extract the following metrics if they are visible:
- bat_speed: bat speed in mph (numeric only)
- attack_angle: attack angle in degrees (numeric only)

Respond ONLY with a valid JSON object where keys are metric names and values are numbers. Example: {"bat_speed": 72.5, "attack_angle": 8}. If a metric is not clearly present in the image, omit it entirely. No extra text, no markdown fences, no explanation.`,
};

// ─── POST /api/metrics/import-third-party ─────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { tool: string; fileData: string; fileType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { tool, fileData, fileType } = body;

  const validTools: ToolType[] = ['hittrax', 'rapsodo', 'blast_motion'];
  if (!tool || !validTools.includes(tool as ToolType)) {
    return NextResponse.json(
      { error: 'Invalid tool. Must be hittrax, rapsodo, or blast_motion.' },
      { status: 400 },
    );
  }

  if (!fileData || typeof fileData !== 'string') {
    return NextResponse.json({ error: 'Missing fileData.' }, { status: 400 });
  }

  const validFileTypes = ['image/png', 'image/jpeg', 'application/pdf'];
  if (!fileType || !validFileTypes.includes(fileType)) {
    return NextResponse.json(
      { error: 'fileType must be image/png, image/jpeg, or application/pdf.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.APP_AI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 });
  }

  // ── Build media block ─────────────────────────────────────────────────────
  const isPdf = fileType === 'application/pdf';

  const mediaBlock = isPdf
    ? ({
        type:   'document' as const,
        source: {
          type:       'base64' as const,
          media_type: 'application/pdf' as const,
          data:       fileData,
        },
      })
    : ({
        type:   'image' as const,
        source: {
          type:       'base64' as const,
          media_type: fileType as ImageMediaType,
          data:       fileData,
        },
      });

  // ── Call Claude ───────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey });
  let metrics: Record<string, number>;

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 500,
      system:     SYSTEM_PROMPTS[tool as ToolType],
      messages:   [{
        role:    'user',
        content: [
          mediaBlock,
          { type: 'text', text: 'Extract the metrics from this report and return only a JSON object.' },
        ],
      }],
    });

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd   = raw.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`No JSON found in Claude response: ${raw.slice(0, 200)}`);
    }

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;

    // Only keep numeric, finite values
    metrics = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'number' && isFinite(val)) {
        metrics[key] = val;
      }
    }
  } catch (err) {
    console.error('[import-third-party] Claude extraction failed:', err);
    return NextResponse.json(
      { error: 'Extraction failed. Please try again.' },
      { status: 500 },
    );
  }

  console.log('[POST /api/metrics/import-third-party] extracted:', { userId, tool, metrics });
  return NextResponse.json({ success: true, metrics });
}
