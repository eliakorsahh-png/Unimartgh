// app/api/admin/auth/route.ts
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin-client"

const COOKIE    = "admin_session"
const SECRET    = process.env.ADMIN_JWT_SECRET ?? "fallback-change-me-in-env"
const MAX_AGE   = 60 * 60 * 12   // 12 hours in seconds

// ── Minimal JWT using Node crypto (no jose needed) ──────────────────────────
function signToken(payload: Record<string, any>): string {
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const body    = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  })).toString("base64url")
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest("base64url")
  return `${header}.${body}.${sig}`
}

export function verifyToken(token: string): Record<string, any> | null {
  try {
    const [header, body, sig] = token.split(".")
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(`${header}.${body}`)
      .digest("base64url")
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payload = JSON.parse(Buffer.from(body, "base64url").toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body     = await req.json()
    const staffId  = (body.staffId  ?? "").toString().trim().toUpperCase()
    const password = (body.password ?? "").toString()

    console.log("[admin/auth] login attempt:", staffId)

    if (!staffId || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const db = createAdminClient()

    const { data: staff, error: dbErr } = await db
      .from("admin_staff")
      .select("staff_id, name, role, password_hash, is_active")
      .eq("staff_id", staffId)
      .single()

    console.log("[admin/auth] db:", {
      found: !!staff, err: dbErr?.message ?? null,
      active: staff?.is_active, hashPfx: staff?.password_hash?.slice(0, 7),
    })

    const hashToCheck = staff?.password_hash
      ?? "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345"

    const valid = await bcrypt.compare(password, hashToCheck)
    console.log("[admin/auth] bcrypt:", valid)

    if (dbErr || !staff || !staff.is_active || !valid) {
      console.log("[admin/auth] 401:", { dbErr: !!dbErr, noStaff: !staff, inactive: !staff?.is_active, badPw: !valid })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Fire-and-forget side effects
    db.from("admin_staff").update({ last_login: new Date().toISOString() }).eq("staff_id", staff.staff_id).then(() => {})
    db.from("admin_logs").insert({ staff_id: staff.staff_id, staff_name: staff.name, action: "LOGIN", details: { ip: req.headers.get("x-forwarded-for") ?? "unknown" } }).then(() => {})

    const token = signToken({ staffId: staff.staff_id, name: staff.name, role: staff.role })

    const res = NextResponse.json({ success: true, name: staff.name, role: staff.role, staffId: staff.staff_id })

    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   MAX_AGE,
      path:     "/",
    })

    console.log("[admin/auth] SUCCESS:", staff.staff_id)
    return res

  } catch (e: any) {
    console.error("[admin/auth] CRASH:", e.message)
    return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 })
  }
}

// ── LOGOUT ───────────────────────────────────────────────────────────────────
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" })
  return res
}