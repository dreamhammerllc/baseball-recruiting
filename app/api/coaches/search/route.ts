import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// Haversine distance in miles between two lat/lng points
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode a zip using OpenStreetMap Nominatim (free, no API key)
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

// GET /api/coaches/search
// Accepts EITHER:
//   ?lat=33.45&lng=-112.07&radius=25   ← GPS (no geocoding needed, instant)
//   ?zip=90210&radius=25               ← zip fallback (geocodes via Nominatim)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const radius = parseFloat(searchParams.get('radius') ?? '25');

  let coords: { lat: number; lng: number } | null = null;

  // GPS path — lat + lng provided directly, skip geocoding entirely
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  if (latParam && lngParam) {
    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);
    if (!isNaN(lat) && !isNaN(lng)) coords = { lat, lng };
  }

  // Zip fallback — geocode only if no GPS coords were provided
  if (!coords) {
    const zip = searchParams.get('zip')?.trim();
    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: 'Provide GPS coordinates or a valid 5-digit zip code.' }, { status: 400 });
    }
    coords = await geocodeZip(zip);
    if (!coords) {
      return NextResponse.json({ error: 'Could not locate that zip code. Please try again.' }, { status: 400 });
    }
  }

  const db = createAdminClient();

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

  const results = (coaches ?? [])
    .map(coach => ({
      ...coach,
      distance_miles: Math.round(
        haversine(coords!.lat, coords!.lng, Number(coach.latitude), Number(coach.longitude))
      ),
    }))
    .filter(c => c.distance_miles <= radius)
    .sort((a, b) => a.distance_miles - b.distance_miles);

  return NextResponse.json({ coaches: results, center: coords });
}
