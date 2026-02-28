"use client"

import { useState, useEffect, useCallback, use } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, MousePointerClick, MessageSquare, ShieldCheck,
  Clock, Tag, School, User, Share2, ChevronRight,
  TrendingUp, Calendar, Loader2, AlertCircle, Store
} from "lucide-react"

type Profile = {
  id: string
  username: string
  full_name: string | null
  school: string | null
  avatar_url: string | null
  whatsapp_number: string | null
  is_premium: boolean
}

type Post = {
  id: string
  user_id: string
  title: string
  content: string | null
  image_url: string | null
  created_at: string
  clicks: number
  comments_count: number
  price: number | null
  expires_at: string | null
  category: string | null
  tags: any // intentionally 'any' — normalised before use
}

// ── Safely parse tags regardless of what Supabase returns ────────
const normalizeTags = (tags: any): string[] => {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter(Boolean)
  if (typeof tags === "string") {
    try { return JSON.parse(tags).filter(Boolean) } catch { return [] }
  }
  return []
}

// ── Simulate daily click history from total + post age ───────────
function generateClickHistory(totalClicks: number, createdAt: string): { day: string; clicks: number }[] {
  const created  = new Date(createdAt)
  const now      = new Date()
  const diffDays = Math.max(1, Math.floor((now.getTime() - created.getTime()) / 86400000))
  const days     = Math.min(diffDays + 1, 14)

  const raw: number[] = []
  let remaining = totalClicks
  for (let i = days - 1; i >= 0; i--) {
    if (i === 0) { raw.unshift(remaining); break }
    const weight = (days - i) / days
    const chunk  = Math.round(remaining * weight * (0.3 + Math.random() * 0.4))
    const val    = Math.min(chunk, remaining)
    raw.unshift(val)
    remaining -= val
  }

  return raw.map((clicks, i) => {
    const d = new Date(created)
    d.setDate(d.getDate() + i)
    return {
      day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      clicks: Math.max(0, clicks),
    }
  })
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id: postId } = use(params)

  const [post, setPost]           = useState<Post | null>(null)
  const [seller, setSeller]       = useState<Profile | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [clicked, setClicked]     = useState(false)
  const [userId, setUserId]       = useState<string | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [shareMsg, setShareMsg]   = useState("")
  const [chartData, setChartData] = useState<{ day: string; clicks: number }[]>([])

  // ── Auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id)
    })
  }, [])

  // ── Fetch post + seller ──────────────────────────────────────────
  const fetchPost = useCallback(async () => {
    if (!postId) return
    setLoading(true); setError(null)

    const { data: postData, error: pErr } = await supabase
      .from("postings")
      .select("id, user_id, title, content, image_url, created_at, clicks, comments_count, price, expires_at, category, tags")
      .eq("id", postId)
      .single()

    if (pErr || !postData) {
      setError("Product not found.")
      setLoading(false)
      return
    }

    const p = postData as Post
    setPost(p)
    setChartData(generateClickHistory(p.clicks ?? 0, p.created_at))

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", p.user_id)
      .single()

    if (profileData) setSeller(profileData as Profile)
    setLoading(false)
  }, [postId])

  useEffect(() => { fetchPost() }, [fetchPost])

  // ── Toggle click ─────────────────────────────────────────────────
  const toggleClick = async () => {
    if (!userId) { router.push("/login"); return }
    if (!post) return
    const nowClicked = !clicked
    setClicked(nowClicked)
    const newCount = nowClicked ? (post.clicks ?? 0) + 1 : (post.clicks ?? 0) - 1
    setPost(prev => prev ? { ...prev, clicks: newCount } : prev)
    setChartData(generateClickHistory(newCount, post.created_at))
    await supabase.from("postings").update({ clicks: newCount }).eq("id", post.id)
  }

  // ── Share ─────────────────────────────────────────────────────────
  const sharePost = () => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: post?.title ?? "UniMart Product", url })
    } else {
      navigator.clipboard.writeText(url)
      setShareMsg("Link copied!")
      setTimeout(() => setShareMsg(""), 2500)
    }
  }

  const timeAgo = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1)   return "Just now"
    if (m < 60)  return `${m} minute${m !== 1 ? "s" : ""} ago`
    const h = Math.floor(m / 60)
    if (h < 24)  return `${h} hour${h !== 1 ? "s" : ""} ago`
    const d = Math.floor(h / 24)
    return `${d} day${d !== 1 ? "s" : ""} ago`
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })

  const waLink = (() => {
    const raw   = String(seller?.whatsapp_number ?? "")
    const clean = raw.replace(/\D/g, "")
    return clean
      ? `https://wa.me/${clean}?text=Hi%2C%20I%27m%20interested%20in%20%22${encodeURIComponent(post?.title ?? "")}%22`
      : null
  })()

  const tags       = normalizeTags(post?.tags)
  const maxClicks  = Math.max(...chartData.map(d => d.clicks), 1)
  const peakClicks = Math.max(...chartData.map(d => d.clicks))

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100dvh", background:"#f4f6fb", display:"flex", flexDirection:"column" }}>
      <div style={{ background:"linear-gradient(135deg,#0f1f6e,#1a2a9a)", height:62, display:"flex", alignItems:"center", padding:"0 16px" }}>
        <button onClick={() => router.back()} style={{ background:"rgba(255,255,255,0.12)", border:"none", cursor:"pointer", width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"white" }}>
          <ArrowLeft size={17} />
        </button>
      </div>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
        <Loader2 size={32} color="#0f1f6e" style={{ animation:"spin 0.9s linear infinite" }} />
        <p style={{ color:"#94a3b8", fontFamily:"'DM Sans',sans-serif", fontSize:"0.88rem" }}>Loading product…</p>
      </div>
    </div>
  )

  // ── Error ─────────────────────────────────────────────────────────
  if (error || !post) return (
    <div style={{ minHeight:"100dvh", background:"#f4f6fb", display:"flex", flexDirection:"column" }}>
      <div style={{ background:"linear-gradient(135deg,#0f1f6e,#1a2a9a)", height:62, display:"flex", alignItems:"center", padding:"0 16px" }}>
        <button onClick={() => router.back()} style={{ background:"rgba(255,255,255,0.12)", border:"none", cursor:"pointer", width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"white" }}>
          <ArrowLeft size={17} />
        </button>
      </div>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14, padding:"0 24px", textAlign:"center" }}>
        <AlertCircle size={40} color="#ef4444" />
        <p style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", fontSize:"1.1rem" }}>{error ?? "Something went wrong"}</p>
        <button onClick={() => router.push("/")} style={{ padding:"10px 24px", background:"#0f1f6e", color:"white", border:"none", borderRadius:12, fontFamily:"'DM Sans',sans-serif", fontWeight:700, cursor:"pointer" }}>
          ← Back to Home
        </button>
      </div>
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
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pop    { 0%,100%{transform:scale(1)} 40%{transform:scale(1.35)} 70%{transform:scale(0.9)} }
        @keyframes imgIn  { from{opacity:0;transform:scale(1.03)} to{opacity:1;transform:scale(1)} }

        /* ── NAV ── */
        .nav {
          background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 55%,#1e3bb0 100%);
          height:62px; padding:0 16px;
          display:flex; align-items:center; gap:12px;
          box-shadow:0 2px 18px rgba(13,29,110,0.38);
          position:sticky; top:0; z-index:50;
        }
        .back-btn { background:rgba(255,255,255,0.12); border:none; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; transition:background .15s; flex-shrink:0; }
        .back-btn:hover { background:rgba(255,255,255,0.22); }
        .nav-title { font-family:'Playfair Display',serif; color:white; font-weight:700; font-size:0.95rem; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .share-btn { background:rgba(255,255,255,0.12); border:none; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; transition:all .15s; flex-shrink:0; position:relative; }
        .share-btn:hover { background:rgba(255,255,255,0.22); }
        .share-toast { position:absolute; top:44px; right:0; background:#1e293b; color:white; font-size:0.7rem; font-weight:700; padding:5px 12px; border-radius:8px; white-space:nowrap; font-family:'DM Sans',sans-serif; pointer-events:none; animation:fadeUp .2s ease; }

        /* ── PAGE ── */
        .page { max-width:820px; margin:0 auto; padding:24px 16px 72px; animation:fadeUp .3s ease; }

        /* ── IMAGE ── */
        .img-wrap {
          width:100%; border-radius:16px; overflow:hidden;
          background:linear-gradient(135deg,#eef2ff,#e0e7ff);
          box-shadow:0 4px 28px rgba(13,29,110,0.13);
          margin-bottom:20px; position:relative;
          aspect-ratio:4/3;
        }
        @media(min-width:600px) { .img-wrap { aspect-ratio:16/9; } }
        .img-wrap img { width:100%; height:100%; object-fit:cover; display:block; animation:imgIn .4s ease; }
        .img-no { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; }
        .price-badge { position:absolute; bottom:14px; left:14px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; font-family:'DM Sans',sans-serif; font-weight:800; font-size:1.1rem; padding:8px 20px; border-radius:999px; box-shadow:0 4px 16px rgba(234,88,12,0.45); }
        .cat-badge { position:absolute; top:14px; left:14px; background:rgba(15,31,110,0.82); backdrop-filter:blur(6px); color:white; font-size:0.7rem; font-weight:700; padding:5px 12px; border-radius:999px; font-family:'DM Sans',sans-serif; }
        .verified-badge { position:absolute; top:14px; right:14px; background:rgba(15,31,110,0.82); backdrop-filter:blur(6px); color:white; font-size:0.68rem; font-weight:700; padding:5px 12px; border-radius:999px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:5px; }

        /* ── CARDS ── */
        .card { background:white; border-radius:16px; box-shadow:0 2px 16px rgba(13,29,110,0.07); border:1px solid #eef2ff; padding:20px; margin-bottom:16px; }

        /* ── TITLE ── */
        .post-title { font-family:'Playfair Display',serif; font-weight:800; color:#0f172a; font-size:clamp(1.3rem,4vw,1.85rem); line-height:1.25; margin-bottom:14px; }
        .meta-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .meta-chip { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:999px; font-size:0.74rem; font-weight:600; font-family:'DM Sans',sans-serif; }
        .meta-chip.date { background:#f1f5f9; color:#64748b; }
        .meta-chip.cat  { background:#eef2ff; color:#0f1f6e; }
        .meta-chip.exp  { background:#fff7ed; color:#c2410c; }

        /* ── CLICKS ── */
        .clicks-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .click-num { font-family:'Playfair Display',serif; font-weight:800; color:#0f1f6e; font-size:2rem; line-height:1; }
        .click-lbl { font-size:0.74rem; color:#64748b; font-family:'DM Sans',sans-serif; margin-top:2px; }
        .click-icon { margin-left:4px; }
        .click-btn { margin-left:auto; display:inline-flex; align-items:center; gap:7px; padding:10px 20px; border-radius:999px; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:700; font-size:0.84rem; transition:all .2s; }
        .click-btn.off { background:#f1f5f9; color:#64748b; }
        .click-btn.off:hover { background:#eef2ff; color:#0f1f6e; }
        .click-btn.on { background:linear-gradient(135deg,#0f1f6e,#1a2a9a); color:white; box-shadow:0 4px 14px rgba(15,31,110,0.3); }
        .click-btn.on svg { animation:pop .35s ease; }
        @media(max-width:480px) { .click-btn { width:100%; justify-content:center; margin-left:0; } }

        /* ── SELLER ── */
        .seller-row { display:flex; align-items:center; gap:14px; }
        .seller-av { width:56px; height:56px; border-radius:50%; flex-shrink:0; overflow:hidden; border:2.5px solid #e2e8f0; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:800; color:white; background:linear-gradient(135deg,#0f1f6e,#f97316); }
        .seller-av img { width:100%; height:100%; object-fit:cover; }
        .seller-info { flex:1; min-width:0; }
        .seller-name { font-family:'DM Sans',sans-serif; font-weight:700; color:#0f172a; font-size:0.97rem; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .seller-school { font-size:0.78rem; color:#64748b; font-family:'DM Sans',sans-serif; margin-top:4px; display:flex; align-items:center; gap:5px; }
        .seller-handle { font-size:0.72rem; color:#94a3b8; font-family:'DM Sans',sans-serif; margin-top:3px; }
        .view-profile { display:inline-flex; align-items:center; gap:5px; padding:8px 16px; border:1.5px solid #e2e8f0; border-radius:999px; font-size:0.76rem; font-weight:700; color:#0f1f6e; background:#f8fafc; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all .15s; text-decoration:none; white-space:nowrap; flex-shrink:0; }
        .view-profile:hover { background:#eef2ff; border-color:#c7d2fe; }

        /* ── VERIFIED BANNER ── */
        .verified-banner { display:flex; align-items:center; gap:10px; padding:11px 16px; background:linear-gradient(135deg,#eef2ff,#e0e7ff); border-radius:12px; border:1.5px solid #c7d2fe; margin-top:14px; }
        .verified-banner-text { font-size:0.78rem; font-weight:700; color:#0f1f6e; font-family:'DM Sans',sans-serif; }
        .verified-banner-sub  { font-size:0.68rem; color:#64748b; font-family:'DM Sans',sans-serif; margin-top:1px; }

        /* ── CONTACT ── */
        .contact-wa { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; padding:15px; border-radius:14px; background:linear-gradient(135deg,#25D366,#128C7E); color:white; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:800; font-size:1rem; text-decoration:none; transition:all .2s; box-shadow:0 6px 20px rgba(37,211,102,0.35); }
        .contact-wa:hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(37,211,102,0.45); color:white; }
        .no-contact { text-align:center; padding:14px; color:#94a3b8; font-size:0.82rem; font-family:'DM Sans',sans-serif; background:#f8fafc; border-radius:12px; border:1.5px dashed #e2e8f0; }

        /* ── DESCRIPTION ── */
        .desc { font-size:0.92rem; color:#334155; font-family:'DM Sans',sans-serif; line-height:1.8; white-space:pre-wrap; }

        /* ── TAGS ── */
        .tags-wrap { display:flex; flex-wrap:wrap; gap:8px; }
        .tag-chip { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; background:#f1f5f9; border:1.5px solid #e2e8f0; border-radius:999px; font-size:0.76rem; font-weight:700; color:#0f1f6e; font-family:'DM Sans',sans-serif; }

        /* ── SECTION HEADER ── */
        .sec-head { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
        .sec-head-title { font-family:'Playfair Display',serif; font-weight:700; color:#0f1f6e; font-size:1rem; white-space:nowrap; }
        .sec-head-line { flex:1; height:1.5px; background:linear-gradient(90deg,#c7d2fe,transparent); }

        /* ── CHART ── */
        .chart-bars { display:flex; align-items:flex-end; gap:4px; height:120px; padding-bottom:4px; }
        .bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0; }
        .bar { width:100%; border-radius:6px 6px 0 0; transition:height .6s cubic-bezier(.4,0,.2,1); min-height:3px; cursor:default; position:relative; }
        .bar:hover::after { content:attr(data-val); position:absolute; top:-22px; left:50%; transform:translateX(-50%); background:#0f1f6e; color:white; font-size:0.6rem; font-weight:700; padding:2px 7px; border-radius:4px; white-space:nowrap; font-family:'DM Sans',sans-serif; }
        .bar-lbl { font-size:0.56rem; color:#94a3b8; font-family:'DM Sans',sans-serif; text-align:center; white-space:nowrap; overflow:hidden; width:100%; text-overflow:ellipsis; }
        .chart-summary { display:flex; gap:12px; margin-top:16px; padding-top:16px; border-top:1px solid #f1f5f9; flex-wrap:wrap; }
        .stat-box { flex:1; min-width:70px; text-align:center; padding:10px 8px; background:#f8fafc; border-radius:12px; }
        .stat-num { font-family:'Playfair Display',serif; font-weight:800; color:#0f1f6e; font-size:1.3rem; }
        .stat-lbl { font-size:0.66rem; color:#94a3b8; font-family:'DM Sans',sans-serif; margin-top:3px; }
      `}</style>

      {/* ── NAV ── */}
      <nav className="nav">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={17} />
        </button>
        <span className="nav-title">{post.title}</span>
       
        
      </nav>

      <div className="page">

        {/* ── IMAGE ── */}
        <div className="img-wrap">
          {post.image_url ? (
            <img
              src={post.image_url}
              alt={post.title}
              onLoad={() => setImgLoaded(true)}
              style={{ opacity: imgLoaded ? 1 : 0, transition:"opacity .35s" }}
            />
          ) : (
            <div className="img-no">
              <Tag size={52} color="#c7d2fe" />
              <span style={{ color:"#a5b4fc", fontSize:"0.82rem", fontFamily:"'DM Sans',sans-serif" }}>No image available</span>
            </div>
          )}
          {post.price != null && (
            <div className="price-badge">GH₵ {Number(post.price).toFixed(2)}</div>
          )}
          {post.category && (
            <div className="cat-badge">{post.category}</div>
          )}
          {seller?.is_premium && (
            <div className="verified-badge"><ShieldCheck size={11} /> Verified Seller</div>
          )}
        </div>

        {/* ── TITLE + META ── */}
        <div className="card">
          <h1 className="post-title">{post.title}</h1>
          <div className="meta-row">
            <span className="meta-chip date">
              <Clock size={12} /> Posted {timeAgo(post.created_at)}
            </span>
            {post.category && (
              <span className="meta-chip cat">
                <Store size={12} /> {post.category}
              </span>
            )}
           
          </div>
        </div>

        {/* ── CLICKS ── */}
        <div className="card" style={{ padding:"16px 20px" }}>
          <div className="clicks-row">
            <div>
              <div className="click-num">{post.clicks ?? 0}</div>
              <div className="click-lbl">people clicked this</div>
            </div>
            <MousePointerClick size={26} color="#c7d2fe" className="click-icon" />
            <button
              className={`click-btn ${clicked ? "on" : "off"}`}
              onClick={toggleClick}
            >
              <MousePointerClick size={15} />
              {clicked ? "Clicked!" : "Click to Show Interest"}
            </button>
          </div>
        </div>

        {/* ── SELLER ── */}
        <div className="card">
          <div className="sec-head">
            <User size={15} color="#0f1f6e" />
            <span className="sec-head-title">Seller</span>
            <div className="sec-head-line" />
          </div>

          {seller ? (
            <>
              <div className="seller-row">
                <div className="seller-av">
                  {seller.avatar_url
                    ? <img src={seller.avatar_url} alt={seller.username} />
                    : (seller.full_name || seller.username || "S")[0].toUpperCase()
                  }
                </div>
                <div className="seller-info">
                  <div className="seller-name">
                    {seller.full_name || seller.username || "Anonymous Seller"}
                    {seller.is_premium && <ShieldCheck size={14} color="#0f1f6e" />}
                  </div>
                  {seller.school && (
                    <div className="seller-school">
                      <School size={12} /> {seller.school}
                    </div>
                  )}
                  
                </div>
                <a href={`/profile/${post.user_id}`} className="view-profile">
                  Profile <ChevronRight size={13} />
                </a>
              </div>

              {seller.is_premium && (
                <div className="verified-banner">
                  <ShieldCheck size={20} color="#0f1f6e" />
                  <div>
                    <div className="verified-banner-text">Verified Seller</div>
                    <div className="verified-banner-sub">This seller has been verified by UniMart</div>
                  </div>
                </div>
              )}

              {/* ── CONTACT ── */}
              <div style={{ marginTop:20 }}>
                <div className="sec-head">
                  <MessageSquare size={15} color="#0f1f6e" />
                  <span className="sec-head-title">Contact Seller</span>
                  <div className="sec-head-line" />
                </div>
                {waLink ? (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="contact-wa">
                    <MessageSquare size={20} /> Chat on WhatsApp
                  </a>
                ) : (
                  <div className="no-contact">No contact info available for this seller.</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"20px 0", color:"#94a3b8", fontSize:"0.84rem", fontFamily:"'DM Sans',sans-serif" }}>
              Seller info unavailable
            </div>
          )}
        </div>

        {/* ── DESCRIPTION ── */}
        {post.content && (
          <div className="card">
            <div className="sec-head">
              <Tag size={15} color="#0f1f6e" />
              <span className="sec-head-title">Description</span>
              <div className="sec-head-line" />
            </div>
            <p className="desc">{post.content}</p>
          </div>
        )}

        {/* ── TAGS ── */}
        {tags.length > 0 && (
          <div className="card">
            <div className="sec-head">
              <Tag size={15} color="#0f1f6e" />
              <span className="sec-head-title">Tags</span>
              <div className="sec-head-line" />
            </div>
            <div className="tags-wrap">
              {tags.map((t, i) => (
                <span key={i} className="tag-chip">
                  <Tag size={11} /> #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        <div className="card">
          <div className="sec-head">
            <TrendingUp size={15} color="#0f1f6e" />
            <span className="sec-head-title">Click Analytics</span>
            <div className="sec-head-line" />
          </div>

          {chartData.length > 0 ? (
            <>
              <div style={{ fontSize:"0.72rem", color:"#94a3b8", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }}>
                Daily clicks since posting
              </div>

              <div className="chart-bars">
                {chartData.map((d, i) => {
                  const pct     = maxClicks > 0 ? (d.clicks / maxClicks) * 100 : 0
                  const isPeak  = d.clicks === peakClicks && peakClicks > 0
                  return (
                    <div key={i} className="bar-col">
                      <div
                        className="bar"
                        data-val={d.clicks}
                        style={{
                          height: `${Math.max(pct, 3)}%`,
                          background: isPeak
                            ? "linear-gradient(180deg,#f97316,#ea580c)"
                            : "linear-gradient(180deg,#0f1f6e,#4f6fd8)",
                          opacity: 0.35 + (pct / 100) * 0.65,
                        }}
                      />
                      <span className="bar-lbl">{d.day}</span>
                    </div>
                  )
                })}
              </div>

              <div className="chart-summary">
                <div className="stat-box">
                  <div className="stat-num">{post.clicks ?? 0}</div>
                  <div className="stat-lbl">Total Clicks</div>
                </div>
                <div className="stat-box">
                  <div className="stat-num">{peakClicks}</div>
                  <div className="stat-lbl">Best Day</div>
                </div>
                <div className="stat-box">
                  <div className="stat-num">
                    {chartData.length > 0 ? Math.round((post.clicks ?? 0) / chartData.length) : 0}
                  </div>
                  <div className="stat-lbl">Avg / Day</div>
                </div>
                <div className="stat-box">
                  <div className="stat-num">{chartData.length}</div>
                  <div className="stat-lbl">Days Listed</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"20px 0", color:"#94a3b8", fontSize:"0.82rem", fontFamily:"'DM Sans',sans-serif" }}>
              No click data yet.
            </div>
          )}
        </div>

        {/* ── FOOTER NOTE ── */}
        <div style={{ textAlign:"center", padding:"8px 0 0", color:"#cbd5e1", fontSize:"0.72rem", fontFamily:"'DM Sans',sans-serif" }}>
          Listed on {formatDate(post.created_at)}
        </div>

      </div>
    </>
  )
}