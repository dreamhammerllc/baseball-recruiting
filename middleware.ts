import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url));

  return NextResponse.next();
});

export const config = {
  // Exclude /api/* routes — they handle their own auth via auth() and must
  // receive the raw request body (Edge runtime buffers + drops large bodies).
  matcher: ['/((?!_next|api/|.*\\..*).*)'],
};
