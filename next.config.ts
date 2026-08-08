import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Rendering the payslip PDF server-side (invoice emails) needs the package's
  // Node build, which is what exposes `renderToBuffer`. Leaving it external
  // keeps the bundler from resolving it through its `browser` export condition.
  serverExternalPackages: ['@react-pdf/renderer'],

  // Required by PostHog's reverse-proxy setup: Next would otherwise 308 an
  // ingest path that arrives with a trailing slash, and the SDK does not follow
  // it — events silently vanish.
  skipTrailingSlashRedirect: true,

  // Analytics is proxied through this origin so adblockers, which block
  // *.posthog.com outright, do not quietly erase most of the traffic.
  //
  // EU region: the project key is an EU project (eu.i.posthog.com), matching
  // bitsmiths-main. These previously pointed at the US ingest hosts, which is a
  // region mismatch — an EU key posted to US ingest is not accepted, so nothing
  // this app sent was ever recorded.
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://eu.i.posthog.com/decide',
      },
      // posthog-js moved feature-flag evaluation from /decide to /flags; both
      // are mapped so an SDK upgrade cannot break flags through the proxy.
      {
        source: '/ingest/flags',
        destination: 'https://eu.i.posthog.com/flags',
      },
    ];
  },
};

export default nextConfig;
