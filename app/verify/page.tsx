"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  ShieldCheck, CheckCircle2, ArrowLeft, Sparkles,
  Clock, AlertCircle, Loader2, BadgeCheck,
  TrendingUp, Tag, Zap, Star, CreditCard
} from "lucide-react"

type Plan = {
  id: string
  label: string
  duration: string
  months: number
  price: number
  originalPrice?: number
  savings?: number
  savingsPct?: number
  badge?: string
  color: string
}

const PLANS: Plan[] = [
  {
    id: "1month",
    label: "1 Month",
    duration: "30 days",
    months: 1,
    price: 10,
    color: "#6366f1",
  },
  {
    id: "3months",
    label: "3 Months",
    duration: "90 days",
    months: 3,
    price: 25,
    originalPrice: 30,
    savings: 5,
    savingsPct: 17,
    badge: "Most Popular",
    color: "#f97316",
  },
  {
    id: "1year",
    label: "1 Year",
    duration: "365 days",
    months: 12,
    price: 80,
    originalPrice: 120,
    savings: 40,
    savingsPct: 33,
    badge: "Best Value",
    color: "#16a34a",
  },
]

const BENEFITS = [
  { icon: ShieldCheck,  title: "Verified Badge",        desc: "Blue shield on your profile and every listing — buyers trust you instantly." },
  { icon: TrendingUp,   title: "Priority in Search",    desc: "Your listings rank higher and get seen first." },
  { icon: Zap,          title: "Longer Listing Life",   desc: "Posts stay live for 7 days instead of 3." },
  { icon: Star,         title: "Trust Score Boost",     desc: "Start with a boosted trust score visible to buyers." },
  { icon: Tag,          title: "Unlimited Daily Posts", desc: "Post as many listings as you want per day." },
  { icon: BadgeCheck,   title: "Seller Credibility",    desc: "Buyers are 3× more likely to contact verified sellers." },
]

// ── Paystack public key — swap for your live key in production ──
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "pk_test_REPLACE_ME"

declare global {
  interface Window {
    PaystackPop: { new(): { newTransaction(opts: any): void } }
  }
}

export default function VerifyPage() {
  const router = useRouter()

  const [userId, setUserId]         = useState<string | null>(null)
  const [userEmail, setUserEmail]   = useState<string>("")
  const [isPremium, setIsPremium]   = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan>(PLANS[1])
  const [step, setStep]             = useState<"plans" | "processing" | "done" | "failed">("plans")
  const [paystackLoaded, setPaystackLoaded] = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [paidRef, setPaidRef]       = useState<string>("")
  const scriptRef = useRef(false)

  // ── Load Paystack inline script once ───────────────────────────
  useEffect(() => {
    if (scriptRef.current) return
    scriptRef.current = true
    const s = document.createElement("script")
    s.src = "https://js.paystack.co/v2/inline.js"
    s.async = true
    s.onload = () => setPaystackLoaded(true)
    document.body.appendChild(s)
  }, [])

  // ── Auth ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push("/login"); return }
      setUserId(session.user.id)
      setUserEmail(session.user.email ?? "")
      const { data } = await supabase
        .from("profiles").select("is_premium").eq("id", session.user.id).single()
      if (data?.is_premium) setIsPremium(true)
    })
  }, [])

  // ── Open Paystack popup ─────────────────────────────────────────
  const handlePayNow = () => {
    if (!paystackLoaded || !window.PaystackPop) {
      setErrorMsg("Payment system is loading, please wait a moment and try again.")
      return
    }
    if (!userEmail) {
      setErrorMsg("Could not load your account email. Please refresh.")
      return
    }

    setErrorMsg(null)

    const ref = `UNIMART-${selectedPlan.id.toUpperCase()}-${userId?.slice(0,8)}-${Date.now()}`

    const popup = new window.PaystackPop()
    popup.newTransaction({
      key:      PAYSTACK_PUBLIC_KEY,
      email:    userEmail,
      amount:   selectedPlan.price * 100, // Paystack uses pesewas (GHS × 100)
      currency: "GHS",
      ref,
      metadata: {
        user_id:    userId,
        plan_id:    selectedPlan.id,
        plan_label: selectedPlan.label,
        months:     selectedPlan.months,
      },
      onSuccess: (transaction: { reference: string }) => {
        // Payment completed — verify server-side
        setStep("processing")
        setPaidRef(transaction.reference)
        verifyAndActivate(transaction.reference)
      },
      onCancel: () => {
        // User closed the popup without paying — do nothing
      },
    })
  }

  // ── Call API route to verify with Paystack + activate badge ────
  const verifyAndActivate = async (reference: string) => {
    try {
      const res = await fetch("/api/verify-payment", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          user_id:    userId,
          plan_id:    selectedPlan.id,
          plan_label: selectedPlan.label,
          months:     selectedPlan.months,
          amount:     selectedPlan.price,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        setStep("failed")
        setErrorMsg(json.error ?? "Payment verification failed. Contact support with your reference.")
        return
      }

      setStep("done")
    } catch (err: any) {
      setStep("failed")
      setErrorMsg("Network error during verification. Your payment went through — contact support with your reference.")
    }
  }

  const perMonth = (p: Plan) => (p.price / p.months).toFixed(2)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        input, select, textarea { font-size:16px !important; }
        body { background:#f0f4ff; font-family:'DM Sans',system-ui,sans-serif; }

        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pop     { 0%{transform:scale(0.85);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes bgPulse { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }

        .vnav { background:linear-gradient(135deg,#0f1f6e,#162380); position:sticky; top:0; z-index:60; box-shadow:0 2px 20px rgba(13,29,110,0.4); }
        .vnav-in { max-width:960px; margin:0 auto; padding:0 16px; height:60px; display:flex; align-items:center; gap:12px; }
        .vback { background:rgba(255,255,255,0.1); border:none; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; transition:background .15s; flex-shrink:0; }
        .vback:hover { background:rgba(255,255,255,0.2); }

        .vhero {
          background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 45%,#c2410c 100%);
          background-size:200% 200%; animation:bgPulse 10s ease infinite;
          padding:52px 20px 96px; text-align:center; position:relative; overflow:hidden;
        }
        .vhero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 70% 30%,rgba(251,146,60,0.2) 0%,transparent 55%),radial-gradient(ellipse at 20% 75%,rgba(99,102,241,0.16) 0%,transparent 55%); pointer-events:none; }
        .vhero-pat { position:absolute; inset:0; opacity:0.04; background-image:repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 38px); }
        .vhero::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:64px; background:#f0f4ff; clip-path:ellipse(55% 100% at 50% 100%); }
        .shield-glow { width:88px; height:88px; border-radius:50%; background:linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06)); border:2px solid rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; box-shadow:0 0 40px rgba(249,115,22,0.35); animation:shimmer 3s ease infinite; }

        .vwrap { max-width:960px; margin:0 auto; padding:0 16px 72px; }

        .ben-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; margin-bottom:40px; }
        .ben-item { background:white; border-radius:16px; padding:18px; border:1.5px solid #eef2ff; box-shadow:0 2px 12px rgba(13,29,110,0.06); display:flex; gap:14px; align-items:flex-start; animation:fadeUp .4s ease both; }
        .ben-icon { width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#eef2ff,#e0e7ff); display:flex; align-items:center; justify-content:center; flex-shrink:0; }

        .plans-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; margin-bottom:32px; }
        .plan-card { background:white; border-radius:22px; padding:28px 24px; border:2.5px solid #eef2ff; cursor:pointer; box-shadow:0 2px 16px rgba(13,29,110,0.07); transition:all .2s ease; position:relative; overflow:hidden; animation:fadeUp .35s ease both; }
        .plan-card.sel { box-shadow:0 8px 36px rgba(0,0,0,0.14); transform:translateY(-3px); }
        .plan-badge { display:inline-block; padding:3px 11px; border-radius:999px; font-size:0.65rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; font-family:'DM Sans',sans-serif; margin-bottom:14px; color:white; }
        .plan-price { font-family:'Playfair Display',serif; font-weight:800; font-size:2.4rem; line-height:1; color:#0f172a; }
        .plan-price span { font-size:1rem; font-weight:600; color:#94a3b8; font-family:'DM Sans',sans-serif; }
        .plan-savings { display:inline-flex; align-items:center; gap:4px; margin-top:8px; padding:3px 10px; border-radius:999px; font-size:0.68rem; font-weight:800; font-family:'DM Sans',sans-serif; }
        .plan-select { width:100%; margin-top:18px; padding:11px; border:none; border-radius:12px; font-family:'DM Sans',sans-serif; font-weight:700; font-size:0.82rem; cursor:pointer; transition:all .15s; }

        /* PAY NOW button */
        .pay-btn { display:inline-flex; align-items:center; justify-content:center; gap:10px; padding:17px 48px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; border:none; border-radius:16px; font-family:'DM Sans',sans-serif; font-weight:800; font-size:1rem; cursor:pointer; box-shadow:0 8px 28px rgba(234,88,12,0.35); transition:all .2s; width:100%; max-width:380px; }
        .pay-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 36px rgba(234,88,12,0.45); }
        .pay-btn:disabled { opacity:0.55; cursor:not-allowed; transform:none; }

        /* Paystack branding strip */
        .ps-strip { display:flex; align-items:center; justify-content:center; gap:8px; margin-top:12px; font-size:0.72rem; color:#94a3b8; font-family:'DM Sans',sans-serif; }
        .ps-badge { display:inline-flex; align-items:center; gap:5px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:999px; padding:4px 12px; font-size:0.7rem; font-weight:700; color:#334155; font-family:'DM Sans',sans-serif; }

        /* Processing / Done / Failed cards */
        .status-card { max-width:500px; margin:0 auto; background:white; border-radius:24px; box-shadow:0 6px 40px rgba(13,29,110,0.1); padding:48px 28px; text-align:center; animation:pop .4s ease; }
        .err-box { background:#fff1f0; border:1.5px solid #fca5a5; border-radius:12px; padding:12px 16px; display:flex; gap:10px; align-items:flex-start; font-size:0.82rem; color:#dc2626; font-family:'DM Sans',sans-serif; margin-top:16px; text-align:left; animation:fadeUp .2s ease; line-height:1.55; }

        @media(max-width:540px) {
          .plans-grid { grid-template-columns:1fr; }
          .ben-grid   { grid-template-columns:1fr; }
        }
      `}</style>

      {/* NAV */}
      <header className="vnav">
        <div className="vnav-in">
          <button className="vback" onClick={() => step === "plans" ? router.back() : setStep("plans")}>
            <ArrowLeft size={17} />
          </button>
          <span style={{ fontFamily:"'Playfair Display',serif", color:"white", fontWeight:700, fontSize:"0.96rem" }}>
            Get Verified
          </span>
        </div>
      </header>

      {/* HERO */}
      <div className="vhero">
        <div className="vhero-pat" />
        <div style={{ position:"relative", zIndex:1, maxWidth:560, margin:"0 auto" }}>
          <div className="shield-glow">
            <ShieldCheck size={44} color="white" strokeWidth={1.8} />
          </div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", color:"white", fontWeight:800, fontSize:"clamp(1.8rem,5vw,2.6rem)", lineHeight:1.2, marginBottom:12 }}>
            Become a Verified<br />
            <span style={{ color:"#fb923c" }}>UniMart Seller</span>
          </h1>
          <p style={{ color:"rgba(255,255,255,0.65)", fontFamily:"'DM Sans',sans-serif", fontSize:"0.95rem", lineHeight:1.65, maxWidth:400, margin:"0 auto" }}>
            Verified sellers get more clicks, more trust, and more sales from the campus community.
          </p>
        </div>
      </div>

      <div className="vwrap">

        {/* ── ALREADY VERIFIED ── */}
        {isPremium && (
          <div className="status-card" style={{ marginTop:"-48px" }}>
            <div style={{ width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,#16a34a,#4ade80)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", boxShadow:"0 8px 28px rgba(22,163,74,0.35)" }}>
              <ShieldCheck size={38} color="white" />
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, color:"#0f1f6e", fontSize:"1.3rem", marginBottom:8 }}>You're already verified!</h2>
            <p style={{ color:"#64748b", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", lineHeight:1.6, marginBottom:24 }}>
              Your account has the verified badge. Keep selling and building your trust score.
            </p>
            <a href="/profile" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"11px 26px", background:"linear-gradient(135deg,#0f1f6e,#162380)", color:"white", borderRadius:14, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"0.88rem", textDecoration:"none" }}>
              View My Profile →
            </a>
          </div>
        )}

        {!isPremium && (
          <>

            {/* ── PLANS STEP ── */}
            {step === "plans" && (
              <>
                {/* Benefits */}
                <div style={{ textAlign:"center", marginBottom:24, marginTop:"-32px" }}>
                  <h2 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, color:"#0f1f6e", fontSize:"1.3rem", marginBottom:6 }}>What you get</h2>
                  <div style={{ height:3, width:56, background:"linear-gradient(90deg,#0f1f6e,#f97316)", borderRadius:2, margin:"0 auto" }} />
                </div>
                <div className="ben-grid">
                  {BENEFITS.map((b, i) => (
                    <div key={b.title} className="ben-item" style={{ animationDelay:`${i * 60}ms` }}>
                      <div className="ben-icon"><b.icon size={18} color="#0f1f6e" /></div>
                      <div>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", fontSize:"0.88rem", marginBottom:3 }}>{b.title}</div>
                        <div style={{ fontSize:"0.76rem", color:"#64748b", fontFamily:"'DM Sans',sans-serif", lineHeight:1.55 }}>{b.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Plans */}
                <div style={{ textAlign:"center", marginBottom:24 }}>
                  <h2 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, color:"#0f1f6e", fontSize:"1.3rem", marginBottom:6 }}>Choose your plan</h2>
                  <div style={{ height:3, width:56, background:"linear-gradient(90deg,#0f1f6e,#f97316)", borderRadius:2, margin:"0 auto" }} />
                </div>
                <div className="plans-grid">
                  {PLANS.map((plan, i) => (
                    <div
                      key={plan.id}
                      className={`plan-card ${selectedPlan.id === plan.id ? "sel" : ""}`}
                      style={{ borderColor: selectedPlan.id === plan.id ? plan.color : "#eef2ff", animationDelay:`${i * 80}ms` }}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      {plan.badge
                        ? <div className="plan-badge" style={{ background: plan.color }}>{plan.badge}</div>
                        : <div style={{ height:26, marginBottom:14 }} />
                      }
                      <div style={{ marginBottom:8 }}>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"0.85rem", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em" }}>{plan.label}</span>
                        <div style={{ fontSize:"0.72rem", color:"#cbd5e1", fontFamily:"'DM Sans',sans-serif" }}>{plan.duration}</div>
                      </div>
                      <div className="plan-price">GH₵{plan.price}<span> total</span></div>
                      {plan.originalPrice && (
                        <div style={{ textDecoration:"line-through", color:"#cbd5e1", fontSize:"0.82rem", fontFamily:"'DM Sans',sans-serif", marginTop:2 }}>Was GH₵{plan.originalPrice}</div>
                      )}
                      <div style={{ fontSize:"0.72rem", color:"#94a3b8", fontFamily:"'DM Sans',sans-serif", marginTop:4 }}>GH₵{perMonth(plan)} / month</div>
                      {plan.savings && (
                        <div className="plan-savings" style={{ background:`${plan.color}15`, color: plan.color }}>
                          Save GH₵{plan.savings} ({plan.savingsPct}% off)
                        </div>
                      )}
                      <button
                        className="plan-select"
                        style={{
                          background: selectedPlan.id === plan.id ? `linear-gradient(135deg,${plan.color},${plan.color}cc)` : "#f8fafc",
                          color: selectedPlan.id === plan.id ? "white" : "#64748b",
                          border: selectedPlan.id === plan.id ? "none" : "1.5px solid #e2e8f0",
                        }}
                        onClick={e => { e.stopPropagation(); setSelectedPlan(plan) }}
                      >
                        {selectedPlan.id === plan.id ? "✓ Selected" : "Select Plan"}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Pay CTA */}
                <div style={{ textAlign:"center" }}>
                  {errorMsg && (
                    <div className="err-box" style={{ maxWidth:380, margin:"0 auto 16px", justifyContent:"center" }}>
                      <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }} />
                      {errorMsg}
                    </div>
                  )}
                  <button
                    className="pay-btn"
                    onClick={handlePayNow}
                    disabled={!paystackLoaded}
                  >
                    {!paystackLoaded
                      ? <><Loader2 size={18} style={{ animation:"spin 0.8s linear infinite" }} /> Loading…</>
                      : <><CreditCard size={18} /> Pay GH₵{selectedPlan.price} — Get Verified</>
                    }
                  </button>

                  {/* Paystack trust strip */}
                  <div className="ps-strip">
                    <span>Secured by</span>
                    <div className="ps-badge">
                      {/* Paystack green circle logo */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="12" fill="#00C3F7"/>
                        <path d="M7 12l3.5 3.5L17 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Paystack
                    </div>
                    <span>· 256-bit SSL</span>
                  </div>
                  <p style={{ marginTop:8, fontSize:"0.72rem", color:"#cbd5e1", fontFamily:"'DM Sans',sans-serif" }}>
                    Card, Mobile Money, Bank Transfer accepted · Activated within 1 minute
                  </p>
                </div>
              </>
            )}

            {/* ── PROCESSING ── */}
            {step === "processing" && (
              <div className="status-card" style={{ marginTop:"-48px" }}>
                <div style={{ width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,#eef2ff,#e0e7ff)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", animation:"pulse 1.5s ease infinite" }}>
                  <ShieldCheck size={38} color="#0f1f6e" />
                </div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, color:"#0f1f6e", fontSize:"1.2rem", marginBottom:8 }}>
                  Verifying your payment…
                </h2>
                <p style={{ color:"#94a3b8", fontFamily:"'DM Sans',sans-serif", fontSize:"0.85rem", marginBottom:24, lineHeight:1.6 }}>
                  Your payment was received. We're confirming it with Paystack now — this takes a few seconds.
                </p>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:"#6366f1", fontFamily:"'DM Sans',sans-serif", fontSize:"0.84rem" }}>
                  <Loader2 size={18} style={{ animation:"spin 0.8s linear infinite" }} />
                  Checking…
                </div>
              </div>
            )}

            {/* ── DONE ── */}
            {step === "done" && (
              <div className="status-card" style={{ marginTop:"-48px" }}>
                <div style={{ width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,#16a34a,#4ade80)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", boxShadow:"0 8px 28px rgba(22,163,74,0.3)" }}>
                  <ShieldCheck size={38} color="white" />
                </div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, color:"#0f1f6e", fontSize:"1.3rem", marginBottom:10 }}>
                  You're Verified! 🎉
                </h2>
                <p style={{ color:"#64748b", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem", lineHeight:1.7, maxWidth:360, margin:"0 auto 20px" }}>
                  Your <strong style={{ color:"#0f1f6e" }}>{selectedPlan.label}</strong> verification is now active.
                  The blue shield badge appears on your profile and every listing immediately.
                </p>
                <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:14, padding:"14px 18px", maxWidth:340, margin:"0 auto 28px", textAlign:"left" }}>
                  {[
                    "Verified badge is now live on your profile",
                    "You can now post unlimited listings per day",
                    "Your trust score has been boosted",
                  ].map(t => (
                    <div key={t} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
                      <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink:0, marginTop:2 }} />
                      <span style={{ fontSize:"0.8rem", color:"#166534", fontFamily:"'DM Sans',sans-serif" }}>{t}</span>
                    </div>
                  ))}
                </div>
                <a
                  href="/profile"
                  style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 28px", background:"linear-gradient(135deg,#0f1f6e,#162380)", color:"white", borderRadius:14, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"0.88rem", textDecoration:"none" }}
                >
                  View My Profile →
                </a>
              </div>
            )}

            {/* ── FAILED ── */}
            {step === "failed" && (
              <div className="status-card" style={{ marginTop:"-48px" }}>
                <div style={{ width:80, height:80, borderRadius:"50%", background:"linear-gradient(135deg,#fee2e2,#fca5a5)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
                  <AlertCircle size={38} color="#dc2626" />
                </div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, color:"#dc2626", fontSize:"1.2rem", marginBottom:10 }}>
                  Verification Failed
                </h2>
                {errorMsg && (
                  <div className="err-box">
                    <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }} />
                    {errorMsg}
                  </div>
                )}
                <p style={{ color:"#64748b", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", lineHeight:1.65, margin:"16px 0 24px", maxWidth:360, marginLeft:"auto", marginRight:"auto" }}>
                  If money was deducted, don't worry — contact us on WhatsApp with your reference: <strong style={{ color:"#0f1f6e", fontFamily:"monospace" }}>{paidRef}</strong>
                </p>
                <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                  <button
                    onClick={() => { setStep("plans"); setErrorMsg(null) }}
                    style={{ padding:"11px 22px", background:"#0f1f6e", color:"white", border:"none", borderRadius:12, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"0.85rem", cursor:"pointer" }}
                  >
                    Try Again
                  </button>
                  <a
                    href="https://wa.me/233207779304"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"11px 22px", background:"#25D366", color:"white", borderRadius:12, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"0.85rem", textDecoration:"none" }}
                  >
                    Contact Support
                  </a>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </>
  )
}