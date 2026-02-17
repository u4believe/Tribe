"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, TrendingDown, Copy, Star, Lock, LockOpen } from "lucide-react"
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
  const [liveBondingProgress, setLiveBondingProgress] = useState<number | null>(null)
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
            const maxSup = Number.parseFloat(formatEther(info.maxSupply))
            const priceNum = Number.parseFloat(price)
            setLiveMarketCap(supply * priceNum)
            const bondingLimit = maxSup * 0.7
            const progress = bondingLimit > 0 ? Math.min((supply / bondingLimit) * 100, 100) : 0
            setLiveBondingProgress(progress)
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

  const bondingCurveProgress = liveBondingProgress ?? calculateBondingCurveProgress(0)

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

  const hasPortal = token.intuitionLink && token.intuitionLink.trim() !== ""

  return (
    <>
      <div
        className={`cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 rounded-t-2xl rounded-b-lg overflow-hidden ${
          hasPortal
            ? "shadow-[0_0_20px_rgba(218,165,32,0.4)] hover:shadow-[0_0_30px_rgba(218,165,32,0.6)]"
            : "shadow-lg hover:shadow-xl shadow-black/30"
        }`}
        onClick={onClick}
      >
        <div
          className={`relative ${
            hasPortal
              ? "bg-gradient-to-b from-yellow-700/90 via-yellow-800/80 to-yellow-950/95 border border-yellow-500/50"
              : "bg-gradient-to-b from-gray-700/90 via-gray-800/80 to-gray-900/95 border border-gray-600/40"
          } rounded-t-2xl rounded-b-lg`}
        >
          <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
            {token.isCompleted && (
              <Badge className="bg-orange-600/90 text-white text-[8px] whitespace-nowrap px-1.5 py-0.5 backdrop-blur-sm">Done</Badge>
            )}
          </div>

          <div className="flex items-center pt-4 pb-2 px-3 gap-2">
            <div className="flex flex-col items-center justify-between flex-shrink-0 self-stretch py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStarClick}
                disabled={isStarring || !address}
                className={`h-6 w-6 p-0 rounded-full backdrop-blur-sm ${
                  isStarred
                    ? "text-yellow-400 bg-yellow-400/20"
                    : "text-white/60 bg-black/30 hover:text-yellow-400"
                }`}
                title={isStarred ? "Unstar token" : "Star token"}
              >
                <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-current" : ""}`} />
              </Button>
              {!isCheckingLock && (
                <div
                  className={`flex items-center justify-center h-6 w-6 rounded-full backdrop-blur-sm ${
                    isUnlocked
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                  title={
                    isUnlocked ? "Token unlocked - Available for trading" : "Token locked - Creator must buy 2% first"
                  }
                >
                  {isUnlocked ? <LockOpen className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                </div>
              )}
            </div>

            <div className="flex-1 flex justify-center">
              <div className={`w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 flex-shrink-0 ${
                hasPortal
                  ? "border-yellow-400/60 shadow-[0_0_15px_rgba(218,165,32,0.3)]"
                  : "border-white/20 shadow-[0_0_10px_rgba(0,0,0,0.3)]"
              }`}>
                <img
                  src={token.image || "/placeholder.svg"}
                  alt={token.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 flex-shrink-0 w-[80px] md:w-[90px]">
              <div className={`rounded-md px-1.5 py-0.5 ${hasPortal ? "bg-black/30" : "bg-white/5"}`}>
                <span className={`text-[6px] md:text-[7px] uppercase tracking-wider block ${
                  hasPortal ? "text-yellow-400/70" : "text-cyan-400/70"
                }`}>Price</span>
                <span className={`text-[10px] md:text-xs font-bold block leading-tight ${
                  hasPortal ? "text-yellow-100" : "text-cyan-300"
                }`}>
                  ${currentPrice.toFixed(6)}
                </span>
              </div>
              <div className={`rounded-md px-1.5 py-0.5 ${hasPortal ? "bg-black/30" : "bg-white/5"}`}>
                <span className={`text-[6px] md:text-[7px] uppercase tracking-wider block ${
                  hasPortal ? "text-yellow-400/70" : "text-cyan-400/70"
                }`}>Stock</span>
                <span className={`text-[10px] md:text-xs font-bold block leading-tight ${
                  hasPortal ? "text-yellow-100" : "text-cyan-300"
                }`}>
                  {(liveMarketCap ?? token.marketCap ?? 0).toFixed(2)}
                </span>
              </div>
              <div className={`text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-md text-center ${
                Number(priceChange) >= 0
                  ? "text-green-300 bg-green-500/20"
                  : "text-red-300 bg-red-500/20"
              }`}>
                {Number(priceChange) >= 0 ? "+" : ""}{priceChange}%
              </div>
            </div>
          </div>

          <div className={`mx-3 border-t ${hasPortal ? "border-yellow-500/30" : "border-white/10"}`} />

          <div className="px-3 pt-2 pb-1 text-center">
            <h3 className={`font-bold text-sm md:text-base truncate ${
              hasPortal ? "text-yellow-100" : "text-white"
            }`}>
              {token.name}
            </h3>
            <p className={`text-[8px] md:text-[9px] mt-0.5 truncate ${
              hasPortal ? "text-yellow-300/70" : "text-white/40"
            }`}>
              ${token.symbol}
            </p>
          </div>

          <div className="px-3 pb-2 flex items-center justify-center gap-1">
            <span className="text-[8px] md:text-[9px] font-mono text-white/40 truncate">
              {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className="h-4 w-4 p-0 hover:bg-white/10 flex-shrink-0"
              title="Copy address"
            >
              <Copy className={`w-2.5 h-2.5 ${copied ? "text-green-400" : "text-white/40"}`} />
            </Button>
          </div>

          <div className="px-3 pb-2">
            <div className="flex items-center gap-1.5">
              <span className={`text-[8px] md:text-[9px] flex-shrink-0 ${
                hasPortal ? "text-yellow-300/60" : "text-white/40"
              }`}>Bonding</span>
              <div className={`flex-1 rounded-full h-1.5 ${hasPortal ? "bg-yellow-900/50" : "bg-white/10"}`}>
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    hasPortal
                      ? "bg-gradient-to-r from-yellow-500 to-yellow-300"
                      : "bg-gradient-to-r from-primary to-accent"
                  }`}
                  style={{ width: `${bondingCurveProgress}%` }}
                />
              </div>
              <span className={`text-[8px] md:text-[9px] font-bold flex-shrink-0 ${
                hasPortal ? "text-yellow-300" : "text-accent"
              }`}>
                {bondingCurveProgress.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
            <Button
              onClick={handleBuyClick}
              size="sm"
              disabled={token.isCompleted || !isUnlocked}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-0.5 disabled:opacity-40 text-[9px] md:text-[10px] h-6 md:h-7 px-1 rounded-md"
            >
              <ShoppingCart className="w-2.5 h-2.5" />
              Buy
            </Button>
            <Button
              onClick={handleSellClick}
              size="sm"
              disabled={token.isCompleted || !isUnlocked}
              className="!bg-yellow-500 hover:!bg-yellow-400 !text-black font-bold flex items-center justify-center gap-0.5 disabled:opacity-40 text-[9px] md:text-[10px] h-6 md:h-7 px-1 rounded-md"
            >
              <TrendingDown className="w-2.5 h-2.5" />
              Sell
            </Button>
          </div>

          {token.isCompleted && (
            <p className="text-[7px] md:text-[8px] text-center text-orange-400 font-medium pb-2 px-3">
              Trading stopped - Launch completed
            </p>
          )}
        </div>
      </div>

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
