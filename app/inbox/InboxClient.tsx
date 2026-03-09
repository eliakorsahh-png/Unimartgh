"use client"

import { useState, useEffect, useCallback, memo } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  MessageSquare, ShieldCheck, Tag, Users, ChevronRight,
  Trash2, LockIcon, Loader2, RefreshCw, AlertCircle,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Conversation = {
  id: string
  buyer_id: string
  seller_id: string
  post_id: string | null
  last_message: string | null
  last_message_at: string
  buyer_unread: number
  seller_unread: number
  other_profile?: {
    id: string; username: string; full_name: string | null
    avatar_url: string | null; is_premium: boolean
  } | null
  post?: {
    id: string; title: string; image_url: string | null; price: number | null
  } | null
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
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function fmtPrice(p: number | null) {
  return p != null ? `GH₵ ${Number(p).toFixed(2)}` : null
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function DeleteDialog({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="del-backdrop" onClick={onCancel}>
      <div className="del-box" onClick={e => e.stopPropagation()}>
        <div className="del-icon">
          <Trash2 size={24} color="#ef4444" />
        </div>
        <h3 className="del-title">Delete conversation?</h3>
        <p className="del-sub">
          Your chat with <strong>{name}</strong> will be removed from your inbox.
          The other person won't be notified.
        </p>
        <div className="del-actions">
          <button className="del-cancel" onClick={onCancel}>Cancel</button>
          <button className="del-confirm" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION ROW
// ─────────────────────────────────────────────────────────────────────────────
const ConvoRow = memo(function ConvoRow({ conv, userId, onDelete, router }: {
  conv: Conversation; userId: string; onDelete: (c: Conversation) => void; router: any
}) {
  const p      = conv.other_profile
  // If username looks like an email, don't use it as a display name
  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s ?? "")
  const name = p?.full_name || (isEmail(p?.username ?? "") ? null : p?.username) || "User"
  const unread = userId === conv.buyer_id ? conv.buyer_unread : conv.seller_unread

  return (
    <div
      className={`convo-row ${unread > 0 ? "convo-row-unread" : ""}`}
      onClick={() => router.push(`/chat/${conv.id}`)}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === "Enter" && router.push(`/chat/${conv.id}`)}
    >
      {/* Avatar */}
      <div className="convo-av-wrap">
        {p?.avatar_url
          ? <img src={p.avatar_url} alt={name} className="convo-av" />
          : <div className="convo-av convo-av-fb">{name[0].toUpperCase()}</div>
        }
        {unread > 0 && (
          <span className="convo-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </div>

      {/* Content */}
      <div className="convo-content">
        <div className="convo-top">
          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0, marginRight: 8 }}>
            <span className={`convo-name ${unread > 0 ? "convo-name-bold" : ""}`}>{name}</span>
            {p?.is_premium && (
              <span className="convo-verified">
                <ShieldCheck size={9} color="#0f1f6e" />
              </span>
            )}
          </div>
          <span className="convo-time">{timeAgo(conv.last_message_at)}</span>
        </div>

        {conv.post && (
          <div className="convo-post-ref">
            <Tag size={11} color="#f97316" style={{ flexShrink: 0 }} />
            <span className="convo-post-title">{conv.post.title}</span>
            {conv.post.price != null && (
              <span className="convo-post-price">{fmtPrice(conv.post.price)}</span>
            )}
          </div>
        )}

        <p className={`convo-last-msg ${unread > 0 ? "convo-last-msg-bold" : ""}`}>
          {conv.last_message ?? "Conversation started"}
        </p>
      </div>

      {/* Delete button */}
      <button
        className="convo-del-btn"
        onClick={e => { e.stopPropagation(); onDelete(conv) }}
        aria-label="Delete conversation"
        title="Delete"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function InboxClient() {
  const router = useRouter()

  const [userId, setUserId]       = useState<string | null>(null)
  const [userSchool, setUserSchool] = useState<string | null>(null)
  const [convos, setConvos]       = useState<Conversation[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const uid = session.user.id
        setUserId(uid)
        fetchConvos(uid)
        supabase.from("profiles").select("school").eq("id", uid).single()
          .then(({ data }) => setUserSchool(data?.school ?? null))
      } else {
        setLoading(false)
      }
    })
  }, [])

  // Realtime — refresh on conversation changes OR new messages
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel("inbox-web")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "conversations",
        filter: `buyer_id=eq.${userId}`
      }, () => fetchConvos(userId))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "conversations",
        filter: `seller_id=eq.${userId}`
      }, () => fetchConvos(userId))
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
      }, () => fetchConvos(userId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const fetchConvos = useCallback(async (uid: string) => {
    setError(null)
    try {
      const { data: convData, error: err } = await supabase
        .from("conversations")
        .select("id,buyer_id,seller_id,post_id,last_message,last_message_at,buyer_unread,seller_unread")
        .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
        .order("last_message_at", { ascending: false })
      if (err) throw err
      if (!convData?.length) { setConvos([]); return }

      const otherIds = [...new Set(convData.map((c: any) =>
        c.buyer_id === uid ? c.seller_id : c.buyer_id))]
      const postIds  = [...new Set(convData.map((c: any) => c.post_id).filter(Boolean))]

      const [{ data: profData }, { data: postData }] = await Promise.all([
        supabase.from("profiles")
          .select("id,username,full_name,avatar_url,is_premium").in("id", otherIds),
        postIds.length > 0
          ? supabase.from("postings").select("id,title,image_url,price").in("id", postIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const pm   = Object.fromEntries((profData ?? []).map((p: any) => [p.id, p]))
      const pstm = Object.fromEntries((postData ?? []).map((p: any) => [p.id, p]))

      const enriched: Conversation[] = convData.map((c: any) => ({
        ...c,
        other_profile: pm[c.buyer_id === uid ? c.seller_id : c.buyer_id] ?? null,
        post: c.post_id ? pstm[c.post_id] ?? null : null,
      }))

      setConvos(enriched)
    } catch (e: any) {
      setError(e.message || "Failed to load messages.")
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  const handleRefresh = () => {
    if (!userId) return
    setRefreshing(true); fetchConvos(userId)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !userId) return
    const field = userId === deleteTarget.buyer_id ? "buyer_deleted" : "seller_deleted"
    await supabase.from("conversations").update({ [field]: true }).eq("id", deleteTarget.id)
    setConvos(prev => prev.filter(c => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const totalUnread = convos.reduce((s, c) => {
    return s + (userId === c.buyer_id ? c.buyer_unread : c.seller_unread)
  }, 0)

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#f4f6fb;font-family:'DM Sans',system-ui,sans-serif}
        button,input,a{font-family:inherit}

        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes modalIn{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}

        /* ── NAV ── */
        .inbox-nav{background:linear-gradient(135deg,#0f1f6e 0%,#162380 55%,#1a2a9a 100%);
          padding:18px 16px 18px;display:flex;align-items:center;justify-content:space-between;
          position:sticky;top:0;z-index:100;box-shadow:0 4px 20px rgba(13,29,110,0.35)}
        .inbox-nav-title{font-family:'Playfair Display',serif;font-size:1.6rem;
          font-weight:800;color:white}
        .inbox-unread-badge{background:rgba(255,255,255,0.15);border-radius:999px;
          padding:5px 14px;font-size:0.75rem;font-weight:700;color:white;
          border:1px solid rgba(255,255,255,0.25)}

        /* ── WRAPPER ── */
        .inbox-wrap{max-width:680px;margin:0 auto;padding-bottom:80px}

        /* ── GROUP ROW ── */
        .inbox-group-row{display:flex;align-items:center;gap:14px;background:white;
          padding:16px;border-bottom:8px solid #f4f6fb;cursor:pointer;
          text-decoration:none;transition:background 0.12s}
        .inbox-group-icon{width:54px;height:54px;border-radius:27px;background:#0f1f6e;
          display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .inbox-group-info{flex:1;min-width:0}
        .inbox-group-name{font-size:0.97rem;font-weight:800;color:#0f1f6e}
        .inbox-group-sub{font-size:0.75rem;color:#94a3b8;margin-top:2px}

        /* ── SECTION LABEL ── */
        .inbox-section-label{padding:12px 16px 6px;font-size:0.68rem;font-weight:800;
          color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase}

        /* ── CONVO ROW ── */
        .convo-row{display:flex;align-items:center;gap:12px;background:white;
          padding:14px 16px;cursor:pointer;transition:background 0.12s;
          border-bottom:1px solid #f1f5f9;animation:slideIn 0.25s ease both}
        .convo-row:last-child{border-bottom:none}
        .convo-row-unread{background:#fafbff}
        .convo-av-wrap{position:relative;flex-shrink:0}
        .convo-av{width:54px;height:54px;border-radius:27px;object-fit:cover;
          border:2.5px solid #e2e8f0}
        .convo-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);
          display:flex;align-items:center;justify-content:center;
          color:white;font-weight:800;font-size:1.2rem}
        .convo-badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;
          padding:0 4px;border-radius:10px;background:#f97316;
          display:flex;align-items:center;justify-content:center;
          font-size:0.65rem;font-weight:900;color:white;
          border:2px solid white;white-space:nowrap}
        .convo-content{flex:1;min-width:0}
        .convo-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:3px}
        .convo-name{font-size:0.94rem;font-weight:600;color:#1e293b;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .convo-name-bold{font-weight:800;color:#0f1f6e}
        .convo-time{font-size:0.72rem;color:#94a3b8;flex-shrink:0}
        .convo-verified{width:16px;height:16px;border-radius:50%;background:#eef2ff;
          display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .convo-post-ref{display:flex;align-items:center;gap:4px;margin-bottom:3px}
        .convo-post-title{font-size:0.72rem;color:#f97316;font-weight:600;
          flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .convo-post-price{font-size:0.7rem;color:#ea580c;font-weight:700;flex-shrink:0}
        .convo-last-msg{font-size:0.82rem;color:#64748b;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .convo-last-msg-bold{color:#1e293b;font-weight:700}
        .convo-del-btn{background:none;border:none;cursor:pointer;padding:8px;
          color:#cbd5e1;border-radius:8px;transition:all 0.15s;flex-shrink:0}

        /* ── CONVERSATIONS CARD ── */
        .convos-card{background:white;border-radius:0;overflow:hidden;
          border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9}
        @media(min-width:640px){
          .convos-card{margin:12px;border-radius:16px;border:1px solid #e8ecf4;
            box-shadow:0 1px 12px rgba(13,29,110,0.06)}
          .convo-row{border-radius:0}
          .convo-row:first-child{border-radius:16px 16px 0 0}
          .convo-row:last-child{border-radius:0 0 16px 16px;border-bottom:none}
        }

        /* ── EMPTY ── */
        .inbox-empty{text-align:center;padding:64px 24px}
        .inbox-empty-icon{width:80px;height:80px;border-radius:50%;
          background:linear-gradient(135deg,#eef2ff,#e0e7ff);
          display:flex;align-items:center;justify-content:center;margin:0 auto 18px}

        /* ── LOGIN GATE ── */
        .inbox-login-gate{text-align:center;padding:80px 24px}
        .inbox-login-icon{width:80px;height:80px;border-radius:50%;
          background:linear-gradient(135deg,#f1f5f9,#e2e8f0);
          display:flex;align-items:center;justify-content:center;margin:0 auto 20px}

        /* ── ERROR ── */
        .inbox-err{display:flex;align-items:center;gap:10px;padding:13px 16px;
          background:#fff1f0;border:1.5px solid #fca5a5;border-radius:12px;margin:12px}

        /* ── REFRESH BTN ── */
        .inbox-refresh{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;
          background:white;border:1.5px solid #e2e8f0;border-radius:999px;
          font-size:0.8rem;font-weight:600;color:#64748b;cursor:pointer;transition:all 0.15s}
        .inbox-refresh:disabled{opacity:0.55;cursor:not-allowed}

        /* ── DELETE DIALOG ── */
        .del-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.55);
          backdrop-filter:blur(5px);z-index:500;display:flex;
          align-items:center;justify-content:center;padding:20px}
        .del-box{background:white;border-radius:20px;padding:28px 24px;
          max-width:360px;width:100%;text-align:center;
          animation:modalIn 0.25s ease;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
        .del-icon{width:56px;height:56px;border-radius:50%;background:#fff1f0;
          display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
        .del-title{font-family:'Playfair Display',serif;font-size:1.15rem;
          font-weight:800;color:#0f172a;margin-bottom:10px}
        .del-sub{font-size:0.85rem;color:#64748b;line-height:1.6;margin-bottom:22px}
        .del-actions{display:flex;gap:10px}
        .del-cancel{flex:1;padding:11px;background:#f1f5f9;border:none;border-radius:12px;
          font-weight:700;font-size:0.88rem;color:#64748b;cursor:pointer;transition:all 0.15s}
        .del-confirm{flex:1;padding:11px;background:#ef4444;border:none;border-radius:12px;
          font-weight:700;font-size:0.88rem;color:white;cursor:pointer;transition:all 0.2s}
      `}</style>

      {/* DELETE DIALOG */}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.other_profile?.full_name
            || deleteTarget.other_profile?.username || "this user"}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* NAV */}
      <header className="inbox-nav">
        <span className="inbox-nav-title">Messages</span>
        {totalUnread > 0 && (
          <span className="inbox-unread-badge">{totalUnread} unread</span>
        )}
      </header>

      {/* NOT LOGGED IN */}
      {!loading && !userId && (
        <div className="inbox-wrap">
          <div className="inbox-login-gate">
            <div className="inbox-login-icon">
              <Lock size={36} color="#94a3b8" />
            </div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800,
              fontSize: "1.2rem", color: "#0f1f6e", marginBottom: 10 }}>
              Login to view messages
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: 22 }}>
              Your conversations with sellers will appear here.
            </p>
            <a href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 7,
              padding: "12px 28px", background: "#0f1f6e", color: "white", borderRadius: "999px",
              fontWeight: 800, fontSize: "0.9rem", textDecoration: "none" }}>
              Login
            </a>
          </div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          height: 280 }}>
          <Loader2 size={32} color="#0f1f6e" style={{ animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      {/* INBOX */}
      {!loading && userId && (
        <div className="inbox-wrap">

          {/* Error */}
          {error && (
            <div className="inbox-err">
              <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "0.85rem", color: "#dc2626", flex: 1 }}>{error}</span>
              <button onClick={() => fetchConvos(userId)}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem",
                  fontWeight: 700, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}

          {/* Refresh */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 4px" }}>
            <button className="inbox-refresh" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {/* GROUP CHAT */}
          {userSchool && (
            <a
              href={`/chat/group/${encodeURIComponent(userSchool)}`}
              className="inbox-group-row"
            >
              <div className="inbox-group-icon">
                <Users size={24} color="white" />
              </div>
              <div className="inbox-group-info">
                <div className="inbox-group-name">{userSchool}</div>
                <div className="inbox-group-sub">School group chat · Tap to join</div>
              </div>
              <ChevronRight size={18} color="#f97316" style={{ flexShrink: 0 }} />
            </a>
          )}

          {/* CONVERSATIONS */}
          {convos.length > 0 && (
            <>
              <div className="inbox-section-label">Direct Messages</div>
              <div className="convos-card">
                {convos.map(conv => (
                  <ConvoRow
                    key={conv.id}
                    conv={conv}
                    userId={userId}
                    onDelete={setDeleteTarget}
                    router={router}
                  />
                ))}
              </div>
            </>
          )}

          {/* EMPTY */}
          {convos.length === 0 && !error && (
            <div className="inbox-empty">
              <div className="inbox-empty-icon">
                <MessageSquare size={36} color="#818cf8" />
              </div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700,
                fontSize: "1.15rem", color: "#0f1f6e", marginBottom: 8 }}>
                No messages yet
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: 24 }}>
                When you contact a seller, your conversation will appear here.
              </p>
              <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 7,
                padding: "11px 24px", background: "#0f1f6e", color: "white", borderRadius: "999px",
                fontWeight: 800, fontSize: "0.88rem", textDecoration: "none" }}>
                Browse listings
              </a>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// Missing icon — re-export from lucide
function Lock({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}