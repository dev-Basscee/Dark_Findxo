import { type Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { MERCHANT_WALLET_ADDRESS } from "./config"
import { convertEurToSol as convertEurToSolRate } from "./exchange-rate"

const MERCHANT_WALLET = new PublicKey(MERCHANT_WALLET_ADDRESS)

export interface PaymentRequest {
  amount: number // Amount in EUR
  planName: string
  billingPeriod: "monthly" | "yearly"
  userWallet: string
}

export interface PaymentTransaction {
  transaction: Transaction
  amount: number // Amount in SOL
  signature?: string
}

export const convertEurToSol = async (eurAmount: number): Promise<number> => {
  return await convertEurToSolRate(eurAmount)
}

export const createPaymentTransaction = async (
  connection: Connection,
  paymentRequest: PaymentRequest,
): Promise<PaymentTransaction> => {
  const { amount, userWallet } = paymentRequest

  const solAmount = await convertEurToSol(amount)
  const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL)

  // Create transaction
  const transaction = new Transaction()

  // Add transfer instruction
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: new PublicKey(userWallet),
    toPubkey: MERCHANT_WALLET,
    lamports,
  })

  transaction.add(transferInstruction)

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = new PublicKey(userWallet)

  return {
    transaction,
    amount: solAmount,
  }
}

export const generatePaymentUrl = async (paymentRequest: PaymentRequest): Promise<string> => {
  const solAmount = await convertEurToSol(paymentRequest.amount)

  // Create Solana Pay URL
  const url = new URL("solana:")
  url.searchParams.set("recipient", MERCHANT_WALLET.toString())
  url.searchParams.set("amount", solAmount.toString())
  url.searchParams.set("label", `findxo ${paymentRequest.planName} Plan`)
  url.searchParams.set("message", `Subscribe to ${paymentRequest.planName} plan (${paymentRequest.billingPeriod})`)

  return url.toString()
}

export const createTipLink = async (paymentRequest: PaymentRequest): Promise<string> => {
  const solAmount = await convertEurToSol(paymentRequest.amount)

  try {
    // In production, replace with actual TipLink SDK
    const tipLinkData = {
      amount: solAmount,
      recipient: MERCHANT_WALLET.toString(),
      label: `findxo ${paymentRequest.planName} Subscription`,
      message: `Subscribe to ${paymentRequest.planName} plan (${paymentRequest.billingPeriod})`,
      metadata: {
        planName: paymentRequest.planName,
        billingPeriod: paymentRequest.billingPeriod,
        userWallet: paymentRequest.userWallet,
      },
    }

    // Mock TipLink URL with proper parameters
    const params = new URLSearchParams({
      amount: solAmount.toString(),
      recipient: MERCHANT_WALLET.toString(),
      label: encodeURIComponent(`findxo ${paymentRequest.planName} Subscription`),
      message: encodeURIComponent(`Subscribe to ${paymentRequest.planName} plan`),
    })

    return `https://tiplink.io/pay?${params.toString()}`
  } catch (error) {
    console.error("Failed to create TipLink:", error)
    throw new Error("Failed to generate TipLink payment")
  }
}

export const verifyPayment = async (
  connection: Connection,
  signature: string,
  expectedAmount: number,
  expectedRecipient: string,
): Promise<boolean> => {
  try {
    const transaction = await connection.getTransaction(signature, {
      commitment: "confirmed",
    })

    if (!transaction || !transaction.meta) {
      return false
    }

    // Verify transaction details
    const { preBalances, postBalances } = transaction.meta
    const accountKeys = transaction.transaction.message.accountKeys

    // Find merchant account index
    const merchantIndex = accountKeys.findIndex((key) => key.toString() === expectedRecipient)

    if (merchantIndex === -1) {
      return false
    }

    // Calculate received amount
    const receivedLamports = postBalances[merchantIndex] - preBalances[merchantIndex]
    const receivedSol = receivedLamports / LAMPORTS_PER_SOL

    // Allow for small differences due to fees
    const tolerance = 0.001 // 0.001 SOL tolerance
    return Math.abs(receivedSol - expectedAmount) <= tolerance
  } catch (error) {
    console.error("Payment verification failed:", error)
    return false
  }
}
