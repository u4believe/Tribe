"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, TrendingDown, ExternalLink, Copy, Star } from 'lucide-react'
import { calculateBondingCurveProgress } from "@/lib/bonding-curve"
import QuickTradeModal from "./quick-trade-modal"
import { toggleStarToken, isTokenStarred } from "@/lib/starred-tokens"
import { useWallet } from "@/hooks/use-wallet"
import type { mockTokens } from "@/lib/mock-data"

interface TokenCardProps {
  token: (typeof mockTokens)[0]
  onClick: () => void
  isAlpha?: boolean
  onTradeComplete?: () => void
  onStarToggle?: () => void
}

export default function TokenCard({ token, onClick, isAlpha, onTradeComplete, onStarToggle }: TokenCardProps) {
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy")
  const [copied, setCopied] = useState(false)
  const [isStarred, setIsStarred] = useState(false)
  const [isStarring, setIsStarring] = useState(false)
  const { address } = useWallet()

  useEffect(() => {
    if (address) {
      isTokenStarred(address, token.contractAddress).then(setIsStarred)
    }
  }, [address, token.contractAddress])

  const currentPrice = token.currentPrice ?? 0
  const startPrice = token.startPrice ?? 0

  const priceChange =
    startPrice && startPrice !== 0 ? (((currentPrice - startPrice) / startPrice) * 100).toFixed(2) : "0.00"

  const bondingCurveProgress = calculateBondingCurveProgress(token.currentSupply ?? 0)

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTradeMode("buy")
    setShowTradeModal(true)
  }

  const handleSellClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTradeMode("sell")
    setShowTradeModal(true)
  }

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(token.contractAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleIntuitionClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (token.intuitionLink) {
      window.open(token.intuitionLink, "_blank", "noopener,noreferrer")
    }
  }

  const handleTradeComplete = () => {
    if (onTradeComplete) {
      onTradeComplete()
    }
  }

  const handleStarClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!address) {
      alert("Please connect your wallet to star tokens")
      return
    }

    setIsStarring(true)
    try {
      const newStarredState = await toggleStarToken(address, token.contractAddress)
      setIsStarred(newStarredState)
      if (onStarToggle) {
        onStarToggle()
      }
    } catch (error) {
      console.error("Failed to toggle star:", error)
      alert("Failed to star/unstar token. Please try again.")
    } finally {
      setIsStarring(false)
    }
  }

  return (
    <>
      <Card
        className={`cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg ${
          isAlpha ? "alpha-shimmer bg-card/80 border-accent/30" : "bg-card border-border"
        }`}
        onClick={onClick}
      >
        <div className="p-4 space-y-3">
          {/* Token Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <img
                src={token.image || "/placeholder.svg"}
                alt={token.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-foreground truncate">{token.name}</h3>
                <p className="text-xs text-muted-foreground">${token.symbol}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStarClick}
                disabled={isStarring || !address}
                className={`h-7 w-7 p-0 hover:bg-muted ${isStarred ? "text-yellow-500" : "text-muted-foreground"}`}
                title={isStarred ? "Unstar token" : "Star token"}
              >
                <Star className={`w-4 h-4 ${isStarred ? "fill-current" : ""}`} />
              </Button>
              {isAlpha && <Badge className="bg-accent text-accent-foreground text-xs">Alpha</Badge>}
              {token.isCompleted && (
                <Badge className="bg-orange-600 text-white text-xs whitespace-nowrap">Launch Complete</Badge>
              )}
            </div>
          </div>

          {/* Contract Address section */}
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Contract Address</p>
              <p className="text-xs font-mono text-foreground truncate">{token.contractAddress}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className="h-7 w-7 p-0 hover:bg-muted"
              title="Copy address"
            >
              <Copy className={`w-3 h-3 ${copied ? "text-green-500" : ""}`} />
            </Button>
          </div>

          {/* Intuition Link section */}
          {token.intuitionLink && (
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Intuition Graph</p>
                <button
                  onClick={handleIntuitionClick}
                  className="text-xs text-primary hover:underline flex items-center gap-1 truncate w-full"
                >
                  <span className="truncate">View on Intuition Portal</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* Price Info */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Current Price</span>
              <span className="font-semibold text-sm text-foreground">${currentPrice.toFixed(8)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Market Cap</span>
              <span className="font-semibold text-sm text-foreground">${(token.marketCap ?? 0).toFixed(2)} TRUST</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Bonding Curve</span>
              <span className="font-semibold text-xs text-accent">{bondingCurveProgress.toFixed(1)}%</span>
            </div>
            <div
              className="bg-muted/30 rounded-full h-1.5"
              style={{ width: `${bondingCurveProgress}%` }}
            >
              <div className="bg-gradient-to-r from-primary to-accent h-1.5 rounded-full transition-all duration-300" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <Button
              onClick={handleBuyClick}
              size="sm"
              disabled={token.isCompleted}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Buy
            </Button>
            <Button
              onClick={handleSellClick}
              size="sm"
              disabled={token.isCompleted}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Sell
            </Button>
          </div>

          {token.isCompleted && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-center text-orange-600 font-medium">
                Trading stopped - Token launch completed
              </p>
            </div>
          )}
        </div>
      </Card>

      {showTradeModal && (
        <QuickTradeModal
          token={token}
          onClose={() => setShowTradeModal(false)}
          initialMode={tradeMode}
          onTradeComplete={handleTradeComplete}
        />
      )}
    </>
  )
}
