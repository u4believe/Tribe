"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Loader2 } from "lucide-react"
import { useContract } from "@/hooks/use-contract"
import { useWallet } from "@/hooks/use-wallet"
import { updateTokenInDatabase } from "@/lib/tokens"
import { getTokenInfoWithRetry, getCurrentPrice } from "@/lib/contract-functions"
import type { mockTokens } from "@/lib/mock-data"

interface QuickTradeModalProps {
  token: (typeof mockTokens)[0]
  onClose: () => void
  initialMode?: "buy" | "sell"
  onTradeComplete?: () => void
}

export default function QuickTradeModal({
  token,
  onClose,
  initialMode = "buy",
  onTradeComplete,
}: QuickTradeModalProps) {
  const [mode, setMode] = useState<"buy" | "sell">(initialMode)
  const [amount, setAmount] = useState("")
  const [trustAmount, setTrustAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const { buyTokens, sellTokens } = useContract()
  const { address } = useWallet()

  const handleAmountChange = (value: string) => {
    setAmount(value)
    if (value) {
      const trust = Number.parseFloat(value) * token.currentPrice
      setTrustAmount(trust.toString())
    } else {
      setTrustAmount("")
    }
  }

  const handleTrustChange = (value: string) => {
    setTrustAmount(value)
    if (value) {
      const tokens = Number.parseFloat(value) / token.currentPrice
      setAmount(tokens.toString())
    } else {
      setAmount("")
    }
  }

  const handleTrade = async () => {
    if (!address) {
      setError("Please connect your wallet first")
      return
    }

    if (token.isCompleted) {
      setError("Trading is disabled - Token launch has been completed")
      return
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      if (mode === "buy") {
        const minTokensOut = (Number.parseFloat(amount) * 0.99).toString()
        await buyTokens(token.contractAddress, trustAmount, minTokensOut)
      } else {
        await sellTokens(token.contractAddress, amount)
      }

      if (token.contractAddress) {
        try {
          console.log("[v0] Attempting to fetch updated token info...")
          const tokenInfo = await getTokenInfoWithRetry(token.contractAddress)
          const currentPrice = await getCurrentPrice(token.contractAddress)

          if (tokenInfo && currentPrice) {
            console.log("[v0] Updating token with:", {
              currentPrice: Number.parseFloat(currentPrice),
              currentSupply: Number.parseFloat(tokenInfo.currentSupply),
              isCompleted: tokenInfo.completed,
            })

            await updateTokenInDatabase(token.contractAddress, {
              currentPrice: Number.parseFloat(currentPrice),
              currentSupply: Number.parseFloat(tokenInfo.currentSupply),
              isCompleted: tokenInfo.completed,
            })

            console.log("[v0] Token data updated successfully")

            if (onTradeComplete) {
              onTradeComplete()
            }
          } else {
            console.log("[v0] Token data not ready yet, will update on next page load")
          }
        } catch (updateError) {
          console.log("[v0] Token data update skipped - blockchain state not ready yet")
        }
      }

      setAmount("")
      setTrustAmount("")
      setTimeout(onClose, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} tokens`)
      console.error(`[v0] ${mode} error:`, err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-card border-border w-full max-w-md">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Trade {token.symbol}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {token.isCompleted && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <p className="text-sm text-orange-600 font-medium text-center">
                Trading Disabled - Token Launch Completed
              </p>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-lg">
            <Button
              onClick={() => setMode("buy")}
              variant={mode === "buy" ? "default" : "ghost"}
              className={mode === "buy" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
              disabled={isLoading || token.isCompleted}
            >
              Buy
            </Button>
            <Button
              onClick={() => setMode("sell")}
              variant={mode === "sell" ? "default" : "ghost"}
              className={mode === "sell" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"}
              disabled={isLoading || token.isCompleted}
            >
              Sell
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>
          )}

          {/* Input Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Amount ({token.symbol})</label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="bg-input border-border text-foreground"
                disabled={isLoading || token.isCompleted}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Cost (TRUST)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={trustAmount}
                onChange={(e) => handleTrustChange(e.target.value)}
                className="bg-input border-border text-foreground"
                disabled={isLoading || token.isCompleted}
              />
            </div>
          </div>

          {/* Price Info */}
          <div className="space-y-2 p-3 bg-muted/20 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price per token</span>
              <span className="text-foreground font-semibold">${token.currentPrice.toFixed(8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage</span>
              <span className="text-foreground font-semibold">1%</span>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleTrade}
            disabled={isLoading || !address || token.isCompleted}
            className={`w-full font-semibold py-5 disabled:opacity-50 ${
              mode === "buy"
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {mode === "buy" ? "Buying..." : "Selling..."}
              </>
            ) : (
              `${mode === "buy" ? "Buy" : "Sell"} ${token.symbol}`
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {!address
              ? "Connect wallet to trade"
              : token.isCompleted
                ? "Token launch completed - trading disabled"
                : mode === "buy"
                  ? "Price increases as you buy"
                  : "Price decreases as you sell"}
          </p>
        </div>
      </Card>
    </div>
  )
}
