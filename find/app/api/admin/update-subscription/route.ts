import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, planName, billingPeriod = "monthly" } = await request.json()

    if (!walletAddress || !planName) {
      return NextResponse.json(
        { error: "Missing required parameters: walletAddress and planName" },
        { status: 400 }
      )
    }

    // Verify this is a valid plan
    const validPlans = ["free", "investigator", "pro"]
    if (!validPlans.includes(planName)) {
      return NextResponse.json(
        { error: `Invalid plan name. Valid plans: ${validPlans.join(", ")}` },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get user by wallet address
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, wallet_address")
      .eq("wallet_address", walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: `User not found with wallet address: ${walletAddress}` },
        { status: 404 }
      )
    }

    console.log("[v0] Updating subscription for user:", user.id, "plan:", planName)

    // Get the plan ID
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, name, daily_requests")
      .eq("name", planName)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: `Plan not found: ${planName}` },
        { status: 404 }
      )
    }

    // Calculate expiration date (1 month from now by default)
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from("user_subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    let result
    if (existingSubscription) {
      // Update existing subscription
      const { data: updated, error: updateError } = await supabase
        .from("user_subscriptions")
        .update({
          plan_id: plan.id,
          status: "active",
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSubscription.id)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update subscription: ${updateError.message}`)
      }
      result = updated
      console.log("[v0] Subscription updated:", result)
    } else {
      // Create new subscription
      const { data: created, error: createError } = await supabase
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

      if (createError) {
        throw new Error(`Failed to create subscription: ${createError.message}`)
      }
      result = created
      console.log("[v0] Subscription created:", result)
    }

    // Return the updated subscription with plan details
    return NextResponse.json({
      success: true,
      message: `Subscription updated to ${planName} plan`,
      user: {
        id: user.id,
        wallet_address: user.wallet_address,
      },
      subscription: {
        ...result,
        plan: {
          name: plan.name,
          daily_requests: plan.daily_requests,
        },
      },
    })
  } catch (error) {
    console.error("[v0] Update subscription error:", error)
    return NextResponse.json(
      {
        error: "Failed to update subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
