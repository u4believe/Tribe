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
  createdAt: string
  factoryAddress?: string // Added factory contract address field
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
  created_at: string
  factory_address?: string // Added factory contract address field
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
    createdAt: data.created_at,
    factoryAddress: data.factory_address, // Map factory address field
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
    console.log("[v0] fetchAllTokens called")

    if (typeof window === "undefined") {
      console.log("[v0] fetchAllTokens called on server side, skipping")
      return []
    }

    console.log("[v0] Environment check:", {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("[v0] Supabase environment variables not configured")
      throw new Error("Database not configured. Please contact support.")
    }

    console.log("[v0] Creating Supabase client...")
    const supabase = createClient()

    if (!supabase) {
      console.error("[v0] Supabase client failed to initialize")
      throw new Error("Database connection failed. Please try again.")
    }

    console.log("[v0] Fetching tokens from database...")
    const { data: tokens, error: tokensError } = await supabase
      .from("meme_tokens")
      .select(`
        id,
        name,
        symbol,
        image,
        current_price,
        start_price,
        market_cap,
        max_supply,
        current_supply,
        holders,
        creator,
        intuition_link,
        is_alpha,
        contract_address,
        is_completed,
        created_at,
        factory_address
      `)
      .order("created_at", { ascending: false })

    if (tokensError) {
      console.error("[v0] Error fetching tokens from database:", tokensError)
      throw new Error(`Database error: ${tokensError.message}`)
    }

    console.log("[v0] Raw tokens data:", tokens)
    console.log("[v0] Tokens count:", tokens?.length || 0)

    if (!tokens || tokens.length === 0) {
      console.log("[v0] No tokens found in database")
      return []
    }

    console.log("[v0] Fetched", tokens.length, "tokens from database")
    console.log("[v0] Sample token from database:", tokens[0])

    // Fetch creator profiles separately
    const creatorAddresses = [...new Set(tokens.map((t) => t.creator))]
    console.log("[v0] Fetching profiles for creators:", creatorAddresses)

    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("wallet_address, display_name, profile_image")
      .in("wallet_address", creatorAddresses)

    console.log("[v0] Fetched", profiles?.length || 0, "creator profiles")

    // Create a map of profiles for quick lookup
    const profileMap = new Map((profiles || []).map((p) => [p.wallet_address, p]))

    // Merge tokens with profiles
    const result = tokens.map((token) => {
      const profile = profileMap.get(token.creator)
      return supabaseToToken({
        ...token,
        factory_address: token.factory_address,
        user_profiles: profile
          ? {
              display_name: profile.display_name,
              profile_image: profile.profile_image,
            }
          : null,
      })
    })

    console.log("[v0] Returning", result.length, "formatted tokens")
    console.log("[v0] Sample formatted token:", result[0])
    return result
  } catch (error: any) {
    console.error("[v0] Error fetching tokens:", error)
    throw error
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
    if (!supabase) return false

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
    console.log("[v0] createTokenInDatabase called with:", {
      name: token.name,
      symbol: token.symbol,
      contractAddress: token.contractAddress,
      creator: token.creator,
    })

    const supabase = createClient()
    if (!supabase) {
      console.error("[v0] Supabase client not initialized")
      return null
    }

    console.log("[v0] Supabase client created successfully")

    console.log("[v0] Ensuring user profile exists for creator:", token.creator)
    const profileCreated = await ensureUserProfileExists(token.creator)
    if (!profileCreated) {
      console.error("[v0] Failed to create user profile, cannot create token")
      return null
    }

    const createdAt = token.createdAt || new Date().toISOString()
    console.log("[v0] Using timestamp:", createdAt)

    const insertData: any = {
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
      created_at: createdAt,
    }

    // Only add factory_address if it's provided (for backward compatibility)
    if (token.factoryAddress) {
      insertData.factory_address = token.factoryAddress
    }

    console.log("[v0] Inserting token data:", insertData)

    const { data, error } = await supabase.from("meme_tokens").insert([insertData]).select().single()

    if (error) {
      console.error("[v0] Error creating token in database:", error)
      console.error("[v0] Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return null
    }

    console.log("[v0] Token inserted successfully:", data)
    const formattedToken = data ? supabaseToToken(data) : null
    console.log("[v0] Formatted token:", formattedToken)
    return formattedToken
  } catch (error) {
    console.error("[v0] Failed to create token (exception):", error)
    if (error instanceof Error) {
      console.error("[v0] Error message:", error.message)
      console.error("[v0] Error stack:", error.stack)
    }
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
    if (!supabase) {
      console.error("[v0] Supabase client not initialized")
      return false
    }

    // Build the update object with snake_case keys
    const dbUpdates: any = {}
    if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice
    if (updates.currentSupply !== undefined) dbUpdates.current_supply = Math.floor(updates.currentSupply)

    if (updates.currentSupply !== undefined) {
      // Auto-calculate market cap using bonding curve formula
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
    if (!supabase) {
      console.error("[v0] Supabase client not initialized")
      return false
    }

    // First, get all token contract addresses
    const { data: allTokens } = await supabase.from("meme_tokens").select("contract_address")

    if (!allTokens || allTokens.length === 0) {
      console.log("[v0] No tokens to delete")
      return true
    }

    const tokenAddresses = allTokens.map((t) => t.contract_address)

    // Delete all starred tokens that reference these tokens
    const { error: starredError } = await supabase.from("starred_tokens").delete().in("token_address", tokenAddresses)

    if (starredError) {
      console.error("[v0] Error clearing starred tokens:", starredError)
      // Don't fail the whole operation if starred tokens deletion fails
    }

    // Delete all tokens using neq with a non-existent id to match all rows
    const { error: tokensError } = await supabase
      .from("meme_tokens")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (tokensError) {
      console.error("[v0] Error deleting tokens:", tokensError)
      return false
    }

    console.log("[v0] All tokens and starred references deleted successfully")
    return true
  } catch (error) {
    console.error("[v0] Failed to delete tokens:", error)
    return false
  }
}

export async function ensureUserProfileExists(walletAddress: string): Promise<boolean> {
  try {
    const supabase = createClient()
    if (!supabase) {
      console.error("[v0] Supabase client not initialized")
      return false
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("wallet_address")
      .eq("wallet_address", walletAddress)
      .single()

    if (existingProfile) {
      console.log("[v0] User profile already exists for:", walletAddress)
      return true
    }

    // Create new profile
    console.log("[v0] Creating user profile for:", walletAddress)
    const { error } = await supabase.from("user_profiles").insert([
      {
        wallet_address: walletAddress,
        display_name: null,
        bio: null,
        profile_image: null,
      },
    ])

    if (error) {
      console.error("[v0] Error creating user profile:", error)
      return false
    }

    console.log("[v0] User profile created successfully")
    return true
  } catch (error) {
    console.error("[v0] Failed to ensure user profile exists:", error)
    return false
  }
}
