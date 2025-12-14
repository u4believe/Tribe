import { BrowserProvider, Contract, parseEther, formatEther, JsonRpcProvider, Interface } from "ethers"
import contractAbiJson from "./contract-abi.json"
import tokenAbiJson from "./token-abi.json"
import { CONTRACT_ADDRESS, RPC_URL, CONTRACT_CONFIG } from "./contract-config"

const ERC20_ABI = tokenAbiJson
const CONTRACT_ABI = contractAbiJson

async function getContract(contractAddress: string = CONTRACT_ADDRESS) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet detected")
  }

  const provider = new BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return new Contract(contractAddress, CONTRACT_ABI, signer)
}

function formatAddress(address: string): string {
  if (address.startsWith("0x") && address.length === 42) {
    return address
  }
  throw new Error(`Invalid address format: ${address}`)
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getJsonProvider() {
  return new JsonRpcProvider(RPC_URL, {
    chainId: CONTRACT_CONFIG.chainId,
    name: CONTRACT_CONFIG.chainName,
  })
}

function getReadOnlyContract(contractAddress: string = CONTRACT_ADDRESS) {
  const provider = getJsonProvider()
  return new Contract(contractAddress, CONTRACT_ABI, provider)
}

export async function createToken(name: string, symbol: string, metadata: string) {
  try {
    const contract = await getContract()
    const tx = await contract.createToken(name, symbol, metadata)
    const receipt = await tx.wait()

    const event = receipt?.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log)
        } catch {
          return null
        }
      })
      .find((e: any) => e?.name === "TokenCreated")

    return event?.args?.tokenAddress
  } catch (error) {
    console.error("Failed to create token:", error)
    throw error
  }
}

export async function buyTokens(
  tokenAddress: string,
  trustAmount: string,
  minTokensOut: string,
  factoryContractAddress?: string,
) {
  try {
    const contractAddress = factoryContractAddress || CONTRACT_ADDRESS
    const contract = await getContract(contractAddress)

    const tx = await contract.buyTokens(tokenAddress, parseEther(minTokensOut), {
      value: parseEther(trustAmount),
    })

    const receipt = await tx.wait()
    return receipt
  } catch (error) {
    console.error("Failed to buy tokens:", error)
    throw error
  }
}

export async function sellTokens(tokenAddress: string, tokenAmount: string, factoryContractAddress?: string) {
  try {
    const contractAddress = factoryContractAddress || CONTRACT_ADDRESS
    console.log("[v0] 🔍 Selling via contract:", contractAddress)
    console.log("[v0] 🔍 Token address:", tokenAddress)
    console.log("[v0] 🔍 Amount to sell:", tokenAmount)

    const provider = getJsonProvider()
    const contractBalance = await provider.getBalance(contractAddress)
    const contractBalanceFormatted = formatEther(contractBalance)
    console.log("[v0] 💰 Contract address being checked:", contractAddress)
    console.log("[v0] 💰 Contract TRUST balance (raw):", contractBalance.toString())
    console.log("[v0] 💰 Contract TRUST balance (formatted):", contractBalanceFormatted, "TRUST")

    const contract = await getContract(contractAddress)
    const signer = await contract.runner

    const currentPrice = await getCurrentPrice(tokenAddress, contractAddress)
    if (!currentPrice) {
      throw new Error("Cannot get current token price")
    }

    const amountToSell = parseEther(tokenAmount)
    const expectedTrust = Number.parseFloat(tokenAmount) * Number.parseFloat(currentPrice)
    const expectedTrustAfterFees = expectedTrust * 0.97 // 3% fee

    console.log("[v0] 📊 Current token price:", currentPrice, "TRUST per token")
    console.log("[v0] 📊 Expected TRUST from sell (before fees):", expectedTrust.toFixed(6), "TRUST")
    console.log("[v0] 📊 Expected TRUST after 3% fee:", expectedTrustAfterFees.toFixed(6), "TRUST")

    if (Number.parseFloat(contractBalanceFormatted) === 0) {
      throw new Error(
        `❌ CRITICAL: The contract at ${contractAddress} has 0 TRUST balance. Cannot complete sell order. The contract needs buyers to fund sellers. Please check if this is the correct contract address or wait for buyers.`,
      )
    }

    if (Number.parseFloat(contractBalanceFormatted) < expectedTrustAfterFees) {
      console.warn("[v0] ⚠️ WARNING: Contract has insufficient TRUST for full payout!")
      console.warn(
        `[v0] Available: ${contractBalanceFormatted} TRUST, Expected: ${expectedTrustAfterFees.toFixed(6)} TRUST`,
      )
      console.warn(`[v0] You may receive less TRUST than expected (possibly only ${contractBalanceFormatted} TRUST)`)
    }

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)

    const currentAllowance = await tokenContract.allowance(signer?.address, contract.target)

    if (currentAllowance < amountToSell) {
      console.log("[v0] 🔓 Approving tokens...")
      const approveTx = await tokenContract.approve(contract.target, amountToSell)
      await approveTx.wait()
      console.log("[v0] ✅ Approval successful")
    }

    const balanceBefore = await signer.provider!.getBalance(signer.address)
    console.log("[v0] 💵 User balance before sell:", formatEther(balanceBefore), "TRUST")

    console.log("[v0] 📤 Calling sellTokens on contract...")
    const tx = await contract.sellTokens(tokenAddress, amountToSell)
    console.log("[v0] 📝 Sell tx hash:", tx.hash)
    console.log("[v0] ⏳ Waiting for confirmation...")

    const receipt = await tx.wait()
    console.log("[v0] ✅ Transaction confirmed! Status:", receipt.status)
    console.log("[v0] ⛽ Gas used:", receipt.gasUsed.toString())

    await delay(3000)

    const balanceAfter = await signer.provider!.getBalance(signer.address)
    const gasCost = receipt.gasUsed * receipt.gasPrice
    const balanceChange = balanceAfter - balanceBefore

    console.log("[v0] 💵 User balance after sell:", formatEther(balanceAfter), "TRUST")
    console.log("[v0] ⛽ Gas cost:", formatEther(gasCost), "TRUST")
    console.log("[v0] 📊 Balance change:", formatEther(balanceChange), "TRUST")
    console.log("[v0] 💰 Net TRUST received:", formatEther(balanceChange + gasCost), "TRUST")

    const iface = new Interface(CONTRACT_ABI)
    let eventTrustAmount = 0n
    let eventFound = false

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data })
        if (parsed?.name === "TokensSold") {
          eventFound = true
          eventTrustAmount = parsed.args[2] || parsed.args.ethAmount || 0n
          console.log("[v0] 🎯 TokensSold event found!")
          console.log("[v0] 🎯 Event args:", parsed.args.toString())
          console.log("[v0] 🎯 ethAmount (index 2):", eventTrustAmount.toString())
          console.log("[v0] ✅ TRUST from event:", formatEther(eventTrustAmount), "TRUST")
          break
        }
      } catch (e) {
        // Skip non-matching logs
      }
    }

    if (!eventFound) {
      console.error("[v0] ❌ TokensSold event not found in transaction receipt!")
    }

    if (eventTrustAmount === 0n) {
      const actualReceived = formatEther(balanceChange + gasCost)
      console.error("[v0] ❌ CRITICAL: TokensSold event shows 0 TRUST sent from contract!")
      console.error("[v0] 📊 Contract balance was:", contractBalanceFormatted, "TRUST")
      console.error("[v0] 📊 User actually received:", actualReceived, "TRUST (excluding gas)")

      throw new Error(
        `Sell completed but the TokensSold event shows 0 TRUST was sent. This means the contract at ${contractAddress} has insufficient TRUST balance (${contractBalanceFormatted} TRUST available). The contract needs buyers to send TRUST before it can pay sellers. Please verify the contract address is correct: ${contractAddress}`,
      )
    }

    console.log("[v0] ✅ Sell completed successfully!")
    console.log("[v0] 💰 You received:", formatEther(eventTrustAmount), "TRUST")

    return receipt
  } catch (error) {
    console.error("[v0] ❌ Sell error:", error)
    throw error
  }
}

export async function getTokenInfo(tokenAddress: string) {
  try {
    const contract = await getContract()
    const info = await contract.getTokenInfo(tokenAddress)

    if (!info || !info.currentSupply || info.currentSupply === null || info.currentSupply === 0n) {
      console.log("[v0] Token info returned null or zero values")
      return null
    }

    return {
      name: info.name,
      symbol: info.symbol,
      metadata: info.metadata,
      creator: info.creator,
      creatorAllocation: formatEther(info.creatorAllocation || 0),
      heldTokens: formatEther(info.heldTokens || 0),
      maxSupply: formatEther(info.maxSupply || 0),
      currentSupply: formatEther(info.currentSupply || 0),
      virtualTrust: formatEther(info.virtualTrust || 0),
      virtualTokens: formatEther(info.virtualTokens || 0),
      completed: info.completed || false,
      creationTime: Number(info.creationTime || 0),
    }
  } catch (error) {
    console.error("[v0] Failed to get token info:", error)
    return null
  }
}

export async function getTokenInfoWithRetry(
  tokenAddress: string,
  maxRetries = 3,
  delayMs = 1500,
): Promise<ReturnType<typeof getTokenInfo>> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[v0] Waiting ${delayMs}ms before retry...`)
        await delay(delayMs)
      }

      const info = await getTokenInfo(tokenAddress)
      if (info === null) {
        throw new Error("Token info not available yet")
      }
      console.log("[v0] Token info fetched successfully")
      return info
    } catch (error) {
      console.log(`[v0] Token info fetch attempt ${attempt + 1} failed`)
      lastError = error as Error
    }
  }

  console.log("[v0] All retry attempts failed, token data will not be updated")
  return null
}

export async function getCurrentPrice(tokenAddress: string, factoryContractAddress?: string): Promise<string | null> {
  try {
    const contractAddress = factoryContractAddress || CONTRACT_ADDRESS
    const readOnlyContract = getReadOnlyContract(contractAddress)
    const price = await readOnlyContract.getCurrentPrice(tokenAddress)
    return formatEther(price)
  } catch (error: any) {
    if (error?.reason === "Invalid") {
      return null
    }
    console.error("[v0] Failed to get current price:", error)
    return null
  }
}

export async function getAllTokens() {
  try {
    const contract = await getContract()
    return await contract.getAllTokens()
  } catch (error) {
    console.error("Failed to get all tokens:", error)
    throw error
  }
}

export async function getUserTokenBalance(tokenAddress: string, userAddress: string) {
  try {
    const contract = await getContract()
    const signer = await contract.runner

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)

    const balance = await tokenContract.balanceOf(userAddress)
    return formatEther(balance)
  } catch (error) {
    console.error("Failed to get user token balance:", error)
    return "0"
  }
}

export async function calculateMarketCap(tokenAddress: string): Promise<number> {
  try {
    const info = await getTokenInfo(tokenAddress)
    if (!info) {
      return 0
    }

    const price = await getCurrentPrice(tokenAddress)
    if (!price) {
      return 0
    }

    const currentSupply = Number.parseFloat(info.currentSupply)
    const currentPrice = Number.parseFloat(price)

    return currentSupply * currentPrice
  } catch (error) {
    console.error("Failed to calculate market cap:", error)
    return 0
  }
}

export async function addTokenComment(tokenAddress: string, commentText: string) {
  try {
    const contract = await getContract()

    const commentFee = parseEther("0.025")

    const tx = await contract.addComment(tokenAddress, commentText, {
      value: commentFee,
    })

    console.log("Comment transaction sent:", tx.hash)
    const receipt = await tx.wait()
    console.log("Comment posted successfully")
    return receipt
  } catch (error: any) {
    console.error("Failed to add comment:", error)

    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user")
    } else if (error.message?.includes("insufficient funds")) {
      throw new Error("Insufficient TRUST balance to post comment")
    }

    throw error
  }
}

export async function getTokenComments(tokenAddress: string) {
  try {
    const readOnlyContract = getReadOnlyContract()
    const comments = await readOnlyContract.getComments(tokenAddress)

    return comments.map((comment: any) => ({
      commenter: comment.commenter,
      text: comment.text,
      timestamp: Number(comment.timestamp),
    }))
  } catch (error: any) {
    if (error?.reason === "Invalid" || error?.message?.includes("Invalid")) {
      return []
    }
    console.error("Failed to get comments:", error)
    return []
  }
}

export async function getTokenHolders(tokenAddress: string): Promise<string[]> {
  try {
    const readOnlyContract = getReadOnlyContract()
    const holders = await readOnlyContract.getTokenHolders(tokenAddress)
    return holders
  } catch (error: any) {
    if (error?.reason === "Invalid" || error?.message?.includes("Invalid")) {
      return []
    }
    console.error("Failed to get token holders:", error)
    return []
  }
}

export async function getTokenHolderBalance(tokenAddress: string, holderAddress: string): Promise<string> {
  try {
    const provider = getJsonProvider()
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider)
    const balance = await tokenContract.balanceOf(holderAddress)
    return formatEther(balance)
  } catch (error: any) {
    if (error?.reason === "Invalid" || error?.message?.includes("Invalid")) {
      return "0"
    }
    console.error("Failed to get holder balance:", error)
    return "0"
  }
}

export async function isTokenUnlocked(tokenAddress: string): Promise<boolean> {
  try {
    const readOnlyContract = getReadOnlyContract()
    const unlocked = await readOnlyContract.tokenUnlocked(tokenAddress)
    console.log("[v0] 🔓 Token unlock status for", tokenAddress, ":", unlocked)
    return unlocked
  } catch (error) {
    console.error("Failed to check token unlock status:", error)
    // Return true as default to not block old tokens
    return true
  }
}

export async function getTokenTVT(tokenAddress: string): Promise<string> {
  try {
    const provider = getJsonProvider()
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
    const tvt = await contract.getTokenTVT(tokenAddress)
    return formatEther(tvt)
  } catch (error) {
    console.error("Failed to get token TVT:", error)
    return "0"
  }
}

export async function getTotalTVT(): Promise<string> {
  try {
    const provider = getJsonProvider()
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
    const total = await contract.getTotalTVT()
    return formatEther(total)
  } catch (error) {
    console.error("Failed to get total TVT:", error)
    return "0"
  }
}

export async function getUserVolume(userAddress: string): Promise<{ buyVolume: string; sellVolume: string }> {
  try {
    const provider = getJsonProvider()
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
    const volumes = await contract.getUserVolume(userAddress)
    return {
      buyVolume: formatEther(volumes.buyVolume || volumes[0] || 0),
      sellVolume: formatEther(volumes.sellVolume || volumes[1] || 0),
    }
  } catch (error) {
    console.error("Failed to get user volume:", error)
    return { buyVolume: "0", sellVolume: "0" }
  }
}

export async function setCreatorTransferFee(tokenAddress: string, feePercent: number) {
  try {
    if (feePercent < 0 || feePercent > 5) {
      throw new Error("Creator transfer fee must be between 0% and 5%")
    }

    const contract = await getContract()
    const tx = await contract.setCreatorTransferFee(tokenAddress, feePercent)
    const receipt = await tx.wait()
    console.log("[v0] Creator transfer fee set successfully")
    return receipt
  } catch (error: any) {
    console.error("Failed to set creator transfer fee:", error)
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user")
    }
    throw error
  }
}

export async function getCreatorTransferFeePercent(tokenAddress: string): Promise<number> {
  try {
    const readOnlyContract = getReadOnlyContract()
    const feePercent = await readOnlyContract.creatorTransferFeePercent(tokenAddress)
    return Number(feePercent)
  } catch (error) {
    console.error("Failed to get creator transfer fee percent:", error)
    return 0
  }
}

export async function transferOwnership(newOwnerAddress: string) {
  try {
    if (!newOwnerAddress.startsWith("0x") || newOwnerAddress.length !== 42) {
      throw new Error("Invalid address format")
    }

    const contract = await getContract()
    const tx = await contract.transferOwnership(newOwnerAddress)
    const receipt = await tx.wait()
    console.log("[v0] Ownership transferred successfully")
    return receipt
  } catch (error: any) {
    console.error("Failed to transfer ownership:", error)
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user")
    }
    throw error
  }
}

export async function setDexRouter(newRouterAddress: string) {
  try {
    if (!newRouterAddress.startsWith("0x") || newRouterAddress.length !== 42) {
      throw new Error("Invalid address format")
    }

    const contract = await getContract()
    const tx = await contract.setDexRouter(newRouterAddress)
    const receipt = await tx.wait()
    console.log("[v0] DEX router updated successfully")
    return receipt
  } catch (error: any) {
    console.error("Failed to set DEX router:", error)
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user")
    }
    throw error
  }
}

export async function setFeePercent(newFeePercent: number) {
  try {
    if (newFeePercent < 0 || newFeePercent > 20) {
      throw new Error("Fee percent must be between 0% and 20%")
    }

    const contract = await getContract()
    const tx = await contract.setFeePercent(newFeePercent)
    const receipt = await tx.wait()
    console.log("[v0] Fee percent updated successfully")
    return receipt
  } catch (error: any) {
    console.error("Failed to set fee percent:", error)
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user")
    }
    throw error
  }
}

export async function setDefaultPostMigrationTransferFeePercent(newFeePercent: number) {
  try {
    if (newFeePercent < 0 || newFeePercent > 5) {
      throw new Error("Post migration transfer fee must be between 0% and 5%")
    }

    const contract = await getContract()
    const tx = await contract.setDefaultPostMigrationTransferFeePercent(newFeePercent)
    const receipt = await tx.wait()
    console.log("[v0] Default post migration transfer fee updated successfully")
    return receipt
  } catch (error: any) {
    console.error("Failed to set default post migration transfer fee:", error)
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user")
    }
    throw error
  }
}

export async function completeTokenLaunch(tokenAddress: string) {
  try {
    if (!tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
      throw new Error("Invalid token address format")
    }

    const contract = await getContract()
    const tx = await contract.completeTokenLaunch(tokenAddress)
    const receipt = await tx.wait()
    console.log("[v0] Token launch completed (DEX migration) successfully")
    return receipt
  } catch (error: any) {
    console.error("Failed to complete token launch:", error)
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user")
    }
    throw error
  }
}

export async function getFeePercent(): Promise<number> {
  try {
    const readOnlyContract = getReadOnlyContract()
    const feePercent = await readOnlyContract.feePercent()
    return Number(feePercent)
  } catch (error) {
    console.error("Failed to get fee percent:", error)
    return 0
  }
}

export async function getDexRouter(): Promise<string> {
  try {
    const readOnlyContract = getReadOnlyContract()
    const router = await readOnlyContract.dexRouter()
    return router
  } catch (error) {
    console.error("Failed to get DEX router:", error)
    return ""
  }
}

export async function getDefaultPostMigrationTransferFeePercent(): Promise<number> {
  try {
    const readOnlyContract = getReadOnlyContract()
    const feePercent = await readOnlyContract.defaultPostMigrationTransferFeePercent()
    return Number(feePercent)
  } catch (error) {
    console.error("Failed to get default post migration transfer fee:", error)
    return 0
  }
}

export async function getContractOwner(): Promise<string> {
  try {
    const readOnlyContract = getReadOnlyContract()
    const owner = await readOnlyContract.owner()
    return owner
  } catch (error) {
    console.error("Failed to get contract owner:", error)
    return ""
  }
}

export async function getContractTrustBalance(contractAddress: string = CONTRACT_ADDRESS): Promise<string> {
  try {
    console.log("[v0] 🔍 Checking TRUST balance for contract:", contractAddress)
    const provider = getJsonProvider()
    const balance = await provider.getBalance(contractAddress)
    const formatted = formatEther(balance)
    console.log("[v0] 💰 Contract balance:", formatted, "TRUST")
    return formatted
  } catch (error) {
    console.error("Failed to get contract TRUST balance:", error)
    return "0"
  }
}

export async function isTokenCompleted(tokenAddress: string): Promise<boolean> {
  try {
    const info = await getTokenInfo(tokenAddress)
    return info?.completed || false
  } catch (error) {
    console.error("Failed to check token completion status:", error)
    return false
  }
}
