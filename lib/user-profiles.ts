import { createBrowserClient } from "@/lib/supabase/client"

export interface UserProfile {
  wallet_address: string
  display_name?: string
  profile_image?: string
  bio?: string
  created_at?: string
  updated_at?: string
}

export async function getUserProfile(walletAddress: string): Promise<UserProfile | null> {
  if (!walletAddress) return null

  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // Profile doesn't exist yet
      return null
    }
    console.error("[v0] Error fetching user profile:", error)
    throw error
  }

  return data
}

export async function createOrUpdateUserProfile(profile: UserProfile): Promise<UserProfile> {
  const supabase = createBrowserClient()

  const profileData = {
    wallet_address: profile.wallet_address.toLowerCase(),
    display_name: profile.display_name,
    profile_image: profile.profile_image,
    bio: profile.bio,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(profileData, {
      onConflict: "wallet_address",
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Error creating/updating user profile:", error)
    throw error
  }

  return data
}
