import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { signature, userWallet, expectedAmount } = await request.json()

    if (!signature || !userWallet || !expectedAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Update payment status in database
    const { error } = await supabase
      .from("payments")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("transaction_signature", signature)

    if (error) {
      console.error("Failed to update payment status:", error)
      return NextResponse.json({ error: "Failed to update payment status" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Payment verification failed:", error)
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 })
  }
}
