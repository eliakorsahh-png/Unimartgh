// app/opengraph-image.tsx
// Generates a dynamic OG image at https://unimartgh.com/opengraph-image
// Used as fallback for all pages that don't have their own OG image
// Next.js serves this automatically to WhatsApp, Twitter, Facebook etc.

import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size    = { width: 1200, height: 630 }
export const contentType = "og-image/png"

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width:      "100%",
          height:     "100%",
          display:    "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f1f6e 0%, #1a2a9a 50%, #c2410c 100%)",
          position:   "relative",
          fontFamily: "serif",
        }}
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position:   "absolute",
            inset:      0,
            opacity:    0.04,
            backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 1px, transparent 40px)",
          }}
        />

        {/* Glow blobs */}
        <div style={{ position:"absolute", top:80, right:180, width:320, height:320, borderRadius:"50%", background:"rgba(249,115,22,0.18)", filter:"blur(80px)" }} />
        <div style={{ position:"absolute", bottom:80, left:120, width:260, height:260, borderRadius:"50%", background:"rgba(99,102,241,0.15)", filter:"blur(80px)" }} />

        {/* Shield icon */}
        <div
          style={{
            width:      96,
            height:     96,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
            border:     "2px solid rgba(255,255,255,0.25)",
            display:    "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>

        {/* UniMart wordmark */}
        <div style={{ fontSize: 72, fontWeight: 800, color: "white", letterSpacing: "-2px", marginBottom: 16, display:"flex" }}>
          Uni<span style={{ color: "#fb923c" }}>Mart</span>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.7)", fontWeight: 400, marginBottom: 40, display:"flex" }}>
          Ghana's Campus Marketplace
        </div>

        {/* Pill chips */}
        <div style={{ display:"flex", gap: 14 }}>
          {["Buy", "Sell", "Trust"].map((t) => (
            <div
              key={t}
              style={{
                background:   "rgba(255,255,255,0.12)",
                border:       "1.5px solid rgba(255,255,255,0.22)",
                borderRadius: 999,
                padding:      "10px 28px",
                color:        "rgba(255,255,255,0.85)",
                fontSize:     22,
                fontWeight:   600,
                display:      "flex",
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{ position:"absolute", bottom: 36, fontSize: 20, color:"rgba(255,255,255,0.35)", display:"flex" }}>
          unimartgh.com
        </div>
      </div>
    ),
    { ...size }
  )
}