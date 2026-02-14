"use client"

import { createContext, useContext, useEffect, useState, useRef, type ReactNode, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { createClient } from "@/lib/supabase/client"

interface User {
  id: string
  wallet_address: string
  created_at: string
  wallet_connected_at: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { publicKey, connected, disconnect } = useWallet()

  const [supabase, setSupabase] = useState<any>(null)
  const authInProgress = useRef(false)
  const currentWalletRef = useRef<string | null>(null)

  // Initialize Supabase client once
  useEffect(() => {
    try {
      const client = createClient()
      setSupabase(client)
      console.log("[v0] Supabase client initialized")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to initialize Supabase"
      console.error("[v0] Supabase initialization error:", errorMsg)
      setError(errorMsg)
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    console.log("[v0] SignOut called")
    authInProgress.current = false
    currentWalletRef.current = null
    setUser(null)
    setError(null)
    try {
      await disconnect()
    } catch (err) {
      console.log("[v0] Disconnect error:", err)
    }
  }, [disconnect])

  // Main auth check effect
  useEffect(() => {
    if (!supabase) return

    const walletAddress = publicKey?.toBase58()

    // If wallet disconnected, clear user
    if (!connected || !walletAddress) {
      if (user) {
        console.log("[v0] Wallet disconnected - clearing user")
        setUser(null)
        currentWalletRef.current = null
      }
      setLoading(false)
      return
    }

    // If same wallet and user already loaded, skip auth check
    if (walletAddress === currentWalletRef.current && user) {
      setLoading(false)
      return
    }

    // Avoid concurrent auth checks
    if (authInProgress.current) {
      console.log("[v0] Auth check already in progress")
      return
    }

    const performAuth = async () => {
      authInProgress.current = true
      try {
        console.log("[v0] Performing auth check for wallet:", walletAddress.slice(0, 6))

        // Use server-side API to create/get user (bypasses RLS issues)
        const response = await fetch("/api/auth/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to authenticate")
        }

        const { user: userData } = await response.json()
        console.log("[v0] User authenticated:", userData.wallet_address)
        setUser(userData)
        currentWalletRef.current = walletAddress
        setError(null)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Authentication failed"
        console.error("[v0] Auth error:", errorMsg)
        setError(errorMsg)
        setUser(null)
        currentWalletRef.current = null
      } finally {
        setLoading(false)
        authInProgress.current = false
      }
    }

    performAuth()
  }, [supabase, connected, publicKey, user])

  if (!supabase) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p>Initializing...</p>
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-500 mb-2">Authentication Error</h2>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={{ user, loading, error, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
