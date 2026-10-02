import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';

import './globals.css';

import PosthogAnalytics from '@/components/posthog/analytics';

import getMetadata from '@/config/app';

import AppProviders from './providers';

// Self-hosted: next/font/google breaks intermittently (vercel/next.js#99114).
const geistSans = localFont({
  src: './fonts/Geist-Variable.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMono-Variable.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
});

// Bitsmiths brand body font (from company web).
const mulish = localFont({
  src: './fonts/Mulish-Variable.woff2',
  variable: '--font-mulish',
  weight: '200 1000',
});

export const metadata: Metadata = getMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${mulish.variable} font-primary`}
      >
        <AppProviders>
          <PosthogAnalytics />
          <Toaster richColors />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
