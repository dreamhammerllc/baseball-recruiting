import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

const ALLOWED_SOURCES = ['college_coach_portal'] as const;
type WaitlistSource = typeof ALLOWED_SOURCES[number];

interface WaitlistBody {
  email: string;
  name?: string;
  organization?: string;
  source: WaitlistSource;
}

function buildConfirmationHtml(source: WaitlistSource): string {
  const headline =
    source === 'college_coach_portal'
      ? "You're on the list for the college coach portal."
      : "You're on the list.";

  return `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d1117;color:#f0f6fc;border-radius:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
        <span style="color:#e8a020;font-size:20px;">&#11041;</span>
        <span style="font-family:'Courier New',Courier,monospace;font-size:12px;font-weight:700;letter-spacing:0.1em;color:#e8a020;">
          DIAMOND VERIFIED
        </span>
      </div>
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        ${headline}
      </h2>
      <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
        Thanks for joining the waitlist. We&apos;ll email you as soon as the
        college coach portal launches so you can start searching verified athletes.
      </p>
      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
        You received this email because you signed up on diamondverified.app.
      </p>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  let body: WaitlistBody;
  try {
    body = (await req.json()) as WaitlistBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || null;
  const organization = body.organization?.trim() || null;
  const source = body.source;

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (!source || !ALLOWED_SOURCES.includes(source)) {
    return NextResponse.json({ error: 'Invalid source.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('waitlist')
    .upsert(
      { email, name, organization, source },
      { onConflict: 'email,source' },
    );

  if (error) {
    console.error('[waitlist] insert error:', error.message);
    return NextResponse.json({ error: 'Failed to join the waitlist.' }, { status: 500 });
  }

  // Non-blocking confirmation email.
  try {
    await resend.emails.send({
      from: 'Diamond Verified <notifications@diamondverified.app>',
      to: email,
      subject: "You're on the list — Diamond Verified",
      html: buildConfirmationHtml(source),
    });
  } catch (e) {
    console.error('[waitlist] confirmation email error:', e);
  }

  return NextResponse.json({ ok: true });
}
