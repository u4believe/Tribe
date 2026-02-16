"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getCurrentPrice } from "@/lib/contract-functions"

interface LivePriceChartProps {
  tokenAddress: string
  initialPrice?: number
}

interface PricePoint {
  time: number
  price: number
}

export default function LivePriceChart({ tokenAddress, initialPrice = 0 }: LivePriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [currentPrice, setCurrentPrice] = useState(initialPrice)
  const [priceChange, setPriceChange] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<"1m" | "5m" | "15m" | "all">("all")
  const animFrameRef = useRef<number>(0)
  const priceHistoryRef = useRef<PricePoint[]>([])

  const fetchPrice = useCallback(async () => {
    if (!tokenAddress || !tokenAddress.startsWith("0x") || tokenAddress.length !== 42) return

    try {
      const price = await getCurrentPrice(tokenAddress)
      if (price) {
        const priceNum = Number.parseFloat(price)
        const now = Date.now()

        setPriceHistory((prev) => {
          const updated = [...prev, { time: now, price: priceNum }]
          if (updated.length > 500) updated.shift()
          priceHistoryRef.current = updated
          return updated
        })

        setCurrentPrice(priceNum)
        setIsLoading(false)
      }
    } catch {
    }
  }, [tokenAddress])

  useEffect(() => {
    if (initialPrice > 0) {
      const now = Date.now()
      const initial = [{ time: now, price: initialPrice }]
      setPriceHistory(initial)
      priceHistoryRef.current = initial
      setCurrentPrice(initialPrice)
    }
    fetchPrice()
    const interval = setInterval(fetchPrice, 10000)
    return () => clearInterval(interval)
  }, [fetchPrice, initialPrice])

  useEffect(() => {
    if (priceHistory.length >= 2) {
      const first = priceHistory[0].price
      const last = priceHistory[priceHistory.length - 1].price
      setPriceChange(first > 0 ? ((last - first) / first) * 100 : 0)
    }
  }, [priceHistory])

  const getFilteredHistory = useCallback(() => {
    const now = Date.now()
    const ranges: Record<string, number> = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      all: Infinity,
    }
    const cutoff = now - (ranges[timeRange] || Infinity)
    return priceHistoryRef.current.filter((p) => p.time >= cutoff)
  }, [timeRange])

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const padding = { top: 20, right: 60, bottom: 30, left: 10 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    ctx.clearRect(0, 0, width, height)

    const filtered = getFilteredHistory()

    if (filtered.length < 2) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
      ctx.font = "14px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Collecting price data...", width / 2, height / 2)
      return
    }

    const prices = filtered.map((p) => p.price)
    const times = filtered.map((p) => p.time)
    let minPrice = Math.min(...prices)
    let maxPrice = Math.max(...prices)

    if (minPrice === maxPrice) {
      minPrice = minPrice * 0.999
      maxPrice = maxPrice * 1.001
    }

    const priceRange = maxPrice - minPrice
    const pricePadding = priceRange * 0.1
    minPrice -= pricePadding
    maxPrice += pricePadding

    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const timeSpan = maxTime - minTime || 1

    const toX = (time: number) => padding.left + ((time - minTime) / timeSpan) * chartWidth
    const toY = (price: number) => padding.top + (1 - (price - minPrice) / (maxPrice - minPrice)) * chartHeight

    const isPositive = filtered[filtered.length - 1].price >= filtered[0].price
    const lineColor = isPositive ? "#00e676" : "#ff1744"
    const fillColor = isPositive ? "rgba(0, 230, 118, 0.08)" : "rgba(255, 23, 68, 0.08)"

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()

      const priceLabel = maxPrice - ((maxPrice - minPrice) / 4) * i
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "left"
      ctx.fillText(`$${priceLabel.toFixed(8)}`, width - padding.right + 4, y + 3)
    }

    ctx.beginPath()
    ctx.moveTo(toX(filtered[0].time), toY(filtered[0].price))
    for (let i = 1; i < filtered.length; i++) {
      ctx.lineTo(toX(filtered[i].time), toY(filtered[i].price))
    }
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.lineJoin = "round"
    ctx.stroke()

    ctx.lineTo(toX(filtered[filtered.length - 1].time), padding.top + chartHeight)
    ctx.lineTo(toX(filtered[0].time), padding.top + chartHeight)
    ctx.closePath()
    ctx.fillStyle = fillColor
    ctx.fill()

    const lastPoint = filtered[filtered.length - 1]
    const lx = toX(lastPoint.time)
    const ly = toY(lastPoint.price)

    ctx.beginPath()
    ctx.arc(lx, ly, 4, 0, Math.PI * 2)
    ctx.fillStyle = lineColor
    ctx.fill()

    ctx.beginPath()
    ctx.arc(lx, ly, 7, 0, Math.PI * 2)
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.4
    ctx.stroke()
    ctx.globalAlpha = 1
  }, [getFilteredHistory])

  useEffect(() => {
    const animate = () => {
      drawChart()
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [drawChart])

  useEffect(() => {
    const handleResize = () => drawChart()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [drawChart])

  const formatPrice = (price: number) => {
    if (price === 0) return "$0.00"
    if (price < 0.00001) return `$${price.toExponential(4)}`
    return `$${price.toFixed(8)}`
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-foreground">{formatPrice(currentPrice)}</span>
          {priceHistory.length >= 2 && (
            <span className={`text-sm font-semibold px-2 py-0.5 rounded ${priceChange >= 0 ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
              {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(["1m", "5m", "15m", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 text-xs rounded transition-colors ${timeRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ height: 280 }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Loading price data...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{priceHistory.length} data points</span>
        <span>Updates every 10s</span>
      </div>
    </div>
  )
}
