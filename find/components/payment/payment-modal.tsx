"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wallet, ExternalLink, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import {
  createPaymentTransaction,
  convertEurToSol,
  generatePaymentUrl,
  createTipLink,
  verifyPayment,
} from "@/lib/solana/payment"
import { PaymentMonitor } from "@/lib/solana/payment-monitor"
import { useToast } from "@/hooks/use-toast"
import QRCode from "qrcode"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  planName: string
  amount: number
  billingPeriod: "monthly" | "yearly"
  onPaymentSuccess: (signature: string) => void
}

export function PaymentModal({
  isOpen,
  onClose,
  planName,
  amount,
  billingPeriod,
  onPaymentSuccess,
}: PaymentModalProps) {
  const { publicKey, sendTransaction, connected, wallet, connecting, disconnecting } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()

  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "qr" | "tiplink">("wallet")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [tipLinkUrl, setTipLinkUrl] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [solAmount, setSolAmount] = useState<number>(0)
  const [paymentMonitor] = useState(() => new PaymentMonitor())
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    if (isOpen) {
      console.log("[v0] Payment modal opened for:", { planName, amount, billingPeriod })
      console.log("[v0] Detailed wallet state:", {
        connected,
        publicKey: publicKey?.toString(),
        wallet: wallet?.adapter?.name,
        connecting,
        disconnecting,
        walletReady: wallet?.readyState,
      })
      convertAmountToSol()
    }
  }, [isOpen, planName, amount, billingPeriod, connected, publicKey, wallet])

  useEffect(() => {
    console.log("[v0] Wallet state changed:", {
      connected,
      publicKey: publicKey?.toString(),
      wallet: wallet?.adapter?.name,
      connecting,
      disconnecting,
    })
  }, [connected, publicKey, wallet, connecting, disconnecting])

  useEffect(() => {
    if (isOpen && solAmount > 0) {
      console.log("[v0] Generating payment options - wallet connected:", connected, "publicKey:", publicKey?.toString())
      generatePaymentOptions()
    }
  }, [isOpen, connected, publicKey, solAmount])

  const convertAmountToSol = async () => {
    try {
      console.log("[v0] Converting EUR to SOL:", amount, "EUR")
      const convertedAmount = await convertEurToSol(amount)
      console.log("[v0] Converted amount:", convertedAmount, "SOL for", amount, "EUR")
      setSolAmount(convertedAmount)
    } catch (error) {
      console.error("[v0] Failed to convert EUR to SOL:", error)
      toast({
        title: "Error",
        description: "Failed to get current exchange rate",
        variant: "destructive",
      })
    }
  }

  const generatePaymentOptions = async () => {
    try {
      console.log("[v0] Generating payment options...")
      console.log("[v0] Current wallet state:", { connected, publicKey: publicKey?.toString() })

      const merchantWallet = process.env.NEXT_PUBLIC_MERCHANT_WALLET || ""
      if (!merchantWallet) {
        console.error("[v0] Merchant wallet not configured")
        return
      }

      const walletAddress = publicKey?.toString() || merchantWallet

      const paymentUrl = await generatePaymentUrl({
        amount,
        planName,
        billingPeriod,
        userWallet: walletAddress,
      })
      console.log("[v0] Generated payment URL:", paymentUrl)

      const qrCode = await QRCode.toDataURL(paymentUrl)
      setQrCodeUrl(qrCode)

      const tipLink = await createTipLink({
        amount,
        planName,
        billingPeriod,
        userWallet: walletAddress,
      })
      console.log("[v0] Generated TipLink:", tipLink)
      setTipLinkUrl(tipLink)
    } catch (error) {
      console.error("[v0] Failed to generate payment options:", error)
      toast({
        title: "Error",
        description: "Failed to generate payment options",
        variant: "destructive",
      })
    }
  }

  const handleWalletPayment = async () => {
    console.log("[v0] Starting wallet payment - current state:", {
      connected,
      publicKey: publicKey?.toString(),
      wallet: wallet?.adapter?.name,
      connecting,
      disconnecting,
    })

    if (!wallet) {
      console.log("[v0] No wallet adapter available")
      toast({
        title: "Error",
        description: "No wallet detected. Please install and connect a Solana wallet.",
        variant: "destructive",
      })
      return
    }

    if (!connected || !publicKey) {
      console.log("[v0] Wallet not connected properly - connected:", connected, "publicKey:", publicKey?.toString())
      toast({
        title: "Error",
        description: "Please connect your wallet first. Check that your wallet is unlocked and connected.",
        variant: "destructive",
      })
      return
    }

    if (!sendTransaction) {
      console.log("[v0] sendTransaction not available")
      toast({
        title: "Error",
        description: "Wallet does not support transactions. Please try a different wallet.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    setPaymentStatus("processing")
    setErrorMessage("")

    try {
      console.log("[v0] Creating payment transaction...")

      const balance = await connection.getBalance(publicKey)
      const balanceInSol = balance / 1e9
      console.log("[v0] Wallet balance:", balanceInSol, "SOL")

      if (balanceInSol < solAmount) {
        throw new Error(
          `Insufficient balance. You have ${balanceInSol.toFixed(4)} SOL but need ${solAmount.toFixed(4)} SOL`,
        )
      }

      const { transaction } = await createPaymentTransaction(connection, {
        amount,
        planName,
        billingPeriod,
        userWallet: publicKey.toString(),
      })

      console.log("[v0] Transaction created, sending...")
      const signature = await sendTransaction(transaction, connection)
      console.log("[v0] Transaction signature:", signature)

      console.log("[v0] Waiting for confirmation...")
      const confirmationPromise = connection.confirmTransaction(signature, "confirmed")
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Transaction confirmation timeout")), 60000),
      )

      await Promise.race([confirmationPromise, timeoutPromise])
      console.log("[v0] Transaction confirmed")

      console.log("[v0] Verifying payment and updating subscription...")
      const merchantWallet = process.env.NEXT_PUBLIC_MERCHANT_WALLET || ""
      console.log("[v0] Merchant wallet:", merchantWallet)
      console.log("[v0] Expected SOL amount:", solAmount)

      if (!merchantWallet) {
        console.error("[v0] Merchant wallet not configured")
        throw new Error("Payment configuration error. Please contact support.")
      }

      // Verify payment on blockchain
      const isValid = await verifyPayment(connection, signature, solAmount, merchantWallet)

      if (!isValid) {
        throw new Error("Payment verification failed on blockchain")
      }

      console.log("[v0] Payment verified on blockchain, updating database...")

      let apiResponse
      let retryCount = 0
      const maxRetries = 3

      while (retryCount < maxRetries) {
        try {
          apiResponse = await fetch("/api/solana/verify-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              signature,
              expectedAmount: solAmount,
              userWallet: publicKey.toString(),
              planName,
              billingPeriod,
            }),
          })

          if (apiResponse.ok) {
            break
          } else {
            const errorText = await apiResponse.text()
            console.error(`[v0] API verification failed (attempt ${retryCount + 1}):`, errorText)

            if (retryCount === maxRetries - 1) {
              throw new Error(
                `Failed to update subscription after ${maxRetries} attempts. Please contact support with transaction signature: ${signature}`,
              )
            }
          }
        } catch (fetchError) {
          console.error(`[v0] API call failed (attempt ${retryCount + 1}):`, fetchError)

          if (retryCount === maxRetries - 1) {
            throw new Error(
              `Failed to update subscription after ${maxRetries} attempts. Please contact support with transaction signature: ${signature}`,
            )
          }
        }

        retryCount++
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
      }

      const result = await apiResponse!.json()
      console.log("[v0] API verification successful:", result)

      setPaymentStatus("success")
      toast({
        title: "Payment Successful",
        description: "Your subscription has been activated",
      })

      onPaymentSuccess(signature)
    } catch (error: any) {
      console.error("[v0] Payment failed:", error)
      setPaymentStatus("error")

      let errorMsg = "Transaction failed"
      if (error?.message?.includes("cancelled") || error?.message?.includes("rejected")) {
        errorMsg = "Transaction was cancelled. Please try again."
      } else if (error?.message?.includes("User rejected")) {
        errorMsg = "Wallet connection was rejected. Please approve the connection to continue."
      } else if (error?.message?.includes("insufficient") || error?.message?.includes("Insufficient")) {
        errorMsg = error.message
      } else if (error?.message?.includes("timeout")) {
        errorMsg = "Transaction timed out. Please try again."
      } else if (error?.message?.includes("configuration")) {
        errorMsg = error.message
      } else if (error?.message) {
        errorMsg = error.message
      }

      setErrorMessage(errorMsg)
      toast({
        title: "Payment Failed",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleQRPayment = async () => {
    if (!publicKey) {
      console.log("[v0] No wallet connected for QR payment")
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    console.log("[v0] Starting QR payment monitoring")
    setIsProcessing(true)
    setPaymentStatus("processing")
    setErrorMessage("")

    try {
      console.log("[v0] Monitoring wallet for payments...")
      console.log("[v0] Expected amount:", solAmount, "SOL")
      console.log("[v0] User wallet:", publicKey.toString())

      const signature = await paymentMonitor.monitorWalletPayments({
        userWallet: publicKey.toString(),
        expectedAmount: solAmount,
        timeout: 300000, // 5 minutes
      })

      if (signature) {
        console.log("[v0] QR payment detected:", signature)

        const response = await fetch("/api/solana/verify-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signature,
            expectedAmount: solAmount,
            userWallet: publicKey.toString(),
            planName,
            billingPeriod,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to verify payment and update subscription")
        }

        setPaymentStatus("success")
        toast({
          title: "Payment Successful",
          description: "Your subscription has been activated",
        })
        onPaymentSuccess(signature)
      } else {
        throw new Error("Payment timeout - no transaction detected within 5 minutes")
      }
    } catch (error: any) {
      console.error("[v0] QR payment monitoring failed:", error)
      setPaymentStatus("error")
      setErrorMessage(error?.message || "Payment monitoring failed")
      toast({
        title: "Payment Failed",
        description: error?.message || "Payment monitoring failed",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setPaymentStatus("idle")
      setErrorMessage("")
      onClose()
    }
  }

  const handleRetry = () => {
    setPaymentStatus("idle")
    setErrorMessage("")
    if (paymentMethod === "wallet") {
      handleWalletPayment()
    } else if (paymentMethod === "qr") {
      handleQRPayment()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Subscribe to {planName} Plan
          </DialogTitle>
          <DialogDescription>Complete your payment to activate your subscription</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <span className="font-medium capitalize">
                  {planName} Plan ({billingPeriod})
                </span>
                <Badge variant="secondary">€{amount}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Amount in SOL</span>
                <span>{solAmount.toFixed(4)} SOL</span>
              </div>
            </CardContent>
          </Card>

          {paymentStatus !== "idle" && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center space-x-2">
                  {paymentStatus === "processing" && (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processing payment...</span>
                    </>
                  )}
                  {paymentStatus === "success" && (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-600">Payment successful!</span>
                    </>
                  )}
                  {paymentStatus === "error" && (
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <span className="text-red-600">Payment failed</span>
                      </div>
                      {errorMessage && <p className="text-sm text-red-600 max-w-md">{errorMessage}</p>}
                      <Button onClick={handleRetry} size="sm" variant="outline">
                        Try Again
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {paymentStatus === "idle" && (
            <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="wallet">Connected Wallet</TabsTrigger>
                <TabsTrigger value="qr">QR Code</TabsTrigger>
                <TabsTrigger value="tiplink">TipLink</TabsTrigger>
              </TabsList>

              <TabsContent value="wallet" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pay with Connected Wallet</CardTitle>
                    <CardDescription>
                      {connected && publicKey
                        ? "Click below to send payment from your connected wallet"
                        : "Connect your wallet to enable direct payment"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Wallet Status</span>
                          <div className="flex items-center gap-2">
                            {connected && publicKey ? (
                              <>
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <code className="text-sm text-green-600">
                                  {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
                                </code>
                              </>
                            ) : connecting ? (
                              <>
                                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                                <span className="text-sm text-yellow-600">Connecting...</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 bg-red-500 rounded-full" />
                                <span className="text-sm text-red-600">Not connected</span>
                              </>
                            )}
                          </div>
                        </div>
                        {wallet && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Wallet: {wallet.adapter.name} ({wallet.readyState})
                          </div>
                        )}
                      </div>

                      {!connected || !publicKey ? (
                        <div className="space-y-4">
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800 mb-3 font-medium">
                              Connect your wallet to pay directly
                            </p>
                            <p className="text-xs text-blue-700 mb-4">
                              Click the button below to connect your Solana wallet and complete payment instantly.
                            </p>
                            <div className="wallet-adapter-button-trigger">
                              <WalletMultiButton />
                            </div>
                          </div>
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs text-gray-600">
                              <strong>Alternative options:</strong> You can also use QR Code or TipLink payment methods
                              without connecting a wallet.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">✓ Wallet connected and ready for payment</p>
                        </div>
                      )}

                      {connected && publicKey && (
                        <Button
                          className="w-full"
                          onClick={handleWalletPayment}
                          disabled={isProcessing || solAmount === 0 || connecting}
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing Payment...
                            </>
                          ) : (
                            <>
                              <Wallet className="h-4 w-4 mr-2" />
                              Pay {solAmount.toFixed(4)} SOL
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="qr" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Scan QR Code</CardTitle>
                    <CardDescription>Scan with any Solana wallet app to complete payment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center space-y-4">
                      {solAmount === 0 ? (
                        <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-muted">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      ) : qrCodeUrl ? (
                        <img
                          src={qrCodeUrl || "/placeholder.svg"}
                          alt="Payment QR Code"
                          className="w-48 h-48 border rounded-lg"
                        />
                      ) : (
                        <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-muted">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      )}
                      <div className="text-center space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Amount: {solAmount.toFixed(4)} SOL (€{amount})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Send exactly {solAmount.toFixed(4)} SOL to complete payment
                        </p>
                        <Button
                          onClick={handleQRPayment}
                          disabled={isProcessing || !qrCodeUrl || solAmount === 0}
                          className="w-full"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Waiting for payment...
                            </>
                          ) : (
                            "Monitor for Payment"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tiplink" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pay with TipLink</CardTitle>
                    <CardDescription>Easy payment without installing a wallet app</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Click below to open TipLink and complete your payment
                        </p>
                        {tipLinkUrl && solAmount > 0 ? (
                          <Button asChild className="w-full">
                            <a href={tipLinkUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Pay {solAmount.toFixed(4)} SOL with TipLink
                            </a>
                          </Button>
                        ) : (
                          <Button disabled className="w-full">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {solAmount === 0 ? "Loading amount..." : "Generating TipLink..."}
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        <p>
                          Amount: {solAmount.toFixed(4)} SOL (€{amount})
                        </p>
                        <p>After completing payment on TipLink, return here to activate your subscription.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              {paymentStatus === "success" ? "Close" : "Cancel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
