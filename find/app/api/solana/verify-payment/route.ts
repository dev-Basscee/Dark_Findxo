import { type NextRequest, NextResponse } from "next/server"
import { createConnection } from "@/lib/solana/config"
import { verifyPayment } from "@/lib/solana/payment"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { signature, expectedAmount, userWallet, planName, billingPeriod } = await request.json()

    console.log("[v0] Payment verification request:", {
      signature,
      expectedAmount,
      userWallet,
      planName,
      billingPeriod,
    })

    if (!signature || !expectedAmount || !userWallet || !planName || !billingPeriod) {
      console.error("[v0] Missing required parameters:", {
        signature: !!signature,
        expectedAmount: !!expectedAmount,
        userWallet: !!userWallet,
        planName: !!planName,
        billingPeriod: !!billingPeriod,
      })
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const connection = createConnection()
    const merchantWallet = process.env.NEXT_PUBLIC_MERCHANT_WALLET

    if (!merchantWallet) {
      console.error("[v0] Merchant wallet not configured")
      return NextResponse.json({ error: "Payment configuration error" }, { status: 500 })
    }

    console.log("[v0] Verifying payment on blockchain...")
    const isValid = await verifyPayment(connection, signature, expectedAmount, merchantWallet)

    if (!isValid) {
      console.log("[v0] Payment verification failed for signature:", signature)
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
    }

    console.log("[v0] Payment verified successfully, processing subscription...")

    const supabase = await createAdminClient()

    // Get user ID
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("wallet_address", userWallet)
      .single()

    if (userError || !user) {
      console.error("[v0] User not found for wallet:", userWallet)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Calculate expiration date (1 month from now)
    const expirationDate = new Date()
    expirationDate.setMonth(expirationDate.getMonth() + 1)

    // Get plan details
    let planId = null
    let dailyRequests = 10
    
    if (planName === "investigator") {
      dailyRequests = 100000
    } else if (planName === "pro") {
      dailyRequests = 500000
    }

    // Get the plan ID from subscription_plans table
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("name", planName)
      .single()

    if (!planError && plan) {
      planId = plan.id
    }

    console.log("[v0] Creating/updating subscription:", {
      userId: user.id,
      planName,
      planId,
      expiresAt: expirationDate,
      dailyRequests,
    })

    // Delete existing subscriptions for this user
    await supabase
      .from("user_subscriptions")
      .delete()
      .eq("user_id", user.id)

    // Create new subscription
    const { data: subscription, error: subError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: user.id,
        plan_id: planId,
        status: "active",
        expires_at: expirationDate.toISOString(),
      })
      .select()
      .single()

    if (subError) {
      console.error("[v0] Subscription creation error:", subError)
      return NextResponse.json(
        {
          error: "Failed to create subscription",
          details: subError.message,
        },
        { status: 500 },
      )
    }

    console.log("[v0] Payment and subscription processed successfully")

    return NextResponse.json({
      success: true,
      message: "Payment verified and subscription activated",
      subscription: {
        planName,
        dailyRequests,
        status: "active",
        expiresAt: expirationDate.toISOString(),
      },
    })
  } catch (error) {
    console.error("[v0] Payment verification error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
