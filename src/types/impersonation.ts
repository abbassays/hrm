import type { Database } from '@/types/supabase';

export type ImpersonationSession = {
  adminId: string;
  adminName: string;
  targetId: string;
  targetName: string;
  targetRole: Database['public']['Enums']['user_role'];
  startedAt: string;
};
