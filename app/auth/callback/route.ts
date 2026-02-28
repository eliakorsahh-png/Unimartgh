// app/auth/callback/route.ts
// Supabase redirects here after:
//  - Email confirmation (signup)
//  - Magic link login
//  - Password reset (then redirects to /reset-password)
//  - OAuth (Google, etc.)

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code  = searchParams.get("code")
  const next  = searchParams.get("next") ?? "/"   // optional redirect hint

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check what type of flow this was
      // Password recovery → send to reset-password page
      // Everything else → send to intended destination or home
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user?.recovery_sent_at) {
        // This came from a password reset email
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      // Normal signup confirmation or OAuth → go to profile or home
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Code missing or exchange failed — redirect to login with error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}