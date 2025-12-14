"use client"

import { useState } from "react"
import * as contractFunctions from "@/lib/contract-functions"

export function useContract() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createToken = async (name: string, symbol: string, metadata: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const tokenAddress = await contractFunctions.createToken(name, symbol, metadata)
      return tokenAddress
    } catch (err: any) {
      const errorMsg = err.message || "Failed to create token"
      setError(errorMsg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const buyTokens = async (
    tokenAddress: string,
    trustAmount: string,
    minTokensOut?: string,
    factoryContractAddress?: string,
  ) => {
    setIsLoading(true)
    setError(null)
    try {
      const receipt = await contractFunctions.buyTokens(tokenAddress, trustAmount, minTokensOut, factoryContractAddress)
      return receipt
    } catch (err: any) {
      const errorMsg = err.message || "Failed to buy tokens"
      setError(errorMsg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const sellTokens = async (tokenAddress: string, tokenAmount: string, factoryContractAddress?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const receipt = await contractFunctions.sellTokens(tokenAddress, tokenAmount, factoryContractAddress)
      return receipt
    } catch (err: any) {
      const errorMsg = err.message || "Failed to sell tokens"
      setError(errorMsg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const getTokenInfo = async (tokenAddress: string) => {
    setIsLoading(true)
    setError(null)
    try {
      return await contractFunctions.getTokenInfo(tokenAddress)
    } catch (err: any) {
      const errorMsg = err.message || "Failed to get token info"
      setError(errorMsg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const getCurrentPrice = async (tokenAddress: string) => {
    setIsLoading(true)
    setError(null)
    try {
      return await contractFunctions.getCurrentPrice(tokenAddress)
    } catch (err: any) {
      const errorMsg = err.message || "Failed to get price"
      setError(errorMsg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    error,
    createToken,
    buyTokens,
    sellTokens,
    getTokenInfo,
    getCurrentPrice,
  }
}
