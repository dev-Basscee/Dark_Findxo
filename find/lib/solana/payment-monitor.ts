import { type Connection, PublicKey } from "@solana/web3.js"
import { createConnection, MERCHANT_WALLET_ADDRESS } from "./config"

interface PaymentMonitorOptions {
  signature?: string
  userWallet: string
  expectedAmount: number
  timeout?: number // milliseconds
}

export class PaymentMonitor {
  private connection: Connection
  private merchantWallet: PublicKey

  constructor() {
    this.connection = createConnection()
    this.merchantWallet = new PublicKey(MERCHANT_WALLET_ADDRESS)
  }

  // Monitor for a specific transaction signature
  async monitorTransaction(options: PaymentMonitorOptions): Promise<boolean> {
    const { signature, timeout = 300000 } = options // 5 minute default timeout

    if (!signature) {
      throw new Error("Transaction signature is required")
    }

    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const transaction = await this.connection.getTransaction(signature, {
          commitment: "confirmed",
        })

        if (transaction && transaction.meta) {
          // Transaction found and confirmed
          return await this.verifyAndUpdatePayment(signature, options)
        }

        // Wait 2 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        console.error("Error monitoring transaction:", error)
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    return false // Timeout reached
  }

  // Monitor merchant wallet for incoming payments
  async monitorWalletPayments(options: Omit<PaymentMonitorOptions, "signature">): Promise<string | null> {
    const { userWallet, expectedAmount, timeout = 300000 } = options
    const startTime = Date.now()
    let lastSignature: string | null = null

    while (Date.now() - startTime < timeout) {
      try {
        const signatures = await this.connection.getSignaturesForAddress(
          this.merchantWallet,
          { limit: 10 },
          "confirmed",
        )

        for (const sigInfo of signatures) {
          if (sigInfo.signature === lastSignature) break

          const transaction = await this.connection.getTransaction(sigInfo.signature, {
            commitment: "confirmed",
          })

          if (this.isMatchingPayment(transaction, userWallet, expectedAmount)) {
            return sigInfo.signature
          }
        }

        if (signatures.length > 0) {
          lastSignature = signatures[0].signature
        }

        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error) {
        console.error("Error monitoring wallet payments:", error)
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    return null
  }

  private isMatchingPayment(transaction: any, userWallet: string, expectedAmount: number): boolean {
    if (!transaction || !transaction.meta) return false

    const { preBalances, postBalances } = transaction.meta
    const accountKeys = transaction.transaction.message.accountKeys

    // Find user and merchant account indices
    const userIndex = accountKeys.findIndex((key: PublicKey) => key.toString() === userWallet)
    const merchantIndex = accountKeys.findIndex((key: PublicKey) => key.toString() === this.merchantWallet.toString())

    if (userIndex === -1 || merchantIndex === -1) return false

    // Calculate transferred amount
    const userBalanceChange = preBalances[userIndex] - postBalances[userIndex]
    const merchantBalanceChange = postBalances[merchantIndex] - preBalances[merchantIndex]

    const transferredSol = userBalanceChange / 1e9 // Convert lamports to SOL
    const receivedSol = merchantBalanceChange / 1e9

    // Allow for small differences due to fees (0.1% tolerance)
    const tolerance = expectedAmount * 0.001
    return Math.abs(transferredSol - expectedAmount) <= tolerance && receivedSol > 0
  }

  private async verifyAndUpdatePayment(signature: string, options: PaymentMonitorOptions): Promise<boolean> {
    try {
      // Call API route to update payment status
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature,
          userWallet: options.userWallet,
          expectedAmount: options.expectedAmount,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to verify payment")
      }

      const result = await response.json()
      return result.success
    } catch (error) {
      console.error("Payment verification failed:", error)
      return false
    }
  }
}
