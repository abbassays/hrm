import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_COOKIE_MAX_AGE_SECONDS,
} from '@/constants/impersonation';
import { env } from '@/env';

import type { ImpersonationSession } from '@/types/impersonation';

const payloadSchema = z.object({
  adminId: z.string().uuid(),
  targetId: z.string().uuid(),
  startedAt: z.string().datetime(),
});

type ImpersonationPayload = z.infer<typeof payloadSchema>;

// The service-role key never leaves the server, so it doubles as the HMAC key
// without adding another secret to the environment.
function sign(encoded: string) {
  return createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY)
    .update(encoded)
    .digest('base64url');
}

function encode(payload: ImpersonationPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function decode(value: string | undefined): ImpersonationPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const parsed = payloadSchema.safeParse(
      JSON.parse(Buffer.from(encoded, 'base64url').toString()),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function setImpersonationCookie(
  payload: Omit<ImpersonationPayload, 'startedAt'>,
) {
  const cookieStore = await cookies();
  cookieStore.set(
    IMPERSONATION_COOKIE,
    encode({ ...payload, startedAt: new Date().toISOString() }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: IMPERSONATION_COOKIE_MAX_AGE_SECONDS,
    },
  );
}

export async function clearImpersonationCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
}

export async function readImpersonationSession(): Promise<ImpersonationSession | null> {
  const cookieStore = await cookies();
  const payload = decode(cookieStore.get(IMPERSONATION_COOKIE)?.value);
  if (!payload) return null;

  const { data } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, email, role')
    .in('id', [payload.adminId, payload.targetId]);
  const admin = data?.find((row) => row.id === payload.adminId);
  const target = data?.find((row) => row.id === payload.targetId);
  if (!admin || !target) return null;

  return {
    adminId: admin.id,
    adminName: admin.full_name || admin.email,
    targetId: target.id,
    targetName: target.full_name || target.email,
    targetRole: target.role,
    startedAt: payload.startedAt,
  };
}

// A cookie left behind by a normal re-login must never count as impersonation.
export async function getActiveImpersonation(currentUserId: string) {
  const session = await readImpersonationSession();
  return session?.targetId === currentUserId ? session : null;
}

// For layouts: resolves the signed-in user itself. Cheap when no cookie is set.
export async function getCurrentImpersonation() {
  const session = await readImpersonationSession();
  if (!session) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id === session.targetId ? session : null;
}
