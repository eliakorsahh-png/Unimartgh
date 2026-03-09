// app/admin/dashboard/page.tsx
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createHmac } from "crypto"
import AdminDashboard from "./AdminDashboard"

const SECRET = process.env.ADMIN_JWT_SECRET ?? "fallback-change-me-in-env"

function verifyToken(token: string): { staffId: string; name: string; role: string } | null {
  try {
    const [header, body, sig] = token.split(".")
    if (!header || !body || !sig) return null
    const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url")
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(body, "base64url").toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return { staffId: payload.staffId, name: payload.name, role: payload.role }
  } catch { return null }
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_session")?.value

  if (!token) redirect("/admin?reason=session_expired")

  const admin = verifyToken(token!)
  if (!admin) redirect("/admin?reason=session_expired")

  return <AdminDashboard initialAdmin={admin!} />
}