"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

import {
  Search, MessageSquare, ShoppingBag, Upload, User,
  X, ChevronDown, Loader2, Tag, RefreshCw, AlertCircle,
  ShieldCheck, SlidersHorizontal, MousePointerClick, LogOut,
  Lightbulb, LayoutGrid, Rows3
} from "lucide-react"

const PAGE_SIZE = 12

type Profile = {
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
  tags: string[] | null
  profiles?: Profile
}

type ViewMode = "grid" | "feed"

export default function HomeClient() {
  const router = useRouter()

  // Auth
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ username: string; avatar_url: string | null } | null>(null)

  // Posts
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [clickedIds, setClickedIds] = useState<Set<string>>(new Set())
  const [clickLoading, setClickLoading] = useState<Set<string>>(new Set())

  // Filters
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [schoolFilter, setSchoolFilter] = useState("All")
  const [tagFilter, setTagFilter] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [schools, setSchools] = useState<string[]>([])

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("feed")

  // ── Debounce search ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 380)
    return () => clearTimeout(t)
  }, [search])

  // ── Auth ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        const { data } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", session.user.id)
          .single()
        setUserProfile(data)
      }
    })
  }, [])

  // ── Logout ──────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUserId(null)
    setUserProfile(null)
    router.push("/")
  }

  // ── Fetch distinct schools ──────────────────────────────────────
  useEffect(() => {
    supabase
      .from("profiles")
      .select("school")
      .not("school", "is", null)
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: any) => r.school).filter(Boolean))] as string[]
        setSchools(unique.sort())
      })
  }, [])

  // ── Fetch posts + profiles ──────────────────────────────────────
  const fetchPosts = useCallback(async (pageNum: number, replace: boolean) => {
    pageNum === 0 ? setLoading(true) : setLoadingMore(true)
    setError(null)

    try {
      const now = new Date().toISOString()

      let query = supabase
        .from("postings")
        .select("id, user_id, title, content, image_url, created_at, clicks, comments_count, price, expires_at, category, tags")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

      if (debouncedSearch) query = query.or(`title.ilike.%${debouncedSearch}%,content.ilike.%${debouncedSearch}%`)
      if (tagFilter.trim()) query = query.contains("tags", [tagFilter.trim().toLowerCase()])

      const { data: postData, error: fetchError } = await query
      if (fetchError) throw fetchError

      const results = (postData ?? []) as Post[]

      if (results.length > 0) {
        const userIds = [...new Set(results.map(p => p.user_id))]

        const { data: profileData, error: profErr } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds)

        if (!profErr && profileData) {
          const filteredProfiles = schoolFilter !== "All"
            ? profileData.filter((p: any) => p.school === schoolFilter)
            : profileData

          const profileMap: Record<string, Profile> = Object.fromEntries(
            filteredProfiles.map((p: any) => [p.id, {
              username: p.username ?? "",
              full_name: p.full_name ?? null,
              school: p.school ?? null,
              avatar_url: p.avatar_url ?? null,
              whatsapp_number: p.whatsapp_number ?? null,
              is_premium: p.is_premium ?? false,
            }])
          )

          results.forEach(p => { p.profiles = profileMap[p.user_id] })

          if (schoolFilter !== "All") {
            const filtered = results.filter(p => p.profiles !== undefined)
            setHasMore(filtered.length === PAGE_SIZE)
            setPosts(prev => replace ? filtered : [...prev, ...filtered])
            return
          }
        }
      }

      setHasMore(results.length === PAGE_SIZE)
      setPosts(prev => replace ? results : [...prev, ...results])
    } catch (err: any) {
      setError(err.message || "Failed to load posts.")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, schoolFilter, tagFilter])

  useEffect(() => {
    setPage(0)
    fetchPosts(0, true)
  }, [fetchPosts])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchPosts(next, false)
  }

  // ── Click toggle ────────────────────────────────────────────────
  const toggleClick = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation()
    if (!userId) { router.push("/login"); return }
    if (clickLoading.has(postId)) return
    setClickLoading(prev => new Set(prev).add(postId))

    const isClicked = clickedIds.has(postId)

    setClickedIds(prev => {
      const n = new Set(prev)
      isClicked ? n.delete(postId) : n.add(postId)
      return n
    })
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, clicks: Math.max(0, (p.clicks ?? 0) + (isClicked ? -1 : 1)) }
          : p
      )
    )

    try {
      const { data: current, error: fetchErr } = await supabase
        .from("postings")
        .select("clicks")
        .eq("id", postId)
        .single()

      if (fetchErr) throw fetchErr

      const newClicks = Math.max(0, (current.clicks ?? 0) + (isClicked ? -1 : 1))

      const { error: updateErr } = await supabase
        .from("postings")
        .update({ clicks: newClicks })
        .eq("id", postId)

      if (updateErr) throw updateErr

      setPosts(prev =>
        prev.map(p => p.id === postId ? { ...p, clicks: newClicks } : p)
      )
    } catch (err: any) {
      setClickedIds(prev => {
        const n = new Set(prev)
        isClicked ? n.add(postId) : n.delete(postId)
        return n
      })
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, clicks: Math.max(0, (p.clicks ?? 0) + (isClicked ? 1 : -1)) }
            : p
        )
      )
      console.error("Click update failed:", err.message)
    } finally {
      setClickLoading(prev => {
        const n = new Set(prev)
        n.delete(postId)
        return n
      })
    }
  }

  const timeAgo = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1) return "Just now"
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const activeFilters = [schoolFilter !== "All", !!tagFilter.trim()].filter(Boolean).length

  const buildCardData = (post: Post) => {
    const p = post.profiles
    const displayName = p?.full_name || p?.username || "Seller"
    const initials = displayName.slice(0, 1).toUpperCase()
    const isClicked = clickedIds.has(post.id)
    const isClickLoading = clickLoading.has(post.id)
    const rawNum = String(p?.whatsapp_number ?? "")
    const cleanNum = rawNum.replace(/\D/g, "")
    const waLink = cleanNum
      ? `https://wa.me/${cleanNum}?text=Hi%2C%20I%27m%20interested%20in%20%22${encodeURIComponent(post.title)}%22`
      : null
    return { p, displayName, initials, isClicked, isClickLoading, waLink }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea { font-size: 16px !important; }
        body { background: #ffffff; font-family: 'DM Sans', system-ui, sans-serif; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes pop     { 0%,100%{transform:scale(1)} 40%{transform:scale(1.4)} 70%{transform:scale(0.9)} }
        @keyframes fadein  { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }

        .nav { background:linear-gradient(135deg,#0f1f6e 0%,#162380 55%,#1a2a9a 100%); box-shadow:0 4px 28px rgba(13,29,110,0.38); position:sticky; top:0; z-index:60; }
        .nav-inner { max-width:1280px; margin:0 auto; padding:0 12px; display:flex; align-items:center; gap:10px; height:60px; }
        .logo { width:54px; height:54px; object-fit:contain; flex-shrink:0; }
        .srch-wrap { flex:1; position:relative; max-width:460px; }
        .srch { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.13); border:1.5px solid rgba(255,255,255,0.2); border-radius:999px; padding:9px 14px; transition:all 0.2s; width:100%; }
        .srch:focus-within { background:rgba(255,255,255,0.18); border-color:rgba(251,146,60,0.8); box-shadow:0 0 0 3px rgba(251,146,60,0.18); }
        .srch input { background:none; border:none; outline:none; color:white; font-family:'DM Sans',sans-serif; font-size:16px !important; width:100%; min-width:0; }
        .srch input::placeholder { color:rgba(255,255,255,0.45); }
        .srch-clear { background:rgba(255,255,255,0.15); border:none; cursor:pointer; display:flex; padding:2px; border-radius:50%; flex-shrink:0; transition:background 0.15s; }
        .srch-clear:hover { background:rgba(255,255,255,0.25); }
        .nav-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; margin-left:auto; }
        .btn-upload { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:999px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:700; text-decoration:none; border:none; cursor:pointer; box-shadow:0 4px 14px rgba(234,88,12,0.38); transition:all 0.2s; white-space:nowrap; }
        .btn-upload:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(234,88,12,0.48); color:white; }
        .btn-login { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:999px; background:rgba(255,255,255,0.1); color:white; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:700; text-decoration:none; border:1.5px solid rgba(255,255,255,0.25); transition:all 0.2s; white-space:nowrap; }
        .btn-login:hover { background:rgba(255,255,255,0.2); color:white; }
        .av-ring { width:38px; height:38px; border-radius:50%; border:2.5px solid #f97316; overflow:hidden; cursor:pointer; flex-shrink:0; text-decoration:none; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#f97316,#ea580c); color:white; font-weight:700; font-size:0.88rem; transition:transform 0.2s; }
        .av-ring:hover { transform:scale(1.08); }
        .av-ring img { width:100%; height:100%; object-fit:cover; }
        .logout-btn { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,0.1); border:1.5px solid rgba(255,255,255,0.2); cursor:pointer; transition:all 0.2s; color:rgba(255,255,255,0.7); flex-shrink:0; }
        .logout-btn:hover { background:rgba(239,68,68,0.25); border-color:rgba(239,68,68,0.5); color:#fca5a5; }
        @media(max-width:480px) {
          .btn-upload .upload-label { display:none; }
          .btn-upload { padding:7px 10px; }
          .logo { width:44px; height:44px; }
        }

        .hero { background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 45%,#c2410c 100%); padding:44px 20px 88px; position:relative; overflow:hidden; text-align:center; }
        .hero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 75% 50%,rgba(251,146,60,0.22) 0%,transparent 60%),radial-gradient(ellipse at 20% 80%,rgba(99,102,241,0.14) 0%,transparent 55%); pointer-events:none; }
        .hero::after  { content:''; position:absolute; bottom:-1px; left:0; right:0; height:60px; background:#f4f6fb; clip-path:ellipse(55% 100% at 50% 100%); }
        .hero-pat { position:absolute; inset:0; opacity:0.04; background-image:repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 38px); }
        .hero-in  { position:relative; z-index:1; max-width:620px; margin:0 auto; }
        .hero-badge { display:inline-flex; align-items:center; gap:7px; background:rgba(255,255,255,0.1); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.22); color:rgba(255,255,255,0.85); padding:6px 18px; border-radius:999px; font-size:0.7rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:18px; font-family:'DM Sans',sans-serif; }

        .fbar { background:white; box-shadow:0 2px 20px rgba(13,29,110,0.07); padding:12px 16px; position:sticky; top:60px; z-index:40; }
        .fbar-inner { max-width:1280px; margin:0 auto; display:flex; gap:10px; align-items:center; }
        .filt-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; border-radius:12px; border:1.5px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:0.82rem; font-weight:600; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; white-space:nowrap; flex-shrink:0; }
        .filt-btn.on { border-color:#f97316; background:#fff7ed; color:#ea580c; }
        .filt-btn:hover:not(.on) { border-color:#c7d2fe; color:#0f1f6e; background:#eef2ff; }
        .view-toggle { display:inline-flex; border:1.5px solid #e2e8f0; border-radius:12px; overflow:hidden; flex-shrink:0; }
        .vt-btn { display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:7px 12px; border:none; background:#f8fafc; color:#94a3b8; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
        .vt-btn.on { background:linear-gradient(135deg,#0f1f6e,#1a2a9a); color:white; }
        .vt-btn:not(.on):hover { background:#eef2ff; color:#0f1f6e; }
        .sugg-bar-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; border-radius:12px; border:1.5px solid #e2e8f0; background:linear-gradient(135deg,#eef2ff,#e0e7ff); color:#0f1f6e; font-size:0.82rem; font-weight:700; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; white-space:nowrap; flex-shrink:0; margin-left:auto; }
        .sugg-bar-btn:hover { background:linear-gradient(135deg,#0f1f6e,#1a2a9a); color:white; border-color:#0f1f6e; }

        .fpanel { background:white; border-top:1px solid #f1f5f9; padding:16px 16px 0; }
        .fpanel-inner { max-width:1280px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:14px; padding-bottom:16px; }
        .flabel { display:block; font-size:0.68rem; font-weight:700; color:#0f1f6e; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:6px; }
        .fselect { width:100%; padding:9px 32px 9px 12px; border:1.5px solid #e2e8f0; border-radius:12px; font-family:'DM Sans',sans-serif; color:#1e293b; background:#f8fafc url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 10px center; outline:none; cursor:pointer; appearance:none; }
        .fselect:focus { border-color:#f97316; box-shadow:0 0 0 3px rgba(249,115,22,0.1); }
        .finput { width:100%; padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:12px; font-family:'DM Sans',sans-serif; color:#1e293b; background:#f8fafc; outline:none; }
        .finput:focus { border-color:#f97316; box-shadow:0 0 0 3px rgba(249,115,22,0.1); }

        .main { max-width:1280px; margin:0 auto; padding:28px 16px 64px; }

        .pgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
        @media(min-width:640px)  { .pgrid { grid-template-columns:repeat(3,1fr); gap:16px; } }
        @media(min-width:960px)  { .pgrid { grid-template-columns:repeat(4,1fr); gap:18px; } }
        @media(min-width:1200px) { .pgrid { grid-template-columns:repeat(5,1fr); gap:20px; } }

        .card { background: #000102; border-radius:12px; overflow:hidden; box-shadow:0 1px 8px rgba(13,29,110,0.07); border:1px solid #eef2ff; display:flex; flex-direction:column; cursor:pointer; transition:all 0.2s ease; animation:fadeUp 0.3s ease both; }
        .card:hover { transform:translateY(-4px); box-shadow:0 12px 40px rgba(13,29,110,0.15); border-color:#c7d2fe; }
        .card-img { position:relative; aspect-ratio:3/4; background:linear-gradient(135deg,#eef2ff,#e0e7ff); overflow:hidden; flex-shrink:0; }
        .card-img img { width:100%; height:100%; object-fit:cover; transition:transform 0.4s ease; display:block; }
        .card:hover .card-img img { transform:scale(1.06); }
        .no-img { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; }
        .ptag { position:absolute; top:8px; left:8px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; padding:4px 10px; border-radius:999px; font-size:0.72rem; font-weight:700; font-family:'DM Sans',sans-serif; box-shadow:0 2px 8px rgba(234,88,12,0.4); z-index:2; }
        .vtag { position:absolute; top:8px; right:8px; background:rgba(15,31,110,0.88); backdrop-filter:blur(4px); color:white; padding:3px 8px; border-radius:999px; font-size:0.6rem; font-weight:700; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:3px; z-index:2; }
        .card-body { padding:11px 12px 13px; display:flex; flex-direction:column; gap:8px; flex:1; }
        .srow { display:flex; align-items:center; gap:7px; cursor:pointer; }
        .sav { width:26px; height:26px; border-radius:50%; object-fit:cover; flex-shrink:0; border:1.5px solid #e2e8f0; }
        .sav-fb { width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,#0f1f6e,#f97316); display:flex; align-items:center; justify-content:center; font-size:0.62rem; font-weight:700; color:white; flex-shrink:0; }
        .sinfo { min-width:0; flex:1; }
        .sname { font-size:0.72rem; font-weight:700; color:#0f1f6e; font-family:'DM Sans',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.25; }
        .sschool { font-size:0.62rem; color:#94a3b8; font-family:'DM Sans',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.25; }
        .ctitle { font-family:'Playfair Display',serif; font-weight:700; color:#0f172a; font-size:clamp(0.78rem,1.8vw,0.9rem); line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .cfoot { display:flex; align-items:center; justify-content:space-between; padding-top:9px; border-top:1px solid #f1f5f9; margin-top:auto; gap:6px; }
        .click-btn { display:inline-flex; align-items:center; gap:4px; background:none; border:none; cursor:pointer; padding:4px 8px; border-radius:8px; font-size:0.76rem; font-weight:700; color:#94a3b8; font-family:'DM Sans',sans-serif; transition:all 0.15s; flex-shrink:0; }
        .click-btn:hover { background:#eef2ff; color:#0f1f6e; }
        .click-btn.on { color:#0f1f6e; background:#eef2ff; }
        .click-btn.on svg { animation:pop 0.35s ease; }
        .wbtn { display:inline-flex; align-items:center; gap:4px; background:linear-gradient(135deg,#25D366,#128C7E); color:white; padding:6px 11px; border-radius:999px; font-size:0.7rem; font-weight:700; font-family:'DM Sans',sans-serif; text-decoration:none; border:none; cursor:pointer; transition:all 0.2s; flex-shrink:0; box-shadow:0 2px 8px rgba(37,211,102,0.3); }
        .wbtn:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(37,211,102,0.4); color:white; }
        .no-wa { font-size:0.68rem; color:#cbd5e1; font-family:'DM Sans',sans-serif; }

        .pfeed { display:flex; flex-direction:column; gap:0; }
        .feed-card { background:white; border-bottom:8px solid #f4f6fb; cursor:pointer; transition:background 0.15s; animation:fadeUp 0.3s ease both; }
        .feed-card:hover { background:#fafbff; }
        .feed-head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 10px; gap:10px; }
        .feed-seller { display:flex; align-items:center; gap:10px; flex:1; min-width:0; cursor:pointer; }
        .feed-av { width:42px; height:42px; border-radius:50%; object-fit:cover; flex-shrink:0; border:2px solid #e2e8f0; }
        .feed-av-fb { width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,#0f1f6e,#f97316); display:flex; align-items:center; justify-content:center; font-size:1rem; font-weight:700; color:white; flex-shrink:0; }
        .feed-seller-info { min-width:0; flex:1; }
        .feed-seller-name { font-size:0.92rem; font-weight:700; color:#0f1f6e; font-family:'DM Sans',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .feed-seller-meta { font-size:0.72rem; color:#94a3b8; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:6px; margin-top:1px; }
        .feed-img-wrap { position:relative; width:100%; background:linear-gradient(135deg,#eef2ff,#e0e7ff); overflow:hidden; }
        .feed-img-wrap img { width:100%; display:block; max-height:520px; object-fit:cover; }
        .feed-no-img { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; height:220px; }
        .feed-price-tag { position:absolute; bottom:14px; left:14px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; padding:6px 16px; border-radius:999px; font-size:0.88rem; font-weight:700; font-family:'DM Sans',sans-serif; box-shadow:0 4px 14px rgba(234,88,12,0.45); }
        .feed-verified-tag { position:absolute; top:14px; right:14px; background:rgba(1,197,66,0.88); backdrop-filter:blur(4px); color:white; padding:5px 12px; border-radius:999px; font-size:0.72rem; font-weight:700; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:5px; }
        .feed-body { padding:14px 16px 0; }
        .feed-title { font-family:'Playfair Display',serif; font-weight:800; color:#0f172a; font-size:1.08rem; line-height:1.4; margin-bottom:6px; }
        .feed-desc { font-size:0.87rem; color:#64748b; font-family:'DM Sans',sans-serif; line-height:1.6; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
        .feed-tags { display:flex; flex-wrap:wrap; gap:6px; padding:10px 16px 0; }
        .feed-tag { display:inline-block; padding:3px 10px; background:#eef2ff; color:#4338ca; border-radius:999px; font-size:0.7rem; font-weight:600; font-family:'DM Sans',sans-serif; }
        .feed-actions { display:flex; align-items:stretch; border-top:1px solid #f1f5f9; margin-top:12px; }
        .feed-action-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:12px 8px; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:0.82rem; font-weight:700; color:#64748b; transition:all 0.15s; }
        .feed-action-btn:hover { background:#f8fafc; color:#0f1f6e; }
        .feed-action-btn.clicked { color:#0f1f6e; }
        .feed-action-btn.clicked svg { animation:pop 0.35s ease; }
        .feed-action-divider { width:1px; background:#f1f5f9; flex-shrink:0; }
        .feed-wa-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:12px 8px; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:0.82rem; font-weight:700; color:#16a34a; text-decoration:none; transition:all 0.15s; }
        .feed-wa-btn:hover { background:#f0fdf4; color:#15803d; }
        .feed-view-more {  display:block; text-align:center; padding:10px 16px 14px; font-size:0.8rem; font-weight:700; color:#f97316; font-family:'DM Sans',sans-serif; text-decoration:none; transition:color 0.15s; }
        .feed-view-more:hover { color:#ea580c; }

        .skel { background:linear-gradient(90deg,#f1f5f9 25%,#e8edf5 50%,#f1f5f9 75%); background-size:600px 100%; animation:shimmer 1.3s infinite; border-radius:8px; }
        .empty { text-align:center; padding:72px 24px; grid-column:1/-1; }

        .footer { background:linear-gradient(135deg,#0a1550 0%,#0f1f6e 60%,#1a1a1a 100%); padding:36px 20px 28px; }
        .footer-inner { max-width:1280px; margin:0 auto; }
        .lytrix-card { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:20px 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; margin-bottom:24px; }
        .lytrix-wa { display:inline-flex; align-items:center; gap:7px; padding:9px 20px; background:linear-gradient(135deg,#25D366,#128C7E); color:white; border-radius:999px; font-family:'DM Sans',sans-serif; font-size:0.82rem; font-weight:700; text-decoration:none; transition:all 0.2s; box-shadow:0 4px 14px rgba(37,211,102,0.3); white-space:nowrap; }
        .lytrix-wa:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(37,211,102,0.4); color:white; }

        @media(max-width:480px) {
          .card-body { padding:9px 10px 11px; gap:6px; }
          .wbtn { padding:5px 9px; font-size:0.66rem; }
          .ctitle { font-size:0.76rem; }
          .feed-title { font-size:1rem; }
          .feed-head { padding:12px 12px 8px; }
          .feed-body { padding:10px 12px 0; }
          .feed-tags { padding:8px 12px 0; }
          .feed-view-more { padding:8px 12px 12px;  }
        }
      `}</style>

      {/* ─── NAV ─── */}
      <header className="nav">
        <div className="nav-inner">
          <a href="/" style={{ textDecoration:'none', flexShrink:0 }}>
            <img src="/Unimart.png" alt="UniMart" className="logo" />
          </a>
          <div className="srch-wrap">
            <div className="srch">
              <Search size={15} color="rgba(255,255,255,0.5)" style={{ flexShrink:0 }} />
              <input
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="srch-clear" onClick={() => setSearch("")}>
                  <X size={13} color="rgba(255,255,255,0.6)" />
                </button>
              )}
            </div>
          </div>
          <div className="nav-actions">
            {userId && userProfile ? (
              <>
                <a href="/upload" className="btn-upload">
                  <Upload size={14} />
                  <span className="upload-label">Upload</span>
                </a>
                <a href="/profile" className="av-ring">
                  {userProfile.avatar_url
                    ? <img src={userProfile.avatar_url} alt={userProfile.username} />
                    : userProfile.username?.slice(0,1).toUpperCase()
                  }
                </a>
                <button className="logout-btn" onClick={handleLogout} title="Logout">
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <a href="/login" className="btn-login"><User size={14} /> Login</a>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <div className="hero">
        <div className="hero-pat" />
        <div className="hero-in">
          <div className="hero-badge"><ShoppingBag size={13} /> Campus Marketplace</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", color:'white', fontWeight:800, fontSize:'clamp(2rem,6vw,3.2rem)', lineHeight:1.18, marginBottom:12 }}>
            Shop Smart.<br /><span style={{ color:'#fb923c' }}>Shop UniMart.</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,0.68)', fontSize:'clamp(0.88rem,2.5vw,1rem)', fontFamily:"'DM Sans',sans-serif", maxWidth:400, margin:'0 auto' }}>
            Discover quality products from verified sellers in your university community.
          </p>
        </div>
      </div>

      {/* ─── FILTER BAR ─── */}
      <div className="fbar">
        <div className="fbar-inner">
          <button className={`filt-btn ${showFilters || activeFilters > 0 ? "on" : ""}`} onClick={() => setShowFilters(v => !v)}>
            <SlidersHorizontal size={14} /> Filters
            {activeFilters > 0 && (
              <span style={{ background:'#f97316', color:'white', borderRadius:999, padding:'1px 6px', fontSize:'0.68rem', fontWeight:700 }}>{activeFilters}</span>
            )}
          </button>
          {activeFilters > 0 && (
            <button className="filt-btn" style={{ color:'#ef4444', borderColor:'#fca5a5' }} onClick={() => { setSchoolFilter("All"); setTagFilter("") }}>
              <X size={13} /> Clear
            </button>
          )}
          <div className="view-toggle">
            <button className={`vt-btn ${viewMode === "grid" ? "on" : ""}`} onClick={() => setViewMode("grid")} title="Grid view">
              <LayoutGrid size={15} />
            </button>
            <button className={`vt-btn ${viewMode === "feed" ? "on" : ""}`} onClick={() => setViewMode("feed")} title="Feed view">
              <Rows3 size={15} />
            </button>
          </div>
          <button className="sugg-bar-btn" onClick={() => router.push("/suggestions")}>
            <Lightbulb size={14} /> Suggest
          </button>
        </div>
        {showFilters && (
          <div className="fpanel">
            <div className="fpanel-inner">
              <div>
                <span className="flabel">School</span>
                <select className="fselect" value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
                  <option value="All">All Schools</option>
                  {schools.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <span className="flabel">Tag</span>
                <input className="finput" placeholder="e.g. apple, textbook…" value={tagFilter} onChange={e => setTagFilter(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MAIN ─── */}
      <main className="main" style={{ padding: viewMode === "feed" ? "0 0 64px" : "28px 16px 64px", maxWidth: viewMode === "feed" ? "680px" : "1280px" }}>

        {!loading && viewMode === "grid" && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", color:'#0f1f6e', fontWeight:700, fontSize:'clamp(1.1rem,3vw,1.5rem)', marginBottom:6 }}>Featured Products</h2>
              <div style={{ height:3, width:72, background:'linear-gradient(90deg,#0f1f6e,#f97316)', borderRadius:2 }} />
            </div>
            <span style={{ fontSize:'0.82rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>
              {posts.length} item{posts.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {error && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', background:'#fff1f0', border:'1.5px solid #fca5a5', borderRadius:14, marginBottom:20, margin: viewMode === "feed" ? "16px 16px" : "0 0 20px" }}>
            <AlertCircle size={16} color="#dc2626" />
            <span style={{ fontSize:'0.85rem', color:'#dc2626', fontFamily:"'DM Sans',sans-serif" }}>{error}</span>
            <button onClick={() => fetchPosts(0, true)} style={{ marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:5, fontSize:'0.78rem', fontWeight:700, color:'#dc2626', background:'none', border:'none', cursor:'pointer' }}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          <div className="pgrid">
            {loading && Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ background:'white', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 8px rgba(13,29,110,0.07)' }}>
                <div className="skel" style={{ width:'100%', aspectRatio:'3/4' }} />
                <div style={{ padding:'11px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', gap:7, alignItems:'center' }}>
                    <div className="skel" style={{ width:26, height:26, borderRadius:'50%', flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div className="skel" style={{ height:9, width:'65%', marginBottom:5 }} />
                      <div className="skel" style={{ height:8, width:'45%' }} />
                    </div>
                  </div>
                  <div className="skel" style={{ height:12, width:'90%' }} />
                  <div className="skel" style={{ height:12, width:'55%' }} />
                </div>
              </div>
            ))}
            {!loading && posts.map((post, idx) => {
              const { p, displayName, initials, isClicked, isClickLoading, waLink } = buildCardData(post)
              return (
                <div key={post.id} className="card" style={{ animationDelay:`${(idx % PAGE_SIZE) * 30}ms` }} onClick={() => router.push(`/post/${post.id}`)}>
                  <div className="card-img">
                    {post.image_url
                      ? <img src={post.image_url} alt={post.title} loading="lazy" />
                      : <div className="no-img"><Tag size={28} color="#c7d2fe" /><span style={{ color:'#a5b4fc', fontSize:'0.65rem', fontFamily:"'DM Sans',sans-serif" }}>No image</span></div>
                    }
                    {post.price != null && <div className="ptag">GH₵ {Number(post.price).toFixed(2)}</div>}
                    {p?.is_premium && <div className="vtag"><ShieldCheck size={9} /> Verified</div>}
                  </div>
                  <div className="card-body">
                    <div className="srow" onClick={e => { e.stopPropagation(); router.push(`/profile/${post.user_id}`) }}>
                      {p?.avatar_url
                        ? <img src={p.avatar_url} alt={displayName} className="sav" />
                        : <div className="sav-fb">{initials}</div>
                      }
                      <div className="sinfo">
                        <div className="sname">{displayName}</div>
                        {p?.school && <div className="sschool">{p.school}</div>}
                      </div>
                      {p?.is_premium && <ShieldCheck size={12} color="#0f1f6e" style={{ flexShrink:0 }} />}
                    </div>
                    <h3 className="ctitle">{post.title}</h3>
                    <div className="cfoot">
                      <button className={`click-btn ${isClicked ? "on" : ""}`} onClick={e => toggleClick(e, post.id)} disabled={isClickLoading} title="Show interest">
                        <MousePointerClick size={14} color={isClicked ? "#0f1f6e" : "#94a3b8"} fill={isClicked ? "#c7d2fe" : "none"} />
                        {post.clicks ?? 0}
                      </button>
                      {waLink
                        ? <a href={waLink} target="_blank" rel="noopener noreferrer" className="wbtn" onClick={e => e.stopPropagation()}><MessageSquare size={11} /> Chat</a>
                        : <span className="no-wa">{timeAgo(post.created_at)}</span>
                      }
                    </div>
                  </div>
                </div>
              )
            })}
            {!loading && posts.length === 0 && !error && (
              <div className="empty">
                <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
                  <Tag size={32} color="#818cf8" />
                </div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:'1.15rem', color:'#0f1f6e', marginBottom:8 }}>No products found</h3>
                <p style={{ color:'#94a3b8', fontSize:'0.85rem', fontFamily:"'DM Sans',sans-serif", marginBottom:20, lineHeight:1.6 }}>
                  {search ? `No results for "${search}".` : "Be the first to list something!"}
                </p>
                {(search || activeFilters > 0) && (
                  <button onClick={() => { setSearch(""); setSchoolFilter("All"); setTagFilter("") }} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'10px 20px', background:'#0f1f6e', color:'white', borderRadius:12, border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:'0.85rem' }}>
                    <X size={14} /> Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* FEED VIEW */}
        {viewMode === "feed" && (
          <div className="pfeed">
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background:'white', borderBottom:'8px solid #f4f6fb' }}>
                <div style={{ padding:'14px 16px', display:'flex', gap:10, alignItems:'center' }}>
                  <div className="skel" style={{ width:42, height:42, borderRadius:'50%', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div className="skel" style={{ height:12, width:'50%', marginBottom:6 }} />
                    <div className="skel" style={{ height:10, width:'30%' }} />
                  </div>
                </div>
                <div className="skel" style={{ width:'100%', height:340 }} />
                <div style={{ padding:'14px 16px' }}>
                  <div className="skel" style={{ height:16, width:'80%', marginBottom:8 }} />
                  <div className="skel" style={{ height:12, width:'100%', marginBottom:5 }} />
                  <div className="skel" style={{ height:12, width:'65%' }} />
                </div>
              </div>
            ))}
            {!loading && posts.map((post, idx) => {
              const { p, displayName, initials, isClicked, isClickLoading, waLink } = buildCardData(post)
              return (
                <div key={post.id} className="feed-card" style={{ animationDelay:`${(idx % PAGE_SIZE) * 40}ms` }}>
                  <div className="feed-head">
                    <div className="feed-seller" onClick={e => { e.stopPropagation(); router.push(`/profile/${post.user_id}`) }}>
                      {p?.avatar_url
                        ? <img src={p.avatar_url} alt={displayName} className="feed-av" />
                        : <div className="feed-av-fb">{initials}</div>
                      }
                      <div className="feed-seller-info">
                        <div className="feed-seller-name">
                          {displayName}
                          {p?.is_premium && <ShieldCheck size={13} color="#0f1f6e" style={{ display:'inline', marginLeft:5, verticalAlign:'middle' }} />}
                        </div>
                        <div className="feed-seller-meta">
                          {p?.school && <span>{p.school}</span>}
                          {p?.school && <span>·</span>}
                          <span>{timeAgo(post.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {post.price != null && (
                      <div style={{ background:'linear-gradient(135deg,#ea580c,#f97316)', color:'white', padding:'5px 14px', borderRadius:999, fontSize:'0.82rem', fontWeight:700, fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>
                        GH₵ {Number(post.price).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="feed-img-wrap" onClick={() => router.push(`/post/${post.id}`)}>
                    {post.image_url
                      ? <img src={post.image_url} alt={post.title} loading="lazy" />
                      : <div className="feed-no-img"><Tag size={40} color="#c7d2fe" /><span style={{ color:'#a5b4fc', fontSize:'0.8rem', fontFamily:"'DM Sans',sans-serif" }}>No image</span></div>
                    }
                    {p?.is_premium && <div className="feed-verified-tag"><ShieldCheck size={11} /> Verified Seller</div>}
                  </div>
                  <div className="feed-body" onClick={() => router.push(`/post/${post.id}`)}>
                    <div className="feed-title">{post.title}</div>
                    {post.content && <div className="feed-desc">{post.content}</div>}
                  </div>
                  {(() => {
                    const tagsArr = Array.isArray(post.tags)
                      ? post.tags
                      : typeof post.tags === 'string' && (post.tags as string).trim()
                        ? (post.tags as string).replace(/[\[\]"]/g, '').split(',').map((t: string) => t.trim()).filter(Boolean)
                        : []
                    return tagsArr.length > 0 ? (
                      <div className="feed-tags">
                        {tagsArr.slice(0, 5).map((tag: string) => (
                          <span key={tag} className="feed-tag">#{tag}</span>
                        ))}
                      </div>
                    ) : null
                  })()}
                  <a href={`/post/${post.id}`} className="feed-view-more" onClick={e => { e.stopPropagation(); router.push(`/post/${post.id}`) }}>
                    View full listing →
                  </a>
                  <div className="feed-actions">
                    <button className={`feed-action-btn ${isClicked ? "clicked" : ""}`} onClick={e => toggleClick(e, post.id)} disabled={isClickLoading}>
                      <MousePointerClick size={18} color={isClicked ? "#0f1f6e" : "#64748b"} fill={isClicked ? "#c7d2fe" : "none"} />
                      {post.clicks ?? 0} Interested
                    </button>
                    <div className="feed-action-divider" />
                    {waLink ? (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="feed-wa-btn" onClick={e => e.stopPropagation()}>
                        <MessageSquare size={18} /> WhatsApp Seller
                      </a>
                    ) : (
                      <button className="feed-action-btn" disabled style={{ opacity:0.4 }}>
                        <MessageSquare size={18} /> No contact
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {!loading && posts.length === 0 && !error && (
              <div style={{ textAlign:'center', padding:'72px 24px' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
                  <Tag size={32} color="#818cf8" />
                </div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:'1.15rem', color:'#0f1f6e', marginBottom:8 }}>No products found</h3>
                <p style={{ color:'#94a3b8', fontSize:'0.85rem', fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>
                  {search ? `No results for "${search}".` : "Be the first to list something!"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && posts.length > 0 && (
          <div style={{ textAlign:'center', marginTop:36, padding: viewMode === "feed" ? "0 16px" : "0" }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 32px', background:'white', color:'#0f1f6e', border:'2px solid #c7d2fe', borderRadius:999, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:'0.88rem', cursor:loadingMore?'not-allowed':'pointer', opacity:loadingMore?0.6:1, boxShadow:'0 4px 16px rgba(13,29,110,0.08)', transition:'all 0.2s' }}
            >
              {loadingMore
                ? <><Loader2 size={16} style={{ animation:'spin 0.8s linear infinite' }} /> Loading…</>
                : <><ChevronDown size={16} /> Load More</>
              }
            </button>
          </div>
        )}
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="lytrix-card">
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                <img src="../ELIA LOGO.png" alt="Lytrix" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
              </div>
              <div>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif", marginBottom:2 }}>Built &amp; Powered by</p>
                <p style={{ color:'white', fontSize:'1rem', fontWeight:800, fontFamily:"'Playfair Display',serif", lineHeight:1.1 }}>LYTRIX CONSULT</p>
                <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.72rem', fontFamily:"'DM Sans',sans-serif", marginTop:2 }}>Web · Apps · Digital Solutions</p>
              </div>
            </div>
            <a href="https://wa.me/233207779304?text=Hi%20Lytrix%20Consult%2C%20I%27m%20interested%20in%20your%20services!" target="_blank" rel="noopener noreferrer" className="lytrix-wa">
              <MessageSquare size={15} /> WhatsApp Us
            </a>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.8rem', fontFamily:"'DM Sans',sans-serif" }}>
              © {new Date().getFullYear()} UniMart. All rights reserved.
            </p>
            <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'0.72rem', fontFamily:"'DM Sans',sans-serif" }}>
              Powered by Lytrix Consult · 0207779304
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}