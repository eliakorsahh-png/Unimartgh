// app/layout.tsx
// Global metadata — applies to every page as a baseline

import type { Metadata } from "next"

const BASE_URL = "https://unimartgh.com"

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  // Fallback title template — individual pages override the first part
  title: {
    default: "UniMart — Campus Marketplace Ghana",
    template: "%s | UniMart Ghana",
  },

  description:
    "UniMart is Ghana's #1 campus marketplace. Buy and sell products within your university community — fast, trusted, and built for students.",

  keywords: [
    "campus marketplace Ghana",
    "university marketplace Ghana",
    "buy and sell Ghana students",
    "student marketplace",
    "UniMart Ghana",
    "campus shopping Ghana",
    "sell on campus Ghana",
    "Ghana university deals",
  ],

  authors: [{ name: "UniMart Ghana", url: BASE_URL }],
  creator: "UniMart Ghana",
  publisher: "UniMart Ghana",

  // Canonical
  alternates: { canonical: BASE_URL },

  // Open Graph — WhatsApp, Facebook, iMessage previews
  openGraph: {
    type:        "website",
    url:         BASE_URL,
    siteName:    "UniMart Ghana",
    title:       "UniMart — Campus Marketplace Ghana",
    description: "Buy and sell within your university community. Trusted campus deals across Ghana.",
    images: [
      {
        url:    "/og-image.png",   // place a 1200×630 image in /public/og-image.png
        width:  1200,
        height: 630,
        alt:    "UniMart — Campus Marketplace Ghana",
      },
    ],
  },

  // Twitter / X card
  twitter: {
    card:        "summary_large_image",
    title:       "UniMart — Campus Marketplace Ghana",
    description: "Buy and sell within your university community. Trusted campus deals across Ghana.",
    images:      ["/og-image.png"],
  },

  // Indexing
  robots: {
    index:               true,
    follow:              true,
    googleBot: {
      index:             true,
      follow:            true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet":     -1,
    },
  },

  // Verification — add your codes from Google Search Console etc.
  verification: {
    google: "REPLACE_WITH_GOOGLE_SEARCH_CONSOLE_CODE",
    // yandex: "...",
    // bing:   "...",
  },

  icons: {
    icon:        "/favicon.ico",
    apple:       "/favicon.ico",
    shortcut:    "/favicon.ico",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}