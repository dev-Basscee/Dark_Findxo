"use client"

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { useWalletConfig } from "@/lib/wallet/config"
import type { ReactNode } from "react"

interface WalletContextProviderProps {
  children: ReactNode
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const { endpoint, wallets } = useWalletConfig()

  if (!endpoint) {
    console.error("[v0] No Solana RPC endpoint available")
    return <div>{children}</div>
  }

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{
        commitment: "confirmed",
        wsEndpoint: undefined,
      }}
    >
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={(error) => {
          console.error("[v0] Wallet provider error:", error)
          console.error("[v0] Error details:", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
          })
        }}
        localStorageKey="wallet-adapter"
      >
        <WalletModalProvider featuredWallets={2}>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
