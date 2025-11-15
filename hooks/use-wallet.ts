"use client"

import { useState, useEffect } from "react"
import { connectWallet, getConnectedAddress, getBalance, disconnectWallet } from "@/lib/web3-provider"

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<string>("0")
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }

    // Check if already connected
    const checkConnection = async () => {
      try {
        const wasConnected = localStorage.getItem('walletConnected')
        
        if (!wasConnected) {
          return
        }
        
        const addr = await getConnectedAddress()
        
        if (addr) {
          setAddress(addr)
          const bal = await getBalance(addr)
          setBalance(bal)
        } else {
          localStorage.removeItem('walletConnected')
        }
      } catch (err) {
        console.error("Failed to check wallet connection:", err)
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('walletConnected')
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    }

    checkConnection()

    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
          getBalance(accounts[0]).then(setBalance)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('walletConnected', 'true')
          }
        } else {
          setAddress(null)
          setBalance("0")
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('walletConnected')
          }
        }
      }
      
      window.ethereum.on("accountsChanged", handleAccountsChanged)
      
      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
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
      const addr = await connectWallet()
      
      setAddress(addr)
      const bal = await getBalance(addr)
      setBalance(bal)
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('walletConnected', 'true')
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to connect wallet"
      setError(errorMessage)
      console.error("Wallet connection error:", err)
      
      if (errorMessage.includes("No Web3 wallet detected")) {
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
      await disconnectWallet()
      setAddress(null)
      setBalance("0")
      setError(null)
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
  }
}
