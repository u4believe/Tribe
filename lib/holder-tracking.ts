import { createClient } from "@/lib/supabase/client"
import { getUserTokenBalance } from "@/lib/contract-functions"

// Track a holder for a token (call this after buy/sell transactions)
export async function trackTokenHolder(tokenAddress: string, holderAddress: string): Promise<void> {
  try {
    console.log(`[v0] Tracking holder ${holderAddress} for token ${tokenAddress}`)
    const supabase = createClient()

    // Get the actual balance from the blockchain
    const balance = await getUserTokenBalance(tokenAddress, holderAddress)
    const balanceNum = Number.parseFloat(balance)
    console.log(`[v0] Holder balance: ${balanceNum}`)

    const { error: tableCheckError } = await supabase.from("token_holders").select("*").limit(1)

    if (tableCheckError && tableCheckError.message.includes("does not exist")) {
      console.warn("[v0] token_holders table does not exist yet. Run migration script 009.")
      // Update holders count manually in meme_tokens if table doesn't exist
      return
    }

    // Upsert the holder record
    const { error } = await supabase.from("token_holders").upsert(
      {
        token_address: tokenAddress,
        holder_address: holderAddress,
        balance: balanceNum,
        last_trade_at: new Date().toISOString(),
      },
      {
        onConflict: "token_address,holder_address",
      },
    )

    if (error) {
      console.error("[v0] Error tracking holder:", error)
      return
    }

    console.log("[v0] Holder tracked successfully, updating holder count...")
    // Update the holders count in meme_tokens table
    await updateHoldersCount(tokenAddress)
  } catch (error) {
    console.error("[v0] Failed to track holder:", error)
  }
}

// Update the holders count for a token
export async function updateHoldersCount(tokenAddress: string): Promise<number> {
  try {
    const supabase = createClient()

    // Count unique holders with balance > 0
    const { data, error } = await supabase
      .from("token_holders")
      .select("holder_address", { count: "exact", head: false })
      .eq("token_address", tokenAddress)
      .gt("balance", 0)

    if (error) {
      console.error("[v0] Error counting holders:", error)
      return 0
    }

    const holderCount = data?.length || 0

    // Update the meme_tokens table
    const { error: updateError } = await supabase
      .from("meme_tokens")
      .update({ holders: holderCount })
      .eq("contract_address", tokenAddress)

    if (updateError) {
      console.error("[v0] Error updating holder count:", updateError)
    }

    console.log(`[v0] Updated holder count for ${tokenAddress}: ${holderCount}`)
    return holderCount
  } catch (error) {
    console.error("[v0] Failed to update holders count:", error)
    return 0
  }
}

// Get all holders for a token
export async function getTokenHolders(tokenAddress: string): Promise<
  Array<{
    address: string
    balance: number
    firstBuyAt: string
    lastTradeAt: string
  }>
> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("token_holders")
      .select("*")
      .eq("token_address", tokenAddress)
      .gt("balance", 0)
      .order("balance", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching holders:", error)
      return []
    }

    return (
      data?.map((holder) => ({
        address: holder.holder_address,
        balance: holder.balance,
        firstBuyAt: holder.first_buy_at,
        lastTradeAt: holder.last_trade_at,
      })) || []
    )
  } catch (error) {
    console.error("[v0] Failed to fetch holders:", error)
    return []
  }
}
