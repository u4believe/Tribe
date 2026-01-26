"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"

interface WelcomeSplashProps {
  onEnter: () => void
}

export default function WelcomeSplash({ onEnter }: WelcomeSplashProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  const handleEnter = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      onEnter()
    }, 500)
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-500 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <Card className="relative z-10 bg-card border border-border hover:border-primary/50 transition-all hover:shadow-lg rounded-xl max-w-md mx-4">
        <div className="p-6 md:p-8 space-y-5">
          <div className="flex items-center justify-center pb-5 border-b border-border">
            <div className="w-24 h-24 rounded-full border-2 border-border overflow-hidden">
              <img
                src="/pepe-frog-wearing-gold-chains-rapper-style-cartoon.jpg"
                alt="Pepe"
                className="w-full h-full object-cover object-top scale-150"
              />
            </div>
          </div>

          <div className="pb-5 border-b border-border">
            <p className="text-xl font-medium text-foreground text-center">Create on TRIBE. Trade Natively.</p>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleEnter}
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Enter Launchpad
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
