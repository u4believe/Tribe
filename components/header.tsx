"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { useRouter } from "next/navigation"
import HeaderProfile from "@/components/header-profile"
import { isAdmin } from "@/lib/admin-config"
import EditProfileModal from "@/components/edit-profile-modal"

interface HeaderProps {
  onCreateClick: () => void
  onAlphaClick?: () => void
}

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const LogOutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
)

const WalletIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
    />
  </svg>
)

const SparklesIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
)

const TrendingUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
)

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
)

const AlertTriangleIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
)

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export default function Header({ onCreateClick, onAlphaClick }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(true)
  const { address, balance, isConnecting, connect, disconnect } = useWallet()
  const router = useRouter()
  const hasAlphaAccess = Number(balance) >= 2000
  const userIsAdmin = isAdmin(address)

  const handleConnect = async () => {
    await connect()
  }

  const handleDisconnect = async () => {
    await disconnect()
    setShowMenu(false)
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`
  }

  return (
    <>
      <div className="fixed top-0 left-16 right-0 z-50">
        {showDisclaimer && (
          <div className="bg-yellow-500/90 text-black px-4 py-2 flex items-center justify-center gap-3 relative">
            <AlertTriangleIcon />
            <p className="text-sm font-medium text-center">Disclaimer: This app runs on non-audited smart contracts.</p>
            <button
              onClick={() => setShowDisclaimer(false)}
              className="absolute right-4 p-1 hover:bg-yellow-600/50 rounded transition-colors"
              aria-label="Dismiss disclaimer"
            >
              <XIcon />
            </button>
          </div>
        )}

        <header className="h-[120px] border-b border-border bg-black">
          <div className="h-full flex items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <div className="relative w-48 h-16 cursor-pointer" onClick={() => router.push("/")}>
                <Image src="/tribe-logo.png" alt="TRIBE Logo" fill className="object-contain" priority />
              </div>
              <div className="hidden lg:block h-10 w-px bg-border" />
              <Button
                onClick={onCreateClick}
                className="hidden lg:flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold px-6"
              >
                <PlusIcon />
                Create Token
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {address && <HeaderProfile />}

              {address && hasAlphaAccess && (
                <Button
                  onClick={onAlphaClick}
                  className="bg-gradient-to-r from-primary to-primary/70 hover:from-primary/90 hover:to-primary/60 text-primary-foreground font-semibold relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                  <SparklesIcon />
                  <span className="ml-2">Alpha Room</span>
                </Button>
              )}

              {!address ? (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
                >
                  <WalletIcon />
                  <span className="ml-2">{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
                </Button>
              ) : (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowMenu(!showMenu)}
                    className="border-border hover:bg-muted/50"
                  >
                    <MenuIcon />
                  </Button>

                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-[100]">
                      <div className="p-3 border-b border-border">
                        <div className="flex items-center gap-2 px-3 py-2 rounded bg-muted/30">
                          <WalletIcon />
                          <span className="text-sm font-mono text-foreground">{formatAddress(address)}</span>
                        </div>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowProfileModal(true)
                            setShowMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted/50 flex items-center gap-2 transition-colors"
                        >
                          <UserIcon />
                          Profile
                        </button>
                        <button
                          onClick={() => {
                            router.push("/portfolio")
                            setShowMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted/50 flex items-center gap-2 transition-colors"
                        >
                          <TrendingUpIcon />
                          Portfolio
                        </button>
                        {userIsAdmin && (
                          <button
                            onClick={() => {
                              router.push("/admin")
                              setShowMenu(false)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted/50 flex items-center gap-2 transition-colors"
                          >
                            <ShieldIcon />
                            Admin
                          </button>
                        )}
                      </div>
                      <div className="border-t border-border py-1">
                        <button
                          onClick={handleDisconnect}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-muted/50 flex items-center gap-2 transition-colors"
                        >
                          <LogOutIcon />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
      </div>

      {address && (
        <EditProfileModal
          open={showProfileModal}
          onOpenChange={setShowProfileModal}
          walletAddress={address}
          onProfileUpdated={() => {
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
