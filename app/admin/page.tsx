"use client"
import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react"

// ── Inner component uses useSearchParams (must be inside Suspense) ──
function AdminLoginInner() {
  const router  = useRouter()
  const params  = useSearchParams()
  const [staffId, setStaffId]   = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const expired = params.get("reason") === "session_expired"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setLoading(true)
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: staffId.trim().toUpperCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Login failed"); return }
      sessionStorage.setItem("admin_info", JSON.stringify({ name: data.name, role: data.role, staffId: data.staffId }))
      router.push("/admin/dashboard")
    } catch { setError("Network error. Try again.") }
    finally { setLoading(false) }
  }

  return (
    <div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:400,animation:"fadeUp .4s ease"}}>

        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",boxShadow:"0 8px 32px rgba(249,115,22,0.4)"}}>
            <ShieldCheck size={32} color="white"/>
          </div>
          <h1 style={{fontFamily:"'Playfair Display',serif",color:"white",fontSize:"1.8rem",fontWeight:800,lineHeight:1.2}}>UniMart Admin</h1>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:"0.82rem",marginTop:6}}>Secure Dashboard Access</p>
        </div>

        {expired && (
          <div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"10px 16px",marginBottom:16,color:"#fca5a5",fontSize:"0.82rem",textAlign:"center"}}>
            Your session expired. Please log in again.
          </div>
        )}

        <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"28px 24px",boxShadow:"0 24px 80px rgba(0,0,0,0.4)"}}>
          <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:18}}>
            <div>
              <label style={{display:"block",fontSize:"0.7rem",fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Staff ID</label>
              <input value={staffId} onChange={e=>setStaffId(e.target.value.toUpperCase())} placeholder="STAFF-XXXXXX" required style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.07)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:12,color:"white",fontSize:"1rem",outline:"none",fontFamily:"monospace",letterSpacing:"0.08em",fontWeight:700}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:"0.7rem",fontWeight:700,color:"rgba(255,255,255,0.5)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Password</label>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={{width:"100%",padding:"12px 44px 12px 14px",background:"rgba(255,255,255,0.07)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:12,color:"white",fontSize:"1rem",outline:"none"}}/>
                <button type="button" onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.4)",display:"flex"}}>
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            {error && <div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"9px 14px",color:"#fca5a5",fontSize:"0.82rem"}}>{error}</div>}
            <button type="submit" disabled={loading} style={{padding:"14px",background:loading?"rgba(249,115,22,0.5)":"linear-gradient(135deg,#ea580c,#f97316)",color:"white",border:"none",borderRadius:12,fontWeight:800,fontSize:"0.95rem",cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4,boxShadow:"0 4px 16px rgba(249,115,22,0.35)",transition:"all .2s"}}>
              {loading ? <><Loader2 size={18} style={{animation:"spin .8s linear infinite"}}/> Verifying…</> : "Sign In"}
            </button>
          </form>
        </div>

        <p style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:"0.72rem",marginTop:20}}>UniMart Admin Portal · Lytrix Consult</p>
      </div>
    </div>
  )
}

// ── Default export wraps inner component in Suspense ──
export default function AdminLoginPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:linear-gradient(135deg,#0a1040 0%,#0f1f6e 50%,#1a1a2e 100%);min-height:100dvh;font-family:'DM Sans',sans-serif}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <Suspense fallback={
        <div style={{minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Loader2 size={32} color="white" style={{animation:"spin .8s linear infinite"}}/>
        </div>
      }>
        <AdminLoginInner />
      </Suspense>
    </>
  )
}