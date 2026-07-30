import { escapeHtml } from '@/lib/escape-html';

/** Fallbacks used when the template row is missing or empty, so an invite never
 *  fails for lack of a template. Kept in sync with the seed row in
 *  `20260726120000_m3_onboarding_email_template.sql`. */
const DEFAULT_SUBJECT = 'You’re invited to join Bitsmiths HRM';
const DEFAULT_BODY =
  '<p>Hi {{employee_name}},</p>' +
  '<p>You’ve been invited to join Bitsmiths HRM. Click the link below to ' +
  'set up your account and complete onboarding.</p>' +
  '<p><a href="{{onboarding_link}}">Accept your invitation</a></p>';

const INVITE_BUTTON_STYLE =
  'display:inline-block;background-color:#04CD77;color:#ffffff;' +
  'font-size:15px;font-weight:600;line-height:20px;text-decoration:none;' +
  'border-radius:8px;padding:13px 28px;';

/** Turn the required invitation link into the primary CTA. This runs after the
 * admin-authored body was sanitized, so only the trusted wrapper/style is
 * introduced here; the link text remains the admin's sanitized HTML. */
function styleOnboardingLink(bodyHtml: string) {
  return bodyHtml.replace(
    /<p>\s*<a\b([^>]*\bhref=["']\{\{onboarding_link\}\}["'][^>]*)>([\s\S]*?)<\/a>\s*<\/p>/gi,
    (_match, attributes: string, label: string) =>
      `<p style="margin:28px 0 8px;text-align:center;"><a ${attributes} style="${INVITE_BUTTON_STYLE}">${label}</a></p>`,
  );
}

type OnboardingTemplateRow = {
  subject: string | null;
  body_html: string | null;
} | null;

type OnboardingEmailVars = {
  onboardingLink: string;
  employeeName: string;
};

/**
 * Pure, unit-testable render of the onboarding email from the saved template.
 * Reused by the M1.3 invite flow (`sendOnboardingInvite`).
 *
 * Two-layer XSS defense: the template HTML was already allow-list sanitized at
 * save time (`updateOnboardingEmailTemplate`), and here the token VALUES are
 * HTML-escaped before they land in the body — so an invitee-controlled name
 * can't inject markup and the link's query-string `&` becomes a valid `&amp;`
 * inside the href. The subject is plaintext (an email header, not HTML), so its
 * tokens are substituted raw — escaping would surface literal `&amp;` in the
 * inbox.
 *
 * `{{onboarding_link}}` is replaced before `{{employee_name}}` so a name that
 * happens to contain the link token is never re-expanded.
 */
export function renderOnboardingEmail(
  template: OnboardingTemplateRow,
  vars: OnboardingEmailVars,
) {
  const rawSubject = template?.subject?.trim() || DEFAULT_SUBJECT;
  const rawBody = template?.body_html?.trim() || DEFAULT_BODY;

  const subject = rawSubject
    .replaceAll('{{onboarding_link}}', vars.onboardingLink)
    .replaceAll('{{employee_name}}', vars.employeeName);

  const html = styleOnboardingLink(rawBody)
    .replaceAll('{{onboarding_link}}', escapeHtml(vars.onboardingLink))
    .replaceAll('{{employee_name}}', escapeHtml(vars.employeeName));

  return { subject, html };
}
