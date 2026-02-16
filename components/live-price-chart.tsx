"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getCurrentPrice, getTradeHistory, type TradeEvent } from "@/lib/contract-functions"

interface LivePriceChartProps {
  tokenAddress: string
  initialPrice?: number
}

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  trades: number
}

type TimeFrame = "1m" | "15m" | "1h" | "4h" | "24h"

const TIMEFRAME_MS: Record<TimeFrame, number> = {
  "1m": 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
}

function buildCandles(trades: TradeEvent[], currentPrice: number, timeframe: TimeFrame): Candle[] {
  if (trades.length === 0 && currentPrice <= 0) return []

  const intervalMs = TIMEFRAME_MS[timeframe]

  const allPrices = trades
    .map((t) => ({ time: t.time, price: t.price }))
    .sort((a, b) => a.time - b.time)

  if (currentPrice > 0) {
    const now = Date.now()
    const lastBucket = Math.floor(now / intervalMs) * intervalMs
    const lastCandle = allPrices.length > 0 ? Math.floor(allPrices[allPrices.length - 1].time / intervalMs) * intervalMs : -1

    if (lastBucket === lastCandle) {
      allPrices.push({ time: now, price: currentPrice })
    } else if (allPrices.length === 0) {
      allPrices.push({ time: now, price: currentPrice })
    }
  }

  if (allPrices.length === 0) return []

  let minTime = allPrices[0].time
  let maxTime = allPrices[allPrices.length - 1].time
  for (const p of allPrices) {
    if (p.time < minTime) minTime = p.time
    if (p.time > maxTime) maxTime = p.time
  }

  const startBucket = Math.floor(minTime / intervalMs) * intervalMs
  const endBucket = Math.floor(maxTime / intervalMs) * intervalMs

  const candleMap = new Map<number, Candle>()

  for (const { time, price } of allPrices) {
    const bucket = Math.floor(time / intervalMs) * intervalMs
    const existing = candleMap.get(bucket)
    if (existing) {
      existing.high = Math.max(existing.high, price)
      existing.low = Math.min(existing.low, price)
      existing.close = price
      existing.trades++
    } else {
      candleMap.set(bucket, {
        time: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
        trades: 1,
      })
    }
  }

  const candles: Candle[] = []
  let lastClose = allPrices[0].price

  for (let t = startBucket; t <= endBucket; t += intervalMs) {
    const c = candleMap.get(t)
    if (c) {
      candles.push(c)
      lastClose = c.close
    } else {
      candles.push({
        time: t,
        open: lastClose,
        high: lastClose,
        low: lastClose,
        close: lastClose,
        trades: 0,
      })
    }
  }

  return candles
}

export default function LivePriceChart({ tokenAddress, initialPrice = 0 }: LivePriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [trades, setTrades] = useState<TradeEvent[]>([])
  const [currentPrice, setCurrentPrice] = useState(initialPrice)
  const [priceChange, setPriceChange] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1h")
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null)
  const tradesRef = useRef<TradeEvent[]>([])
  const currentPriceRef = useRef(initialPrice)
  const timeFrameRef = useRef<TimeFrame>("1h")
  const hoveredCandleRef = useRef<Candle | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    timeFrameRef.current = timeFrame
  }, [timeFrame])

  useEffect(() => {
    hoveredCandleRef.current = hoveredCandle
  }, [hoveredCandle])

  const fetchTradeHistory = useCallback(async () => {
    if (!tokenAddress || !tokenAddress.startsWith("0x") || tokenAddress.length !== 42) return

    try {
      const history = await getTradeHistory(tokenAddress)
      setTrades(history)
      tradesRef.current = history
      setIsLoading(false)
    } catch {
      setIsLoading(false)
    }
  }, [tokenAddress])

  const fetchCurrentPrice = useCallback(async () => {
    if (!tokenAddress || !tokenAddress.startsWith("0x") || tokenAddress.length !== 42) return

    try {
      const price = await getCurrentPrice(tokenAddress)
      if (price) {
        const priceNum = Number.parseFloat(price)
        setCurrentPrice(priceNum)
        currentPriceRef.current = priceNum
      }
    } catch {}
  }, [tokenAddress])

  useEffect(() => {
    if (initialPrice > 0) {
      setCurrentPrice(initialPrice)
      currentPriceRef.current = initialPrice
    }
    fetchTradeHistory()
    fetchCurrentPrice()
    const tradeInterval = setInterval(fetchTradeHistory, 30000)
    const priceInterval = setInterval(fetchCurrentPrice, 10000)
    return () => {
      clearInterval(tradeInterval)
      clearInterval(priceInterval)
    }
  }, [fetchTradeHistory, fetchCurrentPrice, initialPrice])

  useEffect(() => {
    if (trades.length >= 2) {
      const first = trades[0].price
      const last = currentPrice > 0 ? currentPrice : trades[trades.length - 1].price
      setPriceChange(first > 0 ? ((last - first) / first) * 100 : 0)
    }
  }, [trades, currentPrice])

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
    const padding = { top: 20, right: 70, bottom: 35, left: 10 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    ctx.clearRect(0, 0, width, height)

    const candles = buildCandles(tradesRef.current, currentPriceRef.current, timeFrameRef.current)
    candlesRef.current = candles

    if (candles.length === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
      ctx.font = "14px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Loading trade history...", width / 2, height / 2)
      return
    }

    const allHighs = candles.map((c) => c.high)
    const allLows = candles.map((c) => c.low)
    let minPrice = Math.min(...allLows)
    let maxPrice = Math.max(...allHighs)

    if (minPrice === maxPrice) {
      minPrice *= 0.999
      maxPrice *= 1.001
    }

    const priceRange = maxPrice - minPrice
    const pricePad = priceRange * 0.1
    minPrice -= pricePad
    maxPrice += pricePad

    const toY = (price: number) =>
      padding.top + (1 - (price - minPrice) / (maxPrice - minPrice)) * chartHeight

    const candleCount = candles.length
    const candleTotalWidth = chartWidth / Math.max(candleCount, 1)
    const candleBodyWidth = Math.max(Math.min(candleTotalWidth * 0.7, 20), 3)
    const wickWidth = Math.max(1, candleBodyWidth < 6 ? 1 : 1.5)

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
      ctx.fillText(formatPriceLabel(priceLabel), width - padding.right + 4, y + 3)
    }

    const timeLabelsShown = new Set<string>()
    const maxLabels = Math.floor(chartWidth / 80)
    const labelStep = Math.max(1, Math.floor(candleCount / maxLabels))

    for (let i = 0; i < candleCount; i++) {
      const candle = candles[i]
      const x = padding.left + (i + 0.5) * candleTotalWidth
      const isGreen = candle.close >= candle.open
      const bodyColor = isGreen ? "#00e676" : "#ff1744"
      const wickColor = isGreen ? "rgba(0, 230, 118, 0.6)" : "rgba(255, 23, 68, 0.6)"

      const highY = toY(candle.high)
      const lowY = toY(candle.low)
      ctx.strokeStyle = wickColor
      ctx.lineWidth = wickWidth
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      const openY = toY(candle.open)
      const closeY = toY(candle.close)
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1)

      ctx.fillStyle = bodyColor
      ctx.fillRect(x - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight)

      if (i % labelStep === 0) {
        const label = formatTimeLabel(candle.time, timeFrameRef.current)
        if (!timeLabelsShown.has(label)) {
          timeLabelsShown.add(label)
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
          ctx.font = "9px sans-serif"
          ctx.textAlign = "center"
          ctx.fillText(label, x, height - padding.bottom + 15)
        }
      }
    }

    const hovered = hoveredCandleRef.current
    if (hovered) {
      const idx = candles.findIndex((c) => c.time === hovered.time)
      if (idx >= 0) {
        const x = padding.left + (idx + 0.5) * candleTotalWidth

        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x, padding.top)
        ctx.lineTo(x, padding.top + chartHeight)
        ctx.stroke()
        ctx.setLineDash([])

        const tooltipLines = [
          `O: ${formatPriceLabel(hovered.open)}`,
          `H: ${formatPriceLabel(hovered.high)}`,
          `L: ${formatPriceLabel(hovered.low)}`,
          `C: ${formatPriceLabel(hovered.close)}`,
        ]

        const tooltipX = x + candleTotalWidth / 2 + 8
        const tooltipY = padding.top + 5
        const tooltipW = 130
        const tooltipH = 72

        const adjustedX = tooltipX + tooltipW > width - padding.right ? x - candleTotalWidth / 2 - tooltipW - 8 : tooltipX

        ctx.fillStyle = "rgba(20, 20, 30, 0.9)"
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(adjustedX, tooltipY, tooltipW, tooltipH, 6)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
        ctx.font = "11px monospace"
        ctx.textAlign = "left"
        tooltipLines.forEach((line, li) => {
          ctx.fillText(line, adjustedX + 8, tooltipY + 18 + li * 15)
        })
      }
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const width = rect.width
      const padding = { left: 10, right: 70 }
      const chartWidth = width - padding.left - padding.right

      const candles = candlesRef.current
      if (candles.length === 0) return

      const candleTotalWidth = chartWidth / candles.length
      const idx = Math.floor((mouseX - padding.left) / candleTotalWidth)

      if (idx >= 0 && idx < candles.length) {
        setHoveredCandle(candles[idx])
      } else {
        setHoveredCandle(null)
      }
    },
    []
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredCandle(null)
  }, [])

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

  const displayCandle = hoveredCandle || null
  const displayPrice = displayCandle ? displayCandle.close : currentPrice

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-foreground">{formatPriceDisplay(displayPrice)}</span>
          {!hoveredCandle && trades.length >= 2 && (
            <span
              className={`text-sm font-semibold px-2 py-0.5 rounded ${
                priceChange >= 0 ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
              }`}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          )}
          {hoveredCandle && (
            <div className="flex gap-2 text-xs">
              <span className="text-muted-foreground">
                O <span className="text-foreground">{formatPriceDisplay(hoveredCandle.open)}</span>
              </span>
              <span className="text-muted-foreground">
                H <span className="text-green-400">{formatPriceDisplay(hoveredCandle.high)}</span>
              </span>
              <span className="text-muted-foreground">
                L <span className="text-red-400">{formatPriceDisplay(hoveredCandle.low)}</span>
              </span>
              <span className="text-muted-foreground">
                C <span className="text-foreground">{formatPriceDisplay(hoveredCandle.close)}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {(["1m", "15m", "1h", "4h", "24h"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                timeFrame === tf
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ height: 320 }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Loading trade history...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          style={{ width: "100%", height: "100%" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{trades.length} trades</span>
        <span>Updates every 10s</span>
      </div>
    </div>
  )
}

function formatPriceLabel(price: number): string {
  if (price === 0) return "$0"
  if (price < 0.00001) return `$${price.toExponential(3)}`
  if (price < 0.001) return `$${price.toFixed(8)}`
  if (price < 1) return `$${price.toFixed(6)}`
  return `$${price.toFixed(4)}`
}

function formatPriceDisplay(price: number): string {
  if (price === 0) return "$0.00"
  if (price < 0.00001) return `$${price.toExponential(4)}`
  return `$${price.toFixed(8)}`
}

function formatTimeLabel(timestamp: number, timeframe: TimeFrame): string {
  const d = new Date(timestamp)
  if (timeframe === "1m" || timeframe === "15m") {
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
  }
  if (timeframe === "1h" || timeframe === "4h") {
    return `${(d.getMonth() + 1)}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:00`
  }
  return `${(d.getMonth() + 1)}/${d.getDate()}`
}
