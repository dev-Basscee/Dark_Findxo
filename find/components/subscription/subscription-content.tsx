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
  plan: {
    name: string
    daily_requests: number
  }
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
    planId: string
    amount: number
    billingPeriod: "monthly" | "yearly"
  }>({
    isOpen: false,
    planName: "",
    planId: "",
    amount: 0,
    billingPeriod: "monthly",
  })
  const { toast } = useToast()
  const supabase = createClient()

  const fetchSubscriptionData = async () => {
    if (!user) return

    try {
      // Fetch plans from backend
      const plansResponse = await fetch('/v1/subscriptions/plans/')
      if (plansResponse.ok) {
        const data = await plansResponse.json()
        setPlans(data.results || data)
      } else {
          // Fallback to supabase if backend plans list fails
          const { data: plansData } = await supabase
            .from("subscription_plans")
            .select("*")
            .order("monthly_price_eur", { ascending: true })
          setPlans(plansData || [])
      }

      // Fetch current subscription from backend
      const subResponse = await fetch(`/v1/subscriptions/status/?wallet_address=${user.wallet_address}`)
      if (subResponse.ok) {
        const data = await subResponse.json()
        setCurrentSubscription(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch subscription data:", error)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchSubscriptionData()
  }, [user])

  const handleUpgrade = (planName: string, billing: "monthly" | "yearly") => {
    const plan = plans.find((p) => p.name === planName)
    if (!plan) return

    const amount = billing === "monthly" ? plan.monthly_price_eur : plan.yearly_price_eur

    setPaymentModal({
      isOpen: true,
      planName,
      planId: plan.id,
      amount,
      billingPeriod: billing,
    })
  }

  const handlePaymentSuccess = async () => {
    await fetchSubscriptionData()
    setPaymentModal((prev) => ({ ...prev, isOpen: false }))
    toast({ title: "Success", description: "Subscription updated!" })
  }

  return (
    <div className="min-h-screen bg-background">
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
          <Button variant="outline" size="sm" asChild><Link href="/dashboard">Dashboard</Link></Button>
        </div>
      </header>

      <div className="container py-8 max-w-7xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-2">Subscription Plans</h1>
        <p className="text-muted-foreground mb-8">Choose your plan. Pay with Solana or Paystack (Cards/Bank).</p>

        <Tabs defaultValue="plans" className="space-y-6 text-left">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plans">Available Plans</TabsTrigger>
            <TabsTrigger value="current">Current Subscription</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-6">
            <div className="flex justify-center mb-8">
              <div className="flex items-center space-x-4 p-1 bg-muted rounded-lg">
                <Button variant={selectedBilling === "monthly" ? "default" : "ghost"} size="sm" onClick={() => setSelectedBilling("monthly")}>Monthly</Button>
                <Button variant={selectedBilling === "yearly" ? "default" : "ghost"} size="sm" onClick={() => setSelectedBilling("yearly")}>Yearly <Badge variant="secondary" className="ml-2">Save 30%</Badge></Button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const isCurrent = currentSubscription?.plan?.name === plan.name
                const price = selectedBilling === "monthly" ? plan.monthly_price_eur : plan.yearly_price_eur
                return (
                  <Card key={plan.id} className={plan.name === "investigator" ? "border-primary" : ""}>
                    <CardHeader className="text-center">
                      <CardTitle className="capitalize">{plan.name}</CardTitle>
                      <div className="text-3xl font-bold">€{price}</div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary"/> {plan.daily_requests} requests/day</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary"/> API Access</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary"/> Email Support</li>
                      </ul>
                      <Button className="w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent} onClick={() => handleUpgrade(plan.name, selectedBilling)}>
                        {isCurrent ? "Current Plan" : "Upgrade"}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="current">
            <Card>
              <CardHeader><CardTitle>Active Plan</CardTitle></CardHeader>
              <CardContent>
                {currentSubscription ? (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold capitalize">{currentSubscription.plan?.name} Plan</p>
                      <p className="text-sm text-muted-foreground">Status: {currentSubscription.status}</p>
                      <p className="text-sm text-muted-foreground">Expires: {currentSubscription.expires_at ? new Date(currentSubscription.expires_at).toLocaleDateString() : 'Never'}</p>
                    </div>
                    <Badge variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}>{currentSubscription.status}</Badge>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No active subscription found.</p>
                    <Button variant="outline" onClick={() => document.querySelector('[value="plans"]')?.click()}>View Plans</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PaymentModal
          isOpen={paymentModal.isOpen}
          onClose={() => setPaymentModal((prev) => ({ ...prev, isOpen: false }))}
          planName={paymentModal.planName}
          planId={paymentModal.planId}
          amount={paymentModal.amount}
          billingPeriod={paymentModal.billingPeriod}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </div>
    </div>
  )
}
