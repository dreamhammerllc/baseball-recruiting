import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ShareProfileBody {
  coachEmail: string;
  athleteName: string;
  profileUrl: string;
  position: string | null;
  gradYear: string | null;
  fitScore: number | null;
}

function buildEmailHtml(body: ShareProfileBody): string {
  const { athleteName, position, gradYear, profileUrl, fitScore } = body;

  const positionLine = [position, gradYear ? `Class of ${gradYear}` : null]
    .filter(Boolean)
    .join('  ·  ');

  const fitBadge = fitScore !== null
    ? `<div style="display:inline-block;background:#1a2030;border:1px solid #2a3545;border-radius:8px;padding:12px 24px;margin:20px 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Overall Fit Score</div>
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:36px;font-weight:700;color:${fitScore >= 80 ? '#e8a020' : fitScore >= 60 ? '#3b82f6' : '#9ca3af'};">${fitScore}<span style="font-size:18px;color:#4b5563;">/100</span></div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recruit Profile: ${athleteName}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e14;font-family:Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header brand bar -->
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
            <td style="background-color:#111827;border:1px solid #1e2530;border-radius:12px;padding:40px;position:relative;overflow:hidden;">

              <!-- Eyebrow -->
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:1.5px;text-transform:uppercase;">
                New Recruit Profile
              </p>

              <!-- Athlete name -->
              <h1 style="margin:0 0 6px;font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                ${athleteName}
              </h1>

              <!-- Position / grad year -->
              ${positionLine ? `<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">${positionLine}</p>` : '<div style="margin-bottom:24px;"></div>'}

              <!-- Amber rule -->
              <div style="height:1px;background:#e8a020;opacity:0.3;margin-bottom:24px;"></div>

              <!-- Fit score badge -->
              ${fitBadge}

              <!-- Body copy -->
              <p style="margin:${fitScore !== null ? '4px' : '0'} 0 28px;font-size:15px;color:#9ca3af;line-height:1.7;">
                A verified athlete profile has been shared with you through the BaseballRecruit platform.
                View the full profile below to see detailed stats, school matches, and a personalized scout assessment.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#e8a020;border-radius:8px;">
                    <a href="${profileUrl}" target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#0a0e14;text-decoration:none;letter-spacing:-0.2px;">
                      View Full Profile &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:#1e2530;margin-bottom:24px;"></div>

              <!-- Profile URL fallback -->
              <p style="margin:0;font-size:12px;color:#4b5563;line-height:1.6;">
                If the button above doesn't work, copy and paste this link into your browser:<br/>
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
                You received this because a coach or athlete shared a recruiting profile with you.
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ShareProfileBody;

    const { coachEmail, athleteName, position, gradYear } = body;

    if (!coachEmail || !athleteName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Basic email format guard
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coachEmail)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const subjectParts = [
      'Recruit Profile:',
      athleteName,
      position ? `| ${position}` : null,
      gradYear ? `| Class of ${gradYear}` : null,
    ].filter(Boolean).join(' ');

    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [coachEmail],
      subject: subjectParts,
      html: buildEmailHtml(body),
    });

    if (error) {
      console.error('[share-profile] resend error:', error);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[share-profile] unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
