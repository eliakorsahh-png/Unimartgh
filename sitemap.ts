// app/sitemap.ts
// Auto-generates /sitemap.xml — Next.js serves this at https://unimartgh.com/sitemap.xml

import { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"

const BASE_URL = "https://unimartgh.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  // Fetch all active public post IDs for dynamic URLs
  const now = new Date().toISOString()
  const { data: posts } = await supabase
    .from("postings")
    .select("id, created_at, updated_at")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1000) // sitemap max is 50k but keep it reasonable

  // Fetch all public profile usernames
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, updated_at")
    .limit(500)

  const postUrls: MetadataRoute.Sitemap = (posts ?? []).map((post) => ({
    url:            `${BASE_URL}/post/${post.id}`,
    lastModified:   new Date(post.updated_at ?? post.created_at),
    changeFrequency: "daily",
    priority:       0.8,
  }))

  const profileUrls: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url:            `${BASE_URL}/seller/${p.id}`,
    lastModified:   new Date(p.updated_at ?? new Date()),
    changeFrequency: "weekly",
    priority:       0.6,
  }))

  return [
    // Static pages
    {
      url:            BASE_URL,
      lastModified:   new Date(),
      changeFrequency: "hourly",  // home feed changes constantly
      priority:       1.0,
    },
    {
      url:            `${BASE_URL}/verify`,
      lastModified:   new Date(),
      changeFrequency: "monthly",
      priority:       0.5,
    },
    // Dynamic pages
    ...postUrls,
    ...profileUrls,
  ]
}