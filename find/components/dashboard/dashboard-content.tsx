"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Key, CreditCard, Activity, TrendingUp, Database, Shield, Calendar, BarChart3, Home, RefreshCw } from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { createClient } from "@supabase/supabase-js"

interface UserStats {
  dailyUsage: number
  dailyLimit: number
  totalApiKeys: number
  currentPlan: string
  planExpiry: string | null
}

const supabaseUrl = "https://your-supabase-url.supabase.co"
const supabaseKey = "your-supabase-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export function DashboardContent() {
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [walletConnectedDate, setWalletConnectedDate] = useState<string | null>(null)
  const [accountCreatedDate, setAccountCreatedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [totalApiKeys, setTotalApiKeys] = useState(0)
  const [apiKeys, setApiKeys] = useState<any[]>([]) // Declare apiKeys variable

  // Parse dates from user object
  useEffect(() => {
    if (!user) return

    if (user.created_at) {
      try {
        const createdDate = new Date(user.created_at)
        if (!isNaN(createdDate.getTime())) {
          setAccountCreatedDate(user.created_at)
        }
      } catch (e) {
        console.error("[v0] Error parsing created_at:", e)
      }
    }

    if (user.wallet_connected_at) {
      try {
        const connectedDate = new Date(user.wallet_connected_at)
        if (!isNaN(connectedDate.getTime())) {
          setWalletConnectedDate(user.wallet_connected_at)
        }
      } catch (e) {
        console.error("[v0] Error parsing wallet_connected_at:", e)
      }
    }
  }, [user])

  // Refresh stats function
  const handleRefresh = useCallback(async () => {
    if (!user) return
    setIsRefreshing(true)
    try {
      // Add cache busting parameter
      const cacheParam = `t=${Date.now()}`
      const response = await fetch(`/api/subscription/status?wallet=${user.wallet_address}&${cacheParam}`)
      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Fresh subscription data:", data.subscription)
        setStats((prevStats) => ({
          dailyUsage: data?.usage?.dailyUsage ?? 0,
          dailyLimit: data?.subscription?.dailyRequests ?? 10,
          totalApiKeys: prevStats?.totalApiKeys ?? 0,
          currentPlan: data?.subscription?.planName ?? "free",
          planExpiry: data?.subscription?.expiresAt ?? null,
        }))
        console.log("[v0] Stats refreshed successfully")
      }
    } catch (error) {
      console.error("[v0] Refresh error:", error)
    } finally {
      setIsRefreshing(false)
    }
  }, [user])

  // Fetch stats when user is available
  useEffect(() => {
    if (!user || authLoading) return

    const fetchUserStats = async () => {
      setLoadingStats(true)
      setLoading(true) // Set loading to true when fetching stats
      try {
        console.log("[v0] Fetching stats for user:", user.wallet_address)

        // Try API endpoint first (with timeout)
        let subscriptionData = null
        let usageData = null

        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

          const response = await fetch(`/api/subscription/status?wallet=${user.wallet_address}`, {
            signal: controller.signal,
          })
          clearTimeout(timeoutId)

          if (response.ok) {
            const data = await response.json()
            subscriptionData = data?.subscription || null
            usageData = data?.usage || null
            console.log("[v0] API subscription data:", subscriptionData)
          } else {
            console.log("[v0] API returned status:", response.status)
          }
        } catch (apiError) {
          console.log("[v0] API call failed, will use fallback:", apiError)
        }

        // Use default values if API fails - no fallback direct Supabase calls needed
        if (!subscriptionData) {
          subscriptionData = {
            planName: "free",
            dailyRequests: 10,
            status: "active",
            expiresAt: null,
          }
          console.log("[v0] Using default subscription data")
        }

        if (!usageData) {
          usageData = {
            dailyUsage: 0,
            dailyLimit: subscriptionData?.dailyRequests || 10,
          }
          console.log("[v0] Using default usage data")
        }

        // Build final stats with defaults
        const finalStats = {
          dailyUsage: usageData?.dailyUsage ?? 0,
          dailyLimit: subscriptionData?.dailyRequests ?? 10,
          totalApiKeys: totalApiKeys,
          currentPlan: subscriptionData?.planName ?? "free",
          planExpiry: subscriptionData?.expiresAt ?? null,
        }

        setStats(finalStats)
        console.log("[v0] Stats loaded successfully:", finalStats)
      } catch (error) {
        console.error("[v0] Error fetching user stats:", error)
        // Set default stats on error
        setStats({
          dailyUsage: 0,
          dailyLimit: 10,
          totalApiKeys: 0,
          currentPlan: "free",
          planExpiry: null,
        })
      } finally {
        setLoadingStats(false)
      }
    }

    fetchUserStats()
  }, [user, authLoading])

  if (authLoading || loadingStats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative mb-6">
            <div className="loading-spinner mx-auto animate-glow"></div>
            <div
              className="absolute inset-0 loading-spinner mx-auto opacity-30 animate-spin"
              style={{ animationDelay: "0.5s" }}
            ></div>
          </div>
          <h2 className="text-xl font-semibold mb-2 animate-slide-up">Loading Dashboard</h2>
          <p className="text-muted-foreground animate-slide-up loading-dots" style={{ animationDelay: "0.2s" }}>
            Preparing your intelligence platform
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center animate-bounce-in">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 animate-float">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Please connect your wallet to access the dashboard.</p>
          <Button asChild className="animate-glow">
            <Link href="/">Connect Wallet</Link>
          </Button>
        </div>
      </div>
    )
  }

  const usagePercentage = stats ? (stats.dailyUsage / stats.dailyLimit) * 100 : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur-md animate-slide-up">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary group-hover:scale-110 transition-transform duration-200 animate-glow">
                <Database className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">findxo</span>
            </Link>
            <div className="flex items-center space-x-2 ml-6">
              <Button variant="outline" size="sm" asChild className="bg-transparent">
                <Link href="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </Button>
              <Badge variant="secondary" className="animate-scale-in">
                Dashboard
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-4 animate-fade-in">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-transparent"
              title="Refresh subscription data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-600">
                {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
              </span>
            </div>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                localStorage.removeItem("wallet_auth")
                document.cookie = "wallet_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
                window.location.href = "/"
              }}
              className="hover:scale-105 transition-transform duration-200 bg-transparent hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">Welcome back! Here's an overview of your intelligence platform usage.</p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card
            className="animate-scale-in hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            style={{ animationDelay: "0.1s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Usage</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.dailyUsage || 0} / {stats?.dailyLimit || 10}
              </div>
              <Progress value={usagePercentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">{Math.round(usagePercentage)}% of daily limit used</p>
            </CardContent>
          </Card>

          <Card
            className="animate-scale-in hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            style={{ animationDelay: "0.2s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{stats?.currentPlan || "Free"}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.planExpiry ? `Expires ${new Date(stats.planExpiry).toLocaleDateString()}` : "No expiry"}
              </p>
            </CardContent>
          </Card>

          <Card
            className="animate-scale-in hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            style={{ animationDelay: "0.3s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalApiKeys || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Active API keys</p>
            </CardContent>
          </Card>

          <Card
            className="animate-scale-in hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            style={{ animationDelay: "0.4s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security</CardTitle>
              <Shield className="h-4 w-4 text-green-500 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">Secure</div>
              <p className="text-xs text-muted-foreground mt-2">Wallet authenticated</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6 animate-fade-in">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="transition-all duration-200">
              Overview
            </TabsTrigger>
            <TabsTrigger value="usage" className="transition-all duration-200">
              Usage
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="transition-all duration-200">
              API Keys
            </TabsTrigger>
            <TabsTrigger value="subscription" className="transition-all duration-200">
              Subscription
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-slide-up">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 animate-float" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription>Common tasks and shortcuts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    className="w-full justify-start bg-transparent hover:scale-105 transition-all duration-200"
                    variant="outline"
                    asChild
                  >
                    <Link href="/api-keys">
                      <Key className="h-4 w-4 mr-2" />
                      Manage API Keys
                    </Link>
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent hover:scale-105 transition-all duration-200"
                    variant="outline"
                    asChild
                  >
                    <Link href="/subscription">
                      <CreditCard className="h-4 w-4 mr-2" />
                      View Plans
                    </Link>
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent hover:scale-105 transition-all duration-200"
                    variant="outline"
                    asChild
                  >
                    <Link href="/analytics">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Analytics
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Your latest platform interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm hover:bg-muted/50 p-2 rounded transition-colors duration-200">
                      <span className="text-muted-foreground">API request made</span>
                      <span>2 hours ago</span>
                    </div>
                    <div className="flex items-center justify-between text-sm hover:bg-muted/50 p-2 rounded transition-colors duration-200">
                      <span className="text-muted-foreground">Wallet connected</span>
                      <span>{walletConnectedDate ? new Date(walletConnectedDate).toLocaleDateString() : "Today"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm hover:bg-muted/50 p-2 rounded transition-colors duration-200">
                      <span className="text-muted-foreground">Account created</span>
                      <span>{accountCreatedDate ? new Date(accountCreatedDate).toLocaleDateString() : "Today"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6 animate-slide-up">
            <Card>
              <CardHeader>
                <CardTitle>Usage Statistics</CardTitle>
                <CardDescription>Track your API usage and limits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Today's Usage</span>
                      <span className="text-sm text-muted-foreground">
                        {stats?.dailyUsage || 0} / {stats?.dailyLimit || 10} requests
                      </span>
                    </div>
                    <Progress value={usagePercentage} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{stats?.dailyUsage || 0}</div>
                      <div className="text-sm text-muted-foreground">Requests Today</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{stats?.dailyLimit || 10}</div>
                      <div className="text-sm text-muted-foreground">Daily Limit</div>
                    </div>
                  </div>

                  {usagePercentage > 80 && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        You're approaching your daily limit. Consider upgrading your plan for more requests.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-6 animate-slide-up">
            <Card>
              <CardHeader>
                <CardTitle>API Key Management</CardTitle>
                <CardDescription>Create and manage your API keys for platform access</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No API Keys Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first API key to start using the intelligence platform programmatically.
                  </p>
                  <Button asChild>
                    <Link href="/api-keys">Manage API Keys</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6 animate-slide-up">
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription>View and manage your current subscription plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors duration-200">
                    <div>
                      <h3 className="font-semibold capitalize">{stats?.currentPlan || "Free"} Plan</h3>
                      <p className="text-sm text-muted-foreground">{stats?.dailyLimit || 10} requests per day</p>
                    </div>
                    <Badge variant={stats?.currentPlan === "free" ? "secondary" : "default"} className="animate-pulse">
                      {stats?.currentPlan === "free" ? "Current" : "Active"}
                    </Badge>
                  </div>

                  {stats?.currentPlan === "free" && (
                    <div className="text-center py-6 animate-bounce-in">
                      <h3 className="text-lg font-semibold mb-2">Ready to Upgrade?</h3>
                      <p className="text-muted-foreground mb-4">
                        Get more requests and advanced features with our paid plans.
                      </p>
                      <Button asChild className="animate-glow hover:scale-105 transition-transform duration-200">
                        <Link href="/subscription">View Plans</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
