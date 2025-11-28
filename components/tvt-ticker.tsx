"use client"

import { useState, useEffect, useRef } from "react"
import { getTotalTVT, getTokenTVT } from "@/lib/contract-functions"
import { Contract, JsonRpcProvider } from "ethers"
import { CONTRACT_CONFIG } from "@/lib/contract-config"
import ABI from "@/lib/contract-abi.json"

interface TokenTVT {
  symbol: string
  name: string
  tvt: string
  address: string
}

export default function TVTTicker() {
  const [totalTVT, setTotalTVT] = useState<string>("0")
  const [tokenTVTs, setTokenTVTs] = useState<TokenTVT[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const cachedTokensRef = useRef<TokenTVT[]>([])
  const cachedTotalRef = useRef<string>("0")

  useEffect(() => {
    loadTVTData()
    const interval = setInterval(loadTVTData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadTVTData = async () => {
    try {
      const provider = new JsonRpcProvider(CONTRACT_CONFIG.network.rpcUrl, {
        name: CONTRACT_CONFIG.network.name,
        chainId: CONTRACT_CONFIG.chainId,
      })
      const contract = new Contract(CONTRACT_CONFIG.address, ABI, provider)

      // Get total TVT
      try {
        const total = await getTotalTVT()
        setTotalTVT(total)
        cachedTotalRef.current = total
      } catch {
        if (cachedTotalRef.current !== "0") {
          setTotalTVT(cachedTotalRef.current)
        }
      }

      try {
        const tokenAddresses: string[] = await contract.getAllTokens()

        if (tokenAddresses && tokenAddresses.length > 0) {
          const tokenDataPromises = tokenAddresses.map(async (address: string) => {
            try {
              if (!address || address === "0x0000000000000000000000000000000000000000") {
                return null
              }

              const tokenInfo = await contract.getTokenInfo(address)
              const tvt = await getTokenTVT(address)

              return {
                symbol: tokenInfo.symbol || "???",
                name: tokenInfo.name || "Unknown",
                tvt,
                address,
              }
            } catch {
              return null
            }
          })

          const results = await Promise.all(tokenDataPromises)
          const filtered = results
            .filter((t): t is TokenTVT => t !== null && Number.parseFloat(t.tvt) > 0)
            .sort((a, b) => Number.parseFloat(b.tvt) - Number.parseFloat(a.tvt))

          cachedTokensRef.current = filtered
          setTokenTVTs(filtered)
        } else if (cachedTokensRef.current.length > 0) {
          setTokenTVTs(cachedTokensRef.current)
        }
      } catch {
        if (cachedTokensRef.current.length > 0) {
          setTokenTVTs(cachedTokensRef.current)
        }
      }
    } catch {
      if (cachedTokensRef.current.length > 0) {
        setTokenTVTs(cachedTokensRef.current)
      }
      if (cachedTotalRef.current !== "0") {
        setTotalTVT(cachedTotalRef.current)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const formatTVT = (value: string) => {
    const num = Number.parseFloat(value)
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`
    }
    return num.toFixed(4)
  }

  if (isLoading) {
    return (
      <div className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20">
        <div className="flex items-center h-8 px-4">
          <span className="text-xs text-primary mr-2">📈</span>
          <span className="text-xs text-muted-foreground">Loading trading data...</span>
        </div>
      </div>
    )
  }

  if (Number.parseFloat(totalTVT) === 0 && tokenTVTs.length === 0) {
    return null
  }

  return (
    <div className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20">
      <div className="relative h-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center">
          <div className="flex items-center gap-6 px-4 animate-marquee whitespace-nowrap">
            {/* First set of content */}
            <div className="flex items-center gap-2 text-primary">
              <span className="text-xs">📈</span>
              <span className="text-xs font-semibold">TRIBE TVT</span>
            </div>

            <div className="flex items-center gap-1.5 bg-primary/20 px-2 py-0.5 rounded">
              <span className="text-xs text-muted-foreground">Total:</span>
              <span className="text-xs font-bold text-primary">{formatTVT(totalTVT)} TRUST</span>
            </div>

            {tokenTVTs.map((token, index) => (
              <div key={index} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/30">
                <span className="text-xs font-medium text-foreground">${token.symbol}</span>
                <span className="text-xs text-primary font-semibold">{formatTVT(token.tvt)} TRUST</span>
              </div>
            ))}

            <span className="mx-8 text-primary/50">•</span>

            {/* Duplicate content for seamless loop */}
            <div className="flex items-center gap-2 text-primary">
              <span className="text-xs">📈</span>
              <span className="text-xs font-semibold">TRIBE TVT</span>
            </div>

            <div className="flex items-center gap-1.5 bg-primary/20 px-2 py-0.5 rounded">
              <span className="text-xs text-muted-foreground">Total:</span>
              <span className="text-xs font-bold text-primary">{formatTVT(totalTVT)} TRUST</span>
            </div>

            {tokenTVTs.map((token, index) => (
              <div key={`dup-${index}`} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/30">
                <span className="text-xs font-medium text-foreground">${token.symbol}</span>
                <span className="text-xs text-primary font-semibold">{formatTVT(token.tvt)} TRUST</span>
              </div>
            ))}

            <span className="mx-8 text-primary/50">•</span>
          </div>
        </div>
      </div>
    </div>
  )
}
