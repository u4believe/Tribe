import { createBrowserClient } from "./supabase/client"
import { getUserVolume } from "./contract-functions"

// Points calculation constant (k value)
// Adjust this to scale the points (higher k = more points)
const POINTS_MULTIPLIER = 10

/**
 * Calculate points using anti-whale logarithmic formula
 * Points = k × log(1 + Trade Volume)
 *
 * This prevents whales from dominating while still rewarding higher volume
 */
export function calculatePoints(tradeVolume: number): number {
  if (tradeVolume <= 0) return 0

  // Using natural logarithm (Math.log is ln in JavaScript)
  const points = POINTS_MULTIPLIER * Math.log(1 + tradeVolume)

  return Math.max(0, points) // Ensure non-negative
}

/**
 * Fetch user's trading volume from the blockchain
 * Use getUserVolume helper that uses userVolumes mapping
 */
export async function getUserVolumeFromBlockchain(walletAddress: string): Promise<{
  buyVolume: number
  sellVolume: number
  totalVolume: number
}> {
  try {
    const volume = await getUserVolume(walletAddress)

    return {
      buyVolume: Number.parseFloat(volume.buyVolume),
      sellVolume: Number.parseFloat(volume.sellVolume),
      totalVolume: Number.parseFloat(volume.totalVolume),
    }
  } catch (error) {
    console.error("[v0] Failed to fetch user volume from blockchain:", error)
    return { buyVolume: 0, sellVolume: 0, totalVolume: 0 }
  }
}

/**
 * Update user points in the database based on their blockchain trading volume
 */
export async function updateUserPoints(walletAddress: string): Promise<{
  totalVolume: number
  points: number
} | null> {
  try {
    const supabase = createBrowserClient()

    // Fetch volume from blockchain
    const { buyVolume, sellVolume, totalVolume } = await getUserVolumeFromBlockchain(walletAddress)

    // Calculate points from trading volume using anti-whale formula
    const tradingPoints = calculatePoints(totalVolume)

    const { data: existingData } = await supabase
      .from("user_points")
      .select("comment_points")
      .eq("wallet_address", walletAddress.toLowerCase())
      .single()

    const commentPoints = existingData?.comment_points ? Number(existingData.comment_points) : 0

    // Total points = trading points + comment points
    const totalPoints = tradingPoints + commentPoints

    console.log("[v0] Updating points for", walletAddress, {
      buyVolume,
      sellVolume,
      totalVolume,
      tradingPoints,
      commentPoints,
      totalPoints,
    })

    // Upsert user points in database
    const { data, error } = await supabase
      .from("user_points")
      .upsert(
        {
          wallet_address: walletAddress.toLowerCase(),
          total_buy_volume: buyVolume,
          total_sell_volume: sellVolume,
          total_volume: totalVolume,
          trading_points: tradingPoints,
          comment_points: commentPoints,
          points: totalPoints,
          last_updated: new Date().toISOString(),
        },
        {
          onConflict: "wallet_address",
        },
      )
      .select()
      .single()

    if (error) {
      // If table doesn't exist, still return the calculated values
      if (error.message?.includes("Could not find the table")) {
        console.warn(
          "[v0] user_points table not found. Please run the migration script: scripts/007_create_user_points_table.sql",
        )
        return { totalVolume, points: totalPoints }
      }
      console.error("[v0] Failed to update user points in database:", error)
      return null
    }

    return { totalVolume, points: totalPoints }
  } catch (error) {
    console.error("[v0] Error updating user points:", error)
    return null
  }
}

/**
 * Get user points from database
 */
export async function getUserPoints(walletAddress: string): Promise<{
  totalVolume: number
  points: number
  buyVolume: number
  sellVolume: number
  lastUpdated: string
} | null> {
  try {
    const supabase = createBrowserClient()

    const { data, error } = await supabase
      .from("user_points")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .single()

    if (error) {
      // If table doesn't exist, fetch directly from blockchain
      if (error.message?.includes("Could not find the table")) {
        console.warn("[v0] user_points table not found. Fetching directly from blockchain...")
        const { buyVolume, sellVolume, totalVolume } = await getUserVolumeFromBlockchain(walletAddress)
        const tradingPoints = calculatePoints(totalVolume)
        const commentPoints = 0
        const totalPoints = tradingPoints + commentPoints

        return {
          totalVolume,
          points: totalPoints,
          buyVolume,
          sellVolume,
          lastUpdated: new Date().toISOString(),
        }
      }

      // No record exists, fetch from blockchain and try to create it
      if (error.code === "PGRST116") {
        console.log("[v0] No points record found for user, fetching from blockchain...")
        const result = await updateUserPoints(walletAddress)
        if (!result) return null

        // Fetch volumes again for complete data
        const { buyVolume, sellVolume } = await getUserVolumeFromBlockchain(walletAddress)
        return {
          totalVolume: result.totalVolume,
          points: result.points,
          buyVolume,
          sellVolume,
          lastUpdated: new Date().toISOString(),
        }
      }

      console.error("[v0] Error fetching user points:", error)
      return null
    }

    if (!data) {
      console.log("[v0] No points record found for user, fetching from blockchain...")
      const result = await updateUserPoints(walletAddress)
      if (!result) return null

      const { buyVolume, sellVolume } = await getUserVolumeFromBlockchain(walletAddress)
      return {
        totalVolume: result.totalVolume,
        points: result.points,
        buyVolume,
        sellVolume,
        lastUpdated: new Date().toISOString(),
      }
    }

    return {
      totalVolume: Number(data.total_volume),
      points: Number(data.points),
      buyVolume: Number(data.total_buy_volume),
      sellVolume: Number(data.total_sell_volume),
      lastUpdated: data.last_updated,
    }
  } catch (error) {
    console.error("[v0] Error fetching user points:", error)
    return null
  }
}

/**
 * Get leaderboard (top users by points)
 */
export async function getPointsLeaderboard(limit = 100): Promise<
  Array<{
    walletAddress: string
    points: number
    totalVolume: number
  }>
> {
  try {
    const supabase = createBrowserClient()

    const { data, error } = await supabase
      .from("user_points")
      .select("wallet_address, points, total_volume")
      .order("points", { ascending: false })
      .limit(limit)

    if (error || !data) {
      console.error("[v0] Failed to fetch leaderboard:", error)
      return []
    }

    return data.map((row) => ({
      walletAddress: row.wallet_address,
      points: Number(row.points),
      totalVolume: Number(row.total_volume),
    }))
  } catch (error) {
    console.error("[v0] Error fetching leaderboard:", error)
    return []
  }
}

/**
 * Award points for posting a comment
 * Fixed reward: 0.025 points per comment
 */
export async function awardCommentPoints(walletAddress: string): Promise<boolean> {
  try {
    const supabase = createBrowserClient()
    const COMMENT_POINTS = 0.025

    const { data: currentData, error: fetchError } = await supabase
      .from("user_points")
      .select("points, comment_points, trading_points, total_volume, total_buy_volume, total_sell_volume")
      .eq("wallet_address", walletAddress.toLowerCase())
      .single()

    let newCommentPoints = COMMENT_POINTS
    let tradingPoints = 0
    let totalVolume = 0
    let buyVolume = 0
    let sellVolume = 0

    if (currentData && !fetchError) {
      // User exists, add to their comment points
      newCommentPoints = (Number(currentData.comment_points) || 0) + COMMENT_POINTS
      tradingPoints = Number(currentData.trading_points) || 0
      totalVolume = Number(currentData.total_volume) || 0
      buyVolume = Number(currentData.total_buy_volume) || 0
      sellVolume = Number(currentData.total_sell_volume) || 0
    }

    const totalPoints = tradingPoints + newCommentPoints

    // Upsert the points
    const { error: upsertError } = await supabase.from("user_points").upsert(
      {
        wallet_address: walletAddress.toLowerCase(),
        trading_points: tradingPoints,
        comment_points: newCommentPoints,
        points: totalPoints,
        total_volume: totalVolume,
        total_buy_volume: buyVolume,
        total_sell_volume: sellVolume,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: "wallet_address",
      },
    )

    if (upsertError) {
      console.error("[v0] Failed to award comment points:", upsertError)
      return false
    }

    console.log(
      "[v0] Awarded",
      COMMENT_POINTS,
      "points for comment to",
      walletAddress,
      "Total comment points:",
      newCommentPoints,
    )
    return true
  } catch (error) {
    console.error("[v0] Error awarding comment points:", error)
    return false
  }
}
