"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { getUserProfile, createOrUpdateUserProfile, type UserProfile } from "@/lib/user-profiles"
import Header from "@/components/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, User, Loader2, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"

export default function SettingsPage() {
  const { address } = useWallet()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      if (!address) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const userProfile = await getUserProfile(address)
        if (userProfile) {
          setProfile(userProfile)
          setDisplayName(userProfile.display_name || "")
          setBio(userProfile.bio || "")
          setProfileImage(userProfile.profile_image || "")
        }
      } catch (error) {
        console.error("[v0] Error loading profile:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [address])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      setMessage({ type: "error", text: "Please upload a JPG, PNG, GIF, or WebP image." })
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setMessage({ type: "error", text: "Image too large. Maximum size is 5MB." })
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setPreviewImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    setIsUploading(true)
    setMessage(null)

    try {
      const supabase = createBrowserClient()

      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const fileExt = file.name.split(".").pop()
      const fileName = `profile-${timestamp}-${randomString}.${fileExt}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage.from("profile-images").upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      })

      if (error) {
        console.error("[v0] Upload error:", error)
        throw new Error(error.message)
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage.from("profile-images").getPublicUrl(data.path)

      setProfileImage(publicUrlData.publicUrl)
      setMessage({ type: "success", text: "Image uploaded successfully!" })
    } catch (error) {
      console.error("[v0] Error uploading image:", error)
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to upload image" })
      setPreviewImage(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClearImage = () => {
    setProfileImage("")
    setPreviewImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSaveProfile = async () => {
    if (!address) return

    setIsSaving(true)
    setMessage(null)

    try {
      const updatedProfile = await createOrUpdateUserProfile({
        wallet_address: address,
        display_name: displayName,
        bio: bio,
        profile_image: profileImage,
      })

      setProfile(updatedProfile)
      setMessage({ type: "success", text: "Profile saved successfully!" })
    } catch (error) {
      console.error("[v0] Error saving profile:", error)
      setMessage({ type: "error", text: "Failed to save profile. Please try again." })
    } finally {
      setIsSaving(false)
    }
  }

  if (!address) {
    return (
      <main className="min-h-screen bg-background">
        <Header onCreateClick={() => {}} />
        <div className="container mx-auto px-4 py-12 pt-36 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Settings</h1>
          <p className="text-muted-foreground">Connect your wallet to access settings</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Header onCreateClick={() => {}} />
      <div className="container mx-auto px-4 py-8 pt-36 max-w-2xl">
        <Button onClick={() => router.push("/")} variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Launchpad
        </Button>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
          </div>

          {isLoading ? (
            <Card className="bg-card border-border p-12 text-center">
              <p className="text-muted-foreground">Loading profile...</p>
            </Card>
          ) : (
            <Card className="bg-card border-border p-6 space-y-6">
              {/* Profile Image */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">Profile Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-muted/30 overflow-hidden flex items-center justify-center border-2 border-border">
                    {previewImage || profileImage ? (
                      <img
                        src={previewImage || profileImage || "/placeholder.svg"}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        variant="outline"
                        className="flex-1"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Choose Image
                          </>
                        )}
                      </Button>
                      {(profileImage || previewImage) && (
                        <Button
                          type="button"
                          onClick={handleClearImage}
                          disabled={isUploading}
                          variant="outline"
                          size="icon"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Upload JPG, PNG, GIF, or WebP (max 5MB)</p>
                  </div>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">Display Name</label>
                <Input
                  placeholder="Enter your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
              </div>

              {/* Bio */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">Bio</label>
                <Textarea
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="bg-input border-border text-foreground min-h-[120px]"
                />
              </div>

              {/* Wallet Address (Read-only) */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">Wallet Address</label>
                <Input value={address} disabled className="bg-muted/30 border-border text-muted-foreground" />
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving || isUploading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg font-semibold"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Profile"
                  )}
                </Button>
              </div>

              {/* Success/Error Message */}
              {message && (
                <div
                  className={`p-4 rounded-lg ${
                    message.type === "success"
                      ? "bg-green-500/10 border border-green-500/30 text-green-400"
                      : "bg-red-500/10 border border-red-500/30 text-red-400"
                  }`}
                >
                  {message.text}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
