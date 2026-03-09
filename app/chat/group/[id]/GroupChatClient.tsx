"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Users, Pin, Settings, Send, Image as ImageIcon,
  ThumbsUp, ThumbsDown, ShieldCheck, X, Loader2,
  Check, CheckCheck, UserMinus, School,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type GroupMsg = {
  id: string; group_id: string; user_id: string; content: string
  image_url: string | null; is_pinned: boolean; pinned_by: string | null
  pinned_at: string | null; created_at: string; likes: number; dislikes: number
  profiles?: any
}
type GroupMeta = { id: string; school: string; name: string; description: string | null; member_count: number }
type Member    = { user_id: string; role: string; is_online: boolean; last_seen: string; removed: boolean; profiles: any }
type MyRole    = "member" | "admin" | "owner" | null
type Sheet     = "none" | "members" | "pinned" | "apply" | "applications"

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000), m = Math.floor(s / 60)
  const h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (s < 60) return "just now"
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short" })
}
function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-box" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <span className="sheet-title">{title}</span>
          <button className="sheet-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function GroupChatClient({ school }: { school: string }) {
  const router    = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const [userId, setUserId]       = useState<string | null>(null)
  const [groupId, setGroupId]     = useState<string | null>(null)
  const [groupMeta, setGroupMeta] = useState<GroupMeta | null>(null)
  const [messages, setMessages]   = useState<GroupMsg[]>([])
  const [members, setMembers]     = useState<Member[]>([])
  const [myRole, setMyRole]       = useState<MyRole>(null)
  const [removed, setRemoved]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const [text, setText]           = useState("")
  const [sending, setSending]     = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [sheet, setSheet]         = useState<Sheet>("none")
  const [pinnedMsgs, setPinnedMsgs]   = useState<GroupMsg[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [reactions, setReactions] = useState<Record<string, 1 | -1 | 0>>({})
  const [applyReason, setApplyReason] = useState("")
  const [applying, setApplying]   = useState(false)
  const [hasApplied, setHasApplied]   = useState(false)
  const [applications, setApplications] = useState<any[]>([])

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" }), 60)
  }, [])

  // ── Boot ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.replace("/login"); return }
      const uid = session.user.id
      setUserId(uid)

      // join_school_group RPC creates group if not exists, adds user as member
      const { data: gid, error } = await supabase
        .rpc("join_school_group", { p_school: school, p_user_id: uid })
      if (error || !gid) { setLoading(false); return }
      setGroupId(gid)

      const [{ data: meta }, membership, msgs, app] = await Promise.all([
        supabase.from("group_chats").select("*").eq("id", gid).single(),
        supabase.from("group_members").select("role,removed").eq("group_id", gid).eq("user_id", uid).single(),
        loadMessages(gid),
        supabase.from("group_admin_applications").select("status")
          .eq("group_id", gid).eq("user_id", uid).maybeSingle(),
      ])

      // Self-heal: if the group name was saved as "undefined ..." (old bug), fix it now
      if (meta && (!meta.name || meta.name.toLowerCase().startsWith("undefined") || meta.school === "undefined")) {
        await supabase.from("group_chats").update({
          name: `${school} Students`,
          school: school,
          description: `Group chat for all ${school} students on UniMart`,
        }).eq("id", gid)
        meta.name = `${school} Students`
        meta.school = school
      }

      setGroupMeta(meta)
      setMyRole((membership.data?.role as MyRole) ?? "member")
      setRemoved(membership.data?.removed ?? false)
      setHasApplied(!!app.data)
      await loadMembers(gid, uid)
      setLoading(false)
      scrollToBottom(false)
    })
  }, [school])

  // ── Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId || !userId) return
    const ch = supabase.channel(`group-web:${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages",
        filter: `group_id=eq.${groupId}` }, async (payload) => {
        const msg = payload.new as GroupMsg
        const { data: prof } = await supabase.from("profiles")
          .select("id,username,full_name,avatar_url,is_premium").eq("id", msg.user_id).single()
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, { ...msg, profiles: prof }])
        scrollToBottom()
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages",
        filter: `group_id=eq.${groupId}` }, (payload) => {
        const updated = payload.new as GroupMsg
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
        if (updated.is_pinned) setPinnedMsgs(prev => prev.find(m => m.id === updated.id) ? prev : [...prev, updated])
        else setPinnedMsgs(prev => prev.filter(m => m.id !== updated.id))
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_members",
        filter: `group_id=eq.${groupId}` }, () => { if (groupId && userId) loadMembers(groupId, userId) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [groupId, userId])

  // ── Loaders ───────────────────────────────────────────────────────
  async function loadMessages(gid: string) {
    const { data } = await supabase.from("group_messages").select("*")
      .eq("group_id", gid).order("created_at", { ascending: true }).limit(80)
    if (!data) return
    const userIds = [...new Set(data.map((m: any) => m.user_id))]
    const { data: profiles } = await supabase.from("profiles")
      .select("id,username,full_name,avatar_url,is_premium").in("id", userIds)
    const pm = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
    const enriched = data.map((m: any) => ({ ...m, profiles: pm[m.user_id] })) as GroupMsg[]
    setMessages(enriched)
    setPinnedMsgs(enriched.filter(m => m.is_pinned))
  }

  async function loadMembers(gid: string, uid: string) {
    const { data } = await supabase.from("group_members")
      .select("*,profiles:user_id(id,username,full_name,avatar_url,is_premium)")
      .eq("group_id", gid).eq("removed", false).order("role")
    setMembers((data ?? []) as Member[])
    setOnlineCount((data ?? []).filter((m: any) => m.is_online).length)
    const mine = (data ?? []).find((m: any) => m.user_id === uid)
    if (mine) setMyRole(mine.role as MyRole)
  }

  async function loadApplications() {
    if (!groupId) return
    const { data } = await supabase.from("group_admin_applications")
      .select("*,profiles:user_id(id,username,full_name,avatar_url)")
      .eq("group_id", groupId).eq("status", "pending")
    setApplications(data ?? [])
  }

  // ── Send text ─────────────────────────────────────────────────────
  const sendMessage = async (content: string, imageUrl: string | null = null) => {
    if (!userId || !groupId || removed) return
    if (!content.trim() && !imageUrl) return
    setSending(true)
    const optimistic: GroupMsg = {
      id: `temp-${Date.now()}`, group_id: groupId, user_id: userId,
      content: content.trim(), image_url: imageUrl, is_pinned: false,
      pinned_by: null, pinned_at: null, created_at: new Date().toISOString(),
      likes: 0, dislikes: 0,
    }
    setMessages(prev => [...prev, optimistic])
    setText("")
    scrollToBottom()
    const { data: inserted } = await supabase.from("group_messages")
      .insert({ group_id: groupId, user_id: userId, content: content.trim(), image_url: imageUrl })
      .select().single()
    if (inserted) setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...inserted, profiles: null } : m))
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(text) }
  }

  // ── Send image ────────────────────────────────────────────────────
  const handleImageFile = async (file: File | null) => {
    if (!file || !userId || !groupId) return
    setImgUploading(true)
    try {
      const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `group/${groupId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("UniMart").upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from("UniMart").getPublicUrl(path)
      await sendMessage("", data.publicUrl)
    } catch (e: any) {
      console.error("Image upload failed:", e.message)
    } finally {
      setImgUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  // ── React (like / dislike) ────────────────────────────────────────
  const react = async (msgId: string, type: 1 | -1) => {
    if (!userId) { router.push("/login"); return }
    const current = reactions[msgId] ?? 0
    const next: 0 | 1 | -1 = current === type ? 0 : type
    setReactions(prev => ({ ...prev, [msgId]: next }))
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m
      let likes = m.likes ?? 0, dislikes = m.dislikes ?? 0
      if (current === 1)  likes    = Math.max(0, likes - 1)
      if (current === -1) dislikes = Math.max(0, dislikes - 1)
      if (next === 1)     likes    += 1
      if (next === -1)    dislikes += 1
      return { ...m, likes, dislikes }
    }))
    const { data: cur } = await supabase.from("group_messages").select("likes,dislikes").eq("id", msgId).single()
    if (!cur) return
    let { likes = 0, dislikes = 0 } = cur as any
    if (current === 1)  likes    = Math.max(0, likes - 1)
    if (current === -1) dislikes = Math.max(0, dislikes - 1)
    if (next === 1)     likes    += 1
    if (next === -1)    dislikes += 1
    await supabase.from("group_messages").update({ likes, dislikes }).eq("id", msgId)
  }

  // ── Pin / unpin ───────────────────────────────────────────────────
  const togglePin = async (msg: GroupMsg) => {
    if (!["admin", "owner"].includes(myRole ?? "")) return
    const newPinned = !msg.is_pinned
    await supabase.from("group_messages").update({
      is_pinned: newPinned, pinned_by: newPinned ? userId : null,
      pinned_at: newPinned ? new Date().toISOString() : null,
    }).eq("id", msg.id)
  }

  // ── Remove member ─────────────────────────────────────────────────
  const removeMember = async (memberId: string) => {
    if (!groupId) return
    await supabase.from("group_members").update({ removed: true })
      .eq("group_id", groupId).eq("user_id", memberId)
    setMembers(prev => prev.filter(m => m.user_id !== memberId))
  }

  // ── Admin application ─────────────────────────────────────────────
  const submitApplication = async () => {
    if (!applyReason.trim() || !userId || !groupId) return
    setApplying(true)
    const { error } = await supabase.from("group_admin_applications")
      .insert({ group_id: groupId, user_id: userId, reason: applyReason.trim() })
    if (!error) { setHasApplied(true); setApplyReason(""); setSheet("none") }
    setApplying(false)
  }

  const reviewApplication = async (appId: string, approve: boolean) => {
    if (approve) {
      await supabase.rpc("approve_admin_application", { p_application_id: appId, p_reviewer_id: userId })
    } else {
      await supabase.from("group_admin_applications")
        .update({ status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", appId)
    }
    setApplications(prev => prev.filter(a => a.id !== appId))
  }

  // Always use the URL school param as source of truth for display.
  // The DB name may have been saved as "undefined Students" before the async params fix.
  const displayName = school

  // ── LOADING ───────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden}
        body{font-family:'DM Sans',system-ui,sans-serif;background:#f4f6fb}
        @keyframes spin{to{transform:rotate(360deg)}}
        .gc-root{display:flex;flex-direction:column;height:100vh;height:100dvh;max-width:760px;margin:0 auto}
        .gc-header{background:linear-gradient(135deg,#0f1f6e 0%,#162380 55%,#1a2a9a 100%);
          padding:14px 12px;display:flex;align-items:center;gap:10px;flex-shrink:0}
        .gc-back{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);
          border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:white}
        .gc-hname{font-size:1rem;font-weight:800;color:white}
      `}</style>
      <div className="gc-root">
        <header className="gc-header">
          <button className="gc-back" onClick={() => router.back()}><ArrowLeft size={20}/></button>
          <span className="gc-hname">{school}</span>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 12 }}>
          <Loader2 size={36} color="#0f1f6e" style={{ animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#64748b", fontSize: "0.88rem" }}>Joining {school} chat…</p>
        </div>
      </div>
    </>
  )

  // ── REMOVED ───────────────────────────────────────────────────────
  if (removed) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh", padding: 32, textAlign: "center", gap: 16 }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={40} color="#94a3b8" />
      </div>
      <h2 style={{ fontWeight: 700, color: "#0f1f6e" }}>You've been removed from this group</h2>
      <button onClick={() => router.back()}
        style={{ padding: "11px 28px", background: "#0f1f6e", color: "white", border: "none",
          borderRadius: "999px", fontWeight: 800, cursor: "pointer" }}>
        Go Back
      </button>
    </div>
  )

  // ── MAIN ──────────────────────────────────────────────────────────
  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html,body{height:100%;overflow:hidden}
      body{font-family:'DM Sans',system-ui,sans-serif;background:#f4f6fb}
      button,input,textarea{font-family:inherit}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes sheetIn{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:translateY(0)}}

      .gc-root{display:flex;flex-direction:column;height:100vh;height:100dvh;
        max-width:760px;margin:0 auto;background:#f4f6fb;overflow:hidden;
        -webkit-overflow-scrolling:touch}

      /* HEADER */
      .gc-header{background:linear-gradient(135deg,#0f1f6e 0%,#162380 55%,#1a2a9a 100%);
        padding:14px 12px;
        display:flex;align-items:center;gap:10px;
        box-shadow:0 4px 20px rgba(13,29,110,0.35);flex-shrink:0;z-index:10}
      .gc-back{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.1);
        border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;transition:background 0.15s;color:white;
        -webkit-tap-highlight-color:transparent}
      .gc-back:active{background:rgba(255,255,255,0.25)}
      .gc-hinfo{flex:1;display:flex;align-items:center;gap:10px;min-width:0;cursor:pointer}
      .gc-hicon{width:38px;height:38px;border-radius:19px;background:rgba(255,255,255,0.15);
        display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .gc-hname{font-size:0.97rem;font-weight:800;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .gc-hsub{font-size:0.7rem;color:rgba(255,255,255,0.55);display:flex;align-items:center;gap:4px;margin-top:2px}
      .gc-online-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0}
      .gc-hbtns{display:flex;gap:4px;flex-shrink:0}
      .gc-hbtn{width:36px;height:36px;border-radius:18px;background:rgba(255,255,255,0.1);
        border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
        color:white;transition:all 0.15s}

      /* PINNED PREVIEW */
      .pinned-preview{display:flex;align-items:center;gap:8px;background:#fffbeb;
        padding:9px 14px;border-bottom:1px solid #fef3c7;cursor:pointer;
        flex-shrink:0;transition:background 0.12s}
      .pinned-preview-txt{flex:1;font-size:0.82rem;color:#1e293b;font-weight:500;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pinned-count{background:#fef3c7;border-radius:999px;padding:2px 8px;
        font-size:0.68rem;font-weight:800;color:#ea580c;flex-shrink:0}

      /* MESSAGES */
      .gc-msgs{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
        padding:12px;display:flex;flex-direction:column;gap:2px}
      .gc-msgs::-webkit-scrollbar{width:3px}
      .gc-msgs::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:2px}

      .time-sep{text-align:center;font-size:0.68rem;color:#94a3b8;margin:10px 0;font-weight:600}

      /* PINNED INDICATOR */
      .pinned-bar{display:flex;align-items:center;gap:4px;justify-content:center;
        background:#fef3c7;border-radius:999px;padding:3px 10px;margin:0 auto 4px;
        font-size:0.68rem;color:#92400e;font-weight:700;width:fit-content}

      /* BUBBLE ROW */
      .gc-bubble-row{display:flex;align-items:flex-end;gap:6px;margin-bottom:2px;animation:fadeIn 0.2s ease both}
      .gc-bubble-row.mine{flex-direction:row-reverse}
      .gc-bav{width:28px;height:28px;border-radius:14px;object-fit:cover;
        flex-shrink:0;margin-bottom:2px;border:1.5px solid #e2e8f0}
      .gc-bav-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);display:flex;
        align-items:center;justify-content:center;color:white;font-size:0.65rem;font-weight:700}
      .gc-bav-spacer{width:28px;flex-shrink:0}

      /* BUBBLE */
      .gc-bwrap{display:flex;flex-direction:column;gap:4px;max-width:min(78%,480px)}
      .gc-bwrap.mine{align-items:flex-end}
      .gc-bubble{border-radius:18px;padding:10px 13px;box-shadow:0 1px 4px rgba(0,0,0,0.07)}
      .gc-bubble.mine{background:#0f1f6e;border-bottom-right-radius:4px}
      .gc-bubble.theirs{background:white;border-bottom-left-radius:4px}
      .gc-bubble.pinned{outline:1.5px solid #fbbf24}
      .gc-sender{font-size:0.68rem;font-weight:800;color:#f97316;margin-bottom:3px}
      .gc-btxt{font-size:16px;line-height:1.52;white-space:pre-wrap;word-break:break-word}
      .gc-bubble.mine .gc-btxt{color:white}
      .gc-bubble.theirs .gc-btxt{color:#1e293b}
      .gc-btime{font-size:0.62rem;text-align:right;margin-top:4px}
      .gc-bubble.mine .gc-btime{color:rgba(255,255,255,0.45)}
      .gc-bubble.theirs .gc-btime{color:#94a3b8}
      .gc-bmsg-img{width:200px;height:200px;object-fit:cover;border-radius:12px;display:block;margin-bottom:6px}

      /* REACTIONS */
      .gc-react-row{display:flex;gap:5px}
      .gc-react-row.mine{justify-content:flex-end}
      .gc-react-btn{display:flex;align-items:center;gap:3px;background:#f8fafc;
        border:1.5px solid #e2e8f0;border-radius:999px;padding:3px 8px;
        cursor:pointer;font-size:0.68rem;font-weight:700;color:#64748b;transition:all 0.12s}
      .gc-react-btn.liked{background:#eef2ff;border-color:#0f1f6e;color:#0f1f6e}
      .gc-react-btn.disliked{background:#fff1f0;border-color:#fca5a5;color:#ef4444}

      /* EMPTY */
      .gc-empty{flex:1;display:flex;flex-direction:column;align-items:center;
        justify-content:center;padding:40px 32px;text-align:center}
      .gc-empty-icon{width:80px;height:80px;border-radius:50%;
        background:linear-gradient(135deg,#eef2ff,#e0e7ff);
        display:flex;align-items:center;justify-content:center;margin-bottom:18px}

      /* ADMIN BANNER */
      .admin-banner{display:flex;align-items:center;gap:8px;background:#eef2ff;
        padding:10px 14px;border-top:1px solid #c7d2fe;cursor:pointer;
        flex-shrink:0;transition:background 0.12s}
      .admin-banner-txt{flex:1;font-size:0.82rem;font-weight:700;color:#0f1f6e}
      .admin-banner-pending{background:#f0fdf4;border-color:#bbf7d0}
      .admin-banner-pending .admin-banner-txt{color:#16a34a}

      /* INPUT BAR */
      .gc-input-bar{display:flex;align-items:flex-end;gap:8px;
        padding:10px 12px 16px;
        background:white;border-top:1px solid #e8ecf4;flex-shrink:0;
        box-shadow:0 -2px 12px rgba(0,0,0,0.04)}
      .gc-img-btn{width:44px;height:44px;border-radius:50%;background:#eef2ff;border:none;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;transition:all 0.15s;color:#0f1f6e;
        -webkit-tap-highlight-color:transparent}
      .gc-img-btn:active:not(:disabled){background:#c7d2fe}
      .gc-img-btn:disabled{opacity:0.55;cursor:not-allowed}
      /* 16px prevents iOS auto-zoom on focus */
      .gc-textarea{flex:1;background:#f4f6fb;border:1.5px solid #e2e8f0;border-radius:22px;
        padding:11px 16px;font-size:16px;color:#1e293b;resize:none;outline:none;
        max-height:120px;line-height:1.45;transition:border-color 0.15s;
        -webkit-appearance:none;appearance:none}
      .gc-textarea:focus{border-color:#0f1f6e}
      .gc-textarea::placeholder{color:#94a3b8}
      .gc-send{width:46px;height:46px;border-radius:23px;
        background:linear-gradient(135deg,#0f1f6e,#1a2a9a);border:none;cursor:pointer;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        transition:all 0.15s;box-shadow:0 3px 10px rgba(13,29,110,0.3);
        -webkit-tap-highlight-color:transparent}
      .gc-send:active:not(:disabled){transform:scale(0.93)}
      .gc-send:disabled{background:#e2e8f0;box-shadow:none;cursor:not-allowed}

      /* SHEET */
      .sheet-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.55);
        backdrop-filter:blur(5px);z-index:500;display:flex;
        align-items:flex-end;justify-content:center}
      @media(min-width:640px){.sheet-backdrop{align-items:center}}
      .sheet-box{background:white;width:100%;max-width:640px;border-radius:20px 20px 0 0;
        max-height:90vh;display:flex;flex-direction:column;animation:sheetIn 0.3s ease;overflow:hidden}
      @media(min-width:640px){.sheet-box{border-radius:20px;max-height:85vh}}
      .sheet-header{display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px;border-bottom:1px solid #f1f5f9;flex-shrink:0}
      .sheet-title{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:800;color:#0f1f6e}
      .sheet-close{background:#f1f5f9;border:none;border-radius:50%;width:32px;height:32px;
        cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;transition:all 0.15s}
      .sheet-body{overflow-y:auto;flex:1}

      /* MEMBER ROW */
      .member-row{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid #f1f5f9}
      .member-av{width:44px;height:44px;border-radius:22px;object-fit:cover;flex-shrink:0;border:2px solid #e2e8f0}
      .member-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);display:flex;
        align-items:center;justify-content:center;color:white;font-weight:700;font-size:1rem}
      .member-name{font-size:0.9rem;font-weight:700;color:#0f1f6e}
      .role-badge{padding:2px 8px;border-radius:999px;font-size:0.6rem;font-weight:800;color:white;background:#0f1f6e}
      .role-badge.owner{background:#f97316}
      .member-meta{font-size:0.72rem;color:#94a3b8;display:flex;align-items:center;gap:4px;margin-top:2px}
      .member-online-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
      .remove-btn{padding:7px;background:#fff1f0;border:none;border-radius:8px;
        cursor:pointer;color:#ef4444;transition:all 0.15s;display:flex;align-items:center}

      /* PINNED CARD */
      .pinned-card{margin:12px;background:#fffbeb;border:1.5px solid #fef3c7;border-radius:14px;padding:14px}
      .pinned-card-name{font-size:0.78rem;font-weight:800;color:#0f1f6e;margin-bottom:5px}
      .pinned-card-txt{font-size:0.88rem;color:#1e293b;line-height:1.55}
      .pinned-card-time{font-size:0.7rem;color:#94a3b8;margin-top:6px}
      .unpin-btn{display:inline-flex;align-items:center;gap:4px;margin-top:10px;padding:5px 12px;
        border:1.5px solid #d1d5db;border-radius:999px;background:none;cursor:pointer;
        font-size:0.72rem;color:#64748b;font-weight:600;transition:all 0.15s}

      /* APPLY FORM */
      .apply-info{background:#eef2ff;border-radius:14px;padding:16px;margin:16px;margin-bottom:0}
      .apply-info-title{font-size:0.82rem;font-weight:800;color:#0f1f6e;margin-bottom:10px}
      .apply-info-item{display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:0.82rem;color:#0f1f6e}
      .apply-field{margin:16px}
      .apply-label{font-size:0.68rem;font-weight:800;color:#0f1f6e;
        text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:7px}
      .apply-textarea{width:100%;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;
        padding:12px 14px;font-size:0.9rem;color:#1e293b;resize:none;outline:none;min-height:130px;line-height:1.5}
      .apply-textarea:focus{border-color:#f97316}
      .apply-submit{display:flex;align-items:center;justify-content:center;gap:8px;
        width:calc(100% - 32px);margin:0 16px 20px;padding:14px;background:#0f1f6e;color:white;
        border:none;border-radius:14px;font-size:0.94rem;font-weight:800;cursor:pointer;transition:all 0.2s}
      .apply-submit:disabled{opacity:0.5;cursor:not-allowed}

      /* APPLICATION CARDS */
      .app-card{margin:12px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px}
      .app-card-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
      .app-av{width:40px;height:40px;border-radius:20px;object-fit:cover;border:2px solid #e2e8f0}
      .app-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);display:flex;
        align-items:center;justify-content:center;color:white;font-weight:700}
      .app-reason{font-size:0.85rem;color:#1e293b;line-height:1.55;font-style:italic}
      .app-time{font-size:0.7rem;color:#94a3b8;margin-top:6px}
      .app-actions{display:flex;gap:10px;margin-top:14px}
      .app-reject{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;
        padding:10px;border:1.5px solid #ef4444;border-radius:12px;background:none;
        cursor:pointer;font-size:0.85rem;font-weight:700;color:#ef4444;transition:all 0.15s}
      .app-approve{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;
        padding:10px;background:#16a34a;border:none;border-radius:12px;
        cursor:pointer;font-size:0.85rem;font-weight:800;color:white;transition:all 0.15s}
    `}</style>

    <div className="gc-root">

      {/* HEADER */}
      <header className="gc-header">
        <button className="gc-back" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <div className="gc-hinfo" onClick={() => setSheet("members")}>
          <div className="gc-hicon">
            <Users size={20} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="gc-hname">{displayName}</div>
            <div className="gc-hsub">
              <span className="gc-online-dot" />
              {onlineCount} online · {groupMeta?.member_count ?? members.length} members
            </div>
          </div>
        </div>
        <div className="gc-hbtns">
          {pinnedMsgs.length > 0 && (
            <button className="gc-hbtn" onClick={() => setSheet("pinned")} title="Pinned messages">
              <Pin size={17} />
            </button>
          )}
          {["admin", "owner"].includes(myRole ?? "") && (
            <button className="gc-hbtn" onClick={() => { loadApplications(); setSheet("applications") }} title="Admin settings">
              <Settings size={17} />
            </button>
          )}
        </div>
      </header>

      {/* PINNED PREVIEW BAR */}
      {pinnedMsgs.length > 0 && (
        <div className="pinned-preview" onClick={() => setSheet("pinned")}>
          <Pin size={14} color="#f97316" style={{ flexShrink: 0 }} />
          <span className="pinned-preview-txt">
            {pinnedMsgs[pinnedMsgs.length - 1].content || "Image"}
          </span>
          <span className="pinned-count">{pinnedMsgs.length}</span>
        </div>
      )}

      {/* MESSAGES */}
      {messages.length === 0 ? (
        <div className="gc-empty">
          <div className="gc-empty-icon">
            <School size={36} color="#818cf8" />
          </div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700,
            fontSize: "1.1rem", color: "#0f1f6e", marginBottom: 8 }}>
            Welcome to {displayName}!
          </h3>
          <p style={{ color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.6 }}>
            {groupMeta?.description ?? "Say hello to your fellow students!"}
          </p>
        </div>
      ) : (
        <div className="gc-msgs">
          {messages.map((msg, i) => {
            const isMine   = msg.user_id === userId
            const p        = msg.profiles
            const name     = p?.full_name || p?.username || "Student"
            const prevMsg  = messages[i - 1]
            const sameUser = prevMsg?.user_id === msg.user_id
            const showTime = !prevMsg ||
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60000
            const myReact  = reactions[msg.id] ?? 0

            return (
              <div key={msg.id}>
                {showTime && <div className="time-sep">{relTime(msg.created_at)}</div>}
                {msg.is_pinned && (
                  <div className="pinned-bar">
                    <Pin size={11} /> Pinned
                  </div>
                )}
                <div className={`gc-bubble-row ${isMine ? "mine" : ""}`}>
                  {!isMine && !sameUser && (
                    p?.avatar_url
                      ? <img src={p.avatar_url} alt={name} className="gc-bav" />
                      : <div className="gc-bav gc-bav-fb">{name[0].toUpperCase()}</div>
                  )}
                  {!isMine && sameUser && <div className="gc-bav-spacer" />}

                  <div className={`gc-bwrap ${isMine ? "mine" : ""}`}>
                    <div
                      className={`gc-bubble ${isMine ? "mine" : "theirs"} ${msg.is_pinned ? "pinned" : ""}`}
                      onDoubleClick={() => togglePin(msg)}
                      title={["admin","owner"].includes(myRole ?? "") ? "Double-click to pin/unpin" : ""}
                    >
                      {!isMine && !sameUser && (
                        <div className="gc-sender">
                          {name}{p?.is_premium ? " ·" : ""}
                          {p?.is_premium && <ShieldCheck size={10} color="#f97316" style={{ display: "inline", marginLeft: 3 }} />}
                        </div>
                      )}
                      {msg.image_url && (
                        <img src={msg.image_url} alt="Image" className="gc-bmsg-img" />
                      )}
                      {msg.content && <p className="gc-btxt">{msg.content}</p>}
                      <div className="gc-btime">{fmtClock(msg.created_at)}</div>
                    </div>

                    {/* Reactions */}
                    <div className={`gc-react-row ${isMine ? "mine" : ""}`}>
                      <button
                        className={`gc-react-btn ${myReact === 1 ? "liked" : ""}`}
                        onClick={() => react(msg.id, 1)}
                      >
                        <ThumbsUp size={11} />
                        {(msg.likes ?? 0) > 0 && <span>{msg.likes}</span>}
                      </button>
                      <button
                        className={`gc-react-btn ${myReact === -1 ? "disliked" : ""}`}
                        onClick={() => react(msg.id, -1)}
                      >
                        <ThumbsDown size={11} />
                        {(msg.dislikes ?? 0) > 0 && <span>{msg.dislikes}</span>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ADMIN APPLY BANNER */}
      {myRole === "member" && !hasApplied && (
        <div className="admin-banner" onClick={() => setSheet("apply")}>
          <ShieldCheck size={16} color="#0f1f6e" />
          <span className="admin-banner-txt">Apply to become a group admin</span>
          <ArrowLeft size={16} color="#0f1f6e" style={{ transform: "rotate(180deg)" }} />
        </div>
      )}
      {myRole === "member" && hasApplied && (
        <div className="admin-banner admin-banner-pending">
          <Check size={16} color="#16a34a" />
          <span className="admin-banner-txt">Admin application under review</span>
        </div>
      )}

      {/* INPUT BAR */}
      <div className="gc-input-bar">
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => handleImageFile(e.target.files?.[0] ?? null)} />
        <button className="gc-img-btn" onClick={() => fileRef.current?.click()} disabled={imgUploading || removed}
          title="Send image">
          {imgUploading
            ? <Loader2 size={19} style={{ animation: "spin 0.8s linear infinite" }} />
            : <ImageIcon size={19} />
          }
        </button>
        <textarea
          ref={inputRef}
          className="gc-textarea"
          placeholder={removed ? "You've been removed from this group" : `Message ${displayName.split(" ")[0]}…`}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          maxLength={1000}
          disabled={removed}
        />
        <button className="gc-send" onClick={() => sendMessage(text)}
          disabled={!text.trim() || sending || removed} aria-label="Send">
          {sending
            ? <Loader2 size={17} color="white" style={{ animation: "spin 0.8s linear infinite" }} />
            : <Send size={17} color="white" />
          }
        </button>
      </div>
    </div>

    {/* ════════════ SHEETS ════════════ */}

    {/* Members */}
    <Sheet open={sheet === "members"} onClose={() => setSheet("none")}
      title={`Members (${members.length})`}>
      {members.map(m => {
        const p = m.profiles
        const name = p?.full_name || p?.username || "Student"
        const isMe = m.user_id === userId
        return (
          <div key={m.user_id} className="member-row">
            {p?.avatar_url
              ? <img src={p.avatar_url} alt={name} className="member-av" />
              : <div className="member-av member-av-fb">{name[0].toUpperCase()}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span className="member-name">{name}{isMe ? " (You)" : ""}</span>
                {m.role === "admin" && <span className="role-badge">Admin</span>}
                {m.role === "owner" && <span className="role-badge owner">Owner</span>}
              </div>
              <div className="member-meta">
                <span className="member-online-dot"
                  style={{ background: m.is_online ? "#4ade80" : "#e2e8f0" }} />
                {m.is_online ? "Online" : `Last seen ${relTime(m.last_seen)}`}
              </div>
            </div>
            {["admin","owner"].includes(myRole ?? "") && !isMe && m.role !== "owner" && (
              <button className="remove-btn" onClick={() => removeMember(m.user_id)} title="Remove member">
                <UserMinus size={15} />
              </button>
            )}
          </div>
        )
      })}
    </Sheet>

    {/* Pinned messages */}
    <Sheet open={sheet === "pinned"} onClose={() => setSheet("none")} title="Pinned Messages">
      {pinnedMsgs.length === 0 ? (
        <p style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: "0.88rem" }}>
          No pinned messages yet.
        </p>
      ) : pinnedMsgs.map(msg => (
        <div key={msg.id} className="pinned-card">
          <div className="pinned-card-name">
            {msg.profiles?.full_name || msg.profiles?.username || "Student"}
          </div>
          {msg.image_url && (
            <img src={msg.image_url} alt="Pinned"
              style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 10, marginBottom: 8, display: "block" }} />
          )}
          {msg.content && <p className="pinned-card-txt">{msg.content}</p>}
          <p className="pinned-card-time">{relTime(msg.created_at)}</p>
          {["admin","owner"].includes(myRole ?? "") && (
            <button className="unpin-btn" onClick={() => togglePin(msg)}>
              <Pin size={12} /> Unpin
            </button>
          )}
        </div>
      ))}
    </Sheet>

    {/* Apply for admin */}
    <Sheet open={sheet === "apply"} onClose={() => setSheet("none")} title="Apply to be Admin">
      <div className="apply-info">
        <p className="apply-info-title">Admin responsibilities</p>
        {[
          { label: "Pin important messages" },
          { label: "Remove rule-breaking members" },
          { label: "Keep the group respectful" },
          { label: "Reviewed by existing admins" },
        ].map(r => (
          <div key={r.label} className="apply-info-item">
            <Check size={14} color="#0f1f6e" style={{ flexShrink: 0 }} /> {r.label}
          </div>
        ))}
      </div>
      <div className="apply-field">
        <label className="apply-label">Why do you want to be an admin? *</label>
        <textarea
          className="apply-textarea"
          placeholder="Explain why you'd be a good admin…"
          value={applyReason}
          onChange={e => setApplyReason(e.target.value)}
          maxLength={500}
          rows={5}
        />
        <p style={{ fontSize: "0.72rem", color: "#94a3b8", textAlign: "right", marginTop: 4 }}>
          {applyReason.length}/500
        </p>
      </div>
      <button className="apply-submit" onClick={submitApplication}
        disabled={!applyReason.trim() || applying}>
        {applying
          ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Submitting…</>
          : "Submit Application"
        }
      </button>
    </Sheet>

    {/* Review applications (admin only) */}
    <Sheet open={sheet === "applications"} onClose={() => setSheet("none")}
      title={`Applications (${applications.length})`}>
      {applications.length === 0 ? (
        <p style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: "0.88rem" }}>
          No pending applications.
        </p>
      ) : applications.map(app => {
        const p = app.profiles
        const name = p?.full_name || p?.username || "User"
        return (
          <div key={app.id} className="app-card">
            <div className="app-card-head">
              {p?.avatar_url
                ? <img src={p.avatar_url} alt={name} className="app-av" />
                : <div className="app-av app-av-fb">{name[0].toUpperCase()}</div>
              }
              <span style={{ fontWeight: 700, color: "#0f1f6e", fontSize: "0.94rem" }}>{name}</span>
            </div>
            <p className="app-reason">"{app.reason}"</p>
            <p className="app-time">Applied {relTime(app.created_at)}</p>
            <div className="app-actions">
              <button className="app-reject" onClick={() => reviewApplication(app.id, false)}>
                <X size={14} /> Reject
              </button>
              <button className="app-approve" onClick={() => reviewApplication(app.id, true)}>
                <Check size={14} /> Approve
              </button>
            </div>
          </div>
        )
      })}
    </Sheet>
    </>
  )
}