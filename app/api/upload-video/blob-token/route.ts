import { NextResponse } from 'next/server';

// This endpoint has been replaced by /api/upload-video (Bunny.net).
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is no longer active. Use /api/upload-video instead.' },
    { status: 410 },
  );
}
