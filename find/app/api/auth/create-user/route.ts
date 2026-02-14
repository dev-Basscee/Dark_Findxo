import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json()

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 })
    }

    // Validate wallet address format (base58 encoding)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 })
    }

    try {
      const supabase = createAdminClient()

      // Try to get existing user with admin client (bypasses RLS)
      const { data: existingUser, error: queryError } = await supabase
        .from("users")
        .select("id, wallet_address, created_at, wallet_connected_at")
        .eq("wallet_address", walletAddress)
        .single()

      // If user exists, return it
      if (existingUser) {
        console.log("[v0] User already exists:", walletAddress)
        return NextResponse.json({ user: existingUser })
      }

      // If query error is not "not found", it's a real error
      if (queryError && queryError.code !== "PGRST116") {
        console.error("[v0] User query error:", queryError)
        return NextResponse.json(
          { error: `Query failed: ${queryError.message}` },
          { status: 500 }
        )
      }

      // User doesn't exist, create with admin client (bypasses RLS)
      console.log("[v0] Creating new user:", walletAddress.slice(0, 8))

      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert([{ wallet_address: walletAddress }])
        .select()
        .single()

      if (createError) {
        console.error("[v0] User creation error:", createError)
        return NextResponse.json(
          { error: `Failed to create user: ${createError.message}` },
          { status: 500 }
        )
      }

      console.log("[v0] User created successfully:", walletAddress.slice(0, 8))
      return NextResponse.json({ user: newUser })
    } catch (clientError) {
      console.error("[v0] Supabase client error:", clientError)

      if (clientError instanceof Error && clientError.message.includes("Missing Supabase service role key")) {
        return NextResponse.json(
          {
            error: "Server configuration error: Please add SUPABASE_SERVICE_ROLE_KEY to environment variables",
          },
          { status: 500 }
        )
      }

      throw clientError
    }
  } catch (error) {
    console.error("[v0] Create user error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
