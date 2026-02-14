"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"

export function WalletButton() {
  const { publicKey, connected, disconnect } = useWallet()
  const { user, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const handleDisconnect = async () => {
    setError(null)
    await disconnect()
  }

  // Clear error when wallet connects/disconnects
  useEffect(() => {
    if (connected || !connected) {
      setError(null)
    }
  }, [connected])

  if (loading) {
    return (
      <div className="flex items-center gap-3 animate-in fade-in-0 slide-in-from-right-5 duration-300">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-muted-foreground">Connecting...</span>
        </div>
      </div>
    )
  }

  if (connected && publicKey && user) {
    return (
      <div className="flex items-center gap-3 animate-in fade-in-0 slide-in-from-right-5 duration-300">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-green-600">
            {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          className="hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all duration-200 bg-transparent"
        >
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <div className="wallet-adapter-button-trigger animate-in fade-in-0 slide-in-from-left-5 duration-300">
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <p className="text-sm text-red-600 mb-2">{error}</p>
        </div>
      )}
      <WalletMultiButton />
    </div>
  )
}
