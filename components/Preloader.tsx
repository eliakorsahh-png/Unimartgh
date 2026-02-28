"use client"

import { useEffect, useState, useRef, useMemo } from "react"

interface PreloaderProps {
  onComplete?: () => void
  duration?: number // ms — total time before exit, default 3200
}

export default function Preloader({ onComplete, duration = 3200 }: PreloaderProps) {
  const [phase, setPhase]       = useState<"enter" | "loading" | "exit">("enter")
  const [count, setCount]       = useState(0)
  const [barW, setBarW]         = useState(0)
  const [done, setDone]         = useState(false)
  const [particleCSS, setParticleCSS] = useState<string | null>(null)
  const rafRef                  = useRef<number | null>(null)

  // ── Generate particle CSS client-side only (avoids SSR hydration mismatch) ──
  useEffect(() => {
    const css = Array.from({ length: 20 }, (_, i) => {
      const size  = Math.random() * 4 + 2
      const left  = Math.random() * 100
      const delay = Math.random() * 4
      const dur   = Math.random() * 6 + 4
      const col   = i % 3 === 0 ? "#f97316" : i % 3 === 1 ? "#818cf8" : "rgba(255,255,255,0.6)"
      return `.pl-p${i} { width:${size}px; height:${size}px; left:${left}%; bottom:-10px; background:${col}; animation-duration:${dur}s; animation-delay:${delay}s; box-shadow: 0 0 ${size * 2}px ${col}; }`
    }).join("\n")
    setParticleCSS(css)
  }, [])

  // ── Phase sequencer ──────────────────────────────────────────
  useEffect(() => {
    // Phase 1 → loading after logo settles
    const t1 = setTimeout(() => setPhase("loading"), 900)
    // Phase 2 → start exit wipe
    const t2 = setTimeout(() => setPhase("exit"),   duration)
    // Phase 3 → unmount
    const t3 = setTimeout(() => {
      setDone(true)
      onComplete?.()
    }, duration + 700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [duration, onComplete])

  // ── Animated counter & progress bar ─────────────────────────
  useEffect(() => {
    if (phase !== "loading") return
    const loadTime   = duration - 900          // ms available for loading phase
    const startTime  = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const pct     = Math.min(elapsed / loadTime, 1)
      // Ease-out curve so it slows at the end
      const eased   = 1 - Math.pow(1 - pct, 2.5)
      setCount(Math.floor(eased * 100))
      setBarW(eased * 100)
      if (pct < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [phase, duration])

  if (done) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800;900&family=DM+Sans:wght@300;400;600;700&family=DM+Mono:wght@400;500&display=swap');

        /* ── RESET & BASE ───────────────────────────────────── */
        .pl-root *, .pl-root *::before, .pl-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── CONTAINER ──────────────────────────────────────── */
        .pl-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          background: #060d2e;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── MESH BACKGROUND ────────────────────────────────── */
        .pl-mesh {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 80% 60% at 20% 80%, rgba(249,115,22,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 80% 20%, rgba(26,42,154,0.55) 0%, transparent 55%),
            radial-gradient(ellipse 100% 80% at 50% 50%, rgba(15,31,110,0.6) 0%, transparent 70%);
          animation: meshShift 4s ease-in-out infinite alternate;
        }
        @keyframes meshShift {
          from { opacity: 0.7; }
          to   { opacity: 1; }
        }

        /* ── GRID OVERLAY ───────────────────────────────────── */
        .pl-grid {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.035;
          background-image:
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: gridPan 12s linear infinite;
        }
        @keyframes gridPan {
          from { background-position: 0 0; }
          to   { background-position: 60px 60px; }
        }

        /* ── SCANLINES ──────────────────────────────────────── */
        .pl-scan {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.06) 3px,
            rgba(0,0,0,0.06) 4px
          );
        }

        /* ── ORBITS ─────────────────────────────────────────── */
        .pl-orbits {
          position: absolute;
          width: 340px; height: 340px;
          animation: orbitsFadeIn 0.6s 0.3s ease both;
        }
        @keyframes orbitsFadeIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }

        .pl-orbit {
          position: absolute; border-radius: 50%;
          border: 1px solid transparent;
          top: 50%; left: 50%;
          transform-origin: center center;
        }
        .pl-orbit-1 {
          width: 220px; height: 220px;
          margin: -110px 0 0 -110px;
          border-color: rgba(249,115,22,0.25);
          animation: spin1 5s linear infinite;
        }
        .pl-orbit-2 {
          width: 290px; height: 290px;
          margin: -145px 0 0 -145px;
          border-color: rgba(99,102,241,0.18);
          animation: spin2 8s linear infinite reverse;
        }
        .pl-orbit-3 {
          width: 340px; height: 340px;
          margin: -170px 0 0 -170px;
          border-color: rgba(255,255,255,0.06);
          animation: spin1 13s linear infinite;
        }
        @keyframes spin1 { to { transform: rotate(360deg); } }
        @keyframes spin2 { to { transform: rotate(-360deg); } }

        /* Orbit dots */
        .pl-dot {
          position: absolute; border-radius: 50%;
          top: 50%; left: 50%;
        }
        .pl-dot-1 {
          width: 8px; height: 8px; margin: -4px 0 0 -4px;
          background: #f97316;
          box-shadow: 0 0 12px 4px rgba(249,115,22,0.7);
          transform: translateX(110px);
          animation: spin1 5s linear infinite;
        }
        .pl-dot-2 {
          width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px;
          background: #818cf8;
          box-shadow: 0 0 8px 3px rgba(129,140,248,0.6);
          transform: translateX(-145px);
          animation: spin2 8s linear infinite reverse;
        }
        .pl-dot-3 {
          width: 4px; height: 4px; margin: -2px 0 0 -2px;
          background: rgba(255,255,255,0.6);
          transform: translateY(-110px);
          animation: spin1 5s linear infinite;
        }

        /* ── CENTER LOGO ────────────────────────────────────── */
        .pl-center {
          position: relative; z-index: 2;
          display: flex; flex-direction: column;
          align-items: center; gap: 0;
        }

        /* Logo glow ring */
        .pl-logo-wrap {
          position: relative;
          animation: logoEnter 0.7s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes logoEnter {
          from { opacity: 0; transform: scale(0.3) rotate(-20deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        .pl-glow-ring {
          position: absolute; inset: -18px; border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            #f97316, #ea580c, #0f1f6e, #1a2a9a, #f97316
          );
          animation: ringRotate 2s linear infinite;
          filter: blur(2px);
          opacity: 0.8;
        }
        @keyframes ringRotate { to { transform: rotate(360deg); } }

        .pl-glow-ring-mask {
          position: absolute; inset: -14px; border-radius: 50%;
          background: #060d2e;
        }

        .pl-logo-img {
          width: 96px; height: 96px;
          border-radius: 50%;
          object-fit: contain;
          position: relative; z-index: 1;
          filter: drop-shadow(0 0 24px rgba(249,115,22,0.5));
          animation: logoPulse 2s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%,100% { filter: drop-shadow(0 0 24px rgba(249,115,22,0.5)); }
          50%      { filter: drop-shadow(0 0 40px rgba(249,115,22,0.85)) drop-shadow(0 0 80px rgba(249,115,22,0.3)); }
        }

        /* ── BRAND NAME ─────────────────────────────────────── */
        .pl-brand {
          margin-top: 32px;
          font-family: 'Playfair Display', serif;
          font-size: 3rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: white;
          line-height: 1;
          animation: brandReveal 0.8s 0.5s cubic-bezier(0.16,1,0.3,1) both;
          position: relative;
        }
        .pl-brand span { color: #f97316; }
        @keyframes brandReveal {
          from { opacity: 0; transform: translateY(28px) skewY(4deg); clip-path: inset(100% 0 0 0); }
          to   { opacity: 1; transform: translateY(0) skewY(0deg);    clip-path: inset(0% 0 0 0); }
        }

        /* Underline accent */
        .pl-brand-line {
          display: block;
          height: 3px;
          background: linear-gradient(90deg, #f97316, transparent);
          margin-top: 8px;
          border-radius: 2px;
          animation: lineGrow 0.6s 1.1s ease both;
        }
        @keyframes lineGrow {
          from { width: 0; opacity: 0; }
          to   { width: 100%; opacity: 1; }
        }

        /* ── TAGLINE ────────────────────────────────────────── */
        .pl-tagline {
          margin-top: 10px;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.38);
          animation: taglineIn 0.5s 1.3s ease both;
        }
        @keyframes taglineIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── PROGRESS SECTION ───────────────────────────────── */
        .pl-progress-wrap {
          margin-top: 44px;
          width: 260px;
          animation: progressIn 0.4s 0.9s ease both;
        }
        @keyframes progressIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .pl-progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .pl-status-text {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          font-family: 'DM Mono', monospace;
        }
        .pl-counter {
          font-family: 'DM Mono', monospace;
          font-size: 0.8rem;
          font-weight: 500;
          color: #f97316;
          min-width: 38px;
          text-align: right;
        }

        /* Track */
        .pl-bar-track {
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 99px;
          overflow: hidden;
          position: relative;
        }
        /* Glowing fill */
        .pl-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #0f1f6e, #f97316, #ea580c);
          background-size: 200% 100%;
          position: relative;
          transition: width 0.05s linear;
          animation: barShimmer 1.5s linear infinite;
          box-shadow: 0 0 12px rgba(249,115,22,0.6);
        }
        @keyframes barShimmer {
          from { background-position: 100% 0; }
          to   { background-position: -100% 0; }
        }

        /* Tick marks */
        .pl-ticks {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          padding: 0 2px;
        }
        .pl-tick {
          width: 1px; height: 4px;
          background: rgba(255,255,255,0.12);
          border-radius: 1px;
        }

        /* ── FLOATING PARTICLES ─────────────────────────────── */
        .pl-particles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .pl-particle {
          position: absolute;
          border-radius: 50%;
          animation: particleFloat linear infinite;
          opacity: 0;
        }
        @keyframes particleFloat {
          0%   { opacity: 0;    transform: translateY(0) scale(0); }
          10%  { opacity: 0.8; }
          90%  { opacity: 0.4; }
          100% { opacity: 0;    transform: translateY(-100vh) scale(1.5); }
        }

        /* ── CORNER DECORATORS ──────────────────────────────── */
        .pl-corner {
          position: absolute;
          width: 48px; height: 48px;
          pointer-events: none;
          opacity: 0.25;
          animation: cornerFade 0.6s 0.8s ease both;
        }
        @keyframes cornerFade { from { opacity: 0; } to { opacity: 0.25; } }
        .pl-corner-tl { top: 24px; left: 24px; border-top: 2px solid #f97316; border-left: 2px solid #f97316; }
        .pl-corner-tr { top: 24px; right: 24px; border-top: 2px solid #f97316; border-right: 2px solid #f97316; }
        .pl-corner-bl { bottom: 24px; left: 24px; border-bottom: 2px solid #f97316; border-left: 2px solid #f97316; }
        .pl-corner-br { bottom: 24px; right: 24px; border-bottom: 2px solid #f97316; border-right: 2px solid #f97316; }

        /* ── EXIT ANIMATION ─────────────────────────────────── */
        .pl-root.pl-exit {
          animation: exitWipe 0.65s cubic-bezier(0.76,0,0.24,1) forwards;
        }
        @keyframes exitWipe {
          0%   { clip-path: inset(0 0 0 0); opacity: 1; }
          100% { clip-path: inset(0 0 100% 0); opacity: 0.4; }
        }

        /* ── LOADING DOTS ───────────────────────────────────── */
        .pl-dots {
          display: flex; gap: 6px; margin-top: 18px;
          animation: taglineIn 0.4s 1.4s ease both;
        }
        .pl-dot-sm {
          width: 5px; height: 5px; border-radius: 50%;
          background: rgba(249,115,22,0.5);
          animation: dotBounce 1.2s ease-in-out infinite;
        }
        .pl-dot-sm:nth-child(1) { animation-delay: 0s; }
        .pl-dot-sm:nth-child(2) { animation-delay: 0.15s; }
        .pl-dot-sm:nth-child(3) { animation-delay: 0.3s; }
        @keyframes dotBounce {
          0%,80%,100% { transform: scale(1);   opacity: 0.5; }
          40%          { transform: scale(1.6); opacity: 1;   background: #f97316; }
        }

        /* ── FLASH ON EXIT ──────────────────────────────────── */
        .pl-flash {
          position: absolute; inset: 0;
          background: white;
          opacity: 0; pointer-events: none;
          animation: none;
        }
        .pl-flash.pl-flashing {
          animation: flashOut 0.4s ease forwards;
        }
        @keyframes flashOut {
          0%  { opacity: 0.18; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* ── Particles (generated client-side only to avoid hydration mismatch) ── */}
      {particleCSS && <style>{particleCSS}</style>}

      <div className={`pl-root${phase === "exit" ? " pl-exit" : ""}`}>

        {/* Mesh & texture layers */}
        <div className="pl-mesh" />
        <div className="pl-grid" />
        <div className="pl-scan" />

        {/* Floating particles */}
        <div className="pl-particles">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className={`pl-particle pl-p${i}`} />
          ))}
        </div>

        {/* Corner brackets */}
        <div className="pl-corner pl-corner-tl" />
        <div className="pl-corner pl-corner-tr" />
        <div className="pl-corner pl-corner-bl" />
        <div className="pl-corner pl-corner-br" />

        {/* Orbit rings */}
        <div className="pl-orbits" style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }}>
          <div className="pl-orbit pl-orbit-1">
            <div className="pl-dot pl-dot-3" />
          </div>
          <div className="pl-orbit pl-orbit-2">
            <div className="pl-dot pl-dot-2" />
          </div>
          <div className="pl-orbit pl-orbit-3" />
          <div className="pl-dot pl-dot-1" style={{ position:'absolute', top:'50%', left:'50%' }} />
        </div>

        {/* ── Center content ── */}
        <div className="pl-center">

          {/* Logo with conic glow ring */}
          <div className="pl-logo-wrap">
            <div className="pl-glow-ring" />
            <div className="pl-glow-ring-mask" />
            <img src="/Unimart.png" alt="UniMart" className="pl-logo-img" />
          </div>

          {/* Brand */}
          <div className="pl-brand">
            Uni<span>Mart</span>
            <span className="pl-brand-line" />
          </div>

          {/* Tagline */}
          <div className="pl-tagline">Campus Marketplace</div>

          {/* Animated dots */}
          <div className="pl-dots">
            <div className="pl-dot-sm" />
            <div className="pl-dot-sm" />
            <div className="pl-dot-sm" />
          </div>

          {/* Progress bar */}
          <div className="pl-progress-wrap">
            <div className="pl-progress-header">
              <span className="pl-status-text">
                {count < 30 ? "Initializing…" : count < 70 ? "Loading assets…" : count < 95 ? "Almost ready…" : "Ready!"}
              </span>
              <span className="pl-counter">{count}%</span>
            </div>
            <div className="pl-bar-track">
              <div className="pl-bar-fill" style={{ width: `${barW}%` }} />
            </div>
            <div className="pl-ticks">
              {Array.from({ length: 21 }, (_, i) => (
                <div key={i} className="pl-tick" style={{ background: i * 5 <= count ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Flash on exit */}
        <div className={`pl-flash${phase === "exit" ? " pl-flashing" : ""}`} />
      </div>
    </>
  )
}