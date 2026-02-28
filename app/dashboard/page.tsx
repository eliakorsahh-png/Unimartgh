import { createClient } from "@/lib/supabase/server"

export default async function Dashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">
        High School Marketing Dashboard
      </h1>

      <p className="mt-4">
        Logged in as: {user?.email}
      </p>

      <div className="mt-6">
        <h2 className="text-xl font-semibold">Active Campaigns</h2>
        <ul className="list-disc ml-6 mt-2">
          <li>Spring Fundraiser Social Campaign</li>
          <li>Football Game Promo</li>
          <li>College Fair Awareness Drive</li>
        </ul>
      </div>
    </div>
  )
}
