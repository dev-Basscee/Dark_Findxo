import { SearchContent } from "@/components/search/search-content"
import { Database, Home } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme/theme-toggle"

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur-md animate-slide-up">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary group-hover:scale-110 transition-transform duration-200 animate-glow">
                <Database className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">findxo</span>
            </Link>
            <div className="flex items-center space-x-2 ml-6">
              <Button variant="outline" size="sm" asChild className="bg-transparent">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Badge variant="secondary">Intelligence Run</Badge>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Live Dark Web Search</h1>
          <p className="text-muted-foreground">Perform real-time intelligence gathering across the darknet.</p>
        </div>
        
        <SearchContent />
      </main>
    </div>
  )
}
