"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

// ── WhatsApp validation ───────────────────────────────────────────
// Must be a plausible international number:
// - digits only after stripping formatting
// - 7–15 digits total (E.164 range)
// - must NOT start with 0 (that's a local number, not WhatsApp-compatible)
// - must be at least 10 digits (most intl numbers are 10–13)
function validateWhatsApp(raw: string): { valid: boolean; digitsOnly: string; error: string } {
  const digitsOnly = raw.replace(/\D/g, "")

  if (!digitsOnly)
    return { valid: false, digitsOnly: "", error: "WhatsApp number is required." }

  if (digitsOnly.length < 10)
    return { valid: false, digitsOnly, error: "Number too short. Include your country code, e.g. 233594518462." }

  if (digitsOnly.length > 15)
    return { valid: false, digitsOnly, error: "Number too long to be a valid WhatsApp number." }

  if (digitsOnly.startsWith("0"))
    return { valid: false, digitsOnly, error: "Don't start with 0 — include your country code instead, e.g. 233 for Ghana." }

  // Basic country code sanity: first 1-3 digits should form a known range
  // Ghana=233, Nigeria=234, US=1, UK=44 etc — just block obvious non-international patterns
  // A number starting with 1 needs 11 digits total (1 + 10), others 10-15
  const startsWithOne = digitsOnly.startsWith("1")
  if (startsWithOne && digitsOnly.length !== 11)
    return { valid: false, digitsOnly, error: "US/Canada numbers must be 11 digits starting with 1 (e.g. 12025551234)." }

  return { valid: true, digitsOnly, error: "" }
}

// ── Username validation ───────────────────────────────────────────
function validateUsername(u: string): string {
  if (!u.trim())                   return "Username is required."
  if (u.length < 3)                return "At least 3 characters required."
  if (u.length > 30)               return "Max 30 characters."
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Only letters, numbers and underscores."
  return ""
}

// ── Friendly Supabase auth error messages ─────────────────────────
function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("already registered") || m.includes("already exists") || m.includes("email address is already"))
    return "This email is already registered. Please sign in, or use Forgot Password if you can't access your account."
  if (m.includes("invalid email"))
    return "Please enter a valid email address."
  if (m.includes("weak password") || m.includes("password should"))
    return "Password is too weak. Use at least 6 characters."
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("wrong password"))
    return "Incorrect email or password. Please try again."
  if (m.includes("email not confirmed"))
    return "Please confirm your email before signing in. Check your inbox."
  if (m.includes("too many requests") || m.includes("rate limit"))
    return "Too many attempts. Please wait a few minutes and try again."
  return msg
}

type Mode = "signin" | "signup" | "forgot"

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode]                 = useState<Mode>("signin")
  const [email, setEmail]               = useState("")
  const [password, setPassword]         = useState("")
  const [fullName, setFullName]         = useState("")
  const [username, setUsername]         = useState("")
  const [whatsapp, setWhatsapp]         = useState("")
  const [school, setSchool]             = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [waError, setWaError]           = useState("")
  const [unError, setUnError]           = useState("")

  const switchMode = (m: Mode) => {
    setMode(m); setError(null); setSuccess(null); setWaError(""); setUnError("")
  }

  // ── Session check ─────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { router.replace("/"); return }
      setCheckingSession(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session?.user) return
        if (session.user.app_metadata?.provider === "google") {
          const { data: profile } = await supabase
            .from("profiles").select("id").eq("id", session.user.id).maybeSingle()
          if (!profile) {
            await supabase.auth.signOut()
            setError("No account found for this Google address. Please sign up with email & password first.")
            setCheckingSession(false)
            return
          }
        }
        if (event === "SIGNED_IN") router.push("/")
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // ── Sign Up ───────────────────────────────────────────────────
  const handleSignUp = async () => {
    setError(null); setSuccess(null); setWaError(""); setUnError("")

    // Client-side validation first
    if (!fullName.trim())    { setError("Full name is required."); return }
    const unErr = validateUsername(username)
    if (unErr)               { setUnError(unErr); return }
    const { valid, digitsOnly, error: waErr } = validateWhatsApp(whatsapp)
    if (!valid)              { setWaError(waErr); return }
    if (!school.trim())      { setError("School / University is required."); return }
    if (!email.trim())       { setError("Email address is required."); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Please enter a valid email address."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }

    setLoading(true)
    try {
      // ── Check username uniqueness ──
      const { data: existingUn } = await supabase
        .from("profiles").select("id").eq("username", username.trim().toLowerCase()).maybeSingle()
      if (existingUn) throw new Error("That username is already taken. Please choose another.")

      // ── Check WhatsApp uniqueness (numeric column) ──
      const { data: existingWa } = await supabase
        .from("profiles").select("id").eq("whatsapp_number", Number(digitsOnly)).maybeSingle()
      if (existingWa) throw new Error("This WhatsApp number is already linked to an account.")

      // ── Create auth user (Supabase handles email uniqueness natively) ──
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name:       fullName.trim(),
            username:        username.trim().toLowerCase(),
            whatsapp_number: digitsOnly,
            school:          school.trim(),
          },
        },
      })

      if (signUpErr) throw new Error(friendlyAuthError(signUpErr.message))

      // identities array is empty when email is a duplicate (Supabase doesn't error, it fakes success)
      if (authData.user && authData.user.identities?.length === 0) {
        throw new Error(
          "This email is already registered. Please sign in, or use Forgot Password if you forgot your password."
        )
      }

      if (!authData.user) throw new Error("Sign up failed. Please try again.")

      // ── Insert profile (whatsapp_number as Number for numeric column) ──
     const { error: insertErr } = await supabase.from("profiles").upsert({
  id:              authData.user.id,
  full_name:       fullName.trim(),
  username:        username.trim().toLowerCase(),
  whatsapp_number: Number(digitsOnly),
  school:          school.trim(),
}, { onConflict: "id" })  // ← merge on the id column

if (insertErr) throw new Error(insertErr.message)
      setSuccess("Account created! Check your email to confirm, then sign in.")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Sign In ───────────────────────────────────────────────────
  const handleSignIn = async () => {
    setError(null); setSuccess(null)
    if (!email.trim() || !password) { setError("Email and password are required."); return }
    setLoading(true)
    try {
      const { error: e } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      })
      if (e) throw new Error(friendlyAuthError(e.message))
      router.refresh(); router.push("/")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot Password ───────────────────────────────────────────
  const handleForgotPassword = async () => {
    setError(null); setSuccess(null)
    if (!email.trim()) { setError("Enter your email address first."); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Please enter a valid email address."); return }
    setLoading(true)
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` }
      )
      if (e) throw new Error(friendlyAuthError(e.message))
      setSuccess("Reset link sent! Check your inbox and spam folder.")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Google ────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  // ── Loading screen ────────────────────────────────────────────
  if (checkingSession) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 40%,#c2410c 100%)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:40, height:40, border:"3px solid rgba(255,255,255,0.3)", borderTopColor:"#f97316", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
    </div>
  )

  const headings: Record<Mode, { title: string; sub: string }> = {
    signin: { title: "Welcome back",   sub: "Sign in to your campus marketplace account" },
    signup: { title: "Join UniMart",   sub: "Create your free account today" },
    forgot: { title: "Reset Password", sub: "We'll send a reset link to your email" },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        input, select, textarea { font-size:16px !important; }

        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bgPulse { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

        .auth-page {
          min-height:100vh;
          background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 40%,#c2410c 100%);
          background-size:200% 200%; animation:bgPulse 10s ease infinite;
          display:flex; align-items:center; justify-content:center;
          padding:20px; font-family:'DM Sans',system-ui,sans-serif;
          position:relative; overflow:hidden;
        }
        .auth-page::before {
          content:''; position:absolute; inset:0;
          background:radial-gradient(ellipse at 70% 30%,rgba(251,146,60,0.18) 0%,transparent 60%),
                     radial-gradient(ellipse at 20% 80%,rgba(99,102,241,0.15) 0%,transparent 60%);
          pointer-events:none;
        }
        .auth-card {
          background:white; border-radius:28px; width:100%; max-width:460px;
          box-shadow:0 32px 100px rgba(13,29,110,0.35);
          animation:fadeUp 0.5s ease forwards; overflow:hidden; position:relative; z-index:1;
        }
        .card-header {
          background:linear-gradient(135deg,#0f1f6e 0%,#162380 100%);
          padding:32px 36px 28px; text-align:center; position:relative;
        }
        .card-header::after {
          content:''; position:absolute; bottom:-1px; left:0; right:0;
          height:28px; background:white; border-radius:50% 50% 0 0 / 28px 28px 0 0;
        }
        .card-body { padding:8px 36px 28px; }

        .mode-tabs { display:flex; background:#f1f5f9; border-radius:12px; padding:4px; margin-bottom:22px; }
        .tab-btn { flex:1; padding:9px; border-radius:9px; border:none; font-family:'DM Sans',system-ui,sans-serif; font-weight:600; font-size:0.85rem; cursor:pointer; transition:all 0.2s; background:transparent; color:#64748b; }
        .tab-btn.active { background:white; color:#0f1f6e; box-shadow:0 2px 8px rgba(13,29,110,0.12); }

        .input-group { margin-bottom:13px; }
        .input-label { display:block; font-size:0.72rem; font-weight:700; color:#0f1f6e; letter-spacing:0.07em; text-transform:uppercase; margin-bottom:5px; }
        .input-field {
          width:100%; padding:12px 16px; border:1.5px solid #e2e8f0; border-radius:12px;
          font-family:'DM Sans',system-ui,sans-serif; color:#1e293b; background:#f8fafc;
          outline:none; transition:border-color .2s,box-shadow .2s,background .2s;
        }
        .input-field:focus { border-color:#f97316; background:white; box-shadow:0 0 0 3px rgba(249,115,22,0.12); }
        .input-field::placeholder { color:#94a3b8; }
        .input-field.err { border-color:#ef4444; background:#fff8f8; }
        .input-field.err:focus { border-color:#ef4444; box-shadow:0 0 0 3px rgba(239,68,68,0.1); }
        .field-err  { font-size:0.72rem; color:#dc2626; margin-top:4px; display:flex; align-items:flex-start; gap:4px; font-family:'DM Sans',sans-serif; animation:slideIn .2s ease; line-height:1.45; }
        .field-hint { font-size:0.69rem; color:#94a3b8; margin-top:4px; font-family:'DM Sans',sans-serif; line-height:1.45; }

        .wa-valid { font-size:0.69rem; color:#16a34a; margin-top:4px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:4px; }

        .password-wrap { position:relative; }
        .password-wrap .input-field { padding-right:48px; }
        .eye-btn { position:absolute; right:14px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#94a3b8; display:flex; padding:0; transition:color .2s; }
        .eye-btn:hover { color:#f97316; }

        .submit-btn {
          width:100%; padding:14px; background:linear-gradient(135deg,#ea580c,#f97316);
          color:white; border:none; border-radius:14px;
          font-family:'DM Sans',system-ui,sans-serif; font-size:0.95rem; font-weight:700;
          cursor:pointer; transition:all .2s; box-shadow:0 4px 16px rgba(234,88,12,0.3); margin-top:4px;
        }
        .submit-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(234,88,12,0.4); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }

        .forgot-link { display:block; text-align:center; font-size:0.78rem; color:#64748b; font-family:'DM Sans',sans-serif; margin-top:12px; cursor:pointer; transition:color .2s; }
        .forgot-link:hover { color:#f97316; }

        .back-link { display:inline-flex; align-items:center; gap:5px; font-size:0.78rem; color:#64748b; font-family:'DM Sans',sans-serif; cursor:pointer; margin-bottom:16px; transition:color .2s; border:none; background:none; padding:0; }
        .back-link:hover { color:#0f1f6e; }

        .forgot-box { background:linear-gradient(135deg,#eef2ff,#e0e7ff); border:1.5px solid #c7d2fe; border-radius:14px; padding:14px 16px; margin-bottom:18px; }
        .forgot-box p { font-size:0.82rem; color:#0f1f6e; font-family:'DM Sans',sans-serif; line-height:1.6; }

        .divider { display:flex; align-items:center; gap:12px; margin:20px 0; }
        .divider::before,.divider::after { content:''; flex:1; height:1px; background:#e2e8f0; }
        .divider span { font-size:0.75rem; color:#94a3b8; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; }

        .google-btn {
          width:100%; padding:12px; background:white; color:#1e293b;
          border:1.5px solid #e2e8f0; border-radius:14px;
          font-family:'DM Sans',system-ui,sans-serif; font-size:0.9rem; font-weight:600;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; transition:all .2s;
        }
        .google-btn:hover { border-color:#cbd5e1; background:#f8fafc; box-shadow:0 2px 10px rgba(0,0,0,0.06); }
        .google-note { text-align:center; font-size:0.72rem; color:#94a3b8; margin-top:8px; line-height:1.5; }

        .error-box { background:#fff1f0; border:1px solid #fca5a5; border-radius:10px; padding:10px 14px; font-size:0.82rem; color:#dc2626; margin-bottom:14px; display:flex; align-items:flex-start; gap:8px; line-height:1.55; animation:slideIn .2s ease; }
        .success-box { background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:10px 14px; font-size:0.82rem; color:#16a34a; margin-bottom:14px; display:flex; align-items:flex-start; gap:8px; line-height:1.55; animation:slideIn .2s ease; }

        .spinner { width:18px; height:18px; border:2.5px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; }
        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .terms-row { text-align:center; font-size:0.75rem; color:#94a3b8; margin-top:16px; line-height:1.6; }
        .terms-row a { color:#f97316; text-decoration:none; font-weight:600; }

        .lytrix-footer { display:flex; align-items:center; justify-content:center; gap:8px; margin-top:18px; padding-top:16px; border-top:1px dashed #e9eef5; }
        .lytrix-label { font-size:0.68rem; font-weight:500; color:#b0bec5; letter-spacing:0.08em; text-transform:uppercase; }
        .lytrix-badge { display:inline-flex; align-items:center; gap:6px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:20px; padding:4px 11px 4px 5px; text-decoration:none; transition:border-color .2s,box-shadow .2s,background .2s; }
        .lytrix-badge:hover { border-color:#f97316; background:#fff7f0; box-shadow:0 2px 10px rgba(249,115,22,0.14); }
        .lytrix-icon { width:22px; height:22px; background:linear-gradient(135deg,#f97316,#ea580c); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:white; font-family:'Playfair Display',serif; flex-shrink:0; }
        .lytrix-name { font-size:0.76rem; font-weight:700; color:#334155; font-family:'DM Sans',sans-serif; }
        .lytrix-name span { color:#f97316; }

        @media(max-width:480px) {
          .card-header { padding:28px 24px 24px; }
          .card-body   { padding:8px 24px 24px; }
          .two-col     { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="auth-page">
        <div className="auth-card">

          {/* Header */}
          <div className="card-header">
            <img src="../Unimart.png" alt="UniMart" style={{ width:72, height:72, objectFit:"contain", margin:"0 auto 12px", display:"block" }} />
            <h1 style={{ fontFamily:"'Playfair Display',serif", color:"white", fontWeight:800, fontSize:"1.5rem", marginBottom:4 }}>
              {headings[mode].title}
            </h1>
            <p style={{ color:"rgba(255,255,255,0.65)", fontSize:"0.83rem", fontWeight:500 }}>
              {headings[mode].sub}
            </p>
          </div>

          {/* Body */}
          <div className="card-body">

            {/* Tabs */}
            {mode !== "forgot" && (
              <div className="mode-tabs">
                <button className={`tab-btn ${mode === "signin" ? "active" : ""}`} onClick={() => switchMode("signin")}>Sign In</button>
                <button className={`tab-btn ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>Sign Up</button>
              </div>
            )}

            {mode === "forgot" && (
              <button className="back-link" onClick={() => switchMode("signin")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Sign In
              </button>
            )}

            {/* Alerts */}
            {error && (
              <div className="error-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}
            {success && (
              <div className="success-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {success}
              </div>
            )}

            {/* ── FORGOT MODE ── */}
            {mode === "forgot" && (
              <>
                <div className="forgot-box">
                  <p>Enter the email linked to your UniMart account and we will send you a password reset link.</p>
                </div>
                <div className="input-group">
                  <label className="input-label">Email Address</label>
                  <input
                    className="input-field" type="email" placeholder="akosuaadu@gmail.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                  />
                </div>
                <button className="submit-btn" onClick={handleForgotPassword} disabled={loading || !!success}>
                  {loading ? <span className="spinner" /> : "Send Reset Link →"}
                </button>
              </>
            )}

            {/* ── SIGN UP EXTRA FIELDS ── */}
            {mode === "signup" && (
              <>
                <div className="two-col">
                  <div className="input-group">
                    <label className="input-label">Full Name</label>
                    <input className="input-field" type="text" placeholder="Akosua Adu" value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Username</label>
                    <input
                      className={`input-field ${unError ? "err" : ""}`}
                      type="text" placeholder="akosua_adu"
                      value={username}
                      onChange={e => { setUsername(e.target.value); setUnError("") }}
                      onBlur={() => setUnError(validateUsername(username))}
                    />
                    {unError
                      ? <div className="field-err"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{unError}</div>
                      : <div className="field-hint">Letters, numbers, underscores only</div>
                    }
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="input-group">
                  <label className="input-label">WhatsApp Number</label>
                  <input
                    className={`input-field ${waError ? "err" : ""}`}
                    type="tel"
                    placeholder="233000000000"
                    value={whatsapp}
                    onChange={e => { setWhatsapp(e.target.value); setWaError("") }}
                    onBlur={() => {
                      if (whatsapp.trim()) {
                        const { valid, error: e } = validateWhatsApp(whatsapp)
                        if (!valid) setWaError(e)
                      }
                    }}
                  />
                  {waError ? (
                    <div className="field-err">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0,marginTop:2}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {waError}
                    </div>
                  ) : whatsapp && validateWhatsApp(whatsapp).valid ? (
                    <div className="wa-valid">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      Looks like a valid WhatsApp number
                    </div>
                  ) : (
                    <div className="field-hint">Digits only with country code — no spaces, dashes or + sign (e.g. 233594518462)</div>
                  )}
                </div>

                {/* School */}
                <div className="input-group">
                  <label className="input-label">School / University</label>
                  <input className="input-field" type="text" placeholder="e.g. KNUST, UG, Ashesi…" value={school} onChange={e => setSchool(e.target.value)} />
                </div>
              </>
            )}

            {/* ── EMAIL + PASSWORD (signin & signup) ── */}
            {mode !== "forgot" && (
              <>
                <div className="input-group">
                  <label className="input-label">Email Address</label>
                  <input
                    className="input-field" type="email" placeholder="akosuaadu@gmail.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (mode === "signin" ? handleSignIn() : handleSignUp())}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Password</label>
                  <div className="password-wrap">
                    <input
                      className="input-field"
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "signup" ? "Min. 6 characters" : "Enter your password"}
                      value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (mode === "signin" ? handleSignIn() : handleSignUp())}
                    />
                    <button className="eye-btn" onClick={() => setShowPassword(v => !v)} type="button" tabIndex={-1}>
                      {showPassword
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <button
                  className="submit-btn"
                  onClick={mode === "signin" ? handleSignIn : handleSignUp}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : mode === "signin" ? "Sign In →" : "Create Account →"}
                </button>

                {mode === "signin" && (
                  <span className="forgot-link" onClick={() => switchMode("forgot")}>
                    Forgot your password?
                  </span>
                )}

                {mode === "signin" && (
                  <>
                    <div className="divider"><span>or</span></div>
                    <button className="google-btn" onClick={handleGoogle}>
                      <svg width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        <path fill="none" d="M0 0h48v48H0z"/>
                      </svg>
                      Continue with Google
                    </button>
                    <p className="google-note">Google sign-in is for existing accounts only.</p>
                  </>
                )}
              </>
            )}

            <p className="terms-row">
              By continuing you agree to UniMart's <a href="/legal">Terms</a> &amp; <a href="/legal">Privacy Policy</a>
            </p>

            <div className="lytrix-footer">
              <span className="lytrix-label">Powered by</span>
              <a href="https://lytrixconsult.com" target="_blank" rel="noopener noreferrer" className="lytrix-badge">
                <img src="../ELIA LOGO.png" alt="" className=""  width="30px"/>
                <span className="lytrix-name">Lytrix Consult</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}