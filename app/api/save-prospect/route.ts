/**
 * BEFORE THIS ROUTE WILL WORK — run once in the Supabase SQL editor:
 *
 *   CREATE TABLE IF NOT EXISTS saved_prospects (
 *     id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     coach_clerk_id   text        NOT NULL,
 *     athlete_clerk_id text        NOT NULL,
 *     saved_at         timestamptz DEFAULT now(),
 *     UNIQUE(coach_clerk_id, athlete_clerk_id)
 *   );
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase';

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
    console.error('[save-prospect] authenticateRequest error:', err);
    return null;
  }
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = await getAuthenticatedUserId(req);
  console.log('[save-prospect] userId from authenticateRequest:', userId);

  if (!userId) {
    console.log('[save-prospect] 401 — no userId in session');
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  let athleteClerkId: string;

  try {
    body = await req.json();
    console.log('[save-prospect] request body:', JSON.stringify(body));
    athleteClerkId = (body as Record<string, unknown>).athleteClerkId as string;
  } catch (err) {
    console.error('[save-prospect] 400 — JSON parse failed:', err);
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!athleteClerkId || typeof athleteClerkId !== 'string') {
    console.log(
      '[save-prospect] 400 — athleteClerkId missing or wrong type:',
      athleteClerkId,
      typeof athleteClerkId,
    );
    return NextResponse.json({ error: 'Missing required field: athleteClerkId.' }, { status: 400 });
  }

  console.log('[save-prospect] athleteClerkId:', athleteClerkId, '| userId:', userId);

  // Self-save guard — log and skip rather than hard-reject so testing is easier
  if (athleteClerkId === userId) {
    console.log('[save-prospect] skipping — athleteClerkId equals userId (self-save)');
    // Return current saved state as false rather than an error
    return NextResponse.json({ saved: false });
  }

  const db = createAdminClient();

  // ── Check if already saved ────────────────────────────────────────────────
  const { data: existing, error: selectError } = await db
    .from('saved_prospects')
    .select('id')
    .eq('coach_clerk_id', userId)
    .eq('athlete_clerk_id', athleteClerkId)
    .maybeSingle();

  if (selectError) {
    console.error('[save-prospect] select failed — code:', selectError.code, '| message:', selectError.message, '| details:', selectError.details);
    return NextResponse.json({ error: 'Database error.' }, { status: 500 });
  }

  console.log('[save-prospect] existing row:', existing);

  // ── Toggle: delete if saved, insert if not ────────────────────────────────
  if (existing) {
    const { error: deleteError } = await db
      .from('saved_prospects')
      .delete()
      .eq('id', existing.id);

    if (deleteError) {
      console.error('[save-prospect] delete failed — code:', deleteError.code, '| message:', deleteError.message);
      return NextResponse.json({ error: 'Failed to unsave prospect.' }, { status: 500 });
    }

    console.log('[save-prospect] unsaved — id:', existing.id);
    return NextResponse.json({ saved: false });
  } else {
    const { error: insertError } = await db
      .from('saved_prospects')
      .insert({ coach_clerk_id: userId, athlete_clerk_id: athleteClerkId });

    if (insertError) {
      console.error('[save-prospect] insert failed — code:', insertError.code, '| message:', insertError.message, '| details:', insertError.details);
      return NextResponse.json({ error: 'Failed to save prospect.' }, { status: 500 });
    }

    console.log('[save-prospect] saved — coach:', userId, '| athlete:', athleteClerkId);

    // ── Notify the athlete by email (fire-and-forget; never fails the save) ──
    void sendSaveNotification(athleteClerkId, db);

    return NextResponse.json({ saved: true });
  }
}

// ── Email notification ────────────────────────────────────────────────────────

async function sendSaveNotification(
  athleteClerkId: string,
  db: ReturnType<typeof createAdminClient>,
): Promise<void> {
  try {
    // 1. Try the athletes table for a stored email column first
    let athleteEmail: string | null = null;
    let athleteName = 'Athlete';

    const { data: athleteRow } = await db
      .from('athletes')
      .select('first_name, last_name, email')
      .eq('clerk_user_id', athleteClerkId)
      .maybeSingle();

    if (athleteRow) {
      const parts = [athleteRow.first_name, athleteRow.last_name].filter(Boolean);
      if (parts.length) athleteName = parts.join(' ');
      athleteEmail = (athleteRow.email as string | null) ?? null;
    }

    // 2. If no email in DB, fall back to Clerk
    if (!athleteEmail) {
      try {
        const clerkUser = await clerk.users.getUser(athleteClerkId);
        athleteEmail = clerkUser.emailAddresses[0]?.emailAddress ?? null;
        // Use Clerk's name if we didn't get one from the DB
        if (athleteName === 'Athlete') {
          const clerkName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');
          if (clerkName) athleteName = clerkName;
        }
      } catch (clerkErr) {
        console.error('[save-prospect] Clerk user lookup failed:', clerkErr);
      }
    }

    if (!athleteEmail) {
      console.warn('[save-prospect] no email found for athlete:', athleteClerkId, '— skipping notification');
      return;
    }

    const profileUrl = `https://baseballrecruit.com/profile/${athleteClerkId}`;

    const { error: emailError } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [athleteEmail],
      subject: 'A college coach is following your Diamond Verified profile',
      html: buildNotificationHtml(athleteName, profileUrl),
    });

    if (emailError) {
      console.error('[save-prospect] resend failed:', emailError);
    } else {
      console.log('[save-prospect] notification sent to:', athleteEmail);
    }
  } catch (err) {
    // Swallow — email failure must never surface as a save failure
    console.error('[save-prospect] sendSaveNotification unexpected error:', err);
  }
}

function buildNotificationHtml(athleteName: string, profileUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>A college coach is following your profile</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e14;font-family:Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Brand bar -->
          <tr>
            <td style="padding-bottom:28px;" align="center">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#e8a020;width:8px;height:8px;border-radius:4px;vertical-align:middle;"></td>
                  <td style="padding-left:8px;font-size:11px;font-weight:700;color:#e8a020;letter-spacing:2px;vertical-align:middle;">BASEBALLRECRUIT</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#111827;border:1px solid #1e2530;border-radius:12px;padding:40px;overflow:hidden;">

              <!-- Eyebrow -->
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;">
                Profile Activity
              </p>

              <!-- Heading -->
              <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                Hey ${athleteName} 👋
              </h1>

              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
                Diamond Verified &middot; Recruiting Update
              </p>

              <!-- Amber rule -->
              <div style="height:1px;background:#e8a020;opacity:0.3;margin-bottom:28px;"></div>

              <!-- Icon + headline -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="vertical-align:top;padding-right:14px;">
                    <div style="width:42px;height:42px;border-radius:50%;background:rgba(232,160,32,0.12);border:1px solid rgba(232,160,32,0.3);display:flex;align-items:center;justify-content:center;text-align:center;line-height:42px;font-size:20px;">
                      🔖
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:17px;font-weight:700;color:#ffffff;line-height:1.4;">
                      A college program bookmarked your profile
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Body copy -->
              <p style="margin:0 0 28px;font-size:15px;color:#9ca3af;line-height:1.75;">
                A college program has bookmarked your profile on Diamond Verified.
                Keep improving your verified stats to stand out — coaches are watching.
              </p>

              <!-- Tips list -->
              <table cellpadding="0" cellspacing="0" border="0"
                     style="background:#0d1117;border:1px solid #1e2530;border-radius:8px;padding:20px 24px;margin-bottom:28px;width:100%;">
                <tr>
                  <td>
                    <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#4b5563;letter-spacing:1.2px;text-transform:uppercase;">
                      Stand out to coaches
                    </p>
                    <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;line-height:1.6;">
                      ◆&nbsp; Upload your transcript and test scores to earn the Diamond Verified badge
                    </p>
                    <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;line-height:1.6;">
                      ◆&nbsp; Add a highlight video link to your profile
                    </p>
                    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                      ◆&nbsp; Keep your stats current heading into the season
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#e8a020;border-radius:8px;">
                    <a href="${profileUrl}" target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#0a0e14;text-decoration:none;letter-spacing:-0.2px;">
                      View Your Profile &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:#1e2530;margin-bottom:20px;"></div>

              <!-- URL fallback -->
              <p style="margin:0;font-size:12px;color:#4b5563;line-height:1.6;">
                If the button doesn't work, copy and paste this link:<br/>
                <a href="${profileUrl}" style="color:#e8a020;text-decoration:none;">${profileUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;" align="center">
              <p style="margin:0;font-size:11px;color:#374151;letter-spacing:1px;font-weight:700;">
                DIAMOND VERIFIED &nbsp;&middot;&nbsp; BASEBALLRECRUIT
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#1f2937;">
                You received this because a college program saved your athlete profile.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
