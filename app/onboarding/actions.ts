'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';

export async function promoteRole(role: string): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role },
  });

  if (role === 'athlete') return '/dashboard/athlete';
  if (role === 'hs_coach') return '/dashboard/coach';
  return '/dashboard/college';
}
