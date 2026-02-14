"use client"

import { useEffect, useState } from "react"
import type { MemeToken } from "@/lib/tokens"

interface HexagonalRatingProps {
  token: MemeToken
}

interface RatingMetrics {
  liquidity: number
  buy: number
  dex: number
  popularity: number
  sell: number
  rep: number
}

export function HexagonalRating({ token }: HexagonalRatingProps) {
  const [metrics, setMetrics] = useState<RatingMetrics>({
    liquidity: 0,
    buy: 0,
    dex: 0,
    popularity: 0,
    sell: 0,
    rep: 0,
  })

  useEffect(() => {
    // Calculate dynamic metrics based on token data
    const calculateMetrics = async () => {
      const maxSupply = token.maxSupply || 1000000000
      const currentSupply = token.currentSupply || 0
      const marketCap = token.marketCap || 0
      const holdersCount = token.holders && token.holders > 0 ? token.holders : 1
      const hasIntuitionLink = !!token.intuitionLink && token.intuitionLink.trim() !== ""

      // Estimate comments based on holders - more holders = more likely to have comments
      const commentsCount = Math.min(20, Math.floor(holdersCount / 2))

      // Liquidity: Based on market cap (0-100)
      const liquidity = Math.min(100, Math.max(0, marketCap > 0 ? Math.min(100, marketCap / 100 + 10) : 10))

      const supplyBoughtRatio = (currentSupply / maxSupply) * 100
      const buy = Math.min(100, Math.max(0, supplyBoughtRatio * 1.2))

      const dexThreshold = 800000000 // 800M tokens for DEX migration
      const dex = Math.min(100, Math.max(0, (currentSupply / dexThreshold) * 100))

      // Each holder adds 5 points (max 50), each comment adds 2.5 points (max 50)
      const holderPoints = Math.min(50, holdersCount * 5)
      const commentPoints = Math.min(50, commentsCount * 2.5)
      // Add minimum baseline of 5% for any existing token
      const popularity = Math.min(100, Math.max(5, holderPoints + commentPoints))

      const availableToSell = currentSupply > 0 ? (currentSupply / maxSupply) * 100 : 0
      const sell = Math.min(100, Math.max(0, availableToSell))

      // Max reputation when token has intuition link AND creator has bought 20% of token
      let rep = 0

      // Intuition link gives 50 points base
      if (hasIntuitionLink) {
        rep += 50
      }

      // Creator holdings: 20% of total supply (200M tokens) = 50 points max
      const creatorHoldingsEstimate = Math.min(currentSupply, maxSupply * 0.2)
      const creatorHoldingsRatio = (creatorHoldingsEstimate / (maxSupply * 0.2)) * 50
      rep += Math.min(50, creatorHoldingsRatio)

      rep = Math.min(100, Math.max(0, rep))

      setMetrics({
        liquidity: Math.round(liquidity),
        buy: Math.round(buy),
        dex: Math.round(dex),
        popularity: Math.round(popularity),
        sell: Math.round(sell),
        rep: Math.round(rep),
      })
    }

    calculateMetrics()
  }, [token])

  const size = 75
  const centerX = 170
  const centerY = 130
  const maxRadius = size

  // Calculate points for hexagon at given radius
  const getHexagonPoints = (radius: number) => {
    const points = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      points.push(`${x},${y}`)
    }
    return points.join(" ")
  }

  // Calculate points for rating polygon
  const getRatingPoints = () => {
    const values = [metrics.liquidity, metrics.rep, metrics.sell, metrics.popularity, metrics.dex, metrics.buy]
    const points = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      const radius = (values[i] / 100) * maxRadius
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      points.push(`${x},${y}`)
    }
    return points.join(" ")
  }

  const labels = [
    { name: "LIQUIDITY", x: centerX, y: centerY - maxRadius - 25 },
    { name: "REP", x: centerX + maxRadius + 40, y: centerY - maxRadius / 2 - 10 },
    { name: "SELL", x: centerX + maxRadius + 40, y: centerY + maxRadius / 2 + 10 },
    { name: "POPULARITY", x: centerX, y: centerY + maxRadius + 40 },
    { name: "DEX", x: centerX - maxRadius - 40, y: centerY + maxRadius / 2 + 10 },
    { name: "BUY", x: centerX - maxRadius - 40, y: centerY - maxRadius / 2 - 10 },
  ]

  const metricValues = [metrics.liquidity, metrics.rep, metrics.sell, metrics.popularity, metrics.dex, metrics.buy]

  return (
    <div className="border border-border rounded-lg p-4">
      <svg viewBox="0 0 340 280" className="w-full max-w-[300px] mx-auto">
        {/* Background hexagon grid */}
        <polygon
          points={getHexagonPoints(maxRadius)}
          fill="none"
          stroke="rgb(234, 179, 8)"
          strokeWidth="2"
          opacity="0.6"
        />
        <polygon
          points={getHexagonPoints(maxRadius * 0.66)}
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
        />
        <polygon
          points={getHexagonPoints(maxRadius * 0.33)}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />

        {/* Lines from center to vertices */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2
          const x = centerX + maxRadius * Math.cos(angle)
          const y = centerY + maxRadius * Math.sin(angle)
          return (
            <line key={i} x1={centerX} y1={centerY} x2={x} y2={y} stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
          )
        })}

        {/* Rating polygon */}
        <polygon points={getRatingPoints()} fill="rgba(255, 255, 255, 0.15)" stroke="white" strokeWidth="2" />

        {labels.map((label, i) => (
          <g key={label.name}>
            <text
              x={label.x}
              y={label.y}
              textAnchor={i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end"}
              fill="rgb(234, 179, 8)"
              fontSize="14"
              fontWeight="800"
              className="uppercase"
            >
              {label.name}
            </text>
            <text
              x={label.x}
              y={label.y + 14}
              textAnchor={i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end"}
              fill="white"
              fontSize="12"
              fontWeight="700"
            >
              {metricValues[i]}%
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-3 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>Max Rating</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-white" />
          <span>Current Rating</span>
        </div>
      </div>
    </div>
  )
}
