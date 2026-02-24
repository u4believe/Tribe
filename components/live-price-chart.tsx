"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getCurrentPrice, getTradeHistory, type TradeEvent } from "@/lib/contract-functions"
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, ColorType } from "lightweight-charts"

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

type TimeFrame = "1m" | "5m" | "15m" | "1h" | "4h" | "1d"

const TIMEFRAME_MS: Record<TimeFrame, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
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

function formatPriceAxis(price: number): string {
  if (price === 0) return "0"
  if (price >= 1) return price.toFixed(2)
  if (price >= 0.01) return price.toFixed(4)
  if (price >= 0.0001) return price.toFixed(6)
  if (price >= 0.000001) return price.toFixed(8)
  if (price >= 0.00000001) return price.toFixed(10)
  return price.toExponential(3)
}

function formatPriceDisplay(price: number): string {
  if (price === 0) return "$0.00"
  if (price >= 1) return `$${price.toFixed(4)}`
  if (price >= 0.01) return `$${price.toFixed(6)}`
  if (price >= 0.0001) return `$${price.toFixed(8)}`
  if (price < 0.0001) return `$${price.toExponential(4)}`
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
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("15m")
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null)
  const tradesRef = useRef<TradeEvent[]>([])
  const currentPriceRef = useRef(initialPrice)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.6)",
        fontSize: 11,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.03)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(255, 255, 255, 0.3)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#16162a",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.3)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#16162a",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
        borderVisible: true,
        ticksVisible: true,
        entireTextOnly: false,
        minimumWidth: 80,
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 4,
        rightOffset: 5,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: { vertTouchDrag: false },
      width: chartContainerRef.current.clientWidth,
      height: 420,
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      priceFormat: {
        type: "custom",
        formatter: (price: number) => formatPriceAxis(price),
        minMove: 0.000000001,
      },
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
    const tradeInterval = setInterval(fetchTradeHistory, 60000)
    const priceInterval = setInterval(fetchCurrentPrice, 30000)
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
          <span className="text-xl font-bold text-foreground font-mono tracking-tight">{formatPriceDisplay(displayPrice)}</span>
          {!hoveredCandle && trades.length >= 2 && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                priceChange >= 0 ? "text-[#26a69a] bg-[#26a69a]/10" : "text-[#ef5350] bg-[#ef5350]/10"
              }`}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          )}
          {hoveredCandle && (
            <div className="flex gap-2 text-xs font-mono">
              <span className="text-muted-foreground">
                O <span className="text-foreground">{formatPriceDisplay(hoveredCandle.open)}</span>
              </span>
              <span className="text-muted-foreground">
                H <span className="text-[#26a69a]">{formatPriceDisplay(hoveredCandle.high)}</span>
              </span>
              <span className="text-muted-foreground">
                L <span className="text-[#ef5350]">{formatPriceDisplay(hoveredCandle.low)}</span>
              </span>
              <span className="text-muted-foreground">
                C <span className="text-foreground">{formatPriceDisplay(hoveredCandle.close)}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-0.5 bg-muted/30 rounded-md p-0.5">
          {(["1m", "5m", "15m", "1h", "4h", "1d"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                timeFrame === tf
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full rounded-lg overflow-hidden border border-white/5" style={{ height: 420 }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-muted-foreground text-xs">Loading chart data...</span>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      <div className="flex items-center justify-between mt-2 px-1 text-xs text-muted-foreground">
        <span>{trades.length} trade{trades.length !== 1 ? "s" : ""}</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>
    </div>
  )
}
