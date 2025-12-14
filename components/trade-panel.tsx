"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, AlertTriangle, Lock } from "lucide-react"
import { useContract } from "@/hooks/use-contract"
import { useWallet } from "@/hooks/use-wallet"
import { getUserTokenBalance } from "@/lib/user-holdings"
import { updateTokenInDatabase } from "@/lib/tokens"
import {
  getTokenInfoWithRetry,
  getCurrentPrice,
  getContractTrustBalance,
  isTokenCompleted,
  isTokenUnlocked,
} from "@/lib/contract-functions"
import type { mockTokens } from "@/lib/mock-data"
import { CONTRACT_ADDRESS } from "@/lib/contract-config"

interface TradePanelProps {
  token: (typeof mockTokens)[0]
  onTradeComplete?: () => void
}

export default function TradePanel({ token, onTradeComplete }: TradePanelProps) {
  const [mode, setMode] = useState<"buy" | "sell">("buy")
  const [amount, setAmount] = useState("")
  const [trustAmount, setTrustAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [userBalance, setUserBalance] = useState("0")
  const [trustBalance, setTrustBalance] = useState("0")
  const [contractBalance, setContractBalance] = useState("0")
  const [tokenCompleted, setTokenCompleted] = useState(false)
  const [tokenUnlocked, setTokenUnlocked] = useState(true)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const { buyTokens, sellTokens } = useContract()
  const { address } = useWallet()

  useEffect(() => {
    const checkTokenStatus = async () => {
      if (!token.contractAddress) return

      setCheckingStatus(true)
      try {
        const [completed, unlocked] = await Promise.all([
          isTokenCompleted(token.contractAddress),
          isTokenUnlocked(token.contractAddress),
        ])

        console.log("[v0] Token status:", {
          address: token.contractAddress,
          completed,
          unlocked,
        })

        setTokenCompleted(completed)
        setTokenUnlocked(unlocked)
      } catch (error) {
        console.error("[v0] Failed to check token status:", error)
      } finally {
        setCheckingStatus(false)
      }
    }

    checkTokenStatus()
  }, [token.contractAddress])

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

    const interval = setInterval(fetchTrustBalance, 10000)
    return () => clearInterval(interval)
  }, [address])

  useEffect(() => {
    const fetchContractBalance = async () => {
      try {
        const balance = await getContractTrustBalance(CONTRACT_ADDRESS)
        setContractBalance(balance)
      } catch (error) {
        console.error("Failed to fetch contract TRUST balance:", error)
        setContractBalance("0")
      }
    }

    fetchContractBalance()

    const interval = setInterval(fetchContractBalance, 15000)
    return () => clearInterval(interval)
  }, [])

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

  const handlePercentageClick = (percentage: number) => {
    if (mode === "buy") {
      const trustToUse = (Number.parseFloat(trustBalance) * percentage) / 100
      if (trustToUse > 0) {
        const currentPrice = token.currentPrice || 0.0001533
        const tokensToGet = trustToUse / currentPrice
        setTrustAmount(trustToUse.toFixed(6))
        setAmount(tokensToGet.toFixed(6))
      }
    } else {
      const tokensToSell = (Number.parseFloat(userBalance) * percentage) / 100
      if (tokensToSell > 0) {
        const currentPrice = token.currentPrice || 0.0001533
        const trustToGet = tokensToSell * currentPrice
        setAmount(tokensToSell.toFixed(6))
        setTrustAmount(trustToGet.toFixed(6))
      }
    }
  }

  const handleTrade = async () => {
    if (!address) {
      setError("Please connect your wallet first")
      return
    }

    if (tokenCompleted) {
      setError("Trading is disabled - Token launch has been completed and migrated to DEX")
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

    if (!token.contractAddress || token.contractAddress === "") {
      setError("Invalid token contract address")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      if (mode === "buy") {
        const minTokensOut = (Number.parseFloat(amount) * 0.98).toFixed(6)
        console.log("[v0] Buying tokens:", {
          contractAddress: token.contractAddress,
          trustAmount,
          amount,
          minTokensOut,
        })
        await buyTokens(token.contractAddress, trustAmount, minTokensOut)
      } else {
        const expectedTrust = Number.parseFloat(amount) * (token.currentPrice || 0.0001533) * 0.97
        const availableBalance = Number.parseFloat(contractBalance)

        if (availableBalance === 0) {
          setError(
            `Cannot sell: Contract has 0 TRUST balance. The contract needs buyers to deposit TRUST before sellers can withdraw. Please wait for buy orders.`,
          )
          setIsLoading(false)
          return
        }

        if (availableBalance < expectedTrust) {
          const willReceive = Math.min(expectedTrust, availableBalance)
          const shortfall = expectedTrust - willReceive

          setError(
            `WARNING: Contract has insufficient TRUST. You will receive ${willReceive.toFixed(6)} TRUST instead of ${expectedTrust.toFixed(6)} TRUST (shortfall: ${shortfall.toFixed(6)} TRUST). The contract needs more buyers.`,
          )

          await new Promise((resolve) => setTimeout(resolve, 3000))
        }

        console.log("[v0] Selling tokens:", {
          contractAddress: token.contractAddress,
          amount,
        })
        await sellTokens(token.contractAddress, amount)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} tokens`)
      console.error(`[v0] ${mode} error:`, err)
    } finally {
      setIsLoading(false)
    }
  }

  const expectedTrustReceived =
    mode === "sell" && amount
      ? Math.min(
          Number.parseFloat(amount) * (token.currentPrice || 0.0001533) * 0.97,
          Number.parseFloat(contractBalance),
        )
      : null

  if (checkingStatus) {
    return (
      <Card className="bg-card border-border p-6 sticky top-24">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Checking token status...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-6 sticky top-24">
      <h2 className="text-xl font-bold text-foreground mb-4">Trade</h2>

      {tokenCompleted && (
        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-start gap-2">
          <Lock className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-orange-600 font-medium">Token Launch Completed</p>
            <p className="text-xs text-orange-500 mt-1">
              This token has been migrated to DEX. Trading on the bonding curve is now disabled.
            </p>
          </div>
        </div>
      )}

      {!tokenUnlocked && !tokenCompleted && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-600 font-medium">Token Locked</p>
            <p className="text-xs text-yellow-500 mt-1">
              This token is currently locked. Wait for more buys to unlock trading.
            </p>
          </div>
        </div>
      )}

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

      {mode === "sell" && !tokenCompleted && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-blue-400">Contract TRUST Balance</span>
            <span className="font-semibold text-blue-300">{Number.parseFloat(contractBalance).toFixed(4)} TRUST</span>
          </div>
          {expectedTrustReceived !== null && (
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-500/20">
              <span className="text-xs text-blue-400">You will receive</span>
              <span
                className={`font-semibold text-xs ${
                  expectedTrustReceived < (Number.parseFloat(amount) * (token.currentPrice || 0.0001533) * 0.97)
                    ? "text-orange-400"
                    : "text-green-400"
                }`}
              >
                ~{expectedTrustReceived.toFixed(6)} TRUST
              </span>
            </div>
          )}
          {Number.parseFloat(contractBalance) === 0 && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Contract has 0 TRUST. Cannot process sells until buyers add TRUST.
            </p>
          )}
          {expectedTrustReceived !== null &&
            expectedTrustReceived < Number.parseFloat(amount) * (token.currentPrice || 0.0001533) * 0.97 && (
              <p className="text-xs text-orange-400 mt-2">Limited by contract balance. Wait for buyers to add TRUST.</p>
            )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-6 bg-muted/30 p-1 rounded-lg">
        <Button
          onClick={() => setMode("buy")}
          variant={mode === "buy" ? "default" : "ghost"}
          className={mode === "buy" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
          disabled={isLoading || tokenCompleted}
        >
          Buy
        </Button>
        <Button
          onClick={() => setMode("sell")}
          variant={mode === "sell" ? "default" : "ghost"}
          className={mode === "sell" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"}
          disabled={isLoading || tokenCompleted || Number.parseFloat(contractBalance) === 0}
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
            disabled={isLoading || tokenCompleted}
          />
          {mode === "sell" && address && (
            <div className="flex gap-2 mt-2">
              {[20, 50, 75, 100].map((percent) => (
                <Button
                  key={percent}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePercentageClick(percent)}
                  disabled={isLoading || tokenCompleted || Number.parseFloat(userBalance) <= 0}
                  className="flex-1 text-xs h-7 border-border hover:bg-destructive/20 hover:text-destructive hover:border-destructive"
                >
                  {percent}%
                </Button>
              ))}
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
            disabled={isLoading || tokenCompleted}
          />
          {mode === "buy" && address && (
            <div className="flex gap-2 mt-2">
              {[20, 50, 75, 100].map((percent) => (
                <Button
                  key={percent}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePercentageClick(percent)}
                  disabled={isLoading || tokenCompleted || Number.parseFloat(trustBalance) <= 0}
                  className="flex-1 text-xs h-7 border-border hover:bg-primary/20 hover:text-primary hover:border-primary"
                >
                  {percent}%
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-6 p-4 bg-muted/20 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Price per token</span>
          <span className="text-foreground font-semibold">${(token.currentPrice || 0.0001533).toFixed(8)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Slippage</span>
          <span className="text-foreground font-semibold">2%</span>
        </div>
      </div>

      <Button
        onClick={handleTrade}
        disabled={
          isLoading || !address || tokenCompleted || (mode === "sell" && Number.parseFloat(contractBalance) === 0)
        }
        className={`w-full font-semibold py-6 text-lg disabled:opacity-50 ${
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
          `${mode === "buy" ? "Buy " : "Sell "} ${token.symbol}`
        )}
      </Button>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        {!address
          ? "Connect wallet to trade"
          : tokenCompleted
            ? "Token launch completed - trading on bonding curve disabled"
            : mode === "buy"
              ? "Price increases as you buy"
              : Number.parseFloat(contractBalance) === 0
                ? "Contract has 0 TRUST - cannot sell"
                : "Price decreases as you sell"}
      </p>
    </Card>
  )
}
