// app/robots.ts
// Auto-generates /robots.txt at https://unimartgh.com/robots.txt

import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/post/",
          "/seller/",
          "/verify",
        ],
        disallow: [
          "/profile",        // private — logged in users only
          "/profile/edit",
          "/upload",
          "/store/create",
          "/store/edit",
          "/login",
          "/signup",
          "/reset-password",
          "/auth/",
          "/api/",
        ],
      },
      {
        // Block AI scrapers from training on your content
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "anthropic-ai",
          "Claude-Web",
          "Omgilibot",
          "FacebookBot",
        ],
        disallow: ["/"],
      },
    ],
    sitemap: "https://unimartgh.com/sitemap.xml",
    host:    "https://unimartgh.com",
  }
}