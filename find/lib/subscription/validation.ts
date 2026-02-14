export interface SubscriptionValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateSubscriptionData(data: {
  planName: string
  billingPeriod: string
  amount: number
  userWallet: string
}): SubscriptionValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate plan name
  const validPlans = ["free", "investigator", "pro"]
  if (!validPlans.includes(data.planName.toLowerCase())) {
    errors.push(`Invalid plan name: ${data.planName}`)
  }

  // Validate billing period
  const validPeriods = ["monthly", "yearly"]
  if (!validPeriods.includes(data.billingPeriod.toLowerCase())) {
    errors.push(`Invalid billing period: ${data.billingPeriod}`)
  }

  // Validate amount
  if (data.amount <= 0) {
    errors.push("Amount must be greater than 0")
  }

  // Validate expected amounts
  const expectedAmounts = {
    investigator: { monthly: 300, yearly: 2500 },
    pro: { monthly: 1000, yearly: 12000 },
  }

  const planKey = data.planName.toLowerCase() as keyof typeof expectedAmounts
  const periodKey = data.billingPeriod.toLowerCase() as keyof typeof expectedAmounts.investigator

  if (expectedAmounts[planKey] && expectedAmounts[planKey][periodKey]) {
    const expectedAmount = expectedAmounts[planKey][periodKey]
    if (data.amount !== expectedAmount) {
      errors.push(
        `Invalid amount for ${data.planName} ${data.billingPeriod}: expected €${expectedAmount}, got €${data.amount}`,
      )
    }
  }

  // Validate wallet address
  if (!data.userWallet || data.userWallet.length < 32) {
    errors.push("Invalid wallet address")
  }

  // Warnings
  if (data.planName === "free") {
    warnings.push("Free plan selected - no payment required")
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export function validatePaymentSignature(signature: string): boolean {
  // Basic validation for Solana transaction signature
  return signature && signature.length >= 64 && /^[A-Za-z0-9]+$/.test(signature)
}

export function calculateExpectedSolAmount(eurAmount: number, exchangeRate: number): number {
  return eurAmount / exchangeRate
}

export function isSubscriptionExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false // Free plan never expires
  return new Date(expiresAt) < new Date()
}

export function getSubscriptionStatus(subscription: {
  status: string
  expires_at: string | null
}): "active" | "expired" | "cancelled" {
  if (subscription.status === "cancelled") return "cancelled"
  if (isSubscriptionExpired(subscription.expires_at)) return "expired"
  return "active"
}
