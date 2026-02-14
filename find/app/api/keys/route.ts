import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch all API keys for the user
    const { data: keys, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Failed to fetch API keys:", error)
      return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 })
    }

    return NextResponse.json({ keys: keys || [] })
  } catch (error) {
    console.error("[v0] Error fetching API keys:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { keyId, userId } = await request.json()

    if (!keyId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: keyId, userId" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Verify key belongs to user before deleting
    const { data: key, error: fetchError } = await supabase
      .from("api_keys")
      .select("user_id")
      .eq("id", keyId)
      .single()

    if (fetchError || !key) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 })
    }

    if (key.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Delete the key
    const { error: deleteError } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", keyId)

    if (deleteError) {
      console.error("[v0] Failed to delete API key:", deleteError)
      return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 })
    }

    console.log("[v0] API key deleted:", keyId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting API key:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
