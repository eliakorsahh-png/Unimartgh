"use client"

import { useRouter } from "next/navigation"

export default function FloatingMenu() {
  const router = useRouter()

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-4">
      <button
        onClick={() => router.push("/login")}
        className="bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg"
      >
        Login
      </button>

  
    </div>
  )
}
