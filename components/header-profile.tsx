"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { getUserProfile } from "@/lib/user-profiles"
import type { UserProfile } from "@/lib/user-profiles"
import Image from "next/image"
import { User } from "lucide-react"

export default function HeaderProfile() {
  const { address } = useWallet()
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      if (!address) {
        setProfile(null)
        return
      }

      try {
        const userProfile = await getUserProfile(address)
        setProfile(userProfile)
      } catch (error) {
        console.error("[v0] Error loading user profile:", error)
        setProfile(null)
      }
    }

    loadProfile()
  }, [address])

  if (!address) return null

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted/50 flex-shrink-0">
        {profile?.profile_image ? (
          <Image src={profile.profile_image || "/placeholder.svg"} alt="Profile" fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <span className="text-sm font-mono text-foreground">{formatAddress(address)}</span>
    </div>
  )
}
