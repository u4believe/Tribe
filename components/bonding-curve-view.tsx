"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Lock, AlertTriangle } from "lucide-react"
import BondingCurveChart from "@/components/bonding-curve-chart"
import TradePanel from "@/components/trade-panel"
import { fetchAllTokens } from "@/lib/tokens"
import type { MemeToken } from "@/lib/tokens"
import type { mockTokens } from "@/lib/mock-data"
import { formatLargeNumber } from "@/lib/utils"
import TokenComments from "@/components/token-comments"
import TokenHolders from "@/components/token-holders"
import { isTokenUnlocked } from "@/lib/contract-functions"
import { HexagonalRating } from "@/components/hexagonal-rating"

interface BondingCurveViewProps {
  token: (typeof mockTokens)[0]
  onBack: () => void
}

export default function BondingCurveView({ token: initialToken, onBack }: BondingCurveViewProps) {
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy")
  const [token, setToken] = useState<MemeToken>(initialToken)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isCheckingLock, setIsCheckingLock] = useState(true)

  const handleTradeComplete = async () => {
    try {
      const tokens = await fetchAllTokens()
      const updatedToken = tokens.find((t) => t.contractAddress === token.contractAddress)

      if (updatedToken) {
        setToken(updatedToken)
      }
    } catch (error) {
      console.error("Failed to refresh token data:", error)
    }
  }

  useEffect(() => {
    setToken(initialToken)
  }, [initialToken])

  useEffect(() => {
    const checkLockStatus = async () => {
      if (token.contractAddress && token.contractAddress !== "0x0000000000000000000000000000000000000000") {
        try {
          setIsCheckingLock(true)
          const unlocked = await isTokenUnlocked(token.contractAddress)
          setIsUnlocked(unlocked)
        } catch (error) {
          console.error("Failed to check lock status:", error)
          setIsUnlocked(false)
        } finally {
          setIsCheckingLock(false)
        }
      } else {
        setIsCheckingLock(false)
      }
    }

    checkLockStatus()
  }, [token.contractAddress])

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" onClick={onBack} className="mb-6 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Tokens
      </Button>

      {!isCheckingLock && !isUnlocked && !token.isCompleted && (
        <Card className="bg-orange-500/10 border-orange-500/50 border-2 p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-full">
              <Lock className="w-6 h-6 text-orange-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-orange-500 text-lg">Token Locked</h3>
              </div>
              <p className="text-foreground">Creator must buy 2% (20M tokens) to unlock trading for all users.</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                <p className="text-xl font-bold text-foreground">${token.currentPrice.toFixed(8)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Trust Stock Value</p>
                <p className="text-xl font-bold text-foreground">{token.marketCap.toFixed(2)} TRUST</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Max Supply</p>
                <p className="text-xl font-bold text-foreground">{formatLargeNumber(token.maxSupply)}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-card border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Bonding Curve Progress</h2>
            <BondingCurveChart token={token} />
          </Card>

          <Card className="bg-card border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Creator Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Creator Address</p>
                <p className="font-mono text-sm text-foreground break-all">{token.creator}</p>
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

          <TokenHolders tokenAddress={token.contractAddress} maxSupply={token.maxSupply} />

          <TokenComments tokenAddress={token.contractAddress} />
        </div>

        <div>
          <TradePanel token={token} onTradeComplete={handleTradeComplete} />
          <div className="mt-6">
            <HexagonalRating token={token} />
          </div>
        </div>
      </div>
    </div>
  )
}
