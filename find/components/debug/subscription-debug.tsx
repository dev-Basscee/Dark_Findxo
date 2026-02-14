"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"

export function SubscriptionDebug() {
  const { user } = useAuth()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const runDebugCheck = async () => {
    if (!user) return

    setLoading(true)
    try {
      const debug: any = {
        timestamp: new Date().toISOString(),
        user: {
          id: user.id,
          wallet_address: user.wallet_address,
        },
      }

      // Check subscription via API
      const apiResponse = await fetch(`/api/subscription/status?wallet=${user.wallet_address}`)
      if (apiResponse.ok) {
        debug.api_subscription = await apiResponse.json()
      } else {
        debug.api_error = await apiResponse.text()
      }

      // Check subscription via direct database query
      const { data: dbSub, error: dbSubError } = await supabase.rpc("get_current_subscription", {
        user_uuid: user.id,
      })
      debug.db_subscription = { data: dbSub, error: dbSubError }

      // Check usage via direct database query
      const { data: dbUsage, error: dbUsageError } = await supabase.rpc("get_daily_usage", {
        user_uuid: user.id,
      })
      debug.db_usage = { data: dbUsage, error: dbUsageError }

      // Check all user subscriptions
      const { data: allSubs, error: allSubsError } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq("user_id", user.id)
      debug.all_subscriptions = { data: allSubs, error: allSubsError }

      // Check payments
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5)
      debug.recent_payments = { data: payments, error: paymentsError }

      setDebugInfo(debug)
    } catch (error) {
      console.error("Debug check failed:", error)
      setDebugInfo({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Debug</CardTitle>
          <CardDescription>Connect your wallet to debug subscription status</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Debug</CardTitle>
        <CardDescription>Debug subscription system for user: {user.wallet_address}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runDebugCheck} disabled={loading}>
          {loading ? "Running Debug Check..." : "Run Debug Check"}
        </Button>

        {debugInfo && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">API Subscription Status</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                {JSON.stringify(debugInfo.api_subscription || debugInfo.api_error, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Database Subscription</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                {JSON.stringify(debugInfo.db_subscription, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Database Usage</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                {JSON.stringify(debugInfo.db_usage, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">All User Subscriptions</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                {JSON.stringify(debugInfo.all_subscriptions, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Recent Payments</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                {JSON.stringify(debugInfo.recent_payments, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
