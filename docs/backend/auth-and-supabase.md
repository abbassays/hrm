## Supabase clients and auth patterns

This project uses Supabase on both the browser and server with session persistence handled by middleware. Row Level Security (RLS) is enabled by default; only use the service role key to bypass complex RLS cases, and never in the browser.

### Middleware and route protection

`src/lib/supabase/middleware.ts` refreshes the session on each navigation. Document wiring it in `src/middleware.ts` with `updateSession(request)`.

Guidelines:

- Avoid calling `supabase.from(table)` in middleware; it adds a DB call on every route change and slows the app.
- Prefer using `user_metadata` to store lightweight flags you need in middleware (e.g., role) rather than fetching from DB.
- Middleware can be used for lightweight route protection checks (e.g., deny access if no session) without redirects per app policy.

### Auth patterns

- Queries: use `authQuery()` to ensure the user is authenticated (and optionally has the right role) before executing the query handler. This keeps UI hooks clean.

```ts
// src/hooks/queries/sample.ts
import { useQuery } from '@tanstack/react-query';
import { QueryKeys } from '@/constants/query-keys';
import { authQuery } from '@/lib/client/auth-query';

export const useSample = () =>
  useQuery({
    queryKey: [QueryKeys.SAMPLE],
    queryFn: authQuery(async ({ supabase }) => {
      const { data, error } = await supabase.from('sample').select('*');
      if (error) throw new Error(error.message);
      return data;
    }),
  });
```

- Server actions: use `authActionClient` when an action must only run for logged‑in users.

```ts
// src/lib/server/safe-action.ts (concept)
export const safeActionClient = createSafeActionClient({
  defaultValidationErrorsShape: 'flattened',
  handleServerError: (error) => error.message,
});

export const authActionClient = safeActionClient.use(async ({ next }) => {
  const supabase = await createSupabaseServerClient();
  const { data: authUser, error } = await supabase.auth.getUser();
  if (error || !authUser) throw new Error('Unauthorized');
  return next({ ctx: { supabase, authUser } });
});
```

Use `authActionClient` for authenticated operations; for public server actions use `safeActionClient` directly.

### Admin impersonation ("View as employee")

Nearly all reads happen in the browser under RLS, so impersonation is a real
session swap rather than an app-level flag. `src/actions/impersonation.ts`:

- `startImpersonation`: admin-only. Any account except a disabled one (disabling
  bans the auth user, so no session can be minted). Mints a one-time
  `magiclink` with the service role, consumes it with `verifyOtp` on the
  cookie-backed server client so the browser now holds the target's session,
  revokes the admin's old session (`auth.admin.signOut(token, 'local')`) and
  sets the httpOnly `hrm_impersonation` cookie.
- The cookie carries `{ adminId, targetId, startedAt }` as base64url JSON plus
  an HMAC-SHA256 signature keyed by the service-role key
  (`src/lib/server/impersonation.ts`). No table is involved; a tampered cookie
  fails the signature check and is treated as absent.
- `stopImpersonation`: valid only while the signed-in user is the cookie's
  `targetId`. Re-checks the admin is still an active admin, swaps back the
  same way, revokes the borrowed session and clears the cookie.
- `signOut` while impersonating signs out with `scope: 'local'`, so only the
  borrowed session is revoked, never the person's own devices.
- Middleware needs no special case: the browser holds a real session for the
  target, so the role/status funnel routes exactly as it would for that person
  (employee app, onboarding gate, or admin app when the target is an admin).
- The employee, admin and onboarding layouts call `getCurrentImpersonation()`
  once per request. It returns a session only when the cookie's target matches
  the signed-in user (a stale cookie after a normal re-login is inert) and feeds the
  `ImpersonationBanner` above the header and the sidebar footer, which swaps
  Sign out for Stop impersonating.
- The client does a full page load after either switch so React Query, the
  browser Supabase client and PostHog restart with the new identity.

### RLS and service role

- Keep RLS enabled by default.
- Only use the service role key on the server to bypass complex RLS cases where absolutely necessary.
- Never expose the service role key to the client.

## Auth baseline (BIT-7)

### What's implemented

Email/password only, matching the invite-only model (no public sign-up). Google
OAuth is **deferred** — see below.

- Actions in `src/actions/auth.ts`, Zod schemas in `src/schema/auth.ts`:
  `signInWithPassword`, `requestPasswordReset`, `updatePassword`, `signOut`.
- Password reset is delivered through **Resend**, mirroring the invite flow (not
  Supabase's own mailer). `requestPasswordReset` mints a one-time recovery link with
  the service-role admin API (`generateLink({ type: 'recovery' })`) and sends the
  branded `@/emails/reset-password-email` template pointing at
  `/auth/reset-password?token_hash=…&type=recovery`. The reset page
  (`src/app/auth/reset-password/page.tsx`) gates like accept-invitation: with a
  session it shows the form; with only the token it renders `RecoveryTokenVerifier`,
  which exchanges the `token_hash` via `verifyOtp` (browser client) to establish the
  recovery session, strips the token from the URL, and re-renders into the form.
  `requestPasswordReset` first looks the address up in `employees` and returns a
  discriminated `{ status: 'not_found' | 'sent' }` the form renders as two distinct
  cards. This intentionally reveals whether an email is registered (an
  account-enumeration surface) — a deliberate product choice for clearer UX over the
  anti-enumeration "if an account exists" phrasing.
- The session guard lives in `src/lib/supabase/middleware.ts`: no session on a
  protected route → `/auth/login`. Public routes: `/` and everything under `/auth`.

### Google OAuth — deferred

Left out for now (invite-only app; may be added later). The wiring point is
`src/app/auth/callback/route.ts`: on an OAuth sign-in, exchange the code, then run an
**invite gate** — look up `employees` by email with the service-role client
(`src/lib/supabase/admin.ts`, needed because a freshly linked Google `auth.uid()`
won't match the invited row under RLS) and, if no row exists, `signOut()` + bounce to
`/auth/login?error=not_invited`. That gate is the whole point of OAuth in an
invite-only app. Enabling it also needs the Google provider configured in the
Supabase dashboard (Authentication → Providers → Google) and
`${NEXT_PUBLIC_APP_URL}/auth/callback` added under Authentication → URL Configuration.

### `accept_onboarding()` and the column guard

Migration `20260706134229` adds `accept_onboarding()` — the invited → onboarding
self-transition an accepting user needs. `guard_employee_columns()` (BIT-3) blocks
every non-admin from changing `account_status`, and a `SECURITY DEFINER` function
still trips it because `is_admin()` reads the caller's JWT. So the RPC sets a
**transaction-local GUC** (`app.bypass_employee_guard`) that the guard honours; plain
PostgREST updates can't set it, so the guard stays fully closed to direct client
writes. The RPC only ever advances the caller's own `invited` row (matched on the JWT
email). It currently has **no app caller** — it's the transition mechanism for
invite-acceptance (M1.3) and the deferred OAuth gate above.

### Invite acceptance — the identity trust chain

Accepting an invite must bind the new password to **the invited person**, and to
nobody else. The rule is: **identity is session-bound, never URL-derived.** The
email address is never read from the link; the link only carries an opaque,
one-time token that must survive an exchange.

**The chain, link by link:**

1. **Mint (server, service role).** `inviteEmployee` (`src/actions/employees.ts`)
   calls `admin.generateLink({ type: 'invite' })` and builds
   `/auth/accept-invitation?token_hash=<hashed_token>&type=invite`. A re-invite
   uses `admin.generateLink({ type: 'magiclink' })` and `type=magiclink`. The URL
   carries **no email** — only the hashed token and its type.
2. **Land (server component).** `src/app/auth/accept-invitation/page.tsx` calls
   `getUser()`. `getUser()` is the authority:
   - **Session already exists →** it wins outright and the token in the URL is
     ignored. A session can only ever be _bootstrapped_ by a token, never
     _overridden_ by one. So a signed-in admin (or any other user) who clicks an
     invite is routed to their own app, never onto the form as the invitee.
   - **No session (private tab / different browser / fresh device) →** the token
     is the only proof available, so the page hands off to
     `<InviteTokenVerifier>`.
3. **Exchange (client). Private-tab re-verification.**
   `src/components/auth/invite-token-verifier.tsx` runs `verifyOtp({ token_hash,
type })` on the **browser** client (a server component can't write the auth
   cookies). On success the session cookies are set; it then `router.replace`s to
   a clean `/auth/accept-invitation` — dropping the token from the address bar and
   history — and the page re-renders **with a session**, re-entering step 2 down
   the "session exists" branch. A one-time guard (`startedRef`) stops React strict
   mode from spending the token twice.
4. **Authorize (server, RLS).** With a session, the page reads the `employees` row
   keyed by `user.id` (not by any URL value). That row is the source of truth for
   both **who they are** (`email`, shown read-only) and **what they may do**: only
   an `invited` caller sees the password form; `onboarding` → onboarding wizard,
   anything else → dashboard.
5. **Commit (server action, caller-scoped).** `acceptInvite`
   (`src/actions/onboarding.ts`) runs as the caller: `updateUser({ password })`
   then the `accept_onboarding()` RPC, which advances **only the caller's own**
   `invited` row to `onboarding` (matched on the JWT email, guard bypassed via a
   transaction-local GUC — see above).

**Expired / reused / tampered tokens.** A spent or expired `token_hash` fails
`verifyOtp`; a malformed `type` never matches the allowlist. Either way
`<InviteTokenVerifier>` shows an explicit "this invitation link is no longer
valid — ask your admin for a fresh invite" state instead of a silent bounce. The
one exception: if a valid session somehow already exists on a failed exchange
(e.g. the invitee reopened the old link after accepting), it routes them into the
app by their `employees` row rather than showing the error. The `employees`-row
gate in step 4 is the backstop — a reused link can never re-open the password
form for an already-`onboarding`/`active` account.

**Recovery token exchange.** Password recovery uses the same `token_hash` +
`verifyOtp` mechanism as the invite flow (see above), delivered via Resend — it does
**not** go through `/auth/callback`. `RecoveryTokenVerifier` exchanges the one-time
`token_hash` on the browser client to establish the recovery session, then strips the
token from the URL; expired/reused/malformed tokens surface an explicit "link no
longer valid" state pointing back to "Forgot password?".

**PKCE code exchange (`/auth/callback`).** `src/app/auth/callback/route.ts` exchanges
a **PKCE `code`** (not a `token_hash`) via `exchangeCodeForSession` and is now reserved
for the deferred Google OAuth flow. It fails closed: a missing code, or a code that
won't exchange (expired/reused), redirects to `/auth/login`. The `next` redirect target
is restricted to internal relative paths to prevent an open redirect.

**Why not honor the token over an existing session?** Deliberately: trusting the
URL token over a live session would let a link decide identity, which is exactly
what "session-bound, not URL-derived" forbids. To accept an invite while another
account is signed in, sign out first or open the link in a private tab — the
re-verification path (step 3) then runs cleanly.

### First-admin bootstrap (chicken-and-egg)

`inviteEmployee` (M1.3) needs an admin to exist, but no admin exists to invite the
first one. Seed the first admin by hand, **once**, in the Supabase SQL editor after
the operator exists in `auth.users` (add them via Dashboard → Authentication → Add
user):

```sql
insert into employees (id, email, role, account_status, activated_at)
select id, email, 'admin', 'active', now()
from auth.users
where email = 'admin@bitsmiths.studio'      -- the bootstrap admin's email
on conflict (id) do update
  set role = 'admin', account_status = 'active';
```

The `mirror_role_to_jwt` trigger (BIT-3) copies `role` into `app_metadata` on the
next token refresh — the admin must sign out and back in once so their JWT carries
`app_metadata.role = 'admin'` and `public.is_admin()` returns true.
