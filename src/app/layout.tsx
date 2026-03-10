import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lukas Nilsson — Tech Creative & Founder",
    template: "%s — Lukas Nilsson",
  },
  description:
    "Tech creative, founder, and truth seeker building at the intersection of philosophy, technology, and human potential.",
  metadataBase: new URL("https://lukasnilsson.com"),
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: "https://lukasnilsson.com",
    siteName: "Lukas Nilsson",
    title: "Lukas Nilsson — Tech Creative & Founder",
    description:
      "Building at the intersection of philosophy, technology, and human potential.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lukas Nilsson",
    description: "Tech creative, founder, truth seeker.",
  },
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#fafbfc" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="noise">{children}</body>
    </html>
  );
}
