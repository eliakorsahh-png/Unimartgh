// app/api/verify-payment/route.ts
// Called after Paystack popup succeeds — verifies with Paystack API
// then activates is_premium on the user's profile

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? ""

// Months → PostgreSQL interval string
const PLAN_INTERVAL: Record<string, string> = {
  "1month":  "1 month",
  "3months": "3 months",
  "1year":   "1 year",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reference, user_id, plan_id, plan_label, months, amount } = body

    if (!reference || !user_id || !plan_id) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 })
    }

    // ── 1. Verify with Paystack ──────────────────────────────────
    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    })

    const psData = await psRes.json()

    if (!psRes.ok || psData.status !== true || psData.data?.status !== "success") {
      console.error("Paystack verification failed:", psData)
      return NextResponse.json(
        { success: false, error: "Payment could not be verified with Paystack. Please contact support." },
        { status: 402 }
      )
    }

    // ── 2. Sanity check — amount matches plan price ──────────────
    const paidKobo    = psData.data.amount           // Paystack returns in pesewas
    const expectedKobo = (amount ?? 0) * 100
    if (paidKobo < expectedKobo) {
      return NextResponse.json(
        { success: false, error: `Payment amount mismatch. Expected GH₵${amount}, received GH₵${paidKobo / 100}.` },
        { status: 402 }
      )
    }

    // ── 3. Check for duplicate reference ────────────────────────
    const supabase = await createClient()
    const { data: existing } = await supabase
      .from("verification_requests")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: "This payment reference has already been used." },
        { status: 409 }
      )
    }

    // ── 4. Activate premium on profile ──────────────────────────
    const interval = PLAN_INTERVAL[plan_id] ?? "1 month"
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        is_premium:          true,
        premium_expires_at:  new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", user_id)

    if (profileErr) {
      console.error("Profile update error:", profileErr)
      return NextResponse.json(
        { success: false, error: "Payment verified but failed to activate your badge. Contact support with ref: " + reference },
        { status: 500 }
      )
    }

    // ── 5. Log the verified payment ─────────────────────────────
    await supabase.from("verification_requests").insert({
      user_id,
      plan_id,
      plan_label,
      amount_paid:         amount,
      months,
      paystack_reference:  reference,
      paystack_email:      psData.data.customer?.email ?? null,
      status:              "approved",
    })

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error("verify-payment error:", err)
    return NextResponse.json(
      { success: false, error: "Server error. Please try again." },
      { status: 500 }
    )
  }
}