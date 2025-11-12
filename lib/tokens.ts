import { createClient } from "@/lib/supabase/client"
import { calculateMarketCap } from "@/lib/bonding-curve"

export interface MemeToken {
  id: string
  name: string
  symbol: string
  image: string
  currentPrice: number
  startPrice: number
  marketCap: number
  maxSupply: number
  currentSupply: number
  holders: number
  creator: string
  intuitionLink: string
  isAlpha: boolean
  contractAddress: string
  isCompleted: boolean
  creatorProfile?: {
    displayName?: string
    profileImage?: string
  }
}

interface SupabaseToken {
  id: string
  name: string
  symbol: string
  image: string
  current_price: number
  start_price: number
  market_cap: number
  max_supply: number
  current_supply: number
  holders: number
  creator: string
  intuition_link: string
  is_alpha: boolean
  contract_address: string
  is_completed: boolean
  user_profiles?: {
    display_name?: string
    profile_image?: string
  } | null
}

// Convert database format to client format
function supabaseToToken(data: SupabaseToken): MemeToken {
  return {
    id: data.id,
    name: data.name,
    symbol: data.symbol,
    image: data.image,
    currentPrice: data.current_price,
    startPrice: data.start_price,
    marketCap: data.market_cap,
    maxSupply: data.max_supply,
    currentSupply: data.current_supply,
    holders: data.holders,
    creator: data.creator,
    intuitionLink: data.intuition_link,
    isAlpha: data.is_alpha,
    contractAddress: data.contract_address,
    isCompleted: data.is_completed,
    creatorProfile: data.user_profiles
      ? {
          displayName: data.user_profiles.display_name,
          profileImage: data.user_profiles.profile_image,
        }
      : undefined,
  }
}

// Fetch all tokens from database
export async function fetchAllTokens(): Promise<MemeToken[]> {
  try {
    const supabase = createClient()

    const { data: tokens, error: tokensError } = await supabase
      .from("meme_tokens")
      .select("*")
      .order("created_at", { ascending: false })

    if (tokensError) {
      console.error("[v0] Error fetching tokens:", tokensError)
      return []
    }

    if (!tokens || tokens.length === 0) {
      return []
    }

    // Fetch creator profiles separately
    const creatorAddresses = [...new Set(tokens.map((t) => t.creator))]
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("wallet_address, display_name, profile_image")
      .in("wallet_address", creatorAddresses)

    // Create a map of profiles for quick lookup
    const profileMap = new Map((profiles || []).map((p) => [p.wallet_address, p]))

    // Merge tokens with profiles
    const result = tokens.map((token) => {
      const profile = profileMap.get(token.creator)
      return supabaseToToken({
        ...token,
        user_profiles: profile
          ? {
              display_name: profile.display_name,
              profile_image: profile.profile_image,
            }
          : null,
      })
    })

    return result
  } catch (error) {
    console.error("[v0] Failed to fetch tokens:", error)
    return []
  }
}

export function normalizeIntuitionLink(link: string): string {
  if (!link || link.trim() === "") return ""

  try {
    const url = new URL(link.trim())

    // Expected format: https://portal.intuition.systems/explore/atom/{hash}
    // Extract only the base atom URL without any suffixes or query parameters
    const pathMatch = url.pathname.match(/^\/explore\/atom\/(0x[a-fA-F0-9]+)/)

    if (!pathMatch) {
      throw new Error("Invalid Intuition link format")
    }

    // Return the normalized format without any suffixes or query params
    return `https://portal.intuition.systems/explore/atom/${pathMatch[1]}`
  } catch (error) {
    console.error("[v0] Error normalizing link:", error)
    return ""
  }
}

export function validateIntuitionLink(link: string): { valid: boolean; error?: string; normalized?: string } {
  if (!link || link.trim() === "") {
    return { valid: true, normalized: "" } // Optional field
  }

  // Must start with https://
  if (!link.startsWith("https://")) {
    return { valid: false, error: 'Link must start with "https://"' }
  }

  try {
    const url = new URL(link.trim())

    // Must be from portal.intuition.systems
    if (url.hostname !== "portal.intuition.systems") {
      return { valid: false, error: "Link must be from portal.intuition.systems" }
    }

    // Must match the expected path format: /explore/atom/{hash}
    const pathMatch = url.pathname.match(/^\/explore\/atom\/(0x[a-fA-F0-9]{64})$/)

    if (!pathMatch) {
      return {
        valid: false,
        error: "Link must be in format: https://portal.intuition.systems/explore/atom/0x...",
      }
    }

    const normalized = normalizeIntuitionLink(link)
    return { valid: true, normalized }
  } catch (error) {
    return { valid: false, error: "Invalid URL format" }
  }
}

export async function checkLinkExists(link: string): Promise<boolean> {
  if (!link || link.trim() === "") return false

  try {
    const normalized = normalizeIntuitionLink(link)
    if (!normalized) return false

    const supabase = createClient()
    const { data, error } = await supabase.from("meme_tokens").select("id").eq("intuition_link", normalized).limit(1)

    if (error) {
      console.error("[v0] Error checking link:", error)
      return false
    }

    return (data || []).length > 0
  } catch (error) {
    console.error("[v0] Failed to check link:", error)
    return false
  }
}

// Create new token
export async function createTokenInDatabase(token: Omit<MemeToken, "id">): Promise<MemeToken | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("meme_tokens")
      .insert([
        {
          name: token.name,
          symbol: token.symbol,
          image: token.image,
          current_price: token.currentPrice,
          start_price: token.startPrice,
          market_cap: token.marketCap,
          max_supply: Math.floor(token.maxSupply),
          current_supply: Math.floor(token.currentSupply),
          holders: Math.floor(token.holders),
          creator: token.creator,
          intuition_link: token.intuitionLink || null,
          is_alpha: token.isAlpha,
          contract_address: token.contractAddress,
          is_completed: token.isCompleted,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating token:", error)
      return null
    }

    return data ? supabaseToToken(data) : null
  } catch (error) {
    console.error("[v0] Failed to create token:", error)
    return null
  }
}

// Update token data in database
export async function updateTokenInDatabase(
  contractAddress: string,
  updates: {
    currentPrice?: number
    currentSupply?: number
    marketCap?: number
    holders?: number
    isCompleted?: boolean
  },
): Promise<boolean> {
  try {
    const supabase = createClient()

    // Build the update object with snake_case keys
    const dbUpdates: any = {}
    if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice
    if (updates.currentSupply !== undefined) dbUpdates.current_supply = Math.floor(updates.currentSupply)

    if (updates.currentSupply !== undefined) {
      // Auto-calculate market cap using bonding curve formula
      // Market Cap = Current Price × Circulating Supply (700M tokens)
      const calculatedMarketCap = calculateMarketCap(updates.currentSupply)
      dbUpdates.market_cap = calculatedMarketCap
    }

    if (updates.holders !== undefined) dbUpdates.holders = Math.floor(updates.holders)
    if (updates.isCompleted !== undefined) dbUpdates.is_completed = updates.isCompleted

    const { error } = await supabase.from("meme_tokens").update(dbUpdates).eq("contract_address", contractAddress)

    if (error) {
      console.error("[v0] Error updating token:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[v0] Failed to update token:", error)
    return false
  }
}

// Delete all tokens (admin/migration use)
export async function deleteAllTokens(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("meme_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000") // Delete all rows

    if (error) {
      console.error("[v0] Error deleting tokens:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[v0] Failed to delete tokens:", error)
    return false
  }
}
