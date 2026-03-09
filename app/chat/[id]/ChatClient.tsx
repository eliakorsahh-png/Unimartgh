"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Send, ShieldCheck, Tag, Loader2,
  Check, CheckCheck, MessageSquare,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  image_url: string | null
  read: boolean
  created_at: string
}

type ConvMeta = {
  id: string
  buyer_id: string
  seller_id: string
  post?: { id: string; title: string; image_url: string | null; price: number | null } | null
  other_profile?: {
    id: string; username: string; full_name: string | null
    avatar_url: string | null; is_premium: boolean
  } | null
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return "Just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function fmtPrice(p: number | null) {
  return p != null ? `GH₵ ${Number(p).toFixed(2)}` : null
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatClient({ id }: { id: string }) {
  const router   = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const [userId, setUserId]     = useState<string | null>(null)
  const [meta, setMeta]         = useState<ConvMeta | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const [text, setText]         = useState("")
  const [sending, setSending]   = useState(false)

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" }), 60)
  }, [])

  // ── Boot ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.replace("/login"); return }
      const uid = session.user.id
      setUserId(uid)

      const { data: conv } = await supabase
        .from("conversations").select("id,buyer_id,seller_id,post_id").eq("id", id).single()
      if (!conv) { setLoading(false); return }

      const otherId = conv.buyer_id === uid ? conv.seller_id : conv.buyer_id

      const [{ data: profile }, postResult] = await Promise.all([
        supabase.from("profiles").select("id,username,full_name,avatar_url,is_premium").eq("id", otherId).single(),
        conv.post_id
          ? supabase.from("postings").select("id,title,image_url,price").eq("id", conv.post_id).single()
          : Promise.resolve({ data: null }),
      ])

      setMeta({ ...conv, other_profile: profile ?? null, post: postResult.data ?? null })

      const { data: msgs } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_id,content,image_url,read,created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })

      setMessages((msgs ?? []) as Message[])
      setLoading(false)
      scrollToBottom(false)

      // Mark read
      await supabase.from("conversations")
        .update({ [uid === conv.buyer_id ? "buyer_unread" : "seller_unread"]: 0 })
        .eq("id", conv.id)
      await supabase.from("messages")
        .update({ read: true }).eq("conversation_id", conv.id).neq("sender_id", uid)
    })
  }, [id])

  // ── Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`chat-web:${id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        const msg = payload.new as Message
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
        scrollToBottom()
        // Mark read if incoming
        if (msg.sender_id !== userId && meta) {
          supabase.from("conversations")
            .update({ [userId === meta.buyer_id ? "buyer_unread" : "seller_unread"]: 0 })
            .eq("id", id)
          supabase.from("messages").update({ read: true })
            .eq("conversation_id", id).neq("sender_id", userId)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, meta, id])

  // ── Send ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const content = text.trim()
    if (!content || !userId || !meta || sending) return
    setSending(true)
    setText("")

    const optimistic: Message = {
      id: `temp-${Date.now()}`, conversation_id: id,
      sender_id: userId, content, image_url: null,
      read: false, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    scrollToBottom()

    const { data: inserted } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: userId, content, image_url: null })
      .select("id,conversation_id,sender_id,content,image_url,read,created_at")
      .single()

    if (inserted) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? inserted as Message : m))
    }

    const otherUnread = userId === meta.buyer_id ? "seller_unread" : "buyer_unread"
    await supabase.from("conversations").update({
      last_message: content, last_message_at: new Date().toISOString(),
    }).eq("id", id)
    const { data: cur } = await supabase.from("conversations").select(otherUnread).eq("id", id).single()
    if (cur) await supabase.from("conversations")
      .update({ [otherUnread]: ((cur as any)[otherUnread] ?? 0) + 1 }).eq("id", id)

    setSending(false)
    inputRef.current?.focus()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Render ────────────────────────────────────────────────────────
  const otherName = meta?.other_profile?.full_name || meta?.other_profile?.username || "Chat"

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

      /* ROOT — 100dvh with overflow:hidden so only .chat-msgs scrolls */
      .chat-root{display:flex;flex-direction:column;height:100vh;height:100dvh;
        max-width:760px;margin:0 auto;background:#f4f6fb;overflow:hidden;
        -webkit-overflow-scrolling:touch}

      /* HEADER — iOS notch safe area */
      .chat-header{background:linear-gradient(135deg,#0f1f6e 0%,#162380 55%,#1a2a9a 100%);
        padding:14px 12px;
        display:flex;align-items:center;gap:10px;
        box-shadow:0 4px 20px rgba(13,29,110,0.35);flex-shrink:0;z-index:10}
      .chat-back{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.1);
        border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;transition:background 0.15s;color:white;
        -webkit-tap-highlight-color:transparent}
      .chat-back:active{background:rgba(255,255,255,0.25)}
      .chat-header-info{flex:1;display:flex;align-items:center;gap:10px;min-width:0;cursor:pointer}
      .chat-hav{width:42px;height:42px;border-radius:21px;object-fit:cover;
        flex-shrink:0;border:2px solid rgba(255,255,255,0.3)}
      .chat-hav-fb{background:rgba(255,255,255,0.2);display:flex;align-items:center;
        justify-content:center;color:white;font-weight:800;font-size:1rem}
      .chat-other-name{font-size:1rem;font-weight:800;color:white;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .chat-other-sub{font-size:0.72rem;color:rgba(255,255,255,0.55);margin-top:2px;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .chat-verified{width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.2);
        display:flex;align-items:center;justify-content:center;flex-shrink:0}

      /* POST BANNER */
      .post-banner{display:flex;align-items:center;gap:10px;background:white;
        padding:10px 14px;border-bottom:1px solid #e8ecf4;flex-shrink:0}
      .post-banner-img{width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0}
      .post-banner-info{flex:1;min-width:0}
      .post-banner-title{font-size:0.82rem;font-weight:700;color:#0f1f6e;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .post-banner-price{font-size:0.82rem;font-weight:800;color:#ea580c;margin-top:2px}

      /* MESSAGES — flex:1 + min-height:0 prevents overflow on mobile */
      .chat-msgs{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
        padding:12px 12px 8px;display:flex;flex-direction:column;gap:4px}
      .chat-msgs::-webkit-scrollbar{width:3px}
      .chat-msgs::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:2px}

      /* TIME SEPARATOR */
      .time-sep{text-align:center;font-size:0.68rem;color:#94a3b8;margin:10px 0;
        font-weight:600;letter-spacing:0.03em}

      /* BUBBLE ROW */
      .bubble-row{display:flex;align-items:flex-end;gap:6px;animation:fadeIn 0.18s ease both}
      .bubble-row.mine{flex-direction:row-reverse}
      .bubble-av{width:28px;height:28px;border-radius:14px;object-fit:cover;
        flex-shrink:0;margin-bottom:4px;border:1.5px solid #e2e8f0}
      .bubble-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:0.65rem;font-weight:700}
      .bubble-av-spacer{width:28px;flex-shrink:0}

      /* BUBBLE — 80% on mobile, capped at 480px on desktop */
      .bubble{max-width:min(80%,480px);border-radius:18px;padding:9px 13px;
        box-shadow:0 1px 4px rgba(0,0,0,0.07)}
      .bubble.mine{background:#0f1f6e;border-bottom-right-radius:4px}
      .bubble.theirs{background:white;border-bottom-left-radius:4px}
      /* font-size 16px prevents iOS auto-zoom on focus */
      .bubble-text{font-size:16px;line-height:1.52;white-space:pre-wrap;word-break:break-word}
      .bubble.mine .bubble-text{color:white}
      .bubble.theirs .bubble-text{color:#1e293b}
      .bubble-footer{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:4px}
      .bubble-time{font-size:0.63rem}
      .bubble.mine .bubble-time{color:rgba(255,255,255,0.5)}
      .bubble.theirs .bubble-time{color:#94a3b8}
      .read-icon-sent{color:rgba(255,255,255,0.45)}
      .read-icon-read{color:#f97316}

      /* EMPTY */
      .chat-empty{flex:1;display:flex;flex-direction:column;align-items:center;
        justify-content:center;padding:32px 24px;text-align:center}
      .chat-empty-icon{width:72px;height:72px;border-radius:50%;
        background:linear-gradient(135deg,#eef2ff,#e0e7ff);
        display:flex;align-items:center;justify-content:center;margin-bottom:16px}

      /* INPUT BAR — home indicator safe area on iPhone */
      .chat-input-bar{display:flex;align-items:flex-end;gap:8px;
        padding:10px 12px 16px;
        background:white;border-top:1px solid #e8ecf4;flex-shrink:0;
        box-shadow:0 -2px 12px rgba(0,0,0,0.04)}
      /* 16px font prevents iOS auto-zoom on textarea focus */
      .chat-textarea{flex:1;background:#f4f6fb;border:1.5px solid #e2e8f0;border-radius:22px;
        padding:11px 16px;font-size:16px;color:#1e293b;resize:none;outline:none;
        max-height:120px;line-height:1.45;transition:border-color 0.15s;
        -webkit-appearance:none;appearance:none}
      .chat-textarea:focus{border-color:#0f1f6e}
      .chat-textarea::placeholder{color:#94a3b8}
      .chat-send{width:46px;height:46px;border-radius:23px;
        background:linear-gradient(135deg,#0f1f6e,#1a2a9a);border:none;cursor:pointer;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        transition:all 0.15s;box-shadow:0 3px 10px rgba(13,29,110,0.3);
        -webkit-tap-highlight-color:transparent}
      .chat-send:active:not(:disabled){transform:scale(0.93)}
      .chat-send:disabled{background:#e2e8f0;box-shadow:none;cursor:not-allowed}

      /* LOADING */
      .chat-loading{flex:1;display:flex;align-items:center;justify-content:center}
    `}</style>

    <div className="chat-root">

      {/* HEADER */}
      <header className="chat-header">
        <button className="chat-back" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <div className="chat-header-info"
          onClick={() => meta?.other_profile?.id && router.push(`/profile/${meta.other_profile.id}`)}>
          {meta?.other_profile?.avatar_url
            ? <img src={meta.other_profile.avatar_url} alt={otherName} className="chat-hav" />
            : <div className="chat-hav chat-hav-fb">{otherName[0].toUpperCase()}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="chat-other-name">{otherName}</span>
              {meta?.other_profile?.is_premium && (
                <span className="chat-verified">
                  <ShieldCheck size={10} color="#eef2ff" />
                </span>
              )}
            </div>
            {meta?.post && (
              <div className="chat-other-sub">re: {meta.post.title}</div>
            )}
          </div>
        </div>
      </header>

      {/* POST BANNER */}
      {meta?.post && (
        <div className="post-banner">
          {meta.post.image_url && (
            <img src={meta.post.image_url} alt={meta.post.title} className="post-banner-img" />
          )}
          <div className="post-banner-info">
            <div className="post-banner-title">{meta.post.title}</div>
            {meta.post.price != null && (
              <div className="post-banner-price">{fmtPrice(meta.post.price)}</div>
            )}
          </div>
          <Tag size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
        </div>
      )}

      {/* MESSAGES */}
      {loading ? (
        <div className="chat-loading">
          <Loader2 size={36} color="#0f1f6e" style={{ animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : messages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-empty-icon">
            <MessageSquare size={32} color="#818cf8" />
          </div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700,
            fontSize: "1.05rem", color: "#0f1f6e", marginBottom: 8 }}>
            Say hello to {otherName.split(" ")[0]}!
          </h3>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.6 }}>
            Ask about the listing or make an offer.
          </p>
        </div>
      ) : (
        <div className="chat-msgs">
          {messages.map((msg, i) => {
            const isMine  = msg.sender_id === userId
            const prevMsg = messages[i - 1]
            const sameUser = prevMsg?.sender_id === msg.sender_id
            const showTime = !prevMsg ||
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60000

            return (
              <div key={msg.id}>
                {showTime && (
                  <div className="time-sep">{timeAgo(msg.created_at)}</div>
                )}
                <div className={`bubble-row ${isMine ? "mine" : ""}`}>
                  {!isMine && !sameUser && (
                    meta?.other_profile?.avatar_url
                      ? <img src={meta.other_profile.avatar_url} alt={otherName} className="bubble-av" />
                      : <div className="bubble-av bubble-av-fb">{otherName[0].toUpperCase()}</div>
                  )}
                  {!isMine && sameUser && <div className="bubble-av-spacer" />}

                  <div className={`bubble ${isMine ? "mine" : "theirs"}`}>
                    <p className="bubble-text">{msg.content}</p>
                    <div className="bubble-footer">
                      <span className="bubble-time">{fmtTime(msg.created_at)}</span>
                      {isMine && (
                        msg.read
                          ? <CheckCheck size={13} className="read-icon-read" />
                          : <Check size={13} className="read-icon-sent" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* INPUT BAR */}
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-textarea"
          placeholder={`Message ${otherName.split(" ")[0]}…`}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          maxLength={1000}
        />
        <button
          className="chat-send"
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          aria-label="Send"
        >
          {sending
            ? <Loader2 size={17} color="white" style={{ animation: "spin 0.8s linear infinite" }} />
            : <Send size={17} color="white" />
          }
        </button>
      </div>
    </div>
    </>
  )
}