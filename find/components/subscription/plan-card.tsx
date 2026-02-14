"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"

interface PlanCardProps {
  name: string
  price: number
  billingPeriod: "monthly" | "yearly"
  features: string[]
  isPopular?: boolean
  isCurrentPlan?: boolean
  onSubscribe: () => void
}

export function PlanCard({
  name,
  price,
  billingPeriod,
  features,
  isPopular = false,
  isCurrentPlan = false,
  onSubscribe,
}: PlanCardProps) {
  return (
    <Card className={`relative ${isPopular ? "border-primary/50" : "border-border/50"}`}>
      {isPopular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>}

      <CardHeader className="text-center pb-8">
        <CardTitle className="text-2xl capitalize">{name}</CardTitle>
        <div className="text-4xl font-bold">
          €{price}
          {name !== "free" && (
            <span className="text-lg font-normal text-muted-foreground">
              /{billingPeriod === "monthly" ? "month" : "year"}
            </span>
          )}
        </div>
        <CardDescription>
          {name === "free" && "Perfect for getting started"}
          {name === "investigator" && "For professional investigators"}
          {name === "pro" && "For organizations and teams"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-3">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>

        <div className="pt-4">
          {isCurrentPlan ? (
            <Button className="w-full bg-transparent" variant="outline" disabled>
              Current Plan
            </Button>
          ) : name === "free" ? (
            <Button className="w-full bg-transparent" variant="outline" disabled>
              Free Forever
            </Button>
          ) : (
            <Button className="w-full" onClick={onSubscribe}>
              Subscribe with SOL
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
