import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { suggestUsername } from '@/lib/username-validation';
import { isUsernameTaken } from './actions';
import UsernameForm from './UsernameForm';

export default async function UsernameOnboardingPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  // Athlete-only. Role is set in publicMetadata by promoteRole, or in
  // unsafeMetadata at sign-up (older/test accounts). Non-athletes get sent
  // back to /onboarding which resolves their correct destination.
  const role =
    (user.publicMetadata?.role as string | undefined) ??
    (user.unsafeMetadata?.role as string | undefined);
  if (role !== 'athlete') redirect('/onboarding');

  const db = createAdminClient();
  const { data: athlete } = await db
    .from('athletes')
    .select('username, first_name, last_name')
    .eq('clerk_user_id', user.id)
    .maybeSingle();

  // Already has a username — nothing to do here.
  if (athlete?.username != null) redirect('/dashboard/athlete');

  const firstName = athlete?.first_name ?? user.firstName ?? '';
  const lastName = athlete?.last_name ?? user.lastName ?? '';

  const suggested = await suggestUsername(firstName, lastName, isUsernameTaken);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#030712',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#111827',
          borderRadius: '1rem',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '-0.025em',
            }}
          >
            Choose your username
          </h1>
          <p
            style={{
              color: '#9ca3af',
              fontSize: '0.875rem',
              margin: '0.5rem 0 0',
            }}
          >
            One last step before your dashboard.
          </p>
        </div>

        <UsernameForm suggested={suggested} />
      </div>
    </main>
  );
}
