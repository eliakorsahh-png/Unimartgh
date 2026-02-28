import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import {
  ShieldCheck, XCircle, ShoppingBag, MessageSquare,
  Heart, Phone, School, Award, TrendingUp, Package,
  Edit3, ExternalLink, Tag, Sparkles, Store, Clock, MousePointerClick
} from "lucide-react"

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const isPremium        = profile?.is_premium ?? false
  const username         = profile?.username || user.email?.split("@")[0] || "user"
  const fullName         = profile?.full_name || username
  const school           = profile?.school || null
  const phone            = profile?.whatsapp_number || profile?.phone_number || null
  const avatar           = profile?.avatar_url || null
  const bio              = profile?.bio || null
  const storeName        = profile?.store_name || null
  const storeDescription = profile?.store_description || null
  const storeBanner      = profile?.store_banner_url || null
  const initials         = fullName.slice(0, 2).toUpperCase()

  // ── KEY FIX: query by user_id (not username) ──────────────────
  const { data: posts } = await supabase
    .from("postings")
    .select("id, title, image_url, price, likes_count, comments_count, clicks, created_at, condition")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Use Number() to prevent string concatenation bugs from DB returning strings
  const activeClicks   = posts?.reduce((sum, p) => sum + (Number(p.clicks) || 0), 0) ?? 0
const lifetimeClicks = Number(profile?.lifetime_clicks) || 0
const totalClicks    = lifetimeClicks + activeClicks
  

  // 100 clicks = 1% trust score, capped at 100
  const trustScore  = Math.min(Math.floor(totalClicks / 100), 100)
  const trustColor  = trustScore >= 75 ? "#16a34a" : trustScore >= 40 ? "#f97316" : "#6366f1"
  const trustLabel  = trustScore >= 75 ? "Highly Trusted" : trustScore >= 40 ? "Growing" : "Building"

  // Clicks needed to reach next percent
  const clicksToNext = trustScore < 100 ? ((trustScore + 1) * 100) - totalClicks : 0

  const fmtNum = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
    : n.toString()

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4ff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* NAV */
        .pnav { background: linear-gradient(135deg,#0f1f6e 0%,#162380 60%,#1a2a9a 100%); box-shadow: 0 4px 32px rgba(13,29,110,.35); position: sticky; top: 0; z-index: 50; }
        .pnav-inner { max-width:1100px; margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; }

        /* HERO */
        .phero { background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 50%,#c2410c 100%); padding:44px 24px 92px; position:relative; overflow:hidden; }
        .phero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 80% 20%,rgba(251,146,60,.22) 0%,transparent 55%),radial-gradient(ellipse at 10% 80%,rgba(99,102,241,.18) 0%,transparent 55%); pointer-events:none; }
        .phero-pattern { position:absolute; inset:0; opacity:.04; background-image:repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 40px); }

        /* WRAP + CARD */
        .pwrap { max-width:1100px; margin:0 auto; padding:0 24px 64px; }
        .pcard { background:white; border-radius:28px; box-shadow:0 8px 48px rgba(13,29,110,.13); overflow:hidden; margin-top:-68px; position:relative; z-index:2; }

        /* AVATAR ZONE */
        .avatar-zone { padding:0 36px 28px; display:flex; align-items:flex-end; gap:24px; border-bottom:1px solid #f1f5f9; flex-wrap:wrap; }
        .avatar-ring { width:120px; height:120px; border-radius:50%; border:5px solid white; box-shadow:0 10px 40px rgba(13,29,110,.22); margin-top:24px; flex-shrink:0; position:relative; background:linear-gradient(135deg,#0f1f6e,#f97316); display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:800; color:white; font-family:'Playfair Display',serif; overflow:hidden; }
        .avatar-ring img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
        .premium-dot { position:absolute; bottom:4px; right:4px; width:28px; height:28px; border-radius:50%; background:white; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 10px rgba(0,0,0,.15); }
        .profile-meta { flex:1; min-width:200px; padding-top:16px; padding-bottom:4px; }
        .edit-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 20px; border:1.5px solid #e2e8f0; border-radius:12px; background:white; color:#0f1f6e; font-family:'DM Sans',sans-serif; font-size:.82rem; font-weight:700; cursor:pointer; text-decoration:none; transition:all .2s; white-space:nowrap; margin-bottom:4px; }
        .edit-btn:hover { border-color:#0f1f6e; background:#f0f4ff; }
        .badge-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 13px; border-radius:999px; font-size:.75rem; font-weight:700; font-family:'DM Sans',sans-serif; }
        .badge-verified { background:linear-gradient(135deg,#16a34a,#4ade80); color:white; }
        .badge-unverified { background:#fff1f0; color:#dc2626; border:1px solid #fca5a5; }

        /* TIKTOK STATS */
        .tiktok-stats { display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1px solid #f1f5f9; }
        .tk-stat { padding:24px 12px 20px; text-align:center; border-right:1px solid #f1f5f9; position:relative; transition:background .15s; }
        .tk-stat:last-child { border-right:none; }
        .tk-stat:hover { background:#fafbff; }
        .tk-icon-wrap { margin-bottom:8px; display:flex; align-items:center; justify-content:center; gap:6px; }
        .tk-label-top { font-size:.65rem; color:#94a3b8; font-weight:700; letter-spacing:.1em; text-transform:uppercase; font-family:'DM Sans',sans-serif; }
        .tk-number { font-family:'Playfair Display',serif; font-size:2rem; font-weight:800; line-height:1; margin-bottom:6px; letter-spacing:-.02em; }
        .tk-sublabel { font-size:.68rem; color:#94a3b8; font-weight:600; letter-spacing:.08em; text-transform:uppercase; font-family:'DM Sans',sans-serif; }
        .trust-chip { display:inline-flex; align-items:center; gap:4px; font-size:.68rem; font-weight:700; padding:3px 10px; border-radius:999px; margin-top:6px; font-family:'DM Sans',sans-serif; }
        .trust-bar-wrap { height:3px; background:#f1f5f9; border-radius:99px; overflow:hidden; margin-top:8px; width:60%; margin-left:auto; margin-right:auto; }
        .trust-bar-fill { height:100%; border-radius:99px; }

        /* INFO PANELS */
        .info-panels { display:grid; grid-template-columns:repeat(3,1fr); }
        .info-panel { padding:28px 30px; border-right:1px solid #f1f5f9; }
        .info-panel:last-child { border-right:none; }
        .panel-title { font-size:.65rem; font-weight:700; color:#94a3b8; letter-spacing:.12em; text-transform:uppercase; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .panel-title::after { content:''; flex:1; height:1px; background:#f1f5f9; }
        .info-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #f8fafc; }
        .info-row:last-child { border-bottom:none; }
        .info-icon { width:34px; height:34px; border-radius:10px; background:#f0f4ff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .verif-ok { background:#f0fdf4; border:1px solid #86efac; border-radius:14px; padding:14px 16px; }
        .verif-no { background:#fff7f0; border:1px solid #fed7aa; border-radius:14px; padding:14px 16px; }
        .get-verified-btn { display:flex; align-items:center; justify-content:center; gap:7px; margin-top:11px; padding:10px 16px; background:linear-gradient(135deg,#f97316,#ea580c); color:white; border:none; border-radius:12px; font-family:'DM Sans',sans-serif; font-size:.8rem; font-weight:700; text-decoration:none; transition:all .2s; box-shadow:0 4px 14px rgba(249,115,22,.28); }
        .get-verified-btn:hover { transform:translateY(-1px); box-shadow:0 8px 24px rgba(249,115,22,.38); }

        /* SECTIONS */
        .outer-section { margin-top:32px; }
        .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .section-heading { font-family:'Playfair Display',serif; font-size:1.35rem; font-weight:800; color:#0f1f6e; display:flex; align-items:center; gap:10px; }
        .heading-accent { width:6px; height:32px; background:linear-gradient(180deg,#0f1f6e,#f97316); border-radius:3px; flex-shrink:0; }

        /* STORE */
        .store-outer { background:white; border-radius:24px; box-shadow:0 4px 32px rgba(13,29,110,.09); overflow:hidden; }
        .store-banner-lg { height:140px; background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 50%,#c2410c 100%); position:relative; overflow:hidden; }
        .store-banner-lg img { width:100%; height:100%; object-fit:cover; }
        .store-banner-pattern { position:absolute; inset:0; opacity:.07; background-image:repeating-linear-gradient(-45deg,white 0,white 1px,transparent 1px,transparent 20px); }
        .store-body-lg { padding:0 32px 28px; display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; }
        .store-icon-lg { width:64px; height:64px; border-radius:18px; background:linear-gradient(135deg,#0f1f6e,#1a2a9a); display:flex; align-items:center; justify-content:center; margin-top:-32px; border:4px solid white; box-shadow:0 6px 20px rgba(13,29,110,.25); flex-shrink:0; }
        .store-info { flex:1; min-width:200px; padding-top:14px; }
        .store-empty { background:white; border-radius:24px; box-shadow:0 4px 32px rgba(13,29,110,.09); padding:56px 24px; text-align:center; border:2px dashed #c7d2fe; display:flex; flex-direction:column; align-items:center; gap:14px; }

        /* LISTINGS */
        .listings-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:18px; }
        .listing-card { background:white; border-radius:20px; overflow:hidden; box-shadow:0 2px 16px rgba(13,29,110,.07); border:1px solid #f1f5f9; transition:all .25s ease; text-decoration:none; color:inherit; display:block; }
        .listing-card:hover { box-shadow:0 12px 40px rgba(13,29,110,.14); transform:translateY(-4px); }
        .listing-img { aspect-ratio:4/3; background:linear-gradient(135deg,#eef2ff,#e0e7ff); position:relative; overflow:hidden; }
        .listing-img img { width:100%; height:100%; object-fit:cover; transition:transform .4s ease; }
        .listing-card:hover .listing-img img { transform:scale(1.06); }
        .listing-price { position:absolute; top:12px; left:12px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; padding:4px 12px; border-radius:999px; font-size:.78rem; font-weight:700; font-family:'DM Sans',sans-serif; box-shadow:0 2px 8px rgba(234,88,12,.35); }
        .listing-condition { position:absolute; top:12px; right:12px; background:rgba(15,31,110,.85); color:white; padding:3px 10px; border-radius:999px; font-size:.68rem; font-weight:700; font-family:'DM Sans',sans-serif; backdrop-filter:blur(4px); }
        .listing-no-img { width:100%; height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:8px; }
        .listing-body { padding:14px 16px; }
        .listing-title { font-family:'Playfair Display',serif; font-size:.92rem; font-weight:700; color:#0f1f6e; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:10px; }
        .listing-footer { display:flex; align-items:center; gap:12px; padding-top:10px; border-top:1px solid #f8fafc; flex-wrap:wrap; }
        .lst-stat { display:inline-flex; align-items:center; gap:4px; font-size:.74rem; color:#94a3b8; font-family:'DM Sans',sans-serif; }
        .lst-date { font-size:.68rem; color:#cbd5e1; font-family:'DM Sans',sans-serif; margin-left:auto; }
        .empty-listings { background:white; border-radius:24px; padding:80px 24px; text-align:center; border:2px dashed #c7d2fe; display:flex; flex-direction:column; align-items:center; gap:14px; }
        .new-listing-btn { display:inline-flex; align-items:center; gap:7px; padding:10px 20px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; border-radius:13px; font-size:.82rem; font-weight:700; text-decoration:none; font-family:'DM Sans',sans-serif; box-shadow:0 4px 16px rgba(234,88,12,.28); transition:all .2s; }
        .new-listing-btn:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(234,88,12,.36); }

        @media (max-width:768px) {
          .info-panels { grid-template-columns:1fr; }
          .info-panel { border-right:none; border-bottom:1px solid #f1f5f9; }
          .info-panel:last-child { border-bottom:none; }
        }
        @media (max-width:640px) {
          .avatar-zone { padding:0 20px 20px; }
          .info-panel { padding:22px 20px; }
          .store-body-lg { padding:0 20px 20px; }
          .listings-grid { grid-template-columns:1fr 1fr; gap:12px; }
          .pwrap { padding:0 16px 48px; }
          .tk-number { font-size:1.6rem; }
        }
        @media (max-width:420px) { .listings-grid { grid-template-columns:1fr; } }
      `}</style>

      {/* NAV */}
      <header className="pnav">
        <div className="pnav-inner">
          <a href="/" style={{ textDecoration:'none' }}>
            <img src="/Unimart.png" alt="UniMart" style={{ width:58, height:58, objectFit:'contain' }} />
          </a>
          <a href="/upload" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', background:'#f97316', color:'white', borderRadius:999, fontSize:'.82rem', fontWeight:700, textDecoration:'none', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 4px 16px rgba(249,115,22,.35)' }}>
            <ShoppingBag size={14} /> Upload Product
          </a>
        </div>
      </header>

      {/* HERO */}
      <div className="phero">
        <div className="phero-pattern" />
        <div style={{ maxWidth:1100, margin:'0 auto', position:'relative', zIndex:1 }}>
          <p style={{ color:'rgba(255,255,255,.5)', fontSize:'.72rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', marginBottom:10, fontFamily:"'DM Sans',sans-serif" }}>My Profile</p>
          <h1 style={{ fontFamily:"'Playfair Display',serif", color:'white', fontSize:'clamp(1.5rem,4vw,2.2rem)', fontWeight:800, marginBottom:6 }}>{fullName}</h1>
          <p style={{ color:'rgba(255,255,255,.55)', fontSize:'.85rem', fontFamily:"'DM Sans',sans-serif" }}>
            @{username}{school && <span style={{ opacity:.6 }}> · {school}</span>}
          </p>
        </div>
      </div>

      {/* PAGE WRAP */}
      <div className="pwrap">
        <div className="pcard">

          {/* Avatar zone */}
          <div className="avatar-zone">
            <div className="avatar-ring">
              {avatar ? <img src={avatar} alt={fullName} /> : initials}
              <div className="premium-dot">
                {isPremium
                  ? <ShieldCheck size={15} color="#0f1f6e" strokeWidth={2.5} />
                  : <XCircle size={15} color="#dc2626" strokeWidth={2.5} />}
              </div>
            </div>
            <div className="profile-meta">
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.3rem', fontWeight:800, color:'#0f1f6e' }}>{fullName}</span>
                {isPremium
                  ? <span className="badge-pill badge-verified"><ShieldCheck size={12}/> Verified Seller</span>
                  : <span className="badge-pill badge-unverified"><XCircle size={12}/> Not Verified</span>}
              </div>
              {bio
                ? <p style={{ color:'#64748b', fontSize:'.85rem', lineHeight:1.55, maxWidth:440 }}>{bio}</p>
                : <p style={{ color:'#94a3b8', fontSize:'.83rem' }}>{phone || "No contact info yet"}{school && <span> · {school}</span>}</p>}
            </div>
            <a href="/profile/edit" className="edit-btn"><Edit3 size={13}/> Edit Profile</a>
          </div>

          {/* TIKTOK-STYLE STATS */}
          <div className="tiktok-stats">

            {/* Listings count */}
            <div className="tk-stat">
              <div className="tk-icon-wrap">
                <Package size={14} color="#0f1f6e" />
                <span className="tk-label-top">Listings</span>
              </div>
              <div className="tk-number" style={{ color:'#0f1f6e' }}>{fmtNum(posts?.length ?? 0)}</div>
              <div className="tk-sublabel">Products Listed</div>
            </div>

            {/* Total Clicks — summed from every listing this user has made */}
            <div className="tk-stat">
              <div className="tk-icon-wrap">
                <MousePointerClick size={14} color="#f97316" />
                <span className="tk-label-top">Total Clicks</span>
              </div>
              <div className="tk-number" style={{ color:'#f97316' }}>{fmtNum(totalClicks)}</div>
              <div className="tk-sublabel">Across All Listings</div>
            </div>

            {/* Trust Score: 100 clicks = 1%, capped at 100% */}
            <div className="tk-stat">
              <div className="tk-icon-wrap">
                <TrendingUp size={14} color={trustColor} />
                <span className="tk-label-top">Trust Score</span>
              </div>
              <div className="tk-number" style={{ color:trustColor }}>
                {trustScore}
                <span style={{ fontSize:'1rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>%</span>
              </div>
              <div className="trust-bar-wrap">
                <div className="trust-bar-fill" style={{ width:`${trustScore}%`, background:`linear-gradient(90deg,${trustColor},${trustColor}99)` }} />
              </div>
              <div>
                <span className="trust-chip" style={{ background:`${trustColor}15`, color:trustColor }}>{trustLabel}</span>
              </div>
            </div>

          </div>

          {/* Info panels */}
          <div className="info-panels">

            {/* Verification */}
            <div className="info-panel">
              <div className="panel-title"><ShieldCheck size={12}/> Verification</div>
              {isPremium ? (
                <div className="verif-ok">
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <ShieldCheck size={17} color="#16a34a"/>
                    <span style={{ fontWeight:700, color:'#15803d', fontSize:'.88rem', fontFamily:"'DM Sans',sans-serif" }}>Verified Seller</span>
                  </div>
                  <p style={{ fontSize:'.77rem', color:'#166534', lineHeight:1.55 }}>Your account is verified. Buyers trust you more and your listings stay live for 7 days.</p>
                </div>
              ) : (
                <div className="verif-no">
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <XCircle size={17} color="#ea580c"/>
                    <span style={{ fontWeight:700, color:'#c2410c', fontSize:'.88rem', fontFamily:"'DM Sans',sans-serif" }}>Not Verified</span>
                  </div>
                  <p style={{ fontSize:'.77rem', color:'#f97316', lineHeight:1.55 }}>Verify your account to build buyer confidence and unlock daily uploads.</p>
                  <a href="/verify" className="get-verified-btn"><Sparkles size={14}/> Get Verified Now</a>
                </div>
              )}
            </div>

            {/* Trust breakdown */}
            <div className="info-panel">
              <div className="panel-title"><TrendingUp size={12}/> Trust Breakdown</div>
              <div style={{ background:'#f8fafc', borderRadius:14, padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'2rem', fontWeight:800, color:trustColor, lineHeight:1 }}>
                    {trustScore}<span style={{ fontSize:'1rem', color:'#94a3b8' }}>%</span>
                  </span>
                  <span style={{ fontSize:'.73rem', fontWeight:700, color:trustColor, background:`${trustColor}18`, padding:'4px 11px', borderRadius:999, fontFamily:"'DM Sans',sans-serif" }}>{trustLabel}</span>
                </div>
                <div style={{ height:8, background:'#e2e8f0', borderRadius:999, overflow:'hidden', marginBottom:11 }}>
                  <div style={{ height:'100%', width:`${trustScore}%`, background:`linear-gradient(90deg,${trustColor},${trustColor}bb)`, borderRadius:999 }} />
                </div>
                <p style={{ fontSize:'.73rem', color:'#94a3b8', lineHeight:1.75 }}>
                  Every <strong style={{ color:'#64748b' }}>100 clicks = +1%</strong> trust.<br/>
                  You have <strong style={{ color:'#64748b' }}>{totalClicks.toLocaleString()} total clicks</strong> across{' '}
                  <strong style={{ color:'#64748b' }}>{posts?.length ?? 0} listing{(posts?.length ?? 0) !== 1 ? 's' : ''}</strong>.<br/>
                  {trustScore < 100
                    ? <><strong style={{ color:trustColor }}>{clicksToNext.toLocaleString()} more clicks</strong> to reach {trustScore + 1}%.</>
                    : <strong style={{ color:'#16a34a' }}>Maximum trust reached! 🎉</strong>
                  }
                </p>
              </div>
            </div>

            {/* Contact */}
            <div className="info-panel">
              <div className="panel-title"><Phone size={12}/> Contact Info</div>
              {phone && (
                <div className="info-row">
                  <div className="info-icon"><Phone size={14} color="#0f1f6e"/></div>
                  <div>
                    <div style={{ fontSize:'.85rem', color:'#334155', fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>{phone}</div>
                    <div style={{ fontSize:'.7rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>WhatsApp / Phone</div>
                  </div>
                </div>
              )}
              {school && (
                <div className="info-row">
                  <div className="info-icon"><School size={14} color="#0f1f6e"/></div>
                  <div>
                    <div style={{ fontSize:'.85rem', color:'#334155', fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>{school}</div>
                    <div style={{ fontSize:'.7rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>University</div>
                  </div>
                </div>
              )}
              <div className="info-row">
                <div className="info-icon"><Award size={14} color="#f97316"/></div>
                <div>
                  <div style={{ fontSize:'.85rem', color:'#334155', fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>{isPremium ? "Premium Member" : "Free Member"}</div>
                  <div style={{ fontSize:'.7rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>Membership</div>
                </div>
              </div>
              {!phone && !school && (
                <p style={{ fontSize:'.8rem', color:'#cbd5e1', fontFamily:"'DM Sans',sans-serif", marginTop:8 }}>
                  No contact info yet.{' '}
                  <a href="/profile/edit" style={{ color:'#f97316', fontWeight:700, textDecoration:'none' }}>Add it now →</a>
                </p>
              )}
            </div>

          </div>
        </div>

       

        {/* MY LISTINGS */}
        <div className="outer-section">
          <div className="section-header">
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div className="heading-accent"/>
              <h2 className="section-heading">
                <Package size={20}/> My Listings
                {posts && posts.length > 0 && (
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:'.8rem', fontWeight:600, color:'#94a3b8', marginLeft:4 }}>({posts.length})</span>
                )}
              </h2>
            </div>
            <a href="/upload" className="new-listing-btn">+ New Listing</a>
          </div>

          {posts && posts.length > 0 ? (
            <div className="listings-grid">
              {posts.map(post => {
                const priceStr = post.price ? `GH₵ ${Number(post.price).toFixed(2)}` : null
                const conditionLabel: Record<string,string> = { "new":"Brand New","like-new":"Like New","used":"Used","fair":"Fair" }
                const dateStr = new Date(post.created_at).toLocaleDateString("en-US",{ month:"short", day:"numeric" })
                const postClicks = Number(post.clicks) || 0
                return (
                  <a key={post.id} href={`/post/${post.id}`} className="listing-card">
                    <div className="listing-img">
                      {post.image_url
                        ? <img src={post.image_url} alt={post.title}/>
                        : <div className="listing-no-img"><Tag size={30} color="#c7d2fe"/><span style={{ fontSize:'.72rem', color:'#a5b4fc', fontFamily:"'DM Sans',sans-serif" }}>No image</span></div>}
                      {priceStr && <div className="listing-price">{priceStr}</div>}
                      {post.condition && <div className="listing-condition">{conditionLabel[post.condition] ?? post.condition}</div>}
                    </div>
                    <div className="listing-body">
                      <div className="listing-title">{post.title}</div>
                      <div className="listing-footer">
                        <span className="lst-stat"><MousePointerClick size={12} color="#f97316"/> {fmtNum(postClicks)}</span>
                      
                        <span className="lst-date"><Clock size={10} style={{ display:'inline', marginRight:3, verticalAlign:'middle' }}/>{dateStr}</span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          ) : (
            <div className="empty-listings">
              <div style={{ width:72, height:72, borderRadius:22, background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', display:'flex', alignItems:'center', justifyContent:'center' }}><Package size={30} color="#818cf8"/></div>
              <p style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, fontSize:'1.1rem', color:'#0f1f6e' }}>No listings yet</p>
              <p style={{ fontSize:'.85rem', color:'#94a3b8', lineHeight:1.6, maxWidth:300 }}>Start selling to the campus community. Your listings will appear here.</p>
              <a href="/upload" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 24px', background:'linear-gradient(135deg,#0f1f6e,#162380)', color:'white', borderRadius:14, fontSize:'.85rem', fontWeight:700, textDecoration:'none', fontFamily:"'DM Sans',sans-serif" }}>
                <ShoppingBag size={16}/> Upload Your First Product
              </a>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}