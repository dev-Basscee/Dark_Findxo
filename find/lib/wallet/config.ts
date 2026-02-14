"use client"

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets"
import { SolanaMobileWalletAdapter } from "@solana-mobile/wallet-adapter-mobile"
import { clusterApiUrl } from "@solana/web3.js"
import { useMemo } from "react"

import "@solana/wallet-adapter-react-ui/styles.css"

export const useWalletConfig = () => {
  const network = WalletAdapterNetwork.Devnet

  const endpoint = useMemo(() => {
    const customRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    if (customRpcUrl) {
      return customRpcUrl
    }
    return clusterApiUrl(network)
  }, [network])

  const wallets = useMemo(() => {
    try {
      const walletAdapters = [
        // Mobile Wallet Adapter - must be first for mobile detection
        new SolanaMobileWalletAdapter({
          appIdentity: {
            name: "findxo",
            uri: typeof window !== "undefined" ? window.location.origin : "https://findxo.app",
            icon: "/favicon.ico",
          },
          authorizationResultCache: {
            clear: () => {
              if (typeof window !== "undefined") {
                window.localStorage.removeItem("solana-mobile-auth")
              }
            },
            get: () => {
              if (typeof window !== "undefined") {
                const stored = window.localStorage.getItem("solana-mobile-auth")
                return stored ? JSON.parse(stored) : undefined
              }
              return undefined
            },
            set: (value) => {
              if (typeof window !== "undefined") {
                window.localStorage.setItem("solana-mobile-auth", JSON.stringify(value))
              }
            },
          },
        }),
        // Standard wallet adapters for browser extensions
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter({
          network,
        }),
      ]

      return walletAdapters
    } catch (error) {
      console.error("[v0] Wallet adapter initialization error:", error)
      // Fallback to basic adapters if mobile adapter fails
      try {
        return [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network })]
      } catch (fallbackError) {
        console.error("[v0] Fallback wallet adapter error:", fallbackError)
        return []
      }
    }
  }, [network])

  return { endpoint, wallets }
}
