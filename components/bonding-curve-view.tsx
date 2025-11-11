"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink } from "lucide-react"
import BondingCurveChart from "@/components/bonding-curve-chart"
import TradePanel from "@/components/trade-panel"
import { fetchAllTokens } from "@/lib/tokens"
import type { MemeToken } from "@/lib/tokens"
import type { mockTokens } from "@/lib/mock-data"

interface BondingCurveViewProps {
  token: (typeof mockTokens)[0]
  onBack: () => void
}

export default function BondingCurveView({ token: initialToken, onBack }: BondingCurveViewProps) {
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy")
  const [token, setToken] = useState<MemeToken>(initialToken)

  const handleTradeComplete = async () => {
    console.log("[v0] Trade completed, refreshing token data...")
    try {
      // Fetch all tokens and find the updated one
      const tokens = await fetchAllTokens()
      const updatedToken = tokens.find((t) => t.contractAddress === token.contractAddress)

      if (updatedToken) {
        setToken(updatedToken)
        console.log("[v0] Token data refreshed:", updatedToken)
      }
    } catch (error) {
      console.error("[v0] Failed to refresh token data:", error)
    }
  }

  useEffect(() => {
    setToken(initialToken)
  }, [initialToken])

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" onClick={onBack} className="mb-6 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Tokens
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Token Info & Chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Token Header */}
          <Card className="bg-card border-border p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <img
                  src={token.image || "/placeholder.svg"}
                  alt={token.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{token.name}</h1>
                  <p className="text-lg text-muted-foreground">${token.symbol}</p>
                </div>
              </div>
              {token.isAlpha && (
                <div className="px-4 py-2 rounded-lg bg-accent/20 text-accent font-semibold">✨ Alpha</div>
              )}
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                <p className="text-xl font-bold text-foreground">${token.currentPrice.toFixed(8)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Market Cap</p>
                <p className="text-xl font-bold text-foreground">${(token.marketCap / 1000000).toFixed(2)}M</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Max Supply</p>
                <p className="text-xl font-bold text-foreground">{(token.maxSupply / 1000000).toFixed(0)}M</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Holders</p>
                <p className="text-xl font-bold text-foreground">{token.holders}</p>
              </div>
            </div>
          </Card>

          {/* Bonding Curve Chart */}
          <Card className="bg-card border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Bonding Curve</h2>
            <BondingCurveChart token={token} />
          </Card>

          {/* Creator Info */}
          <Card className="bg-card border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Creator Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Creator Address</p>
                <p className="font-mono text-sm text-foreground break-all">{token.creator}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Creator Supply Holding</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground font-semibold">{token.creatorSupplyPercent}% of max supply</span>
                  <span className="text-muted-foreground text-sm">
                    {((token.maxSupply * token.creatorSupplyPercent) / 100).toLocaleString()} tokens
                  </span>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-primary to-accent h-3 rounded-full"
                    style={{ width: `${token.creatorSupplyPercent}%` }}
                  />
                </div>
              </div>
              {token.intuitionLink && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Intuition Graph Portal</p>
                  <a
                    href={token.intuitionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                  >
                    View on Intuition
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Trade Panel */}
        <div>
          <TradePanel token={token} onTradeComplete={handleTradeComplete} />
        </div>
      </div>
    </div>
  )
}
