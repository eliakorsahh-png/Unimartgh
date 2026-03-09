"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard, Users, Package, ShieldCheck, School,
  Image as ImageIcon, Flag, UserCog, Megaphone, ScrollText,
  LogOut, X, ChevronLeft, ChevronRight, Search, Plus,
  Eye, Ban, BadgeCheck, Trash2, RefreshCw, Check, AlertTriangle,
  MousePointerClick, CheckCircle, Loader2, Menu, Edit2,
  Upload, Bell, Send, BarChart2, Activity
} from "lucide-react"

type Admin   = { staffId: string; name: string; role: string }
type Section = "overview"|"users"|"listings"|"verifications"|"groups"|"banners"|"reports"|"staff"|"announcements"|"logs"

const ROLE_COLORS: Record<string,string> = { superadmin:"#7c3aed", admin:"#0f1f6e", moderator:"#0891b2" }
const ROLE_LABELS: Record<string,string> = { superadmin:"Super Admin", admin:"Admin", moderator:"Moderator" }

function timeAgo(iso: string) {
  if (!iso) return "—"
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return "Just now"; if (m < 60) return `${m}m ago`
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h/24); if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
function fmtDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en",{day:"numeric",month:"short",year:"numeric"})
}
function fmt(n: number|undefined) {
  if (n === undefined || n === null) return "…"
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n/1000).toFixed(1)}K`
  return n.toLocaleString()
}

// ── Tiny components ──────────────────────────────────────────
function Badge({ label, color="#0f1f6e" }: { label:string; color?:string }) {
  return <span style={{ background:`${color}18`, color, border:`1px solid ${color}30`, borderRadius:999, padding:"2px 9px", fontSize:"0.65rem", fontWeight:800, whiteSpace:"nowrap" }}>{label}</span>
}
function Spinner({ size=28 }: { size?:number }) {
  return <div style={{ width:size, height:size, borderRadius:"50%", border:"3px solid #eef2ff", borderTopColor:"#0f1f6e", animation:"spin .8s linear infinite", margin:"auto" }}/>
}
function Avatar({ url, name, size=36 }: { url?:string|null; name?:string|null; size?:number }) {
  const ini = (name??"?")[0].toUpperCase()
  if (url) return <img src={url} alt="" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:"2px solid #e2e8f0" }}/>
  return <div style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,#0f1f6e,#f97316)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:size*0.38, fontWeight:700, flexShrink:0 }}>{ini}</div>
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, sub, color="#0f1f6e", icon, onClick }: any) {
  return (
    <div onClick={onClick} style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", padding:"18px 20px", boxShadow:"0 2px 12px rgba(13,29,110,0.06)", display:"flex", alignItems:"center", gap:14, cursor:onClick?"pointer":"default", transition:"transform .15s, box-shadow .15s" }}>
      <div style={{ width:46, height:46, borderRadius:13, background:`${color}12`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:"0.68rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:"1.55rem", fontWeight:800, color, fontFamily:"'Playfair Display',serif", lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:"0.68rem", color:"#94a3b8", marginTop:3 }}>{sub}</div>}
      </div>
    </div>
  )
}

function SectionHeader({ title, sub, action }: { title:string; sub?:string; action?:React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, gap:12, flexWrap:"wrap" }}>
      <div>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.25rem", fontWeight:800, color:"#0f1f6e", lineHeight:1.2 }}>{title}</h2>
        {sub && <p style={{ fontSize:"0.78rem", color:"#94a3b8", marginTop:3 }}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────
function Empty({ icon, title, sub, action }: any) {
  return (
    <div style={{ textAlign:"center", padding:"52px 24px", background:"white", borderRadius:16, border:"1.5px dashed #e2e8f0" }}>
      <div style={{ marginBottom:12, opacity:.4 }}>{icon}</div>
      <p style={{ fontFamily:"'Playfair Display',serif", color:"#0f1f6e", fontWeight:700, marginBottom:6 }}>{title}</p>
      {sub && <p style={{ color:"#94a3b8", fontSize:"0.8rem", marginBottom:16 }}>{sub}</p>}
      {action}
    </div>
  )
}

// ── Responsive table card (mobile) ────────────────────────────
function MobileCard({ children }: { children: React.ReactNode }) {
  return <div style={{ background:"white", borderRadius:12, border:"1px solid #eef2ff", padding:"14px 16px", marginBottom:10 }}>{children}</div>
}

// ── Image uploader ────────────────────────────────────────────
function ImageUploader({ value, onChange }: { value:string; onChange:(url:string)=>void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState("")

  const upload = async (file: File) => {
    setUploading(true); setErr("")
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch("/api/admin/upload", { method:"POST", body:fd })
      const data = await res.json()
      if (data.url) onChange(data.url)
      else setErr(data.error ?? "Upload failed")
    } catch { setErr("Upload failed") }
    finally { setUploading(false) }
  }

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder="Paste image URL or upload below…" style={{ flex:1, padding:"9px 12px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.85rem", outline:"none" }}/>
        <button type="button" onClick={()=>ref.current?.click()} disabled={uploading} style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 14px", borderRadius:10, background:"#eef2ff", border:"1.5px solid #c7d2fe", color:"#0f1f6e", fontWeight:700, fontSize:"0.78rem", cursor:"pointer", whiteSpace:"nowrap" }}>
          {uploading ? <Spinner size={14}/> : <><Upload size={13}/> Upload</>}
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) upload(f); e.target.value="" }}/>
      {err && <p style={{ color:"#dc2626", fontSize:"0.74rem", marginTop:4 }}>{err}</p>}
      {value && (
        <div style={{ position:"relative", marginTop:8, borderRadius:10, overflow:"hidden", aspectRatio:"16/6", background:"#f1f5f9" }}>
          <img src={value} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{(e.target as any).style.display="none"}}/>
          <button onClick={()=>onChange("")} style={{ position:"absolute", top:6, right:6, width:24, height:24, borderRadius:"50%", background:"rgba(0,0,0,0.6)", border:"none", color:"white", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <X size={12}/>
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function AdminDashboard({ initialAdmin }: { initialAdmin: Admin }) {
  const router = useRouter()
  const [admin]                     = useState<Admin>(initialAdmin)
  const [section, setSection]       = useState<Section>("overview")
  const [sidebarOpen, setSidebar]   = useState(true)
  const [isMobile, setIsMobile]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [toast, setToast]           = useState<{msg:string;type:"ok"|"err"}|null>(null)

  // Section data
  const [overview, setOverview]     = useState<any>(null)
  const [chart, setChart]           = useState<any[]>([])
  const [users, setUsers]           = useState<any[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage]   = useState(0)
  const [usersSearch, setUsersSearch] = useState("")
  const [usersFilter, setUsersFilter] = useState("all")
  const [listings, setListings]     = useState<any[]>([])
  const [listTotal, setListTotal]   = useState(0)
  const [listPage, setListPage]     = useState(0)
  const [listSearch, setListSearch] = useState("")
  const [listFilter, setListFilter] = useState("all")
  const [verifications, setVerifs]  = useState<any[]>([])
  const [groups, setGroups]         = useState<any[]>([])
  const [banners, setBanners]       = useState<any[]>([])
  const [reports, setReports]       = useState<any[]>([])
  const [repTotal, setRepTotal]     = useState(0)
  const [repPage, setRepPage]       = useState(0)
  const [repFilter, setRepFilter]   = useState("pending")
  const [staff, setStaff]           = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [logs, setLogs]             = useState<any[]>([])
  const [logsTotal, setLogsTotal]   = useState(0)
  const [logsPage, setLogsPage]     = useState(0)

  // Modal
  const [modal, setModal]           = useState<string|null>(null)
  const [modalData, setModalData]   = useState<any>(null)
  const [formData, setFormData]     = useState<any>({})
  const [actionLoading, setActLoad] = useState(false)
  const [groupMembers, setGroupMembers] = useState<any[]>([])

  // ── Mobile detection ─────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const m = window.innerWidth < 768
      setIsMobile(m)
      if (m) setSidebar(false)
      else setSidebar(true)
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ── Announce search debounce ──────────────────────────────────
  const searchTimer = useRef<any>(null)
  const debouncedSearch = (fn: ()=>void) => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(fn, 350)
  }

  const showToast = (msg: string, type: "ok"|"err" = "ok") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const api = useCallback(async (action: string, params: any = {}) => {
    const res = await fetch("/api/admin/action", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action, params }),
    })
    if (res.status === 401) { router.push("/admin?reason=session_expired"); throw new Error("Unauthorized") }
    return res.json()
  }, [router])

  useEffect(() => { load(section) }, [section, usersPage, usersFilter, listPage, listFilter, repPage, repFilter, logsPage])
  useEffect(() => { debouncedSearch(() => load("users")) }, [usersSearch])
  useEffect(() => { debouncedSearch(() => load("listings")) }, [listSearch])

  const load = async (s: Section) => {
    setLoading(true)
    try {
      switch (s) {
        case "overview": {
          const [ov, ch] = await Promise.all([api("getOverview"), api("getChartData")])
          setOverview(ov); setChart(ch.chart ?? [])
          break
        }
        case "users": {
          const r = await api("getUsers",{ search:usersSearch, filter:usersFilter, page:usersPage })
          setUsers(r.users??[]); setUsersTotal(r.total??0); break
        }
        case "listings": {
          const r = await api("getListings",{ search:listSearch, filter:listFilter, page:listPage })
          setListings(r.listings??[]); setListTotal(r.total??0); break
        }
        case "verifications": { const r=await api("getVerifications"); setVerifs(r.requests??[]); break }
        case "groups":        { const r=await api("getGroups");        setGroups(r.groups??[]); break }
        case "banners":       { const r=await api("getBanners");       setBanners(r.banners??[]); break }
        case "reports": {
          const r=await api("getReports",{ filter:repFilter, page:repPage })
          setReports(r.reports??[]); setRepTotal(r.total??0); break
        }
        case "staff":         { const r=await api("getStaff");         setStaff(r.staff??[]); break }
        case "announcements": { const r=await api("getAnnouncements"); setAnnouncements(r.announcements??[]); break }
        case "logs": {
          const r=await api("getLogs",{ page:logsPage })
          setLogs(r.logs??[]); setLogsTotal(r.total??0); break
        }
      }
    } catch (e:any) {
      if (e.message !== "Unauthorized") showToast("Failed to load data", "err")
    } finally { setLoading(false) }
  }

  const act = async (action: string, params: any, successMsg: string) => {
    setActLoad(true)
    try {
      const r = await api(action, params)
      if (r.error) { showToast(r.error, "err"); return false }
      if (successMsg) showToast(successMsg)
      await load(section)
      return r
    } catch { showToast("Action failed","err"); return false }
    finally { setActLoad(false) }
  }

  const logout = async () => {
    await fetch("/api/admin/auth",{ method:"DELETE" })
    sessionStorage.removeItem("admin_info")
    router.push("/admin")
  }

  const navItems = [
    { id:"overview"      as Section, label:"Overview",       icon:<LayoutDashboard size={18}/> },
    { id:"users"         as Section, label:"Users",          icon:<Users size={18}/> },
    { id:"listings"      as Section, label:"Listings",       icon:<Package size={18}/> },
    { id:"verifications" as Section, label:"Verifications",  icon:<ShieldCheck size={18}/>, badge:verifications.length },
    { id:"groups"        as Section, label:"School Groups",  icon:<School size={18}/> },
    { id:"banners"       as Section, label:"Rental Banners", icon:<ImageIcon size={18}/> },
    { id:"reports"       as Section, label:"Reports",        icon:<Flag size={18}/>, badge:reports.filter(r=>r.status==="pending").length },
    { id:"staff"         as Section, label:"Staff",          icon:<UserCog size={18}/>, restricted:true },
    { id:"announcements" as Section, label:"Announcements",  icon:<Megaphone size={18}/> },
    { id:"logs"          as Section, label:"Activity Log",   icon:<ScrollText size={18}/> },
  ]

  // ─────────────────────────────────────────────────────────────
  // OVERVIEW
  // ─────────────────────────────────────────────────────────────
  const renderOverview = () => {
    const t = overview?.totals ?? {}
    const chartMax = Math.max(...chart.map((d:any)=>d.posts), 1)
    return (
      <div>
        <SectionHeader title={`Welcome back, ${admin.name.split(" ")[0]} 👋`} sub={new Date().toLocaleDateString("en",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12, marginBottom:20 }}>
          <StatCard label="Total Users"      value={fmt(t.users)}    icon={<Users size={20} color="#0f1f6e"/>} onClick={()=>setSection("users")}/>
          <StatCard label="Active Listings"  value={fmt(t.listings)} icon={<Package size={20} color="#f97316"/>} color="#f97316" onClick={()=>setSection("listings")}/>
          <StatCard label="Total Clicks"     value={fmt(t.clicks)}   icon={<MousePointerClick size={20} color="#16a34a"/>} color="#16a34a"/>
          <StatCard label="Verified Sellers" value={fmt(t.verified)} icon={<ShieldCheck size={20} color="#7c3aed"/>} color="#7c3aed" onClick={()=>setSection("verifications")}/>
          <StatCard label="Pending Reports"  value={fmt(t.reports)}  icon={<Flag size={20} color="#dc2626"/>} color="#dc2626" sub={t.reports>0?"Needs attention":""} onClick={()=>setSection("reports")}/>
          <StatCard label="Active Schools"   value={fmt(t.schools)}  icon={<School size={20} color="#0891b2"/>} color="#0891b2" onClick={()=>setSection("groups")}/>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr", gap:14, marginBottom:16 }}>
          {/* Bar chart */}
          <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", padding:"20px 22px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
              <BarChart2 size={16} color="#0f1f6e"/>
              <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", fontSize:"0.92rem" }}>Posts — Last 7 Days</span>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:100 }}>
              {chart.map((d:any,i:number)=>(
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <span style={{ fontSize:"0.58rem", fontWeight:700, color:"#0f1f6e" }}>{d.posts}</span>
                  <div style={{ width:"100%", background:"linear-gradient(180deg,#0f1f6e,#4338ca)", borderRadius:"3px 3px 0 0", height:`${Math.max(4,(d.posts/chartMax)*90)}px`, transition:"height .5s ease" }}/>
                  <span style={{ fontSize:"0.58rem", color:"#94a3b8" }}>{d.date}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Quick actions */}
          <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", padding:"18px 20px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <Activity size={15} color="#0f1f6e"/>
              <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", fontSize:"0.9rem" }}>Quick Actions</span>
            </div>
            {[
              {label:"Review Verifications", color:"#7c3aed", icon:<ShieldCheck size={13}/>, action:()=>setSection("verifications")},
              {label:"Manage Reports",        color:"#dc2626", icon:<Flag size={13}/>,        action:()=>setSection("reports")},
              {label:"Add Rental Banner",     color:"#f97316", icon:<ImageIcon size={13}/>,   action:()=>{setSection("banners");setTimeout(()=>{setFormData({});setModal("addBanner")},300)}},
              {label:"Send Announcement",     color:"#0891b2", icon:<Megaphone size={13}/>,   action:()=>setSection("announcements")},
            ].map(a=>(
              <button key={a.label} onClick={a.action} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", marginBottom:8, padding:"9px 12px", borderRadius:10, border:`1.5px solid ${a.color}25`, background:`${a.color}07`, color:a.color, fontWeight:700, fontSize:"0.78rem", textAlign:"left", cursor:"pointer" }}>
                {a.icon} {a.label} →
              </button>
            ))}
          </div>
        </div>

        {/* Recent grids */}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
          <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", padding:"18px 20px" }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", marginBottom:14, fontSize:"0.9rem" }}>Recent Signups</div>
            {(overview?.recentUsers??[]).map((u:any)=>(
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, paddingBottom:12, borderBottom:"1px solid #f8fafc" }}>
                <Avatar url={u.avatar_url} name={u.full_name||u.username} size={34}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:"0.82rem", color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.full_name||u.username}</div>
                  <div style={{ fontSize:"0.68rem", color:"#94a3b8" }}>{u.school||"No school"} · {timeAgo(u.created_at)}</div>
                </div>
                {u.is_premium && <Badge label="Verified" color="#7c3aed"/>}
              </div>
            ))}
          </div>
          <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", padding:"18px 20px" }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", marginBottom:14, fontSize:"0.9rem" }}>Recent Listings</div>
            {(overview?.recentPosts??[]).map((p:any)=>(
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, paddingBottom:12, borderBottom:"1px solid #f8fafc" }}>
                <div style={{ width:36, height:36, borderRadius:8, overflow:"hidden", flexShrink:0, background:"#eef2ff" }}>
                  {p.image_url && <img src={p.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:"0.82rem", color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                  <div style={{ fontSize:"0.68rem", color:"#94a3b8" }}>{p.profiles?.full_name||p.profiles?.username||"Unknown"} · {timeAgo(p.created_at)}</div>
                </div>
                <span style={{ fontSize:"0.7rem", fontWeight:700, color:"#ea580c", whiteSpace:"nowrap" }}>{p.clicks??0} clicks</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────────────────────────
  const renderUsers = () => (
    <div>
      <SectionHeader title="Users" sub={`${usersTotal.toLocaleString()} total members`}/>
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:180, display:"flex", alignItems:"center", gap:8, background:"white", border:"1.5px solid #e2e8f0", borderRadius:10, padding:"8px 12px" }}>
          <Search size={14} color="#94a3b8"/>
          <input value={usersSearch} onChange={e=>setUsersSearch(e.target.value)} placeholder="Search name or username…" style={{ border:"none", outline:"none", flex:1, fontSize:"0.85rem", color:"#1e293b", background:"transparent" }}/>
          {usersSearch && <button onClick={()=>setUsersSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", display:"flex" }}><X size={13}/></button>}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["all","verified","banned","pending"].map(f=>(
            <button key={f} onClick={()=>{setUsersFilter(f);setUsersPage(0)}} style={{ padding:"8px 12px", borderRadius:10, border:"1.5px solid", borderColor:usersFilter===f?"#0f1f6e":"#e2e8f0", background:usersFilter===f?"#0f1f6e":"white", color:usersFilter===f?"white":"#64748b", fontSize:"0.75rem", fontWeight:700, cursor:"pointer", textTransform:"capitalize" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner/></div> :
      users.length === 0 ? <Empty icon={<Users size={40}/>} title="No users found" sub="Try a different search or filter"/> :
      isMobile ? (
        <div>
          {users.map(u=>(
            <MobileCard key={u.id}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <Avatar url={u.avatar_url} name={u.full_name||u.username} size={40}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, color:"#0f172a", fontSize:"0.88rem" }}>{u.full_name||"—"}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8" }}>@{u.username}</div>
                  <div style={{ fontSize:"0.7rem", color:"#64748b" }}>{u.school||"No school"}</div>
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {u.is_premium && <Badge label="Verified" color="#7c3aed"/>}
                  {u.is_banned  && <Badge label="Banned"   color="#dc2626"/>}
                  {!u.is_premium && !u.is_banned && <Badge label="Active" color="#16a34a"/>}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>act(u.is_premium?"unverifyUser":"verifyUser",{userId:u.id},u.is_premium?"Verification removed":"User verified ✓")} style={{ width:30, height:30, borderRadius:8, background:u.is_premium?"#f0fdf4":"#eef2ff", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:u.is_premium?"#16a34a":"#0f1f6e" }}>
                    <BadgeCheck size={13}/>
                  </button>
                  <button onClick={()=>{ if(u.is_banned){ act("unbanUser",{userId:u.id},"User unbanned") }else{ setModalData(u);setModal("banUser") } }} style={{ width:30, height:30, borderRadius:8, background:u.is_banned?"#fef2f2":"#f8fafc", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:u.is_banned?"#dc2626":"#94a3b8" }}>
                    <Ban size={13}/>
                  </button>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["User","School","Status","Joined","Actions"].map(h=>(
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:"0.63rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.09em", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id} style={{ borderTop:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <Avatar url={u.avatar_url} name={u.full_name||u.username} size={32}/>
                      <div>
                        <div style={{ fontWeight:700, fontSize:"0.83rem", color:"#0f172a" }}>{u.full_name||"—"}</div>
                        <div style={{ fontSize:"0.69rem", color:"#94a3b8" }}>{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"11px 16px", fontSize:"0.79rem", color:"#64748b" }}>{u.school||"—"}</td>
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {u.is_premium && <Badge label="Verified" color="#7c3aed"/>}
                      {u.is_banned  && <Badge label="Banned"   color="#dc2626"/>}
                      {u.verification_status==="pending" && <Badge label="Pending" color="#f97316"/>}
                      {!u.is_premium&&!u.is_banned&&u.verification_status!=="pending" && <Badge label="Active" color="#16a34a"/>}
                    </div>
                  </td>
                  <td style={{ padding:"11px 16px", fontSize:"0.78rem", color:"#94a3b8" }}>{fmtDate(u.created_at)}</td>
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <a href={`/profile/${u.id}`} target="_blank" rel="noopener" style={{ width:28, height:28, borderRadius:7, background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", color:"#64748b" }}><Eye size={12}/></a>
                      <button onClick={()=>act(u.is_premium?"unverifyUser":"verifyUser",{userId:u.id},u.is_premium?"Removed":"Verified ✓")} style={{ width:28, height:28, borderRadius:7, background:u.is_premium?"#f0fdf4":"#eef2ff", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:u.is_premium?"#16a34a":"#0f1f6e" }}><BadgeCheck size={12}/></button>
                      <button onClick={()=>{ if(u.is_banned){ act("unbanUser",{userId:u.id},"Unbanned") }else{ setModalData(u);setModal("banUser") } }} style={{ width:28, height:28, borderRadius:7, background:u.is_banned?"#fef2f2":"#f8fafc", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:u.is_banned?"#dc2626":"#94a3b8" }}><Ban size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={usersPage} total={usersTotal} size={25} onPage={setUsersPage}/>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // LISTINGS
  // ─────────────────────────────────────────────────────────────
  const renderListings = () => (
    <div>
      <SectionHeader title="Listings" sub={`${listTotal.toLocaleString()} total`}/>
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:180, display:"flex", alignItems:"center", gap:8, background:"white", border:"1.5px solid #e2e8f0", borderRadius:10, padding:"8px 12px" }}>
          <Search size={14} color="#94a3b8"/>
          <input value={listSearch} onChange={e=>setListSearch(e.target.value)} placeholder="Search listings…" style={{ border:"none", outline:"none", flex:1, fontSize:"0.85rem", background:"transparent" }}/>
          {listSearch && <button onClick={()=>setListSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", display:"flex" }}><X size={13}/></button>}
        </div>
        {["all","active","removed"].map(f=>(
          <button key={f} onClick={()=>{setListFilter(f);setListPage(0)}} style={{ padding:"8px 12px", borderRadius:10, border:"1.5px solid", borderColor:listFilter===f?"#f97316":"#e2e8f0", background:listFilter===f?"#f97316":"white", color:listFilter===f?"white":"#64748b", fontSize:"0.75rem", fontWeight:700, cursor:"pointer", textTransform:"capitalize" }}>
            {f}
          </button>
        ))}
      </div>
      {loading ? <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner/></div> :
      listings.length === 0 ? <Empty icon={<Package size={40}/>} title="No listings found"/> :
      isMobile ? (
        <div>
          {listings.map(l=>(
            <MobileCard key={l.id}>
              <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                <div style={{ width:48, height:48, borderRadius:10, overflow:"hidden", background:"#eef2ff", flexShrink:0 }}>
                  {l.image_url && <img src={l.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                  <div style={{ fontSize:"0.72rem", color:"#64748b" }}>{l.profiles?.full_name||l.profiles?.username||"?"}</div>
                  <div style={{ display:"flex", gap:6, marginTop:4 }}>
                    <span style={{ fontWeight:700, color:"#ea580c", fontSize:"0.78rem" }}>{l.price!=null?`GH₵${l.price}`:"Free"}</span>
                    <span style={{ color:"#94a3b8", fontSize:"0.72rem" }}>{l.clicks??0} clicks</span>
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                {l.is_removed ? <Badge label="Removed" color="#dc2626"/> : (l.category ? <Badge label={l.category} color="#0891b2"/> : <Badge label="Active" color="#16a34a"/>)}
                <div style={{ display:"flex", gap:6 }}>
                  {l.is_removed
                    ? <button onClick={()=>act("restoreListing",{listingId:l.id},"Restored")} style={{ padding:"5px 10px", borderRadius:8, background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#16a34a", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>Restore</button>
                    : <button onClick={()=>{setModalData(l);setModal("removeListing")}} style={{ padding:"5px 10px", borderRadius:8, background:"#fef2f2", border:"1px solid #fca5a5", color:"#dc2626", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>Remove</button>
                  }
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Listing","Seller","Price","Clicks","Category","Posted","Actions"].map(h=>(
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:"0.63rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listings.map(l=>(
                <tr key={l.id} style={{ borderTop:"1px solid #f1f5f9", opacity:l.is_removed?.6:1 }}>
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:38, height:38, borderRadius:8, overflow:"hidden", background:"#eef2ff", flexShrink:0 }}>
                        {l.image_url && <img src={l.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>}
                      </div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:"0.8rem", color:"#0f172a", maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                        {l.is_removed && <Badge label="Removed" color="#dc2626"/>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"11px 16px", fontSize:"0.79rem", color:"#64748b" }}>{l.profiles?.full_name||l.profiles?.username||"—"}</td>
                  <td style={{ padding:"11px 16px", fontSize:"0.8rem", fontWeight:700, color:"#ea580c" }}>{l.price!=null?`GH₵${l.price}`:"—"}</td>
                  <td style={{ padding:"11px 16px", fontSize:"0.79rem", color:"#64748b" }}>{l.clicks??0}</td>
                  <td style={{ padding:"11px 16px" }}>{l.category&&<Badge label={l.category} color="#0891b2"/>}</td>
                  <td style={{ padding:"11px 16px", fontSize:"0.76rem", color:"#94a3b8" }}>{timeAgo(l.created_at)}</td>
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <a href={`/post/${l.id}`} target="_blank" rel="noopener" style={{ width:28, height:28, borderRadius:7, background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", color:"#64748b" }}><Eye size={12}/></a>
                      {l.is_removed
                        ? <button onClick={()=>act("restoreListing",{listingId:l.id},"Restored")} style={{ width:28, height:28, borderRadius:7, background:"#f0fdf4", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#16a34a" }}><RefreshCw size={12}/></button>
                        : <button onClick={()=>{setModalData(l);setModal("removeListing")}} style={{ width:28, height:28, borderRadius:7, background:"#fef2f2", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#dc2626" }}><Trash2 size={12}/></button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={listPage} total={listTotal} size={25} onPage={setListPage}/>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // VERIFICATIONS
  // ─────────────────────────────────────────────────────────────
  const renderVerifications = () => (
    <div>
      <SectionHeader title="Verification Requests" sub={`${verifications.length} pending review`}/>
      {loading ? <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner/></div> :
      verifications.length===0 ? (
        <Empty icon={<CheckCircle size={44} color="#16a34a"/>} title="All caught up!" sub="No pending verification requests"/>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
          {verifications.map((u:any)=>(
            <div key={u.id} style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", padding:"18px 18px", boxShadow:"0 2px 12px rgba(13,29,110,0.06)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <Avatar url={u.avatar_url} name={u.full_name||u.username} size={44}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:"0.9rem", color:"#0f172a" }}>{u.full_name||"—"}</div>
                  <div style={{ fontSize:"0.71rem", color:"#94a3b8" }}>@{u.username}</div>
                  {u.school && <div style={{ fontSize:"0.69rem", color:"#0f1f6e", fontWeight:600, marginTop:2 }}>{u.school}</div>}
                </div>
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <div style={{ flex:1, background:"#f8fafc", borderRadius:10, padding:"9px 10px", textAlign:"center" }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, color:"#0f1f6e", fontSize:"1.15rem" }}>{u.listing_count}</div>
                  <div style={{ fontSize:"0.6rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase" }}>Listings</div>
                </div>
                <div style={{ flex:1, background:"#f8fafc", borderRadius:10, padding:"9px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:"0.7rem", color:"#64748b", fontWeight:600, marginTop:2 }}>{fmtDate(u.created_at)}</div>
                  <div style={{ fontSize:"0.6rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase" }}>Joined</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>act("approveVerification",{userId:u.id},"✓ Approved!").then(()=>setVerifs(v=>v.filter((x:any)=>x.id!==u.id)))} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#16a34a,#15803d)", color:"white", fontWeight:800, fontSize:"0.8rem", cursor:"pointer" }}>
                  ✓ Approve
                </button>
                <button onClick={()=>{setModalData(u);setModal("rejectVerif")}} style={{ flex:1, padding:"9px", borderRadius:10, border:"1.5px solid #fca5a5", background:"white", color:"#dc2626", fontWeight:800, fontSize:"0.8rem", cursor:"pointer" }}>
                  ✗ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // GROUPS
  // ─────────────────────────────────────────────────────────────
  const renderGroups = () => (
    <div>
      <SectionHeader title="School Groups" sub={`${groups.length} groups`}/>
      {loading ? <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner/></div> :
      groups.length===0 ? <Empty icon={<School size={40}/>} title="No groups yet"/> :
      isMobile ? (
        <div>
          {groups.map((g:any)=>(
            <MobileCard key={g.id}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#0f1f6e,#4338ca)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <School size={16} color="white"/>
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#0f172a" }}>{g.name}</div>
                  <div style={{ fontSize:"0.72rem", color:"#64748b" }}>{g.school} · {g.member_count} members</div>
                </div>
              </div>
              <button onClick={async()=>{const r=await api("getGroupMembers",{groupId:g.id});setGroupMembers(r.members??[]);setModalData(g);setModal("groupMembers")}} style={{ width:"100%", padding:"8px", borderRadius:9, border:"1.5px solid #c7d2fe", background:"#eef2ff", color:"#0f1f6e", fontSize:"0.78rem", fontWeight:700, cursor:"pointer" }}>
                View Members ({g.member_count})
              </button>
            </MobileCard>
          ))}
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Group","School","Members","Messages","Created","Actions"].map(h=>(
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:"0.63rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g:any)=>(
                <tr key={g.id} style={{ borderTop:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#0f1f6e,#4338ca)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <School size={15} color="white"/>
                      </div>
                      <span style={{ fontWeight:700, fontSize:"0.83rem", color:"#0f172a" }}>{g.name}</span>
                    </div>
                  </td>
                  <td style={{ padding:"11px 16px", fontSize:"0.79rem", color:"#64748b" }}>{g.school}</td>
                  <td style={{ padding:"11px 16px", fontWeight:700, color:"#0f1f6e" }}>{g.member_count}</td>
                  <td style={{ padding:"11px 16px", color:"#64748b" }}>{g.message_count}</td>
                  <td style={{ padding:"11px 16px", fontSize:"0.76rem", color:"#94a3b8" }}>{fmtDate(g.created_at)}</td>
                  <td style={{ padding:"11px 16px" }}>
                    <button onClick={async()=>{const r=await api("getGroupMembers",{groupId:g.id});setGroupMembers(r.members??[]);setModalData(g);setModal("groupMembers")}} style={{ padding:"5px 12px", borderRadius:8, border:"1.5px solid #c7d2fe", background:"#eef2ff", color:"#0f1f6e", fontSize:"0.74rem", fontWeight:700, cursor:"pointer" }}>
                      Members
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // BANNERS
  // ─────────────────────────────────────────────────────────────
  const renderBanners = () => (
    <div>
      <SectionHeader title="Rental Banners" sub="Manage homepage rental banners"
        action={<button onClick={()=>{setFormData({});setModal("addBanner")}} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:10, background:"linear-gradient(135deg,#0f1f6e,#1a2a9a)", color:"white", border:"none", fontWeight:700, fontSize:"0.8rem", cursor:"pointer" }}><Plus size={14}/> Add Banner</button>}
      />
      {loading ? <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner/></div> :
      banners.length===0 ? (
        <Empty icon={<ImageIcon size={44}/>} title="No banners yet" sub="Add a rental banner to display on the homepage"
          action={<button onClick={()=>{setFormData({});setModal("addBanner")}} style={{ padding:"9px 20px", borderRadius:10, background:"#0f1f6e", color:"white", border:"none", fontWeight:700, cursor:"pointer" }}>Add First Banner</button>}
        />
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
          {banners.map((b:any)=>(
            <div key={b.id} style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", overflow:"hidden", boxShadow:"0 2px 12px rgba(13,29,110,0.06)" }}>
              <div style={{ position:"relative", aspectRatio:"16/7", background:"linear-gradient(135deg,#eef2ff,#f1f5f9)", overflow:"hidden" }}>
                {b.image_url ? <img src={b.image_url} alt={b.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#c7d2fe" }}><ImageIcon size={32}/></div>
                )}
                <div style={{ position:"absolute", top:8, right:8 }}>
                  <Badge label={b.is_active?"Active":"Inactive"} color={b.is_active?"#16a34a":"#94a3b8"}/>
                </div>
              </div>
              <div style={{ padding:"14px 16px" }}>
                <div style={{ fontWeight:700, fontSize:"0.88rem", color:"#0f172a", marginBottom:3 }}>{b.title||"Untitled Banner"}</div>
                <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginBottom:12 }}>📞 {b.whatsapp_number||"—"} · {timeAgo(b.created_at)}</div>
                <div style={{ display:"flex", gap:7 }}>
                  <button onClick={()=>act("updateBanner",{id:b.id,is_active:!b.is_active},b.is_active?"Deactivated":"Activated")} style={{ flex:1, padding:"7px", borderRadius:9, border:"1.5px solid #e2e8f0", background:"white", color:"#64748b", fontSize:"0.74rem", fontWeight:700, cursor:"pointer" }}>
                    {b.is_active?"Deactivate":"Activate"}
                  </button>
                  <button onClick={()=>{setFormData(b);setModal("editBanner")}} style={{ width:32, height:32, borderRadius:9, border:"1.5px solid #c7d2fe", background:"#eef2ff", color:"#0f1f6e", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Edit2 size={13}/></button>
                  <button onClick={()=>{if(confirm("Delete this banner?")) act("deleteBanner",{id:b.id},"Banner deleted")}} style={{ width:32, height:32, borderRadius:9, border:"1.5px solid #fca5a5", background:"#fef2f2", color:"#dc2626", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Trash2 size={13}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // REPORTS
  // ─────────────────────────────────────────────────────────────
  const renderReports = () => (
    <div>
      <SectionHeader title="Reports" sub={`${repTotal} total`}/>
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {["pending","resolved","dismissed","all"].map(f=>(
          <button key={f} onClick={()=>{setRepFilter(f);setRepPage(0)}} style={{ padding:"7px 12px", borderRadius:10, border:"1.5px solid", borderColor:repFilter===f?"#dc2626":"#e2e8f0", background:repFilter===f?"#dc2626":"white", color:repFilter===f?"white":"#64748b", fontSize:"0.75rem", fontWeight:700, cursor:"pointer", textTransform:"capitalize" }}>
            {f}
          </button>
        ))}
      </div>
      {loading ? <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner/></div> :
      reports.length===0 ? <Empty icon={<Flag size={40}/>} title={repFilter==="pending"?"No pending reports":"No reports"} sub={repFilter==="pending"?"Great! Everything looks clean.":""}/> :
      isMobile ? (
        <div>
          {reports.map((r:any)=>(
            <MobileCard key={r.id}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontWeight:700, fontSize:"0.82rem", color:"#0f172a" }}>{r.profiles?.full_name||r.profiles?.username||"Unknown"}</div>
                <Badge label={r.status} color={r.status==="pending"?"#f97316":r.status==="resolved"?"#16a34a":"#94a3b8"}/>
              </div>
              <div style={{ fontSize:"0.78rem", color:"#64748b", marginBottom:8 }}>{r.reason}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <Badge label={r.target_type} color="#0891b2"/>
                {r.status==="pending" && (
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>act("resolveReport",{reportId:r.id},"Resolved")} style={{ padding:"5px 10px", borderRadius:7, background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#16a34a", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>Resolve</button>
                    <button onClick={()=>act("dismissReport",{reportId:r.id},"Dismissed")} style={{ padding:"5px 10px", borderRadius:7, background:"#f8fafc", border:"1px solid #e2e8f0", color:"#94a3b8", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>Dismiss</button>
                  </div>
                )}
              </div>
            </MobileCard>
          ))}
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Reporter","Type","Reason","Status","Date","Actions"].map(h=>(
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:"0.63rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r:any)=>(
                <tr key={r.id} style={{ borderTop:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"11px 16px", fontSize:"0.82rem", fontWeight:600, color:"#0f172a" }}>{r.profiles?.full_name||r.profiles?.username||"Unknown"}</td>
                  <td style={{ padding:"11px 16px" }}><Badge label={r.target_type} color="#0891b2"/></td>
                  <td style={{ padding:"11px 16px", fontSize:"0.79rem", color:"#64748b", maxWidth:200 }}>{r.reason}</td>
                  <td style={{ padding:"11px 16px" }}><Badge label={r.status} color={r.status==="pending"?"#f97316":r.status==="resolved"?"#16a34a":"#94a3b8"}/></td>
                  <td style={{ padding:"11px 16px", fontSize:"0.76rem", color:"#94a3b8" }}>{timeAgo(r.created_at)}</td>
                  <td style={{ padding:"11px 16px" }}>
                    {r.status==="pending" && (
                      <div style={{ display:"flex", gap:5 }}>
                        <button onClick={()=>act("resolveReport",{reportId:r.id},"Resolved")} style={{ padding:"4px 9px", borderRadius:7, background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#16a34a", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>Resolve</button>
                        <button onClick={()=>act("dismissReport",{reportId:r.id},"Dismissed")} style={{ padding:"4px 9px", borderRadius:7, background:"#f8fafc", border:"1px solid #e2e8f0", color:"#94a3b8", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>Dismiss</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={repPage} total={repTotal} size={25} onPage={setRepPage}/>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // STAFF
  // ─────────────────────────────────────────────────────────────
  const renderStaff = () => {
    if (admin.role!=="superadmin") return (
      <Empty icon={<ShieldCheck size={44}/>} title="Superadmin only" sub="Staff management is restricted to superadmins."/>
    )
    return (
      <div>
        <SectionHeader title="Staff Management" sub={`${staff.length} staff accounts`}
          action={<button onClick={()=>{setFormData({role:"moderator"});setModal("createStaff")}} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:10, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", color:"white", border:"none", fontWeight:700, fontSize:"0.8rem", cursor:"pointer" }}><Plus size={14}/> Generate Staff ID</button>}
        />
        {loading ? <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner/></div> :
        isMobile ? (
          <div>
            {staff.map((s:any)=>(
              <MobileCard key={s.staff_id}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:`${ROLE_COLORS[s.role]||"#0f1f6e"}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <UserCog size={16} color={ROLE_COLORS[s.role]||"#0f1f6e"}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#0f172a" }}>{s.name} {s.staff_id===admin.staffId&&<span style={{ fontSize:"0.62rem", color:"#f97316" }}>YOU</span>}</div>
                    <code style={{ fontSize:"0.72rem", background:"#f1f5f9", padding:"1px 6px", borderRadius:5, color:"#0f1f6e" }}>{s.staff_id}</code>
                  </div>
                  <Badge label={ROLE_LABELS[s.role]||s.role} color={ROLE_COLORS[s.role]||"#64748b"}/>
                </div>
                {s.staff_id!==admin.staffId && (
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>act(s.is_active?"deactivateStaff":"reactivateStaff",{staffId:s.staff_id},s.is_active?"Deactivated":"Reactivated")} style={{ flex:1, padding:"7px", borderRadius:9, border:`1px solid ${s.is_active?"#fca5a5":"#bbf7d0"}`, background:s.is_active?"#fef2f2":"#f0fdf4", color:s.is_active?"#dc2626":"#16a34a", fontSize:"0.74rem", fontWeight:700, cursor:"pointer" }}>
                      {s.is_active?"Deactivate":"Activate"}
                    </button>
                    <button onClick={()=>{setModalData(s);setModal("resetPassword")}} style={{ flex:1, padding:"7px", borderRadius:9, border:"1px solid #e2e8f0", background:"white", color:"#64748b", fontSize:"0.74rem", fontWeight:700, cursor:"pointer" }}>Reset PW</button>
                  </div>
                )}
              </MobileCard>
            ))}
          </div>
        ) : (
          <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["Staff ID","Name","Email","Role","Last Login","Status","Actions"].map(h=>(
                    <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:"0.63rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s:any)=>(
                  <tr key={s.staff_id} style={{ borderTop:"1px solid #f1f5f9", background:s.staff_id===admin.staffId?"#fffbeb":undefined }}>
                    <td style={{ padding:"11px 16px" }}>
                      <code style={{ fontFamily:"monospace", fontWeight:700, fontSize:"0.8rem", background:"#f1f5f9", padding:"3px 8px", borderRadius:6, color:"#0f1f6e" }}>{s.staff_id}</code>
                      {s.staff_id===admin.staffId && <span style={{ marginLeft:5, fontSize:"0.6rem", fontWeight:700, color:"#f97316" }}>YOU</span>}
                    </td>
                    <td style={{ padding:"11px 16px", fontWeight:700, fontSize:"0.83rem", color:"#0f172a" }}>{s.name}</td>
                    <td style={{ padding:"11px 16px", fontSize:"0.79rem", color:"#64748b" }}>{s.email||"—"}</td>
                    <td style={{ padding:"11px 16px" }}><Badge label={ROLE_LABELS[s.role]||s.role} color={ROLE_COLORS[s.role]||"#64748b"}/></td>
                    <td style={{ padding:"11px 16px", fontSize:"0.76rem", color:"#94a3b8" }}>{s.last_login?timeAgo(s.last_login):"Never"}</td>
                    <td style={{ padding:"11px 16px" }}><Badge label={s.is_active?"Active":"Inactive"} color={s.is_active?"#16a34a":"#94a3b8"}/></td>
                    <td style={{ padding:"11px 16px" }}>
                      {s.staff_id!==admin.staffId && (
                        <div style={{ display:"flex", gap:5 }}>
                          <button onClick={()=>act(s.is_active?"deactivateStaff":"reactivateStaff",{staffId:s.staff_id},s.is_active?"Deactivated":"Reactivated")} style={{ padding:"4px 9px", borderRadius:7, background:s.is_active?"#fef2f2":"#f0fdf4", border:`1px solid ${s.is_active?"#fca5a5":"#bbf7d0"}`, color:s.is_active?"#dc2626":"#16a34a", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>
                            {s.is_active?"Deactivate":"Activate"}
                          </button>
                          <button onClick={()=>{setModalData(s);setModal("resetPassword")}} style={{ padding:"4px 9px", borderRadius:7, background:"#f8fafc", border:"1px solid #e2e8f0", color:"#64748b", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>Reset PW</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────────
  const renderAnnouncements = () => (
    <div>
      <SectionHeader title="Announcements" sub="Broadcast to user inboxes"/>
      {/* Compose */}
      <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", padding:"20px 22px", marginBottom:20, boxShadow:"0 2px 12px rgba(13,29,110,0.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <Send size={15} color="#0f1f6e"/>
          <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", fontSize:"0.95rem" }}>Send New Announcement</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <input value={formData.title||""} onChange={e=>setFormData((f:any)=>({...f,title:e.target.value}))} placeholder="Announcement title…" style={{ padding:"10px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.88rem", outline:"none" }}/>
          <textarea value={formData.body||""} onChange={e=>setFormData((f:any)=>({...f,body:e.target.value}))} placeholder="Message body — this will appear in every user's notification inbox…" rows={4} style={{ padding:"10px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.88rem", outline:"none", resize:"vertical", fontFamily:"'DM Sans',sans-serif" }}/>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
            <div style={{ flex:1, minWidth:180 }}>
              <label style={{ fontSize:"0.68rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:5 }}>
                🎯 Target (leave blank = all users)
              </label>
              <input value={formData.target_school||""} onChange={e=>setFormData((f:any)=>({...f,target_school:e.target.value}))} placeholder="Type school name to target specific school…" style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.85rem", outline:"none" }}/>
            </div>
            <button onClick={async()=>{
              if(!formData.title||!formData.body){showToast("Title and body required","err");return}
              const ok=await act("sendAnnouncement",{title:formData.title,body:formData.body,target_school:formData.target_school||null},"📢 Announcement delivered to inboxes!")
              if(ok) setFormData({})
            }} disabled={actionLoading} style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:"linear-gradient(135deg,#0f1f6e,#1a2a9a)", color:"white", border:"none", fontWeight:700, fontSize:"0.85rem", cursor:actionLoading?"not-allowed":"pointer", whiteSpace:"nowrap", opacity:actionLoading?.7:1 }}>
              {actionLoading ? <Loader2 size={15} style={{animation:"spin .8s linear infinite"}}/> : <Send size={14}/>}
              {actionLoading?"Sending…":"Send to Inboxes"}
            </button>
          </div>
        </div>
        {/* Info banner */}
        <div style={{ marginTop:14, padding:"10px 14px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, fontSize:"0.76rem", color:"#15803d", display:"flex", alignItems:"center", gap:8 }}>
          <Bell size={13}/>
          Announcements are delivered directly to each user's notification inbox in the app.
          {formData.target_school && ` Targeting users from: ${formData.target_school}.`}
          {!formData.target_school && " Targeting: all users."}
        </div>
      </div>
      {/* History */}
      <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:"#0f1f6e", marginBottom:12, fontSize:"0.95rem" }}>History</div>
      {loading ? <Spinner/> :
      announcements.length===0 ? <p style={{ color:"#94a3b8", fontSize:"0.85rem" }}>No announcements sent yet.</p>
      : announcements.map((a:any)=>(
        <div key={a.id} style={{ background:"white", borderRadius:14, border:"1px solid #eef2ff", padding:"15px 18px", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, flexWrap:"wrap", marginBottom:6 }}>
            <div style={{ fontWeight:700, fontSize:"0.88rem", color:"#0f172a" }}>{a.title}</div>
            <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
              {a.target_school ? <Badge label={`📍 ${a.target_school}`} color="#0891b2"/> : <Badge label="📢 All Users" color="#0f1f6e"/>}
              <span style={{ fontSize:"0.7rem", color:"#94a3b8" }}>{timeAgo(a.created_at)}</span>
            </div>
          </div>
          <p style={{ fontSize:"0.8rem", color:"#64748b", lineHeight:1.6 }}>{a.body}</p>
          <div style={{ marginTop:8, fontSize:"0.69rem", color:"#94a3b8" }}>Sent by {a.sent_by_name||a.sent_by}</div>
        </div>
      ))}
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // LOGS
  // ─────────────────────────────────────────────────────────────
  const renderLogs = () => (
    <div>
      <SectionHeader title="Activity Log" sub={`${logsTotal.toLocaleString()} total actions`}
        action={<button onClick={()=>load("logs")} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", background:"white", color:"#64748b", fontWeight:700, fontSize:"0.78rem", cursor:"pointer" }}><RefreshCw size={13}/> Refresh</button>}
      />
      {loading ? <div style={{ padding:40, display:"flex", justifyContent:"center" }}><Spinner/></div> :
      isMobile ? (
        <div>
          {logs.map((l:any)=>(
            <MobileCard key={l.id}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ fontWeight:700, fontSize:"0.82rem", color:"#0f172a" }}>{l.staff_name||l.staff_id||"System"}</div>
                <span style={{ fontSize:"0.7rem", color:"#94a3b8" }}>{timeAgo(l.created_at)}</span>
              </div>
              <Badge label={l.action.replace(/_/g," ")} color={l.action.startsWith("BAN")||l.action.startsWith("DELETE")||l.action.startsWith("REMOVE")?"#dc2626":l.action.startsWith("APPROVE")||l.action.startsWith("VERIFY")||l.action.startsWith("RESTORE")?"#16a34a":"#0f1f6e"}/>
            </MobileCard>
          ))}
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:16, border:"1px solid #eef2ff", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Staff","Action","Target","Details","Time"].map(h=>(
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:"0.63rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l:any)=>(
                <tr key={l.id} style={{ borderTop:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"10px 16px" }}>
                    <div style={{ fontSize:"0.8rem", fontWeight:700, color:"#0f172a" }}>{l.staff_name||l.staff_id||"System"}</div>
                    <div style={{ fontSize:"0.67rem", color:"#94a3b8" }}>{l.staff_id}</div>
                  </td>
                  <td style={{ padding:"10px 16px" }}>
                    <Badge label={l.action.replace(/_/g," ")} color={l.action.startsWith("BAN")||l.action.startsWith("DELETE")||l.action.startsWith("REMOVE")?"#dc2626":l.action.startsWith("APPROVE")||l.action.startsWith("VERIFY")||l.action.startsWith("RESTORE")?"#16a34a":"#0f1f6e"}/>
                  </td>
                  <td style={{ padding:"10px 16px", fontSize:"0.77rem", color:"#64748b" }}>
                    {l.target_type && <span style={{ marginRight:4 }}><Badge label={l.target_type} color="#0891b2"/></span>}
                    <span style={{ fontFamily:"monospace", fontSize:"0.68rem" }}>{l.target_id?.slice(0,10)||"—"}</span>
                  </td>
                  <td style={{ padding:"10px 16px", fontSize:"0.73rem", color:"#94a3b8", maxWidth:180 }}>
                    {l.details&&Object.keys(l.details).length>0?JSON.stringify(l.details).slice(0,70)+"…":"—"}
                  </td>
                  <td style={{ padding:"10px 16px", fontSize:"0.74rem", color:"#94a3b8", whiteSpace:"nowrap" }}>{timeAgo(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={logsPage} total={logsTotal} size={30} onPage={setLogsPage}/>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // MODALS
  // ─────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!modal) return null
    const close = () => { setModal(null); setModalData(null); setFormData({}) }
    const wrap: React.CSSProperties = { position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", padding:isMobile?0:20 }
    const box: React.CSSProperties  = { background:"white", borderRadius:isMobile?"20px 20px 0 0":"20px", padding:"24px 22px", maxWidth:480, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.35)", position:"relative", maxHeight:isMobile?"90dvh":"90vh", overflowY:"auto" }

    const BtnRow = ({ onCancel, onConfirm, confirmLabel, danger=true }: any) => (
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onCancel} style={{ flex:1, padding:11, borderRadius:10, border:"1.5px solid #e2e8f0", background:"white", fontWeight:700, cursor:"pointer", fontSize:"0.88rem" }}>Cancel</button>
        <button onClick={onConfirm} disabled={actionLoading} style={{ flex:1, padding:11, borderRadius:10, border:"none", background:danger?"#dc2626":"linear-gradient(135deg,#0f1f6e,#1a2a9a)", color:"white", fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontSize:"0.88rem", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {actionLoading?<Loader2 size={15} style={{animation:"spin .8s linear infinite"}}/>:confirmLabel}
        </button>
      </div>
    )

    if (modal==="banUser") return (
      <div style={wrap} onClick={close}>
        <div style={box} onClick={e=>e.stopPropagation()}>
          <button onClick={close} style={{ position:"absolute", top:14, right:14, background:"#f1f5f9", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={13}/></button>
          <div style={{ width:42, height:42, borderRadius:12, background:"#fef2f2", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}><Ban size={20} color="#dc2626"/></div>
          <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, marginBottom:5, fontSize:"1.1rem" }}>Ban User</h3>
          <p style={{ fontSize:"0.82rem", color:"#64748b", marginBottom:14 }}>Ban <strong>{modalData?.full_name||modalData?.username}</strong>? They'll lose access immediately.</p>
          <textarea value={formData.reason||""} onChange={e=>setFormData((f:any)=>({...f,reason:e.target.value}))} placeholder="Reason (required)…" rows={3} style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.85rem", fontFamily:"'DM Sans',sans-serif", outline:"none", resize:"none", marginBottom:14 }}/>
          <BtnRow onCancel={close} confirmLabel="Confirm Ban" onConfirm={async()=>{ if(!formData.reason){showToast("Reason required","err");return} await act("banUser",{userId:modalData.id,reason:formData.reason},"User banned"); close() }}/>
        </div>
      </div>
    )

    if (modal==="removeListing") return (
      <div style={wrap} onClick={close}>
        <div style={box} onClick={e=>e.stopPropagation()}>
          <button onClick={close} style={{ position:"absolute", top:14, right:14, background:"#f1f5f9", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={13}/></button>
          <div style={{ width:42, height:42, borderRadius:12, background:"#fef2f2", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}><Trash2 size={20} color="#dc2626"/></div>
          <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, marginBottom:5, fontSize:"1.1rem" }}>Remove Listing</h3>
          <p style={{ fontSize:"0.82rem", color:"#64748b", marginBottom:14 }}>Remove <strong>"{modalData?.title}"</strong>?</p>
          <textarea value={formData.reason||""} onChange={e=>setFormData((f:any)=>({...f,reason:e.target.value}))} placeholder="Removal reason…" rows={3} style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.85rem", fontFamily:"'DM Sans',sans-serif", outline:"none", resize:"none", marginBottom:14 }}/>
          <BtnRow onCancel={close} confirmLabel="Remove" onConfirm={async()=>{ await act("removeListing",{listingId:modalData.id,reason:formData.reason||"Violated guidelines"},"Listing removed"); close() }}/>
        </div>
      </div>
    )

    if (modal==="rejectVerif") return (
      <div style={wrap} onClick={close}>
        <div style={box} onClick={e=>e.stopPropagation()}>
          <button onClick={close} style={{ position:"absolute", top:14, right:14, background:"#f1f5f9", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={13}/></button>
          <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, marginBottom:14, fontSize:"1.1rem" }}>Reject Verification</h3>
          <textarea value={formData.reason||""} onChange={e=>setFormData((f:any)=>({...f,reason:e.target.value}))} placeholder="Rejection reason (optional)…" rows={3} style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.85rem", fontFamily:"'DM Sans',sans-serif", outline:"none", resize:"none", marginBottom:14 }}/>
          <BtnRow onCancel={close} confirmLabel="Reject" onConfirm={async()=>{ await act("rejectVerification",{userId:modalData.id,reason:formData.reason},"Rejected"); setVerifs(v=>v.filter((x:any)=>x.id!==modalData.id)); close() }}/>
        </div>
      </div>
    )

    if (modal==="addBanner"||modal==="editBanner") {
      const isEdit = modal==="editBanner"
      return (
        <div style={wrap} onClick={close}>
          <div style={box} onClick={e=>e.stopPropagation()}>
            <button onClick={close} style={{ position:"absolute", top:14, right:14, background:"#f1f5f9", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={13}/></button>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, marginBottom:18, fontSize:"1.1rem" }}>{isEdit?"Edit Banner":"Add Rental Banner"}</h3>

            <label style={{ fontSize:"0.68rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>Banner Image</label>
            <ImageUploader value={formData.image_url||""} onChange={url=>setFormData((f:any)=>({...f,image_url:url}))}/>
            <div style={{ height:14 }}/>

            {[
              { key:"title",           label:"Title",           placeholder:"e.g. 3-Bedroom Apartment Near Campus", type:"text" },
              { key:"whatsapp_number", label:"WhatsApp Number", placeholder:"0201234567", type:"text" },
              { key:"description",     label:"Description",     placeholder:"Brief description…", type:"text" },
              { key:"expires_at",      label:"Expires At",      placeholder:"", type:"date" },
            ].map(f=>(
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:"0.68rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:5 }}>{f.label}</label>
                <input type={f.type} value={formData[f.key]||""} onChange={e=>setFormData((fd:any)=>({...fd,[f.key]:e.target.value}))} placeholder={f.placeholder} style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.85rem", outline:"none" }}/>
              </div>
            ))}
            <div style={{ height:6 }}/>
            <BtnRow danger={false} onCancel={close} confirmLabel={isEdit?"Save Changes":"Add Banner"} onConfirm={async()=>{ const ok=await act(isEdit?"updateBanner":"addBanner",isEdit?{id:formData.id,...formData}:formData,isEdit?"Banner updated":"Banner added!"); if(ok)close() }}/>
          </div>
        </div>
      )
    }

    if (modal==="createStaff") return (
      <div style={wrap} onClick={close}>
        <div style={box} onClick={e=>e.stopPropagation()}>
          <button onClick={close} style={{ position:"absolute", top:14, right:14, background:"#f1f5f9", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={13}/></button>
          {formData._newStaffId ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:"2.2rem", marginBottom:10 }}>🎉</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, marginBottom:6 }}>Staff Account Created!</h3>
              <p style={{ color:"#64748b", fontSize:"0.8rem", marginBottom:18 }}>Share credentials securely. Password cannot be recovered.</p>
              <div style={{ background:"#f1f5f9", borderRadius:14, padding:18, marginBottom:14 }}>
                <div style={{ fontSize:"0.62rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", marginBottom:8, letterSpacing:"0.1em" }}>Staff ID</div>
                <div style={{ fontFamily:"monospace", fontWeight:800, fontSize:"1.6rem", color:"#0f1f6e", letterSpacing:"0.12em" }}>{formData._newStaffId}</div>
              </div>
              <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:12, padding:"11px 16px", fontSize:"0.78rem", color:"#c2410c", marginBottom:18 }}>
                ⚠️ Save this Staff ID now — it won't be shown again.
              </div>
              <button onClick={close} style={{ width:"100%", padding:12, borderRadius:12, background:"linear-gradient(135deg,#0f1f6e,#1a2a9a)", color:"white", border:"none", fontWeight:700, cursor:"pointer" }}>Done</button>
            </div>
          ) : (
            <>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, marginBottom:18, fontSize:"1.1rem" }}>Generate Staff ID</h3>
              {[
                {key:"name",     label:"Full Name", placeholder:"e.g. Jane Asante", type:"text"},
                {key:"email",    label:"Email",     placeholder:"optional",          type:"email"},
                {key:"password", label:"Password",  placeholder:"min 8 characters",  type:"password"},
              ].map(f=>(
                <div key={f.key} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:"0.68rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:5 }}>{f.label}</label>
                  <input type={f.type} value={formData[f.key]||""} onChange={e=>setFormData((fd:any)=>({...fd,[f.key]:e.target.value}))} placeholder={f.placeholder} style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.88rem", outline:"none" }}/>
                </div>
              ))}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:"0.68rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:5 }}>Role</label>
                <select value={formData.role||"moderator"} onChange={e=>setFormData((fd:any)=>({...fd,role:e.target.value}))} style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.88rem", outline:"none" }}>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <BtnRow danger={false} onCancel={close} confirmLabel="Generate" onConfirm={async()=>{
                if(!formData.name||!formData.password){showToast("Name and password required","err");return}
                if(formData.password.length<8){showToast("Password must be 8+ characters","err");return}
                const r=await act("createStaff",{name:formData.name,email:formData.email,role:formData.role,password:formData.password},"")
                if(r&&r.staffId) setFormData((fd:any)=>({_newStaffId:r.staffId}))
              }}/>
            </>
          )}
        </div>
      </div>
    )

    if (modal==="resetPassword") return (
      <div style={wrap} onClick={close}>
        <div style={box} onClick={e=>e.stopPropagation()}>
          <button onClick={close} style={{ position:"absolute", top:14, right:14, background:"#f1f5f9", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={13}/></button>
          <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, marginBottom:5, fontSize:"1.1rem" }}>Reset Password</h3>
          <p style={{ color:"#64748b", fontSize:"0.8rem", marginBottom:14 }}>New password for <strong>{modalData?.name}</strong>.</p>
          <input type="password" value={formData.newPassword||""} onChange={e=>setFormData((f:any)=>({...f,newPassword:e.target.value}))} placeholder="New password (min 8 chars)…" style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.88rem", outline:"none", marginBottom:14 }}/>
          <BtnRow danger={false} onCancel={close} confirmLabel="Reset Password" onConfirm={async()=>{ if((formData.newPassword?.length||0)<8){showToast("8+ chars required","err");return} await act("resetStaffPassword",{staffId:modalData.staff_id,newPassword:formData.newPassword},"Password reset"); close() }}/>
        </div>
      </div>
    )

    if (modal==="groupMembers") return (
      <div style={wrap} onClick={close}>
        <div style={{...box,maxWidth:520}} onClick={e=>e.stopPropagation()}>
          <button onClick={close} style={{ position:"absolute", top:14, right:14, background:"#f1f5f9", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={13}/></button>
          <h3 style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, marginBottom:3, fontSize:"1.05rem" }}>{modalData?.name}</h3>
          <p style={{ color:"#94a3b8", fontSize:"0.76rem", marginBottom:14 }}>{groupMembers.length} members</p>
          <div style={{ maxHeight:380, overflowY:"auto" }}>
            {groupMembers.map((m:any)=>(
              <div key={m.user_id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #f1f5f9" }}>
                <Avatar url={m.profiles?.avatar_url} name={m.profiles?.full_name||m.profiles?.username} size={32}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:"0.83rem" }}>{m.profiles?.full_name||m.profiles?.username||"Unknown"}</div>
                  <div style={{ fontSize:"0.69rem", color:"#94a3b8" }}>{m.role} · joined {timeAgo(m.joined_at)}</div>
                </div>
                {m.profiles?.is_premium && <Badge label="Verified" color="#7c3aed"/>}
                {m.role!=="admin" && (
                  <button onClick={async()=>{ await act("removeGroupMember",{groupId:modalData.id,userId:m.user_id},"Removed"); setGroupMembers(mm=>mm.filter((x:any)=>x.user_id!==m.user_id)) }} style={{ padding:"4px 9px", borderRadius:7, background:"#fef2f2", border:"1px solid #fca5a5", color:"#dc2626", fontSize:"0.69rem", fontWeight:700, cursor:"pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )

    return null
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────
  const renderSection = () => {
    switch (section) {
      case "overview":      return renderOverview()
      case "users":         return renderUsers()
      case "listings":      return renderListings()
      case "verifications": return renderVerifications()
      case "groups":        return renderGroups()
      case "banners":       return renderBanners()
      case "reports":       return renderReports()
      case "staff":         return renderStaff()
      case "announcements": return renderAnnouncements()
      case "logs":          return renderLogs()
    }
  }

  const totalBadges = (verifications.length||0) + (reports.filter(r=>r.status==="pending").length||0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;background:#f4f6fb;font-family:'DM Sans',system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
        button,input,select,textarea{font-family:inherit}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes overlayIn{from{opacity:0}to{opacity:1}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#c7d2fe;border-radius:99px}
      `}</style>

      <div style={{ display:"flex", height:"100dvh", overflow:"hidden", position:"relative" }}>

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div onClick={()=>setSidebar(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:90, animation:"overlayIn .2s ease" }}/>
        )}

        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        <aside style={{
          position: isMobile ? "fixed" : "relative",
          left: 0, top: 0, bottom: 0,
          width: sidebarOpen ? 232 : (isMobile ? 0 : 60),
          background: "linear-gradient(180deg,#080e3b 0%,#0f1f6e 55%,#0a1550 100%)",
          display: "flex", flexDirection: "column",
          transition: "width .25s ease",
          overflow: "hidden", flexShrink: 0,
          zIndex: 100,
          boxShadow: sidebarOpen ? "4px 0 32px rgba(0,0,0,0.3)" : "none",
        }}>
          {/* Logo */}
          <div style={{ padding: sidebarOpen?"16px 14px 14px":"16px 12px 14px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid rgba(255,255,255,0.07)", flexShrink:0 }}>
            <div style={{ width:34, height:34, borderRadius:10, overflow:"hidden", flexShrink:0, background:"linear-gradient(135deg,#f97316,#ea580c)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {/* Try real logo, fallback to U */}
              <img src="/favicon.ico" alt="UniMart" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{ (e.target as any).style.display="none"; (e.target as any).nextSibling.style.display="flex" }}/>
              <span style={{ display:"none", color:"white", fontWeight:800, fontSize:"1rem" }}>U</span>
            </div>
            {sidebarOpen && (
              <div style={{ animation:"slideIn .2s ease" }}>
                <div style={{ fontFamily:"'Playfair Display',serif", color:"white", fontWeight:800, fontSize:"0.92rem", lineHeight:1.1 }}>UniMart</div>
                <div style={{ color:"rgba(255,255,255,0.38)", fontSize:"0.58rem", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" }}>Admin Panel</div>
              </div>
            )}
          </div>

          {/* Nav items */}
          <nav style={{ flex:1, overflowY:"auto", padding:"8px 7px" }}>
            {navItems.map(item=>{
              if (item.restricted && admin.role!=="superadmin") return null
              const active = section===item.id
              return (
                <button key={item.id} onClick={()=>{ setSection(item.id); if(isMobile) setSidebar(false) }}
                  style={{ display:"flex", alignItems:"center", gap:9, width:"100%", padding:sidebarOpen?"9px 11px":"10px", borderRadius:9, border:"none", background:active?"rgba(255,255,255,0.13)":"transparent", color:active?"white":"rgba(255,255,255,0.48)", cursor:"pointer", transition:"all .15s", marginBottom:2, justifyContent:sidebarOpen?"flex-start":"center", position:"relative" }}>
                  <div style={{ flexShrink:0 }}>{item.icon}</div>
                  {sidebarOpen && <span style={{ fontSize:"0.81rem", fontWeight:active?700:500, flex:1, textAlign:"left" }}>{item.label}</span>}
                  {(item.badge||0)>0 && (
                    <span style={{ background:"#ef4444", color:"white", borderRadius:999, minWidth:17, height:17, padding:"0 4px", fontSize:"0.57rem", fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {(item.badge||0)>99?"99+":item.badge}
                    </span>
                  )}
                  {active && <div style={{ position:"absolute", left:0, top:"15%", bottom:"15%", width:3, background:"#f97316", borderRadius:"0 3px 3px 0" }}/>}
                </button>
              )
            })}
          </nav>

          {/* Bottom user info */}
          <div style={{ padding:sidebarOpen?"12px 14px":"8px 10px", borderTop:"1px solid rgba(255,255,255,0.07)", flexShrink:0 }}>
            {sidebarOpen ? (
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#f97316,#ea580c)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:"white", fontWeight:700, fontSize:"0.82rem" }}>{admin.name[0]?.toUpperCase()}</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:"white", fontWeight:700, fontSize:"0.79rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{admin.name}</div>
                  <div style={{ color:"rgba(255,255,255,0.38)", fontSize:"0.59rem" }}>{ROLE_LABELS[admin.role]}</div>
                </div>
                <button onClick={logout} title="Logout" style={{ background:"rgba(255,255,255,0.08)", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.5)", display:"flex", padding:6, borderRadius:8 }}>
                  <LogOut size={14}/>
                </button>
              </div>
            ) : (
              <button onClick={logout} style={{ width:"100%", padding:7, background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.4)", display:"flex", justifyContent:"center" }}>
                <LogOut size={15}/>
              </button>
            )}
          </div>
        </aside>

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

          {/* Top bar */}
          <header style={{ height:54, background:"white", borderBottom:"1px solid #e8ecf4", display:"flex", alignItems:"center", padding:"0 16px", gap:12, boxShadow:"0 1px 6px rgba(13,29,110,0.06)", flexShrink:0, zIndex:50 }}>
            <button onClick={()=>setSidebar(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:8, color:"#64748b", flexShrink:0, position:"relative" }}>
              <Menu size={18}/>
              {totalBadges>0 && isMobile && (
                <span style={{ position:"absolute", top:2, right:2, width:8, height:8, background:"#ef4444", borderRadius:"50%", border:"1.5px solid white" }}/>
              )}
            </button>
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"0.95rem", fontWeight:700, color:"#0f1f6e", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {navItems.find(n=>n.id===section)?.label ?? "Dashboard"}
              </h1>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              <Badge label={ROLE_LABELS[admin.role]||admin.role} color={ROLE_COLORS[admin.role]||"#64748b"}/>
              {!isMobile && <code style={{ fontSize:"0.7rem", background:"#f1f5f9", padding:"3px 8px", borderRadius:6, color:"#0f1f6e", fontWeight:700 }}>{admin.staffId}</code>}
            </div>
          </header>

          {/* Scrollable content */}
          <main style={{ flex:1, overflowY:"auto", padding:isMobile?"16px 14px 60px":"22px 22px 48px" }}>
            <div style={{ maxWidth:1400, margin:"0 auto", animation:"fadeUp .3s ease" }}>
              {renderSection()}
            </div>
          </main>
        </div>
      </div>

      {renderModal()}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:isMobile?80:24, left:"50%", transform:"translateX(-50%)", zIndex:700, background:toast.type==="ok"?"linear-gradient(135deg,#0f1f6e,#1a2a9a)":"#dc2626", color:"white", borderRadius:12, padding:"11px 18px", fontWeight:700, fontSize:"0.83rem", boxShadow:"0 8px 32px rgba(0,0,0,0.3)", animation:"toastIn .3s ease", display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap", maxWidth:"calc(100vw - 32px)" }}>
          {toast.type==="ok" ? <Check size={14}/> : <AlertTriangle size={14}/>}
          {toast.msg}
        </div>
      )}
    </>
  )
}

// ── Pagination ───────────────────────────────────────────────
function Pagination({ page, total, size, onPage }: { page:number; total:number; size:number; onPage:(p:number)=>void }) {
  const pages = Math.ceil(total/size)
  if (pages<=1) return null
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 0", marginTop:6, flexWrap:"wrap", gap:8 }}>
      <span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>
        Showing {page*size+1}–{Math.min((page+1)*size,total)} of {total.toLocaleString()}
      </span>
      <div style={{ display:"flex", gap:5 }}>
        <button onClick={()=>onPage(page-1)} disabled={page===0} style={{ width:30, height:30, borderRadius:8, border:"1.5px solid #e2e8f0", background:"white", cursor:page===0?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:page===0?"#cbd5e1":"#0f1f6e" }}><ChevronLeft size={14}/></button>
        {Array.from({length:Math.min(5,pages)},(_,i)=>{
          let p=i; if(page>2&&pages>5) p=page-2+i; if(p>=pages) return null
          return <button key={p} onClick={()=>onPage(p)} style={{ width:30, height:30, borderRadius:8, border:"1.5px solid", borderColor:page===p?"#0f1f6e":"#e2e8f0", background:page===p?"#0f1f6e":"white", color:page===p?"white":"#64748b", cursor:"pointer", fontWeight:page===p?700:400, fontSize:"0.8rem" }}>{p+1}</button>
        })}
        <button onClick={()=>onPage(page+1)} disabled={page>=pages-1} style={{ width:30, height:30, borderRadius:8, border:"1.5px solid #e2e8f0", background:"white", cursor:page>=pages-1?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:page>=pages-1?"#cbd5e1":"#0f1f6e" }}><ChevronRight size={14}/></button>
      </div>
    </div>
  )
}