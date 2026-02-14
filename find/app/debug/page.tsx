import { SubscriptionDebug } from "@/components/debug/subscription-debug"

export default function DebugPage() {
  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Debug Dashboard</h1>
        <p className="text-muted-foreground">
          Debug tools for testing the subscription system. Only available in development.
        </p>
      </div>

      <SubscriptionDebug />
    </div>
  )
}
