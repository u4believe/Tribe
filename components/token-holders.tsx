"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Users } from "lucide-react"
import { getTokenHolders, type TokenHolder } from "@/lib/contract-functions"

interface TokenHoldersProps {
  tokenAddress: string
}

export default function TokenHolders({ tokenAddress }: TokenHoldersProps) {
  const [holders, setHolders] = useState<TokenHolder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadHolders = async () => {
      if (!tokenAddress || !tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const holderData = await getTokenHolders(tokenAddress)
        setHolders(holderData)
      } catch (error) {
        console.error("Failed to load holders:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadHolders()
  }, [tokenAddress])

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatBalance = (balance: string) => {
    const num = Number.parseFloat(balance)
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-xl font-bold text-foreground">Token Holders</h2>
        <span className="text-sm text-muted-foreground">({holders.length})</span>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading holders from blockchain...</div>
      ) : holders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No holders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {holders.map((holder, index) => (
            <div key={holder.address} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-6">#{index + 1}</span>
                <div>
                  <p className="font-mono text-sm text-foreground">{formatAddress(holder.address)}</p>
                  <p className="text-xs text-muted-foreground">{formatBalance(holder.balance)} tokens</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(holder.percentage, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-foreground w-16 text-right">
                  {holder.percentage.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
