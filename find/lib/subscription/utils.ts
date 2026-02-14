export interface SubscriptionPlan {
  id: string
  name: string
  daily_requests: number
  monthly_price_eur: number
  yearly_price_eur: number
}

export interface UserSubscription {
  plan_name: string
  daily_requests: number
  status: string
  expires_at: string | null
}

export const getPlanFeatures = (planName: string): string[] => {
  const baseFeatures = ["API access", "Basic support", "Usage analytics"]

  switch (planName) {
    case "free":
      return [...baseFeatures, "10 requests/day", "Community support"]
    case "investigator":
      return [...baseFeatures, "300 requests/day", "Advanced search filters", "Priority support", "Export capabilities"]
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

export const calculateYearlySavings = (monthlyPrice: number, yearlyPrice: number): number => {
  const yearlyFromMonthly = monthlyPrice * 12
  return Math.round(((yearlyFromMonthly - yearlyPrice) / yearlyFromMonthly) * 100)
}

export const formatPrice = (price: number, currency = "EUR"): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(price)
}
