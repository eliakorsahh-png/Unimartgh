"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function CreatePost() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const router = useRouter()

  const handleSubmit = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert("You must be logged in")
      return
    }

    const { error } = await supabase.from("posts").insert({
      title,
      content,
      user_id: user.id,
    })

    if (!error) {
      router.push("/")
    } else {
      alert(error.message)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-10 space-y-4">
      <h1 className="text-2xl font-bold">Create Marketing Post</h1>

      <input
        type="text"
        placeholder="Campaign title"
        className="border p-2 w-full"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        placeholder="Write your marketing message..."
        className="border p-2 w-full"
        rows={5}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Publish
      </button>
    </div>
  )
}
