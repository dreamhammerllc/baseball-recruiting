/**
 * Vision extraction for device-readout files.
 *
 * Given a base64-encoded PDF or image of a readout from a baseball measurement
 * device (HitTrax / Rapsodo / Blast / Trackman / Pocket Radar / similar), ask
 * Claude what value is shown for a specific metric.
 *
 * Fail-safe by contract: this function NEVER throws. On any internal failure
 * (missing key, unsupported media type, network error, parse error) it returns
 * { value: null, confidence: 0, notes: '...' } so callers can capture the
 * outcome without branching on exceptions.
 *
 * Mirrors the Anthropic setup in app/api/metrics/import-third-party/route.ts —
 * same API-key resolution (`ANTHROPIC_API_KEY` then `APP_AI_KEY`), same model
 * (`claude-sonnet-4-6`), same base64-media-block construction. The prompt is
 * metric-targeted: it asks for a single value for `metricLabel` in `unit`, not
 * an arbitrary set of fields.
 */

import Anthropic from '@anthropic-ai/sdk';

// Image media types Claude can read natively. heic / heif are NOT in this set —
// they are intentionally rejected up front because Claude's image content block
// does not accept them.
const SUPPORTED_IMAGE_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface ExtractReadoutValueParams {
  metricKey:   string;
  metricLabel: string;
  unit:        string;
  fileBase64:  string;
  mimeType:    string;
}

export interface ExtractReadoutValueResult {
  value:      number | null;
  confidence: number;
  notes:      string | null;
}

export async function extractReadoutValue(
  params: ExtractReadoutValueParams,
): Promise<ExtractReadoutValueResult> {
  const { metricKey, metricLabel, unit, fileBase64, mimeType } = params;

  // ── Validate media type — anything we can't send to the Vision API is a
  //    no-op early return. heic / heif fall through to here on purpose.
  const isPdf   = mimeType === 'application/pdf';
  const isImage = SUPPORTED_IMAGE_TYPES.has(mimeType);

  if (!isPdf && !isImage) {
    return { value: null, confidence: 0, notes: 'unsupported file type for extraction' };
  }

  // ── Resolve API key (mirrors import-third-party + verify-metric)
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.APP_AI_KEY;
  if (!apiKey) {
    return { value: null, confidence: 0, notes: 'extraction error: no API key configured' };
  }

  // ── Build Claude media block
  const mediaBlock = isPdf
    ? ({
        type:   'document' as const,
        source: {
          type:       'base64' as const,
          media_type: 'application/pdf' as const,
          data:       fileBase64,
        },
      })
    : ({
        type:   'image' as const,
        source: {
          type:       'base64' as const,
          media_type: mimeType as ImageMediaType,
          data:       fileBase64,
        },
      });

  // ── Metric-targeted prompt. The model returns ONE number for ONE metric, or
  //    null if that metric isn't visible on this particular readout.
  const systemPrompt = `You are analyzing a screenshot or PDF of a readout from a baseball performance measurement device (HitTrax, Rapsodo, Blast Motion, Trackman, Pocket Radar, or similar). You extract a single numeric value for a single requested metric.

Return ONLY a valid JSON object with no markdown fences, no explanation, no extra text. The shape is exactly:
{"value": <number or null>, "confidence": <integer 0-100>, "notes": "<short string>"}

Rules:
- value: the numeric reading shown on the device for the requested metric, in the requested unit. Return null if that metric is not present anywhere on this readout.
- confidence: your confidence (0-100) that the value you returned is correct and corresponds to the requested metric. Use 0 when value is null.
- notes: a brief reason (one short sentence) — e.g. "max exit velocity from the session summary" or "metric not shown on this readout".`;

  const userText = `Requested metric: ${metricLabel} (${unit}) [internal key: ${metricKey}]

Extract the value for this metric from the readout and respond with the JSON object only.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 300,
      system:     systemPrompt,
      messages: [{
        role:    'user',
        content: [
          mediaBlock,
          { type: 'text', text: userText },
        ],
      }],
    });

    // ── Parse Claude's response — strip any code fences / surrounding prose
    //    by slicing between the first `{` and the last `}`.
    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd   = raw.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      return { value: null, confidence: 0, notes: 'extraction error: no JSON in response' };
    }

    const parsedUnknown = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as unknown;
    if (typeof parsedUnknown !== 'object' || parsedUnknown === null) {
      return { value: null, confidence: 0, notes: 'extraction error: response was not an object' };
    }
    const parsed = parsedUnknown as { value?: unknown; confidence?: unknown; notes?: unknown };

    // Coerce value → finite number or null
    let value: number | null = null;
    if (typeof parsed.value === 'number' && isFinite(parsed.value)) {
      value = parsed.value;
    } else if (typeof parsed.value === 'string' && parsed.value.trim() !== '') {
      const n = Number(parsed.value);
      value = isFinite(n) ? n : null;
    }

    // Coerce confidence → number (default 0)
    let confidence = 0;
    if (typeof parsed.confidence === 'number' && isFinite(parsed.confidence)) {
      confidence = parsed.confidence;
    } else if (typeof parsed.confidence === 'string') {
      const n = Number(parsed.confidence);
      confidence = isFinite(n) ? n : 0;
    }

    // Coerce notes → string | null
    const notes = typeof parsed.notes === 'string' && parsed.notes.trim() !== ''
      ? parsed.notes
      : null;

    return { value, confidence, notes };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // Keep the note short — the full error is logged at the call site if needed.
    const shortReason = reason.length > 120 ? reason.slice(0, 120) + '…' : reason;
    return { value: null, confidence: 0, notes: `extraction error: ${shortReason}` };
  }
}
