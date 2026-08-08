import { type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (route handlers, including the Fireflies webhook)
     * - ingest (the PostHog reverse proxy — see next.config.ts)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * `ingest` has to be excluded or the auth check answers it first: analytics
     * requests carry no session, so every one of them was being answered with a
     * 307 to /auth/login and nothing ever reached PostHog.
     */
    '/((?!api|ingest|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
