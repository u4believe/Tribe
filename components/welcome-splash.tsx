"use client"

import { useState, useEffect } from "react"
import { ArrowRight } from "lucide-react"

interface WelcomeSplashProps {
  onEnter: () => void
}

export default function WelcomeSplash({ onEnter }: WelcomeSplashProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const handler = (e: MouseEvent) => {
      console.log("[splash] click detected on document")
    }
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [mounted])

  const handleEnter = () => {
    console.log("[splash] handleEnter called, isExiting:", isExiting)
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      console.log("[splash] timeout fired, calling onEnter")
      onEnter()
    }, 400)
  }

  if (!mounted) return null

  return (
    <div
      onClick={handleEnter}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "black",
        opacity: isExiting ? 0 : 1,
        transition: "opacity 400ms ease-out",
        cursor: "pointer",
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation()
          handleEnter()
        }}
        className="bg-card border border-border hover:border-primary/50 transition-all hover:shadow-lg rounded-xl max-w-md mx-4"
      >
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                console.log("[splash] button clicked directly")
                handleEnter()
              }}
              style={{
                width: "100%",
                padding: "12px 24px",
                backgroundColor: "var(--primary, #14b8a6)",
                color: "var(--primary-foreground, black)",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              Enter Launchpad
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
