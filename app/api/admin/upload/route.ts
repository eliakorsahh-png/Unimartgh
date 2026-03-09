// app/api/admin/upload/route.ts
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin-client"

const SECRET = process.env.ADMIN_JWT_SECRET ?? "fallback-change-me-in-env"

function getAdmin(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value
  if (!token) return null
  try {
    const [header, body, sig] = token.split(".")
    if (!header || !body || !sig) return null
    const expected = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url")
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payload = JSON.parse(Buffer.from(body, "base64url").toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    const allowed = ["image/jpeg","image/png","image/webp","image/gif"]
    if (!allowed.includes(file.type)) return NextResponse.json({ error: "Only JPEG/PNG/WebP/GIF allowed" }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Max 5MB" }, { status: 400 })
    const db  = createAdminClient()
    const ext = file.name.split(".").pop() ?? "jpg"
    const key = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: upErr } = await db.storage.from("admin-uploads").upload(key, await file.arrayBuffer(), { contentType: file.type })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    const { data } = db.storage.from("admin-uploads").getPublicUrl(key)
    return NextResponse.json({ url: data.publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}