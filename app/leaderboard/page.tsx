"use client"

import { useEffect, useState } from "react"
import Header from "@/components/header"
import Sidebar from "@/components/sidebar"
import Footer from "@/components/footer"
import { Trophy, Zap, RefreshCw } from "lucide-react"
import { getCachedLeaderboard, shouldRefreshCache, getMostActiveUsers, type LeaderboardUser } from "@/lib/leaderboard"
import { isAdmin } from "@/lib/admin-config"
import { useWallet } from "@/hooks/use-wallet"
import { Button } from "@/components/ui/button"

export default function LeaderboardPage() {
  const [mostActive, setMostActive] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const { address } = useWallet()
  const isUserAdmin = address ? isAdmin(address) : false

  useEffect(() => {
    loadLeaderboards()
  }, [])

  const loadLeaderboards = async () => {
    setLoading(true)
    try {
      const activeCache = await getCachedLeaderboard("most_active")

      const needsActiveRefresh = shouldRefreshCache(activeCache?.last_updated)

      if (!needsActiveRefresh && activeCache?.data) {
        setMostActive(activeCache.data)
        setLastUpdated(activeCache.last_updated)
      }

      if (needsActiveRefresh) {
        console.log("[v0] Cache expired, triggering background refresh...")
        triggerBackgroundRefresh()

        if (!activeCache?.data) {
          const active = await getMostActiveUsers(25)
          setMostActive(active)
        }
      }
    } catch (error) {
      console.error("[v0] Error loading leaderboards:", error)
    } finally {
      setLoading(false)
    }
  }

  const triggerBackgroundRefresh = async () => {
    try {
      const response = await fetch("/api/leaderboard/refresh", {
        method: "POST",
      })

      if (response.ok) {
        console.log("[v0] Background refresh triggered successfully")
      }
    } catch (error) {
      console.error("[v0] Error triggering background refresh:", error)
    }
  }

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      const response = await fetch("/api/leaderboard/refresh", {
        method: "POST",
      })

      if (response.ok) {
        await loadLeaderboards()
      }
    } catch (error) {
      console.error("[v0] Error refreshing leaderboard:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatLastUpdated = (timestamp: string | null) => {
    if (!timestamp) return "Never"

    const date = new Date(timestamp)
    const now = new Date()
    const hoursAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (hoursAgo < 1) return "Less than 1 hour ago"
    if (hoursAgo === 1) return "1 hour ago"
    if (hoursAgo < 24) return `${hoursAgo} hours ago`

    const daysAgo = Math.floor(hoursAgo / 24)
    if (daysAgo === 1) return "1 day ago"
    return `${daysAgo} days ago`
  }

  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 ml-16">
        <Header onCreateClick={() => {}} />
        <div className="container mx-auto px-4 py-8 pt-28">
          <div className="text-center space-y-4 mb-12">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-10 h-10 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">Leaderboard</h1>
            </div>
            <p className="text-muted-foreground text-lg">Top performers on the TRIBE Launchpad</p>

            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span>Updates daily</span>
              {lastUpdated && <span>Last updated: {formatLastUpdated(lastUpdated)}</span>}
              {isUserAdmin && (
                <Button
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  size="sm"
                  variant="outline"
                  className="gap-2 bg-transparent"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing..." : "Refresh Now"}
                </Button>
              )}
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">Most Active</h2>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : mostActive.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground">Trade tokens and post comments to earn points!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {mostActive.map((user) => (
                    <div
                      key={user.address}
                      className="flex items-center justify-between p-3 bg-background/50 rounded-lg hover:bg-background/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-primary w-8">#{user.rank}</span>
                        <div>
                          <div className="text-sm font-mono text-foreground">
                            {user.displayName || formatAddress(user.address)}
                          </div>
                          {user.displayName && (
                            <div className="text-xs text-muted-foreground font-mono">{formatAddress(user.address)}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">{user.points.toFixed(2)} pts</div>
                        <div className="text-xs text-muted-foreground">
                          {user.tradingPoints.toFixed(2)} trading + {user.commentPoints.toFixed(2)} comments
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  )
}
