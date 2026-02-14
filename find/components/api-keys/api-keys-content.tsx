"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, Copy, Trash2, Eye, EyeOff, Database } from "lucide-react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface ApiKey {
  id: string
  name: string
  key_hash: string
  status: string
  created_at: string
  last_used_at: string | null
}

const generateSecureApiKey = (): string => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const key = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `fx_${key.substring(0, 48)}`
}

const hashApiKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function ApiKeysContent() {
  const { user, loading } = useAuth()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [newKeyName, setNewKeyName] = useState("")
  const [creating, setCreating] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [newlyCreatedKeys, setNewlyCreatedKeys] = useState<Map<string, string>>(new Map())
  const [deleteConfirmations, setDeleteConfirmations] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  useEffect(() => {
    const fetchApiKeys = async () => {
      if (!user) return

      try {
        console.log("[v0] Fetching API keys for user:", user.id)
        const response = await fetch(`/api/keys?userId=${user.id}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch API keys")
        }

        const data = await response.json()
        console.log("[v0] API keys fetched:", data.keys.length)
        setApiKeys(data.keys || [])
      } catch (error) {
        console.error("[v0] Failed to fetch API keys:", error)
        toast({
          title: "Error",
          description: "Failed to load API keys",
          variant: "destructive",
        })
      } finally {
        setLoadingKeys(false)
      }
    }

    fetchApiKeys()
  }, [user, toast])

  const createApiKey = async () => {
    if (!user || !newKeyName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a name for your API key",
        variant: "destructive",
      })
      return
    }

    console.log("[v0] Starting API key creation for user:", user.id)
    console.log("[v0] Key name:", newKeyName.trim())

    setCreating(true)
    try {
      const apiKey = generateSecureApiKey()
      const hashedKey = await hashApiKey(apiKey)

      console.log("[v0] Generated API key and hash")

      // Call server endpoint to create API key (bypasses RLS)
      console.log("[v0] Calling /api/keys/create endpoint...")
      const response = await fetch("/api/keys/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          keyName: newKeyName.trim(),
          keyHash: hashedKey,
        }),
      })

      console.log("[v0] Response status:", response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] API endpoint error:", errorData)
        throw new Error(errorData.error || "Failed to create API key")
      }

      const data = await response.json()
      console.log("[v0] API key created successfully:", data.keyId)

      setNewlyCreatedKeys((prev) => new Map(prev).set(data.keyId, apiKey))

      // Refresh the list
      const listResponse = await fetch(`/api/keys?userId=${user.id}`)
      if (listResponse.ok) {
        const listData = await listResponse.json()
        setApiKeys(listData.keys || [])
      }

      setNewKeyName("")

      toast({
        title: "API Key Created!",
        description: "Your new API key is ready. Copy it now - it won't be shown again!",
      })
    } catch (error) {
      console.error("[v0] Failed to create API key:", error)
      toast({
        title: "Creation Failed",
        description: `Failed to create API key: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteClick = (keyId: string) => {
    setDeleteConfirmations((prev) => new Set(prev).add(keyId))
  }

  const cancelDelete = (keyId: string) => {
    setDeleteConfirmations((prev) => {
      const newSet = new Set(prev)
      newSet.delete(keyId)
      return newSet
    })
  }

  const confirmDelete = async (keyId: string) => {
    try {
      const response = await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId,
          userId: user?.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete API key")
      }

      setApiKeys((keys) => keys.filter((key) => key.id !== keyId))
      setDeleteConfirmations((prev) => {
        const newSet = new Set(prev)
        newSet.delete(keyId)
        return newSet
      })
      setNewlyCreatedKeys((prev) => {
        const newMap = new Map(prev)
        newMap.delete(keyId)
        return newMap
      })

      toast({
        title: "Key Deleted",
        description: "API key has been permanently deleted",
      })
    } catch (error) {
      console.error("[v0] Failed to delete API key:", error)
      toast({
        title: "Delete Failed",
        description: "Failed to delete API key",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = (text: string, keyId?: string) => {
    let textToCopy = text

    if (keyId && newlyCreatedKeys.has(keyId)) {
      textToCopy = newlyCreatedKeys.get(keyId) || text
    } else if (text === "Key hidden for security") {
      toast({
        title: "⚠️ Cannot Copy",
        description: "This key is hidden for security. Only newly created keys can be copied.",
        variant: "destructive",
      })
      return
    }

    navigator.clipboard.writeText(textToCopy)
    toast({
      title: "📋 Copied!",
      description: "API key copied to clipboard",
    })
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  if (loading || loadingKeys) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-border/40 border-t-primary transition-all duration-300 shadow-lg"></div>
            <div className="absolute inset-0 rounded-full bg-background/95 animate-pulse opacity-20"></div>
          </div>
          <p className="text-muted-foreground font-medium">Loading API keys...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Key className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-6">Please connect your wallet and sign in to access API keys.</p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary group-hover:scale-110 transition-transform duration-200">
                <Database className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">findxo</span>
            </Link>
            <Badge variant="secondary">API Keys</Badge>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild className="bg-transparent">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-6xl mx-auto">
        <div className="flex flex-col justify-between items-start mb-8 gap-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">API Keys</h1>
            <p className="text-muted-foreground text-lg">
              Manage your API keys for programmatic access to the intelligence platform.
            </p>
          </div>
        </div>

        {/* Always show create form */}
        <Card className="mb-6 border-border/50 shadow-xl animate-slide-down">
          <CardHeader>
            <CardTitle>Create New API Key</CardTitle>
            <CardDescription>Give your API key a descriptive name to help you identify it later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div>
              <Label htmlFor="keyName">API Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., Production App, Development, Mobile App"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="transition-all duration-300"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newKeyName.trim()) {
                    createApiKey()
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createApiKey} disabled={creating || !newKeyName.trim()}>
                {creating ? "Creating..." : "Create Key"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys List */}
        <div className="space-y-4">
          {apiKeys.length === 0 ? (
            <Card className="border-border/50 shadow-xl animate-fade-in">
              <CardContent className="text-center py-12">
                <Key className="h-16 w-16 text-muted-foreground mx-auto mb-4 animate-bounce" />
                <h3 className="text-xl font-semibold mb-2">No API Keys Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Create your first API key using the form above to start using our intelligence platform
                  programmatically.
                </p>
              </CardContent>
            </Card>
          ) : (
            apiKeys.map((apiKey, index) => (
              <Card
                key={apiKey.id}
                className="border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold text-lg">{apiKey.name}</h3>
                        <Badge variant={apiKey.status === "active" ? "default" : "secondary"}>{apiKey.status}</Badge>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <code className="text-sm bg-muted px-3 py-2 rounded-lg font-mono border flex-1">
                          {newlyCreatedKeys.has(apiKey.id)
                            ? newlyCreatedKeys.get(apiKey.id)
                            : visibleKeys.has(apiKey.id)
                              ? "🔒 Key hidden for security - only newly created keys are viewable"
                              : `${apiKey.key_hash.slice(0, 8)}${"•".repeat(32)}`}
                        </code>
                        {!newlyCreatedKeys.has(apiKey.id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(apiKey.id)}
                            title={visibleKeys.has(apiKey.id) ? "Hide key info" : "Show key info"}
                          >
                            {visibleKeys.has(apiKey.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              newlyCreatedKeys.has(apiKey.id)
                                ? newlyCreatedKeys.get(apiKey.id) || ""
                                : "Key hidden for security",
                              apiKey.id,
                            )
                          }
                          title="Copy API key"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>

                      {newlyCreatedKeys.has(apiKey.id) && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
                          <p className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                            ⚠️ Make sure to copy this key now - you won't be able to see it again for security reasons!
                          </p>
                        </div>
                      )}

                      <div className="text-sm text-muted-foreground">
                        Created {new Date(apiKey.created_at).toLocaleDateString()} • Last used{" "}
                        {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString() : "Never"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {deleteConfirmations.has(apiKey.id) ? (
                        <div className="flex gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => confirmDelete(apiKey.id)}
                            className="text-xs px-2"
                          >
                            Confirm Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelDelete(apiKey.id)}
                            className="text-xs px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(apiKey.id)}
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-300"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="mt-8 border-border/50 shadow-xl animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Quick Start Guide
            </CardTitle>
            <CardDescription>Get started with your API keys in seconds.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 text-green-600">✅ Authentication</h4>
                <code className="block text-sm bg-muted p-3 rounded-lg border font-mono">
                  Authorization: Bearer YOUR_API_KEY
                </code>
              </div>

              <div>
                <h4 className="font-semibold mb-3 text-blue-600">🌐 Base URL</h4>
                <code className="block text-sm bg-muted p-3 rounded-lg border font-mono">
                  https://api.findxo.io/v1/
                </code>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold mb-3 text-purple-600">🚀 Example Request</h4>
              <code className="block text-sm bg-muted p-4 rounded-lg border whitespace-pre font-mono overflow-x-auto">
                {`curl -X GET "https://api.findxo.io/v1/search" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "example search"}'`}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
