"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import Sidebar from "@/components/sidebar"
import CreateTokenModal from "@/components/create-token-modal"
import TokenGrid from "@/components/token-grid"
import BondingCurveView from "@/components/bonding-curve-view"
import Footer from "@/components/footer"
import TokenFilters, { type FilterType } from "@/components/token-filters"
import { fetchAllTokens } from "@/lib/tokens"
import { getStarredTokens } from "@/lib/starred-tokens"
import { useWallet } from "@/hooks/use-wallet"
import type { MemeToken } from "@/lib/tokens"
import TVTTicker from "@/components/tvt-ticker"
import WelcomeSplash from "@/components/welcome-splash"

export default function Home() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedToken, setSelectedToken] = useState<MemeToken | null>(null)
  const [tokens, setTokens] = useState<MemeToken[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showAlphaRoom, setShowAlphaRoom] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [starredTokenAddresses, setStarredTokenAddresses] = useState<string[]>([])
  const [hoveredToken, setHoveredToken] = useState<MemeToken | null>(null)
  const { address } = useWallet()
  const [showSplash, setShowSplash] = useState(true)
  const [splashReady, setSplashReady] = useState(false)

  useEffect(() => {
    const seen = sessionStorage.getItem("splashSeen")
    if (seen) {
      setShowSplash(false)
    }
    setSplashReady(true)
  }, [])

  useEffect(() => {
    loadTokens()
  }, [])

  useEffect(() => {
    if (address) {
      loadStarredTokens()
    }
  }, [address])

  useEffect(() => {
    if (tokens.length > 0 && !hoveredToken) {
      const nonRewindTokens = tokens.filter((t) => !t.isRewind2025)
      const sorted = [...nonRewindTokens].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
      if (sorted.length > 0) {
        setHoveredToken(sorted[0])
      }
    }
  }, [tokens, hoveredToken])

  const handleSplashEnter = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("splashSeen", "true")
    }
    setShowSplash(false)
  }

  const loadTokens = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setLoadError("Database not configured. Please contact support.")
        setTokens([])
        return
      }

      const fetchedTokens = await fetchAllTokens()
      setTokens(fetchedTokens)
    } catch (error) {
      console.error("Failed to load tokens:", error)
      setLoadError("Failed to load tokens. Please refresh the page or try again later.")
      setTokens([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadStarredTokens = async () => {
    if (!address) return

    try {
      const starred = await getStarredTokens(address)
      const normalizedStarred = starred.map((addr) => addr.toLowerCase())
      setStarredTokenAddresses(normalizedStarred)
    } catch (error) {
      console.error("Error loading starred tokens:", error)
    }
  }

  const handleCreateToken = (newToken: MemeToken) => {
    setTokens([newToken, ...tokens])
    setShowCreateModal(false)
  }

  const handleBackFromBondingCurve = () => {
    setSelectedToken(null)
    loadTokens()
  }

  const handleStarToggle = async () => {
    await loadStarredTokens()
  }

  const handleTokenHover = (token: MemeToken | null) => {
    if (token) {
      setHoveredToken(token)
    }
  }

  const getFilteredTokens = () => {
    let filtered = tokens

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (token) =>
          token.name.toLowerCase().includes(query) ||
          token.symbol.toLowerCase().includes(query) ||
          token.contractAddress.toLowerCase().includes(query),
      )
    }

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    switch (activeFilter) {
      case "rewind2025":
        filtered = filtered.filter((token) => token.isRewind2025 === true)
        filtered.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        break
      case "tribe":
        filtered = filtered.filter((token) => {
          const hasIntuitionLink = token.intuitionLink && token.intuitionLink.trim() !== ""
          return hasIntuitionLink && !token.isRewind2025
        })
        break
      case "new":
        filtered = filtered.filter((token) => {
          if (!token.createdAt) return false
          const tokenDate = new Date(token.createdAt)
          return tokenDate.getTime() > oneDayAgo.getTime() && !token.isRewind2025
        })
        filtered.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        break
      case "older":
        filtered = filtered.filter((token) => {
          if (!token.createdAt) return false
          const tokenDate = new Date(token.createdAt)
          return tokenDate.getTime() <= oneDayAgo.getTime() && !token.isRewind2025
        })
        filtered.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())
        break
      case "starred":
        if (!address) {
          filtered = []
        } else {
          filtered = filtered.filter((token) => {
            const tokenAddr = token.contractAddress.toLowerCase()
            const isStarred = starredTokenAddresses.includes(tokenAddr)
            return isStarred && !token.isRewind2025
          })
        }
        break
      case "all":
      default:
        filtered = filtered.filter((token) => !token.isRewind2025)
        if (tokens.some((t) => t.createdAt)) {
          filtered.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return dateB - dateA
          })
        }
        break
    }

    return filtered
  }

  const filteredTokens = getFilteredTokens()

  return (
    <>
      {showSplash && splashReady && <WelcomeSplash onEnter={handleSplashEnter} />}
      <main className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 md:ml-16">
          <Header onCreateClick={() => setShowCreateModal(true)} onAlphaClick={() => setShowAlphaRoom(true)} />
          {selectedToken ? (
            <div className="pt-16 md:pt-24">
              <BondingCurveView token={selectedToken} onBack={handleBackFromBondingCurve} />
            </div>
          ) : (
            <div>
              <div className="fixed top-[50px] md:top-[70px] left-0 md:left-16 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
                <div className="container mx-auto px-3 md:px-4">
                  <div className="py-3">
                    <TokenFilters
                      activeFilter={activeFilter}
                      onFilterChange={setActiveFilter}
                      starredCount={starredTokenAddresses.length}
                    />
                  </div>
                  <div className="py-2 border-t border-border/30">
                    <TVTTicker />
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 py-2 md:py-3 border-t border-border/30 lg:pr-[280px]">
                    <div className="relative flex-1 sm:flex-none sm:max-w-sm">
                      <div className="absolute -inset-1.5 bg-gradient-to-r from-primary/40 via-primary/60 to-primary/40 rounded-xl blur-md opacity-75 animate-pulse" />
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search tokens..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-4 py-2.5 pl-10 bg-card border-2 border-primary/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary shadow-[0_0_20px_rgba(234,179,8,0.3)] text-sm"
                        />
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {searchQuery && (
                      <p className="text-xs text-muted-foreground">
                        {filteredTokens.length} {filteredTokens.length === 1 ? "token" : "tokens"} found
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="container mx-auto px-2 md:px-4 py-4 pt-[200px] md:pt-[250px]">
                <div>
                  {isLoading ? (
                    <div className="text-center py-8 md:py-12">
                      <p className="text-sm md:text-base text-muted-foreground">Loading tokens...</p>
                    </div>
                  ) : loadError ? (
                    <div className="text-center py-8 md:py-12">
                      <p className="text-sm md:text-base text-red-400 mb-2 md:mb-4">{loadError}</p>
                      <button
                        onClick={loadTokens}
                        className="px-4 md:px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors text-sm md:text-base"
                      >
                        Retry
                      </button>
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div className="text-center py-8 md:py-12">
                      <p className="text-sm md:text-base text-muted-foreground">
                        {searchQuery
                          ? "No tokens found matching your search"
                          : activeFilter === "starred"
                            ? address
                              ? "No starred tokens yet. Star your favorite tokens to see them here!"
                              : "Please connect your wallet to see starred tokens"
                            : activeFilter === "rewind2025"
                              ? "No Re-wind 2025 tokens available"
                              : "No tokens available"}
                      </p>
                    </div>
                  ) : (
                    <TokenGrid
                      tokens={filteredTokens}
                      onSelectToken={setSelectedToken}
                      onTradeComplete={loadTokens}
                      onStarToggle={handleStarToggle}
                      onTokenHover={handleTokenHover}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="pb-20 md:pb-16" />
          <Footer />
          {showCreateModal && (
            <CreateTokenModal
              onClose={() => setShowCreateModal(false)}
              onCreate={handleCreateToken}
              existingTokens={tokens}
            />
          )}
        </div>
      </main>
    </>
  )
}
