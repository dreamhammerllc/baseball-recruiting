import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';

// Username gate for the entire athlete dashboard. An athlete cannot use the
// dashboard until they have claimed a username (athletes.username IS NOT NULL).
// A missing athletes row counts as "no username" — rows are created lazily, so
// brand-new athletes have none yet; setUsername upserts it.
export default async function AthleteDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const db = createAdminClient();
  const { data: athlete } = await db
    .from('athletes')
    .select('username')
    .eq('clerk_user_id', user.id)
    .maybeSingle();

  if (!athlete || athlete.username == null) {
    redirect('/onboarding/username');
  }

  return <>{children}</>;
}
