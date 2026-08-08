'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

import { env } from '@/env';

/**
 * PostHog, proxied through this origin at `/ingest` (see next.config.ts) so
 * adblockers cannot erase most of the traffic. EU region, sharing a project with
 * bitsmiths-main.
 *
 * SESSION RECORDING AND HR DATA
 *
 * This app puts salaries, CNIC numbers, IBANs, medical claim descriptions,
 * addresses and dates of birth on screen. A session replay is a recording of
 * whatever the admin was looking at, so recording it naively ships all of that
 * to a third party.
 *
 * Two layers guard against that:
 *
 *   - `maskAllInputs` blanks every form field's value, so anything being typed
 *     or edited is never captured.
 *   - `maskTextSelector` blanks the RENDERED text of anything tagged
 *     `data-ph-mask`. Input masking alone would not help here: a payroll table
 *     full of salaries is read-only text, not inputs.
 *
 * Tag any surface that renders personal or financial data with `data-ph-mask`.
 * Replays still show layout, navigation and interaction — which is what makes
 * them useful for debugging — with the values themselves blanked out.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Never record local development. Beyond the noise, dev runs against the
    // production database, so a replay here is a replay of real employee data.
    const isDevelopment =
      process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost';
    if (!env.NEXT_PUBLIC_POSTHOG_KEY || isDevelopment) return;

    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      // Flag evaluation rides the same host on posthog-js 1.242, so it is
      // proxied too and an adblocker cannot silently turn every flag off.
      // (`flags_api_host` only exists from a later release — bitsmiths-main is
      // on 1.298 and sets it explicitly; here it would not typecheck.)
      api_host: '/ingest',
      ui_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      // Pageviews are captured manually by `page-view.ts` so client-side route
      // changes register; automatic capture would only fire on hard loads.
      capture_pageview: false,
      capture_pageleave: true,
      capture_performance: true,
      // Everyone here is a signed-in employee, so a person profile always
      // resolves to a real identity rather than an anonymous visitor.
      person_profiles: 'identified_only',
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask], [data-ph-mask] *',
      },
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
