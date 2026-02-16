"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, TrendingDown, ExternalLink, Copy, Star, Lock, LockOpen } from "lucide-react"
import { calculateBondingCurveProgress } from "@/lib/bonding-curve"
import QuickTradeModal from "./quick-trade-modal"
import { toggleStarToken, isTokenStarred } from "@/lib/starred-tokens"
import { useWallet } from "@/hooks/use-wallet"
import type { mockTokens } from "@/lib/mock-data"
import { isTokenUnlocked, getTokenInfo, getCurrentPrice } from "@/lib/contract-functions"
import { formatEther } from "ethers"

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
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isCheckingLock, setIsCheckingLock] = useState(true)
  const [liveMarketCap, setLiveMarketCap] = useState<number | null>(null)
  const { address } = useWallet()

  useEffect(() => {
    if (address) {
      isTokenStarred(address, token.contractAddress).then(setIsStarred)
    }
  }, [address, token.contractAddress])

  useEffect(() => {
    const checkUnlockStatus = async () => {
      if (token.contractAddress && token.contractAddress.startsWith("0x") && token.contractAddress.length === 42 && token.contractAddress !== "0x0000000000000000000000000000000000000000") {
        try {
          setIsCheckingLock(true)
          const unlocked = await isTokenUnlocked(token.contractAddress)
          setIsUnlocked(unlocked)
        } catch (error) {
          console.error("Failed to check unlock status:", error)
          setIsUnlocked(false)
        } finally {
          setIsCheckingLock(false)
        }
      } else {
        setIsCheckingLock(false)
      }
    }

    checkUnlockStatus()

    const fetchLiveMarketCap = async () => {
      if (token.contractAddress && token.contractAddress.startsWith("0x") && token.contractAddress.length === 42 && token.contractAddress !== "0x0000000000000000000000000000000000000000") {
        try {
          const [info, price] = await Promise.all([
            getTokenInfo(token.contractAddress),
            getCurrentPrice(token.contractAddress),
          ])
          if (info && price) {
            const supply = Number.parseFloat(formatEther(info.currentSupply))
            const priceNum = Number.parseFloat(price)
            setLiveMarketCap(supply * priceNum)
          }
        } catch {
        }
      }
    }
    fetchLiveMarketCap()
  }, [token.contractAddress])

  const currentPrice = token.currentPrice ?? 0
  const startPrice = token.startPrice ?? 0

  const priceChange =
    startPrice && startPrice !== 0 ? (((currentPrice - startPrice) / startPrice) * 100).toFixed(2) : "0.00"

  const rawSupply = token.currentSupply ?? 0
  const humanSupply = rawSupply > 1e15 ? rawSupply / 1e18 : rawSupply
  const bondingCurveProgress = calculateBondingCurveProgress(humanSupply)

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
        className={`cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg overflow-hidden min-w-[180px] ${
          isAlpha ? "alpha-shimmer bg-card/80 border-accent/30" : "bg-card border-border"
        } ${token.intuitionLink ? "border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] hover:border-white" : ""}`}
        onClick={onClick}
      >
        <div className="p-2 md:p-3 space-y-1 md:space-y-1.5">
          {/* Token Header */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
              <img
                src={token.image || "/placeholder.svg"}
                alt={token.name}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xs md:text-sm text-foreground truncate">{token.name}</h3>
                <p className="text-[8px] md:text-[10px] text-muted-foreground truncate">${token.symbol}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStarClick}
                disabled={isStarring || !address}
                className={`h-5 w-5 p-0 hover:bg-muted ${isStarred ? "text-yellow-500" : "text-muted-foreground"}`}
                title={isStarred ? "Unstar token" : "Star token"}
              >
                <Star className={`w-3 h-3 ${isStarred ? "fill-current" : ""}`} />
              </Button>
              {!isCheckingLock && (
                <div
                  className={`flex items-center justify-center h-5 w-5 rounded ${
                    isUnlocked ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                  }`}
                  title={
                    isUnlocked ? "Token unlocked - Available for trading" : "Token locked - Creator must buy 2% first"
                  }
                >
                  {isUnlocked ? <LockOpen className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                </div>
              )}
              {isAlpha && <Badge className="bg-accent text-accent-foreground text-[6px] px-0.5 py-0">Alpha</Badge>}
              {token.isCompleted && (
                <Badge className="bg-orange-600 text-white text-[6px] whitespace-nowrap px-0.5 py-0">Done</Badge>
              )}
            </div>
          </div>

          {/* Contract Address and Portal link row */}
          <div className="flex items-center justify-between gap-1 text-[8px] md:text-[9px]">
            <div className="flex items-center gap-0.5 min-w-0 flex-1">
              <span className="text-muted-foreground">CA:</span>
              <span className="font-mono text-foreground truncate">{token.contractAddress.slice(0, 6)}...</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyAddress}
                className="h-4 w-4 p-0 hover:bg-muted flex-shrink-0"
                title="Copy address"
              >
                <Copy className={`w-2 h-2 ${copied ? "text-green-500" : ""}`} />
              </Button>
            </div>
            {token.intuitionLink && (
              <button
                onClick={handleIntuitionClick}
                className="text-primary hover:underline flex items-center gap-0.5 font-medium flex-shrink-0"
              >
                <span>Portal</span>
                <ExternalLink className="w-2 h-2" />
              </button>
            )}
          </div>

          {/* Price and Stock row */}
          <div className="flex items-center justify-between gap-1 text-[8px] md:text-[9px]">
            <div className="flex items-center gap-0.5 min-w-0">
              <span className="text-muted-foreground">Price:</span>
              <span className="font-semibold text-foreground truncate">${currentPrice.toFixed(6)}</span>
            </div>
            <div className="flex items-center gap-0.5 min-w-0">
              <span className="text-muted-foreground">Stock:</span>
              <span className="font-semibold text-foreground truncate">{(liveMarketCap ?? token.marketCap ?? 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Bonding curve */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] md:text-[9px] text-muted-foreground flex-shrink-0">Bonding:</span>
            <div className="flex-1 bg-muted/30 rounded-full h-1">
              <div
                className="bg-gradient-to-r from-primary to-accent h-1 rounded-full transition-all duration-300"
                style={{ width: `${bondingCurveProgress}%` }}
              />
            </div>
            <span className="text-[8px] md:text-[9px] font-semibold text-accent flex-shrink-0">
              {bondingCurveProgress.toFixed(0)}%
            </span>
          </div>

          {/* Buy/Sell buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              onClick={handleBuyClick}
              size="sm"
              disabled={token.isCompleted || !isUnlocked}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-0.5 disabled:opacity-50 text-[9px] md:text-[10px] h-5 md:h-6 px-1"
            >
              <ShoppingCart className="w-2.5 h-2.5" />
              Buy
            </Button>
            <Button
              onClick={handleSellClick}
              size="sm"
              disabled={token.isCompleted || !isUnlocked}
              className="!bg-yellow-500 hover:!bg-yellow-600 !text-black flex items-center justify-center gap-0.5 disabled:opacity-50 text-[9px] md:text-[10px] h-5 md:h-6 px-1"
            >
              <TrendingDown className="w-2.5 h-2.5" />
              Sell
            </Button>
          </div>

          {token.isCompleted && (
            <p className="text-[7px] md:text-[8px] text-center text-orange-600 font-medium truncate">
              Trading stopped - Launch completed
            </p>
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
