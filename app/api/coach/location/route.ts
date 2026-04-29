import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
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
  } catch { return null; }
}

// Reverse geocode lat/lng to a human-readable city/state label
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'DiamondVerified/1.0' } });
    if (!res.ok) return null;
    const data = await res.json() as {
      address?: { city?: string; town?: string; village?: string; state?: string; postcode?: string };
    };
    const addr = data.address ?? {};
    const city = addr.city ?? addr.town ?? addr.village ?? null;
    const state = addr.state ?? null;
    const zip = addr.postcode ?? null;
    if (city && state) return `${city}, ${state}`;
    if (zip && state) return `${zip}, ${state}`;
    return null;
  } catch { return null; }
}

// Geocode a US zip to lat/lng
async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&country=US&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'DiamondVerified/1.0' } });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

// PATCH /api/coach/location
// Body option A (GPS):  { lat: number, lng: number }
// Body option B (zip):  { zip: string }
export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();
  const body = await req.json() as { lat?: number; lng?: number; zip?: string };

  let latitude: number | null = null;
  let longitude: number | null = null;
  let zip_code: string | null = null;
  let location_label: string | null = null;

  if (body.lat != null && body.lng != null) {
    // GPS path — use coordinates directly
    latitude  = body.lat;
    longitude = body.lng;
    location_label = await reverseGeocode(latitude, longitude);
  } else if (body.zip) {
    // Zip path — geocode
    if (!/^\d{5}$/.test(body.zip)) {
      return NextResponse.json({ error: 'Invalid zip code.' }, { status: 400 });
    }
    zip_code = body.zip;
    const coords = await geocodeZip(body.zip);
    if (!coords) return NextResponse.json({ error: 'Could not locate that zip code.' }, { status: 400 });
    latitude  = coords.lat;
    longitude = coords.lng;
    location_label = null; // will show zip instead
  } else {
    return NextResponse.json({ error: 'Provide lat/lng or zip.' }, { status: 400 });
  }

  const { error } = await db
    .from('coaches')
    .update({
      latitude,
      longitude,
      ...(zip_code ? { zip_code } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', userId);

  if (error) {
    console.error('[coach/location] update error:', error.message);
    return NextResponse.json({ error: 'Failed to save location.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, latitude, longitude, location_label, zip_code });
}

// GET /api/coach/location — fetch current saved location
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();
  const { data: coach } = await db
    .from('coaches')
    .select('latitude, longitude, zip_code')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });

  let location_label: string | null = null;
  if (coach.latitude && coach.longitude && !coach.zip_code) {
    location_label = await reverseGeocode(Number(coach.latitude), Number(coach.longitude));
  }

  return NextResponse.json({
    latitude:       coach.latitude,
    longitude:      coach.longitude,
    zip_code:       coach.zip_code,
    location_label,
    has_location:   !!(coach.latitude && coach.longitude),
  });
}
