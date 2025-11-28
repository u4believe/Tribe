"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { fetchAllTokens, type MemeToken } from "@/lib/tokens"
import { getUserTokenBalance } from "@/lib/user-holdings"
import { getUserPoints, updateUserPoints } from "@/lib/points-system"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, Coins, Award, RefreshCw, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

interface TokenHolding extends MemeToken {
  balance: string
  value: number
}

export default function PortfolioPage() {
  const { address } = useWallet()
  const router = useRouter()
  const [holdings, setHoldings] = useState<TokenHolding[]>([])
  const [createdTokens, setCreatedTokens] = useState<MemeToken[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalValue, setTotalValue] = useState(0)

  const [userPoints, setUserPoints] = useState<number>(0)
  const [totalVolume, setTotalVolume] = useState<number>(0)
  const [isRefreshingPoints, setIsRefreshingPoints] = useState(false)
  const [pointsTableMissing, setPointsTableMissing] = useState(false)

  useEffect(() => {
    const loadPortfolio = async () => {
      if (!address) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const allTokens = await fetchAllTokens()

        const created = allTokens.filter((token) => token.creator.toLowerCase() === address.toLowerCase())
        setCreatedTokens(created)

        const holdingsPromises = allTokens.map(async (token) => {
          if (!token.contractAddress) return null

          const balance = await getUserTokenBalance(token.contractAddress, address)
          const balanceNum = Number.parseFloat(balance)

          if (balanceNum > 0) {
            const value = balanceNum * (token.currentPrice || 0)
            return { ...token, balance, value }
          }
          return null
        })

        const resolvedHoldings = (await Promise.all(holdingsPromises)).filter((h): h is TokenHolding => h !== null)
        setHoldings(resolvedHoldings)

        const total = resolvedHoldings.reduce((sum, holding) => sum + holding.value, 0)
        setTotalValue(total)

        const points = await getUserPoints(address)
        if (points) {
          setUserPoints(points.points)
          setTotalVolume(points.totalVolume)
          setPointsTableMissing(false)
        } else {
          setPointsTableMissing(true)
        }
      } catch (error) {
        console.error("[v0] Error loading portfolio:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPortfolio()
  }, [address])

  const handleRefreshPoints = async () => {
    if (!address) return

    setIsRefreshingPoints(true)
    try {
      const result = await updateUserPoints(address)
      if (result) {
        setUserPoints(result.points)
        setTotalVolume(result.totalVolume)
      }
    } catch (error) {
      console.error("[v0] Error refreshing points:", error)
    } finally {
      setIsRefreshingPoints(false)
    }
  }

  if (!address) {
    return (
      <main className="min-h-screen bg-background pt-36">
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Portfolio</h1>
          <p className="text-muted-foreground">Connect your wallet to view your portfolio</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background pt-36">
      <div className="container mx-auto px-4 py-8">
        <Button onClick={() => router.push("/")} variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Launchpad
        </Button>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 p-8">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
                <h2 className="text-4xl font-bold text-foreground">{totalValue.toFixed(2)} TRUST</h2>
                <p className="text-sm text-accent">Based on current market prices</p>
              </div>
            </Card>

            <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20 p-8">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <p className="text-sm text-muted-foreground">Trading Points</p>
                  </div>
                  <Button
                    onClick={handleRefreshPoints}
                    disabled={isRefreshingPoints}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshingPoints ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <h2 className="text-4xl font-bold text-foreground">{userPoints.toFixed(2)}</h2>
                <p className="text-sm text-amber-500">{totalVolume.toFixed(2)} TRUST Total Volume</p>
                {pointsTableMissing && (
                  <div className="mt-3 flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-500">
                      Points are calculated from blockchain but not persisted. Run the migration script to enable full
                      points tracking.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Your Holdings</h2>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading your holdings...</p>
              </div>
            ) : holdings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {holdings.map((holding) => (
                  <Card key={holding.id} className="bg-card border-border p-6 hover:border-primary/50 transition-all">
                    <div className="flex items-start gap-4">
                      <img
                        src={holding.image || "/placeholder.svg"}
                        alt={holding.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate">{holding.name}</h3>
                        <p className="text-xs text-muted-foreground">${holding.symbol}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Balance</span>
                        <span className="font-semibold text-foreground">
                          {Number.parseFloat(holding.balance).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Value</span>
                        <span className="font-semibold text-accent">{holding.value.toFixed(2)} TRUST</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Price</span>
                        <span className="font-semibold text-foreground">${holding.currentPrice?.toFixed(8)}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => router.push(`/?token=${holding.id}`)}
                      className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      View Token
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border p-12 text-center">
                <p className="text-muted-foreground">You don't hold any tokens yet</p>
              </Card>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-accent" />
              <h2 className="text-2xl font-bold text-foreground">Tokens You Created</h2>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading your tokens...</p>
              </div>
            ) : createdTokens.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {createdTokens.map((token) => (
                  <Card key={token.id} className="bg-card border-border p-6 hover:border-accent/50 transition-all">
                    <div className="flex items-start gap-4">
                      <img
                        src={token.image || "/placeholder.svg"}
                        alt={token.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate">{token.name}</h3>
                        <p className="text-xs text-muted-foreground">${token.symbol}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Market Cap</span>
                        <span className="font-semibold text-foreground">
                          ${((token.marketCap || 0) / 1000000).toFixed(2)}M
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Current Price</span>
                        <span className="font-semibold text-accent">${token.currentPrice?.toFixed(8)}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => router.push(`/?token=${token.id}`)}
                      className="w-full mt-4 bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      View Token
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border p-12 text-center">
                <p className="text-muted-foreground">You haven't created any tokens yet</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
