import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ConnectPageClient from './ConnectPageClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ athlete?: string }>;
}

export default async function ConnectPage({ searchParams }: Props) {
  const params = await searchParams;
  const athleteId = params.athlete;

  // Must be signed in
  const user = await currentUser();
  if (!user) {
    redirect(`/sign-in?redirect_url=/connect?athlete=${athleteId ?? ''}`);
  }

  // Must have an athlete ID in the URL
  if (!athleteId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#ef4444', fontSize: '1rem' }}>Invalid connection link. Please ask the athlete to share their link again.</p>
        </div>
      </div>
    );
  }

  // Coaches only — check subscription_tier
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, full_name, subscription_tier')
    .eq('clerk_user_id', user.id)
    .single();

  if (!coach) {
    // Not a coach — redirect athletes back to their dashboard
    redirect('/dashboard/athlete');
  }

  // Fetch the athlete's profile so we can show their name on the confirm screen
  const { data: athlete } = await supabase
    .from('athletes')
    .select('full_name, photo_url, position, grad_year')
    .eq('clerk_user_id', athleteId)
    .single();

  if (!athlete) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#ef4444', fontSize: '1rem' }}>Athlete not found. The link may be invalid or the athlete may have deleted their account.</p>
        </div>
      </div>
    );
  }

  // Check if already connected
  const { data: existing } = await supabase
    .from('coach_athlete_connections')
    .select('id')
    .eq('coach_id', user.id)
    .eq('athlete_id', athleteId)
    .single();

  return (
    <ConnectPageClient
      coachId={user.id}
      athleteId={athleteId}
      athleteName={athlete.full_name ?? 'Unknown Athlete'}
      athletePhoto={athlete.photo_url ?? null}
      athletePosition={athlete.position ?? null}
      athleteGradYear={athlete.grad_year ?? null}
      alreadyConnected={!!existing}
    />
  );
}
