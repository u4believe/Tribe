import { ethers } from "ethers"
import { CONTRACT_CONFIG } from "./contract-config"
import CONTRACT_ABI from "./contract-abi.json"
import { createTokenInDatabase } from "./tokens"
import { getAllTokenAddresses } from "./contract-functions"

const RPC_URL = CONTRACT_CONFIG.network.rpcUrl
const CONTRACT_ADDRESS = CONTRACT_CONFIG.address

export async function getAllTokensFromContract() {
  try {
    console.log("[v0] Fetching tokens from contract:", CONTRACT_ADDRESS)
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

    const tokenAddresses = await getAllTokenAddresses()
    console.log("[v0] Found", tokenAddresses.length, "tokens on contract")

    const tokens = []
    for (const tokenAddress of tokenAddresses) {
      try {
        const tokenInfo = await contract.getTokenInfo(tokenAddress)
        const currentPrice = await contract.getCurrentPrice(tokenAddress)

        tokens.push({
          address: tokenAddress,
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          metadata: tokenInfo.metadata,
          creator: tokenInfo.creator,
          heldTokens: tokenInfo.heldTokens.toString(),
          maxSupply: tokenInfo.maxSupply.toString(),
          currentSupply: tokenInfo.currentSupply.toString(),
          completed: tokenInfo.completed,
          creationTime: tokenInfo.creationTime.toString(),
          currentPrice: currentPrice.toString(),
        })
      } catch (error) {
        console.error(`[v0] Error fetching info for token ${tokenAddress}:`, error)
      }
    }

    return tokens
  } catch (error) {
    console.error("[v0] Error fetching tokens from contract:", error)
    throw error
  }
}

export async function importTokensFromContract() {
  try {
    const tokens = await getAllTokensFromContract()
    console.log("[v0] Importing", tokens.length, "tokens to database")

    let imported = 0
    let skipped = 0

    for (const token of tokens) {
      try {
        // Parse metadata JSON
        let imageUrl = "/placeholder.svg?height=400&width=400"
        let description = ""

        try {
          const metadata = JSON.parse(token.metadata)
          imageUrl = metadata.image || imageUrl
          description = metadata.description || ""
        } catch {
          // If metadata is not JSON, use it as description
          description = token.metadata
        }

        // Calculate market cap and start price
        const currentPriceEth = Number.parseFloat(ethers.formatEther(token.currentPrice))
        const currentSupplyEth = Number.parseFloat(ethers.formatEther(token.currentSupply))
        const maxSupplyEth = Number.parseFloat(ethers.formatEther(token.maxSupply))
        const marketCap = currentPriceEth * currentSupplyEth

        const result = await createTokenInDatabase({
          name: token.name,
          symbol: token.symbol,
          contractAddress: token.address.toLowerCase(),
          creatorAddress: token.creator.toLowerCase(),
          imageUrl,
          description,
          currentPrice: currentPriceEth.toString(),
          marketCap: marketCap.toString(),
          maxSupply: maxSupplyEth.toString(),
          currentSupply: currentSupplyEth.toString(),
          startPrice: "0.00001", // Default start price
          factoryAddress: CONTRACT_ADDRESS.toLowerCase(),
        })

        if (result) {
          imported++
          console.log(`[v0] Imported token: ${token.name} (${token.symbol})`)
        } else {
          skipped++
          console.log(`[v0] Skipped existing token: ${token.name} (${token.symbol})`)
        }
      } catch (error) {
        console.error(`[v0] Error importing token ${token.name}:`, error)
        skipped++
      }
    }

    return { success: true, imported, skipped, total: tokens.length }
  } catch (error) {
    console.error("[v0] Error in importTokensFromContract:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
