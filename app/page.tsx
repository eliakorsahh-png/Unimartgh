// app/page.tsx
// Server component — holds all SEO metadata + renders the client home

import type { Metadata } from "next"
import HomeClient from "./HomeClient"

const BASE_URL = "https://unimartgh.com"

export const metadata: Metadata = {
  title: "UniMart — Campus Marketplace Ghana",
  description:
    "Discover quality products from verified student sellers across Ghanaian universities. Shop textbooks, electronics, fashion, food and more on UniMart.",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type:        "website",
    url:         BASE_URL,
    siteName:    "UniMart Ghana",
    title:       "UniMart — Campus Marketplace Ghana",
    description: "Discover quality products from verified student sellers across Ghanaian universities.",
    images: [{
      url:    `${BASE_URL}/opengraph-image`,
      width:  1200,
      height: 630,
      alt:    "UniMart Campus Marketplace Ghana",
    }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "UniMart — Campus Marketplace Ghana",
    description: "Discover quality products from verified student sellers across Ghanaian universities.",
    images:      [`${BASE_URL}/opengraph-image`],
  },
}

// JSON-LD structured data for Google
function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type":       "WebSite",
        "@id":         `${BASE_URL}/#website`,
        "url":         BASE_URL,
        "name":        "UniMart Ghana",
        "description": "Ghana's campus marketplace for students to buy and sell within their university community.",
        "inLanguage":  "en-GH",
        "potentialAction": {
          "@type":       "SearchAction",
          "target":      `${BASE_URL}/?search={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type":  "Organization",
        "@id":    `${BASE_URL}/#organization`,
        "name":   "UniMart Ghana",
        "url":    BASE_URL,
        "logo": {
          "@type":  "ImageObject",
          "url":    `${BASE_URL}/Unimart.png`,
          "width":  512,
          "height": 512,
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export default function Page() {
  return (
    <>
      <StructuredData />
      <HomeClient />
    </>
  )
}