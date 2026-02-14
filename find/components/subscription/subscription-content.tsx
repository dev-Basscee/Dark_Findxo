"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Check, CreditCard, Database, Calendar, TrendingUp, Zap, Shield, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { PaymentModal } from "@/components/payment/payment-modal"

interface SubscriptionPlan {
  id: string
  name: string
  daily_requests: number
  monthly_price_eur: number
  yearly_price_eur: number
}

interface UserSubscription {
  plan_name: string
  daily_requests: number
  status: string
  expires_at: string | null
}

export function SubscriptionContent() {
  const { user, loading } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "yearly">("monthly")
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean
    planName: string
    amount: number
    billingPeriod: "monthly" | "yearly"
  }>({
    isOpen: false,
    planName: "",
    amount: 0,
    billingPeriod: "monthly",
  })
  const { toast } = useToast()
  const supabase = createClient()

  const fetchSubscriptionData = async () => {
    if (!user) return

    try {
      console.log("[v0] Fetching subscription data for user:", user.id)

      // Fetch available plans
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("monthly_price_eur", { ascending: true })

      if (plansError) throw plansError

      // Update the plans data with correct pricing
      const updatedPlans = plansData?.map((plan) => {
        if (plan.name === "investigator") {
          return {
            ...plan,
            monthly_price_eur: 300,
            yearly_price_eur: 2500,
          }
        } else if (plan.name === "pro") {
          return {
            ...plan,
            monthly_price_eur: 1000,
            yearly_price_eur: 12000,
          }
        }
        return plan
      })

      const response = await fetch(`/api/subscription/status?wallet=${user.wallet_address}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentSubscription({
          plan_name: data.subscription.planName,
          daily_requests: data.subscription.dailyRequests,
          status: data.subscription.status,
          expires_at: data.subscription.expiresAt,
        })
      } else {
        // Fallback to direct database query
        const { data: currentSub } = await supabase.rpc("get_current_subscription", { user_uuid: user.id })
        setCurrentSubscription(currentSub?.[0] || null)
      }

      setPlans(updatedPlans || [])
    } catch (error) {
      console.error("[v0] Failed to fetch subscription data:", error)
      toast({
        title: "Error",
        description: "Failed to load subscription data",
        variant: "destructive",
      })
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchSubscriptionData()
  }, [user, supabase, toast])

  const handleUpgrade = (planName: string, billing: "monthly" | "yearly") => {
    const plan = plans.find((p) => p.name === planName)
    if (!plan) return

    console.log("[v0] Upgrade button clicked:", { planName, billing, plan })

    const amount = billing === "monthly" ? plan.monthly_price_eur : plan.yearly_price_eur

    setPaymentModal({
      isOpen: true,
      planName,
      amount,
      billingPeriod: billing,
    })
  }

  const handlePaymentSuccess = async (signature: string) => {
    try {
      console.log("[v0] Payment successful, refreshing subscription data...")

      // Wait a moment for the database to be updated
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Refresh subscription data
      await fetchSubscriptionData()

      setPaymentModal((prev) => ({ ...prev, isOpen: false }))

      toast({
        title: "Subscription Activated",
        description: `Your ${paymentModal.planName} plan is now active!`,
      })
    } catch (error) {
      console.error("[v0] Failed to refresh subscription:", error)
      toast({
        title: "Payment Successful",
        description: "Your payment was processed. Please refresh the page to see your updated subscription.",
      })
    }
  }

  const getPlanFeatures = (planName: string) => {
    const baseFeatures = ["API access", "Basic support", "Usage analytics"]

    switch (planName) {
      case "free":
        return [...baseFeatures, "10 requests/day", "Community support"]
      case "investigator":
        return [
          ...baseFeatures,
          "300 requests/day",
          "Advanced search filters",
          "Priority support",
          "Export capabilities",
        ]
      case "pro":
        return [
          ...baseFeatures,
          "1000 requests/day",
          "Full API access",
          "Dedicated support",
          "Custom integrations",
          "Team management",
        ]
      default:
        return baseFeatures
    }
  }

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case "free":
        return <Database className="h-6 w-6" />
      case "investigator":
        return <Zap className="h-6 w-6" />
      case "pro":
        return <Shield className="h-6 w-6" />
      default:
        return <Database className="h-6 w-6" />
    }
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading subscription data...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please connect your wallet to access subscriptions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Database className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">findxo</span>
            </Link>
            <Badge variant="secondary">Subscription</Badge>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Subscription Plans</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your intelligence research needs. Pay with SOL.
          </p>
        </div>

        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plans">Available Plans</TabsTrigger>
            <TabsTrigger value="current">Current Subscription</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Subscription
                </CardTitle>
                <CardDescription>Your active subscription details</CardDescription>
              </CardHeader>
              <CardContent>
                {currentSubscription ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {getPlanIcon(currentSubscription.plan_name)}
                        <div>
                          <h3 className="text-xl font-semibold capitalize">{currentSubscription.plan_name} Plan</h3>
                          <p className="text-muted-foreground">{currentSubscription.daily_requests} requests per day</p>
                        </div>
                      </div>
                      <Badge variant={currentSubscription.status === "active" ? "default" : "secondary"}>
                        {currentSubscription.status}
                      </Badge>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Billing Cycle</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {currentSubscription.expires_at
                            ? `Expires ${new Date(currentSubscription.expires_at).toLocaleDateString()}`
                            : "No expiry (Free plan)"}
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Usage Limit</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {currentSubscription.daily_requests} API requests per day
                        </p>
                      </div>
                    </div>

                    {currentSubscription.plan_name === "free" && (
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <h4 className="font-semibold mb-2">Ready to upgrade?</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Get more requests and advanced features with our paid plans.
                        </p>
                        <Button size="sm" onClick={() => document.querySelector('[value="plans"]')?.click()}>
                          View Plans
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                    <p className="text-muted-foreground mb-4">
                      You don't have an active subscription. Choose a plan to get started.
                    </p>
                    <Button onClick={() => document.querySelector('[value="plans"]')?.click()}>View Plans</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans" className="space-y-6">
            {/* Billing Toggle */}
            <div className="flex justify-center">
              <div className="flex items-center space-x-4 p-1 bg-muted rounded-lg">
                <Button
                  variant={selectedBilling === "monthly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedBilling("monthly")}
                >
                  Monthly
                </Button>
                <Button
                  variant={selectedBilling === "yearly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedBilling("yearly")}
                >
                  Yearly
                  <Badge variant="secondary" className="ml-2">
                    Save up to 30%
                  </Badge>
                </Button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {plans.map((plan) => {
                const isCurrentPlan = currentSubscription?.plan_name === plan.name
                const price = selectedBilling === "monthly" ? plan.monthly_price_eur : plan.yearly_price_eur
                const features = getPlanFeatures(plan.name)
                const isPopular = plan.name === "investigator"

                return (
                  <Card
                    key={plan.id}
                    className={`relative ${isPopular ? "border-primary/50" : "border-border/50"} h-full flex flex-col`}
                  >
                    {isPopular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>}

                    <CardHeader className="text-center pb-8 flex-shrink-0">
                      <div className="flex justify-center mb-4">{getPlanIcon(plan.name)}</div>
                      <CardTitle className="text-2xl capitalize">{plan.name}</CardTitle>
                      <div className="text-4xl font-bold">
                        €{price}
                        {plan.name !== "free" && (
                          <span className="text-lg font-normal text-muted-foreground">
                            /{selectedBilling === "monthly" ? "month" : "year"}
                          </span>
                        )}
                      </div>
                      {plan.name !== "free" && selectedBilling === "yearly" && (
                        <div className="text-sm text-muted-foreground">
                          €{(plan.monthly_price_eur * 12).toFixed(0)} billed annually
                        </div>
                      )}
                      <CardDescription>
                        {plan.name === "free" && "Perfect for getting started"}
                        {plan.name === "investigator" && "For professional investigators"}
                        {plan.name === "pro" && "For organizations and teams"}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 flex-grow flex flex-col">
                      <div className="space-y-3 flex-grow">
                        {features.map((feature, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 mt-auto">
                        {isCurrentPlan ? (
                          <Button className="w-full bg-transparent" variant="outline" disabled>
                            Current Plan
                          </Button>
                        ) : plan.name === "free" ? (
                          <Button className="w-full bg-transparent" variant="outline" disabled>
                            Free Forever
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => {
                              console.log("[v0] Upgrade button clicked for plan:", plan.name)
                              handleUpgrade(plan.name, selectedBilling)
                            }}
                          >
                            Subscribe with SOL
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Payment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Secure Payments with Solana
                </CardTitle>
                <CardDescription>All payments are processed securely on the Solana blockchain</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold mb-2">Secure</h4>
                    <p className="text-sm text-muted-foreground">
                      Blockchain-based payments with military-grade encryption
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold mb-2">Fast</h4>
                    <p className="text-sm text-muted-foreground">Instant payments with low transaction fees</p>
                  </div>

                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold mb-2">Transparent</h4>
                    <p className="text-sm text-muted-foreground">All transactions are verifiable on the blockchain</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PaymentModal
          isOpen={paymentModal.isOpen}
          onClose={() => setPaymentModal((prev) => ({ ...prev, isOpen: false }))}
          planName={paymentModal.planName}
          amount={paymentModal.amount}
          billingPeriod={paymentModal.billingPeriod}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </div>
    </div>
  )
}
