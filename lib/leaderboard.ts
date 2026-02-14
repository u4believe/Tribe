import { createBrowserClient } from "./supabase/client"
import { getUserVolume } from "./contract-functions"

export interface LeaderboardTrader {
  address: string
  totalVolume: string
  buyVolume: string
  sellVolume: string
  rank: number
  displayName?: string
}

export interface LeaderboardUser {
  address: string
  points: number
  tradingPoints: number
  commentPoints: number
  rank: number
  displayName?: string
}

export async function getTopTraders(limit = 25): Promise<LeaderboardTrader[]> {
  try {
    console.log("[v0] Getting top traders from blockchain...")

    const supabase = createBrowserClient()

    // Get all unique addresses from token_trades table
    const { data: trades, error } = await supabase.from("token_trades").select("trader_address").limit(1000)

    if (error) {
      console.error("[v0] Error fetching trades:", error)
      return []
    }

    const uniqueAddresses = [...new Set(trades?.map((t) => t.trader_address.toLowerCase()) || [])]
    console.log(`[v0] Found ${uniqueAddresses.length} unique addresses from trades`)

    if (uniqueAddresses.length === 0) {
      console.log("[v0] No traders found")
      return []
    }

    // Fetch volumes for each unique address
    const traderVolumes = await Promise.all(
      uniqueAddresses.map(async (address) => {
        const volume = await getUserVolume(address)
        return {
          address,
          ...volume,
        }
      }),
    )

    console.log(`[v0] Fetched volumes for ${traderVolumes.length} traders`)

    // Filter traders with actual volume and sort
    const traders: LeaderboardTrader[] = traderVolumes
      .filter((trader) => {
        const totalVol = Number.parseFloat(trader.totalVolume)
        if (totalVol > 0) {
          console.log(`[v0] Trader ${trader.address}: ${trader.totalVolume} TRUST total volume`)
        }
        return totalVol > 0
      })
      .sort((a, b) => Number.parseFloat(b.totalVolume) - Number.parseFloat(a.totalVolume))
      .slice(0, limit)
      .map((trader, index) => ({
        ...trader,
        rank: index + 1,
      }))

    console.log(`[v0] Returning ${traders.length} traders with volume > 0`)
    return traders
  } catch (error) {
    console.error("[v0] Error getting top traders:", error)
    return []
  }
}

export async function getMostActiveUsers(limit = 25): Promise<LeaderboardUser[]> {
  try {
    const supabase = createBrowserClient()

    if (!supabase) {
      console.error("[v0] Supabase client not available")
      return []
    }

    const { data: users, error } = await supabase
      .from("user_points")
      .select("wallet_address, points, trading_points, comment_points")
      .order("points", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[v0] Error fetching most active users:", error)
      return []
    }

    if (!users || users.length === 0) {
      return []
    }

    // Get display names from user_profiles if they exist
    const addresses = users.map((u) => u.wallet_address)
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("wallet_address, display_name")
      .in("wallet_address", addresses)

    const profileMap = new Map(profiles?.map((p) => [p.wallet_address, p.display_name]) || [])

    return users.map((user, index) => ({
      address: user.wallet_address,
      points: Number(user.points || 0),
      tradingPoints: Number(user.trading_points || 0),
      commentPoints: Number(user.comment_points || 0),
      rank: index + 1,
      displayName: profileMap.get(user.wallet_address),
    }))
  } catch (error) {
    console.error("[v0] Error getting most active users:", error)
    return []
  }
}

export async function getTopTradersFromDB(limit = 25): Promise<LeaderboardTrader[]> {
  try {
    console.log("[v0] Getting top traders from database...")
    const supabase = createBrowserClient()

    if (!supabase) {
      console.error("[v0] Supabase client not available")
      return []
    }

    const { data: allUsers, error: countError } = await supabase
      .from("user_points")
      .select("wallet_address, total_volume")
      .limit(100)

    console.log("[v0] Total user_points rows:", allUsers?.length || 0)
    if (allUsers && allUsers.length > 0) {
      console.log("[v0] Sample user_points data:", allUsers.slice(0, 3))
    }

    // Query user_points table for users with trading volume
    const { data: traders, error } = await supabase
      .from("user_points")
      .select("wallet_address, total_volume, total_buy_volume, total_sell_volume")
      .gt("total_volume", 0)
      .order("total_volume", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[v0] Error fetching top traders:", error)
      return []
    }

    console.log("[v0] Found traders with volume > 0:", traders?.length || 0)

    if (!traders || traders.length === 0) {
      console.log("[v0] No traders found in database with volume > 0")
      return []
    }

    // Get display names from user_profiles
    const addresses = traders.map((t) => t.wallet_address)
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("wallet_address, display_name")
      .in("wallet_address", addresses)

    const profileMap = new Map(profiles?.map((p) => [p.wallet_address, p.display_name]) || [])

    return traders.map((trader, index) => ({
      address: trader.wallet_address,
      totalVolume: trader.total_volume?.toString() || "0",
      buyVolume: trader.total_buy_volume?.toString() || "0",
      sellVolume: trader.total_sell_volume?.toString() || "0",
      rank: index + 1,
      displayName: profileMap.get(trader.wallet_address),
    }))
  } catch (error) {
    console.error("[v0] Error getting top traders from DB:", error)
    return []
  }
}

export async function getAllTopTraders(limit = 25): Promise<LeaderboardTrader[]> {
  // Same implementation as getTopTraders but for server-side use
  return getTopTraders(limit)
}

export async function getTopUsersByPoints(limit = 25): Promise<LeaderboardUser[]> {
  // Same implementation as getMostActiveUsers but with better naming
  return getMostActiveUsers(limit)
}

export async function getCachedLeaderboard(type: "top_traders" | "most_active") {
  try {
    const supabase = createBrowserClient()

    if (!supabase) {
      console.error("[v0] Supabase client not available")
      return null
    }

    const { data, error } = await supabase
      .from("leaderboard_cache")
      .select("data, last_updated")
      .eq("cache_type", type)
      .limit(1)

    if (error) {
      console.error(`[v0] Error fetching ${type} cache:`, error)
      return null
    }

    if (!data || data.length === 0) {
      console.log(`[v0] No cached data found for ${type}`)
      return null
    }

    return data[0]
  } catch (error) {
    console.error(`[v0] Error getting cached ${type}:`, error)
    return null
  }
}

export function shouldRefreshCache(lastUpdated: string | null): boolean {
  if (!lastUpdated) return true

  const lastUpdate = new Date(lastUpdated)
  const now = new Date()
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60)

  return hoursSinceUpdate >= 24
}
