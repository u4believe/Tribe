"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getCurrentPrice, getTradeHistory, type TradeEvent } from "@/lib/contract-functions"
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, ColorType } from "lightweight-charts"

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

function formatPriceDisplay(price: number): string {
  if (price === 0) return "$0.00"
  if (price < 0.00001) return `$${price.toExponential(4)}`
  return `$${price.toFixed(8)}`
}

export default function LivePriceChart({ tokenAddress, initialPrice = 0 }: LivePriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const [trades, setTrades] = useState<TradeEvent[]>([])
  const [currentPrice, setCurrentPrice] = useState(initialPrice)
  const [priceChange, setPriceChange] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1h")
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null)
  const tradesRef = useRef<TradeEvent[]>([])
  const currentPriceRef = useRef(initialPrice)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.5)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(255, 255, 255, 0.2)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#1a1a2e",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.2)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#1a1a2e",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
      width: chartContainerRef.current.clientWidth,
      height: 320,
    })

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#00e676",
      downColor: "#ff1744",
      borderDownColor: "#ff1744",
      borderUpColor: "#00e676",
      wickDownColor: "rgba(255, 23, 68, 0.6)",
      wickUpColor: "rgba(0, 230, 118, 0.6)",
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        setHoveredCandle(null)
        return
      }
      const data = param.seriesData.get(candlestickSeries) as CandlestickData | undefined
      if (data) {
        setHoveredCandle({
          time: typeof param.time === "number" ? param.time * 1000 : 0,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          trades: 0,
        })
      } else {
        setHoveredCandle(null)
      }
    })

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
      chartRef.current = null
      candlestickSeriesRef.current = null
    }
  }, [])

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

  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    const candles = buildCandles(tradesRef.current, currentPriceRef.current, timeFrame)

    if (candles.length === 0) return

    const chartData: CandlestickData[] = candles.map((c) => ({
      time: (Math.floor(c.time / 1000)) as CandlestickData["time"],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    candlestickSeriesRef.current.setData(chartData)
    chartRef.current?.timeScale().fitContent()
  }, [trades, currentPrice, timeFrame])

  const displayPrice = hoveredCandle ? hoveredCandle.close : currentPrice

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
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-muted-foreground text-sm">Loading trade history...</span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{trades.length} trades</span>
        <span>Updates every 10s</span>
      </div>
    </div>
  )
}
