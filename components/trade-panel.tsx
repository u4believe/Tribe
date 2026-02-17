"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { useContract } from "@/hooks/use-contract"
import { useWallet } from "@/hooks/use-wallet"
import { getUserTokenBalance } from "@/lib/user-holdings"
import { updateTokenInDatabase } from "@/lib/tokens"
import { getTokenInfoWithRetry, getCurrentPrice } from "@/lib/contract-functions"
import type { mockTokens } from "@/lib/mock-data"

interface TradePanelProps {
  token: (typeof mockTokens)[0] & { factory_address?: string } // Add factory_address to token type
  onTradeComplete?: () => void // Add callback to refresh token data
}

export default function TradePanel({ token, onTradeComplete }: TradePanelProps) {
  const [mode, setMode] = useState<"buy" | "sell">("buy")
  const [amount, setAmount] = useState("")
  const [trustAmount, setTrustAmount] = useState("")
  const [payoutAddress, setPayoutAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [userBalance, setUserBalance] = useState("0")
  const [trustBalance, setTrustBalance] = useState("0") // Added state for user's TRUST balance
  const { buyTokens, sellTokens } = useContract()
  const { address } = useWallet()

  useEffect(() => {
    const fetchBalance = async () => {
      if (address && token.contractAddress) {
        const balance = await getUserTokenBalance(token.contractAddress, address)
        setUserBalance(balance)
      } else {
        setUserBalance("0")
      }
    }

    fetchBalance()
  }, [address, token.contractAddress])

  useEffect(() => {
    const fetchTrustBalance = async () => {
      if (address && typeof window !== "undefined" && window.ethereum) {
        try {
          const { BrowserProvider, formatEther } = await import("ethers")
          const provider = new BrowserProvider(window.ethereum)
          const balance = await provider.getBalance(address)
          setTrustBalance(formatEther(balance))
        } catch (error) {
          console.error("Failed to fetch TRUST balance:", error)
          setTrustBalance("0")
        }
      } else {
        setTrustBalance("0")
      }
    }

    fetchTrustBalance()

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchTrustBalance, 30000)
    return () => clearInterval(interval)
  }, [address])

  const handleAmountChange = (value: string) => {
    setAmount(value)
    if (value) {
      const currentPrice = token.currentPrice || 0.0001533
      const trust = Number.parseFloat(value) * currentPrice
      setTrustAmount(trust.toFixed(6))
    } else {
      setTrustAmount("")
    }
  }

  const handleTrustChange = (value: string) => {
    setTrustAmount(value)
    if (value) {
      const currentPrice = token.currentPrice || 0.0001533
      const tokens = Number.parseFloat(value) / currentPrice
      setAmount(tokens.toFixed(6))
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

    if (!trustAmount || Number.parseFloat(trustAmount) <= 0) {
      setError("Invalid TRUST amount calculated. Please check your input.")
      return
    }

    if (!token.contractAddress || token.contractAddress === "" || !token.contractAddress.startsWith("0x") || token.contractAddress.length !== 42) {
      setError("This token does not have a valid contract address. It may not have been deployed to the blockchain yet.")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      if (mode === "buy") {
        const minTokensOut = (Number.parseFloat(amount) * 0.95).toFixed(6)
        console.log("[v0] Buying tokens:", {
          contractAddress: token.contractAddress,
          trustAmount,
          amount,
          minTokensOut,
        })
        await buyTokens(token.contractAddress, trustAmount, minTokensOut)
      } else {
        console.log("[v0] Selling tokens:", {
          contractAddress: token.contractAddress,
          amount,
          payoutAddress: payoutAddress || "Not specified (will use wallet address)",
        })
        await sellTokens(token.contractAddress, amount, token.factory_address, payoutAddress || undefined)
      }

      if (token.contractAddress) {
        const balance = await getUserTokenBalance(token.contractAddress, address)
        setUserBalance(balance)

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
      setPayoutAddress("")
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} tokens`)
      console.error(`[v0] ${mode} error:`, err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePercentageClick = (percentage: number) => {
    if (mode === "buy") {
      // For buying, use percentage of TRUST balance
      const trustToSpend = (Number.parseFloat(trustBalance) * percentage) / 100
      handleTrustChange(trustToSpend.toFixed(6))
    } else {
      // For selling, use percentage of token balance
      const tokensToSell = (Number.parseFloat(userBalance) * percentage) / 100
      handleAmountChange(tokensToSell.toFixed(6))
    }
  }

  return (
    <Card className="bg-card border-border p-6 sticky top-24">
      <h2 className="text-xl font-bold text-foreground mb-4">Trade</h2>

      {address && token.contractAddress && (
        <div className="mb-4 p-3 bg-muted/20 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Your Balance</span>
            <span className="font-semibold text-foreground">
              {Number.parseFloat(userBalance).toFixed(2)} {token.symbol}
            </span>
          </div>
        </div>
      )}

      {token.isCompleted && (
        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <p className="text-sm text-orange-600 font-medium text-center">Trading Disabled - Token Launch Completed</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-6 bg-muted/30 p-1 rounded-lg">
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
          variant="ghost"
          className={
            mode === "sell" ? "!bg-yellow-500 hover:!bg-yellow-600 !text-black font-semibold" : "text-muted-foreground"
          }
          disabled={isLoading || token.isCompleted}
        >
          Sell
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 mb-4">{error}</div>
      )}

      <div className="space-y-4 mb-6">
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
          {mode === "sell" && address && Number.parseFloat(userBalance) > 0 && (
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs bg-transparent"
                onClick={() => handlePercentageClick(25)}
                disabled={isLoading || token.isCompleted}
              >
                25%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs bg-transparent"
                onClick={() => handlePercentageClick(50)}
                disabled={isLoading || token.isCompleted}
              >
                50%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs bg-transparent"
                onClick={() => handlePercentageClick(75)}
                disabled={isLoading || token.isCompleted}
              >
                75%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs bg-transparent"
                onClick={() => handlePercentageClick(100)}
                disabled={isLoading || token.isCompleted}
              >
                100%
              </Button>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-muted-foreground">Cost (TRUST)</label>
            {address && (
              <span className="text-xs text-primary">Balance: {Number.parseFloat(trustBalance).toFixed(4)} TRUST</span>
            )}
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={trustAmount}
            onChange={(e) => handleTrustChange(e.target.value)}
            className="bg-input border-border text-foreground"
            disabled={isLoading || token.isCompleted}
          />
          {mode === "buy" && address && Number.parseFloat(trustBalance) > 0 && (
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs bg-transparent"
                onClick={() => handlePercentageClick(25)}
                disabled={isLoading || token.isCompleted}
              >
                25%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs bg-transparent"
                onClick={() => handlePercentageClick(50)}
                disabled={isLoading || token.isCompleted}
              >
                50%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs bg-transparent"
                onClick={() => handlePercentageClick(75)}
                disabled={isLoading || token.isCompleted}
              >
                75%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs bg-transparent"
                onClick={() => handlePercentageClick(100)}
                disabled={isLoading || token.isCompleted}
              >
                100%
              </Button>
            </div>
          )}
        </div>

        {mode === "sell" && (
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Payout Address (Optional)
            </label>
            <Input
              type="text"
              placeholder="0x... (Leave empty to receive TRUST to your wallet)"
              value={payoutAddress}
              onChange={(e) => setPayoutAddress(e.target.value)}
              className="bg-input border-border text-foreground text-xs"
              disabled={isLoading || token.isCompleted}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter a different address to receive TRUST proceeds to that address instead of your connected wallet
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-6 p-4 bg-muted/20 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Price per token</span>
          <span className="text-foreground font-semibold">${(token.currentPrice || 0.0001533).toFixed(8)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Slippage</span>
          <span className="text-foreground font-semibold">5%</span>
        </div>
      </div>

      <Button
        onClick={handleTrade}
        disabled={isLoading || !address || token.isCompleted}
        variant="ghost"
        className={`w-full font-semibold py-6 text-lg disabled:opacity-50 ${
          mode === "buy"
            ? "!bg-primary hover:!bg-primary/90 !text-primary-foreground"
            : "!bg-yellow-500 hover:!bg-yellow-600 !text-black"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {mode === "buy" ? "Buying..." : "Selling..."}
          </>
        ) : (
          `${mode === "buy" ? "Buy " : "Sell "} ${token.symbol}`
        )}
      </Button>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        {!address
          ? "Connect wallet to trade"
          : token.isCompleted
            ? "Token launch completed - trading disabled"
            : mode === "buy"
              ? "Price increases as you buy"
              : "Price decreases as you sell"}
      </p>
    </Card>
  )
}
