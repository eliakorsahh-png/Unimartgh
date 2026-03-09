// app/admin/dashboard/page.tsx
import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { redirect } from "next/navigation"
import AdminDashboard from "./AdminDashboard"

const JWT_SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? "fallback-change-me")

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_session")?.value

  if (!token) redirect("/admin?reason=session_expired")

  let admin: { staffId: string; name: string; role: string }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    admin = { staffId: payload.staffId as string, name: payload.name as string, role: payload.role as string }
  } catch {
    redirect("/admin?reason=session_expired")
  }

  return <AdminDashboard initialAdmin={admin} />
}