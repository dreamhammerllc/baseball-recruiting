'use server';

import Anthropic from '@anthropic-ai/sdk';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';

export interface SchoolMatch {
  school: string;
  division: string;
  fitScore: number;
  reason: string;
  athletic_fit: number;
}

export interface MatchInput {
  gradYear: string;
  state: string;
  gpa: string;
  testType: string;
  testScore: string;
  position: string;
  // pitcher
  velocity?: string;
  secondaryPitch?: string;
  inningsPitched?: string;
  era?: string;
  // catcher
  popTime?: string;
  catcherExitVelo?: string;
  catcherAvg?: string;
  armStrength?: string;
  // position player
  exitVelocity?: string;
  battingAvg?: string;
  fieldingPosition?: string;
  dash60?: string;
  // goals
  division: string;
  region: string;
  majorInterest: string;
  campusSize: string;
  // verification
  hasCoach: boolean | null;
  hasMeasurables: boolean | null;
  willingCombine: boolean | null;
  phone?: string;
  parentEmail?: string;
  fullName?: string;
}

function buildPrompt(d: MatchInput): string {
  const stats = d.position === 'pitcher'
    ? `Fastball: ${d.velocity || 'N/A'} mph, Secondary: ${d.secondaryPitch || 'N/A'}, IP: ${d.inningsPitched || 'N/A'}, ERA: ${d.era || 'N/A'}`
    : d.position === 'catcher'
    ? `Pop time: ${d.popTime || 'N/A'}s, Exit velo: ${d.catcherExitVelo || 'N/A'} mph, Avg: ${d.catcherAvg || 'N/A'}, Arm: ${d.armStrength || 'N/A'} mph`
    : `Exit velo: ${d.exitVelocity || 'N/A'} mph, Avg: ${d.battingAvg || 'N/A'}, Position: ${d.fieldingPosition || 'N/A'}, 60yd: ${d.dash60 || 'N/A'}s`;

  return `You are a college baseball recruiting expert. Based on the following athlete profile, recommend exactly 20 real NCAA/NAIA/JUCO college baseball programs that would be a strong fit.

ATHLETE PROFILE:
- Graduation year: ${d.gradYear}
- Home state: ${d.state}
- GPA: ${d.gpa} | ${d.testType}: ${d.testScore || 'Not provided'}
- Position: ${d.position}
- Stats: ${stats}
- Target division: ${d.division}
- Preferred region: ${d.region}
- Major interest: ${d.majorInterest || 'Undecided'}
- Campus size: ${d.campusSize}
- Has verifying coach: ${d.hasCoach ? 'Yes' : 'No'}
- Has HitTrax/Rapsodo data: ${d.hasMeasurables ? 'Yes' : 'No'}
- Willing to attend combine: ${d.willingCombine ? 'Yes' : 'No'}

Return ONLY a valid JSON array of exactly 20 objects. No markdown, no explanation, no text before or after the JSON.
Each object must have these exact keys:
- "school": full school name (string)
- "division": e.g. "D1", "D2", "D3", "NAIA", or "JUCO" (string)
- "fitScore": integer 0–100 representing overall fit (number)
- "reason": one concise sentence explaining why this school fits this athlete (string)
- "athletic_fit": integer 0–100 representing how well the athlete's stats match this program's typical roster (number)

Rank them from highest to lowest fitScore. Use real college programs. Consider the athlete's stats, academics, regional preference, and campus size.`;
}

async function saveToSupabase(
  userId: string,
  email: string,
  name: string | null,
  input: MatchInput,
  matches: SchoolMatch[],
): Promise<void> {
  const db = createAdminClient();

  // Use the form's fullName (Round 5) as primary; fall back to Clerk display name.
  const formName = input.fullName?.trim() || null;
  const sourceName = formName ?? name ?? null;
  const firstName = sourceName ? sourceName.split(' ')[0] : null;
  const lastName = sourceName ? sourceName.split(' ').slice(1).join(' ') || null : null;

  // Map internal position keys to display labels.
  const positionLabel = input.position === 'pitcher' ? 'Pitcher'
    : input.position === 'catcher' ? 'Catcher'
    : input.fieldingPosition || 'Position Player';

  console.log('[upsert] input fields:', {
    fullName: input.fullName,
    gradYear: input.gradYear,
    state: input.state,
    position: input.position,
    fieldingPosition: input.fieldingPosition,
    gpa: input.gpa,
    testType: input.testType,
    testScore: input.testScore,
  });

  const { data: athlete, error: athleteError } = await db
    .from('athletes')
    .upsert({
      clerk_user_id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      grad_year: input.gradYear,
      position: positionLabel,
      home_state: input.state || null,
      fastball_velocity_mph: input.velocity ? parseFloat(input.velocity) : null,
      exit_velocity_mph: input.exitVelocity ? parseFloat(input.exitVelocity)
        : input.catcherExitVelo ? parseFloat(input.catcherExitVelo) : null,
      sixty_yard_dash_seconds: input.dash60 ? parseFloat(input.dash60) : null,
      gpa_weighted: input.gpa ? parseFloat(input.gpa) : null,
      gpa_unweighted: input.gpa ? parseFloat(input.gpa) : null,
      sat_score: input.testType === 'SAT' && input.testScore ? parseInt(input.testScore) : null,
      act_score: input.testType === 'ACT' && input.testScore ? parseInt(input.testScore) : null,
      intended_major: input.majorInterest || null,
      division_pref: input.division || null,
      school_size_pref: input.campusSize || null,
    }, { onConflict: 'clerk_user_id' })
    .select('id')
    .single();

  if (athleteError) {
    console.error('[supabase] athletes insert FAILED');
    console.error('  message:', athleteError.message);
    console.error('  code:   ', athleteError.code);
    console.error('  details:', athleteError.details);
    console.error('  hint:   ', athleteError.hint);
    return;
  }

  console.log('[supabase] athlete saved, id:', athlete.id);

  const submittedAt = new Date().toISOString();
  const matchRows = matches.map((m, i) => ({
    athlete_id: athlete.id,
    school_name: m.school,
    fit_score: m.fitScore,
    reason: m.reason,
    rank: i + 1,
    athletic_fit: m.athletic_fit,
    submitted_at: submittedAt,
  }));

  const { error: matchError } = await db.from('school_matches').insert(matchRows);

  if (matchError) {
    console.error('[supabase] school_matches insert FAILED');
    console.error('  message:', matchError.message);
    console.error('  code:   ', matchError.code);
    console.error('  details:', matchError.details);
    console.error('  hint:   ', matchError.hint);
  } else {
    console.log('[supabase] saved', matchRows.length, 'school matches');
  }
}

export async function getSchoolMatches(input: MatchInput): Promise<SchoolMatch[]> {
  const apiKey = process.env.APP_AI_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('API key not found. Set APP_AI_KEY (or ANTHROPIC_API_KEY) in .env.local and restart the dev server.');
  }
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildPrompt(input) }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Claude returned an unexpected format. Please try again.');
  }

  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as SchoolMatch[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('No matches returned. Please try again.');
  }

  const matches = parsed.slice(0, 20);

  // Save to Supabase in the background — don't let DB errors block the response
  const { userId } = await auth();
  if (userId) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress ?? '';
    const name = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || null;
    saveToSupabase(userId, email, name, input, matches).catch(err =>
      console.error('[supabase] save failed:', err)
    );
  }

  return matches;
}
