import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function DashboardRouter() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const db = createAdminClient();
  const { data } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  redirect(data ? '/dashboard/coach' : '/dashboard/athlete');
}
