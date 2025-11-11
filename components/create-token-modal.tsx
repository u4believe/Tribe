"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Upload, Loader2 } from "lucide-react"
import Image from "next/image"
import { useContract } from "@/hooks/use-contract"
import { useWallet } from "@/hooks/use-wallet"
import { checkLinkExists, createTokenInDatabase, validateIntuitionLink, normalizeIntuitionLink } from "@/lib/tokens"
import type { MemeToken } from "@/lib/tokens"

interface CreateTokenModalProps {
  onClose: () => void
  onCreate: (token: MemeToken) => void
  existingTokens?: MemeToken[]
}

export default function CreateTokenModal({ onClose, onCreate, existingTokens = [] }: CreateTokenModalProps) {
  const [step, setStep] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const { createToken } = useContract()
  const { address } = useWallet()

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    maxSupply: "1000000000",
    image: "/meme-token.jpg",
    intuitionLink: "",
  })

  const supplyOptions = [{ value: "1000000000", label: "1 Billion", startPrice: 0.000000001 }]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const validateIntuitionLinkField = (): string | null => {
    const link = formData.intuitionLink.trim()

    if (link === "") {
      return null // Link is optional
    }

    const validation = validateIntuitionLink(link)
    if (!validation.valid) {
      return validation.error || "Invalid link format"
    }

    return null
  }

  const handleCreate = async () => {
    if (!address) {
      setError("Please connect your wallet first")
      return
    }

    if (!formData.name || !formData.symbol) {
      setError("Please fill in all required fields")
      return
    }

    const linkValidationError = validateIntuitionLinkField()
    if (linkValidationError) {
      setError(linkValidationError)
      return
    }

    if (formData.intuitionLink) {
      const validation = validateIntuitionLink(formData.intuitionLink)
      if (!validation.valid) {
        setError(validation.error || "Invalid link format")
        return
      }

      const linkExists = await checkLinkExists(formData.intuitionLink)
      if (linkExists) {
        setError("This Intuition Graph link is already in use. Please use a unique link.")
        return
      }
    }

    setIsLoading(true)
    setError("")

    try {
      const imageUrl = formData.image

      const metadata = JSON.stringify({
        name: formData.name,
        symbol: formData.symbol,
        intuitionLink: formData.intuitionLink,
      })

      const tokenAddress = await createToken(formData.name, formData.symbol, metadata)

      const normalizedLink = formData.intuitionLink ? normalizeIntuitionLink(formData.intuitionLink) : ""

      const newToken: Omit<MemeToken, "id"> = {
        name: formData.name,
        symbol: formData.symbol,
        image: imageUrl,
        currentPrice: 0.0001533,
        startPrice: 0.0001533,
        marketCap: 0,
        maxSupply: 1000000000,
        currentSupply: 0,
        holders: 1,
        creator: address,
        intuitionLink: normalizedLink,
        isAlpha: true,
        contractAddress: tokenAddress,
      }

      const savedToken = await createTokenInDatabase(newToken)

      if (savedToken) {
        onCreate(savedToken)
        onClose()
      } else {
        setError("Failed to save token. Please try again.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token")
      console.error("[v0] Token creation error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-card border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="text-2xl font-bold text-foreground">Create Meme Token</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Step Indicator */}
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted/30"}`}
              />
            ))}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Token Name</label>
                <Input
                  name="name"
                  placeholder="e.g., Doge Moon"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="bg-input border-border text-foreground"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Token Symbol</label>
                <Input
                  name="symbol"
                  placeholder="e.g., DMOON"
                  value={formData.symbol}
                  onChange={handleInputChange}
                  className="bg-input border-border text-foreground"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Token Image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                >
                  {formData.image && formData.image.startsWith("data:") ? (
                    <div className="space-y-2">
                      <div className="relative w-20 h-20 mx-auto">
                        <Image
                          src={formData.image || "/placeholder.svg"}
                          alt="Preview"
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                      <p className="text-sm text-primary font-medium">Image uploaded</p>
                      <p className="text-xs text-muted-foreground">Click to change</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Max Supply & Pricing</h3>

              <div>
                <label className="text-sm text-muted-foreground mb-3 block">Max Supply</label>
                <div className="p-4 rounded-lg border-2 border-primary bg-primary/10">
                  <p className="font-semibold text-foreground">1 Billion</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Intuition Graph Link</h3>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Intuition Portal Link (Optional)</label>
                <Input
                  name="intuitionLink"
                  placeholder="https://portal.intuition.systems/explore/atom/0x..."
                  value={formData.intuitionLink}
                  onChange={handleInputChange}
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Link must be in the exact format: https://portal.intuition.systems/explore/atom/0x... (without any
                  additional paths or parameters). Each token must have a unique atom link.
                </p>
              </div>

              <div className="p-4 bg-muted/20 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-foreground">Review Your Token:</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Name: <span className="text-foreground font-semibold">{formData.name}</span>
                  </p>
                  <p>
                    Symbol: <span className="text-foreground font-semibold">${formData.symbol}</span>
                  </p>
                  <p>
                    Max Supply: <span className="text-foreground font-semibold">1 Billion</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button onClick={() => setStep(step - 1)} variant="outline" className="flex-1" disabled={isLoading}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Token"
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
