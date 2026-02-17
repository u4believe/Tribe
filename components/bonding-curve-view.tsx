"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Lock, AlertTriangle, Clock } from "lucide-react"
import LivePriceChart from "@/components/live-price-chart"
import TradePanel from "@/components/trade-panel"
import { fetchAllTokens } from "@/lib/tokens"
import type { MemeToken } from "@/lib/tokens"
import type { mockTokens } from "@/lib/mock-data"
import { formatLargeNumber } from "@/lib/utils"
import TokenComments from "@/components/token-comments"
import TokenHolders from "@/components/token-holders"
import { isTokenUnlocked, getTokenInfo, getCurrentPrice } from "@/lib/contract-functions"
import { formatEther } from "ethers"
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
  const [liveMarketCap, setLiveMarketCap] = useState<number | null>(null)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [liveSupply, setLiveSupply] = useState<number | null>(null)

  useEffect(() => {
    const fetchLiveData = async () => {
      if (!token.contractAddress || !token.contractAddress.startsWith("0x") || token.contractAddress.length !== 42) return
      try {
        const [info, price] = await Promise.all([
          getTokenInfo(token.contractAddress),
          getCurrentPrice(token.contractAddress),
        ])
        if (info && price) {
          const supply = Number.parseFloat(formatEther(info.currentSupply))
          const priceNum = Number.parseFloat(price)
          setLiveSupply(supply)
          setLivePrice(priceNum)
          setLiveMarketCap(supply * priceNum)
        }
      } catch (error) {
        console.log("[v0] Could not fetch live token data, using database values")
      }
    }
    fetchLiveData()
  }, [token.contractAddress])

  const handleTradeComplete = async () => {
    try {
      const tokens = await fetchAllTokens()
      const updatedToken = tokens.find((t) => t.contractAddress === token.contractAddress)

      if (updatedToken) {
        setToken(updatedToken)
      }

      if (token.contractAddress && token.contractAddress.startsWith("0x") && token.contractAddress.length === 42) {
        const [info, price] = await Promise.all([
          getTokenInfo(token.contractAddress),
          getCurrentPrice(token.contractAddress),
        ])
        if (info && price) {
          const supply = Number.parseFloat(formatEther(info.currentSupply))
          const priceNum = Number.parseFloat(price)
          setLiveSupply(supply)
          setLivePrice(priceNum)
          setLiveMarketCap(supply * priceNum)
        }
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
    <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 pb-24 md:pb-8">
      <Button variant="ghost" onClick={onBack} className="mb-4 md:mb-6 text-muted-foreground hover:text-foreground text-sm">
        <ArrowLeft className="w-4 h-4 mr-1 md:mr-2" />
        Back
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <Card className="bg-card border-border p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 md:mb-6">
              <div className="flex items-center gap-3 md:gap-4">
                <img
                  src={token.image || "/placeholder.svg"}
                  alt={token.name}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-xl md:text-3xl font-bold text-foreground truncate">{token.name}</h1>
                  <p className="text-sm md:text-lg text-muted-foreground">${token.symbol}</p>
                </div>
              </div>
              {token.intuitionLink && (
                <a
                  href={token.intuitionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-yellow-500/20 text-yellow-400 font-semibold border border-yellow-500/40 hover:bg-yellow-500/30 transition-colors text-sm self-start flex-shrink-0"
                >
                  Portal <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <div>
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Current Price</p>
                <p className="text-sm md:text-xl font-bold text-foreground">${(livePrice ?? token.currentPrice).toFixed(6)}</p>
              </div>
              <div>
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Stock Value</p>
                <p className="text-sm md:text-xl font-bold text-foreground">{(liveMarketCap ?? token.marketCap).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-1">Max Supply</p>
                <p className="text-sm md:text-xl font-bold text-foreground">{formatLargeNumber(token.maxSupply)}</p>
              </div>
            </div>

            {token.createdAt && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs md:text-sm text-muted-foreground">Created</span>
                <span className="text-xs md:text-sm font-medium text-foreground">
                  {new Date(token.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  {" at "}
                  {new Date(token.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </Card>

          <Card className="bg-card border-border p-3 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-3 md:mb-4">Live Price</h2>
            <LivePriceChart tokenAddress={token.contractAddress} initialPrice={livePrice ?? token.currentPrice} />
          </Card>

          <Card className="bg-card border-border p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-3 md:mb-4">Creator Information</h2>
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

          <TokenHolders tokenAddress={token.contractAddress} />

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
