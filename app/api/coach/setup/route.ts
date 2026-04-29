/**
 * Run once in Supabase SQL editor (if not already created):
 *
 *   CREATE TABLE IF NOT EXISTS coaches (
 *     id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     clerk_user_id     text        NOT NULL UNIQUE,
 *     full_name         text        NOT NULL,
 *     email             text        NOT NULL,
 *     organization      text        NOT NULL,
 *     title             text        NOT NULL,
 *     sport_focus       text,
 *     years_experience  int,
 *     certifications    text,
 *     bio               text,
 *     photo_url         text,
 *     updated_at        timestamptz DEFAULT now(),
 *     created_at        timestamptz DEFAULT now()
 *   );
 *
 *   -- If the table already exists, add the column:
 *   ALTER TABLE coaches ADD COLUMN IF NOT EXISTS photo_url text;
 *
 *   CREATE TABLE IF NOT EXISTS coach_verifications (
 *     id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     coach_id         uuid        NOT NULL REFERENCES coaches(id),
 *     athlete_clerk_id text        NOT NULL,
 *     metric_key       text        NOT NULL,
 *     value            numeric     NOT NULL,
 *     video_url        text,
 *     recorded_at      timestamptz,
 *     ai_reviewed_at   timestamptz,
 *     approved_at      timestamptz,
 *     status           text        NOT NULL DEFAULT 'pending',
 *     created_at       timestamptz DEFAULT now()
 *   );
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';

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
    console.error('[coach/setup] authenticateRequest error:', err);
    return null;
  }
}

export interface CoachProfile {
  id: string;
  clerk_user_id: string;
  full_name: string;
  email: string;
  organization: string;
  title: string;
  sport_focus: string | null;
  years_experience: number | null;
  certifications: string | null;
  bio: string | null;
  photo_url: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  age_groups: string | null;
  coaching_style: string | null;
  achievements: string | null;
  updated_at: string;
  created_at: string;
}

// ─── GET /api/coach/setup ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('coaches')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[GET /api/coach/setup] error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch coach profile.' }, { status: 500 });
  }

  return NextResponse.json({ coach: data as CoachProfile | null });
}

// ─── POST /api/coach/setup ────────────────────────────────────────────────────

interface SetupBody {
  full_name: string;
  email: string;
  organization: string;
  title: string;
  sport_focus?: string | null;
  years_experience?: number | null;
  certifications?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  age_groups?: string | null;
  coaching_style?: string | null;
  achievements?: string | null;
}

// Geocode a US zip code using OpenStreetMap Nominatim (free, no API key)
async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=US&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'DiamondVerified/1.0' } });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: SetupBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { full_name, email, organization, title, sport_focus, years_experience, certifications, bio, photo_url, zip_code, phone, website, instagram, twitter, age_groups, coaching_style, achievements } = body;

  // Geocode zip code if provided
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (zip_code && /^\d{5}$/.test(zip_code)) {
    const coords = await geocodeZip(zip_code);
    if (coords) { latitude = coords.lat; longitude = coords.lng; }
  }

  if (!full_name?.trim()) return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  if (!email?.trim())     return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  if (!organization?.trim()) return NextResponse.json({ error: 'Organization is required.' }, { status: 400 });
  if (!title?.trim())    return NextResponse.json({ error: 'Title is required.' }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('coaches')
    .upsert(
      {
        clerk_user_id:    userId,
        full_name:        full_name.trim(),
        email:            email.trim(),
        organization:     organization.trim(),
        title:            title.trim(),
        sport_focus:      sport_focus?.trim()   || null,
        years_experience: years_experience      ?? null,
        certifications:   certifications?.trim() || null,
        bio:              bio?.trim()            || null,
        photo_url:        photo_url             ?? null,
        zip_code:         zip_code?.trim()      || null,
        latitude:         latitude,
        longitude:        longitude,
        phone:            phone?.trim()          || null,
        website:          website?.trim()        || null,
        instagram:        instagram?.trim()      || null,
        twitter:          twitter?.trim()        || null,
        age_groups:       age_groups?.trim()     || null,
        coaching_style:   coaching_style?.trim() || null,
        achievements:     achievements?.trim()   || null,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'clerk_user_id' },
    )
    .select()
    .single();

  if (error || !data) {
    console.error('[POST /api/coach/setup] upsert error:', error?.message);
    return NextResponse.json({ error: 'Failed to save coach profile.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, coach: data as CoachProfile });
}
