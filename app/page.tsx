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
  const { address } = useWallet()

  useEffect(() => {
    loadTokens()
  }, [])

  useEffect(() => {
    if (address) {
      loadStarredTokens()
    }
  }, [address])

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
      console.log("[v0] Loaded starred tokens from DB:", normalizedStarred)
      setStarredTokenAddresses(normalizedStarred)
    } catch (error) {
      console.error("[v0] Error loading starred tokens:", error)
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
    console.log("[v0] Star toggled, reloading starred tokens list")
    await loadStarredTokens()
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
      case "tribe":
        filtered = filtered.filter((token) => {
          const hasIntuitionLink = token.intuitionLink && token.intuitionLink.trim() !== ""
          return hasIntuitionLink
        })
        break
      case "new":
        filtered = filtered.filter((token) => {
          if (!token.createdAt) return false
          const tokenDate = new Date(token.createdAt)
          return tokenDate.getTime() > oneDayAgo.getTime()
        })
        filtered.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        break
      case "older":
        filtered = filtered.filter((token) => {
          if (!token.createdAt) return false
          const tokenDate = new Date(token.createdAt)
          return tokenDate.getTime() <= oneDayAgo.getTime()
        })
        filtered.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())
        break
      case "starred":
        console.log("[v0] Filtering starred tokens")
        console.log("[v0] Current starred addresses:", starredTokenAddresses)
        console.log("[v0] Wallet address:", address)

        if (!address) {
          filtered = []
        } else {
          filtered = filtered.filter((token) => {
            const tokenAddr = token.contractAddress.toLowerCase()
            const isStarred = starredTokenAddresses.includes(tokenAddr)
            return isStarred
          })
        }

        console.log("[v0] Filtered starred tokens count:", filtered.length)
        break
      case "all":
      default:
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

  if (showAlphaRoom) {
    return (
      <main className="min-h-screen bg-background">
        <Sidebar />
        <div className="ml-16">
          <Header onCreateClick={() => setShowCreateModal(true)} onAlphaClick={() => setShowAlphaRoom(false)} />
          <div className="container mx-auto px-4 py-8 pt-36">
            <h1 className="text-5xl font-bold text-foreground relative">✨ Alpha Room</h1>
            <p className="text-xl text-muted-foreground">Private room for TRUST Card holders</p>
            <p className="text-muted-foreground">Exclusive access to premium tokens and early opportunities</p>
            <button
              onClick={() => setShowAlphaRoom(false)}
              className="mt-8 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
            >
              Back to Launchpad
            </button>
          </div>
          <Footer />
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-16">
        <Header onCreateClick={() => setShowCreateModal(true)} onAlphaClick={() => setShowAlphaRoom(true)} />

        {selectedToken ? (
          <div className="pt-36">
            <BondingCurveView token={selectedToken} onBack={handleBackFromBondingCurve} />
          </div>
        ) : (
          <div className="container mx-auto px-4 py-4 pt-36">
            <div className="mb-4 w-full">
              <TokenFilters
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                starredCount={starredTokenAddresses.length}
              />
            </div>

            <div className="mb-4">
              <TVTTicker />
            </div>

            <div className="mb-6">
              <div className="relative max-w-2xl mx-auto">
                <input
                  type="text"
                  placeholder="Search by name, symbol, or contract address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-12 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {filteredTokens.length} {filteredTokens.length === 1 ? "token" : "tokens"} found
                </p>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading tokens...</p>
              </div>
            ) : loadError ? (
              <div className="text-center py-12">
                <p className="text-red-400 mb-4">{loadError}</p>
                <button
                  onClick={loadTokens}
                  className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "No tokens found matching your search"
                    : activeFilter === "starred"
                      ? address
                        ? "No starred tokens yet. Star your favorite tokens to see them here!"
                        : "Please connect your wallet to see starred tokens"
                      : "No tokens available"}
                </p>
              </div>
            ) : (
              <TokenGrid
                tokens={filteredTokens}
                onSelectToken={setSelectedToken}
                onTradeComplete={loadTokens}
                onStarToggle={handleStarToggle}
              />
            )}
          </div>
        )}

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
  )
}
