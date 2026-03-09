// middleware.ts — merge with your existing middleware or create at project root
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

const SECRET  = process.env.ADMIN_JWT_SECRET ?? "fallback-change-me-in-env"

function verifyAdminToken(token: string): boolean {
  try {
    const [header, body, sig] = token.split(".")
    if (!header || !body || !sig) return false
    const expected = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url")
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
    const payload = JSON.parse(Buffer.from(body, "base64url").toString())
    return payload.exp > Math.floor(Date.now() / 1000)
  } catch { return false }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/admin/dashboard")) {
    const token = req.cookies.get("admin_session")?.value
    if (!token || !verifyAdminToken(token)) {
      const res = NextResponse.redirect(new URL("/admin?reason=session_expired", req.url))
      res.cookies.set("admin_session", "", { maxAge: 0, path: "/admin" })
      return res
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}