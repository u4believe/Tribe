"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { getUserProfile } from "@/lib/user-profiles"
import type { UserProfile } from "@/lib/user-profiles"
import { Card } from "@/components/ui/card"
import Image from "next/image"
import { User, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function UserProfileCard() {
  const { address } = useWallet()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadProfile = async () => {
      if (!address) {
        setProfile(null)
        return
      }

      setIsLoading(true)
      try {
        const userProfile = await getUserProfile(address)
        setProfile(userProfile)
      } catch (error) {
        console.error("[v0] Error loading user profile:", error)
        setProfile(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [address])

  if (!address) return null

  if (isLoading) {
    return (
      <Card className="bg-card border-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted/30 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted/30 rounded animate-pulse w-32" />
            <div className="h-3 bg-muted/30 rounded animate-pulse w-24" />
          </div>
        </div>
      </Card>
    )
  }

  const displayName = profile?.display_name || `${address.slice(0, 6)}...${address.slice(-4)}`
  const hasProfile = profile?.display_name || profile?.profile_image || profile?.bio

  return (
    <Card className="bg-card border-border p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted/30 flex-shrink-0">
          {profile?.profile_image ? (
            <Image src={profile.profile_image || "/placeholder.svg"} alt={displayName} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
          <p className="text-sm text-muted-foreground font-mono truncate">{`${address.slice(0, 8)}...${address.slice(-6)}`}</p>
          {profile?.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profile.bio}</p>}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/settings")}
          className="flex-shrink-0 border-border hover:bg-muted/50"
        >
          <Settings className="w-4 h-4 mr-2" />
          {hasProfile ? "Edit" : "Setup"}
        </Button>
      </div>
    </Card>
  )
}
