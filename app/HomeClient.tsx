"use client"

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Search, MessageSquare, Upload, User, X, ChevronDown,
  Loader2, Tag, AlertCircle, ShieldCheck,
  SlidersHorizontal, MousePointerClick, Lightbulb,
  LayoutGrid, Rows3, Share2, MessageCircle, ShoppingBag,
  BadgeCheck, Heart, Users, Inbox, RefreshCw,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS  — update these to your real URLs
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE     = 20
const WA_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb7SH4o6RGJ7eN2F012R"
const SOCIAL_URL     = "/social"
const INBOX_URL      = "/inbox"

const CATEGORIES = [
  "All","Electronics","Fashion","Books",
  "Food & Drinks","Services","Accommodation",
  "Sports","Beauty","Other",
]

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Profile = {
  id?: string
  username: string
  full_name: string | null
  school: string | null
  avatar_url: string | null
  whatsapp_number: string | null
  is_premium: boolean
}
type Post = {
  id: string; user_id: string; title: string; content: string | null
  image_url: string | null; created_at: string; clicks: number
  comments_count: number; price: number | null; expires_at: string | null
  category: string | null; tags: string[] | string | null; profiles?: Profile
}
type Banner   = { id: string; image_url: string; whatsapp_number: string; title?: string }
type ViewMode = "feed" | "grid"
type Row =
  | { type: "single"; post: Post; key: string }
  | { type: "pair";   posts: [Post, Post | null]; key: string }

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function scorePost(p: Post): number {
  const ageH = Math.max(0.5,(Date.now()-new Date(p.created_at).getTime())/3600000)
  const eng  = (p.clicks??0)*2+(p.comments_count??0)*4
  return 100/Math.pow(ageH,0.6)+eng/Math.pow(ageH,0.3)+(p.profiles?.is_premium?15:0)+Math.random()*5
}

function buildRows(posts: Post[]): Row[] {
  const v:Post[]=[],u:Post[]=[]
  posts.forEach(p=>(p.profiles?.is_premium?v:u).push(p))
  const rows:Row[]=[];let vi=0,ui=0
  while(ui<u.length||vi<v.length){
    if(ui<u.length){const a=u[ui++],b=ui<u.length?u[ui++]:null;rows.push({type:"pair",posts:[a,b],key:`pair-${a.id}`})}
    if(vi<v.length)rows.push({type:"single",post:v[vi++],key:`single-${v[vi-1].id}`})
    if(ui>=u.length&&vi<v.length)while(vi<v.length)rows.push({type:"single",post:v[vi++],key:`single-${v[vi-1].id}`})
  }
  return rows
}

function timeAgo(iso:string){
  const m=Math.floor((Date.now()-new Date(iso).getTime())/60000)
  if(m<1)return"Just now";if(m<60)return`${m}m ago`
  const h=Math.floor(m/60);if(h<24)return`${h}h ago`
  return`${Math.floor(h/24)}d ago`
}

function parseTags(tags:any):string[]{
  if(Array.isArray(tags))return tags
  if(typeof tags==="string"&&tags.trim())
    return tags.replace(/[\[\]"]/g,"").split(",").map((t:string)=>t.trim()).filter(Boolean)
  return[]
}

function fmtPrice(price:number|null){return price!=null?`GH₵ ${Number(price).toFixed(2)}`:null}

function waLink(num:string|null|undefined){
  if(!num)return null
  const d=String(num).replace(/\D/g,"")
  const n=d.startsWith("0")?"233"+d.slice(1):d
  return n?`https://wa.me/${n}`:null
}

async function openChat(userId:string|null,sellerId:string,postId:string,router:any){
  if(!userId){router.push("/login");return}
  if(userId===sellerId)return
  const{data:ex}=await supabase.from("conversations").select("id")
    .eq("buyer_id",userId).eq("seller_id",sellerId).eq("post_id",postId).maybeSingle()
  if(ex?.id){router.push(`/chat/${ex.id}`);return}
  const{data:cr}=await supabase.from("conversations")
    .insert({buyer_id:userId,seller_id:sellerId,post_id:postId,
      last_message:null,last_message_at:new Date().toISOString(),buyer_unread:0,seller_unread:0})
    .select("id").single()
  if(cr?.id)router.push(`/chat/${cr.id}`)
}

async function sharePost(post:Post){
  const url=`${window.location.origin}/post/${post.id}`
  try{if(navigator.share)await navigator.share({title:post.title,url})
    else await navigator.clipboard.writeText(url)}catch{}
}

// ─────────────────────────────────────────────────────────────────────────────
// DONATION MODAL — Paystack
// ─────────────────────────────────────────────────────────────────────────────
const DonationModal=memo(function DonationModal({onClose,userEmail}:{onClose:()=>void;userEmail?:string|null}){
  const[amount,setAmount]=useState(100)
  const[paying,setPaying]=useState(false)
  const[success,setSuccess]=useState(false)

  const pay=()=>{
    const key=process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
    if(!key){console.error("Paystack key missing");return}
    setPaying(true)
    const handler=(window as any).PaystackPop.setup({
      key,
      email:userEmail||"donor@unimartgh.com",
      amount,
      currency:"GHS",
      ref:`unimart-donation-${Date.now()}`,
      metadata:{custom_fields:[{display_name:"Purpose",variable_name:"purpose",value:"UniMart Donation"}]},
      callback:()=>{setPaying(false);setSuccess(true)},
      onClose:()=>setPaying(false),
    })
    handler.openIframe()
  }

  if(success)return(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={16}/></button>
        <div style={{textAlign:"center",padding:"8px 0 16px"}}>
          <div style={{fontSize:"3rem",marginBottom:12}}>🎉</div>
          <h2 className="modal-title">Thank you so much!</h2>
          <p className="modal-sub">Your support helps keep UniMart free for every student. You are a legend! ❤️</p>
          <button className="paystack-btn" style={{marginTop:20}} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )

  return(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={16}/></button>
        <div className="modal-icon"><Heart size={32} fill="#ef4444" color="#ef4444"/></div>
        <h2 className="modal-title">You are Amazing 🙏</h2>
        <p className="modal-sub">
          UniMart is 100% free — built with love for students like you.<br/>
          Help us publish on Play Store &amp; App Store.
        </p>
        <div className="modal-callout">
          <p style={{fontSize:"0.95rem",fontWeight:800,color:"#0f1f6e",marginBottom:4}}>
            Can you spare just <span style={{color:"#ea580c"}}>GH₵ 1?</span>
          </p>
          <p style={{fontSize:"0.8rem",color:"#64748b",lineHeight:1.55}}>
            Every cedi brings us closer to launch. We deeply appreciate your support! ❤️
          </p>
        </div>
        <div className="amount-grid">
          {[100,200,500,1000,2000].map(a=>(
            <button key={a} className={`amount-btn${amount===a?" amount-btn-on":""}`} onClick={()=>setAmount(a)}>
              GH₵{a/100}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="paystack-btn" onClick={pay} disabled={paying}>
            {paying
              ?<><div style={{width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"white",animation:"spin 0.7s linear infinite",display:"inline-block",marginRight:8}}/> Processing...</>
              :<>💳 Donate GH₵{amount/100} via Paystack</>
            }
          </button>
          <button className="modal-skip" onClick={onClose}>Maybe later</button>
        </div>
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// RENTAL BANNER
// ─────────────────────────────────────────────────────────────────────────────
const RentalBanner=memo(function RentalBanner(){
  const[banners,setBanners]=useState<Banner[]>([])
  const[idx,setIdx]=useState(0)
  const[fading,setFading]=useState(false)
  useEffect(()=>{
    supabase.from("rental_banners").select("id,image_url,whatsapp_number,title")
      .eq("is_active",true).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .then(({data})=>{if(data?.length)setBanners(data as Banner[])})
  },[])
  useEffect(()=>{
    if(banners.length<2)return
    const t=setInterval(()=>{
      setFading(true);setTimeout(()=>{setIdx(i=>(i+1)%banners.length);setFading(false)},380)
    },15000);return()=>clearInterval(t)
  },[banners])
  if(!banners.length)return null
  const b=banners[idx]
  const wl=(waLink(b.whatsapp_number)??"")+"?text=Hi%2C%20I%20saw%20your%20rental%20on%20UniMart"
  return(
    <div className="banner-root" style={{opacity:fading?0:1,transition:"opacity 0.38s"}}>
      <img src={b.image_url} alt={b.title??"Rental"} className="banner-img"/>
      <div className="banner-fade-bot"/>
      <div className="banner-bottom">
        <div style={{flex:1,minWidth:0}}>
          <a href={wl} target="_blank" rel="noopener noreferrer" className="banner-cta">
            <MessageSquare size={13}/> Contact Us
          </a>
        </div>
        {banners.length>1&&(
          <div className="banner-dots">
            {banners.map((_,i)=>(
              <button key={i} onClick={()=>setIdx(i)}
                style={{width:i===idx?20:6,height:6,borderRadius:3,
                  background:i===idx?"white":"rgba(255,255,255,0.35)",
                  border:"none",cursor:"pointer",padding:0,transition:"all 0.3s"}}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// FULL CARD (verified)
// ─────────────────────────────────────────────────────────────────────────────
const FullCard=memo(function FullCard({post,userId,isClicked,onToggle,router}:{
  post:Post;userId:string|null;isClicked:boolean;onToggle:(id:string)=>void;router:any
}){
  const p=post.profiles,name=p?.full_name||p?.username||"Seller"
  const tags=parseTags(post.tags).slice(0,5)
  return(
    <article className="fc">
      <div className="fc-head" onClick={()=>router.push(`/profile/${post.user_id}`)}>
        {p?.avatar_url?<img src={p.avatar_url} alt={name} className="fc-av"/>
          :<div className="fc-av fc-av-fb">{name[0].toUpperCase()}</div>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span className="fc-seller-name">{name}</span>
            <span className="v-badge"><ShieldCheck size={9}/> Verified</span>
          </div>
          <span className="fc-meta">{p?.school?`${p.school} · `:""}{timeAgo(post.created_at)}</span>
        </div>
        {post.price!=null&&<span className="price-pill">{fmtPrice(post.price)}</span>}
      </div>
      <div className="fc-img-wrap" onClick={()=>router.push(`/post/${post.id}`)}>
        {post.image_url?<img src={post.image_url} alt={post.title} loading="lazy" className="fc-img"/>
          :<div className="fc-img-fb"><Tag size={40} color="#c7d2fe"/></div>}
      </div>
      <div className="fc-body" onClick={()=>router.push(`/post/${post.id}`)}>
        <h3 className="fc-title">{post.title}</h3>
        {post.content&&<p className="fc-desc">{post.content}</p>}
      </div>
      {tags.length>0&&<div className="tags-row">{tags.map(t=><span key={t} className="tag">#{t}</span>)}</div>}
      <div className="fc-actions">
        <button className={`act-btn${isClicked?" act-on":""}`} onClick={()=>onToggle(post.id)}>
          <MousePointerClick size={17}/> {post.clicks??0} Interested
        </button>
        <div className="act-div"/>
        <button className="act-btn" onClick={()=>router.push(`/post/${post.id}`)}>
          <MessageCircle size={17}/> {post.comments_count??0}
        </button>
        <div className="act-div"/>
        <button className="act-btn act-msg" onClick={()=>openChat(userId,post.user_id,post.id,router)}>
          <MessageSquare size={17}/> Message
        </button>
        <div className="act-div"/>
        <button className="act-btn" onClick={()=>sharePost(post)}><Share2 size={17}/></button>
      </div>
    </article>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// MINI CARD (unverified 2-col)
// ─────────────────────────────────────────────────────────────────────────────
const MiniCard=memo(function MiniCard({post,userId,isClicked,onToggle,router}:{
  post:Post|null;userId:string|null;isClicked:boolean;onToggle:(id:string)=>void;router:any
}){
  if(!post)return<div style={{flex:1}}/>
  const p=post.profiles,name=p?.full_name||p?.username||"Seller"
  return(
    <article className="mc" onClick={()=>router.push(`/post/${post.id}`)}>
      <div className="mc-img-wrap">
        {post.image_url?<img src={post.image_url} alt={post.title} loading="lazy" className="mc-img"/>
          :<div className="mc-img-fb"><Tag size={22} color="#c7d2fe"/></div>}
        {post.price!=null&&<span className="mc-price-tag">{fmtPrice(post.price)}</span>}
      </div>
      <div className="mc-body">
        <div className="mc-seller" onClick={e=>{e.stopPropagation();router.push(`/profile/${post.user_id}`)}}>
          {p?.avatar_url?<img src={p.avatar_url} alt={name} className="mc-av"/>
            :<div className="mc-av mc-av-fb">{name[0].toUpperCase()}</div>}
          <span className="mc-name">{name}</span>
        </div>
        <h3 className="mc-title">{post.title}</h3>
        <span className="mc-time">{timeAgo(post.created_at)}</span>
        <div className="mc-foot">
          <button className={`mc-btn${isClicked?" mc-btn-on":""}`}
            onClick={e=>{e.stopPropagation();onToggle(post.id)}}>
            <MousePointerClick size={12}/> {post.clicks??0}
          </button>
          <button className="mc-btn mc-btn-msg"
            onClick={e=>{e.stopPropagation();openChat(userId,post.user_id,post.id,router)}}>
            <MessageSquare size={12}/>
          </button>
        </div>
      </div>
    </article>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// GRID CARD
// ─────────────────────────────────────────────────────────────────────────────
const GridCard=memo(function GridCard({post,userId,isClicked,onToggle,router,delay}:{
  post:Post;userId:string|null;isClicked:boolean;onToggle:(id:string)=>void;router:any;delay:number
}){
  const p=post.profiles,name=p?.full_name||p?.username||"Seller",wa=waLink(p?.whatsapp_number)
  return(
    <div className="gc" style={{animationDelay:`${delay}ms`}} onClick={()=>router.push(`/post/${post.id}`)}>
      <div className="gc-img-wrap">
        {post.image_url?<img src={post.image_url} alt={post.title} loading="lazy" className="gc-img"/>
          :<div className="gc-img-fb"><Tag size={28} color="#c7d2fe"/></div>}
        {post.price!=null&&<span className="gc-price">{fmtPrice(post.price)}</span>}
        {p?.is_premium&&<span className="gc-verified"><ShieldCheck size={9}/> Verified</span>}
      </div>
      <div className="gc-body">
        <div className="gc-seller" onClick={e=>{e.stopPropagation();router.push(`/profile/${post.user_id}`)}}>
          {p?.avatar_url?<img src={p.avatar_url} alt={name} className="gc-av"/>
            :<div className="gc-av gc-av-fb">{name[0].toUpperCase()}</div>}
          <div className="gc-sinfo">
            <span className="gc-sname">{name}</span>
            {p?.school&&<span className="gc-school">{p.school}</span>}
          </div>
        </div>
        <h3 className="gc-title">{post.title}</h3>
        <div className="gc-foot">
          <button className={`gc-click${isClicked?" on":""}`}
            onClick={e=>{e.stopPropagation();onToggle(post.id)}}>
            <MousePointerClick size={13}/> {post.clicks??0}
          </button>
          {wa?<a href={`${wa}?text=Hi%2C%20I%27m%20interested%20in%20%22${encodeURIComponent(post.title)}%22`}
              target="_blank" rel="noopener noreferrer" className="gc-wa"
              onClick={e=>e.stopPropagation()}><MessageSquare size={11}/> Chat</a>
            :<span className="gc-time">{timeAgo(post.created_at)}</span>}
        </div>
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// SKELETONS
// ─────────────────────────────────────────────────────────────────────────────
function FeedSkeleton(){return(<>
  {[0,1].map(i=>(
    <div key={i} style={{background:"white",marginBottom:8,borderBottom:"8px solid #f4f6fb"}}>
      <div style={{display:"flex",gap:10,padding:"14px 16px",alignItems:"center"}}>
        <div className="skel" style={{width:42,height:42,borderRadius:"50%"}}/>
        <div style={{flex:1}}><div className="skel" style={{height:11,width:"45%",marginBottom:7}}/><div className="skel" style={{height:9,width:"28%"}}/></div>
      </div>
      <div className="skel" style={{width:"100%",height:340}}/>
      <div style={{padding:"14px 16px"}}>
        <div className="skel" style={{height:16,width:"82%",marginBottom:8}}/>
        <div className="skel" style={{height:11,width:"100%",marginBottom:5}}/>
        <div className="skel" style={{height:11,width:"62%"}}/>
      </div>
    </div>
  ))}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"0 12px 8px"}}>
    {[0,1].map(i=>(
      <div key={i} style={{background:"white",borderRadius:14,overflow:"hidden",border:"1px solid #eef2ff"}}>
        <div className="skel" style={{width:"100%",aspectRatio:"1"}}/>
        <div style={{padding:"9px 10px"}}>
          <div className="skel" style={{height:9,width:"70%",marginBottom:7}}/>
          <div className="skel" style={{height:12,width:"92%",marginBottom:5}}/>
          <div className="skel" style={{height:12,width:"52%"}}/>
        </div>
      </div>
    ))}
  </div>
</>)}

function GridSkeleton(){return(<>
  {Array.from({length:10}).map((_,i)=>(
    <div key={i} style={{background:"white",borderRadius:12,overflow:"hidden",border:"1px solid #eef2ff"}}>
      <div className="skel" style={{width:"100%",aspectRatio:"3/4"}}/>
      <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          <div className="skel" style={{width:26,height:26,borderRadius:"50%"}}/>
          <div style={{flex:1}}><div className="skel" style={{height:9,width:"62%",marginBottom:5}}/><div className="skel" style={{height:7,width:"44%"}}/></div>
        </div>
        <div className="skel" style={{height:11,width:"90%"}}/>
        <div className="skel" style={{height:11,width:"55%"}}/>
      </div>
    </div>
  ))}
</>)}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeClient(){
  const router=useRouter()
  const[userId,setUserId]             =useState<string|null>(null)
  const[userProfile,setUserProfile]   =useState<{username:string;avatar_url:string|null}|null>(null)
  const[posts,setPosts]               =useState<Post[]>([])
  const[loading,setLoading]           =useState(true)
  const[loadingMore,setLoadingMore]   =useState(false)
  const[hasMore,setHasMore]           =useState(true)
  const[page,setPage]                 =useState(0)
  const[error,setError]               =useState<string|null>(null)
  const[clickedIds,setClickedIds]     =useState<Set<string>>(new Set())
  const[search,setSearch]             =useState("")
  const[debSearch,setDebSearch]       =useState("")
  const[activeCategory,setActiveCategory]=useState("All")
  const[schoolFilter,setSchoolFilter] =useState("All")
  const[tagFilter,setTagFilter]       =useState("")
  const[showFilters,setShowFilters]   =useState(false)
  const[schools,setSchools]           =useState<string[]>([])
  const[viewMode,setViewMode]         =useState<ViewMode>("feed")
  const[showDonation,setShowDonation] =useState(false)
  const[totalUnread,setTotalUnread]   =useState(0)
  const catScrollRef=useRef<HTMLDivElement>(null)

  // Debounce
  useEffect(()=>{const t=setTimeout(()=>setDebSearch(search),380);return()=>clearTimeout(t)},[search])

  // Auth + donation (once per login) + unread count
  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(session?.user){
        const uid=session.user.id
        setUserId(uid)
        const{data}=await supabase.from("profiles").select("username,avatar_url").eq("id",uid).single()
        setUserProfile(data)
        fetchUnread(uid)
      }
    })
    // Donation only fires on actual SIGNED_IN event, never on reload
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_ev,session)=>{
      if(_ev==="SIGNED_IN"&&session?.user){
        const uid=session.user.id
        setUserId(uid)
        supabase.from("profiles").select("username,avatar_url").eq("id",uid).single()
          .then(({data})=>setUserProfile(data))
        fetchUnread(uid)
        if(!sessionStorage.getItem("donation_shown")){
          setTimeout(()=>{
            setShowDonation(true)
            sessionStorage.setItem("donation_shown","1")
          },2500)
        }
      }
      if(_ev==="SIGNED_OUT"){
        setUserId(null);setTotalUnread(0)
        sessionStorage.removeItem("donation_shown")
      }
    })
    return()=>subscription.unsubscribe()
  },[])

  const fetchUnread=async(uid:string)=>{
    const{data}=await supabase.from("conversations")
      .select("buyer_id,buyer_unread,seller_unread")
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
    if(!data)return
    const total=data.reduce((sum:number,c:any)=>
      sum+(c.buyer_id===uid?c.buyer_unread??0:c.seller_unread??0),0)
    setTotalUnread(total)
  }

  // Live unread count
  useEffect(()=>{
    if(!userId)return
    const ch=supabase.channel("home-unread")
      .on("postgres_changes",{event:"*",schema:"public",table:"conversations",
        filter:`buyer_id=eq.${userId}`},()=>fetchUnread(userId))
      .on("postgres_changes",{event:"*",schema:"public",table:"conversations",
        filter:`seller_id=eq.${userId}`},()=>fetchUnread(userId))
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},
        ()=>fetchUnread(userId))
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[userId])

  // Schools
  useEffect(()=>{
    supabase.from("profiles").select("school").not("school","is",null).then(({data})=>{
      const u=[...new Set((data??[]).map((r:any)=>r.school).filter(Boolean))]as string[]
      setSchools(u.sort())
    })
  },[])

  const fetchPosts=useCallback(async(pageNum:number,replace:boolean)=>{
    pageNum===0?setLoading(true):setLoadingMore(true);setError(null)
    try{
      const now=new Date().toISOString()
      let q=supabase.from("postings")
        .select("id,user_id,title,content,image_url,created_at,clicks,comments_count,price,expires_at,category,tags")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at",{ascending:false})
        .range(pageNum*PAGE_SIZE,(pageNum+1)*PAGE_SIZE-1)
      if(debSearch)q=q.or(`title.ilike.%${debSearch}%,content.ilike.%${debSearch}%`)
      if(activeCategory!=="All")q=q.eq("category",activeCategory)
      if(tagFilter.trim())q=q.contains("tags",[tagFilter.trim().toLowerCase()])
      const{data:postData,error:err}=await q
      if(err)throw err
      const results=(postData??[])as Post[]
      if(!results.length){setHasMore(false);if(replace)setPosts([]);return}
      const uids=[...new Set(results.map(p=>p.user_id))]
      const{data:profData}=await supabase.from("profiles")
        .select("id,username,full_name,avatar_url,school,is_premium,whatsapp_number").in("id",uids)
      const pm=Object.fromEntries((profData??[]).map((p:any)=>[p.id,p]))
      let merged=results.map(p=>({...p,profiles:pm[p.user_id]??null}))
      if(schoolFilter!=="All")merged=merged.filter(p=>p.profiles?.school===schoolFilter)
      const sorted=[...merged].sort((a,b)=>scorePost(b)-scorePost(a))
      setHasMore(results.length===PAGE_SIZE)
      setPosts(prev=>replace?sorted:[...prev,...sorted])
    }catch(e:any){setError(e.message||"Failed to load posts.")}
    finally{setLoading(false);setLoadingMore(false)}
  },[debSearch,activeCategory,schoolFilter,tagFilter])

  useEffect(()=>{setPage(0);fetchPosts(0,true)},[fetchPosts])
  const loadMore=()=>{const n=page+1;setPage(n);fetchPosts(n,false)}

  const toggleClick=useCallback(async(postId:string)=>{
    if(!userId){router.push("/login");return}
    const was=clickedIds.has(postId)
    setClickedIds(prev=>{const n=new Set(prev);was?n.delete(postId):n.add(postId);return n})
    setPosts(prev=>prev.map(p=>p.id===postId?{...p,clicks:Math.max(0,(p.clicks??0)+(was?-1:1))}:p))
    const{data:cur}=await supabase.from("postings").select("clicks").eq("id",postId).single()
    if(cur){
      const nc=Math.max(0,(cur.clicks??0)+(was?-1:1))
      await supabase.from("postings").update({clicks:nc}).eq("id",postId)
      setPosts(prev=>prev.map(p=>p.id===postId?{...p,clicks:nc}:p))
    }
  },[userId,clickedIds])

  const rows=useMemo(()=>buildRows(posts),[posts])
  const activeFilters=[schoolFilter!=="All",!!tagFilter.trim()].filter(Boolean).length

  return(
  <>
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#f4f6fb;font-family:'DM Sans',system-ui,sans-serif}
    input,select,button,a{font-family:inherit}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes shimmer{0%{background-position:-700px 0}100%{background-position:700px 0}}
    @keyframes pop{0%,100%{transform:scale(1)}40%{transform:scale(1.45)}70%{transform:scale(0.88)}}
    @keyframes hbeat{0%,100%{transform:scale(1)}20%,60%{transform:scale(1.18)}40%,80%{transform:scale(0.95)}}
    @keyframes floatIn{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
    @keyframes modalIn{from{opacity:0;transform:scale(0.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}

    /* NAV */
    .nav{background:linear-gradient(135deg,#0f1f6e 0%,#162380 55%,#1a2a9a 100%);
      box-shadow:0 4px 30px rgba(13,29,110,0.4);position:sticky;top:0;z-index:100}
    .nav-inner{max-width:1280px;margin:0 auto;padding:0 14px;display:flex;align-items:center;gap:10px;height:60px}
    .logo{width:52px;height:52px;object-fit:contain;flex-shrink:0}
    .srch-wrap{flex:1;max-width:500px}
    .srch{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.12);
      border:1.5px solid rgba(255,255,255,0.2);border-radius:999px;padding:9px 15px;transition:all 0.2s}
    .srch:focus-within{background:rgba(255,255,255,0.18);border-color:rgba(251,146,60,0.85);
      box-shadow:0 0 0 3px rgba(251,146,60,0.2)}
    .srch input{background:none;border:none;outline:none;color:white;font-size:0.9rem;width:100%;min-width:0}
    .srch input::placeholder{color:rgba(255,255,255,0.42)}
    .srch-x{background:rgba(255,255,255,0.15);border:none;cursor:pointer;display:flex;padding:2px;border-radius:50%;flex-shrink:0}
    .srch-x:hover{background:rgba(255,255,255,0.28)}
    .nav-right{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto}
    .btn-upload{display:inline-flex;align-items:center;gap:5px;padding:8px 15px;
      border-radius:999px;background:linear-gradient(135deg,#ea580c,#f97316);color:white;
      font-size:0.78rem;font-weight:700;text-decoration:none;border:none;cursor:pointer;
      box-shadow:0 4px 14px rgba(234,88,12,0.4);transition:all 0.2s;white-space:nowrap}
    .btn-upload:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(234,88,12,0.52);color:white}
    .btn-login{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;
      border-radius:999px;background:rgba(255,255,255,0.1);color:white;font-size:0.78rem;
      font-weight:700;text-decoration:none;border:1.5px solid rgba(255,255,255,0.25);transition:all 0.2s;white-space:nowrap}
    .btn-login:hover{background:rgba(255,255,255,0.2);color:white}
    .av-ring{width:38px;height:38px;border-radius:50%;border:2.5px solid #f97316;
      overflow:hidden;cursor:pointer;text-decoration:none;display:flex;align-items:center;
      justify-content:center;background:linear-gradient(135deg,#f97316,#ea580c);
      color:white;font-weight:700;font-size:0.88rem;transition:transform 0.2s}
    .av-ring:hover{transform:scale(1.08)}
    .av-ring img{width:100%;height:100%;object-fit:cover}
    .verify-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;
      border-radius:999px;background:rgba(255,255,255,0.1);border:1.5px solid rgba(99,102,241,0.5);
      color:rgba(255,255,255,0.9);font-size:0.75rem;font-weight:700;cursor:pointer;
      transition:all 0.2s;white-space:nowrap;text-decoration:none}
    .verify-btn:hover{background:rgba(99,102,241,0.3);border-color:#818cf8;color:white}
    @media(max-width:480px){
      .upload-label{display:none}.btn-upload{padding:8px 10px}
      .logo{width:42px;height:42px}.verify-label{display:none}
    }

    /* BANNER — fluid on mobile, fixed height on desktop */
    .banner-root{width:100%;height:56vw;min-height:180px;max-height:300px;
      position:relative;overflow:hidden;background:#0f1f6e}
    @media(min-width:900px){.banner-root{height:360px;max-height:360px}}
    @media(min-width:1280px){.banner-root{height:420px;max-height:420px}}
    .banner-img{position:absolute;inset:0;width:100%;height:100%;
      object-fit:cover;object-position:center center}
    .banner-fade-bot{position:absolute;bottom:0;left:0;right:0;height:50%;
      background:linear-gradient(transparent,rgba(255, 255, 255, 0.65));z-index:1}
    .banner-bottom{position:absolute;bottom:0;left:0;right:0;z-index:2;
      padding:14px 18px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px}
    .banner-cta{display:inline-flex;align-items:center;gap:7px;background:#16a34a;color:white;
      padding:8px 18px;border-radius:999px;font-size:0.8rem;font-weight:800;
      text-decoration:none;box-shadow:0 4px 14px rgba(22,163,74,0.5);transition:all 0.2s;white-space:nowrap}
    .banner-cta:hover{transform:translateY(-1px);color:white}
    .banner-dots{display:flex;gap:5px;align-items:center;padding-bottom:2px;flex-shrink:0}

    /* CATEGORY STRIP */
    .cat-bar{background:white;border-bottom:1px solid #e8ecf4;position:sticky;top:60px;z-index:90}
    .cat-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;overflow:hidden}
    .cat-scroll{display:flex;gap:6px;overflow-x:auto;padding:9px 14px;scrollbar-width:none;flex:1;min-width:0}
    .cat-scroll::-webkit-scrollbar{display:none}
    .chip{padding:7px 14px;border-radius:999px;border:1.5px solid #e2e8f0;background:#f8fafc;
      color:#64748b;font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap;
      transition:all 0.15s;flex-shrink:0}
    .chip:hover{background:#eef2ff;color:#0f1f6e;border-color:#c7d2fe}
    .chip.active{background:#0f1f6e;color:white;border-color:#0f1f6e}

    /* FILTER BAR */
    .fbar{background:white;border-bottom:1px solid #e8ecf4;position:sticky;top:calc(60px + 41px);z-index:80}
    .fbar-inner{max-width:1280px;margin:0 auto;padding:10px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .fbar-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;
      border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:0.8rem;font-weight:600;
      cursor:pointer;transition:all 0.15s;white-space:nowrap}
    .fbar-btn.on{border-color:#f97316;background:#fff7ed;color:#ea580c}
    .fbar-btn:hover:not(.on){border-color:#c7d2fe;color:#0f1f6e;background:#eef2ff}
    .view-tog{display:inline-flex;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;flex-shrink:0}
    .vt-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border:none;
      background:#f8fafc;color:#94a3b8;font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.15s;white-space:nowrap}
    .vt-btn.on{background:linear-gradient(135deg,#0f1f6e,#1a2a9a);color:white}
    .vt-btn:not(.on):hover{background:#eef2ff;color:#0f1f6e}
    .sugg-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;
      border:1.5px solid #c7d2fe;background:linear-gradient(135deg,#eef2ff,#e0e7ff);color:#0f1f6e;
      font-size:0.8rem;font-weight:700;cursor:pointer;transition:all 0.15s;white-space:nowrap;margin-left:auto}
    .sugg-btn:hover{background:linear-gradient(135deg,#0f1f6e,#1a2a9a);color:white;border-color:#0f1f6e}
    .f-badge{background:#f97316;color:white;border-radius:999px;padding:1px 6px;font-size:0.65rem;font-weight:800}

    /* FILTER PANEL */
    .fpanel{border-top:1px solid #f1f5f9;padding:14px 0;background:white}
    .fpanel-inner{max-width:1280px;margin:0 auto;padding:0 14px;
      display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
    .flabel{display:block;font-size:0.67rem;font-weight:700;color:#0f1f6e;
      letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px}
    .fselect,.finput{width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;
      border-radius:10px;color:#1e293b;background:#f8fafc;outline:none;font-size:0.88rem}
    .fselect:focus,.finput:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,0.1)}

    /* FEED */
    .feed-wrap{max-width:680px;margin:0 auto;padding-bottom:120px}

    /* FULL CARD */
    .fc{background:white;margin:0 0 8px;border-bottom:8px solid #f4f6fb;animation:fadeUp 0.3s ease both}
    .fc-head{display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer;transition:background 0.12s}
    .fc-head:hover{background:#fafbff}
    .fc-av{width:44px;height:44px;border-radius:22px;object-fit:cover;border:2px solid #e2e8f0;flex-shrink:0}
    .fc-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);display:flex;align-items:center;justify-content:center;color:white;font-weight:700}
    .fc-seller-name{font-size:0.94rem;font-weight:700;color:#0f1f6e}
    .fc-meta{font-size:0.72rem;color:#94a3b8;margin-top:2px;display:block}
    .v-badge{display:inline-flex;align-items:center;gap:3px;background:#eef2ff;color:#0f1f6e;
      padding:2px 7px;border-radius:999px;font-size:0.6rem;font-weight:800;white-space:nowrap}
    .price-pill{background:linear-gradient(135deg,#ea580c,#f97316);color:white;
      padding:5px 14px;border-radius:999px;font-size:0.84rem;font-weight:800;flex-shrink:0;white-space:nowrap}
    .fc-img-wrap{cursor:pointer;overflow:hidden;position:relative;background:#eef2ff}
    .fc-img{width:100%;max-height:540px;object-fit:cover;display:block;transition:transform 0.45s}
    .fc-img-wrap:hover .fc-img{transform:scale(1.025)}
    .fc-img-fb{display:flex;align-items:center;justify-content:center;height:240px;background:linear-gradient(135deg,#eef2ff,#e0e7ff)}
    .fc-body{padding:14px 16px 6px;cursor:pointer}
    .fc-title{font-family:'Playfair Display',serif;font-size:1.08rem;font-weight:800;color:#0f172a;line-height:1.42;margin-bottom:6px}
    .fc-desc{font-size:0.87rem;color:#64748b;line-height:1.65;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .tags-row{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px}
    .tag{background:#eef2ff;color:#4338ca;padding:3px 10px;border-radius:999px;font-size:0.7rem;font-weight:600}
    .fc-actions{display:flex;align-items:stretch;border-top:1px solid #f1f5f9}
    .act-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;
      padding:13px 6px;background:none;border:none;cursor:pointer;font-size:0.8rem;font-weight:700;
      color:#64748b;transition:all 0.15s;min-width:0}
    .act-btn:hover{background:#f8fafc;color:#0f1f6e}
    .act-btn.act-on{color:#0f1f6e;background:#eef2ff}
    .act-btn.act-on svg{animation:pop 0.35s ease}
    .act-btn.act-msg{color:#0f1f6e}.act-btn.act-msg:hover{background:#eef2ff}
    .act-div{width:1px;background:#f1f5f9;flex-shrink:0}

    /* MINI CARD */
    .pair-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 12px 8px}
    .mc{background:white;border-radius:14px;border:1px solid #e8ecf4;overflow:hidden;
      cursor:pointer;transition:all 0.22s;animation:fadeUp 0.3s ease both}
    .mc:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(13,29,110,0.13)}
    .mc-img-wrap{position:relative;width:100%;aspect-ratio:1;overflow:hidden;background:linear-gradient(135deg,#eef2ff,#e0e7ff)}
    .mc-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.4s}
    .mc:hover .mc-img{transform:scale(1.06)}
    .mc-img-fb{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
    .mc-price-tag{position:absolute;bottom:7px;left:7px;background:linear-gradient(135deg,#ea580c,#f97316);
      color:white;padding:3px 9px;border-radius:999px;font-size:0.68rem;font-weight:800}
    .mc-body{padding:9px 10px 10px}
    .mc-seller{display:flex;align-items:center;gap:5px;margin-bottom:5px;cursor:pointer}
    .mc-av{width:20px;height:20px;border-radius:10px;object-fit:cover;flex-shrink:0}
    .mc-av-fb{background:linear-gradient(135deg,#0f1f6e,#4338ca);display:flex;align-items:center;justify-content:center;color:white;font-size:0.52rem;font-weight:700}
    .mc-name{font-size:0.68rem;font-weight:600;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .mc-title{font-size:0.82rem;font-weight:800;color:#0f172a;line-height:1.35;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:3px}
    .mc-time{font-size:0.64rem;color:#94a3b8;display:block;margin-bottom:7px}
    .mc-foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:7px}
    .mc-btn{display:flex;align-items:center;gap:3px;background:none;border:none;cursor:pointer;
      font-size:0.68rem;font-weight:700;color:#94a3b8;padding:4px 6px;border-radius:7px;transition:all 0.12s}
    .mc-btn:hover{background:#eef2ff;color:#0f1f6e}
    .mc-btn-on{background:#eef2ff;color:#0f1f6e}
    .mc-btn-on svg{animation:pop 0.35s ease}
    .mc-btn-msg{color:#0f1f6e}

    /* GRID */
    .grid-wrap{max-width:1280px;margin:0 auto;padding:20px 14px 120px}
    .grid-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}
    .pgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    @media(min-width:640px){.pgrid{grid-template-columns:repeat(3,1fr);gap:14px}}
    @media(min-width:960px){.pgrid{grid-template-columns:repeat(4,1fr);gap:16px}}
    @media(min-width:1200px){.pgrid{grid-template-columns:repeat(5,1fr);gap:18px}}
    .gc{background:white;border-radius:12px;overflow:hidden;border:1px solid #eef2ff;
      cursor:pointer;display:flex;flex-direction:column;box-shadow:0 1px 10px rgba(13,29,110,0.06);
      transition:all 0.22s;animation:fadeUp 0.3s ease both}
    .gc:hover{transform:translateY(-4px);box-shadow:0 14px 42px rgba(13,29,110,0.15);border-color:#c7d2fe}
    .gc-img-wrap{position:relative;aspect-ratio:3/4;overflow:hidden;background:linear-gradient(135deg,#eef2ff,#e0e7ff);flex-shrink:0}
    .gc-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.4s}
    .gc:hover .gc-img{transform:scale(1.06)}
    .gc-img-fb{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
    .gc-price{position:absolute;bottom:8px;left:8px;background:linear-gradient(135deg,#ea580c,#f97316);
      color:white;padding:4px 10px;border-radius:999px;font-size:0.7rem;font-weight:700;box-shadow:0 2px 8px rgba(234,88,12,0.4)}
    .gc-verified{position:absolute;top:8px;right:8px;background:rgba(15,31,110,0.85);
      backdrop-filter:blur(4px);color:white;padding:3px 8px;border-radius:999px;
      font-size:0.6rem;font-weight:700;display:flex;align-items:center;gap:3px}
    .gc-body{padding:10px 11px 12px;display:flex;flex-direction:column;gap:7px;flex:1}
    .gc-seller{display:flex;align-items:center;gap:6px;cursor:pointer}
    .gc-av{width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid #e2e8f0}
    .gc-av-fb{background:linear-gradient(135deg,#0f1f6e,#f97316);display:flex;align-items:center;justify-content:center;color:white;font-size:0.6rem;font-weight:700}
    .gc-sinfo{flex:1;min-width:0}
    .gc-sname{font-size:0.72rem;font-weight:700;color:#0f1f6e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
    .gc-school{font-size:0.62rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
    .gc-title{font-family:'Playfair Display',serif;font-size:clamp(0.76rem,1.8vw,0.9rem);
      font-weight:700;color:#0f172a;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .gc-foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:8px;margin-top:auto}
    .gc-click{display:inline-flex;align-items:center;gap:4px;background:none;border:none;
      cursor:pointer;padding:4px 8px;border-radius:8px;font-size:0.74rem;font-weight:700;color:#94a3b8;transition:all 0.15s}
    .gc-click:hover,.gc-click.on{background:#eef2ff;color:#0f1f6e}
    .gc-click.on svg{animation:pop 0.35s ease}
    .gc-wa{display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#25D366,#128C7E);
      color:white;padding:5px 11px;border-radius:999px;font-size:0.7rem;font-weight:700;
      text-decoration:none;transition:all 0.2s;box-shadow:0 2px 8px rgba(37,211,102,0.3)}
    .gc-wa:hover{transform:translateY(-1px);color:white}
    .gc-time{font-size:0.68rem;color:#cbd5e1}

    /* SKELETON */
    .skel{background:linear-gradient(90deg,#f1f5f9 25%,#e8edf5 50%,#f1f5f9 75%);
      background-size:700px 100%;animation:shimmer 1.3s infinite;border-radius:8px}

    /* EMPTY / ERROR */
    .empty{text-align:center;padding:72px 24px}
    .err-bar{display:flex;align-items:center;gap:10px;padding:13px 16px;
      background:#fff1f0;border:1.5px solid #fca5a5;border-radius:12px;margin:12px 16px}

    /* LOAD MORE */
    .load-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 30px;background:white;
      color:#0f1f6e;border:2px solid #c7d2fe;border-radius:999px;font-weight:700;font-size:0.88rem;
      cursor:pointer;box-shadow:0 4px 16px rgba(13,29,110,0.08);transition:all 0.2s}
    .load-btn:hover:not(:disabled){border-color:#0f1f6e;box-shadow:0 6px 26px rgba(13,29,110,0.16)}
    .load-btn:disabled{opacity:0.55;cursor:not-allowed}

    /* FLOATING CLUSTER */
    .float-cluster{position:fixed;right:16px;bottom:24px;z-index:200;
      display:flex;flex-direction:column;align-items:flex-end;gap:10px}
    .float-btn{width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 6px 20px rgba(0,0,0,0.22);transition:all 0.22s;
      animation:floatIn 0.5s ease both;position:relative;text-decoration:none}
    .float-btn:hover{transform:translateY(-3px) scale(1.08)}
    .float-lbl{position:absolute;right:60px;background:rgba(15,23,42,0.9);
      backdrop-filter:blur(8px);color:white;padding:5px 12px;border-radius:8px;
      font-size:0.72rem;font-weight:700;white-space:nowrap;pointer-events:none;
      opacity:0;transition:opacity 0.18s}
    .float-btn:hover .float-lbl{opacity:1}
    .fb-donate{background:linear-gradient(135deg,#ef4444,#dc2626)}
    .fb-donate svg{animation:hbeat 1.4s ease infinite}
    .fb-wa{background:linear-gradient(135deg,#25D366,#128C7E)}
    .fb-social{background:linear-gradient(135deg,#6366f1,#4f46e5)}
    .fb-inbox{background:linear-gradient(135deg,#0f1f6e,#1a2a9a)}
    .fb-unread-badge{position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;
      border-radius:999px;min-width:18px;height:18px;padding:0 5px;
      font-size:0.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;
      border:2px solid white;font-family:'DM Sans',sans-serif;pointer-events:none}
    @media(min-width:1024px){.float-cluster{right:28px;bottom:36px}}
    @media(max-width:400px){.float-btn{width:46px;height:46px}}

    /* DONATION MODAL */
    .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.58);
      backdrop-filter:blur(6px);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px}
    .modal-box{background:white;border-radius:24px;padding:28px 24px 24px;max-width:420px;
      width:100%;position:relative;animation:modalIn 0.35s ease;box-shadow:0 24px 80px rgba(0,0,0,0.35)}
    .modal-close{position:absolute;top:14px;right:14px;background:#f1f5f9;border:none;
      border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;
      justify-content:center;color:#64748b;transition:all 0.15s}
    .modal-close:hover{background:#e2e8f0;color:#0f172a}
    .modal-icon{display:flex;align-items:center;justify-content:center;
      width:64px;height:64px;border-radius:50%;background:#fff1f2;margin:0 auto 16px}
    .modal-icon svg{animation:hbeat 1.2s ease infinite}
    .modal-title{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:800;
      color:#0f172a;text-align:center;margin-bottom:10px}
    .modal-sub{font-size:0.88rem;color:#64748b;text-align:center;line-height:1.6;margin-bottom:18px}
    .modal-callout{background:linear-gradient(135deg,#eef2ff,#e0e7ff);border:1.5px solid #c7d2fe;
      border-radius:14px;padding:14px 16px;margin-bottom:18px;text-align:center}
    .modal-actions{display:flex;flex-direction:column;gap:10px}
    .amount-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:18px}
    .amount-btn{padding:8px 16px;border:1.5px solid #e2e8f0;border-radius:999px;background:#f8fafc;
      font-size:0.88rem;font-weight:700;color:#0f1f6e;cursor:pointer;font-family:'DM Sans',sans-serif;
      transition:all 0.15s}
    .amount-btn-on{background:#0f1f6e;border-color:#0f1f6e;color:white}
    .paystack-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;
      background:linear-gradient(135deg,#0f1f6e,#1a2a9a);color:white;border:none;border-radius:14px;
      font-size:0.92rem;font-weight:800;cursor:pointer;width:100%;
      box-shadow:0 4px 16px rgba(13,29,110,0.35);transition:all 0.15s;font-family:'DM Sans',sans-serif}
    .paystack-btn:disabled{opacity:0.65;cursor:not-allowed}
    .modal-skip{background:none;border:none;color:#94a3b8;font-size:0.82rem;font-weight:600;
      cursor:pointer;padding:8px;text-align:center;transition:color 0.15s}
    .modal-skip:hover{color:#64748b}

    /* FOOTER */
    .footer{background:linear-gradient(135deg,#0a1550 0%,#0f1f6e 60%,#1a1a1a 100%);padding:36px 20px 28px}
    .footer-inner{max-width:1280px;margin:0 auto}
    .lytrix-card{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;padding:20px 24px;display:flex;align-items:center;
      justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:24px}
    .lytrix-wa{display:inline-flex;align-items:center;gap:7px;padding:9px 20px;
      background:linear-gradient(135deg,#25D366,#128C7E);color:white;border-radius:999px;
      font-size:0.82rem;font-weight:700;text-decoration:none;transition:all 0.2s;
      box-shadow:0 4px 14px rgba(37,211,102,0.32);white-space:nowrap}
    .lytrix-wa:hover{transform:translateY(-1px);color:white}

    @media(max-width:640px){
      .fc{margin:0 0 6px}
      .pair-row{margin:0 8px 6px;gap:6px}
      .fc-actions .act-btn{font-size:0;gap:0;padding:13px}
      .act-btn>svg{flex-shrink:0}
      .act-btn.act-msg{font-size:0.8rem;gap:6px}
    }
  `}</style>

  {/* DONATION MODAL */}
  {showDonation&&<DonationModal onClose={()=>setShowDonation(false)} userEmail={userProfile?.username||null}/>}
      <script src="https://js.paystack.co/v1/inline.js" async={true}/>

  {/* NAV */}
  <header className="nav">
    <div className="nav-inner">
      <a href="/" style={{textDecoration:"none",flexShrink:0}}>
        <img src="/Unimart.png" alt="UniMart" className="logo"/>
      </a>
      <div className="srch-wrap">
        <div className="srch">
          <Search size={14} color="rgba(255,255,255,0.48)" style={{flexShrink:0}}/>
          <input placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)}/>
          {search&&<button className="srch-x" onClick={()=>setSearch("")}><X size={12} color="rgba(255,255,255,0.6)"/></button>}
        </div>
      </div>
      <div className="nav-right">
        {userId&&userProfile?(
          <>
            <a href="/upload" className="btn-upload">
              <Upload size={14}/><span className="upload-label">Upload</span>
            </a>
            {/* Verification replaces logout */}
            <a href="/verify" className="verify-btn">
              <BadgeCheck size={14}/><span className="verify-label">Get Verified</span>
            </a>
            <a href="/profile" className="av-ring">
              {userProfile.avatar_url
                ?<img src={userProfile.avatar_url} alt={userProfile.username}/>
                :userProfile.username?.slice(0,1).toUpperCase()}
            </a>
          </>
        ):(
          <a href="/login" className="btn-login"><User size={14}/> Login</a>
        )}
      </div>
    </div>
  </header>

  {/* RENTAL BANNER */}
  <RentalBanner/>

  {/* CATEGORY STRIP */}
  <div className="cat-bar">
    <div className="cat-inner">
      <div className="cat-scroll" ref={catScrollRef}>
        {CATEGORIES.map(cat=>(
          <button key={cat} className={`chip${activeCategory===cat?" active":""}`}
            onClick={()=>{setActiveCategory(cat);setPage(0)}}>{cat}</button>
        ))}
      </div>
    </div>
  </div>

  {/* FILTER BAR */}
  <div className="fbar">
    <div className="fbar-inner">
      <button className={`fbar-btn${showFilters||activeFilters>0?" on":""}`}
        onClick={()=>setShowFilters(v=>!v)}>
        <SlidersHorizontal size={14}/>Filters
        {activeFilters>0&&<span className="f-badge">{activeFilters}</span>}
      </button>
      {activeFilters>0&&(
        <button className="fbar-btn" style={{color:"#ef4444",borderColor:"#fca5a5"}}
          onClick={()=>{setSchoolFilter("All");setTagFilter("")}}>
          <X size={13}/> Clear
        </button>
      )}
      <div className="view-tog">
        <button className={`vt-btn${viewMode==="feed"?" on":""}`} onClick={()=>setViewMode("feed")} title="Feed"><Rows3 size={15}/></button>
        <button className={`vt-btn${viewMode==="grid"?" on":""}`} onClick={()=>setViewMode("grid")} title="Grid"><LayoutGrid size={15}/></button>
      </div>
      <button className="sugg-btn" onClick={()=>router.push("/suggestions")}>
        <Lightbulb size={14}/> Suggest
      </button>
    </div>
    {showFilters&&(
      <div className="fpanel">
        <div className="fpanel-inner">
          <div>
            <label className="flabel">School</label>
            <select className="fselect" value={schoolFilter} onChange={e=>setSchoolFilter(e.target.value)}>
              <option value="All">All Schools</option>
              {schools.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="flabel">Tag</label>
            <input className="finput" placeholder="e.g. apple, textbook…"
              value={tagFilter} onChange={e=>setTagFilter(e.target.value)}/>
          </div>
        </div>
      </div>
    )}
  </div>

  {/* ERROR */}
  {error&&(
    <div className="err-bar">
      <AlertCircle size={15} color="#dc2626" style={{flexShrink:0}}/>
      <span style={{fontSize:"0.85rem",color:"#dc2626",flex:1}}>{error}</span>
      <button onClick={()=>fetchPosts(0,true)}
        style={{display:"flex",alignItems:"center",gap:4,fontSize:"0.78rem",fontWeight:700,
          color:"#dc2626",background:"none",border:"none",cursor:"pointer"}}>
        <RefreshCw size={13}/> Retry
      </button>
    </div>
  )}

  {/* FEED VIEW */}
  {viewMode==="feed"&&(
    <main>
      <div className="feed-wrap">
        {loading&&<FeedSkeleton/>}
        {!loading&&rows.map(row=>{
          if(row.type==="single")return(
            <FullCard key={row.key} post={row.post} userId={userId}
              isClicked={clickedIds.has(row.post.id)} onToggle={toggleClick} router={router}/>
          )
          return(
            <div key={row.key} className="pair-row">
              <MiniCard post={row.posts[0]} userId={userId}
                isClicked={clickedIds.has(row.posts[0]?.id??"")} onToggle={toggleClick} router={router}/>
              <MiniCard post={row.posts[1]} userId={userId}
                isClicked={clickedIds.has(row.posts[1]?.id??"")} onToggle={toggleClick} router={router}/>
            </div>
          )
        })}
        {!loading&&posts.length===0&&!error&&(
          <div className="empty">
            <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#eef2ff,#e0e7ff)",
              display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}>
              <Tag size={32} color="#818cf8"/>
            </div>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:"1.15rem",color:"#0f1f6e",marginBottom:8}}>
              {debSearch?`No results for "${debSearch}"`:"No listings yet"}
            </h3>
            <p style={{color:"#94a3b8",fontSize:"0.88rem",lineHeight:1.6}}>
              {activeCategory!=="All"?`No ${activeCategory} listings`:"Be the first to post!"}
            </p>
          </div>
        )}
        {!loading&&hasMore&&posts.length>0&&(
          <div style={{textAlign:"center",padding:"28px 16px"}}>
            <button className="load-btn" onClick={loadMore} disabled={loadingMore}>
              {loadingMore?<><Loader2 size={16} style={{animation:"spin 0.8s linear infinite"}}/> Loading…</>
                :<><ChevronDown size={16}/> Load More</>}
            </button>
          </div>
        )}
      </div>
    </main>
  )}

  {/* GRID VIEW */}
  {viewMode==="grid"&&(
    <main className="grid-wrap">
      <div className="grid-head">
        <div>
          <h2 style={{fontFamily:"'Playfair Display',serif",color:"#0f1f6e",fontWeight:700,
            fontSize:"clamp(1.1rem,3vw,1.5rem)",marginBottom:6}}>
            {activeCategory==="All"?"All Listings":activeCategory}
          </h2>
          <div style={{height:3,width:72,background:"linear-gradient(90deg,#0f1f6e,#f97316)",borderRadius:2}}/>
        </div>
        {!loading&&<span style={{fontSize:"0.82rem",color:"#94a3b8"}}>{posts.length} item{posts.length!==1?"s":""}</span>}
      </div>
      <div className="pgrid">
        {loading&&<GridSkeleton/>}
        {!loading&&posts.map((post,i)=>(
          <GridCard key={post.id} post={post} userId={userId}
            isClicked={clickedIds.has(post.id)} onToggle={toggleClick}
            router={router} delay={(i%PAGE_SIZE)*28}/>
        ))}
        {!loading&&posts.length===0&&!error&&(
          <div className="empty" style={{gridColumn:"1/-1"}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#eef2ff,#e0e7ff)",
              display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}>
              <Tag size={32} color="#818cf8"/>
            </div>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:"1.15rem",color:"#0f1f6e",marginBottom:8}}>No listings found</h3>
            <p style={{color:"#94a3b8",fontSize:"0.85rem",lineHeight:1.6}}>
              {search?`No results for "${search}"`:"Be the first to post something!"}
            </p>
          </div>
        )}
      </div>
      {!loading&&hasMore&&posts.length>0&&(
        <div style={{textAlign:"center",marginTop:36}}>
          <button className="load-btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore?<><Loader2 size={16} style={{animation:"spin 0.8s linear infinite"}}/> Loading…</>
              :<><ChevronDown size={16}/> Load More</>}
          </button>
        </div>
      )}
    </main>
  )}

  {/* FOOTER */}
  <footer className="footer">
    <div className="footer-inner">
      <div className="lytrix-card">
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:48,height:48,borderRadius:14,background:"white",display:"flex",
            alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
            <img src="../ELIA LOGO.png" alt="Lytrix" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
          </div>
          <div>
            <p style={{color:"rgba(255,255,255,0.5)",fontSize:"0.65rem",fontWeight:700,
              letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>Built & Powered by</p>
            <p style={{color:"white",fontSize:"1rem",fontWeight:800,fontFamily:"'Playfair Display',serif",lineHeight:1.1}}>LYTRIX CONSULT</p>
            <p style={{color:"rgba(255,255,255,0.45)",fontSize:"0.72rem",marginTop:2}}>Web · Apps · Digital Solutions</p>
          </div>
        </div>
        <a href="https://wa.me/233207779304?text=Hi%20Lytrix%20Consult%2C%20I%27m%20interested%20in%20your%20services!"
          target="_blank" rel="noopener noreferrer" className="lytrix-wa">
          <MessageSquare size={15}/> WhatsApp Us
        </a>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"0.8rem"}}>
          © {new Date().getFullYear()} UniMart. All rights reserved.
        </p>
        <p style={{color:"rgba(255,255,255,0.25)",fontSize:"0.72rem"}}>Powered by Lytrix Consult · 0207779304</p>
      </div>
    </div>
  </footer>

  {/* FLOATING BUTTONS */}
  <div className="float-cluster">
    {/* Donate — always visible, heartbeat animation */}
    <button className="float-btn fb-donate" onClick={()=>setShowDonation(true)}
      aria-label="Support UniMart" style={{animationDelay:"0ms"}}>
      <span className="float-lbl">Support Us ❤️</span>
      <Heart size={22} color="white" fill="white"/>
    </button>

    {/* WhatsApp Channel */}
    <a href={WA_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
      className="float-btn fb-wa" aria-label="Join WhatsApp Channel" style={{animationDelay:"80ms"}}>
      <span className="float-lbl">Join Channel</span>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </a>

    {/* Inbox */}
    <a href={INBOX_URL} className="float-btn fb-inbox" aria-label="Inbox" style={{animationDelay:"160ms",position:"relative"}}>
      <span className="float-lbl">Inbox</span>
      <Inbox size={22} color="white"/>
      {totalUnread>0&&(
        <span className="fb-unread-badge">{totalUnread>99?"99+":totalUnread}</span>
      )}
    </a>

    {/* Social Feed */}
    <a href={SOCIAL_URL} className="float-btn fb-social" aria-label="Social Feed" style={{animationDelay:"240ms"}}>
      <span className="float-lbl">Social Feed</span>
      <Users size={22} color="white"/>
    </a>
  </div>
  </>
  )
}