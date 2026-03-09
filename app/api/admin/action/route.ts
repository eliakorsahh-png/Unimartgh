// app/api/admin/action/route.ts
// All dashboard data operations — authenticated via JWT cookie
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin-client"

const SECRET = process.env.ADMIN_JWT_SECRET ?? "fallback-change-me-in-env"

// ── Auth helper ──────────────────────────────────────────────────
function getAdmin(req: NextRequest): { staffId: string; name: string; role: string } | null {
  const token = req.cookies.get("admin_session")?.value
  if (!token) return null
  try {
    const [header, body, sig] = token.split(".")
    if (!header || !body || !sig) return null
    const expected = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url")
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payload = JSON.parse(Buffer.from(body, "base64url").toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload as { staffId: string; name: string; role: string }
  } catch { return null }
}

function genStaffId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let id = "STAFF-"
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

async function log(db: any, admin: any, action: string, targetType: string, targetId: string, details = {}) {
  await db.from("admin_logs").insert({
    staff_id: admin.staffId, staff_name: admin.name,
    action, target_type: targetType, target_id: String(targetId), details,
  })
}

// ── Main handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = createAdminClient()
  const { action, params = {} } = await req.json()

  try {
    switch (action) {

      // ─── OVERVIEW ──────────────────────────────────────────────
      case "getOverview": {
        const [users, posts, clicks, verified, reports, schools, recentUsers, recentPosts] =
          await Promise.all([
            db.from("profiles").select("id", { count: "exact", head: true }),
            db.from("postings").select("id", { count: "exact", head: true }).eq("is_removed", false),
            db.from("postings").select("clicks"),
            db.from("profiles").select("id", { count: "exact", head: true }).eq("is_premium", true),
            db.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
            db.from("profiles").select("school").not("school", "is", null),
            db.from("profiles").select("id,username,full_name,avatar_url,school,created_at,is_premium")
              .order("created_at", { ascending: false }).limit(6),
            db.from("postings").select("id,title,image_url,price,clicks,created_at,user_id,profiles(username,full_name)")
              .eq("is_removed", false).order("created_at", { ascending: false }).limit(6),
          ])
        const totalClicks = (clicks.data ?? []).reduce((s: number, p: any) => s + (p.clicks ?? 0), 0)
        const uniqueSchools = [...new Set((schools.data ?? []).map((r: any) => r.school).filter(Boolean))]
        return NextResponse.json({
          totals: {
            users: users.count ?? 0,
            listings: posts.count ?? 0,
            clicks: totalClicks,
            verified: verified.count ?? 0,
            reports: reports.count ?? 0,
            schools: uniqueSchools.length,
          },
          recentUsers: recentUsers.data ?? [],
          recentPosts: recentPosts.data ?? [],
        })
      }

      // ─── USERS ─────────────────────────────────────────────────
      case "getUsers": {
        const { search = "", filter = "all", page = 0 } = params
        let q = db.from("profiles")
          .select("id,username,full_name,avatar_url,school,is_premium,is_banned,ban_reason,created_at,verification_status", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(page * 25, (page + 1) * 25 - 1)
        if (search) q = q.or(`username.ilike.%${search}%,full_name.ilike.%${search}%`)
        if (filter === "verified")   q = q.eq("is_premium", true)
        if (filter === "banned")     q = q.eq("is_banned", true)
        if (filter === "pending")    q = q.eq("verification_status", "pending")
        const { data, count } = await q
        return NextResponse.json({ users: data ?? [], total: count ?? 0 })
      }

      case "banUser": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const { userId, reason = "Violated terms" } = params
        await db.from("profiles").update({ is_banned: true, ban_reason: reason, banned_at: new Date().toISOString() }).eq("id", userId)
        await log(db, admin, "BAN_USER", "user", userId, { reason })
        return NextResponse.json({ success: true })
      }

      case "unbanUser": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        await db.from("profiles").update({ is_banned: false, ban_reason: null, banned_at: null }).eq("id", params.userId)
        await log(db, admin, "UNBAN_USER", "user", params.userId)
        return NextResponse.json({ success: true })
      }

      case "verifyUser": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        await db.from("profiles").update({ is_premium: true, verification_status: "verified" }).eq("id", params.userId)
        await log(db, admin, "VERIFY_USER", "user", params.userId)
        return NextResponse.json({ success: true })
      }

      case "unverifyUser": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        await db.from("profiles").update({ is_premium: false, verification_status: "unverified" }).eq("id", params.userId)
        await log(db, admin, "UNVERIFY_USER", "user", params.userId)
        return NextResponse.json({ success: true })
      }

      case "deleteUser": {
        if (admin.role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        await db.auth.admin.deleteUser(params.userId)
        await log(db, admin, "DELETE_USER", "user", params.userId)
        return NextResponse.json({ success: true })
      }

      // ─── LISTINGS ──────────────────────────────────────────────
      case "getListings": {
        const { search = "", filter = "all", category = "all", page = 0 } = params
        let q = db.from("postings")
          .select("id,title,image_url,price,clicks,category,created_at,expires_at,is_removed,removed_reason,user_id,profiles(username,full_name,is_premium,school)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(page * 25, (page + 1) * 25 - 1)
        if (search) q = q.ilike("title", `%${search}%`)
        if (filter === "active")  q = q.eq("is_removed", false)
        if (filter === "removed") q = q.eq("is_removed", true)
        if (category !== "all")   q = q.eq("category", category)
        const { data, count } = await q
        return NextResponse.json({ listings: data ?? [], total: count ?? 0 })
      }

      case "removeListing": {
        const { listingId, reason = "Violated community guidelines" } = params
        await db.from("postings").update({ is_removed: true, removed_reason: reason, removed_by: admin.staffId }).eq("id", listingId)
        await log(db, admin, "REMOVE_LISTING", "post", listingId, { reason })
        return NextResponse.json({ success: true })
      }

      case "restoreListing": {
        await db.from("postings").update({ is_removed: false, removed_reason: null, removed_by: null }).eq("id", params.listingId)
        await log(db, admin, "RESTORE_LISTING", "post", params.listingId)
        return NextResponse.json({ success: true })
      }

      case "featureListing": {
        await db.from("postings").update({ is_premium: true }).eq("id", params.listingId)
        await log(db, admin, "FEATURE_LISTING", "post", params.listingId)
        return NextResponse.json({ success: true })
      }

      // ─── VERIFICATIONS ─────────────────────────────────────────
      case "getVerifications": {
        const { data } = await db.from("profiles")
          .select("id,username,full_name,avatar_url,school,created_at,verification_status")
          .eq("verification_status", "pending")
          .order("created_at", { ascending: false })
        // Also get listing counts
        const ids = (data ?? []).map((u: any) => u.id)
        let listingCounts: Record<string, number> = {}
        if (ids.length > 0) {
          const { data: lc } = await db.from("postings").select("user_id").in("user_id", ids)
          ;(lc ?? []).forEach((r: any) => { listingCounts[r.user_id] = (listingCounts[r.user_id] ?? 0) + 1 })
        }
        return NextResponse.json({ requests: (data ?? []).map((u: any) => ({ ...u, listing_count: listingCounts[u.id] ?? 0 })) })
      }

      case "approveVerification": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        await db.from("profiles").update({ is_premium: true, verification_status: "verified" }).eq("id", params.userId)
        await log(db, admin, "APPROVE_VERIFICATION", "user", params.userId)
        return NextResponse.json({ success: true })
      }

      case "rejectVerification": {
        await db.from("profiles").update({ verification_status: "rejected" }).eq("id", params.userId)
        await log(db, admin, "REJECT_VERIFICATION", "user", params.userId, { reason: params.reason })
        return NextResponse.json({ success: true })
      }

      // ─── GROUPS ────────────────────────────────────────────────
      case "getGroups": {
        const { data: groups } = await db.from("group_chats").select("*").order("created_at", { ascending: false })
        const ids = (groups ?? []).map((g: any) => g.id)
        let memberCounts: Record<string, number> = {}, msgCounts: Record<string, number> = {}
        if (ids.length > 0) {
          const [mc, msg] = await Promise.all([
            db.from("group_members").select("group_id").in("group_id", ids),
            db.from("group_messages").select("group_id").in("group_id", ids),
          ])
          ;(mc.data ?? []).forEach((r: any) => { memberCounts[r.group_id] = (memberCounts[r.group_id] ?? 0) + 1 })
          ;(msg.data ?? []).forEach((r: any) => { msgCounts[r.group_id] = (msgCounts[r.group_id] ?? 0) + 1 })
        }
        return NextResponse.json({ groups: (groups ?? []).map((g: any) => ({ ...g, member_count: memberCounts[g.id] ?? 0, message_count: msgCounts[g.id] ?? 0 })) })
      }

      case "getGroupMembers": {
        const { data } = await db.from("group_members")
          .select("user_id,role,joined_at,profiles(username,full_name,avatar_url,is_premium)")
          .eq("group_id", params.groupId)
        return NextResponse.json({ members: data ?? [] })
      }

      case "removeGroupMember": {
        await db.from("group_members").delete().eq("group_id", params.groupId).eq("user_id", params.userId)
        await log(db, admin, "REMOVE_GROUP_MEMBER", "group", params.groupId, { userId: params.userId })
        return NextResponse.json({ success: true })
      }

      // ─── BANNERS ───────────────────────────────────────────────
      case "getBanners": {
        const { data } = await db.from("rental_banners").select("*").order("created_at", { ascending: false })
        return NextResponse.json({ banners: data ?? [] })
      }

      case "addBanner": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const { image_url, whatsapp_number, title, description, expires_at } = params
        const { data } = await db.from("rental_banners").insert({ image_url, whatsapp_number, title, description, expires_at: expires_at || null, is_active: true }).select().single()
        await log(db, admin, "ADD_BANNER", "banner", data?.id, { title })
        return NextResponse.json({ success: true, banner: data })
      }

      case "updateBanner": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const { id, ...fields } = params
        await db.from("rental_banners").update(fields).eq("id", id)
        await log(db, admin, "UPDATE_BANNER", "banner", id)
        return NextResponse.json({ success: true })
      }

      case "deleteBanner": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        await db.from("rental_banners").delete().eq("id", params.id)
        await log(db, admin, "DELETE_BANNER", "banner", params.id)
        return NextResponse.json({ success: true })
      }

      // ─── REPORTS ───────────────────────────────────────────────
      case "getReports": {
        const { filter = "pending", page = 0 } = params
        let q = db.from("reports")
          .select("*,profiles!reporter_id(username,full_name)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(page * 25, (page + 1) * 25 - 1)
        if (filter !== "all") q = q.eq("status", filter)
        const { data, count } = await q
        return NextResponse.json({ reports: data ?? [], total: count ?? 0 })
      }

      case "resolveReport": {
        await db.from("reports").update({ status: "resolved", resolved_by: admin.staffId, resolved_at: new Date().toISOString() }).eq("id", params.reportId)
        await log(db, admin, "RESOLVE_REPORT", "report", params.reportId)
        return NextResponse.json({ success: true })
      }

      case "dismissReport": {
        await db.from("reports").update({ status: "dismissed", resolved_by: admin.staffId, resolved_at: new Date().toISOString() }).eq("id", params.reportId)
        await log(db, admin, "DISMISS_REPORT", "report", params.reportId)
        return NextResponse.json({ success: true })
      }

      // ─── STAFF ─────────────────────────────────────────────────
      case "getStaff": {
        if (admin.role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const { data } = await db.from("admin_staff").select("staff_id,name,email,role,is_active,last_login,created_at,created_by").order("created_at", { ascending: false })
        return NextResponse.json({ staff: data ?? [] })
      }

      case "createStaff": {
        if (admin.role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const { name, email, role, password } = params
        if (!name || !role || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
        // Generate unique staff ID
        let staffId = genStaffId()
        let tries = 0
        while (tries < 10) {
          const { data: ex } = await db.from("admin_staff").select("staff_id").eq("staff_id", staffId).single()
          if (!ex) break
          staffId = genStaffId(); tries++
        }
        const passwordHash = await bcrypt.hash(password, 12)
        const { data, error: insErr } = await db.from("admin_staff").insert({
          staff_id: staffId, name, email: email || null, role,
          password_hash: passwordHash, created_by: admin.staffId, is_active: true,
        }).select("staff_id,name,role").single()
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
        await log(db, admin, "CREATE_STAFF", "staff", staffId, { name, role })
        return NextResponse.json({ success: true, staffId, staff: data })
      }

      case "deactivateStaff": {
        if (admin.role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        if (params.staffId === admin.staffId) return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 })
        await db.from("admin_staff").update({ is_active: false }).eq("staff_id", params.staffId)
        await log(db, admin, "DEACTIVATE_STAFF", "staff", params.staffId)
        return NextResponse.json({ success: true })
      }

      case "reactivateStaff": {
        if (admin.role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        await db.from("admin_staff").update({ is_active: true }).eq("staff_id", params.staffId)
        await log(db, admin, "REACTIVATE_STAFF", "staff", params.staffId)
        return NextResponse.json({ success: true })
      }

      case "resetStaffPassword": {
        if (admin.role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const hash = await bcrypt.hash(params.newPassword, 12)
        await db.from("admin_staff").update({ password_hash: hash }).eq("staff_id", params.staffId)
        await log(db, admin, "RESET_STAFF_PASSWORD", "staff", params.staffId)
        return NextResponse.json({ success: true })
      }

      // ─── ANNOUNCEMENTS ─────────────────────────────────────────
      case "getAnnouncements": {
        const { data } = await db.from("announcements").select("*").order("created_at", { ascending: false }).limit(50)
        return NextResponse.json({ announcements: data ?? [] })
      }

      case "sendAnnouncement": {
        if (!["superadmin","admin"].includes(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        const { title, body, target_school } = params
        if (!title || !body) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
        await db.from("announcements").insert({ title, body, target_school: target_school || null, sent_by: admin.staffId, sent_by_name: admin.name })
        await log(db, admin, "SEND_ANNOUNCEMENT", "announcement", title, { target_school })
        return NextResponse.json({ success: true })
      }

      // ─── ACTIVITY LOG ──────────────────────────────────────────
      case "getLogs": {
        const { staffFilter = "", page = 0 } = params
        let q = db.from("admin_logs")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(page * 30, (page + 1) * 30 - 1)
        if (staffFilter) q = q.eq("staff_id", staffFilter)
        const { data, count } = await q
        return NextResponse.json({ logs: data ?? [], total: count ?? 0 })
      }

      // ─── STATS for overview chart (last 7 days posts) ──────────
      case "getChartData": {
        const days: { date: string; posts: number }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i)
          const start = new Date(d.setHours(0,0,0,0)).toISOString()
          const end   = new Date(d.setHours(23,59,59,999)).toISOString()
          const { count } = await db.from("postings").select("id", { count: "exact", head: true })
            .gte("created_at", start).lte("created_at", end)
          days.push({ date: new Date(start).toLocaleDateString("en",{weekday:"short"}), posts: count ?? 0 })
        }
        return NextResponse.json({ chart: days })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e: any) {
    console.error("[admin/action]", action, e)
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 })
  }
}