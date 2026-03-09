"use client"

import { useState, useEffect, useCallback, useRef, memo } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Heart, MessageCircle, Share2, X, Image as ImageIcon,
  Camera, ShieldCheck, Users, ChevronRight, Plus,
  AlertCircle, Loader2, RefreshCw, Send,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10

type SocialPost = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  likes: number
  school: string | null
  created_at: string
  profile?: {
    id: string; username: string; full_name: string | null
    avatar_url: string | null; school: string | null; is_premium: boolean
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return "Just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

async function sharePost(post: SocialPost) {
  const url = `${window.location.origin}/social`
  try {
    if (navigator.share) await navigator.share({ title: post.content.slice(0, 60), url })
    else await navigator.clipboard.writeText(url)
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────────────────────
const PostCard = memo(function PostCard({ post, userId, isLiked, onToggle, router }: {
  post: SocialPost; userId: string | null; isLiked: boolean
  onToggle: (id: string) => void; router: any
}) {
  const p = post.profile
  const name = p?.full_name || p?.username || "Student"

  return (
    <article className="sp-card">
      {/* Header */}
      <div className="sp-head" onClick={() => router.push(`/profile/${post.user_id}`)}>
        {p?.avatar_url
          ? <img src={p.avatar_url} alt={name} className="sp-av" />
          : <div className="sp-av sp-av-fb">{name[0].toUpperCase()}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="sp-name">{name}</span>
            {p?.is_premium && (
              <span className="sp-verified"><ShieldCheck size={9} /> Verified</span>
            )}
          </div>
          <span className="sp-meta">
            {p?.school ? `${p.school} · ` : ""}{timeAgo(post.created_at)}
          </span>
        </div>
        {post.school && (
          <span className="sp-school-pill">{post.school.split(" ")[0]}</span>
        )}
      </div>

      {/* Content */}
      <div className="sp-content">
        <p className="sp-text">{post.content}</p>
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="sp-img-wrap">
          <img src={post.image_url} alt="Post" loading="lazy" className="sp-img" />
        </div>
      )}

      {/* Actions */}
      <div className="sp-actions">
        <button
          className={`sp-act-btn ${isLiked ? "sp-act-liked" : ""}`}
          onClick={() => onToggle(post.id)}
        >
          <Heart size={16} fill={isLiked ? "#ef4444" : "none"} color={isLiked ? "#ef4444" : "#64748b"} />
          <span>{post.likes ?? 0}</span>
        </button>
        <div className="sp-act-div" />
        <button className="sp-act-btn">
          <MessageCircle size={16} />
          <span>Comment</span>
        </button>
        <div className="sp-act-div" />
        <button className="sp-act-btn" onClick={() => sharePost(post)}>
          <Share2 size={16} />
          <span>Share</span>
        </button>
      </div>
    </article>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
function PostSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="sp-card">
          <div style={{ display: "flex", gap: 10, padding: "14px 16px", alignItems: "center" }}>
            <div className="skel" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ height: 12, width: "40%", marginBottom: 7 }} />
              <div className="skel" style={{ height: 9, width: "25%" }} />
            </div>
          </div>
          <div style={{ padding: "0 16px 14px" }}>
            <div className="skel" style={{ height: 13, width: "100%", marginBottom: 6 }} />
            <div className="skel" style={{ height: 13, width: "80%", marginBottom: 6 }} />
            <div className="skel" style={{ height: 13, width: "55%" }} />
          </div>
          {i === 0 && <div className="skel" style={{ width: "100%", height: 220 }} />}
          <div style={{ display: "flex", padding: "0 16px", height: 44, alignItems: "center", gap: 8 }}>
            <div className="skel" style={{ height: 9, width: "18%" }} />
            <div className="skel" style={{ height: 9, width: "18%", marginLeft: 12 }} />
            <div className="skel" style={{ height: 9, width: "14%", marginLeft: 12 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ComposeModal({ userProfile, onClose, onPosted }: {
  userProfile: any; onClose: () => void; onPosted: (post: SocialPost) => void
}) {
  const [content, setContent]     = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [posting, setPosting]     = useState(false)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textRef.current?.focus() }, [])

  const handleFile = (file: File | null) => {
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setImageFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !userProfile?.id) return null
    setProgress(20)
    const ext  = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const path = `social/${userProfile.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("UniMart").upload(path, imageFile, { contentType: imageFile.type })
    if (error) throw error
    setProgress(85)
    const { data } = supabase.storage.from("UniMart").getPublicUrl(path)
    return data.publicUrl
  }

  const submit = async () => {
    if (!content.trim()) return
    setPosting(true); setError(null); setProgress(5)
    try {
      let imageUrl: string | null = null
      if (imageFile) imageUrl = await uploadImage()
      setProgress(90)
      const { data: inserted, error: err } = await supabase
        .from("social_posts")
        .insert({
          user_id: userProfile.id, content: content.trim(),
          image_url: imageUrl, school: userProfile.school ?? null, likes: 0,
        })
        .select("id, user_id, content, image_url, likes, school, created_at")
        .single()
      if (err) throw err
      if (inserted) {
        onPosted({
          ...inserted,
          profile: {
            id: userProfile.id, username: userProfile.username,
            full_name: userProfile.full_name ?? null, avatar_url: userProfile.avatar_url ?? null,
            school: userProfile.school ?? null, is_premium: userProfile.is_premium ?? false,
          },
        })
      }
      onClose()
    } catch (e: any) {
      setError(e.message || "Post failed. Try again.")
    } finally {
      setPosting(false); setProgress(0)
    }
  }

  const name = userProfile?.full_name || userProfile?.username || "You"

  return (
    <div className="compose-backdrop" onClick={onClose}>
      <div className="compose-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="compose-header">
          <button className="compose-cancel" onClick={onClose}>Cancel</button>
          <span className="compose-title">New Post</span>
          <button
            className={`compose-post-btn ${(!content.trim() || posting) ? "compose-post-btn-off" : ""}`}
            onClick={submit} disabled={!content.trim() || posting}
          >
            {posting ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <><Send size={13} /> Post</>}
          </button>
        </div>

        {/* Progress */}
        {posting && (
          <div style={{ height: 3, background: "#e2e8f0" }}>
            <div style={{ height: "100%", background: "#f97316", width: `${progress}%`, transition: "width 0.3s" }} />
          </div>
        )}

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
            background: "#fff1f0", borderBottom: "1px solid #fca5a5" }}>
            <AlertCircle size={14} color="#dc2626" />
            <span style={{ fontSize: "0.82rem", color: "#dc2626" }}>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="compose-body">
          {userProfile?.avatar_url
            ? <img src={userProfile.avatar_url} alt={name} className="compose-av" />
            : <div className="compose-av compose-av-fb">{name[0].toUpperCase()}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="compose-name">{name}</p>
            {userProfile?.school && <p className="compose-school">{userProfile.school}</p>}
            <textarea
              ref={textRef}
              className="compose-textarea"
              placeholder="What's happening on campus?"
              value={content}
              onChange={e => setContent(e.target.value)}
              maxLength={500}
              rows={4}
            />
            {previewUrl && (
              <div style={{ position: "relative", marginTop: 12 }}>
                <img src={previewUrl} alt="Preview" style={{
                  width: "100%", maxHeight: 280, objectFit: "cover",
                  borderRadius: 12, display: "block"
                }} />
                <button onClick={removeImage} style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                  width: 28, height: 28, display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer"
                }}>
                  <X size={14} color="white" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="compose-toolbar">
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => handleFile(e.target.files?.[0] ?? null)} />
          <button className="compose-tool-btn" onClick={() => fileRef.current?.click()}>
            <ImageIcon size={20} color="#0f1f6e" />
            <span>Photo</span>
          </button>
          <button className="compose-tool-btn" onClick={() => { fileRef.current?.setAttribute("capture","environment"); fileRef.current?.click() }}>
            <Camera size={20} color="#0f1f6e" />
            <span>Camera</span>
          </button>
          <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#94a3b8" }}>{content.length}/500</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialClient() {
  const router = useRouter()

  const [userId, setUserId]           = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [posts, setPosts]             = useState<SocialPost[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]         = useState(true)
  const [page, setPage]               = useState(0)
  const [error, setError]             = useState<string | null>(null)
  const [likedIds, setLikedIds]       = useState<Set<string>>(new Set())
  const [schoolFilter, setSchoolFilter] = useState("All")
  const [schools, setSchools]         = useState<string[]>([])
  const [composing, setComposing]     = useState(false)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()
        setUserProfile(data)
      }
    })
    supabase.from("profiles").select("school").not("school", "is", null)
      .then(({ data }) => {
        const u = [...new Set((data ?? []).map((r: any) => r.school).filter(Boolean))] as string[]
        setSchools(u.sort())
      })
  }, [])

  const fetchPosts = useCallback(async (pageNum: number, replace: boolean) => {
    pageNum === 0 ? setLoading(true) : setLoadingMore(true)
    setError(null)
    try {
      let q = supabase.from("social_posts")
        .select("id,user_id,content,image_url,likes,school,created_at")
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
      if (schoolFilter !== "All") q = q.eq("school", schoolFilter)

      const { data: postData, error: err } = await q
      if (err) throw err
      const results = (postData ?? []) as SocialPost[]
      if (!results.length) { setHasMore(false); if (replace) setPosts([]); return }

      const uids = [...new Set(results.map(p => p.user_id))]
      const { data: profData } = await supabase.from("profiles")
        .select("id,username,full_name,avatar_url,school,is_premium").in("id", uids)
      const pm = Object.fromEntries((profData ?? []).map((p: any) => [p.id, p]))
      const merged = results.map(p => ({ ...p, profile: pm[p.user_id] ?? null }))

      setHasMore(results.length === PAGE_SIZE)
      setPosts(prev => replace ? merged : [...prev, ...merged])
    } catch (e: any) {
      setError(e.message || "Failed to load posts.")
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }, [schoolFilter])

  useEffect(() => { setPage(0); fetchPosts(0, true) }, [fetchPosts])

  const toggleLike = useCallback(async (postId: string) => {
    if (!userId) { router.push("/login"); return }
    const liked = likedIds.has(postId)
    setLikedIds(prev => { const n = new Set(prev); liked ? n.delete(postId) : n.add(postId); return n })
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, likes: Math.max(0, (p.likes ?? 0) + (liked ? -1 : 1)) } : p))
    const { data: cur } = await supabase.from("social_posts").select("likes").eq("id", postId).single()
    if (cur) {
      const nl = Math.max(0, (cur.likes ?? 0) + (liked ? -1 : 1))
      await supabase.from("social_posts").update({ likes: nl }).eq("id", postId)
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: nl } : p))
    }
  }, [userId, likedIds])

  const handlePosted = (post: SocialPost) => setPosts(prev => [post, ...prev])

  const loadMore = () => { const n = page + 1; setPage(n); fetchPosts(n, false) }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#f4f6fb;font-family:'DM Sans',system-ui,sans-serif}
        button,input,textarea,select{font-family:inherit}

        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-700px 0}100%{background-position:700px 0}}
        @keyframes pop{0%,100%{transform:scale(1)}40%{transform:scale(1.4)}70%{transform:scale(0.9)}}
        @keyframes modalIn{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}

        /* ── NAV ── */
        .sp-nav{background:linear-gradient(135deg,#0f1f6e 0%,#162380 55%,#1a2a9a 100%);
          padding:16px;display:flex;align-items:center;justify-content:space-between;
          position:sticky;top:0;z-index:100;box-shadow:0 4px 20px rgba(13,29,110,0.35)}
        .sp-nav-left{}
        .sp-nav-title{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:800;color:white;line-height:1.1}
        .sp-nav-sub{font-size:0.75rem;color:rgba(255,255,255,0.55);margin-top:3px}
        .sp-compose-nav-btn{width:40px;height:40px;border-radius:50%;
          background:linear-gradient(135deg,#ea580c,#f97316);border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 4px 14px rgba(234,88,12,0.45);transition:all 0.2s;flex-shrink:0}

        /* ── GROUP ROW ── */
        .sp-group-row{display:flex;align-items:center;gap:12;background:white;
          padding:14px 16px;border-bottom:8px solid #f4f6fb;cursor:pointer;
          transition:background 0.12s;text-decoration:none}
        .sp-group-icon{width:48px;height:48px;border-radius:24px;background:#0f1f6e;
          display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .sp-group-info{flex:1;min-width:0}
        .sp-group-name{font-size:0.94rem;font-weight:800;color:#0f1f6e}
        .sp-group-sub{font-size:0.75rem;color:#94a3b8;margin-top:2px}

        /* ── FILTER CHIPS ── */
        .sp-filter-bar{background:white;border-bottom:1px solid #e8ecf4;
          position:sticky;top:60px;z-index:90;overflow:hidden}
        .sp-filter-scroll{display:flex;gap:8px;overflow-x:auto;padding:10px 14px;
          scrollbar-width:none}
        .sp-filter-scroll::-webkit-scrollbar{display:none}
        .sp-chip{padding:7px 16px;border-radius:999px;border:1.5px solid #e2e8f0;
          background:#f8fafc;color:#64748b;font-size:0.78rem;font-weight:600;
          cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0}
        .sp-chip.sp-chip-on{background:#0f1f6e;color:white;border-color:#0f1f6e}

        /* ── COMPOSE PROMPT ── */
        .sp-compose-prompt{display:flex;align-items:center;gap:10px;background:white;
          padding:14px;border-bottom:8px solid #f4f6fb;cursor:pointer;transition:background 0.12s}
        .sp-prompt-av{width:40px;height:40px;border-radius:20px;object-fit:cover;
          flex-shrink:0;border:2px solid #e2e8f0}
        .sp-prompt-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);
          display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.9rem}
        .sp-prompt-input{flex:1;background:#f4f6fb;border:1.5px solid #e2e8f0;
          border-radius:999px;padding:10px 18px;font-size:0.88rem;color:#94a3b8;
          pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sp-prompt-img-btn{width:38px;height:38px;border-radius:50%;
          background:#eef2ff;border:none;display:flex;align-items:center;
          justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.15s}

        /* ── FEED WRAPPER ── */
        .sp-feed{max-width:680px;margin:0 auto;padding:10px 0 100px}

        /* ── POST CARD ── */
        .sp-card{background:white;border-radius:16px;border:1px solid #e8ecf4;
          overflow:hidden;animation:fadeUp 0.3s ease both;margin:0 12px}
        .sp-head{display:flex;align-items:center;gap:10px;padding:13px 14px;
          cursor:pointer;transition:background 0.12s;border-bottom:1px solid #f1f5f9}
        .sp-av{width:44px;height:44px;border-radius:22px;object-fit:cover;
          flex-shrink:0;border:2px solid #e2e8f0}
        .sp-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);display:flex;
          align-items:center;justify-content:center;color:white;font-weight:700;font-size:1rem}
        .sp-name{font-size:0.94rem;font-weight:700;color:#0f1f6e}
        .sp-verified{display:inline-flex;align-items:center;gap:3px;background:#eef2ff;
          color:#0f1f6e;padding:2px 7px;border-radius:999px;font-size:0.6rem;font-weight:800;white-space:nowrap}
        .sp-meta{font-size:0.72rem;color:#94a3b8;margin-top:2px;display:block}
        .sp-school-pill{background:#eef2ff;color:#0f1f6e;padding:4px 12px;
          border-radius:999px;font-size:0.7rem;font-weight:700;flex-shrink:0;white-space:nowrap}
        .sp-content{padding:14px}
        .sp-text{font-size:0.94rem;color:#1e293b;line-height:1.65;white-space:pre-wrap}
        .sp-img-wrap{overflow:hidden;background:#eef2ff}
        .sp-img{width:100%;max-height:420px;object-fit:cover;display:block;transition:transform 0.4s}
        .sp-actions{display:flex;align-items:stretch;border-top:1px solid #f1f5f9}
        .sp-act-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;
          padding:12px 6px;background:none;border:none;cursor:pointer;
          font-size:0.8rem;font-weight:700;color:#64748b;transition:all 0.15s}
        .sp-act-btn span{display:none}
        @media(min-width:480px){.sp-act-btn span{display:inline}}
        .sp-act-liked{background:#fff0f0 !important;color:#ef4444 !important}
        .sp-act-liked svg{animation:pop 0.3s ease}
        .sp-act-div{width:1px;background:#f1f5f9;flex-shrink:0}

        /* ── SKELETON ── */
        .skel{background:linear-gradient(90deg,#f1f5f9 25%,#e8edf5 50%,#f1f5f9 75%);
          background-size:700px 100%;animation:shimmer 1.3s infinite;border-radius:8px}

        /* ── ERROR ── */
        .sp-err{display:flex;align-items:center;gap:10px;padding:13px 16px;
          background:#fff1f0;border:1.5px solid #fca5a5;border-radius:12px;margin:12px}

        /* ── EMPTY ── */
        .sp-empty{text-align:center;padding:60px 24px}
        .sp-empty-icon{width:80px;height:80px;border-radius:50%;
          background:linear-gradient(135deg,#eef2ff,#e0e7ff);
          display:flex;align-items:center;justify-content:center;margin:0 auto 18px}

        /* ── LOAD MORE ── */
        .sp-load-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 28px;
          background:white;color:#0f1f6e;border:2px solid #c7d2fe;border-radius:999px;
          font-weight:700;font-size:0.88rem;cursor:pointer;
          box-shadow:0 4px 14px rgba(13,29,110,0.07);transition:all 0.2s}
        .sp-load-btn:disabled{opacity:0.55;cursor:not-allowed}

        /* ── COMPOSE MODAL ── */
        .compose-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.55);
          backdrop-filter:blur(5px);z-index:500;display:flex;align-items:flex-end;
          justify-content:center}
        @media(min-width:640px){.compose-backdrop{align-items:center}}
        .compose-box{background:white;width:100%;max-width:600px;border-radius:20px 20px 0 0;
          max-height:90vh;display:flex;flex-direction:column;animation:modalIn 0.3s ease;
          overflow:hidden}
        @media(min-width:640px){.compose-box{border-radius:20px;max-height:85vh}}
        .compose-header{display:flex;align-items:center;justify-content:space-between;
          padding:14px 16px;border-bottom:1px solid #f1f5f9}
        .compose-cancel{background:none;border:none;color:#0f1f6e;font-size:0.94rem;
          font-weight:600;cursor:pointer;padding:4px;transition:color 0.15s}
        .compose-title{font-size:1rem;font-weight:800;color:#0f1f6e}
        .compose-post-btn{display:flex;align-items:center;gap:6px;
          background:#0f1f6e;color:white;border:none;border-radius:999px;
          padding:8px 18px;font-size:0.82rem;font-weight:800;cursor:pointer;transition:all 0.2s}
        .compose-post-btn-off{opacity:0.45;cursor:not-allowed}
        .compose-body{display:flex;gap:12px;padding:16px;flex:1;overflow-y:auto;min-height:0}
        .compose-av{width:42px;height:42px;border-radius:21px;object-fit:cover;
          flex-shrink:0;border:2px solid #e2e8f0}
        .compose-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);display:flex;
          align-items:center;justify-content:center;color:white;font-weight:700;font-size:1rem}
        .compose-name{font-weight:700;color:#0f1f6e;font-size:0.94rem;margin-bottom:2px}
        .compose-school{font-size:0.75rem;color:#94a3b8;margin-bottom:10px}
        .compose-textarea{width:100%;border:none;outline:none;font-size:0.97rem;
          color:#1e293b;line-height:1.65;resize:none;min-height:120px;
          background:transparent}
        .compose-textarea::placeholder{color:#94a3b8}
        .compose-toolbar{display:flex;align-items:center;gap:8px;padding:12px 16px;
          border-top:1px solid #f1f5f9}
        .compose-tool-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;
          border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;
          cursor:pointer;font-size:0.8rem;font-weight:600;color:#0f1f6e;transition:all 0.15s}
      `}</style>

      {/* COMPOSE MODAL */}
      {composing && userProfile && (
        <ComposeModal
          userProfile={userProfile}
          onClose={() => setComposing(false)}
          onPosted={handlePosted}
        />
      )}

      {/* NAV */}
      <header className="sp-nav">
        <div className="sp-nav-left">
          <div className="sp-nav-title">Student Social</div>
          <div className="sp-nav-sub">Connect with your campus</div>
        </div>
        {userId && (
          <button className="sp-compose-nav-btn" onClick={() => setComposing(true)} aria-label="New post">
            <Plus size={22} color="white" />
          </button>
        )}
      </header>

      {/* GROUP CHAT BANNER */}
      {userProfile?.school && (
        <a
          href={`/chat/group/${encodeURIComponent(userProfile.school)}`}
          className="sp-group-row"
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          <div className="sp-group-icon">
            <Users size={22} color="white" />
          </div>
          <div className="sp-group-info">
            <div className="sp-group-name">{userProfile.school} Group Chat</div>
            <div className="sp-group-sub">Chat with all students from your school</div>
          </div>
          <ChevronRight size={18} color="#f97316" style={{ flexShrink: 0 }} />
        </a>
      )}

      {/* FILTER CHIPS */}
      <div className="sp-filter-bar">
        <div className="sp-filter-scroll">
          {["All", ...schools].map(s => (
            <button key={s} className={`sp-chip ${schoolFilter === s ? "sp-chip-on" : ""}`}
              onClick={() => { setSchoolFilter(s); setPage(0) }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* COMPOSE PROMPT */}
      {userId ? (
        <div className="sp-compose-prompt" onClick={() => setComposing(true)}>
          {userProfile?.avatar_url
            ? <img src={userProfile.avatar_url} alt="" className="sp-prompt-av" />
            : <div className="sp-prompt-av sp-prompt-av-fb">
                {(userProfile?.full_name ?? userProfile?.username ?? "S")[0].toUpperCase()}
              </div>
          }
          <div className="sp-prompt-input">What's happening on campus?</div>
          <button className="sp-prompt-img-btn" onClick={e => { e.stopPropagation(); setComposing(true) }}>
            <Camera size={18} color="#0f1f6e" />
          </button>
        </div>
      ) : (
        <div style={{ background: "white", padding: "14px 16px", borderBottom: "8px solid #f4f6fb",
          display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, color: "#94a3b8", fontSize: "0.88rem" }}>
            <a href="/login" style={{ color: "#0f1f6e", fontWeight: 700, textDecoration: "none" }}>Login</a> to post and interact
          </div>
        </div>
      )}

      {/* FEED */}
      <main>
        <div className="sp-feed">

          {/* Error */}
          {error && (
            <div className="sp-err">
              <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "0.85rem", color: "#dc2626", flex: 1 }}>{error}</span>
              <button onClick={() => fetchPosts(0, true)}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem",
                  fontWeight: 700, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}

          {loading && <PostSkeleton />}

          {!loading && posts.length === 0 && !error && (
            <div className="sp-empty">
              <div className="sp-empty-icon">
                <MessageCircle size={36} color="#818cf8" />
              </div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700,
                fontSize: "1.15rem", color: "#0f1f6e", marginBottom: 8 }}>
                {schoolFilter !== "All" ? `No posts from ${schoolFilter} yet` : "No posts yet"}
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: 20 }}>
                Be the first to share something with your campus!
              </p>
              {userId && (
                <button onClick={() => setComposing(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 24px",
                    background: "#0f1f6e", color: "white", border: "none", borderRadius: "999px",
                    fontWeight: 800, fontSize: "0.88rem", cursor: "pointer" }}>
                  <Plus size={16} /> Write a post
                </button>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!loading && posts.map((post, i) => (
              <PostCard key={post.id} post={post} userId={userId}
                isLiked={likedIds.has(post.id)} onToggle={toggleLike}
                router={router} />
            ))}
          </div>

          {!loading && hasMore && posts.length > 0 && (
            <div style={{ textAlign: "center", padding: "28px 16px" }}>
              <button className="sp-load-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore
                  ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Loading…</>
                  : "Load More"
                }
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}