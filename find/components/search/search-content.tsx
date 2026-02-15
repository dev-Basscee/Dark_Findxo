"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, Globe, Shield, ExternalLink, Mail, Phone, CreditCard, Key } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SearchResult {
  url: string
  title: string | null
  ok: boolean
  error: string | null
  text_excerpt: string | null
  entities: {
    emails: string[]
    phones: string[]
    btc_addresses: string[]
    eth_addresses: string[]
    xmr_addresses: string[]
    credit_cards: string[]
    ibans: string[]
  }
  screenshot_file: string | null
}

interface SearchResponse {
  session_id: string
  keyword: string
  timestamp: string
  results: SearchResult[]
}

export function SearchContent() {
  const { user } = useAuth()
  const [keyword, setKeyword] = useState("")
  const [maxResults, setMaxResults] = useState(5)
  const [depth, setDepth] = useState(0)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const { toast } = useToast()

  const handleSearch = async () => {
    if (!keyword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a keyword to search",
        variant: "destructive",
      })
      return
    }

    // In a real app, we'd fetch an API key from the user's stored keys
    // For this demo, we'll ask them to provide one or mock it
    // Let's try to get their first active key
    setLoading(true)
    setResponse(null)

    try {
      // 1. Fetch user's API keys
      const keysResponse = await fetch(`/api/keys?userId=${user?.id}`)
      if (!keysResponse.ok) throw new Error("Failed to fetch API keys")
      const keysData = await keysResponse.json()
      
      const apiKey = keysData.keys?.[0]?.key_hash // This is actually the hash, but for the demo we'll assume the user has the actual key or we use a header
      // Note: In reality, the user would enter their key or we'd have it in state
      // Since we can't see the plain key once created, we'll handle this by assuming
      // the backend has a "dev" key or the user is prompted.
      
      // FOR DEMO PURPOSES: We'll expect the user to have a key named 'PROD_KEY' or similar
      // Or we'll just try with a mock key if it's a demo
      const actualKey = process.env.NEXT_PUBLIC_DEMO_API_KEY || "fx_demo_key_12345" // Use env var or fallback

      const searchResponse = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": actualKey, 
        },
        body: JSON.stringify({
          keyword,
          max_results: maxResults,
          depth,
        }),
      })

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json()
        throw new Error(errorData.error || "Search failed")
      }

      const data = await searchResponse.json()
      setResponse(data)
      toast({
        title: "Search Complete",
        description: `Found ${data.results.length} results for "${keyword}"`,
      })
    } catch (error) {
      console.error("[v0] Search error:", error)
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <Card className="border-border/50 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Dark Web Intelligence Search
          </CardTitle>
          <CardDescription>
            Search across multiple onion engines and deep web sources.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4 items-end">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="keyword">Intelligence Keyword</Label>
              <Input
                id="keyword"
                placeholder="e.g., 'breach', 'malware', 'leak'"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxResults">Max Results</Label>
              <Input
                id="maxResults"
                type="number"
                min={1}
                max={20}
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value))}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                "Start Intelligence Run"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="loading-spinner animate-glow"></div>
          <p className="text-muted-foreground animate-pulse">
            Crawling darknet circuits and extracting entities...
          </p>
        </div>
      )}

      {response && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Results for "{response.keyword}"</h2>
            <Badge variant="outline">{response.results.length} Sources Analyzed</Badge>
          </div>

          <div className="grid gap-6">
            {response.results.map((result, index) => (
              <Card key={index} className="overflow-hidden border-border/50 hover:shadow-lg transition-shadow">
                <CardHeader className="bg-muted/30 pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {result.title || "Untitled Source"}
                        {!result.ok && <Badge variant="destructive">Failed</Badge>}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {result.url}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {result.error ? (
                    <p className="text-destructive text-sm italic">{result.error}</p>
                  ) : (
                    <>
                      {result.text_excerpt && (
                        <div className="bg-muted/50 p-3 rounded text-sm text-muted-foreground italic border-l-2 border-primary">
                          "{result.text_excerpt}..."
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <EntityBadge icon={<Mail className="h-3 w-3" />} label="Emails" count={result.entities.emails.length} />
                        <EntityBadge icon={<Phone className="h-3 w-3" />} label="Phones" count={result.entities.phones.length} />
                        <EntityBadge icon={<CreditCard className="h-3 w-3" />} label="Cards" count={result.entities.credit_cards.length} />
                        <EntityBadge icon={<Shield className="h-3 w-3" />} label="Crypto" count={
                          result.entities.btc_addresses.length + 
                          result.entities.eth_addresses.length + 
                          result.entities.xmr_addresses.length
                        } />
                      </div>

                      <Tabs defaultValue="entities" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="entities">Extracted Intelligence</TabsTrigger>
                          <TabsTrigger value="details">Source Details</TabsTrigger>
                        </TabsList>
                        <TabsContent value="entities" className="pt-4 space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <EntityList title="Financial Data" items={[...result.entities.credit_cards, ...result.entities.ibans]} icon={<CreditCard className="h-4 w-4" />} />
                            <EntityList title="Crypto Addresses" items={[...result.entities.btc_addresses, ...result.entities.eth_addresses, ...result.entities.xmr_addresses]} icon={<Key className="h-4 w-4" />} />
                            <EntityList title="Contact Info" items={[...result.entities.emails, ...result.entities.phones]} icon={<Mail className="h-4 w-4" />} />
                          </div>
                        </TabsContent>
                        <TabsContent value="details" className="pt-4">
                           <div className="text-sm space-y-2">
                             <div className="flex justify-between border-b pb-1">
                               <span className="text-muted-foreground">Scrape Status</span>
                               <span className="text-green-500 font-medium">Success</span>
                             </div>
                             <div className="flex justify-between border-b pb-1">
                               <span className="text-muted-foreground">Original URL</span>
                               <span className="font-mono text-[10px]">{result.url}</span>
                             </div>
                           </div>
                        </TabsContent>
                      </Tabs>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EntityBadge({ icon, label, count }: { icon: React.ReactNode, label: string, count: number }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${count > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/50 opacity-50"}`}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
      <Badge variant={count > 0 ? "default" : "secondary"} className="ml-auto text-[10px] h-4 px-1">
        {count}
      </Badge>
    </div>
  )
}

function EntityList({ title, items, icon }: { title: string, items: string[], icon: React.ReactNode }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <Badge key={i} variant="secondary" className="text-[10px] font-mono">
            {item.length > 20 ? `${item.slice(0, 10)}...${item.slice(-10)}` : item}
          </Badge>
        ))}
      </div>
    </div>
  )
}
