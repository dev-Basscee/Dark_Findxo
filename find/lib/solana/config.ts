import { clusterApiUrl, Connection } from "@solana/web3.js"

// Network configuration
export const SOLANA_NETWORK = process.env.NODE_ENV === "production" ? "mainnet-beta" : "devnet"
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(SOLANA_NETWORK)

// Merchant wallet configuration
export const MERCHANT_WALLET_ADDRESS = process.env.NEXT_PUBLIC_MERCHANT_WALLET || "11111111111111111111111111111112"

// Create connection instance
export const createConnection = () => new Connection(RPC_ENDPOINT, "confirmed")

// Exchange rate configuration
export const EXCHANGE_RATE_API = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur"
