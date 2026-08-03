import { createSafeActionClient } from 'next-safe-action';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const safeActionClient = createSafeActionClient({
  defaultValidationErrorsShape: 'flattened',
  handleServerError: (error) => error.message,
});

export const authActionClient = safeActionClient.use(async ({ next }) => {
  const supabase = await createSupabaseServerClient();
  const { data: authUser, error } = await supabase.auth.getUser();
  const user = authUser?.user;
  if (error || !user) throw new Error('Unauthorized');
  if (user.app_metadata?.role !== 'admin') {
    // Auth bans block future sessions. This server-side check also closes the
    // short access-token window for a person who was already signed in.
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('account_status')
      .eq('id', user.id)
      .maybeSingle();
    if (employeeError || !employee || employee.account_status === 'disabled') {
      throw new Error('This employee account is disabled.');
    }
  }
  return next({ ctx: { supabase, authUser } });
});
