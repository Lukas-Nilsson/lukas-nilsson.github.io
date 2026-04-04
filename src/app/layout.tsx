import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, Inter_Tight } from 'next/font/google';
import './globals.css';
import { siteDescription, siteName, siteUrl } from '@/lib/site-content';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter-tight',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: '%s | Lukas Nilsson',
  },
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  alternates: {
    canonical: '/',
  },
  authors: [
    { name: siteName, url: siteUrl },
  ],
  creator: siteName,
  publisher: siteName,
  keywords: [
    'Lukas Nilsson',
    'The Human Archives',
    'AI automation',
    'software engineer',
    'founder',
    'Melbourne',
    'human potential',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: siteUrl,
    siteName,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${siteName} social card`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
    images: ['/twitter-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${interTight.variable} ${spaceGrotesk.variable} noise`}>
        {children}
      </body>
    </html>
  );
}
