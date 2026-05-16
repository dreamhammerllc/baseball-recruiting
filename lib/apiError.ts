import { NextResponse } from 'next/server';

type PgErrorish = {
  message?: string;
  code?: string;
  hint?: string;
  details?: string;
};

/**
 * Standardized API error response producing the 5-field shape documented in
 * CLAUDE.md.
 *
 * The `error` field MUST always be a static, human-safe sentence — never the
 * raw DB message — because clients may display it to users and we don't want
 * Postgres internals (column names, constraint names, table structure) leaking
 * through.
 *
 * Raw Postgres error metadata (code/hint/details) and the raw caught message
 * (carried in `stack` by legacy convention; it's the error message, NOT a JS
 * stack trace) come along for debugging.
 */
export function apiError(
  message: string,
  e: unknown = null,
  status: number = 500
): NextResponse {
  const x = (e ?? null) as PgErrorish | null;
  return NextResponse.json(
    {
      error: message,
      code: x?.code ?? null,
      hint: x?.hint ?? null,
      details: x?.details ?? null,
      stack: x?.message ?? null,
    },
    { status }
  );
}
