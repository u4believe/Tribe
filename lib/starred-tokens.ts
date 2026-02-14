"use client"

import { createBrowserClient } from "@/lib/supabase/client"

export async function toggleStarToken(userAddress: string, tokenAddress: string): Promise<boolean> {
  console.log("[v0] toggleStarToken called:", { userAddress, tokenAddress })

  const supabase = createBrowserClient()
  if (!supabase) {
    console.error("[v0] Supabase client not available")
    return false
  }

  try {
    // Check if already starred
    console.log("[v0] Checking if token is already starred...")
    const { data: existing, error: checkError } = await supabase
      .from("starred_tokens")
      .select("id")
      .eq("user_address", userAddress.toLowerCase())
      .eq("token_address", tokenAddress.toLowerCase())
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[v0] Error checking star status:", checkError)
      throw checkError
    }

    if (existing) {
      // Unstar
      console.log("[v0] Token is starred, unstaring...")
      const { error } = await supabase
        .from("starred_tokens")
        .delete()
        .eq("user_address", userAddress.toLowerCase())
        .eq("token_address", tokenAddress.toLowerCase())

      if (error) {
        console.error("[v0] Error unstaring token:", error)
        throw error
      }
      console.log("[v0] Token unstarred successfully")
      return false // Now unstarred
    } else {
      // Star
      console.log("[v0] Token is not starred, starring...")
      const { error } = await supabase.from("starred_tokens").insert({
        user_address: userAddress.toLowerCase(),
        token_address: tokenAddress.toLowerCase(),
      })

      if (error) {
        console.error("[v0] Error starring token:", error)
        throw error
      }
      console.log("[v0] Token starred successfully")
      return true // Now starred
    }
  } catch (error) {
    console.error("[v0] Error toggling star:", error)
    throw error
  }
}

export async function getStarredTokens(userAddress: string): Promise<string[]> {
  // Return empty array if no user address provided
  if (!userAddress) {
    return []
  }

  try {
    const supabase = createBrowserClient()
    if (!supabase) {
      console.log("[v0] Supabase client not available for getStarredTokens")
      return []
    }

    const { data, error } = await supabase
      .from("starred_tokens")
      .select("token_address")
      .eq("user_address", userAddress.toLowerCase())

    if (error) {
      // Don't throw, just log and return empty array
      console.log("[v0] Error fetching starred tokens (non-critical):", error.message)
      return []
    }

    return data?.map((item) => item.token_address) || []
  } catch (error) {
    // Catch any network errors and return empty array
    console.log("[v0] Network error fetching starred tokens (non-critical):", error)
    return []
  }
}

export async function isTokenStarred(userAddress: string, tokenAddress: string): Promise<boolean> {
  // Return false if missing parameters
  if (!userAddress || !tokenAddress) {
    return false
  }

  try {
    const supabase = createBrowserClient()
    if (!supabase) return false

    const { data, error } = await supabase
      .from("starred_tokens")
      .select("id")
      .eq("user_address", userAddress.toLowerCase())
      .eq("token_address", tokenAddress.toLowerCase())
      .single()

    if (error) {
      return false
    }

    return !!data
  } catch (error) {
    return false
  }
}
