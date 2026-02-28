# UniMart SEO Setup Guide

## File Locations

```
app/
├── layout.tsx                  ← Replace with seo-layout.tsx content
├── page.tsx                    ← Add export from seo-home-metadata.ts at the top
├── sitemap.ts                  ← New file (sitemap.ts)
├── robots.ts                   ← New file (robots.ts)
└── opengraph-image.tsx         ← New file (og-image-route.tsx)
```

---

## 1. layout.tsx
Replace your existing `app/layout.tsx` with the contents of `seo-layout.tsx`.

**One thing to update:**
```ts
verification: {
  google: "REPLACE_WITH_GOOGLE_SEARCH_CONSOLE_CODE",
}
```
Get this from: https://search.google.com/search-console
→ Add property → unimartgh.com → HTML tag method → copy just the content value

---

## 2. Home page (app/page.tsx)
At the very top of your home page file, add:

```ts
export const metadata: Metadata = { ... }  // from seo-home-metadata.ts
```

And inside your JSX, add the structured data component:
```tsx
import { HomeStructuredData } from "./seo-home-metadata"

// Inside your return():
<HomeStructuredData />
```

---

## 3. sitemap.ts → app/sitemap.ts
Next.js auto-serves this at: https://unimartgh.com/sitemap.xml
No extra config needed.

---

## 4. robots.ts → app/robots.ts
Next.js auto-serves this at: https://unimartgh.com/robots.txt
No extra config needed.

---

## 5. opengraph-image.tsx → app/opengraph-image.tsx
Next.js auto-uses this as the OG image for all pages.
Preview it at: https://unimartgh.com/opengraph-image

---

## After Deploying — Submit to Google

1. Go to https://search.google.com/search-console
2. Add property: unimartgh.com
3. Verify via HTML tag (paste code into layout.tsx verification field)
4. Go to Sitemaps → submit: https://unimartgh.com/sitemap.xml
5. Go to URL Inspection → test your homepage

---

## WhatsApp Link Preview Test
After deploying, test your OG tags here:
https://www.opengraph.xyz/url/https://unimartgh.com

---

## Checklist
- [ ] layout.tsx updated
- [ ] sitemap.ts created
- [ ] robots.ts created  
- [ ] opengraph-image.tsx created
- [ ] HomeStructuredData added to home page JSX
- [ ] Google Search Console verified
- [ ] Sitemap submitted to Google
- [ ] OG image previewed on opengraph.xyz