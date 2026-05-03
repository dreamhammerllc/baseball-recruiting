import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ConnectPageClient from './ConnectPageClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ athlete?: string }>;
}

export default async function ConnectPage({ searchParams }: Props) {
  const params    = await searchParams;
  const athleteId = params.athlete;

  // Must be signed in — redirect back here after sign-in
  const user = await currentUser();
  if (!user) {
    redirect(`/sign-in?redirect_url=/connect?athlete=${athleteId ?? ''}`);
  }

  // Must have an athlete ID in the URL
  if (!athleteId) {
    return <ConnectPageClient status="invalid" athleteName="" />;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Must be a coach — athletes landing here get sent to their own dashboard
  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', user.id)
    .maybeSingle();

  if (!coach) {
    redirect('/dashboard/athlete');
  }

  // Look up athlete name for the confirmation message
  const { data: athlete } = await supabase
    .from('athletes')
    .select('full_name')
    .eq('clerk_user_id', athleteId)
    .maybeSingle();

  if (!athlete) {
    return <ConnectPageClient status="invalid" athleteName="" />;
  }

  const athleteName = athlete.full_name ?? 'This athlete';

  // Check if already connected
  const { data: existing } = await supabase
    .from('coach_athlete_connections')
    .select('id')
    .eq('coach_id', user.id)
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) {
    return <ConnectPageClient status="already_connected" athleteName={athleteName} />;
  }

  // Auto-connect immediately — no confirmation step needed
  const { error: connectError } = await supabase
    .from('coach_athlete_connections')
    .upsert(
      { coach_id: user.id, athlete_id: athleteId },
      { onConflict: 'coach_id,athlete_id' }
    );

  if (connectError) {
    console.error('[connect page] upsert error:', connectError.message);
    return <ConnectPageClient status="error" athleteName={athleteName} />;
  }

  return <ConnectPageClient status="connected" athleteName={athleteName} />;
}
