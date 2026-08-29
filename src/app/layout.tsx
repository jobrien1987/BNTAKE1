import type { Metadata, Viewport } from 'next';
import { Anton, Inter } from 'next/font/google';
import { PlayerProvider } from '@/components/player/player-provider';
import { PlayerBar } from '@/components/player/player-bar';
import { appUrl } from '@/lib/env';
import './globals.css';

const display = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Boosie Network — Culture. Music. Movies. Ownership.',
    template: '%s | Boosie Network',
  },
  description:
    'The official Boosie Network: culture and entertainment news, movies, music, live streams, merchandise, community and Heartfelt giving.',
  applicationName: 'Boosie Network',
  openGraph: {
    type: 'website',
    siteName: 'Boosie Network',
    url: appUrl,
    title: 'Boosie Network',
    description: 'Culture. Music. Movies. Ownership.',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#07070a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-ink text-bone">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to content
        </a>
        <PlayerProvider>
          {children}
          <PlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
