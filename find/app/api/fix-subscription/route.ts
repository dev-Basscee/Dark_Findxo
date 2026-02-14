import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, planName } = await request.json()

    if (!walletAddress || !planName) {
      return NextResponse.json(
        { error: "Missing walletAddress or planName" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get plan
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("name", planName)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Calculate 1 month expiration
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    // Delete old subscriptions
    await supabase.from("user_subscriptions").delete().eq("user_id", user.id)

    // Create new subscription
    const { data: subscription, error: subError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        status: "active",
        starts_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (subError) {
      throw new Error(`Subscription creation failed: ${subError.message}`)
    }

    console.log("[v0] Fixed subscription for user:", walletAddress, "to plan:", planName)

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${walletAddress} to ${planName} plan (expires ${expiresAt.toISOString()})`,
      subscription,
    })
  } catch (error) {
    console.error("[v0] Fix subscription error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
