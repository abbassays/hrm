import { Metadata } from 'next';

import { env } from '@/env';

export const appConfig = {
  title: 'Bitsmiths HRM',
  description: 'Human resource management, built by Bitsmiths.',
  keywords: 'hrm, human resources, employees, payroll, bitsmiths',
  logo: '/logo.svg',
  defaultLocale: 'en-PK',
  defaultCurrency: 'PKR',
  defaultCountryCode: 'PK',
  /** Live exchange rates, used to show a Payoneer source balance in its own
   *  currency. Keyless public endpoint; PKR is not an ECB reference currency,
   *  which rules out Frankfurter and similar ECB-backed APIs. */
  fx: {
    /** Base URL — the base currency is appended as a path segment. */
    ratesUrl: 'https://open.er-api.com/v6/latest',
    /** Upstream only refreshes once a day, so a shorter window would just
     *  re-fetch identical numbers. */
    staleTimeMs: 1000 * 60 * 60 * 6,
  },
  /** Global TanStack Query defaults (see `providers.tsx`). Writes invalidate
   *  their own keys explicitly, so these only govern passive refresh: reads stay
   *  fresh for `staleTimeMs` before a background refetch, and we don't refetch on
   *  window focus (it re-triggered every query, incl. an auth round-trip, on
   *  every tab switch). Hooks that need different behaviour override locally. */
  reactQuery: {
    staleTimeMs: 1000 * 60,
    gcTimeMs: 1000 * 60 * 5,
  },
  appUrl: env.NEXT_PUBLIC_APP_URL,
  appName: env.NEXT_PUBLIC_APP_NAME,
  emails: {
    support: 'support@bitsmiths.studio',
    // People-facing invites read better from a human-sounding, monitored
    // address than from `noreply@`. Replies are routed to `support` above.
    sender: 'Bitsmiths HR <hr@bitsmiths.studio>',
  },
} as const;

export default function getMetadata(): Metadata {
  return {
    metadataBase: new URL(appConfig.appUrl),
    title: { template: `%s | ${appConfig.title}`, default: appConfig.title },
    description: appConfig.description,
    robots: { index: true, follow: true },
    // icons: {
    //   icon: '/favicon/favicon.ico',
    //   shortcut: '/favicon/favicon-16x16.png',
    //   apple: '/favicon/apple-touch-icon.png',
    // },
    // manifest: `/favicon/site.webmanifest`,

    openGraph: {
      url: appConfig.appUrl,
      title: appConfig.title,
      description: appConfig.description,
      siteName: appConfig.title,
      images: [`/main/logo.png`],
      type: 'website',
      locale: appConfig.defaultLocale.replace('-', '_'),
    },

    twitter: {
      card: 'summary_large_image',
      title: appConfig.title,
      description: appConfig.description,
      images: [`/main/logo.png`],
    },
    keywords: [
      'next.js',
      'supabase',
      'react-query',
      'typescript',
      'boilerplate',
      'web development',
    ],
  };
}
