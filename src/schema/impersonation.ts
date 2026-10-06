import { z } from 'zod';

export const stopImpersonationSchema = z.object({});
export type StopImpersonationInput = z.infer<typeof stopImpersonationSchema>;
