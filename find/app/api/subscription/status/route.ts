import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get("wallet")

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user by wallet address with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("wallet_address", walletAddress)
        .single()

      clearTimeout(timeoutId)

      if (userError) {
        console.error("[v0] User query error:", userError)
        // Return default subscription for new users
        return NextResponse.json({
          subscription: {
            planName: "free",
            dailyRequests: 10,
            status: "active",
            expiresAt: null,
          },
          usage: {
            dailyUsage: 0,
            dailyLimit: 10,
          },
        })
      }

      if (!user) {
        // Return default subscription for new users
        return NextResponse.json({
          subscription: {
            planName: "free",
            dailyRequests: 10,
            status: "active",
            expiresAt: null,
          },
          usage: {
            dailyUsage: 0,
            dailyLimit: 10,
          },
        })
      }

      // Get current subscription - directly query instead of RPC for reliability
      let subscription = null
      try {
        const { data: subData, error: subError } = await supabase
          .from("user_subscriptions")
          .select(
            `
            id,
            status,
            expires_at,
            subscription_plans (
              name,
              daily_requests
            )
          `
          )
          .eq("user_id", user.id)
          .eq("status", "active")
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        if (!subError && subData) {
          subscription = {
            plan_name: subData.subscription_plans?.name || "free",
            daily_requests: subData.subscription_plans?.daily_requests || 10,
            status: subData.status,
            expires_at: subData.expires_at,
          }
        }
      } catch (subError) {
        console.log("[v0] Subscription query failed:", subError)
      }

      // Get daily usage
      let usage = 0
      try {
        const { data: usageData, error: usageError } = await supabase.rpc("get_daily_usage", {
          user_uuid: user.id,
        })

        if (!usageError && usageData !== null && typeof usageData === "number") {
          usage = usageData
        }
      } catch (usageError) {
        console.log("[v0] Usage RPC failed:", usageError)
      }

      return NextResponse.json({
        subscription: {
          planName: subscription?.plan_name || "free",
          dailyRequests: subscription?.daily_requests || 10,
          status: subscription?.status || "active",
          expiresAt: subscription?.expires_at || null,
        },
        usage: {
          dailyUsage: usage,
          dailyLimit: subscription?.daily_requests || 10,
        },
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    console.error("[v0] Subscription status error:", error)
    // Return default subscription on error instead of failing
    return NextResponse.json({
      subscription: {
        planName: "free",
        dailyRequests: 10,
        status: "active",
        expiresAt: null,
      },
      usage: {
        dailyUsage: 0,
        dailyLimit: 10,
      },
    })
  }
}
