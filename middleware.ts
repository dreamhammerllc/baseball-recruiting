import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // API routes handle their own auth — run middleware so auth() works in
  // handlers, but never redirect. Same for public page routes.
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
  if (isPublicRoute(req)) return NextResponse.next();

  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url));

  return NextResponse.next();
});

export const config = {
  // Include API routes so Clerk resolves session context for route handlers.
  // Exclude only Next.js internals and static files.
  matcher: ['/((?!_next|.*\\..*).*)'],
};
