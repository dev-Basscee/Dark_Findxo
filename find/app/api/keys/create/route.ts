import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] /api/keys/create called")
    const body = await request.json()
    const { keyName, keyHash, userId } = body
    
    console.log("[v0] Request body received:", { keyName: keyName?.substring(0, 20), keyHash: keyHash?.substring(0, 20), userId })

    if (!keyName || !keyHash || !userId) {
      console.error("[v0] Missing required fields")
      return NextResponse.json(
        { error: "Missing required fields: keyName, keyHash, userId" },
        { status: 400 }
      )
    }

    console.log("[v0] Creating Supabase admin client...")
    const supabase = createAdminClient()

    // Create API key with admin client (bypasses RLS)
    console.log("[v0] Inserting API key into database...")
    const { data: newKey, error: createError } = await supabase
      .from("api_keys")
      .insert({
        user_id: userId,
        name: keyName,
        key_hash: keyHash,
        status: "active",
      })
      .select()
      .single()

    if (createError) {
      console.error("[v0] API key creation error:", {
        message: createError.message,
        code: createError.code,
        details: createError.details,
      })
      return NextResponse.json(
        { error: `Failed to create API key: ${createError.message}` },
        { status: 500 }
      )
    }

    console.log("[v0] API key created successfully:", newKey.id)

    return NextResponse.json({
      success: true,
      keyId: newKey.id,
      name: newKey.name,
      createdAt: newKey.created_at,
    })
  } catch (error) {
    console.error("[v0] API key creation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
