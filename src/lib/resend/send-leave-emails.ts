import 'server-only';

import { resend } from '@/lib/resend/client';

import { appConfig } from '@/config/app';
import { LeaveDecisionEmail } from '@/emails/leave-decision-email';
import { LeaveSubmittedEmail } from '@/emails/leave-submitted-email';

/**
 * Transactional emails for the leave request lifecycle. Each is a pure
 * "render + send" over the shared React Email templates — recipient lookup and
 * URL building stay in the calling server action. Every send throws on a
 * Resend error so callers
 * can swallow it: these are best-effort notifications and must never roll back
 * the DB write they follow.
 */

type SendLeaveSubmittedInput = {
  /** A single admin recipient (callers fan out over all admins). */
  to: string;
  adminName?: string | null;
  employeeName: string;
  summary: string;
  reason: string;
  reviewUrl: string;
};

/** → admin. An employee has submitted a leave request for review. */
export async function sendLeaveSubmittedEmail({
  to,
  adminName,
  employeeName,
  summary,
  reason,
  reviewUrl,
}: SendLeaveSubmittedInput) {
  const { error } = await resend.emails.send({
    from: appConfig.emails.sender,
    replyTo: appConfig.emails.support,
    to,
    subject: `New leave request — ${employeeName}`,
    react: LeaveSubmittedEmail({
      adminName,
      employeeName,
      summary,
      reason,
      reviewUrl,
      appName: appConfig.appName,
      baseUrl: appConfig.appUrl,
      supportEmail: appConfig.emails.support,
    }),
  });

  if (error) throw new Error(error.message);
}

type SendLeaveDecisionInput = {
  to: string;
  fullName?: string | null;
  decision: 'approved' | 'rejected';
  summary: string;
  rejectionReason?: string | null;
  leaveUrl: string;
};

/** → employee. Their request was approved or rejected (reason included). */
export async function sendLeaveDecisionEmail({
  to,
  fullName,
  decision,
  summary,
  rejectionReason,
  leaveUrl,
}: SendLeaveDecisionInput) {
  const { error } = await resend.emails.send({
    from: appConfig.emails.sender,
    replyTo: appConfig.emails.support,
    to,
    subject:
      decision === 'approved'
        ? 'Your leave request was approved'
        : 'Your leave request was rejected',
    react: LeaveDecisionEmail({
      fullName,
      decision,
      summary,
      rejectionReason,
      leaveUrl: leaveUrl,
      appName: appConfig.appName,
      baseUrl: appConfig.appUrl,
      supportEmail: appConfig.emails.support,
    }),
  });

  if (error) throw new Error(error.message);
}
