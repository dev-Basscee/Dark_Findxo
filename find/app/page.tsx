import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Search, Shield, Zap, Database, Key, Globe, LayoutDashboard } from "lucide-react"
import { WalletButton } from "@/components/wallet/wallet-button"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Search className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">findxo</span>
          </div>

          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="#api"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              API
            </Link>
            <Button variant="outline" size="sm" asChild className="bg-transparent">
              <Link href="/dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </nav>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 px-4">
        <div className="container max-w-6xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6">
            Powered by Solana
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance mb-6">
            Dark Web Intelligence
            <span className="text-primary"> Redefined</span>
          </h1>

          <p className="text-xl text-muted-foreground text-balance mb-8 max-w-3xl mx-auto">
            Access comprehensive dark web and darknet intelligence through our advanced OSINT platform. Secure,
            anonymous, and built for cybersecurity professionals who need reliable underground intelligence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <WalletButton />
            <Button variant="outline" size="lg" className="text-lg px-8 bg-transparent">
              View Documentation
            </Button>
          </div>

          {/* Search Demo */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-chart-1/20 rounded-lg blur-xl" />
              <Card className="relative border-border/50 bg-card/50 backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 text-left">
                    <Search className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">Search dark web marketplaces, forums, leaks...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 bg-muted/30">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Dark Web Intelligence Arsenal</h2>
            <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
              Everything you need for comprehensive darknet research, threat intelligence, and underground data
              analysis.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-border/50">
              <CardHeader>
                <Database className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Underground Database</CardTitle>
                <CardDescription>
                  Access millions of records from dark web marketplaces, forums, paste sites, and breach databases.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Lightning Fast Search</CardTitle>
                <CardDescription>
                  Advanced indexing across .onion sites and hidden services delivers results in milliseconds.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Anonymous & Secure</CardTitle>
                <CardDescription>
                  Tor-compatible infrastructure with end-to-end encryption for safe darknet intelligence gathering.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <Key className="h-8 w-8 text-primary mb-2" />
                <CardTitle>OSINT API Access</CardTitle>
                <CardDescription>
                  Integrate dark web intelligence into your threat hunting and cybersecurity applications.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <Globe className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Darknet Coverage</CardTitle>
                <CardDescription>
                  Comprehensive monitoring of Tor hidden services, I2P networks, and underground communities.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <Search className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Threat Intelligence Filters</CardTitle>
                <CardDescription>
                  Advanced filtering by threat actors, malware families, compromised credentials, and IOCs.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
              Flexible pricing for cybersecurity professionals and threat intelligence teams. Pay with SOL.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="border-border/50">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">Free</CardTitle>
                <div className="text-4xl font-bold">€0</div>
                <CardDescription>Perfect for getting started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>10 API requests per day</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Basic dark web search</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Community support</span>
                </div>
                <Button className="w-full mt-6 bg-transparent" variant="outline">
                  Get Started
                </Button>
              </CardContent>
            </Card>

            {/* Investigator Plan */}
            <Card className="border-primary/50 relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">Investigator</CardTitle>
                <div className="text-4xl font-bold">
                  €300<span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <div className="text-sm text-muted-foreground">€2,500/year (save 17%)</div>
                <CardDescription>For cybersecurity professionals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>300 API requests per day</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Advanced threat intelligence filters</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Priority support</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>IOC & threat data export</span>
                </div>
                <Button className="w-full mt-6">Subscribe with SOL</Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-border/50">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">Pro</CardTitle>
                <div className="text-4xl font-bold">
                  €1000<span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <div className="text-sm text-muted-foreground">€12,000/year (save 0%)</div>
                <CardDescription>For security teams and organizations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>1500 API requests per day</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Full OSINT API access</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Dedicated support</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Custom threat intel integrations</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Team management</span>
                </div>
                <Button className="w-full mt-6">Subscribe with SOL</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Threat Hunting?</h2>
          <p className="text-xl text-muted-foreground mb-8 text-balance">
            Connect your Solana wallet and get instant access to our dark web intelligence platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <WalletButton />
            <Button variant="outline" size="lg" className="text-lg px-8 bg-transparent">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                  <Search className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">findxo</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Professional dark web intelligence platform powered by blockchain technology.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    API
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Status
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/40 mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2024 findxo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
