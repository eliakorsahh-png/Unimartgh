// app/legal/page.tsx — Terms & Privacy Policy
// Place this file at: app/legal/page.tsx

"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

// ── Types ─────────────────────────────────────────────────────────
type Tab = "terms" | "privacy"

// ── Data ──────────────────────────────────────────────────────────
const TERMS_SECTIONS = [
  { id: "terms-acceptance",  label: "Acceptance" },
  { id: "terms-platform",    label: "Platform Use" },
  { id: "terms-sellers",     label: "Sellers & Listings" },
  { id: "terms-payments",    label: "Payments & Verify" },
  { id: "terms-prohibited",  label: "Prohibited Use" },
  { id: "terms-liability",   label: "Liability" },
  { id: "terms-termination", label: "Termination" },
  { id: "terms-governing",   label: "Governing Law" },
]

const PRIVACY_SECTIONS = [
  { id: "privacy-collect",  label: "Data We Collect" },
  { id: "privacy-use",      label: "How We Use It" },
  { id: "privacy-sharing",  label: "Data Sharing" },
  { id: "privacy-rights",   label: "Your Rights" },
  { id: "privacy-storage",  label: "Storage & Security" },
  { id: "privacy-cookies",  label: "Cookies" },
  { id: "privacy-children", label: "Minors" },
  { id: "privacy-changes",  label: "Policy Changes" },
]

// ── Shared Components ─────────────────────────────────────────────
function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <>
      <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: "#f97316", marginBottom: 10 }}>
        {num}
      </span>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 700, color: "#0f1f6e", lineHeight: 1.25, marginBottom: 20, letterSpacing: "-0.3px" }}>
        {title}
      </h2>
    </>
  )
}

function Callout({ type, icon, title, children }: { type: "info" | "warning" | "success"; icon: string; title: string; children: React.ReactNode }) {
  const colors = {
    info:    { bg: "#eef2ff", border: "#0f1f6e", title: "#0f1f6e", text: "#3730a3" },
    warning: { bg: "#fff7ed", border: "#f97316", title: "#9a3412", text: "#c2410c" },
    success: { bg: "#f0fdf4", border: "#16a34a", title: "#14532d", text: "#166534" },
  }
  const c = colors[type]
  return (
    <div style={{ background: c.bg, borderLeft: `3px solid ${c.border}`, borderRadius: 12, padding: "18px 22px", margin: "24px 0", display: "flex", gap: 14 }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: c.title, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: c.text, lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  )
}

function StyledList({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: "none", margin: "16px 0", padding: 0 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: 12, padding: "10px 0", fontSize: 14, color: "#334155", borderBottom: i < items.length - 1 ? "1px solid rgba(15,31,110,0.08)" : "none", lineHeight: 1.7 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316", flexShrink: 0, marginTop: 8 }} />
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto" as const, margin: "20px 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(15,31,110,0.08)" }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ background: "#0f1f6e", color: "white", padding: "12px 16px", textAlign: "left" as const, fontWeight: 600, fontSize: 12, letterSpacing: "0.5px" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "12px 16px", borderBottom: ri < rows.length - 1 ? "1px solid rgba(15,31,110,0.08)" : "none", color: "#334155", verticalAlign: "top", lineHeight: 1.6, background: ri % 2 === 1 ? "#f4f6fb" : "white" }} dangerouslySetInnerHTML={{ __html: cell }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.8, marginBottom: 16 }}>{children}</p>
}

function Hl({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#f97316", fontWeight: 600 }}>{children}</span>
}

// ── Main Page ─────────────────────────────────────────────────────
export default function LegalPage() {
  const [tab, setTab]         = useState<Tab>("terms")
  const [activeId, setActiveId] = useState("")
  const [progress, setProgress] = useState(0)

  const sections = tab === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS

  // Scroll progress
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      setProgress((doc.scrollTop / (doc.scrollHeight - doc.clientHeight)) * 100)
    }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id) })
      },
      { rootMargin: "-20% 0px -60% 0px" }
    )
    document.querySelectorAll(".article-section[id]").forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [tab])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    window.scrollTo({ top: 400, behavior: "smooth" })
  }

  return (
    <>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        .article-section { padding: 48px 0; border-bottom: 1px solid rgba(15,31,110,0.08); scroll-margin-top: 100px; }
        .article-section:first-child { padding-top: 0; }
        .article-section:last-child  { border-bottom: none; }
        @media (max-width: 768px) { .sidebar { display: none !important; } .layout { grid-template-columns: 1fr !important; } }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
      `}</style>

      {/* Progress bar */}
      <div style={{ position: "fixed", top: 60, left: 0, height: 2, background: "#f97316", zIndex: 99, width: `${progress}%`, transition: "width 0.1s linear" }} />

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 24px", background: "rgba(8,15,61,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <Link href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "white", textDecoration: "none" }}>
          Uni<span style={{ color: "#f97316" }}>Mart</span>
        </Link>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
          ← Back to UniMart
        </Link>
      </nav>

      {/* Hero */}
      <div style={{ background: "#080f3d", position: "relative", overflow: "hidden", padding: "120px 24px 90px", textAlign: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 20% 50%, rgba(249,115,22,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 30%, rgba(26,42,154,0.6) 0%, transparent 70%)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#f97316", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316", animation: "pulse 2s infinite" }} />
            Legal Documents
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(36px, 6vw, 62px)", fontWeight: 900, color: "white", lineHeight: 1.1, letterSpacing: "-1px", marginBottom: 20 }}>
            Terms &amp; <span style={{ color: "#f97316" }}>Privacy</span>
            <br />Policy
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
            Effective date: 28 February 2026 &nbsp;·&nbsp; UniMart Ghana
          </p>
        </div>
      </div>

      {/* Layout */}
      <div className="layout" style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px", display: "grid", gridTemplateColumns: "260px 1fr", gap: 64, alignItems: "start" }}>

        

        {/* Main content */}
        <main>
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 4, background: "#f4f6fb", borderRadius: 12, padding: 4, marginBottom: 56, width: "fit-content" }}>
            {(["terms", "privacy"] as Tab[]).map((t, i) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{ padding: "10px 24px", borderRadius: 9, border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", background: tab === t ? "#0f1f6e" : "transparent", color: tab === t ? "white" : "#64748b", boxShadow: tab === t ? "0 2px 12px rgba(15,31,110,0.25)" : "none" }}
              >
                {i === 0 ? "Terms of Service" : "Privacy Policy"}
              </button>
            ))}
          </div>

          {/* ═══ TERMS ═══ */}
          {tab === "terms" && (
            <div>
              <Callout type="info" icon="📋" title="Please read carefully">
                By creating an account or using UniMart, you agree to these Terms of Service. If you do not agree, please do not use our platform.
              </Callout>

              <div className="article-section" id="terms-acceptance">
                <SectionHeader num="01 — Acceptance" title="Agreement to Terms" />
                <P>These Terms of Service constitute a legally binding agreement between you and <Hl>UniMart Ghana</Hl> governing your access to and use of the UniMart website, mobile application, and related services (the "Platform").</P>
                <P>By registering an account, posting a listing, or using any feature of the Platform, you confirm that you are at least <Hl>16 years of age</Hl>, are a student or affiliate of a recognised Ghanaian university, and have read and agreed to these Terms.</P>
              </div>

              <div className="article-section" id="terms-platform">
                <SectionHeader num="02 — Platform Use" title="About UniMart" />
                <P>UniMart is a campus marketplace connecting student buyers and sellers across Ghanaian universities. We provide the technology; we are <Hl>not a party to any transaction</Hl> between buyers and sellers. UniMart does not own, warehouse, or ship any goods listed on the Platform.</P>
                <P>We reserve the right to modify, suspend, or discontinue any aspect of the Platform at any time with reasonable notice where possible.</P>
                <Callout type="warning" icon="⚠️" title="Transaction Responsibility">
                  All transactions are directly between buyers and sellers. UniMart is not responsible for the quality, safety, legality, or availability of items listed, nor for the ability of sellers to sell or buyers to pay.
                </Callout>
              </div>

              <div className="article-section" id="terms-sellers">
                <SectionHeader num="03 — Sellers & Listings" title="Listing Your Items" />
                <P>As a seller on UniMart, you agree to:</P>
                <StyledList items={[
                  "Only list items you own or have the legal right to sell",
                  "Provide accurate, honest descriptions and real photographs of your items",
                  "Set fair and transparent prices in Ghana Cedis (GH₵)",
                  "Respond to buyer enquiries promptly and in good faith",
                  "Complete transactions you have agreed to with buyers",
                  "Not list counterfeit, stolen, or prohibited goods",
                  "Keep your contact information (WhatsApp, etc.) current and accurate",
                ]} />
                <P>Free accounts post listings active for <Hl>3 days</Hl>. <Hl>Verified sellers</Hl> receive 7-day listings and priority placement in search results.</P>
              </div>

              <div className="article-section" id="terms-payments">
                <SectionHeader num="04 — Payments & Verification" title="Verification & Paystack" />
                <P>UniMart offers an optional <Hl>Verified Seller</Hl> badge via a paid programme. Fees are processed securely via <strong>Paystack</strong> in Ghana Cedis.</P>
                <DataTable
                  headers={["Plan", "Duration", "Price", "Renewal"]}
                  rows={[
                    ["Monthly", "30 days", "GH₵ 10", "Manual"],
                    ["Quarterly", "90 days", "GH₵ 25", "Manual"],
                    ["Annual", "365 days", "GH₵ 80", "Manual"],
                  ]}
                />
                <Callout type="warning" icon="💳" title="Refund Policy">
                  Verification fees are non-refundable once processed and the badge is activated. If you believe a charge was made in error, contact us within 48 hours with your payment reference.
                </Callout>
              </div>

              <div className="article-section" id="terms-prohibited">
                <SectionHeader num="05 — Prohibited Use" title="What You Cannot Do" />
                <StyledList items={[
                  "Listing or selling illegal items — drugs, weapons, stolen goods, counterfeit products",
                  "Harassment, threats, or abusive communication toward other users",
                  "Creating multiple accounts to evade suspension or inflate trust metrics",
                  "Posting misleading listings, fake reviews, or fraudulent pricing",
                  "Scraping or extracting platform data without written permission",
                  "Impersonating another user, institution, or UniMart staff",
                  "Using the Platform to conduct scams or advance fraudulent schemes",
                  "Posting adult, explicit, or age-restricted content of any kind",
                ]} />
                <P>Violations may result in immediate account suspension and may be reported to relevant authorities where required by law.</P>
              </div>

              <div className="article-section" id="terms-liability">
                <SectionHeader num="06 — Liability" title="Limitation of Liability" />
                <P>The Platform is provided on an <Hl>"as is"</Hl> and <Hl>"as available"</Hl> basis without warranties of any kind. To the fullest extent permitted by Ghanaian law, UniMart disclaims all implied warranties including merchantability and fitness for a particular purpose.</P>
                <P>Our total liability to you for any claim shall not exceed the amount you paid to UniMart in the <Hl>three months preceding</Hl> the event giving rise to the claim.</P>
              </div>

              <div className="article-section" id="terms-termination">
                <SectionHeader num="07 — Termination" title="Account Termination" />
                <P>You may close your account at any time by contacting us. We reserve the right to suspend or permanently terminate accounts that violate these Terms, engage in fraudulent activity, or harm the UniMart community.</P>
                <P>Upon termination, your listings will be removed and your personal data handled in accordance with our Privacy Policy.</P>
              </div>

              <div className="article-section" id="terms-governing">
                <SectionHeader num="08 — Governing Law" title="Jurisdiction & Disputes" />
                <P>These Terms are governed by the laws of the <Hl>Republic of Ghana</Hl>. Any disputes shall be subject to the exclusive jurisdiction of the courts of Ghana.</P>
                <P>We encourage you to contact us before initiating legal action — most issues can be resolved quickly through direct communication.</P>
              </div>
            </div>
          )}

          {/* ═══ PRIVACY ═══ */}
          {tab === "privacy" && (
            <div>
              <Callout type="success" icon="🔒" title="Your privacy matters">
                UniMart collects only what is necessary to run the platform. We do not sell your personal data to third parties, ever.
              </Callout>

              <div className="article-section" id="privacy-collect">
                <SectionHeader num="01 — Data We Collect" title="What We Collect & Why" />
                <DataTable
                  headers={["Data Type", "Examples", "Purpose"]}
                  rows={[
                    ["<strong>Account Info</strong>", "Name, email, username, school", "Create and manage your account"],
                    ["<strong>Contact Info</strong>", "WhatsApp number", "Enable buyers to contact you"],
                    ["<strong>Listing Content</strong>", "Photos, titles, descriptions, prices", "Display your listings to other users"],
                    ["<strong>Usage Data</strong>", "Clicks, searches, pages viewed", "Improve platform performance"],
                    ["<strong>Payment Info</strong>", "Transaction reference (not card data)", "Verify your Verified Seller status"],
                    ["<strong>Device Info</strong>", "Device type, OS, IP address", "Security and fraud prevention"],
                  ]}
                />
                <P>We do <Hl>not</Hl> store raw card numbers or banking credentials. Payment processing is handled entirely by Paystack under their own security certifications.</P>
              </div>

              <div className="article-section" id="privacy-use">
                <SectionHeader num="02 — How We Use It" title="How We Use Your Data" />
                <StyledList items={[
                  "To provide, operate, and improve the UniMart platform",
                  "To display your profile and listings to other users",
                  "To send account-related emails (verification, password reset, updates)",
                  "To calculate and display trust scores and click metrics",
                  "To detect fraud, abuse, and security threats",
                  "To comply with legal obligations under Ghanaian law",
                ]} />
                <P>We will never use your data to send unsolicited marketing from third parties or sell your information to advertisers.</P>
              </div>

              <div className="article-section" id="privacy-sharing">
                <SectionHeader num="03 — Data Sharing" title="Who Can See Your Data" />
                <DataTable
                  headers={["Recipient", "What They See", "Why"]}
                  rows={[
                    ["<strong>Other Users</strong>", "Public profile, listings, WhatsApp (if provided)", "Enable marketplace transactions"],
                    ["<strong>Supabase</strong>", "All stored data (encrypted)", "Database and authentication provider"],
                    ["<strong>Paystack</strong>", "Email, payment amount, reference", "Process verification payments"],
                    ["<strong>Legal Authorities</strong>", "As required by law", "Compliance with Ghanaian law"],
                  ]}
                />
                <P>We do not share your data with any other third parties.</P>
              </div>

              <div className="article-section" id="privacy-rights">
                <SectionHeader num="04 — Your Rights" title="Your Data Rights" />
                <StyledList items={[
                  "<strong>Access</strong> — Request a copy of all personal data we hold about you",
                  "<strong>Correction</strong> — Update inaccurate data via your profile settings",
                  "<strong>Deletion</strong> — Request deletion of your account and associated data",
                  "<strong>Portability</strong> — Request your data in a machine-readable format",
                  "<strong>Objection</strong> — Object to processing of your data for specific purposes",
                  "<strong>Withdrawal</strong> — Withdraw consent at any time where consent is the legal basis",
                ]} />
                <Callout type="info" icon="📧" title="Exercising Your Rights">
                  Email us at <strong>privacy@unimartgh.com</strong>. We will respond within 30 days.
                </Callout>
              </div>

              <div className="article-section" id="privacy-storage">
                <SectionHeader num="05 — Storage & Security" title="Data Storage & Security" />
                <P>Your data is stored on <Hl>Supabase</Hl> infrastructure with encryption at rest and in transit (TLS 1.2+). Access is restricted to authorised UniMart personnel only.</P>
                <P>If you delete your account, your personal data is removed within <Hl>30 days</Hl>, except where retention is required by law.</P>
              </div>

              <div className="article-section" id="privacy-cookies">
                <SectionHeader num="06 — Cookies" title="Cookies & Local Storage" />
                <StyledList items={[
                  "<strong>Authentication</strong> — Keeping you logged in across sessions (essential)",
                  "<strong>Preferences</strong> — Remembering your search and filter settings",
                  "<strong>Analytics</strong> — Understanding how pages are used to improve the platform",
                ]} />
                <P>We do not use third-party advertising cookies.</P>
              </div>

              <div className="article-section" id="privacy-children">
                <SectionHeader num="07 — Minors" title="Children's Privacy" />
                <P>UniMart is not intended for users under <Hl>16 years of age</Hl>. We do not knowingly collect data from children under 16. If we become aware that a child has registered, we will delete the account promptly.</P>
              </div>

              <div className="article-section" id="privacy-changes">
                <SectionHeader num="08 — Policy Changes" title="Updates to This Policy" />
                <P>When we make material changes, we will notify you via email or a prominent in-app notice at least <Hl>14 days</Hl> before changes take effect. The current version is always at <strong>unimartgh.com/legal</strong>.</P>
              </div>
            </div>
          )}

          {/* Contact card */}
          <div style={{ background: "#080f3d", borderRadius: 20, padding: 40, color: "white", marginTop: 56, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)" }} />
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, marginBottom: 10, position: "relative" }}>Questions about your data?</h3>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 28, position: "relative" }}>
              We're a student-built platform and we take your trust seriously. Reach out — a real person will respond.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", position: "relative" }}>
              <a href="mailto:unimartgh23@gmail.com" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", background: "#f97316", color: "white" }}>
                📧 unimartgh23@gmail.com
              </a>
              <a href="https://wa.me/233207779304" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}>
                💬 WhatsApp Us
              </a>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer style={{ background: "#f4f6fb", borderTop: "1px solid rgba(15,31,110,0.08)", padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          © 2026 <strong style={{ color: "#0f1f6e" }}>UniMart Ghana</strong>. All rights reserved. &nbsp;·&nbsp;
          Built for Ghanaian students. &nbsp;·&nbsp;
          <Link href="/legal" style={{ color: "#0f1f6e", fontWeight: 600 }}>Terms</Link> &nbsp;·&nbsp;
          <Link href="/legal" style={{ color: "#0f1f6e", fontWeight: 600 }}>Privacy</Link>
        </p>
      </footer>
    </>
  )
}