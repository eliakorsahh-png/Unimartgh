"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

// ── Password strength ─────────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#e2e8f0" }
  let score = 0
  if (pw.length >= 8)                    score++
  if (pw.length >= 12)                   score++
  if (/[A-Z]/.test(pw))                  score++
  if (/[0-9]/.test(pw))                  score++
  if (/[^A-Za-z0-9]/.test(pw))          score++
  if (score <= 1) return { score, label: "Weak",   color: "#ef4444" }
  if (score <= 3) return { score, label: "Fair",   color: "#f97316" }
  if (score === 4) return { score, label: "Good",   color: "#3b82f6" }
  return               { score, label: "Strong", color: "#16a34a" }
}

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword]           = useState("")
  const [confirm, setConfirm]             = useState("")
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)
  const [sessionReady, setSessionReady]   = useState(false)
  const [sessionError, setSessionError]   = useState(false)

  const strength = getStrength(password)
  const strengthPct = Math.round((strength.score / 5) * 100)

  // ── Wait for Supabase to exchange the reset token from the URL hash ──
  useEffect(() => {
    // onAuthStateChange fires with PASSWORD_RECOVERY when the magic link is used
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true)
      }
    })

    // Also check if there's already an active session (user landed here with a valid token)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    // If no recovery event fires within 4s, the link is likely expired/invalid
    const timeout = setTimeout(() => {
      setSessionReady(prev => {
        if (!prev) setSessionError(true)
        return prev
      })
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleReset = async () => {
    setError(null)
    if (password.length < 6)      { setError("Password must be at least 6 characters."); return }
    if (strength.score < 2)       { setError("Password is too weak. Add uppercase letters, numbers or symbols."); return }
    if (password !== confirm)     { setError("Passwords do not match."); return }

    setLoading(true)
    try {
      const { error: e } = await supabase.auth.updateUser({ password })
      if (e) throw e
      setSuccess(true)
      setTimeout(() => router.push("/login"), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-size: 16px !important; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bgPulse { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop     { 0% { transform: scale(0.8); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }

        .rp-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f1f6e 0%, #1a2a9a 40%, #c2410c 100%);
          background-size: 200% 200%; animation: bgPulse 10s ease infinite;
          display: flex; align-items: center; justify-content: center;
          padding: 20px; font-family: 'DM Sans', system-ui, sans-serif;
          position: relative; overflow: hidden;
        }
        .rp-page::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 70% 30%, rgba(251,146,60,0.18) 0%, transparent 60%),
            radial-gradient(ellipse at 20% 80%, rgba(99,102,241,0.15) 0%, transparent 60%);
          pointer-events: none;
        }

        .rp-card {
          background: white; border-radius: 28px; width: 100%; max-width: 460px;
          box-shadow: 0 32px 100px rgba(13,29,110,0.35);
          animation: fadeUp 0.5s ease forwards; overflow: hidden; position: relative; z-index: 1;
        }

        .rp-header {
          background: linear-gradient(135deg, #0f1f6e 0%, #162380 100%);
          padding: 32px 36px 28px; text-align: center; position: relative;
        }
        .rp-header::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
          height: 28px; background: white; border-radius: 50% 50% 0 0 / 28px 28px 0 0;
        }

        .rp-body { padding: 8px 36px 32px; }

        .input-group  { margin-bottom: 14px; }
        .input-label  { display: block; font-size: 0.72rem; font-weight: 700; color: #0f1f6e; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 5px; }
        .input-field  {
          width: 100%; padding: 12px 16px; border: 1.5px solid #e2e8f0; border-radius: 12px;
          font-family: 'DM Sans', system-ui, sans-serif; color: #1e293b; background: #f8fafc;
          outline: none; transition: border-color .2s, box-shadow .2s, background .2s;
        }
        .input-field:focus { border-color: #f97316; background: white; box-shadow: 0 0 0 3px rgba(249,115,22,0.12); }
        .input-field::placeholder { color: #94a3b8; }
        .input-field.err { border-color: #ef4444; background: #fff8f8; }
        .input-field.ok  { border-color: #22c55e; background: #f0fdf4; }

        .pw-wrap { position: relative; }
        .pw-wrap .input-field { padding-right: 48px; }
        .eye-btn {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #94a3b8;
          display: flex; padding: 0; transition: color .2s;
        }
        .eye-btn:hover { color: #f97316; }

        /* Strength bar */
        .strength-wrap { margin-top: 8px; }
        .strength-bars { display: flex; gap: 4px; margin-bottom: 5px; }
        .strength-bar  { flex: 1; height: 4px; border-radius: 99px; background: #e2e8f0; transition: background .3s; }
        .strength-label { font-size: 0.7rem; font-weight: 700; font-family: 'DM Sans', sans-serif; transition: color .3s; }

        /* Match indicator */
        .match-hint { font-size: 0.71rem; margin-top: 5px; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; gap: 4px; animation: slideIn .2s ease; }

        .submit-btn {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #ea580c, #f97316);
          color: white; border: none; border-radius: 14px;
          font-family: 'DM Sans', system-ui, sans-serif; font-size: 0.95rem; font-weight: 700;
          cursor: pointer; transition: all .2s; box-shadow: 0 4px 16px rgba(234,88,12,0.3); margin-top: 6px;
        }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(234,88,12,0.4); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .error-box {
          background: #fff1f0; border: 1px solid #fca5a5; border-radius: 10px;
          padding: 10px 14px; font-size: 0.82rem; color: #dc2626; margin-bottom: 14px;
          display: flex; align-items: flex-start; gap: 8px; line-height: 1.5; animation: slideIn .2s ease;
        }

        /* Success state */
        .success-wrap {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 16px 0 8px; gap: 14px;
          animation: pop 0.4s ease forwards;
        }
        .success-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, #16a34a, #4ade80);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 28px rgba(22,163,74,0.35);
        }
        .success-icon svg { color: white; }
        .redirect-bar {
          width: 100%; height: 4px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-top: 4px;
        }
        .redirect-fill {
          height: 100%; background: linear-gradient(90deg, #16a34a, #4ade80);
          border-radius: 99px; animation: shrink 3s linear forwards;
        }
        @keyframes shrink { from { width: 100%; } to { width: 0%; } }

        /* Expired state */
        .expired-wrap {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 16px 0 8px; gap: 14px;
          animation: pop 0.4s ease forwards;
        }
        .expired-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, #dc2626, #f87171);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 28px rgba(220,38,38,0.28);
        }
        .back-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 12px 24px; background: linear-gradient(135deg, #0f1f6e, #162380);
          color: white; border: none; border-radius: 14px;
          font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 700;
          cursor: pointer; text-decoration: none; transition: all .2s;
        }
        .back-btn:hover { background: linear-gradient(135deg, #f97316, #ea580c); }

        .lytrix-footer { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 22px; padding-top: 16px; border-top: 1px dashed #e9eef5; }
        .lytrix-label  { font-size: 0.68rem; font-weight: 500; color: #b0bec5; letter-spacing: 0.08em; text-transform: uppercase; }
        .lytrix-badge  { display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 20px; padding: 4px 11px 4px 5px; text-decoration: none; transition: border-color .2s, box-shadow .2s, background .2s; }
        .lytrix-badge:hover { border-color: #f97316; background: #fff7f0; box-shadow: 0 2px 10px rgba(249,115,22,0.14); }
        .lytrix-icon   { width: 22px; height: 22px; background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: white; font-family: 'Playfair Display', serif; flex-shrink: 0; }
        .lytrix-name   { font-size: 0.76rem; font-weight: 700; color: #334155; font-family: 'DM Sans', sans-serif; }
        .lytrix-name span { color: #f97316; }

        .spinner { width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }

        @media (max-width: 480px) {
          .rp-header { padding: 28px 24px 24px; }
          .rp-body   { padding: 8px 24px 28px; }
        }
      `}</style>

      <div className="rp-page">
        <div className="rp-card">

          {/* ── Header ── */}
          <div className="rp-header">
            <a href="/">
              <img src="/Unimart.png" alt="UniMart" style={{ width: 64, height: 64, objectFit: "contain", margin: "0 auto 12px", display: "block" }} />
            </a>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "white", fontWeight: 800, fontSize: "1.5rem", marginBottom: 4 }}>
              {success ? "Password Updated!" : sessionError ? "Link Expired" : "Set New Password"}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.83rem", fontWeight: 500 }}>
              {success ? "You're all set — redirecting to sign in" : sessionError ? "This reset link is no longer valid" : "Choose a strong password for your account"}
            </p>
          </div>

          {/* ── Body ── */}
          <div className="rp-body">

            {/* ── SUCCESS ── */}
            {success && (
              <div className="success-wrap">
                <div className="success-icon">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.1rem", color: "#0f1f6e" }}>
                  Password changed successfully
                </p>
                <p style={{ fontSize: "0.83rem", color: "#64748b", lineHeight: 1.6, maxWidth: 300 }}>
                  Redirecting you to the sign in page in a moment…
                </p>
                <div className="redirect-bar"><div className="redirect-fill" /></div>
                <a href="/login" className="back-btn">
                  Sign In Now →
                </a>
              </div>
            )}

            {/* ── EXPIRED / INVALID LINK ── */}
            {!success && sessionError && (
              <div className="expired-wrap">
                <div className="expired-icon">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.1rem", color: "#0f1f6e" }}>
                  Reset link expired
                </p>
                <p style={{ fontSize: "0.83rem", color: "#64748b", lineHeight: 1.6, maxWidth: 300 }}>
                  Password reset links are only valid for a short time. Please request a new one from the login page.
                </p>
                <a href="/login" className="back-btn">
                  ← Back to Sign In
                </a>
              </div>
            )}

            {/* ── FORM ── */}
            {!success && !sessionError && (
              <>
                {/* Waiting for session token */}
                {!sessionReady && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "24px 0", color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'DM Sans', sans-serif" }}>
                    <div style={{ width: 20, height: 20, border: "2.5px solid #e2e8f0", borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Verifying your reset link…
                  </div>
                )}

                {sessionReady && (
                  <>
                    {error && (
                      <div className="error-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {error}
                      </div>
                    )}

                    {/* New password */}
                    <div className="input-group">
                      <label className="input-label">New Password</label>
                      <div className="pw-wrap">
                        <input
                          className={`input-field ${password && strength.score < 2 ? "err" : password && strength.score >= 2 ? "ok" : ""}`}
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          value={password}
                          onChange={e => { setPassword(e.target.value); setError(null) }}
                          onKeyDown={e => e.key === "Enter" && handleReset()}
                          autoComplete="new-password"
                        />
                        <button className="eye-btn" onClick={() => setShowPassword(v => !v)} type="button" tabIndex={-1}>
                          {showPassword
                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                      </div>

                      {/* Strength bars */}
                      {password && (
                        <div className="strength-wrap">
                          <div className="strength-bars">
                            {[1,2,3,4,5].map(i => (
                              <div
                                key={i}
                                className="strength-bar"
                                style={{ background: i <= strength.score ? strength.color : "#e2e8f0" }}
                              />
                            ))}
                          </div>
                          <span className="strength-label" style={{ color: strength.color }}>
                            {strength.label} password
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Confirm password */}
                    <div className="input-group">
                      <label className="input-label">Confirm Password</label>
                      <div className="pw-wrap">
                        <input
                          className={`input-field ${confirm && confirm !== password ? "err" : confirm && confirm === password ? "ok" : ""}`}
                          type={showConfirm ? "text" : "password"}
                          placeholder="Re-enter your password"
                          value={confirm}
                          onChange={e => { setConfirm(e.target.value); setError(null) }}
                          onKeyDown={e => e.key === "Enter" && handleReset()}
                          autoComplete="new-password"
                        />
                        <button className="eye-btn" onClick={() => setShowConfirm(v => !v)} type="button" tabIndex={-1}>
                          {showConfirm
                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                      </div>

                      {/* Match hint */}
                      {confirm && (
                        <div className="match-hint" style={{ color: confirm === password ? "#16a34a" : "#dc2626" }}>
                          {confirm === password
                            ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Passwords match</>
                            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Passwords do not match</>
                          }
                        </div>
                      )}
                    </div>

                    {/* Tips box */}
                    <div style={{ background: "#f0f4ff", border: "1.5px solid #c7d2fe", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                      <p style={{ fontSize: "0.73rem", color: "#4338ca", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
                        Strong password tips
                      </p>
                      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                        {[
                          ["8+ characters", password.length >= 8],
                          ["One uppercase letter", /[A-Z]/.test(password)],
                          ["One number", /[0-9]/.test(password)],
                          ["One symbol (!@#$…)", /[^A-Za-z0-9]/.test(password)],
                        ].map(([tip, met]) => (
                          <li key={tip as string} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", fontFamily: "'DM Sans', sans-serif", color: met ? "#16a34a" : "#94a3b8" }}>
                            {met
                              ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="3"><circle cx="12" cy="12" r="9"/></svg>
                            }
                            {tip as string}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      className="submit-btn"
                      onClick={handleReset}
                      disabled={loading || !password || !confirm}
                    >
                      {loading ? <span className="spinner" /> : "Update Password →"}
                    </button>

                    <a href="/login" style={{ display: "block", textAlign: "center", fontSize: "0.78rem", color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginTop: 14, textDecoration: "none", transition: "color .2s" }}
                      onMouseOver={e => (e.currentTarget.style.color = "#f97316")}
                      onMouseOut={e => (e.currentTarget.style.color = "#94a3b8")}
                    >
                      ← Back to Sign In
                    </a>
                  </>
                )}
              </>
            )}

            {/* Footer */}
            <div className="lytrix-footer">
              <span className="lytrix-label">Powered by</span>
              <a href="https://lytrixconsult.com" target="_blank" rel="noopener noreferrer" className="lytrix-badge">
                <img src="../ELIA LOGO.png" alt="" width="25px" />
                <span className="lytrix-name">Lytrix <span>Consult</span></span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}