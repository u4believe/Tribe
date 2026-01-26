"use client"

import { useState, useEffect, useCallback } from "react"
import { getConnectedAddress, getBalance, disconnectWallet, forceNewWalletConnection } from "@/lib/web3-provider"

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<string>("0")
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      const bal = await getBalance(addr)
      setBalance(bal)
    } catch (err) {
      console.error("Failed to refresh balance:", err)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return
    }

    // Check if already connected
    const checkConnection = async () => {
      try {
        const wasConnected = localStorage.getItem("walletConnected")

        if (!wasConnected) {
          return
        }

        const addr = await getConnectedAddress()

        if (addr) {
          setAddress(addr)
          const bal = await getBalance(addr)
          setBalance(bal)
        } else {
          localStorage.removeItem("walletConnected")
        }
      } catch (err) {
        console.error("Failed to check wallet connection:", err)
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem("walletConnected")
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    }

    checkConnection()

    // Listen for account changes
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
          getBalance(accounts[0]).then(setBalance)
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("walletConnected", "true")
          }
        } else {
          setAddress(null)
          setBalance("0")
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem("walletConnected")
          }
        }
      }

      const handleChainChanged = () => {
        // Reload the page to reset all state when chain changes
        window.location.reload()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [])

  const connect = async () => {
    if (isConnecting) {
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask or Web3 wallet not found. Please install MetaMask.")
      }

      // Use the new forceNewWalletConnection that shows account picker
      const addr = await forceNewWalletConnection()

      setAddress(addr)
      const bal = await getBalance(addr)
      setBalance(bal)

      if (typeof localStorage !== "undefined") {
        localStorage.setItem("walletConnected", "true")
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to connect wallet"
      setError(errorMessage)
      console.error("[v0] Wallet connection error:", err)

      if (errorMessage.includes("No Web3 wallet detected") || errorMessage.includes("not found")) {
        alert("Please install MetaMask or another Web3 wallet to connect.")
      } else if (errorMessage.includes("cancelled by user")) {
        // User cancelled, no need to alert
      } else if (!errorMessage.includes("already pending")) {
        alert(errorMessage)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      // Clear state immediately
      setAddress(null)
      setBalance("0")
      setError(null)

      // Then clear backend
      await disconnectWallet()
    } catch (err) {
      console.error("Failed to disconnect wallet:", err)
    }
  }

  return {
    address,
    balance,
    isConnecting,
    error,
    connect,
    disconnect,
    isConnected: !!address,
    refreshBalance: () => address && refreshBalance(address),
  }
}
