"use client"
import TokenCard from "@/components/token-card"
import type { mockTokens } from "@/lib/mock-data"

interface TokenGridProps {
  tokens: typeof mockTokens
  onSelectToken: (token: (typeof mockTokens)[0]) => void
  onTradeComplete?: () => void
  onStarToggle?: () => void
  onTokenHover?: (token: (typeof mockTokens)[0] | null) => void
}

export default function TokenGrid({
  tokens,
  onSelectToken,
  onTradeComplete,
  onStarToggle,
  onTokenHover,
}: TokenGridProps) {
  const tribeOrientedTokens = tokens.filter((t) => t.intuitionLink && t.intuitionLink.trim() !== "")
  const allTokens = tokens.filter((t) => !t.intuitionLink || t.intuitionLink.trim() === "")

  return (
    <div className="space-y-8 md:space-y-10">
      {tribeOrientedTokens.length > 0 && (
        <section>
          <div className="mb-3 md:mb-4">
            <h2 className="text-lg md:text-2xl font-bold text-foreground mb-0.5">Tribe-Oriented</h2>
            <p className="text-[10px] md:text-sm text-muted-foreground">Tokens with Intuition knowledge graph</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {tribeOrientedTokens.map((token) => (
              <div key={token.id} className="alpha-glow rounded-xl" onMouseEnter={() => onTokenHover?.(token)}>
                <TokenCard
                  token={token}
                  onClick={() => onSelectToken(token)}
                  isAlpha
                  onTradeComplete={onTradeComplete}
                  onStarToggle={onStarToggle}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {allTokens.length > 0 && (
        <section>
          <div className="mb-3 md:mb-4">
            <h2 className="text-lg md:text-2xl font-bold text-foreground mb-0.5">All Tokens</h2>
            <p className="text-[10px] md:text-sm text-muted-foreground">Discover new meme tokens</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {allTokens.map((token) => (
              <div key={token.id} className="alpha-glow rounded-xl" onMouseEnter={() => onTokenHover?.(token)}>
                <TokenCard
                  key={token.id}
                  token={token}
                  onClick={() => onSelectToken(token)}
                  onTradeComplete={onTradeComplete}
                  onStarToggle={onStarToggle}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
