"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Upload, Image as ImageIcon, X, Tag, AlertCircle,
  ShieldCheck, Clock, CheckCircle, Loader2, ArrowLeft,
  Sparkles, ZapOff, Info, Trash2, Smartphone, Wifi
} from "lucide-react"

const CATEGORIES = ["Electronics", "Clothing", "Books", "Food", "Beauty", "Sports", "Home", "Other"]
const MAX_TAGS = 5
const MAX_FILE_SIZE_MB = 10

// ── Tag prediction dictionary ────────────────────────────────────
const TAG_SUGGESTIONS = [
  "apple","samsung","iphone","android","laptop","macbook","charger","headphones","airpods","cable",
  "textbook","novel","notes","study","exam","school","university","course","lecture","assignment",
  "shoes","dress","jeans","shirt","jacket","hoodie","cap","bag","watch","jewelry","accessories",
  "food","snacks","drinks","homemade","baked","dessert","lunch","dinner","meal","healthy",
  "skincare","makeup","perfume","lotion","cream","shampoo","beauty","hair","nail","fragrance",
  "football","jersey","gym","dumbbell","yoga","bike","sports","fitness","running","sneakers",
  "chair","lamp","fan","mirror","bedsheet","pillow","curtain","home","decor","furniture",
  "vintage","rare","limited","bundle","set","brand-new","sealed","original","authentic","gift",
  "urgent","cheap","negotiable","discount","free-delivery","pickup","campus","hostel","delivery",
  "phone","tablet","console","gaming","ps5","xbox","keyboard","mouse","monitor","speaker",
  "camera","tripod","lens","photography","video","drone","microphone","lighting","studio",
]

export default function UploadPage() {
  const router = useRouter()

  // Auth
  const [userId, setUserId]         = useState<string | null>(null)
  const [isPremium, setIsPremium]   = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [uploadQuota, setUploadQuota] = useState<{
    canUpload: boolean; reason?: string; nextAllowed?: string; uploadsToday?: number
  }>({ canUpload: true })

  // Form
  const [title, setTitle]       = useState("")
  const [content, setContent]   = useState("")
  const [price, setPrice]       = useState("")
  const [category, setCategory] = useState("Electronics")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags]         = useState<string[]>([])
  const [condition, setCondition] = useState<"new" | "like-new" | "used" | "fair">("new")

  // Tag predictions
  const [tagPredictions, setTagPredictions] = useState<string[]>([])
  const [showPredictions, setShowPredictions] = useState(false)
  const tagWrapRef = useRef<HTMLDivElement>(null)

  // Image
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageSizeMB, setImageSizeMB] = useState<number | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [dragOver, setDragOver]     = useState(false)

  // Submit & upload animation
  const [submitting, setSubmitting]       = useState(false)
  const [uploadPhase, setUploadPhase]     = useState<"idle"|"uploading"|"saving"|"done">("idle")
  const [uploadPct, setUploadPct]         = useState(0)
  const [submitError, setSubmitError]     = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Auth & quota ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace("/login"); return }
      const uid = session.user.id
      setUserId(uid)
      const { data: profile } = await supabase
        .from("profiles").select("is_premium, username").eq("id", uid).single()
      const premium = profile?.is_premium ?? false
      setIsPremium(premium)
      await checkQuota(uid, premium)
      setAuthLoading(false)
    }
    init()
  }, [])

  const checkQuota = async (uid: string, premium: boolean) => {
    // Premium = unlimited
    if (premium) { setUploadQuota({ canUpload: true, uploadsToday: Infinity }); return }

    // Free = 2 per day
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    const { data: todayPosts } = await supabase
      .from("postings")
      .select("created_at")
      .eq("user_id", uid)
      .gte("created_at", dayStart.toISOString())
      .order("created_at", { ascending: false })

    const count = todayPosts?.length ?? 0

    if (count >= 2) {
      // Next allowed = tomorrow midnight
      const tomorrow = new Date(dayStart)
      tomorrow.setDate(tomorrow.getDate() + 1)
      setUploadQuota({
        canUpload: false,
        reason: "Free accounts can upload 2 times per day.",
        nextAllowed: tomorrow.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
        uploadsToday: count,
      })
    } else {
      setUploadQuota({ canUpload: true, uploadsToday: count })
    }
  }

  // ── Tag predictions ─────────────────────────────────────────
  useEffect(() => {
    const q = tagInput.trim().toLowerCase()
    if (!q || q.length < 1) { setTagPredictions([]); setShowPredictions(false); return }
    const matches = TAG_SUGGESTIONS.filter(s =>
      s.includes(q) && !tags.includes(s)
    ).slice(0, 6)
    setTagPredictions(matches)
    setShowPredictions(matches.length > 0)
  }, [tagInput, tags])

  // Close predictions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagWrapRef.current && !tagWrapRef.current.contains(e.target as Node)) {
        setShowPredictions(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Image ───────────────────────────────────────────────────
  const processImage = useCallback((file: File) => {
    setImageError(null)
    if (!file.type.startsWith("image/")) { setImageError("Please upload an image file."); return }
    const sizeMB = file.size / 1024 / 1024
    if (sizeMB > MAX_FILE_SIZE_MB) { setImageError(`Image is ${sizeMB.toFixed(1)}MB. Max ${MAX_FILE_SIZE_MB}MB.`); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setImageSizeMB(sizeMB)
  }, [])

  const handleFilePick  = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processImage(f) }
  const handleDrop      = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processImage(f) }
  const clearImage      = () => { setImageFile(null); setImagePreview(null); setImageSizeMB(null); setImageError(null); if (fileInputRef.current) fileInputRef.current.value = "" }

  // ── Tags ────────────────────────────────────────────────────
  const addTag = (val?: string) => {
    const t = (val ?? tagInput).trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) setTags(prev => [...prev, t])
    setTagInput("")
    setShowPredictions(false)
  }
  const removeTag   = (tag: string) => setTags(tags.filter(t => t !== tag))
  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag() }
    if (e.key === "Backspace" && !tagInput && tags.length) removeTag(tags[tags.length - 1])
    if (e.key === "Escape") setShowPredictions(false)
    if (e.key === "ArrowDown" && showPredictions && tagPredictions.length) {
      e.preventDefault()
      document.getElementById("pred-0")?.focus()
    }
  }

  // ── Animated upload progress ────────────────────────────────
  const animateUpload = async (imageFile: File | null, userId: string): Promise<string | null> => {
    setUploadPhase("uploading")
    setUploadPct(0)

    // Fake smooth progress to 85% while actual upload runs
    let fakeP = 0
    const fakeInterval = setInterval(() => {
      fakeP = Math.min(fakeP + (Math.random() * 4 + 1), 85)
      setUploadPct(Math.round(fakeP))
    }, 80)

    let imageUrl: string | null = null
    if (imageFile) {
      const ext      = imageFile.name.split(".").pop() || "jpg"
      const fileName = `${userId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from("UniMart")
        .upload(fileName, imageFile, { contentType: imageFile.type, upsert: false })
      if (uploadError) { clearInterval(fakeInterval); throw new Error("Image upload failed: " + uploadError.message) }
      const { data: urlData } = supabase.storage.from("UniMart").getPublicUrl(fileName)
      imageUrl = urlData.publicUrl
    }

    clearInterval(fakeInterval)
    // Rush to 95%
    for (let p = Math.max(fakeP, 85); p <= 95; p += 2) {
      setUploadPct(p); await sleep(30)
    }
    return imageUrl
  }

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError(null)
    if (!title.trim())  return setSubmitError("Title is required.")
    if (!content.trim()) return setSubmitError("Description is required.")
    if (!userId)        return setSubmitError("Not authenticated.")
    if (!uploadQuota.canUpload) return setSubmitError("Upload limit reached.")
    setSubmitting(true)

    try {
      const imageUrl = await animateUpload(imageFile, userId)

      setUploadPhase("saving")
      setUploadPct(97)

      // Expiry: 7 days (free) or 30 days (premium)
      const expiryDays = isPremium ? 30 : 7
      const expiresAt  = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()

      const { error: insertError } = await supabase.from("postings").insert({
        user_id: userId,
        title: title.trim(),
        content: content.trim(),
        price: price ? parseFloat(price) : null,
        category, condition, tags,
        image_url: imageUrl,
        likes_count: 0, comments_count: 0,
        expires_at: expiresAt,
      })
      if (insertError) throw new Error(insertError.message)

      setUploadPct(100)
      await sleep(400)
      setUploadPhase("done")
      await sleep(900)
      setSuccess(true)
      setTimeout(() => router.push("/"), 2200)
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong.")
      setUploadPhase("idle")
      setUploadPct(0)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Condition options ────────────────────────────────────────
  const conditionOptions = [
    { value: "new",      label: "Brand New",   color: "#16a34a" },
    { value: "like-new", label: "Fairly Used", color: "#0ea5e9" },
    { value: "used",     label: "Used",        color: "#f97316" },
  ]

  // ── Loading state ────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 40%,#c2410c 100%)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
        <div style={{ width:44, height:44, border:'3px solid rgba(255,255,255,0.25)', borderTopColor:'#f97316', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Success state ─────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 40%,#c2410c 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ background:'white', borderRadius:28, padding:'48px 40px', maxWidth:420, width:'100%', textAlign:'center', boxShadow:'0 32px 100px rgba(13,29,110,0.35)' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#16a34a,#4ade80)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 8px 24px rgba(22,163,74,0.3)' }}>
            <CheckCircle size={36} color="white" strokeWidth={2} />
          </div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, fontSize:'1.4rem', color:'#0f1f6e', marginBottom:8 }}>Product Listed!</h2>
          <p style={{ fontFamily:"'DM Sans',sans-serif", color:'#64748b', fontSize:'0.88rem', lineHeight:1.6, marginBottom:6 }}>Your product is now live on UniMart.</p>
          <p style={{ fontFamily:"'DM Sans',sans-serif", color:'#94a3b8', fontSize:'0.78rem' }}>
            Expires in {isPremium ? "30 days" : "7 days"} · Redirecting…
          </p>
          <div style={{ height:4, background:'#f1f5f9', borderRadius:2, marginTop:24, overflow:'hidden' }}>
            <div style={{ height:'100%', background:'linear-gradient(90deg,#0f1f6e,#f97316)', animation:'progress 2.2s linear forwards', borderRadius:2 }} />
          </div>
        </div>
        <style>{`@keyframes progress { from { width:0 } to { width:100% } }`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', system-ui, sans-serif; }
        input, select, textarea { font-size: 16px !important; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-border { 0%,100% { border-color:rgba(249,115,22,0.5); } 50% { border-color:rgba(249,115,22,1); } }

        /* ── UPLOAD OVERLAY ── */
        .upload-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(6,13,46,0.96);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        .upload-scene {
          display: flex; flex-direction: column; align-items: center; gap: 0;
          position: relative;
        }

        /* Travel track */
        .travel-track {
          display: flex; align-items: center; gap: 0;
          position: relative;
          margin-bottom: 32px;
        }

        /* Phone icon */
        .travel-phone {
          width: 64px; height: 64px;
          border-radius: 18px;
          background: linear-gradient(135deg, #1e293b, #334155);
          border: 2px solid rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
          position: relative; flex-shrink: 0;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .travel-phone-pulse {
          position: absolute; inset: -6px; border-radius: 22px;
          border: 2px solid rgba(249,115,22,0.4);
          animation: phonePulse 1.5s ease-in-out infinite;
        }
        @keyframes phonePulse {
          0%,100% { transform: scale(1); opacity: 0.5; }
          50%      { transform: scale(1.08); opacity: 1; }
        }

        /* Wire / path */
        .travel-wire {
          width: 200px; height: 2px;
          background: linear-gradient(90deg,
            rgba(249,115,22,0.2), rgba(249,115,22,0.6), rgba(99,102,241,0.6), rgba(15,31,110,0.3)
          );
          position: relative; overflow: visible; flex-shrink: 0;
        }
        .travel-wire-glow {
          position: absolute; inset: -1px 0;
          background: linear-gradient(90deg, transparent, rgba(249,115,22,0.8), transparent);
          animation: wireGlow 1.2s ease-in-out infinite;
        }
        @keyframes wireGlow {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        /* Packets */
        .packet {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 10px; height: 10px; border-radius: 50%;
          background: radial-gradient(circle, #f97316, #ea580c);
          box-shadow: 0 0 10px 3px rgba(249,115,22,0.7);
          animation: packetTravel 1.2s ease-in-out infinite;
        }
        .packet:nth-child(2) { animation-delay: 0.4s; width: 7px; height: 7px; background: radial-gradient(circle, #818cf8, #6366f1); box-shadow: 0 0 8px 3px rgba(129,140,248,0.6); }
        .packet:nth-child(3) { animation-delay: 0.8s; width: 5px; height: 5px; }
        @keyframes packetTravel {
          0%   { left: 0%;   opacity: 0; transform: translateY(-50%) scale(0.5); }
          10%  { opacity: 1; transform: translateY(-50%) scale(1); }
          90%  { opacity: 1; }
          100% { left: 100%; opacity: 0; transform: translateY(-50%) scale(0.5); }
        }

        /* UniMart logo destination */
        .travel-dest {
          width: 72px; height: 72px;
          border-radius: 50%;
          overflow: hidden; flex-shrink: 0;
          border: 2px solid rgba(255,255,255,0.15);
          box-shadow: 0 8px 32px rgba(249,115,22,0.3);
          position: relative;
          animation: destGlow 1.5s ease-in-out infinite;
        }
        @keyframes destGlow {
          0%,100% { box-shadow: 0 8px 32px rgba(249,115,22,0.3); }
          50%      { box-shadow: 0 8px 48px rgba(249,115,22,0.7), 0 0 0 6px rgba(249,115,22,0.15); }
        }
        .travel-dest img { width:100%; height:100%; object-fit:contain; background:#0f1f6e; }

        /* Status text */
        .upload-status {
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem; font-weight: 700; color: white; margin-bottom: 6px; text-align:center;
        }
        .upload-substatus {
          font-family: 'DM Mono', monospace;
          font-size: 0.75rem; color: rgba(255,255,255,0.45); margin-bottom: 24px; text-align:center;
        }

        /* Progress bar */
        .upload-bar-wrap {
          width: 320px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; margin-bottom: 12px;
        }
        .upload-bar-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #0f1f6e, #f97316, #ea580c);
          background-size: 200% 100%;
          animation: barShimmer 1.5s linear infinite;
          box-shadow: 0 0 12px rgba(249,115,22,0.6);
          transition: width 0.15s ease;
        }
        @keyframes barShimmer {
          from { background-position: 100% 0; }
          to   { background-position: -100% 0; }
        }

        .upload-pct {
          font-family: 'DM Mono', monospace;
          font-size: 0.8rem; color: #f97316; text-align:center;
        }

        /* Done checkmark burst */
        .upload-done-ring {
          width: 80px; height: 80px; border-radius: 50%;
          background: linear-gradient(135deg, #16a34a, #4ade80);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 0 0 0 rgba(22,163,74,0.4);
          animation: donePop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes donePop {
          0%   { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        /* ── NAV ── */
        .upload-nav { background:linear-gradient(135deg,#0f1f6e 0%,#162380 60%,#1a2a9a 100%); box-shadow:0 4px 32px rgba(13,29,110,0.35); position:sticky; top:0; z-index:50; }
        .upload-nav-inner { max-width:1000px; margin:0 auto; padding:14px 24px; display:flex; align-items:center; gap:16px; }

        /* ── PAGE ── */
        .upload-page { min-height:100vh; background:#f0f4ff; }
        .upload-hero { background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 50%,#c2410c 100%); padding:36px 24px 72px; position:relative; overflow:hidden; }
        .upload-hero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 80% 50%,rgba(251,146,60,0.18) 0%,transparent 60%); pointer-events:none; }
        .upload-hero-pattern { position:absolute; inset:0; opacity:0.04; background-image:repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 40px); }
        .page-wrap { max-width:1000px; margin:-48px auto 0; padding:0 24px 60px; position:relative; z-index:2; animation:fadeUp 0.45s ease forwards; }

        /* ── QUOTA ── */
        .quota-banner { border-radius:18px; padding:18px 22px; display:flex; align-items:flex-start; gap:14px; margin-bottom:24px; border:1.5px solid; }
        .quota-ok { background:#f0fdf4; border-color:#86efac; }
        .quota-blocked { background:#fff7ed; border-color:#fed7aa; }

        /* ── FORM CARD ── */
        .form-card { background:white; border-radius:28px; box-shadow:0 8px 48px rgba(13,29,110,0.11); overflow:hidden; }
        .form-section { padding:32px 36px; border-bottom:1px solid #f1f5f9; }
        .form-section:last-child { border-bottom:none; }
        .section-label { font-size:0.68rem; font-weight:700; color:#94a3b8; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:18px; display:flex; align-items:center; gap:8px; }
        .section-label::after { content:''; flex:1; height:1px; background:#f1f5f9; }
        .field-label { display:block; font-size:0.75rem; font-weight:700; color:#0f1f6e; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:7px; }
        .field-input { width:100%; padding:13px 16px; border:1.5px solid #e2e8f0; border-radius:14px; font-size:0.9rem; font-family:'DM Sans',system-ui,sans-serif; color:#1e293b; background:#f8fafc; outline:none; transition:all 0.2s; }
        .field-input:focus { border-color:#f97316; background:white; box-shadow:0 0 0 3px rgba(249,115,22,0.1); }
        .field-input::placeholder { color:#cbd5e1; }
        .field-textarea { resize:vertical; min-height:110px; line-height:1.6; }
        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media(max-width:600px) { .two-col { grid-template-columns:1fr; } .form-section { padding:24px 20px; } }
        select.field-input { cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 14px center; background-color:#f8fafc; padding-right:36px; }

        /* Condition pills */
        .condition-pills { display:flex; gap:10px; flex-wrap:wrap; }
        .condition-pill { padding:8px 18px; border-radius:999px; border:1.5px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:0.8rem; font-weight:600; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s ease; }
        .condition-pill.selected { border-width:2px; font-weight:700; }

        /* Drop zone */
        .drop-zone { border:2px dashed #c7d2fe; border-radius:20px; background:#f8fafc; padding:40px 24px; text-align:center; cursor:pointer; transition:all 0.2s ease; }
        .drop-zone:hover, .drop-zone.drag-over { border-color:#f97316; background:#fff7ed; animation:pulse-border 1s ease infinite; }
        .drop-icon { width:64px; height:64px; border-radius:20px; background:linear-gradient(135deg,#eef2ff,#e0e7ff); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; }

        /* Image preview */
        .img-preview-wrap { position:relative; border-radius:18px; overflow:hidden; aspect-ratio:16/9; background:#f1f5f9; }
        .img-preview-wrap img { width:100%; height:100%; object-fit:cover; }
        .img-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; }
        .img-preview-wrap:hover .img-overlay { opacity:1; }
        .img-info-bar { display:flex; align-items:center; justify-content:space-between; margin-top:12px; padding:10px 14px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; }

        /* Tags */
        .tags-outer { position:relative; }
        .tags-input-wrap { display:flex; flex-wrap:wrap; gap:8px; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:14px; background:#f8fafc; cursor:text; min-height:52px; align-items:center; transition:all 0.2s; }
        .tags-input-wrap:focus-within { border-color:#f97316; background:white; box-shadow:0 0 0 3px rgba(249,115,22,0.1); }
        .tag-chip { display:inline-flex; align-items:center; gap:5px; padding:4px 10px 4px 12px; background:linear-gradient(135deg,#0f1f6e,#162380); color:white; border-radius:999px; font-size:0.75rem; font-weight:600; font-family:'DM Sans',sans-serif; white-space:nowrap; }
        .tag-remove { background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.7); display:flex; align-items:center; padding:0; transition:color 0.15s; }
        .tag-remove:hover { color:white; }
        .tags-inline-input { border:none; outline:none; background:transparent; font-family:'DM Sans',sans-serif; font-size:0.88rem; color:#1e293b; min-width:120px; flex:1; }
        .tags-inline-input::placeholder { color:#cbd5e1; }

        /* Prediction dropdown */
        .tag-predictions {
          position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:100;
          background:white; border:1.5px solid #e2e8f0; border-radius:14px;
          box-shadow:0 8px 32px rgba(13,29,110,0.12);
          overflow:hidden; animation:slideDown 0.15s ease;
        }
        .tag-pred-item {
          display:flex; align-items:center; gap:10px;
          padding:10px 16px; cursor:pointer;
          font-family:'DM Sans',sans-serif; font-size:0.85rem; color:#334155;
          transition:background 0.1s;
          border:none; background:none; width:100%; text-align:left;
        }
        .tag-pred-item:hover, .tag-pred-item:focus {
          background:#f8fafc; color:#0f1f6e; outline:none;
        }
        .tag-pred-match { color:#f97316; font-weight:700; }

        /* Info / error boxes */
        .info-box { display:flex; align-items:flex-start; gap:10px; padding:12px 16px; background:#f0f4ff; border-radius:12px; border:1px solid #c7d2fe; margin-top:16px; }
        .error-box { display:flex; align-items:flex-start; gap:10px; padding:14px 16px; background:#fff1f0; border:1.5px solid #fca5a5; border-radius:14px; margin-bottom:16px; }

        /* Submit */
        .submit-btn { width:100%; padding:16px; background:linear-gradient(135deg,#ea580c,#f97316); color:white; border:none; border-radius:16px; font-family:'DM Sans',sans-serif; font-size:1rem; font-weight:700; letter-spacing:0.04em; cursor:pointer; transition:all 0.2s ease; box-shadow:0 6px 24px rgba(234,88,12,0.35); display:flex; align-items:center; justify-content:center; gap:8px; }
        .submit-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 36px rgba(234,88,12,0.4); }
        .submit-btn:disabled { opacity:0.55; cursor:not-allowed; transform:none; }
        .submit-btn-blocked { background:#e2e8f0; color:#94a3b8; box-shadow:none; }
      `}</style>

      {/* ══════════ UPLOAD ANIMATION OVERLAY ══════════ */}
      {submitting && (
        <div className="upload-overlay">
          <div className="upload-scene">

            {uploadPhase === "done" ? (
              <>
                <div className="upload-done-ring">
                  <CheckCircle size={40} color="white" strokeWidth={2.5} />
                </div>
                <div className="upload-status">Upload Complete!</div>
                <div className="upload-substatus">Your listing is going live…</div>
              </>
            ) : (
              <>
                {/* ── Data travel animation ── */}
                <div className="travel-track">
                  {/* Phone */}
                  <div className="travel-phone">
                    <div className="travel-phone-pulse" />
                    <Smartphone size={28} color="rgba(255,255,255,0.85)" />
                  </div>

                  {/* Wire + packets */}
                  <div className="travel-wire">
                    <div className="travel-wire-glow" />
                    <div className="packet" />
                    <div className="packet" />
                    <div className="packet" />
                  </div>

                  {/* UniMart logo as destination */}
                  <div className="travel-dest">
                    <img src="/Unimart.png" alt="UniMart" />
                  </div>
                </div>

                {/* Status */}
                <div className="upload-status">
                  {uploadPhase === "uploading" ? "Sending your listing…" : "Saving to UniMart…"}
                </div>
                <div className="upload-substatus">
                  {uploadPhase === "uploading"
                    ? imageFile ? `Uploading image · ${imageSizeMB?.toFixed(1)}MB` : "Preparing data…"
                    : "Writing to database…"
                  }
                </div>

                {/* Progress bar */}
                <div className="upload-bar-wrap">
                  <div className="upload-bar-fill" style={{ width: `${uploadPct}%` }} />
                </div>
                <div className="upload-pct">{uploadPct}%</div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="upload-page">

        {/* NAV */}
        <header className="upload-nav">
          <div className="upload-nav-inner">
            <a href="/" style={{ display:'flex', alignItems:'center', textDecoration:'none' }}>
              <img src="/Unimart.png" alt="UniMart" style={{ width:58, height:58, objectFit:'contain' }} />
            </a>
            <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:6, color:'rgba(255,255,255,0.75)', fontSize:'0.83rem', fontWeight:600, textDecoration:'none', fontFamily:"'DM Sans',sans-serif", marginLeft:'auto' }}>
              <ArrowLeft size={15} /> Back to Home
            </a>
          </div>
        </header>

        {/* HERO */}
        <div className="upload-hero">
          <div className="upload-hero-pattern" />
          <div style={{ maxWidth:1000, margin:'0 auto', position:'relative', zIndex:1 }}>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>New Listing</p>
            <h1 style={{ fontFamily:"'Playfair Display',serif", color:'white', fontWeight:800, fontSize:'clamp(1.4rem,4vw,2rem)', marginBottom:6 }}>Upload a Product</h1>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.88rem', fontFamily:"'DM Sans',sans-serif" }}>
              {isPremium
                ? <><ShieldCheck size={13} style={{ display:'inline', marginRight:5, verticalAlign:'middle', color:'#86efac' }} />Verified — unlimited uploads · 30-day listing</>
                : <>Free account — 2 uploads/day · 7-day listing · <a href="/verify" style={{ color:'#fb923c', textDecoration:'none', fontWeight:700 }}>Get Verified</a> for unlimited</>
              }
            </p>
          </div>
        </div>

        {/* PAGE WRAP */}
        <div className="page-wrap">

          {/* QUOTA BANNER */}
          {!uploadQuota.canUpload ? (
            <div className="quota-banner quota-blocked">
              <ZapOff size={20} color="#ea580c" style={{ flexShrink:0, marginTop:2 }} />
              <div>
                <p style={{ fontWeight:700, color:'#c2410c', fontSize:'0.9rem', marginBottom:3, fontFamily:"'DM Sans',sans-serif" }}>Upload Limit Reached</p>
                <p style={{ color:'#ea580c', fontSize:'0.82rem', lineHeight:1.5, fontFamily:"'DM Sans',sans-serif" }}>
                  {uploadQuota.reason} Next upload available: <strong>{uploadQuota.nextAllowed}</strong>.
                </p>
                {!isPremium && (
                  <a href="/verify" style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:10, padding:'7px 14px', background:'linear-gradient(135deg,#f97316,#ea580c)', color:'white', borderRadius:8, fontSize:'0.78rem', fontWeight:700, textDecoration:'none', fontFamily:"'DM Sans',sans-serif" }}>
                    <Sparkles size={13} /> Get Verified for unlimited uploads
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="quota-banner quota-ok">
              <CheckCircle size={20} color="#16a34a" style={{ flexShrink:0, marginTop:2 }} />
              <div>
                <p style={{ fontWeight:700, color:'#15803d', fontSize:'0.88rem', marginBottom:2, fontFamily:"'DM Sans',sans-serif" }}>Ready to List</p>
                <p style={{ color:'#16a34a', fontSize:'0.8rem', fontFamily:"'DM Sans',sans-serif" }}>
                  {isPremium
                    ? "Verified — unlimited uploads. Your listing will be live for 30 days."
                    : `Free account — ${2 - (uploadQuota.uploadsToday ?? 0)} upload${(2 - (uploadQuota.uploadsToday ?? 0)) !== 1 ? 's' : ''} remaining today. Listing stays live for 7 days.`
                  }
                </p>
              </div>
            </div>
          )}

          {/* FORM CARD */}
          <div className="form-card">

            {/* SECTION 1: IMAGE */}
            <div className="form-section">
              <div className="section-label"><ImageIcon size={13} /> Product Image</div>
              {!imagePreview ? (
                <div
                  className={`drop-zone${dragOver ? " drag-over" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                >
                  <div className="drop-icon"><ImageIcon size={28} color="#818cf8" /></div>
                  <p style={{ fontFamily:"'Playfair Display',serif", color:'#0f1f6e', fontWeight:700, fontSize:'1rem', marginBottom:6 }}>Drop your image here</p>
                  <p style={{ color:'#94a3b8', fontSize:'0.82rem', marginBottom:16, lineHeight:1.5 }}>or click to browse · PNG, JPG, HEIC, WEBP<br />Max {MAX_FILE_SIZE_MB}MB</p>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background:'linear-gradient(135deg,#0f1f6e,#162380)', color:'white', borderRadius:12, fontSize:'0.82rem', fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
                    <Upload size={14} /> Choose Image
                  </span>
                </div>
              ) : (
                <div>
                  <div className="img-preview-wrap">
                    <img src={imagePreview} alt="Preview" />
                    <div className="img-overlay">
                      <button onClick={clearImage} style={{ background:'rgba(220,38,38,0.9)', border:'none', borderRadius:12, padding:'10px 18px', color:'white', display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:'0.82rem' }}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                  <div className="img-info-bar">
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {imageError
                        ? <AlertCircle size={15} color="#dc2626" />
                        : <CheckCircle size={15} color="#16a34a" />
                      }
                      <span style={{ fontSize:'0.78rem', color:imageError ? '#dc2626' : '#16a34a', fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                        {imageError || `${imageFile?.name} · ${imageSizeMB?.toFixed(2)}MB · Ready`}
                      </span>
                    </div>
                    <button onClick={clearImage} style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:8, padding:'4px 10px', fontSize:'0.72rem', color:'#64748b', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>Change</button>
                  </div>
                </div>
              )}
              {imageError && !imagePreview && (
                <div className="error-box" style={{ marginTop:12, marginBottom:0 }}>
                  <AlertCircle size={16} color="#dc2626" style={{ flexShrink:0, marginTop:2 }} />
                  <p style={{ fontSize:'0.83rem', color:'#dc2626', fontFamily:"'DM Sans',sans-serif" }}>{imageError}</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFilePick} />
            </div>

            {/* SECTION 2: DETAILS */}
            <div className="form-section">
              <div className="section-label"><Tag size={13} /> Listing Details</div>

              <div style={{ marginBottom:16 }}>
                <label className="field-label">Product Title *</label>
                <input className="field-input" placeholder="e.g. iPhone 12 Pro — 128GB, Midnight Black" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
                <p style={{ fontSize:'0.7rem', color:'#cbd5e1', marginTop:4, textAlign:'right', fontFamily:"'DM Sans',sans-serif" }}>{title.length}/100</p>
              </div>

              <div style={{ marginBottom:16 }}>
                <label className="field-label">Description *</label>
                <textarea className="field-input field-textarea" placeholder="Describe your product — condition, specs, reason for selling, meetup preferences…" value={content} onChange={e => setContent(e.target.value)} maxLength={800} />
                <p style={{ fontSize:'0.7rem', color:'#cbd5e1', marginTop:4, textAlign:'right', fontFamily:"'DM Sans',sans-serif" }}>{content.length}/800</p>
              </div>

              <div className="two-col" style={{ marginBottom:16 }}>
                <div>
                  <label className="field-label">Price (GHS)</label>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontWeight:700, fontFamily:"'DM Sans',sans-serif", fontSize:'0.9rem' }}>₵</span>
                    <input className="field-input" style={{ paddingLeft:28 }} type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <p style={{ fontSize:'0.7rem', color:'#94a3b8', marginTop:4, fontFamily:"'DM Sans',sans-serif" }}>Leave empty if negotiable</p>
                </div>
                <div>
                  <label className="field-label">Category</label>
                  <select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Condition</label>
                <div className="condition-pills">
                  {conditionOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={`condition-pill${condition === opt.value ? " selected" : ""}`}
                      style={condition === opt.value ? { borderColor:opt.color, color:opt.color, background:`${opt.color}12` } : {}}
                      onClick={() => setCondition(opt.value as any)}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 3: TAGS */}
            <div className="form-section">
              <div className="section-label">
                <Tag size={13} /> Tags
                <span style={{ fontSize:'0.65rem', fontWeight:500, textTransform:'none', letterSpacing:0, color:'#cbd5e1', marginLeft:4 }}>up to {MAX_TAGS}</span>
              </div>

              <div className="tags-outer" ref={tagWrapRef}>
                <div className="tags-input-wrap" onClick={() => document.getElementById("tag-input")?.focus()}>
                  {tags.map(tag => (
                    <span key={tag} className="tag-chip">
                      #{tag}
                      <button className="tag-remove" onClick={() => removeTag(tag)} type="button"><X size={12} /></button>
                    </span>
                  ))}
                  {tags.length < MAX_TAGS && (
                    <input
                      id="tag-input"
                      className="tags-inline-input"
                      placeholder={tags.length === 0 ? "Type a tag…" : "Add another…"}
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleTagKey}
                      onFocus={() => tagInput && setShowPredictions(tagPredictions.length > 0)}
                      autoComplete="off"
                    />
                  )}
                </div>

                {/* Prediction dropdown */}
                {showPredictions && (
                  <div className="tag-predictions">
                    {tagPredictions.map((pred, i) => {
                      const q = tagInput.toLowerCase()
                      const idx = pred.indexOf(q)
                      return (
                        <button
                          key={pred}
                          id={`pred-${i}`}
                          className="tag-pred-item"
                          onMouseDown={e => { e.preventDefault(); addTag(pred) }}
                          onKeyDown={e => {
                            if (e.key === "Enter") { e.preventDefault(); addTag(pred) }
                            if (e.key === "ArrowDown") { e.preventDefault(); document.getElementById(`pred-${i+1}`)?.focus() }
                            if (e.key === "ArrowUp")   { e.preventDefault(); i === 0 ? document.getElementById("tag-input")?.focus() : document.getElementById(`pred-${i-1}`)?.focus() }
                            if (e.key === "Escape")    setShowPredictions(false)
                          }}
                        >
                          <Tag size={12} color="#94a3b8" />
                          {idx >= 0 ? (
                            <>
                              {pred.slice(0, idx)}
                              <span className="tag-pred-match">{pred.slice(idx, idx + q.length)}</span>
                              {pred.slice(idx + q.length)}
                            </>
                          ) : pred}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="info-box">
                <Info size={14} color="#818cf8" style={{ flexShrink:0, marginTop:2 }} />
                <p style={{ fontSize:'0.78rem', color:'#64748b', lineHeight:1.6, fontFamily:"'DM Sans',sans-serif" }}>
                  Tags help buyers find your product. Use keywords like <strong>apple</strong>, <strong>textbook</strong>, <strong>vintage</strong>. Lowercase only.
                </p>
              </div>
            </div>

            {/* SECTION 4: EXPIRY */}
            <div className="form-section">
              <div className="section-label"><Clock size={13} /> Listing Duration</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={{ padding:'18px 20px', borderRadius:16, border:`2px solid ${!isPremium ? '#f97316' : '#e2e8f0'}`, background:!isPremium ? '#fff7ed' : '#f8fafc' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <Clock size={16} color={!isPremium ? '#f97316' : '#94a3b8'} />
                    <span style={{ fontWeight:700, fontSize:'0.85rem', color:!isPremium ? '#c2410c' : '#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>Free Account</span>
                    {!isPremium && <span style={{ fontSize:'0.7rem', background:'#f97316', color:'white', padding:'2px 8px', borderRadius:999, fontWeight:700 }}>You</span>}
                  </div>
                  <p style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, fontSize:'1.5rem', color:'#0f1f6e', marginBottom:2 }}>7 Days</p>
                  <p style={{ fontSize:'0.75rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>2 uploads per day</p>
                </div>
                <div style={{ padding:'18px 20px', borderRadius:16, border:`2px solid ${isPremium ? '#0f1f6e' : '#e2e8f0'}`, background:isPremium ? '#f0f4ff' : '#f8fafc' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <ShieldCheck size={16} color={isPremium ? '#0f1f6e' : '#94a3b8'} />
                    <span style={{ fontWeight:700, fontSize:'0.85rem', color:isPremium ? '#0f1f6e' : '#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>Verified</span>
                    {isPremium && <span style={{ fontSize:'0.7rem', background:'#0f1f6e', color:'white', padding:'2px 8px', borderRadius:999, fontWeight:700 }}>You</span>}
                  </div>
                  <p style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, fontSize:'1.5rem', color:'#0f1f6e', marginBottom:2 }}>30 Days</p>
                  <p style={{ fontSize:'0.75rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>Unlimited uploads</p>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14, padding:'10px 14px', background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0' }}>
                <AlertCircle size={14} color="#94a3b8" />
                <p style={{ fontSize:'0.75rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>
                  When a listing expires it's permanently removed from UniMart. Renew before expiry to keep it active.
                </p>
              </div>
            </div>

            {/* SUBMIT */}
            <div style={{ padding:'28px 36px' }}>
              {submitError && (
                <div className="error-box">
                  <AlertCircle size={16} color="#dc2626" style={{ flexShrink:0, marginTop:2 }} />
                  <p style={{ fontSize:'0.83rem', color:'#dc2626', fontFamily:"'DM Sans',sans-serif" }}>{submitError}</p>
                </div>
              )}

              <button
                className={`submit-btn${!uploadQuota.canUpload ? " submit-btn-blocked" : ""}`}
                onClick={handleSubmit}
                disabled={submitting || !uploadQuota.canUpload || !!imageError}
              >
                {submitting
                  ? <><Loader2 size={18} style={{ animation:'spin 0.8s linear infinite' }} /> Publishing…</>
                  : !uploadQuota.canUpload
                    ? <><ZapOff size={18} /> Upload Limit Reached</>
                    : <><Upload size={18} /> Publish Listing</>
                }
              </button>

              {!isPremium && uploadQuota.canUpload && (
                <p style={{ textAlign:'center', marginTop:14, fontSize:'0.75rem', color:'#94a3b8', fontFamily:"'DM Sans',sans-serif" }}>
                  <Sparkles size={12} style={{ display:'inline', verticalAlign:'middle', marginRight:4, color:'#f97316' }} />
                  <a href="/verify" style={{ color:'#f97316', fontWeight:700, textDecoration:'none' }}>Get Verified</a> for unlimited uploads and 30-day listings.
                </p>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}