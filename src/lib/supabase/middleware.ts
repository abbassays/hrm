import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

import { paths } from '@/constants/paths';
import { env } from '@/env';

import type { AccountStatus } from '@/types/hrm';
import type { Database } from '@/types/supabase';

/** Reachable without a session: every auth screen (login, forgot/reset
 * password, accept invitation, OAuth callback). The root route is handled by
 * the explicit middleware redirect below, so no landing page exists. */
function isPublicRoute(pathname: string) {
  return pathname.startsWith('/auth');
}

/** Employee-app routes live in the (employee) route group, which adds no URL
 *  prefix, so they're enumerated from the paths config. */
const employeeRoutes = Object.values(paths.employee);

function isEmployeeRoute(pathname: string) {
  return employeeRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/** Every admin-app route is namespaced under /admin. */
function isAdminRoute(pathname: string) {
  return pathname === paths.admin.dashboard || pathname.startsWith('/admin/');
}

/** The single page a not-yet-active employee is confined to, by status —
 *  onboarding until they submit, then the pending-review holding page. Active
 *  (and any unrecognised status) returns null: the full employee app is open. */
function employeeGateFor(status: AccountStatus | undefined): string | null {
  if (status === 'invited' || status === 'onboarding') {
    return paths.employee.onboarding;
  }
  if (status === 'submitted') return paths.employee.pending;
  return null;
}

/** Redirect that carries over any auth cookies refreshed on this request. */
function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const response = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() both refreshes the token and tells us whether there is
  // a session. Do not run other logic between createServerClient and here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // There is no public landing page. Route unauthenticated root visits to the
  // sign-in page here, before Next tries to resolve a `/` page module.
  if (!user && pathname === paths.home) {
    return redirectWithCookies(request, supabaseResponse, paths.auth.login);
  }

  // Session guard: no session on a protected route → send to login.
  if (!user && !isPublicRoute(pathname)) {
    return redirectWithCookies(request, supabaseResponse, paths.auth.login);
  }

  // Funnel: route each user by role + account_status. Both come from the JWT
  // app_metadata (mirrored from employees by mirror_role_to_jwt), so the funnel
  // needs no DB read. Anything not explicitly 'admin' is treated as an employee,
  // so admin access fails closed.
  if (user) {
    const isAdmin = user.app_metadata?.role === 'admin';
    const status = user.app_metadata?.account_status as
      | AccountStatus
      | undefined;
    // Admins are never gated by status; only employees funnel through
    // onboarding/pending before the full app opens.
    const gate = isAdmin ? null : employeeGateFor(status);
    const roleHome = isAdmin
      ? paths.admin.dashboard
      : (gate ?? paths.employee.dashboard);

    // Signed-in users skip the root sign-in redirect and go straight to where
    // they belong right now (an admin's dashboard, or an employee's gate/app).
    if (pathname === paths.home) {
      return redirectWithCookies(request, supabaseResponse, roleHome);
    }

    // Status funnel: a not-yet-active employee is confined to their gate page.
    // Skipped on public routes so the /auth invite-acceptance flow (which runs
    // with a session already established) is never interrupted.
    if (gate && !isPublicRoute(pathname) && pathname !== gate) {
      return redirectWithCookies(request, supabaseResponse, gate);
    }

    // Role funnel: each role stays inside its own app.
    if (!isAdmin && isAdminRoute(pathname)) {
      return redirectWithCookies(request, supabaseResponse, roleHome);
    }
    if (isAdmin && isEmployeeRoute(pathname)) {
      return redirectWithCookies(
        request,
        supabaseResponse,
        paths.admin.dashboard,
      );
    }
  }

  return supabaseResponse;
}
