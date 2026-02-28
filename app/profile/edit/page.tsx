"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Camera, Save, ArrowLeft, User, Phone, School, Loader2, CheckCircle, XCircle } from "lucide-react"

export default function EditProfilePage() {
  const router = useRouter()

  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [success,      setSuccess]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [uploading,    setUploading]    = useState(false)
  const [avatarSaved,  setAvatarSaved]  = useState(false)

  const [fullName,      setFullName]      = useState("")
  const [username,      setUsername]      = useState("")
  const [bio,           setBio]           = useState("")
  const [phone,         setPhone]         = useState("")
  const [school,        setSchool]        = useState("")
  const [avatar,        setAvatar]        = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Keep a ref to username so handleAvatarChange can always read latest value
  const usernameRef = useRef("")
  useEffect(() => { usernameRef.current = username }, [username])

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load current profile ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }

      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", user.id).single()

      if (profile) {
        setFullName(profile.full_name  || "")
        setUsername(profile.username   || "")
        usernameRef.current = profile.username || ""
        setBio(profile.bio             || "")
        setPhone(String(profile.whatsapp_number || profile.phone_number || ""))
        setSchool(profile.school       || "")
        setAvatar(profile.avatar_url   || null)
        setAvatarPreview(profile.avatar_url || null)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Avatar upload ─────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // show local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setAvatarPreview(objectUrl)
    setAvatarSaved(false)

    setUploading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const ext  = file.name.split(".").pop()
      const path = `${user.id}.${ext}`

      // 1️⃣ Upload file to storage
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}` // bust cache

      // 2️⃣ Update profiles table directly (no trigger needed)
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id)
      if (profileErr) throw profileErr

      // 3️⃣ Update postings table directly using username
      //    Tables are independent — we update postings separately
      const currentUsername = usernameRef.current
      if (currentUsername) {
        const { error: postingsErr } = await supabase
          .from("postings")
          .update({ avatar_url: publicUrl })
          .eq("username", currentUsername)
        // Non-fatal: postings may not have avatar_url column yet — log but don't throw
        if (postingsErr) console.warn("Postings avatar sync skipped:", postingsErr.message)
      }

      setAvatar(publicUrl)
      setAvatarPreview(publicUrl)
      setAvatarSaved(true)
    } catch (err: any) {
      setError("Avatar upload failed: " + err.message)
      setAvatarPreview(avatar) // revert preview on failure
    } finally {
      setUploading(false)
    }
  }

  // ── Save profile ──────────────────────────────────────────────
  const handleSave = async () => {
    setError(null); setSuccess(false)
    if (!fullName.trim()) { setError("Full name is required."); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Check username uniqueness (exclude self)
      if (username.trim()) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username.trim().toLowerCase())
          .neq("id", user.id)
          .maybeSingle()
        if (existing) throw new Error("That username is already taken.")
      }

      const updates: Record<string, any> = {
        full_name:  fullName.trim(),
        username:   username.trim().toLowerCase() || null,
        bio:        bio.trim() || null,
        school:     school.trim() || null,
        avatar_url: avatar || null,
      }

      // whatsapp_number is NUMERIC — only save digits
      const digits = phone.replace(/\D/g, "")
      if (digits) updates.whatsapp_number = Number(digits)

      const { error: updateErr } = await supabase
        .from("profiles").update(updates).eq("id", user.id)
      if (updateErr) throw updateErr

      setSuccess(true)
      setTimeout(() => router.push("/profile"), 1200)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const initials = fullName ? fullName.slice(0, 2).toUpperCase() : "?"

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f1f6e,#1a2a9a,#c2410c)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:40, height:40, border:"3px solid rgba(255,255,255,0.3)", borderTopColor:"#f97316", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4ff", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        input, textarea { font-size:16px !important; }

        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }

        .enav { background:linear-gradient(135deg,#0f1f6e,#162380,#1a2a9a); box-shadow:0 4px 32px rgba(13,29,110,.35); }
        .enav-inner { max-width:700px; margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; }

        .ehero { background:linear-gradient(135deg,#0f1f6e 0%,#1a2a9a 50%,#c2410c 100%); padding:36px 24px 72px; position:relative; overflow:hidden; }
        .ehero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 80% 20%,rgba(251,146,60,.2) 0%,transparent 55%); pointer-events:none; }
        .ehero-pattern { position:absolute; inset:0; opacity:.04; background-image:repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 40px); }

        .ewrap { max-width:700px; margin:0 auto; padding:0 24px 64px; }
        .ecard {
          background:white; border-radius:28px;
          box-shadow:0 8px 48px rgba(13,29,110,.13);
          overflow:hidden; margin-top:-52px; position:relative; z-index:2;
          animation:fadeUp .4s ease forwards;
        }

        /* Avatar editor */
        .avatar-editor { padding:36px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:28px; flex-wrap:wrap; }
        .av-ring {
          width:100px; height:100px; border-radius:50%;
          border:4px solid white; box-shadow:0 6px 28px rgba(13,29,110,.2);
          background:linear-gradient(135deg,#0f1f6e,#f97316);
          display:flex; align-items:center; justify-content:center;
          font-family:'Playfair Display',serif; font-size:1.8rem; font-weight:800; color:white;
          overflow:hidden; position:relative; flex-shrink:0; cursor:pointer;
          transition:filter .2s;
        }
        .av-ring:hover { filter:brightness(.88); }
        .av-ring img { width:100%; height:100%; object-fit:cover; }
        .av-overlay {
          position:absolute; inset:0; background:rgba(13,29,110,.55);
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px;
          opacity:0; transition:opacity .2s; border-radius:50%;
        }
        .av-ring:hover .av-overlay { opacity:1; }
        .av-overlay-text { font-size:.6rem; color:white; font-weight:700; letter-spacing:.06em; text-transform:uppercase; font-family:'DM Sans',sans-serif; }
        .av-meta h3 { font-family:'Playfair Display',serif; font-size:1.1rem; font-weight:800; color:#0f1f6e; margin-bottom:4px; }
        .av-meta p  { font-size:.78rem; color:#94a3b8; line-height:1.55; max-width:320px; }
        .av-btn {
          display:inline-flex; align-items:center; gap:7px; margin-top:12px;
          padding:9px 18px; background:linear-gradient(135deg,#0f1f6e,#162380);
          color:white; border:none; border-radius:12px;
          font-family:'DM Sans',sans-serif; font-size:.8rem; font-weight:700;
          cursor:pointer; transition:all .2s; box-shadow:0 4px 14px rgba(13,29,110,.22);
        }
        .av-btn:hover { transform:translateY(-1px); box-shadow:0 8px 22px rgba(13,29,110,.3); }
        .av-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }
        .av-saved { display:inline-flex; align-items:center; gap:5px; margin-top:10px; font-size:.76rem; font-weight:600; color:#16a34a; font-family:'DM Sans',sans-serif; animation:slideIn .25s ease; }

        /* Form */
        .eform { padding:32px 36px 36px; display:flex; flex-direction:column; }
        .section-divider { font-size:.65rem; font-weight:700; color:#94a3b8; letter-spacing:.12em; text-transform:uppercase; margin:24px 0 16px; display:flex; align-items:center; gap:8px; font-family:'DM Sans',sans-serif; }
        .section-divider:first-child { margin-top:0; }
        .section-divider::after { content:''; flex:1; height:1px; background:#f1f5f9; }
        .field { margin-bottom:16px; }
        .field-label { display:block; font-size:.72rem; font-weight:700; color:#0f1f6e; letter-spacing:.07em; text-transform:uppercase; margin-bottom:6px; font-family:'DM Sans',sans-serif; }
        .field-hint  { font-size:.69rem; color:#94a3b8; margin-top:4px; font-family:'DM Sans',sans-serif; }
        .input {
          width:100%; padding:13px 16px; border:1.5px solid #e2e8f0; border-radius:12px;
          font-family:'DM Sans',sans-serif; color:#1e293b; background:#f8fafc;
          outline:none; transition:border-color .2s,box-shadow .2s,background .2s;
        }
        .input:focus { border-color:#f97316; background:white; box-shadow:0 0 0 3px rgba(249,115,22,.1); }
        .input::placeholder { color:#94a3b8; }
        .input-icon-wrap { position:relative; }
        .input-icon-wrap .input { padding-left:44px; }

        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }

        .error-box   { background:#fff1f0; border:1px solid #fca5a5; border-radius:10px; padding:11px 14px; font-size:.82rem; color:#dc2626; display:flex; align-items:flex-start; gap:8px; line-height:1.5; animation:slideIn .2s ease; margin-bottom:20px; }
        .success-box { background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:11px 14px; font-size:.82rem; color:#16a34a; display:flex; align-items:center; gap:8px; animation:slideIn .2s ease; margin-bottom:20px; }

        .save-btn {
          width:100%; padding:15px; background:linear-gradient(135deg,#ea580c,#f97316);
          color:white; border:none; border-radius:14px;
          font-family:'DM Sans',sans-serif; font-size:.95rem; font-weight:700;
          cursor:pointer; transition:all .2s; box-shadow:0 4px 16px rgba(234,88,12,.28);
          display:flex; align-items:center; justify-content:center; gap:8px; margin-top:8px;
        }
        .save-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 28px rgba(234,88,12,.38); }
        .save-btn:disabled { opacity:.65; cursor:not-allowed; transform:none; }

        @media (max-width:520px) {
          .avatar-editor { padding:24px; gap:20px; flex-direction:column; align-items:flex-start; }
          .eform { padding:24px 20px 28px; }
          .two-col { grid-template-columns:1fr; }
        }
      `}</style>

      {/* NAV */}
      <header className="enav">
        <div className="enav-inner">
          <a href="/" style={{ textDecoration:'none' }}>
            <img src="/Unimart.png" alt="UniMart" style={{ width:52, height:52, objectFit:'contain' }} />
          </a>
          <a href="/profile" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', border:'1.5px solid rgba(255,255,255,.25)', borderRadius:10, color:'rgba(255,255,255,.85)', fontFamily:"'DM Sans',sans-serif", fontSize:'.82rem', fontWeight:600, textDecoration:'none' }}>
            <ArrowLeft size={14}/> Back to Profile
          </a>
        </div>
      </header>

      {/* HERO */}
      <div className="ehero">
        <div className="ehero-pattern"/>
        <div style={{ maxWidth:700, margin:'0 auto', position:'relative', zIndex:1 }}>
          <p style={{ color:'rgba(255,255,255,.5)', fontSize:'.72rem', fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>Account Settings</p>
          <h1 style={{ fontFamily:"'Playfair Display',serif", color:'white', fontSize:'clamp(1.4rem,4vw,2rem)', fontWeight:800 }}>Edit Your Profile</h1>
        </div>
      </div>

      {/* FORM WRAP */}
      <div className="ewrap">
        <div className="ecard">

          {/* Avatar editor */}
          <div className="avatar-editor">
            <div className="av-ring" onClick={() => fileRef.current?.click()}>
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar"/>
                : initials}
              <div className="av-overlay">
                {uploading
                  ? <div style={{ width:20, height:20, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
                  : <>
                      <Camera size={20} color="white"/>
                      <span className="av-overlay-text">Change</span>
                    </>
                }
              </div>
            </div>

            <div className="av-meta">
              <h3>Profile Photo</h3>
              <p>Click your avatar or the button below to upload. JPG, PNG or WEBP — max 5 MB.</p>
              <button className="av-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading
                  ? <><Loader2 size={14} style={{ animation:'spin .7s linear infinite' }}/> Uploading…</>
                  : <><Camera size={14}/> {avatarPreview ? "Change Photo" : "Upload Photo"}</>
                }
              </button>
              {avatarSaved && !uploading && (
                <div className="av-saved">
                  <CheckCircle size={13}/> Photo saved — listings updated too
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display:'none' }}
              onChange={handleAvatarChange}
            />
          </div>

          {/* Form */}
          <div className="eform">

            {error && (
              <div className="error-box">
                <XCircle size={16} style={{ flexShrink:0, marginTop:1 }}/>
                {error}
              </div>
            )}
            {success && (
              <div className="success-box">
                <CheckCircle size={16}/>
                Profile saved! Redirecting…
              </div>
            )}

            {/* Personal */}
            <div className="section-divider"><User size={11}/> Personal Info</div>

            <div className="two-col">
              <div className="field">
                <label className="field-label">Full Name *</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Akosua Mensah"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">Username</label>
                <div className="input-icon-wrap">
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:'.9rem', fontWeight:700, color:'#94a3b8', pointerEvents:'none', fontFamily:"'DM Sans',sans-serif" }}>@</span>
                  <input
                    className="input"
                    type="text"
                    placeholder="akosua_adu"
                    value={username}
                    onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  />
                </div>
                <div className="field-hint">Letters, numbers, underscores only</div>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Bio</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Tell buyers a little about yourself…"
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={160}
                style={{ resize:'vertical' }}
              />
              <div className="field-hint">{bio.length} / 160 characters</div>
            </div>

            {/* Contact */}
            <div className="section-divider"><Phone size={11}/> Contact & Location</div>

            <div className="two-col">
              <div className="field">
                <label className="field-label">WhatsApp Number</label>
                <div className="input-icon-wrap">
                  <Phone size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
                  <input
                    className="input"
                    type="tel"
                    placeholder="233594518462"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div className="field-hint">Digits only, include country code</div>
              </div>
              <div className="field">
                <label className="field-label">School / University 😏 (you Can't Edit Your School bruv)</label>
               
              </div>
            </div>

            {/* Save */}
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={saving || uploading || success}
            >
              {saving
                ? <><Loader2 size={16} style={{ animation:'spin .7s linear infinite' }}/> Saving…</>
                : success
                ? <><CheckCircle size={16}/> Saved!</>
                : <><Save size={16}/> Save Changes</>
              }
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}