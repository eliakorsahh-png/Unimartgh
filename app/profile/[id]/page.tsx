"use client"

import { useState, useEffect, use } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, ShieldCheck, School, MessageSquare,
  MousePointerClick, Tag, Package, Clock,
  Star, Grid3X3, List, TrendingUp
} from "lucide-react"

type Profile = {
  id: string
  username: string
  full_name: string | null
  school: string | null
  avatar_url: string | null
  whatsapp_number: string | null
  is_premium: boolean
  bio?: string | null
  lifetime_clicks?: number | null
}

type Post = {
  id: string
  title: string
  image_url: string | null
  price: number | null
  clicks: number
  created_at: string
  category: string | null
  tags: any
}

export default function SellerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id: sellerId } = use(params)

  const [profile, setProfile]     = useState<Profile | null>(null)
  const [posts, setPosts]         = useState<Post[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [viewMode, setViewMode]   = useState<"grid" | "list">("grid")
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!sellerId) return
    const load = async () => {
      setLoading(true)
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sellerId)
        .single()

      if (pErr || !prof) { setError("Profile not found."); setLoading(false); return }
      setProfile(prof as Profile)

      const now = new Date().toISOString()
      const { data: postData } = await supabase
        .from("postings")
        .select("id, title, image_url, price, clicks, created_at, category, tags")
        .eq("user_id", sellerId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })

      setPosts((postData ?? []) as Post[])
      setLoading(false)
    }
    load()
  }, [sellerId])

  const timeAgo = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 60) return `${Math.max(1,m)}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h/24)}d ago`
  }

  const waLink = (() => {
    const raw = String(profile?.whatsapp_number ?? "")
    const clean = raw.replace(/\D/g, "")
    return clean
      ? `https://wa.me/${clean}?text=Hi%20${encodeURIComponent(profile?.full_name || profile?.username || "")}%2C%20I%20found%20your%20profile%20on%20UniMart!`
      : null
  })()

  const activeClicks   = posts.reduce((sum, p) => sum + (Number(p.clicks) || 0), 0)
  const lifetimeClicks = Number(profile?.lifetime_clicks) || 0
  const totalClicks    = lifetimeClicks + activeClicks

  // Trust score: 100 clicks = 1%, capped at 100%
  const trustScore = Math.min(Math.floor(totalClicks / 100), 100)
  const trustColor = trustScore >= 75 ? "#16a34a" : trustScore >= 40 ? "#f97316" : "#6366f1"
  const trustLabel = trustScore >= 75 ? "Highly Trusted" : trustScore >= 40 ? "Growing" : "Building"

  const displayName = profile?.full_name || profile?.username || "Seller"
  const initials    = displayName.slice(0,2).toUpperCase()

  if (loading) return (
    <div style={{ minHeight:"100dvh", background:"#f4f6fb", display:"flex", flexDirection:"column" }}>
      <div style={{ background:"linear-gradient(135deg,#0f1f6e,#1a2a9a)", height:62, display:"flex", alignItems:"center", padding:"0 16px" }}>
        <button onClick={() => router.back()} style={{ background:"rgba(255,255,255,0.12)", border:"none", cursor:"pointer", width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"white" }}>
          <ArrowLeft size={17} />
        </button>
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:"50%", border:"3px solid #c7d2fe", borderTopColor:"#0f1f6e", animation:"spin 0.8s linear infinite" }} />
        <p style={{ color:"#94a3b8", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem" }}>Loading profile…</p>
      </div>
    </div>
  )

  if (error || !profile) return (
    <div style={{ minHeight:"100dvh", background:"#f4f6fb", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:"0 24px" }}>
      <Package size={44} color="#c7d2fe" />
      <p style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", fontSize:"1.1rem", textAlign:"center" }}>{error ?? "Profile not found"}</p>
      <button onClick={() => router.push("/")} style={{ padding:"10px 24px", background:"#0f1f6e", color:"white", border:"none", borderRadius:12, fontFamily:"'DM Sans',sans-serif", fontWeight:700, cursor:"pointer" }}>Home</button>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        input, select, textarea { font-size:16px !important; }
        body { background:#f4f6fb; font-family:'DM Sans',system-ui,sans-serif; }

        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

        .nav {
          background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 55%,#1e3bb0 100%);
          height:62px; padding:0 16px;
          display:flex; align-items:center; gap:12px;
          box-shadow:0 2px 18px rgba(13,29,110,0.38);
          position:sticky; top:0; z-index:50;
        }
        .back-btn { background:rgba(255,255,255,0.12); border:none; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; transition:background .15s; flex-shrink:0; }
        .back-btn:hover { background:rgba(255,255,255,0.22); }
        .nav-label { font-family:'Playfair Display',serif; color:white; font-weight:700; font-size:0.95rem; flex:1; }

        .hero {
          background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 45%,#c2410c 100%);
          padding:40px 20px 88px; text-align:center; position:relative; overflow:hidden;
        }
        .hero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 70% 40%,rgba(251,146,60,0.18) 0%,transparent 60%); pointer-events:none; }
        .hero-pat { position:absolute; inset:0; opacity:0.03; background-image:repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 32px); }
        .hero::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:60px; background:#f4f6fb; clip-path:ellipse(55% 100% at 50% 100%); }

        .av-wrap { position:relative; display:inline-block; margin-bottom:14px; z-index:1; }
        .av {
          width:100px; height:100px; border-radius:50%;
          border:4px solid white;
          box-shadow:0 8px 32px rgba(13,29,110,0.35);
          background:linear-gradient(135deg,#0f1f6e,#f97316);
          display:flex; align-items:center; justify-content:center;
          font-size:2rem; font-weight:800; color:white;
          font-family:'Playfair Display',serif; overflow:hidden;
        }
        .av img { width:100%; height:100%; object-fit:cover; }
        .vring { position:absolute; bottom:4px; right:4px; width:28px; height:28px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.2); }

        .hero-name { font-family:'Playfair Display',serif; color:white; font-weight:800; font-size:clamp(1.4rem,5vw,2rem); line-height:1.2; margin-bottom:4px; position:relative; z-index:1; }
        .hero-chips { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; position:relative; z-index:1; margin-top:12px; }
        .hero-chip { display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.12); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.85); padding:5px 16px; border-radius:999px; font-size:0.76rem; font-weight:600; font-family:'DM Sans',sans-serif; }
        .hero-chip.orange { background:rgba(249,115,22,0.85); border-color:transparent; color:white; font-size:0.68rem; font-weight:800; letter-spacing:0.06em; }

        .body { max-width:820px; margin:-48px auto 0; padding:0 16px 72px; position:relative; z-index:2; }

        /* STATS */
        .stats { background:white; border-radius:16px; box-shadow:0 4px 24px rgba(13,29,110,0.1); border:1px solid #eef2ff; display:flex; overflow:hidden; margin-bottom:18px; animation:fadeUp .3s ease; }
        .stat-cell { flex:1; padding:16px 10px; text-align:center; border-right:1px solid #f1f5f9; }
        .stat-cell:last-child { border-right:none; }
        .stat-val { font-family:'Playfair Display',serif; font-weight:800; color:#0f1f6e; font-size:1.35rem; line-height:1; }
        .stat-key { font-size:0.62rem; color:#94a3b8; font-family:'DM Sans',sans-serif; margin-top:4px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; }

        /* Trust bar inside stat cell */
        .trust-mini-bar { height:3px; background:#f1f5f9; border-radius:99px; overflow:hidden; margin:6px auto 0; width:56px; }
        .trust-mini-fill { height:100%; border-radius:99px; }
        .trust-mini-chip { display:inline-block; font-size:0.58rem; font-weight:800; padding:2px 7px; border-radius:999px; margin-top:5px; font-family:'DM Sans',sans-serif; letter-spacing:0.04em; }

        .card { background:white; border-radius:16px; box-shadow:0 2px 16px rgba(13,29,110,0.07); border:1px solid #eef2ff; padding:18px 20px; margin-bottom:16px; animation:fadeUp .35s ease; }
        .wa-btn { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; padding:14px; border-radius:14px; background:linear-gradient(135deg,#25D366,#128C7E); color:white; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:800; font-size:0.96rem; text-decoration:none; transition:all .2s; box-shadow:0 6px 20px rgba(37,211,102,0.35); }
        .wa-btn:hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(37,211,102,0.45); color:white; }
        .no-wa { text-align:center; padding:12px; color:#94a3b8; font-size:0.82rem; font-family:'DM Sans',sans-serif; background:#f8fafc; border-radius:12px; border:1.5px dashed #e2e8f0; }

        .sec-head { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
        .sec-title { font-family:'Playfair Display',serif; font-weight:700; color:#0f1f6e; font-size:0.95rem; white-space:nowrap; }
        .sec-line { flex:1; height:1.5px; background:linear-gradient(90deg,#c7d2fe,transparent); }

        .listings-bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .listings-label { font-family:'Playfair Display',serif; font-weight:700; color:#0f1f6e; font-size:1rem; display:flex; align-items:center; gap:8px; }
        .count-badge { font-size:0.76rem; color:#94a3b8; font-family:'DM Sans',sans-serif; font-weight:600; }
        .view-tog { display:flex; gap:4px; }
        .tog { width:34px; height:34px; border-radius:10px; border:1.5px solid #e2e8f0; background:#f8fafc; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#94a3b8; transition:all .15s; }
        .tog.on { background:#0f1f6e; border-color:#0f1f6e; color:white; }

        .pgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
        @media(min-width:540px) { .pgrid { grid-template-columns:repeat(3,1fr); gap:14px; } }

        .pcard { background:white; border-radius:12px; overflow:hidden; box-shadow:0 1px 8px rgba(13,29,110,0.07); border:1px solid #eef2ff; cursor:pointer; transition:all .2s; animation:fadeUp .3s ease both; }
        .pcard:hover { transform:translateY(-3px); box-shadow:0 10px 32px rgba(13,29,110,0.14); border-color:#c7d2fe; }
        .pcard-img { aspect-ratio:1/1; background:linear-gradient(135deg,#eef2ff,#e0e7ff); overflow:hidden; position:relative; }
        .pcard-img img { width:100%; height:100%; object-fit:cover; transition:transform .4s; }
        .pcard:hover .pcard-img img { transform:scale(1.07); }
        .pcard-no { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
        .pcard-price { position:absolute; bottom:6px; left:6px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; font-size:0.66rem; font-weight:800; padding:3px 8px; border-radius:999px; font-family:'DM Sans',sans-serif; }
        .pcard-body { padding:9px 10px 11px; }
        .pcard-title { font-family:'Playfair Display',serif; font-weight:700; color:#0f172a; font-size:0.8rem; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:6px; }
        .pcard-foot { display:flex; align-items:center; justify-content:space-between; }
        .pcard-clicks { display:inline-flex; align-items:center; gap:3px; font-size:0.67rem; color:#94a3b8; font-family:'DM Sans',sans-serif; font-weight:600; }
        .pcard-time { font-size:0.63rem; color:#cbd5e1; font-family:'DM Sans',sans-serif; }

        .lcard { background:white; border-radius:14px; border:1px solid #eef2ff; box-shadow:0 1px 8px rgba(13,29,110,0.06); display:flex; gap:14px; padding:14px; cursor:pointer; transition:all .2s; animation:fadeUp .25s ease both; margin-bottom:10px; }
        .lcard:hover { transform:translateX(4px); box-shadow:0 6px 24px rgba(13,29,110,0.12); border-color:#c7d2fe; }
        .lcard-img { width:80px; height:80px; border-radius:10px; background:linear-gradient(135deg,#eef2ff,#e0e7ff); flex-shrink:0; overflow:hidden; }
        .lcard-img img { width:100%; height:100%; object-fit:cover; }
        .lcard-no { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
        .lcard-info { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:space-between; }
        .lcard-title { font-family:'Playfair Display',serif; font-weight:700; color:#0f172a; font-size:0.9rem; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .lcard-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px; }
        .lcard-price { font-family:'DM Sans',sans-serif; font-weight:800; color:#ea580c; font-size:0.88rem; }
        .lcard-clicks { display:inline-flex; align-items:center; gap:4px; font-size:0.72rem; color:#94a3b8; font-family:'DM Sans',sans-serif; }
        .lcard-cat { font-size:0.67rem; font-weight:700; color:#0f1f6e; background:#eef2ff; padding:2px 8px; border-radius:999px; font-family:'DM Sans',sans-serif; }
        .lcard-time { font-size:0.67rem; color:#cbd5e1; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:4px; margin-top:6px; }

        .empty { text-align:center; padding:48px 24px; background:white; border-radius:16px; border:1px solid #eef2ff; }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={17} />
        </button>
        <span className="nav-label">Seller Profile</span>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-pat" />
        <div style={{ position:"relative", zIndex:1 }}>
          <div className="av-wrap">
            <div className="av">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={displayName} />
                : initials
              }
            </div>
            {profile.is_premium && (
              <div className="vring"><ShieldCheck size={16} color="#0f1f6e" /></div>
            )}
          </div>

          <h1 className="hero-name">{displayName}</h1>

          <div className="hero-chips">
            {profile.school && (
              <span className="hero-chip"><School size={12} /> {profile.school}</span>
            )}
            {profile.is_premium && (
              <span className="hero-chip orange"><ShieldCheck size={11} /> Verified UniMart Seller</span>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="body">

        {/* STATS — Listings | Total Clicks | Trust Score */}
        <div className="stats">
          <div className="stat-cell">
            <div className="stat-val">{posts.length}</div>
            <div className="stat-key">Listings</div>
          </div>

          <div className="stat-cell">
            <div className="stat-val">
              {totalClicks >= 1000
                ? `${(totalClicks / 1000).toFixed(1)}K`
                : totalClicks}
            </div>
            <div className="stat-key">Total Clicks</div>
          </div>

          <div className="stat-cell">
            <div className="stat-val" style={{ color: trustColor }}>
              {trustScore}
              <span style={{ fontSize:"0.85rem", color:"#94a3b8", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>%</span>
            </div>
            <div className="trust-mini-bar">
              <div
                className="trust-mini-fill"
                style={{ width:`${trustScore}%`, background:`linear-gradient(90deg,${trustColor},${trustColor}99)` }}
              />
            </div>
            <span
              className="trust-mini-chip"
              style={{ background:`${trustColor}15`, color: trustColor }}
            >
              {trustLabel}
            </span>
            <div className="stat-key" style={{ marginTop:4 }}>Trust Score</div>
          </div>
        </div>

        {/* BIO */}
        {(profile as any).bio && (
          <div className="card">
            <div className="sec-head">
              <Star size={14} color="#0f1f6e" />
              <span className="sec-title">About</span>
              <div className="sec-line" />
            </div>
            <p style={{ fontSize:"0.9rem", color:"#334155", fontFamily:"'DM Sans',sans-serif", lineHeight:1.75 }}>
              {(profile as any).bio}
            </p>
          </div>
        )}

        {/* CONTACT */}
        <div className="card">
          <div className="sec-head">
            <MessageSquare size={14} color="#0f1f6e" />
            <span className="sec-title">Contact Seller</span>
            <div className="sec-line" />
          </div>
          {waLink ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="wa-btn">
              <MessageSquare size={19} /> Chat on WhatsApp
            </a>
          ) : (
            <div className="no-wa">No contact info available for this seller.</div>
          )}
        </div>

        {/* LISTINGS */}
        <div>
          <div className="listings-bar">
            <span className="listings-label">
              <Package size={16} />
              Listings
              <span className="count-badge">({posts.length})</span>
            </span>
            <div className="view-tog">
              <button className={`tog ${viewMode === "grid" ? "on" : ""}`} onClick={() => setViewMode("grid")}>
                <Grid3X3 size={14} />
              </button>
              <button className={`tog ${viewMode === "list" ? "on" : ""}`} onClick={() => setViewMode("list")}>
                <List size={14} />
              </button>
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="empty">
              <Package size={36} color="#c7d2fe" style={{ marginBottom:12 }} />
              <p style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", fontSize:"1rem", marginBottom:6 }}>No active listings</p>
              <p style={{ color:"#94a3b8", fontSize:"0.82rem", fontFamily:"'DM Sans',sans-serif" }}>This seller hasn't posted anything yet.</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="pgrid">
              {posts.map((post, idx) => (
                <div
                  key={post.id}
                  className="pcard"
                  style={{ animationDelay:`${idx * 40}ms` }}
                  onClick={() => router.push(`/post/${post.id}`)}
                >
                  <div className="pcard-img">
                    {post.image_url && !imgErrors.has(post.id) ? (
                      <img
                        src={post.image_url}
                        alt={post.title}
                        loading="lazy"
                        onError={() => setImgErrors(prev => new Set([...prev, post.id]))}
                      />
                    ) : (
                      <div className="pcard-no"><Tag size={22} color="#c7d2fe" /></div>
                    )}
                    {post.price != null && (
                      <div className="pcard-price">GH₵ {Number(post.price).toFixed(2)}</div>
                    )}
                  </div>
                  <div className="pcard-body">
                    <div className="pcard-title">{post.title}</div>
                    <div className="pcard-foot">
                      <span className="pcard-clicks">
                        <MousePointerClick size={11} /> {post.clicks ?? 0}
                      </span>
                      <span className="pcard-time">{timeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {posts.map((post, idx) => (
                <div
                  key={post.id}
                  className="lcard"
                  style={{ animationDelay:`${idx * 35}ms` }}
                  onClick={() => router.push(`/post/${post.id}`)}
                >
                  <div className="lcard-img">
                    {post.image_url && !imgErrors.has(post.id) ? (
                      <img
                        src={post.image_url}
                        alt={post.title}
                        loading="lazy"
                        onError={() => setImgErrors(prev => new Set([...prev, post.id]))}
                      />
                    ) : (
                      <div className="lcard-no"><Tag size={20} color="#c7d2fe" /></div>
                    )}
                  </div>
                  <div className="lcard-info">
                    <div>
                      <div className="lcard-title">{post.title}</div>
                      <div className="lcard-meta">
                        {post.price != null && (
                          <span className="lcard-price">GH₵ {Number(post.price).toFixed(2)}</span>
                        )}
                        {post.category && <span className="lcard-cat">{post.category}</span>}
                        <span className="lcard-clicks">
                          <MousePointerClick size={11} /> {post.clicks ?? 0} clicks
                        </span>
                      </div>
                    </div>
                    <div className="lcard-time">
                      <Clock size={10} /> {timeAgo(post.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}