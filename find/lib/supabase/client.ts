import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  console.log("[v0] All environment variables check:", {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    allEnvKeys: Object.keys(process.env).filter((key) => key.includes("SUPABASE")),
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log("[v0] Supabase client creation - URL exists:", !!supabaseUrl, "Key exists:", !!supabaseAnonKey)

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[v0] Missing Supabase environment variables:", {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey,
    })

    const errorMessage = `Missing Supabase environment variables. 
    Environment variables found: ${Object.keys(process.env)
      .filter((key) => key.includes("SUPABASE"))
      .join(", ")}
    
    Try these steps:
    1. Click 'Publish' to redeploy with latest environment variables
    2. Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Project Settings
    3. Ensure variables are named exactly as shown (case-sensitive)`

    throw new Error(errorMessage)
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
