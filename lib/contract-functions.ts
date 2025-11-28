import { getContract, getJsonProvider } from "./web3-provider"
import { parseEther, formatEther, Contract, toBigInt } from "ethers"
import { CONTRACT_CONFIG } from "./contract-config"
import ABI from "./contract-abi.json"

// ERC20 ABI for token approval
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address account) public view returns (uint256)",
]

function formatAddress(address: string): string {
  // If it's already a valid address format, return it
  if (address.startsWith("0x") && address.length === 42) {
    return address
  }
  // If it looks like a UUID or other format, throw an error
  throw new Error(`Invalid address format: ${address}`)
}

// Helper function to wait for blockchain state updates
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function createToken(name: string, symbol: string, metadata: string) {
  try {
    const contract = await getContract()
    const tx = await contract.createToken(name, symbol, metadata)
    const receipt = await tx.wait()

    // Extract token address from event
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

export async function buyTokens(tokenAddress: string, trustAmount: string, minTokensOut = "0") {
  try {
    if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Invalid token address provided to buyTokens")
    }

    if (!tokenAddress.startsWith("0x")) {
      throw new Error(`Invalid token address format. Expected 0x-prefixed address, got: ${tokenAddress}`)
    }

    // Validate amounts
    const trustAmountNum = Number.parseFloat(trustAmount)
    if (isNaN(trustAmountNum) || trustAmountNum <= 0) {
      throw new Error(`Invalid TRUST amount: ${trustAmount}`)
    }

    const contract = await getContract()
    console.log("[v0] buyTokens - Validating token exists...")

    // Check if token exists by calling getTokenInfo first
    const tokenInfo = await contract.getTokenInfo(tokenAddress)
    if (!tokenInfo || !tokenInfo.creator || tokenInfo.creator === "0x0000000000000000000000000000000000000000") {
      throw new Error("Token does not exist or has not been created yet")
    }

    if (tokenInfo.completed) {
      throw new Error("Token launch has been completed. Trading is disabled.")
    }

    console.log("[v0] buyTokens - Token validated, preparing transaction...")
    console.log("[v0] buyTokens - Parameters:", {
      tokenAddress,
      trustAmount: `${trustAmount} TRUST`,
      trustAmountWei: parseEther(trustAmount).toString(),
      minTokensOut,
    })

    // Parse minTokensOut more carefully - if it's "0" or empty, use 0
    let minTokensOutWei
    if (!minTokensOut || minTokensOut === "0" || Number.parseFloat(minTokensOut) === 0) {
      minTokensOutWei = toBigInt(0)
      console.log("[v0] buyTokens - No minimum tokens requirement (slippage protection disabled)")
    } else {
      minTokensOutWei = parseEther(minTokensOut)
      console.log("[v0] buyTokens - Minimum tokens out:", minTokensOut, "tokens")
    }

    // Estimate gas first to catch errors before sending transaction
    try {
      console.log("[v0] buyTokens - Estimating gas...")
      const gasEstimate = await contract.buyTokens.estimateGas(tokenAddress, minTokensOutWei, {
        value: parseEther(trustAmount),
      })
      console.log("[v0] buyTokens - Gas estimate:", gasEstimate.toString())
    } catch (gasError: any) {
      console.error("[v0] buyTokens - Gas estimation failed:", gasError)

      const errorMessage = gasError.message || gasError.toString()

      // Check for custom errors from the contract
      if (errorMessage.includes("SlippageTooHigh")) {
        throw new Error(
          "Price changed too much during transaction. Try increasing slippage tolerance or reducing trade amount.",
        )
      } else if (errorMessage.includes("TokenLaunchCompleted")) {
        throw new Error("Token launch has been completed. Trading is no longer available through the bonding curve.")
      } else if (errorMessage.includes("CreatorBuyLimitExceeded")) {
        throw new Error("Creator has reached the maximum buy limit for this token.")
      } else if (errorMessage.includes("ExceedsMaxSupply")) {
        throw new Error("This purchase would exceed the maximum token supply. Try buying a smaller amount.")
      } else if (errorMessage.includes("MustSendETH") || errorMessage.includes("NoTokensToBuy")) {
        throw new Error("Invalid purchase amount. Please enter a valid TRUST amount.")
      } else if (errorMessage.includes("insufficient funds") || errorMessage.includes("sender doesn't have enough")) {
        throw new Error("Insufficient TRUST balance. You need more TRUST tokens to complete this purchase.")
      } else if (errorMessage.includes("execution reverted")) {
        throw new Error(
          "Transaction would fail. Please check: you have enough TRUST, token exists, and launch is not completed.",
        )
      } else if (errorMessage.includes("missing revert data")) {
        throw new Error(
          "Unable to complete transaction. Possible reasons: insufficient TRUST balance, slippage too high, or token launch completed. Please check your wallet balance and try again.",
        )
      }

      throw new Error(`Transaction validation failed: ${errorMessage}`)
    }

    const tx = await contract.buyTokens(tokenAddress, minTokensOutWei, {
      value: parseEther(trustAmount),
    })
    console.log("[v0] buyTokens - Transaction sent:", tx.hash)

    const receipt = await tx.wait()
    console.log("[v0] buyTokens - Transaction confirmed:", receipt?.transactionHash)
    return receipt
  } catch (error: any) {
    console.error("[v0] Failed to buy tokens:", error)

    // Improve error messages for common issues
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction rejected by user")
    } else if (error.message?.includes("insufficient funds")) {
      throw new Error("Insufficient TRUST balance in your wallet")
    } else if (error.message?.includes("execution reverted")) {
      throw new Error("Transaction failed. Please check: token exists, launch not completed, and you have enough TRUST")
    }

    throw error
  }
}

export async function sellTokens(tokenAddress: string, tokenAmount: string) {
  try {
    const contract = await getContract()
    const signer = await contract.runner

    // Get the token contract instance
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(signer?.address, contract.target)
    const amountToSell = parseEther(tokenAmount)

    // If allowance is insufficient, approve the contract
    if (currentAllowance < amountToSell) {
      console.log("[v0] Approving token contract for selling...")
      const approveTx = await tokenContract.approve(contract.target, amountToSell)
      await approveTx.wait()
      console.log("[v0] Approval successful")
    }

    // Now sell the tokens
    const tx = await contract.sellTokens(tokenAddress, amountToSell)
    const receipt = await tx.wait()
    return receipt
  } catch (error) {
    console.error("Failed to sell tokens:", error)
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
      // Wait a bit before fetching (give blockchain time to update)
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

export async function getCurrentPrice(tokenAddress: string) {
  try {
    const contract = await getContract()
    const price = await contract.getCurrentPrice(tokenAddress)

    if (!price || price === null) {
      console.log("[v0] Price not yet available")
      return null
    }

    return formatEther(price)
  } catch (error) {
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

    // Get the token contract instance
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)

    // Get the user's balance
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

    // Market cap = current supply * current price
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

    // The contract has a fixed comment fee of 0.025 ETH (TRUST)
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
    const { JsonRpcProvider, Contract } = await import("ethers")
    const freshProvider = new JsonRpcProvider(CONTRACT_CONFIG.network.rpcUrl, {
      name: CONTRACT_CONFIG.network.name,
      chainId: CONTRACT_CONFIG.chainId,
    })
    const readOnlyContract = new Contract(CONTRACT_CONFIG.address, ABI, freshProvider)
    const comments = await readOnlyContract.getComments(tokenAddress)

    return comments.map((comment: any) => ({
      commenter: comment.commenter,
      text: comment.text,
      timestamp: Number(comment.timestamp),
    }))
  } catch (error) {
    console.error("Failed to get comments:", error)
    return []
  }
}

export async function getTokenHolders(tokenAddress: string): Promise<string[]> {
  try {
    const contract = await getContract()
    const holders = await contract.getTokenHolders(tokenAddress)
    return holders
  } catch (error) {
    console.error("Failed to get token holders:", error)
    return []
  }
}

export async function getTokenHolderBalance(tokenAddress: string, holderAddress: string): Promise<string> {
  try {
    const contract = await getContract()
    const signer = await contract.runner

    // Get the token contract instance
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)

    // Get the holder's balance
    const balance = await tokenContract.balanceOf(holderAddress)
    return formatEther(balance)
  } catch (error) {
    console.error("Failed to get holder balance:", error)
    return "0"
  }
}

export async function isTokenUnlocked(tokenAddress: string): Promise<boolean> {
  try {
    const jsonProvider = await getJsonProvider()

    const readOnlyContract = new Contract(CONTRACT_CONFIG.address, ABI, jsonProvider)
    const isUnlocked = await readOnlyContract.tokenUnlocked(tokenAddress)
    return isUnlocked
  } catch (error) {
    console.error("Failed to check token unlock status:", error)
    return false
  }
}

export async function getUserVolume(
  userAddress: string,
): Promise<{ buyVolume: string; sellVolume: string; totalVolume: string }> {
  try {
    console.log(`[v0] getUserVolume START for: ${userAddress}`)

    if (!userAddress || !userAddress.startsWith("0x")) {
      console.log(`[v0] getUserVolume - Invalid address format`)
      return { buyVolume: "0", sellVolume: "0", totalVolume: "0" }
    }

    console.log(`[v0] getUserVolume - Encoding function call data...`)

    // Manually encode the function call
    // getUserVolume(address) function signature: 0x3a91...
    const { Interface } = await import("ethers")
    const iface = new Interface(ABI)
    const functionData = iface.encodeFunctionData("getUserVolume", [userAddress])

    console.log(`[v0] getUserVolume - Making direct RPC call...`)

    // Make direct RPC call using fetch
    const response = await fetch(CONTRACT_CONFIG.rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          {
            to: CONTRACT_CONFIG.address,
            data: functionData,
          },
          "latest",
        ],
      }),
    })

    if (!response.ok) {
      console.log(`[v0] getUserVolume - RPC call failed with status ${response.status}`)
      return { buyVolume: "0", sellVolume: "0", totalVolume: "0" }
    }

    const jsonResponse = await response.json()

    if (jsonResponse.error) {
      console.log(`[v0] getUserVolume - RPC returned error:`, jsonResponse.error.message)
      return { buyVolume: "0", sellVolume: "0", totalVolume: "0" }
    }

    const result = jsonResponse.result
    console.log(`[v0] getUserVolume - Got RPC result:`, result)

    // Decode the result
    const decoded = iface.decodeFunctionResult("getUserVolume", result)
    console.log(`[v0] getUserVolume - Decoded result:`, decoded)

    // The function returns [buyVolume, sellVolume]
    const buyVolumeRaw = decoded[0] || 0n
    const sellVolumeRaw = decoded[1] || 0n

    const buyVolume = formatEther(buyVolumeRaw)
    const sellVolume = formatEther(sellVolumeRaw)
    const totalVolume = (Number.parseFloat(buyVolume) + Number.parseFloat(sellVolume)).toString()

    console.log(
      `[v0] getUserVolume SUCCESS - ${userAddress}: Buy=${buyVolume}, Sell=${sellVolume}, Total=${totalVolume}`,
    )

    return {
      buyVolume,
      sellVolume,
      totalVolume,
    }
  } catch (err) {
    console.log(`[v0] getUserVolume FAILED for ${userAddress}`)
    return { buyVolume: "0", sellVolume: "0", totalVolume: "0" }
  }
}

export async function getBatchUserVolumes(
  userAddresses: string[],
): Promise<Map<string, { buyVolume: string; sellVolume: string; totalVolume: string }>> {
  const volumeMap = new Map()

  try {
    // Fetch volumes for all users in parallel
    const volumePromises = userAddresses.map(async (address) => {
      const volume = await getUserVolume(address)
      return { address, volume }
    })

    const results = await Promise.all(volumePromises)

    results.forEach(({ address, volume }) => {
      volumeMap.set(address, volume)
    })
  } catch (error) {
    console.error("Failed to fetch batch user volumes:", error)
  }

  return volumeMap
}

export async function getTotalTVT(): Promise<string> {
  try {
    const { JsonRpcProvider, Contract } = await import("ethers")
    const freshProvider = new JsonRpcProvider(CONTRACT_CONFIG.network.rpcUrl, {
      name: CONTRACT_CONFIG.network.name,
      chainId: CONTRACT_CONFIG.chainId,
    })
    const readOnlyContract = new Contract(CONTRACT_CONFIG.address, ABI, freshProvider)
    const totalTVT = await readOnlyContract.getTotalTVT()
    return formatEther(totalTVT)
  } catch (error) {
    console.error("Failed to get total TVT:", error)
    return "0"
  }
}

export async function getTokenTVT(tokenAddress: string): Promise<string> {
  try {
    const { JsonRpcProvider, Contract } = await import("ethers")
    const freshProvider = new JsonRpcProvider(CONTRACT_CONFIG.network.rpcUrl, {
      name: CONTRACT_CONFIG.network.name,
      chainId: CONTRACT_CONFIG.chainId,
    })
    const readOnlyContract = new Contract(CONTRACT_CONFIG.address, ABI, freshProvider)
    const tokenTVT = await readOnlyContract.getTokenTVT(tokenAddress)
    return formatEther(tokenTVT)
  } catch (error) {
    console.error("Failed to get token TVT:", error)
    return "0"
  }
}
