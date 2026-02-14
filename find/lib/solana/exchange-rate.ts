interface ExchangeRateResponse {
  solana: {
    eur: number
  }
}

let cachedRate: number | null = null
let lastFetch = 0
const CACHE_DURATION = 60000 // 1 minute cache

export const getSolEurRate = async (): Promise<number> => {
  const now = Date.now()

  // Return cached rate if still valid
  if (cachedRate && now - lastFetch < CACHE_DURATION) {
    console.log("[v0] Using cached SOL/EUR rate:", cachedRate)
    return cachedRate
  }

  try {
    console.log("[v0] Fetching fresh SOL/EUR exchange rate...")
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur")

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rate: ${response.status}`)
    }

    const data: ExchangeRateResponse = await response.json()
    const rate = data.solana.eur
    console.log("[v0] Received exchange rate data:", data)

    if (!rate || rate <= 0) {
      throw new Error("Invalid exchange rate received")
    }

    cachedRate = rate
    lastFetch = now
    console.log("[v0] Updated SOL/EUR rate:", rate)
    return rate
  } catch (error) {
    console.error("[v0] Failed to fetch SOL/EUR rate:", error)

    // Fallback to cached rate or default
    if (cachedRate) {
      console.warn("[v0] Using cached exchange rate due to API failure:", cachedRate)
      return cachedRate
    }

    // Last resort fallback rate
    console.warn("[v0] Using fallback exchange rate: 180")
    return 180 // Fallback rate
  }
}

export const convertEurToSol = async (eurAmount: number): Promise<number> => {
  console.log("[v0] Converting", eurAmount, "EUR to SOL")
  const rate = await getSolEurRate()
  const solAmount = eurAmount / rate
  console.log("[v0] Conversion result:", eurAmount, "EUR =", solAmount, "SOL at rate", rate)
  return solAmount
}
