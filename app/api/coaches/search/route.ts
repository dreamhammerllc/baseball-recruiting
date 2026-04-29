import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// Haversine distance in miles between two lat/lng points
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode a zip using OpenStreetMap Nominatim
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

// GET /api/coaches/search?zip=90210&radius=25
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zip    = searchParams.get('zip')?.trim();
  const radius = parseFloat(searchParams.get('radius') ?? '25');

  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Valid 5-digit zip code required.' }, { status: 400 });
  }

  // Geocode the athlete's zip
  const coords = await geocodeZip(zip);
  if (!coords) {
    return NextResponse.json({ error: 'Could not locate that zip code. Please try again.' }, { status: 400 });
  }

  const db = createAdminClient();

  // Fetch all coaches who are accepting bookings and have coordinates
  const { data: coaches, error } = await db
    .from('coaches')
    .select('id, clerk_user_id, full_name, email, title, organization, bio, photo_url, latitude, longitude, advance_notice_hours, session_duration_minutes, is_accepting_bookings')
    .eq('is_accepting_bookings', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) {
    console.error('[coaches/search] error:', error.message);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }

  // Filter by radius and attach distance
  const results = (coaches ?? [])
    .map(coach => ({
      ...coach,
      distance_miles: Math.round(
        haversine(coords.lat, coords.lng, Number(coach.latitude), Number(coach.longitude))
      ),
    }))
    .filter(c => c.distance_miles <= radius)
    .sort((a, b) => a.distance_miles - b.distance_miles);

  return NextResponse.json({ coaches: results, center: coords });
}
