"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wallet, ExternalLink, CheckCircle, AlertCircle, Loader2, CreditCard } from "lucide-react"
import { useEffect, useState } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import {
  createPaymentTransaction,
  convertEurToSol,
  generatePaymentUrl,
  createTipLink,
} from "@/lib/solana/payment"
import { PaymentMonitor } from "@/lib/solana/payment-monitor"
import { useToast } from "@/hooks/use-toast"
import QRCode from "qrcode"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  planName: string
  planId: string
  amount: number
  billingPeriod: "monthly" | "yearly"
  onPaymentSuccess: () => void
}

export function PaymentModal({
  isOpen,
  onClose,
  planName,
  planId,
  amount,
  billingPeriod,
  onPaymentSuccess,
}: PaymentModalProps) {
  const { publicKey, sendTransaction, connected, wallet } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()

  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "qr" | "tiplink" | "paystack">("paystack")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [tipLinkUrl, setTipLinkUrl] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [solAmount, setSolAmount] = useState<number>(0)
  const [paymentMonitor] = useState(() => new PaymentMonitor())
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    if (isOpen) {
      convertAmountToSol()
    }
  }, [isOpen, amount])

  useEffect(() => {
    if (isOpen && solAmount > 0) {
      generatePaymentOptions()
    }
  }, [isOpen, connected, publicKey, solAmount])

  const convertAmountToSol = async () => {
    try {
      const convertedAmount = await convertEurToSol(amount)
      setSolAmount(convertedAmount)
    } catch (error) {
      console.error("[v0] Failed to convert EUR to SOL:", error)
    }
  }

  const generatePaymentOptions = async () => {
    try {
      const merchantWallet = process.env.NEXT_PUBLIC_MERCHANT_WALLET || ""
      if (!merchantWallet) return

      const walletAddress = publicKey?.toString() || merchantWallet

      const paymentUrl = await generatePaymentUrl({
        amount,
        planName,
        billingPeriod,
        userWallet: walletAddress,
      })

      const qrCode = await QRCode.toDataURL(paymentUrl)
      setQrCodeUrl(qrCode)

      const tipLink = await createTipLink({
        amount,
        planName,
        billingPeriod,
        userWallet: walletAddress,
      })
      setTipLinkUrl(tipLink)
    } catch (error) {
      console.error("[v0] Failed to generate payment options:", error)
    }
  }

  const handlePaystackPayment = async () => {
    if (!publicKey) {
        toast({ title: "Error", description: "Please connect your wallet first", variant: "destructive" })
        return
    }
    setIsProcessing(true)
    setPaymentStatus("processing")
    
    try {
      const response = await fetch("/v1/subscriptions/subscribe/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          billing_period: billingPeriod,
          wallet_address: publicKey.toString()
        })
      })

      const data = await response.json()
      if (response.ok && data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        throw new Error(data.detail || "Failed to initialize Paystack")
      }
    } catch (error: any) {
      setPaymentStatus("error")
      setErrorMessage(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleWalletPayment = async () => {
    if (!wallet || !connected || !publicKey || !sendTransaction) {
      toast({ title: "Error", description: "Please connect your wallet first", variant: "destructive" })
      return
    }

    setIsProcessing(true)
    setPaymentStatus("processing")
    setErrorMessage("")

    try {
      const { transaction } = await createPaymentTransaction(connection, {
        amount,
        planName,
        billingPeriod,
        userWallet: publicKey.toString(),
      })

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, "confirmed")

      // Verify on backend
      const apiResponse = await fetch("/v1/subscriptions/solana-verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          expected_amount: solAmount,
          wallet_address: publicKey.toString(),
          plan_id: planId,
          billing_period: billingPeriod,
        }),
      })

      if (!apiResponse.ok) {
          const err = await apiResponse.json()
          throw new Error(err.detail || "Backend verification failed")
      }

      setPaymentStatus("success")
      onPaymentSuccess()
    } catch (error: any) {
      setPaymentStatus("error")
      setErrorMessage(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleQRPayment = async () => {
    if (!publicKey) return
    setIsProcessing(true)
    setPaymentStatus("processing")

    try {
      const signature = await paymentMonitor.monitorWalletPayments({
        userWallet: publicKey.toString(),
        expectedAmount: solAmount,
      })

      if (signature) {
        const response = await fetch("/v1/subscriptions/solana-verify/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature,
            expected_amount: solAmount,
            wallet_address: publicKey.toString(),
            plan_id: planId,
            billing_period: billingPeriod,
          }),
        })

        if (!response.ok) {
            const err = await response.json()
            throw new Error(err.detail || "Verification failed")
        }

        setPaymentStatus("success")
        onPaymentSuccess()
      }
    } catch (error: any) {
      setPaymentStatus("error")
      setErrorMessage(error.message)
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscribe to {planName} Plan
          </DialogTitle>
          <DialogDescription>Choose your preferred payment method</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium capitalize">{planName} Plan</span>
                <Badge variant="secondary">€{amount} / {billingPeriod}</Badge>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Solana Amount</span>
                <span>~{solAmount.toFixed(4)} SOL</span>
              </div>
            </CardContent>
          </Card>

          {paymentStatus !== "idle" && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center space-y-4">
                  {paymentStatus === "processing" && (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p>Processing your payment...</p>
                    </>
                  )}
                  {paymentStatus === "success" && (
                    <>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                      <p className="text-green-600 font-medium">Payment successful!</p>
                    </>
                  )}
                  {paymentStatus === "error" && (
                    <>
                      <AlertCircle className="h-8 w-8 text-red-500" />
                      <p className="text-red-600 font-medium">Payment failed</p>
                      <p className="text-sm text-center text-muted-foreground">{errorMessage}</p>
                      <Button onClick={() => setPaymentStatus("idle")} variant="outline">Try again</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {paymentStatus === "idle" && (
            <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="paystack">Paystack</TabsTrigger>
                <TabsTrigger value="wallet">Wallet</TabsTrigger>
                <TabsTrigger value="qr">QR Code</TabsTrigger>
                <TabsTrigger value="tiplink">TipLink</TabsTrigger>
              </TabsList>

              <TabsContent value="paystack" className="space-y-4 pt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Card / Bank / Mobile Money</CardTitle>
                    <CardDescription>Secure payment via Paystack</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={handlePaystackPayment}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Pay €{amount} with Paystack
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wallet" className="space-y-4 pt-4">
                <Card>
                  <CardContent className="pt-6">
                    {!connected ? (
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-sm text-muted-foreground">Connect your Solana wallet to pay directly</p>
                        <WalletMultiButton />
                      </div>
                    ) : (
                      <Button className="w-full" onClick={handleWalletPayment}>
                        <Wallet className="h-4 w-4 mr-2" />
                        Pay {solAmount.toFixed(4)} SOL
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="qr" className="space-y-4 pt-4">
                <Card>
                  <CardContent className="pt-6 flex flex-col items-center gap-4">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 border rounded-lg" />
                    ) : (
                      <div className="w-48 h-48 bg-muted animate-pulse rounded-lg" />
                    )}
                    <p className="text-xs text-muted-foreground text-center">Scan with any Solana wallet</p>
                    <Button variant="outline" size="sm" onClick={handleQRPayment}>Monitor for Payment</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tiplink" className="space-y-4 pt-4">
                <Card>
                  <CardContent className="pt-6">
                    <Button asChild className="w-full">
                      <a href={tipLinkUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open TipLink
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" onClick={handleClose} disabled={isProcessing}>
              {paymentStatus === "success" ? "Done" : "Cancel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
