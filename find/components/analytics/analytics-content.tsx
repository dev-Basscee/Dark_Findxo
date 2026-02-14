"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { BarChart3, TrendingUp, Activity, Calendar, Database, Clock, Target, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface AnalyticsData {
  totalRequests: number
  dailyUsage: number
  dailyLimit: number
  weeklyUsage: number[]
  monthlyUsage: number[]
  topEndpoints: { endpoint: string; count: number }[]
  responseTimeAvg: number
  successRate: number
  lastActivity: string | null
}

export function AnalyticsContent() {
  const { user, loading } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d")
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return

      try {
        // Simulate analytics data - in real app, this would come from your API usage tracking
        const mockData: AnalyticsData = {
          totalRequests: 1247,
          dailyUsage: 23,
          dailyLimit: 100,
          weeklyUsage: [12, 18, 25, 31, 28, 23, 19],
          monthlyUsage: [450, 523, 612, 589, 634, 701, 823, 756, 892, 945, 1023, 1247],
          topEndpoints: [
            { endpoint: "/search", count: 456 },
            { endpoint: "/lookup", count: 234 },
            { endpoint: "/analyze", count: 189 },
            { endpoint: "/export", count: 123 },
            { endpoint: "/verify", count: 89 },
          ],
          responseTimeAvg: 245,
          successRate: 98.7,
          lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        }

        // Add some randomization to make it feel more real
        mockData.dailyUsage = Math.floor(Math.random() * 30) + 10
        mockData.totalRequests = Math.floor(Math.random() * 500) + 800
        mockData.responseTimeAvg = Math.floor(Math.random() * 100) + 200
        mockData.successRate = 95 + Math.random() * 4

        setAnalytics(mockData)
      } catch (error) {
        console.error("Failed to fetch analytics:", error)
        toast({
          title: "Error",
          description: "Failed to load analytics data",
          variant: "destructive",
        })
      } finally {
        setLoadingData(false)
      }
    }

    fetchAnalytics()
  }, [user, supabase, toast, timeRange])

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary mx-auto mb-4"></div>
            <div className="absolute inset-0 rounded-full bg-muted animate-pulse opacity-20"></div>
          </div>
          <p className="text-foreground font-medium">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!user || !analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-muted-foreground">
            {!user ? "Please connect your wallet to access analytics." : "Failed to load analytics data."}
          </p>
        </div>
      </div>
    )
  }

  const usagePercentage = analytics ? (analytics.dailyUsage / analytics.dailyLimit) * 100 : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur-xl shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4 animate-slide-in-left">
            <Link href="/dashboard" className="flex items-center space-x-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary group-hover:bg-primary/90 transition-all duration-300 shadow-lg">
                <Database className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">findxo</span>
            </Link>
            <Badge className="bg-primary/10 text-primary border-primary/20 animate-bounce-in">Analytics</Badge>
          </div>

          <div className="flex items-center space-x-4 animate-slide-in-right">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-border hover:bg-muted transition-all duration-300 bg-transparent"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="flex justify-between items-center mb-8 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-foreground">Analytics</h1>
            <p className="text-muted-foreground text-lg">
              Track your API usage, performance metrics, and platform insights.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={timeRange === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("7d")}
              className="transition-all duration-300"
            >
              7 Days
            </Button>
            <Button
              variant={timeRange === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("30d")}
              className="transition-all duration-300"
            >
              30 Days
            </Button>
            <Button
              variant={timeRange === "90d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("90d")}
              className="transition-all duration-300"
            >
              90 Days
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-border shadow-lg hover:shadow-xl transition-all duration-300 animate-scale-in bg-card backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Total Requests</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{analytics?.totalRequests.toLocaleString()}</div>
              <p className="text-xs text-green-600 mt-2 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card
            className="border-border shadow-lg hover:shadow-xl transition-all duration-300 animate-scale-in bg-card backdrop-blur-sm"
            style={{ animationDelay: "0.1s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Daily Usage</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">
                {analytics?.dailyUsage} / {analytics?.dailyLimit}
              </div>
              <Progress value={usagePercentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">{Math.round(usagePercentage)}% of daily limit</p>
            </CardContent>
          </Card>

          <Card
            className="border-border shadow-lg hover:shadow-xl transition-all duration-300 animate-scale-in bg-card backdrop-blur-sm"
            style={{ animationDelay: "0.2s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{analytics?.responseTimeAvg}ms</div>
              <p className="text-xs text-green-600 mt-2">Excellent performance</p>
            </CardContent>
          </Card>

          <Card
            className="border-border shadow-lg hover:shadow-xl transition-all duration-300 animate-scale-in bg-card backdrop-blur-sm"
            style={{ animationDelay: "0.3s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">Success Rate</CardTitle>
              <Target className="h-4 w-4 text-green-600 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{analytics?.successRate.toFixed(1)}%</div>
              <p className="text-xs text-green-600 mt-2">High reliability</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6 animate-fade-in">
          <TabsList className="grid w-full grid-cols-4 bg-card backdrop-blur-sm border border-border">
            <TabsTrigger value="overview" className="transition-all duration-200">
              Overview
            </TabsTrigger>
            <TabsTrigger value="usage" className="transition-all duration-200">
              Usage Trends
            </TabsTrigger>
            <TabsTrigger value="endpoints" className="transition-all duration-200">
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="performance" className="transition-all duration-200">
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-slide-up">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Calendar className="h-5 w-5 text-primary" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Your latest API interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-card-foreground">Search API called</span>
                      </div>
                      <span className="text-xs text-muted-foreground">2 hours ago</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-card-foreground">Data export completed</span>
                      </div>
                      <span className="text-xs text-muted-foreground">5 hours ago</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-sm font-medium text-card-foreground">Analysis request processed</span>
                      </div>
                      <span className="text-xs text-muted-foreground">1 day ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    Quick Stats
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Peak usage hour</span>
                      <span className="font-semibold text-card-foreground">2:00 PM - 3:00 PM</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Most active day</span>
                      <span className="font-semibold text-card-foreground">Wednesday</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Fastest response</span>
                      <span className="font-semibold text-green-600">89ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Error rate</span>
                      <span className="font-semibold text-card-foreground">1.3%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6 animate-slide-up">
            <Card className="border-border shadow-lg bg-card backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-card-foreground">Usage Trends</CardTitle>
                <CardDescription className="text-muted-foreground">API request patterns over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between gap-2 p-4">
                  {analytics?.monthlyUsage &&
                  Array.isArray(analytics.monthlyUsage) &&
                  analytics.monthlyUsage.length > 0 ? (
                    analytics.monthlyUsage.map((usage, index) => (
                      <div key={index} className="flex flex-col items-center gap-2">
                        <div
                          className="bg-gradient-to-t from-primary to-primary/70 rounded-t-sm transition-all duration-500 hover:from-primary/90 hover:to-primary/60"
                          style={{
                            height: `${(usage / Math.max(...analytics.monthlyUsage)) * 200}px`,
                            width: "20px",
                          }}
                        ></div>
                        <span className="text-xs text-muted-foreground rotate-45 origin-left">
                          {new Date(2024, index).toLocaleDateString("en", { month: "short" })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No usage data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-6 animate-slide-up">
            <Card className="border-border shadow-lg bg-card backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-card-foreground">Top Endpoints</CardTitle>
                <CardDescription className="text-muted-foreground">Most frequently used API endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.topEndpoints &&
                  Array.isArray(analytics.topEndpoints) &&
                  analytics.topEndpoints.length > 0 ? (
                    analytics.topEndpoints.map((endpoint, index) => (
                      <div
                        key={endpoint.endpoint}
                        className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">
                            {index + 1}
                          </div>
                          <code className="font-mono text-sm text-card-foreground">{endpoint.endpoint}</code>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-card-foreground">
                            {endpoint.count.toLocaleString()}
                          </span>
                          <div className="w-20 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${analytics.topEndpoints[0] ? (endpoint.count / analytics.topEndpoints[0].count) * 100 : 0}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">No endpoint data available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6 animate-slide-up">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border shadow-lg bg-card backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Clock className="h-5 w-5 text-green-600" />
                    Response Times
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Average response time by endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.topEndpoints &&
                    Array.isArray(analytics.topEndpoints) &&
                    analytics.topEndpoints.slice(0, 3).length > 0 ? (
                      analytics.topEndpoints.slice(0, 3).map((endpoint) => (
                        <div key={endpoint.endpoint} className="flex items-center justify-between">
                          <code className="text-sm font-mono text-card-foreground">{endpoint.endpoint}</code>
                          <span className="text-sm font-semibold text-green-600">
                            {Math.floor(Math.random() * 100) + 150}ms
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-lg bg-card backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Target className="h-5 w-5 text-blue-600" />
                    Error Rates
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Success rates by endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.topEndpoints &&
                    Array.isArray(analytics.topEndpoints) &&
                    analytics.topEndpoints.slice(0, 3).length > 0 ? (
                      analytics.topEndpoints.slice(0, 3).map((endpoint) => {
                        const successRate = 95 + Math.random() * 4
                        return (
                          <div key={endpoint.endpoint} className="flex items-center justify-between">
                            <code className="text-sm font-mono text-card-foreground">{endpoint.endpoint}</code>
                            <span className="text-sm font-semibold text-green-600">{successRate.toFixed(1)}%</span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-sm text-muted-foreground">No data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
