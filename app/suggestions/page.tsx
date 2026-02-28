"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ArrowLeft, Send, Loader2, ShoppingBag, ChevronDown, Info } from "lucide-react"

type Suggestion = {
  id: number
  name: string
  message: string
  created_at: string
}

const GUIDELINES = [
  { icon: "✅", rule: "Be respectful — treat every member with kindness and dignity." },
  { icon: "💡", rule: "Share genuine ideas and feedback to improve UniMart for everyone." },
  { icon: "🚫", rule: "No spam, advertisements, hate speech or personal attacks." },
  { icon: "📵", rule: "Never share personal phone numbers or private information publicly." },
  { icon: "🛒", rule: "Keep conversations relevant to the UniMart campus marketplace." },
  { icon: "⚠️", rule: "Violating these rules may result in your messages being removed." },
]

export default function SuggestionsPage() {
  const router = useRouter()
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [suggestions, setSuggestions]     = useState<Suggestion[]>([])
  const [loading, setLoading]             = useState(true)
  const [name, setName]                   = useState("")
  const [message, setMessage]             = useState("")
  const [sending, setSending]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [connected, setConnected]         = useState(false)
  const [guidelinesOpen, setGuidelinesOpen] = useState(true)

  // ── Initial fetch ────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("suggestions")
      .select("id, name, message, created_at")
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (!err) setSuggestions((data ?? []) as Suggestion[])
        setLoading(false)
      })
  }, [])

  // ── Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const ch = supabase
      .channel("suggestions-live", {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "suggestions" },
        (payload) => {
          setSuggestions(prev => {
            const incoming = payload.new as Suggestion
            // Avoid duplicates (may already be there via optimistic insert)
            if (prev.some(s => s.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED")
      })

    channelRef.current = ch
    return () => { supabase.removeChannel(ch); channelRef.current = null }
  }, [])

  // ── Auto-scroll ──────────────────────────────────────────────────
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [suggestions, loading])

  // ── Send ─────────────────────────────────────────────────────────
  const send = async () => {
    const msg = message.trim()
    if (!msg || sending) return
    setSending(true)
    setError(null)

    // Optimistic: push immediately with temp id
    const tempId = Date.now()
    const optimistic: Suggestion = {
      id: tempId,
      name: name.trim() || "Anonymous",
      message: msg,
      created_at: new Date().toISOString(),
    }
    setSuggestions(prev => [...prev, optimistic])
    setMessage("")
    if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.focus() }

    const { data, error: err } = await supabase
      .from("suggestions")
      .insert({ name: name.trim() || "Anonymous", message: msg })
      .select("id, name, message, created_at")
      .single()

    if (err) {
      setSuggestions(prev => prev.filter(s => s.id !== tempId))
      setError("Failed to send. Please try again.")
      setMessage(msg)
    } else if (data) {
      // Swap temp record with real one
      setSuggestions(prev => prev.map(s => s.id === tempId ? (data as Suggestion) : s))
    }

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const timeLabel = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diff < 1)  return "Just now"
    if (diff < 60) return `${diff}m ago`
    if (Math.floor(diff / 60) < 24) return d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" })
    return d.toLocaleDateString("en-GB", { day:"numeric", month:"short" })
  }

  const colorForName = (n: string): [string, string] => {
    const palette: [string, string][] = [
      ["#dbeafe","#1d4ed8"],["#fce7f3","#be185d"],["#dcfce7","#15803d"],
      ["#fef9c3","#a16207"],["#ede9fe","#7c3aed"],["#ffedd5","#c2410c"],
      ["#cffafe","#0e7490"],["#fee2e2","#dc2626"],["#f0fdf4","#166534"],
    ]
    let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h)
    return palette[Math.abs(h) % palette.length]
  }

  const withDividers = () => {
    const out: Array<{ type:"divider"; label:string } | { type:"msg"; data:Suggestion }> = []
    let lastDay = ""
    for (const s of suggestions) {
      const day = new Date(s.created_at).toDateString()
      if (day !== lastDay) {
        lastDay = day
        const now = new Date(), d = new Date(s.created_at)
        const label = d.toDateString() === now.toDateString() ? "Today"
          : d.toDateString() === new Date(now.getTime() - 86400000).toDateString() ? "Yesterday"
          : d.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })
        out.push({ type:"divider", label })
      }
      out.push({ type:"msg", data:s })
    }
    return out
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        input, select, textarea { font-size:16px !important; }
        body { overflow:hidden; height:100dvh; background:#efeae2; font-family:'DM Sans',system-ui,sans-serif; }

        @keyframes fadeUp  { from{opacity:0;transform:translateY(9px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes slideDown { from{opacity:0;max-height:0} to{opacity:1;max-height:400px} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.45} }

        .shell { display:flex; flex-direction:column; height:100dvh; max-width:760px; margin:0 auto; }

        /* ── HEADER ── */
        .hd {
          background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 55%,#1e3bb0 100%);
          height:62px; padding:0 14px;
          display:flex; align-items:center; gap:12px;
          box-shadow:0 2px 18px rgba(13,29,110,0.38);
          flex-shrink:0; z-index:20;
        }
        .back-btn { background:rgba(255,255,255,0.12); border:none; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; transition:background .15s; flex-shrink:0; }
        .back-btn:hover { background:rgba(255,255,255,0.22); }
        .hd-av { width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,#f97316,#ea580c); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:2px solid rgba(255,255,255,0.25); }
        .hd-info { flex:1; min-width:0; }
        .hd-name { font-family:'Playfair Display',serif; color:white; font-weight:700; font-size:0.96rem; line-height:1.2; }
        .hd-live { display:flex; align-items:center; gap:5px; margin-top:2px; }
        .live-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .live-dot.on  { background:#4ade80; box-shadow:0 0 0 2px rgba(74,222,128,0.3); animation:pulse 2s infinite; }
        .live-dot.off { background:#94a3b8; }
        .live-txt { font-size:0.69rem; color:rgba(255,255,255,0.5); font-family:'DM Sans',sans-serif; }
        .hd-count { font-size:0.72rem; color:rgba(255,255,255,0.38); font-family:'DM Sans',sans-serif; flex-shrink:0; }

        /* ── GUIDELINES ── */
        .gl-wrap { background:linear-gradient(135deg,#0a1858,#0f1f6e); flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.07); }
        .gl-toggle { display:flex; align-items:center; gap:9px; padding:11px 16px; cursor:pointer; user-select:none; }
        .gl-badge { background:linear-gradient(135deg,#ea580c,#f97316); color:white; font-size:0.6rem; font-weight:800; padding:3px 10px; border-radius:999px; letter-spacing:0.1em; text-transform:uppercase; font-family:'DM Sans',sans-serif; white-space:nowrap; flex-shrink:0; }
        .gl-label { font-family:'DM Sans',sans-serif; font-weight:700; color:rgba(255,255,255,0.85); font-size:0.79rem; flex:1; }
        .gl-chevron { color:rgba(255,255,255,0.4); transition:transform .3s; flex-shrink:0; }
        .gl-chevron.open { transform:rotate(180deg); }
        .gl-body { padding:4px 14px 14px; animation:slideDown .3s ease; overflow:hidden; }
        .gl-rule {
          display:flex; align-items:flex-start; gap:11px;
          padding:9px 13px; margin-bottom:6px;
          background:rgba(255,255,255,0.06);
          border-radius:12px; border-left:3px solid #f97316;
        }
        .gl-icon { font-size:1rem; flex-shrink:0; margin-top:1px; }
        .gl-text { font-size:0.79rem; color:rgba(255,255,255,0.88); font-family:'DM Sans',sans-serif; line-height:1.5; font-weight:600; }

        /* ── BODY ── */
        .chat-body {
          flex:1; overflow-y:auto; padding:12px 11px 10px;
          display:flex; flex-direction:column; gap:0;
          background-color:#efeae2;
          background-image:url("data:image/svg+xml,%3Csvg width='56' height='56' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='28' cy='28' r='1.3' fill='rgba(0,0,0,0.045)'/%3E%3C/svg%3E");
        }
        .chat-body::-webkit-scrollbar { width:4px; }
        .chat-body::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:4px; }

        /* ── DATE DIVIDER ── */
        .div-row { display:flex; align-items:center; gap:8px; margin:14px 0 8px; }
        .div-line { flex:1; height:1px; background:rgba(0,0,0,0.1); }
        .div-lbl { font-size:0.67rem; font-weight:700; color:rgba(0,0,0,0.38); background:rgba(255,255,255,0.65); padding:3px 12px; border-radius:999px; font-family:'DM Sans',sans-serif; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.07); }

        /* ── BUBBLE ── */
        .brow { display:flex; align-items:flex-end; gap:7px; margin-bottom:6px; animation:fadeUp .22s ease; }
        .bav { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.66rem; font-weight:800; flex-shrink:0; }
        .bubble { max-width:75%; padding:8px 12px 6px; border-radius:18px; word-break:break-word; line-height:1.5; box-shadow:0 1px 3px rgba(0,0,0,0.1); position:relative; }
        .bubble.L { background:white; border-bottom-left-radius:3px; }
        .bubble.L::before { content:''; position:absolute; bottom:0; left:-7px; border-right:8px solid white; border-top:8px solid transparent; }
        .bubble.pending { opacity:0.6; }
        .b-name { font-size:0.67rem; font-weight:800; margin-bottom:3px; font-family:'DM Sans',sans-serif; }
        .b-text { font-size:0.86rem; color:#111827; font-family:'DM Sans',sans-serif; }
        .b-time { font-size:0.6rem; color:#94a3b8; margin-top:5px; text-align:right; font-family:'DM Sans',sans-serif; }

        /* ── SKELETON ── */
        .skel { background:linear-gradient(90deg,#e2dbd2 25%,#d8d0c6 50%,#e2dbd2 75%); background-size:400px 100%; animation:shimmer 1.2s infinite; border-radius:14px; }

        /* ── EMPTY ── */
        .empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:40px 24px; }
        .empty p { font-size:0.84rem; color:#64748b; font-family:'DM Sans',sans-serif; text-align:center; line-height:1.65; }

        /* ── FOOTER ── */
        .foot { background:white; border-top:1px solid rgba(0,0,0,0.07); padding:10px 12px 12px; flex-shrink:0; z-index:20; }
        .nm-inp { width:100%; padding:8px 14px; border:1.5px solid #e2e8f0; border-radius:999px; font-family:'DM Sans',sans-serif; color:#1e293b; background:#f8fafc; outline:none; transition:all .2s; margin-bottom:8px; }
        .nm-inp:focus { border-color:#f97316; box-shadow:0 0 0 3px rgba(249,115,22,0.1); }
        .nm-inp::placeholder { color:#c8d3de; }
        .msg-row { display:flex; align-items:flex-end; gap:9px; }
        .msg-inp { flex:1; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:22px; font-family:'DM Sans',sans-serif; color:#1e293b; background:#f8fafc; outline:none; resize:none; max-height:110px; overflow-y:auto; line-height:1.5; transition:all .2s; }
        .msg-inp:focus { border-color:#25D366; box-shadow:0 0 0 3px rgba(37,211,102,0.12); background:white; }
        .msg-inp::placeholder { color:#c8d3de; }
        .send-btn { width:44px; height:44px; border-radius:50%; border:none; cursor:pointer; background:linear-gradient(135deg,#25D366,#128C7E); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 14px rgba(37,211,102,0.35); transition:all .2s; }
        .send-btn:hover:not(:disabled) { transform:scale(1.09); box-shadow:0 6px 20px rgba(37,211,102,0.45); }
        .send-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
        .hint { font-size:0.64rem; color:#94a3b8; font-family:'DM Sans',sans-serif; margin-top:6px; text-align:center; }
        .err-bar { padding:8px 14px; background:#fff1f0; border-top:1px solid #fca5a5; font-size:0.76rem; color:#dc2626; font-family:'DM Sans',sans-serif; text-align:center; flex-shrink:0; }

        @media(max-width:480px){
          .bubble { max-width:85%; }
          .gl-text { font-size:0.75rem; }
        }
      `}</style>

      <div className="shell">

        {/* ── HEADER ── */}
        <header className="hd">
          <button className="back-btn" onClick={() => router.push("/")}>
            <ArrowLeft size={17} />
          </button>
          <div className="hd-av">
            <ShoppingBag size={20} color="white" />
          </div>
          <div className="hd-info">
            <div className="hd-name">UniMart Suggestions</div>
            <div className="hd-live">
              <span className={`live-dot ${connected ? "on" : "off"}`} />
              <span className="live-txt">
                {connected ? "Live — messages appear instantly" : "Connecting…"}
              </span>
            </div>
          </div>
          <span className="hd-count">
            {loading ? "…" : `${suggestions.length} msg${suggestions.length !== 1 ? "s" : ""}`}
          </span>
        </header>

        {/* ── GUIDELINES ── */}
        <div className="gl-wrap">
          <div className="gl-toggle" onClick={() => setGuidelinesOpen(o => !o)}>
            <Info size={14} color="rgba(255,255,255,0.6)" />
            <span className="gl-badge">📋 Community Rules</span>
            <span className="gl-label">Read before posting</span>
            <ChevronDown size={15} className={`gl-chevron ${guidelinesOpen ? "open" : ""}`} />
          </div>

          {guidelinesOpen && (
            <div className="gl-body">
              {GUIDELINES.map((g, i) => (
                <div key={i} className="gl-rule">
                  <span className="gl-icon">{g.icon}</span>
                  <span className="gl-text">{g.rule}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── MESSAGES ── */}
        <div className="chat-body">

          {/* Skeletons */}
          {loading && Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-end', marginBottom:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'#ddd5c9', flexShrink:0 }} />
              <div className="skel" style={{ height:44, width:`${130 + (i * 43) % 120}px` }} />
            </div>
          ))}

          {/* Empty state */}
          {!loading && suggestions.length === 0 && (
            <div className="empty">
              <div style={{ width:68, height:68, borderRadius:'50%', background:'rgba(255,255,255,0.75)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ShoppingBag size={28} color="#0f1f6e" />
              </div>
              <p>No suggestions yet!<br />Be the first to share an idea 💡</p>
            </div>
          )}

          {/* Actual messages */}
          {!loading && withDividers().map((item, i) => {
            if (item.type === "divider") {
              return (
                <div key={`d${i}`} className="div-row">
                  <div className="div-line" />
                  <span className="div-lbl">{item.label}</span>
                  <div className="div-line" />
                </div>
              )
            }

            const s = item.data
            const displayName = s.name || "Anonymous"
            const [bg, fg] = colorForName(displayName)
            const isTemp = s.id > 1_700_000_000_000

            return (
              <div key={s.id} className="brow">
                <div className="bav" style={{ background:bg, color:fg }}>
                  {displayName[0].toUpperCase()}
                </div>
                <div className={`bubble L${isTemp ? " pending" : ""}`}>
                  <div className="b-name" style={{ color:fg }}>{displayName}</div>
                  <div className="b-text">{s.message}</div>
                  <div className="b-time">{isTemp ? "Sending…" : timeLabel(s.created_at)}</div>
                </div>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>

        {/* ── ERROR ── */}
        {error && <div className="err-bar">⚠️ {error}</div>}

        {/* ── INPUT ── */}
        <div className="foot">
          <input
            className="nm-inp"
            placeholder="👤 Your name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
          />
          <div className="msg-row">
            <textarea
              ref={inputRef}
              className="msg-inp"
              placeholder="Write a suggestion or idea…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={500}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = "auto"
                t.style.height = Math.min(t.scrollHeight, 110) + "px"
              }}
            />
            <button className="send-btn" onClick={send} disabled={sending || !message.trim()}>
              {sending
                ? <Loader2 size={17} color="white" style={{ animation:"spin 0.8s linear infinite" }} />
                : <Send size={16} color="white" style={{ transform:"translateX(1px)" }} />
              }
            </button>
          </div>
          <div className="hint">Enter to send · Shift+Enter for new line · {message.length}/500</div>
        </div>

      </div>
    </>
  )
}