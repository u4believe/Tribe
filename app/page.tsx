"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import CreateTokenModal from "@/components/create-token-modal"
import TokenGrid from "@/components/token-grid"
import BondingCurveView from "@/components/bonding-curve-view"
import Footer from "@/components/footer"
import { fetchAllTokens } from "@/lib/tokens"
import type { MemeToken } from "@/lib/tokens"

export default function Home() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedToken, setSelectedToken] = useState<MemeToken | null>(null)
  const [tokens, setTokens] = useState<MemeToken[]>([])
  const [showAlphaRoom, setShowAlphaRoom] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadTokens = async () => {
    setIsLoading(true)
    try {
      const fetchedTokens = await fetchAllTokens()
      setTokens(fetchedTokens)
    } catch (error) {
      console.error("[v0] Failed to load tokens:", error)
      setTokens([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTokens()
  }, [])

  const handleCreateToken = (newToken: MemeToken) => {
    setTokens([newToken, ...tokens])
    setShowCreateModal(false)
  }

  const handleBackFromBondingCurve = () => {
    setSelectedToken(null)
    // Refresh tokens when returning to main view
    loadTokens()
  }

  if (showAlphaRoom) {
    return (
      <main className="min-h-screen bg-background">
        <Header onCreateClick={() => setShowCreateModal(true)} onAlphaClick={() => setShowAlphaRoom(false)} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 blur-3xl animate-pulse" />
              <h1 className="text-5xl font-bold text-foreground relative">✨ Alpha Room</h1>
            </div>
            <p className="text-xl text-muted-foreground">Private room for TRUST Card holders</p>
            <p className="text-muted-foreground">Exclusive access to premium tokens and early opportunities</p>
            <button
              onClick={() => setShowAlphaRoom(false)}
              className="mt-8 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors"
            >
              Back to Launchpad
            </button>
          </div>
        </div>
        <Footer />
      </main>
    )
  }

  return (
    <main className="flex flex-col min-h-screen bg-background">
      <Header onCreateClick={() => setShowCreateModal(true)} onAlphaClick={() => setShowAlphaRoom(true)} />

      {selectedToken ? (
        <BondingCurveView token={selectedToken} onBack={handleBackFromBondingCurve} />
      ) : (
        <div className="flex-1 container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading tokens...</p>
            </div>
          ) : (
            <TokenGrid tokens={tokens} onSelectToken={setSelectedToken} onTradeComplete={loadTokens} />
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
    </main>
  )
}
