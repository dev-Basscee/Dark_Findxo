import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyword, max_results = 5, depth = 0, rotate = false } = body
    const apiKey = request.headers.get("x-api-key")

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 401 })
    }

    // Call the FastAPI backend
    // In production, this would be an environment variable like process.env.BACKEND_URL
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    
    console.log(`[v0] Proxying search request to ${backendUrl}/v1/dark/search`)

    const response = await fetch(`${backendUrl}/v1/dark/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        keyword,
        max_results,
        depth,
        rotate,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Backend error:", errorData)
      return NextResponse.json(
        { error: errorData.detail || "Error from scraping backend" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Search proxy error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
