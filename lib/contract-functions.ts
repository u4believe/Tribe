import { getContract, getJsonProvider } from "./web3-provider"
import { parseEther, formatEther, Contract, toBigInt } from "ethers"
import { CONTRACT_CONFIG } from "./contract-config"
import ABI from "./contract-abi.json"

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]

function formatAddress(address: string): string {
  if (address.startsWith("0x") && address.length === 42) {
    return address
  }
  throw new Error(`Invalid address format: ${address}`)
}

export async function createToken(name: string, symbol: string, metadata: string) {
  try {
    console.log("[v0] createToken - Starting token creation...")
    console.log("[v0] createToken - Parameters:", { name, symbol, metadata })

    const contract = await getContract()
    console.log("[v0] createToken - Contract obtained, calling createToken...")

    const tx = await contract.createToken(name, symbol, metadata)
    console.log("[v0] createToken - Transaction sent:", tx.hash)

    const receipt = await tx.wait()
    console.log("[v0] createToken - Transaction receipt received:", receipt?.hash)
    console.log("[v0] createToken - Receipt status:", receipt?.status)
    console.log("[v0] createToken - Logs count:", receipt?.logs?.length || 0)

    if (!receipt) {
      throw new Error("Transaction receipt is null")
    }

    if (!receipt.logs || receipt.logs.length === 0) {
      throw new Error("No logs found in transaction receipt")
    }

    let tokenAddress: string | undefined
    
    // Try to find TokenCreated event in logs
    for (let i = 0; i < receipt.logs.length; i++) {
      try {
        const log = receipt.logs[i]
        const parsed = contract.interface.parseLog(log)
        console.log("[v0] createToken - Parsed log event:", parsed?.name)
        
        if (parsed?.name === "TokenCreated") {
          console.log("[v0] createToken - TokenCreated event found!")
          console.log("[v0] createToken - Event args:", parsed.args)
          tokenAddress = parsed.args?.tokenAddress || parsed.args?.[2]
          console.log("[v0] createToken - Token address extracted:", tokenAddress)
          break
        }
      } catch (logError) {
        // Log parsing might fail for other contract's events, continue
        console.log("[v0] createToken - Could not parse log", i, logError)
        continue
      }
    }

    if (!tokenAddress) {
      throw new Error("TokenCreated event not found in transaction logs or tokenAddress is undefined")
    }

    console.log("[v0] createToken - Success! Token created at:", tokenAddress)
    return tokenAddress
  } catch (error) {
    console.error("[v0] createToken - Error:", error)
    throw error
  }
}

export async function buyTokens(tokenAddress: string, trustAmount: string, minTokensOut = "0") {
  try {
    tokenAddress = formatAddress(tokenAddress)

    const trustAmountNum = Number.parseFloat(trustAmount)
    if (isNaN(trustAmountNum) || trustAmountNum <= 0) {
      throw new Error(`Invalid TRUST amount: ${trustAmount}`)
    }

    const contract = await getContract()
    console.log("[v0] buyTokens - Validating token exists...")

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

    let minTokensOutWei
    if (!minTokensOut || minTokensOut === "0" || Number.parseFloat(minTokensOut) === 0) {
      minTokensOutWei = toBigInt(0)
      console.log("[v0] buyTokens - No minimum tokens requirement (slippage protection disabled)")
    } else {
      minTokensOutWei = parseEther(minTokensOut)
      console.log("[v0] buyTokens - Minimum tokens out:", minTokensOut, "tokens")
    }

    try {
      console.log("[v0] buyTokens - Estimating gas...")
      const gasEstimate = await contract.buyTokens.estimateGas(tokenAddress, minTokensOutWei, {
        value: parseEther(trustAmount),
      })
      console.log("[v0] buyTokens - Gas estimate:", gasEstimate.toString())
    } catch (gasError: any) {
      console.error("[v0] buyTokens - Gas estimation failed:", gasError)

      const errorMessage = gasError.message || gasError.toString()

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

export async function sellTokens(tokenAddress: string, tokenAmount: string, factoryAddress?: string, payoutTo?: string) {
  try {
    const contractAddress = CONTRACT_CONFIG.address
    console.log("[v0] Selling tokens:", {
      tokenAddress,
      tokenAmount,
      contractAddress,
      payoutTo,
      note: "Using hardcoded contract address",
    })

    const { BrowserProvider, Contract, parseEther, formatEther } = await import("ethers")

    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No wallet connected")
    }

    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const userAddress = await signer.getAddress()

    const contract = new Contract(contractAddress, ABI, signer)

    const userBalanceBefore = await provider.getBalance(userAddress)
    console.log("[v0] User TRUST balance before sell:", formatEther(userBalanceBefore), "TRUST")

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)

    const userTokenBalance = await tokenContract.balanceOf(userAddress)
    console.log("[v0] User token balance:", formatEther(userTokenBalance), "tokens")

    const amountToSell = parseEther(tokenAmount)
    if (userTokenBalance < amountToSell) {
      throw new Error(
        `Insufficient token balance. You have ${formatEther(userTokenBalance)} tokens but trying to sell ${tokenAmount}`,
      )
    }

    const currentAllowance = await tokenContract.allowance(userAddress, contractAddress)
    console.log("[v0] Current allowance:", formatEther(currentAllowance))

    if (currentAllowance < amountToSell) {
      console.log("[v0] Approving token contract for selling...")
      const approveTx = await tokenContract.approve(contractAddress, amountToSell)
      await approveTx.wait()
      console.log("[v0] Approval successful")
    }

    // Determine payout address - use provided payoutTo or default to user address
    const payoutAddress = payoutTo && payoutTo !== userAddress ? payoutTo : userAddress
    console.log("[v0] Payout address:", payoutAddress)

    // Using 0 for minPaymentOut to allow any slippage
    const minPaymentOut = toBigInt(0)
    console.log("[v0] Executing sell transaction with minPaymentOut:", minPaymentOut.toString())
    const tx = await contract.sellTokens(tokenAddress, amountToSell, minPaymentOut, payoutAddress)
    console.log("[v0] Sell transaction sent:", tx.hash)

    const receipt = await tx.wait()
    console.log("[v0] Sell transaction confirmed:", receipt?.hash)
    console.log("[v0] Transaction status:", receipt?.status)

    let ethReceived = 0n
    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          })
          if (parsed?.name === "TokensSold") {
            console.log("[v0] TokensSold event found!")
            ethReceived = parsed.args[2]
            console.log("[v0] TRUST received from event:", formatEther(ethReceived), "TRUST")
          }
        } catch {
          // Not our event, skip
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const userBalanceAfter = await provider.getBalance(userAddress)
    console.log("[v0] User TRUST balance after sell:", formatEther(userBalanceAfter), "TRUST")

    const balanceDiff = userBalanceAfter - userBalanceBefore
    console.log("[v0] Balance difference:", formatEther(balanceDiff), "TRUST")

    return receipt?.hash
  } catch (error: any) {
    console.error("[v0] Sell error:", error)

    const errorMessage = error.message || ""
    if (errorMessage.includes("TokenLocked")) {
      throw new Error("Token is locked. The creator needs to buy more tokens to unlock selling.")
    } else if (errorMessage.includes("InsufficientBalance")) {
      throw new Error("Insufficient token balance.")
    } else if (errorMessage.includes("user rejected")) {
      throw new Error("Transaction rejected by user.")
    }

    throw error
  }
}

export async function getTokenInfo(tokenAddress: string) {
  try {
    tokenAddress = formatAddress(tokenAddress)
    
    const provider = await getJsonProvider()
    const contract = new Contract(CONTRACT_CONFIG.address, ABI, provider)
    
    console.log("[v0] getTokenInfo - Fetching info for:", tokenAddress)
    const tokenInfo = await contract.getTokenInfo(tokenAddress)
    
    console.log("[v0] getTokenInfo - Retrieved:", tokenInfo)
    return tokenInfo
  } catch (error) {
    console.error("Failed to get token info:", error)
    throw error
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

export async function getTokenTVT(tokenAddress: string): Promise<string> {
  try {
    const provider = await getJsonProvider()
    const contract = new Contract(CONTRACT_CONFIG.address, ABI, provider)
    const tvt = await contract.tokenTotalValueTraded(tokenAddress)
    return formatEther(tvt)
  } catch (error) {
    console.error("Failed to get token TVT:", error)
    return "0"
  }
}

export async function getTotalTVT(): Promise<string> {
  try {
    const { fetchAllTokens } = await import("./tokens")

    const tokens = await fetchAllTokens()
    let totalTVT = 0

    for (const token of tokens) {
      try {
        const tvt = await getTokenTVT(token.contractAddress)
        totalTVT += Number.parseFloat(tvt)
      } catch (error) {
        console.log(`[v0] Failed to get TVT for token ${token.contractAddress}, skipping...`)
      }
    }

    return totalTVT.toString()
  } catch (error) {
    console.error("Failed to get total TVT:", error)
    return "0"
  }
}

export async function setCreatorTransferFee(tokenAddress: string, transferFeePercent: number) {
  try {
    tokenAddress = formatAddress(tokenAddress)
    console.log("[v0] setCreatorTransferFee - Setting creator transfer fee:", { tokenAddress, transferFeePercent })

    const contract = await getContract()
    const tx = await contract.setCreatorTransferFee(tokenAddress, transferFeePercent)
    const receipt = await tx.wait()

    console.log("[v0] setCreatorTransferFee - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to set creator transfer fee:", error)
    throw error
  }
}

export async function emergencyWithdraw(tokenAddress: string) {
  try {
    tokenAddress = formatAddress(tokenAddress)
    console.log("[v0] emergencyWithdraw - Initiating emergency withdrawal:", { tokenAddress })

    const contract = await getContract()
    const tx = await contract.emergencyWithdraw(tokenAddress)
    const receipt = await tx.wait()

    console.log("[v0] emergencyWithdraw - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to perform emergency withdrawal:", error)
    throw error
  }
}

export async function setDexRouter(routerAddress: string) {
  try {
    routerAddress = formatAddress(routerAddress)
    console.log("[v0] setDexRouter - Setting DEX router:", { routerAddress })

    const contract = await getContract()
    const tx = await contract.setDexRouter(routerAddress)
    const receipt = await tx.wait()

    console.log("[v0] setDexRouter - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to set DEX router:", error)
    throw error
  }
}

export async function collectAndSplitTransferFees(tokenAddress: string) {
  try {
    tokenAddress = formatAddress(tokenAddress)
    console.log("[v0] collectAndSplitTransferFees - Collecting fees for:", { tokenAddress })

    const contract = await getContract()
    const tx = await contract.collectAndSplitTransferFees(tokenAddress)
    const receipt = await tx.wait()

    console.log("[v0] collectAndSplitTransferFees - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to collect and split transfer fees:", error)
    throw error
  }
}

export async function completeTokenLaunch(tokenAddress: string) {
  try {
    tokenAddress = formatAddress(tokenAddress)
    console.log("[v0] completeTokenLaunch - Completing launch for:", { tokenAddress })

    const contract = await getContract()
    const tx = await contract.completeTokenLaunch(tokenAddress)
    const receipt = await tx.wait()

    console.log("[v0] completeTokenLaunch - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to complete token launch:", error)
    throw error
  }
}

export async function setDefaultPostMigrationTransferFeePercent(feePercent: number) {
  try {
    console.log("[v0] setDefaultPostMigrationTransferFeePercent - Setting fee:", { feePercent })

    const contract = await getContract()
    const tx = await contract.setDefaultPostMigrationTransferFeePercent(feePercent)
    const receipt = await tx.wait()

    console.log("[v0] setDefaultPostMigrationTransferFeePercent - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to set default post-migration transfer fee:", error)
    throw error
  }
}

export async function transferOwnership(newOwner: string) {
  try {
    newOwner = formatAddress(newOwner)
    console.log("[v0] transferOwnership - Transferring to:", { newOwner })

    const contract = await getContract()
    const tx = await contract.transferOwnership(newOwner)
    const receipt = await tx.wait()

    console.log("[v0] transferOwnership - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to transfer ownership:", error)
    throw error
  }
}

export async function setFeePercent(newFeePercent: number) {
  try {
    console.log("[v0] setFeePercent - Setting fee percent:", { newFeePercent })

    const contract = await getContract()
    const tx = await contract.setFeePercent(newFeePercent)
    const receipt = await tx.wait()

    console.log("[v0] setFeePercent - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to set fee percent:", error)
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

export async function getTokenHolderBalance(tokenAddress: string, holderAddress: string): Promise<string> {
  try {
    const jsonProvider = await getJsonProvider()
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, jsonProvider)
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

export async function getUserVolume(userAddress: string): Promise<{ buyVolume: string; sellVolume: string; totalVolume: string }> {
  try {
    console.log(`[v0] getUserVolume START for: ${userAddress}`)

    userAddress = formatAddress(userAddress)

    const jsonProvider = await getJsonProvider()
    const readOnlyContract = new Contract(CONTRACT_CONFIG.address, ABI, jsonProvider)

    // Use userVolumes mapping instead of getUserVolume function
    const volumes = await readOnlyContract.userVolumes(userAddress)

    const buyVolume = formatEther(volumes.totalBuyVolume || 0n)
    const sellVolume = formatEther(volumes.totalSellVolume || 0n)
    const totalVolume = (Number.parseFloat(buyVolume) + Number.parseFloat(sellVolume)).toString()

    console.log(
      `[v0] getUserVolume SUCCESS - ${userAddress}: Buy=${buyVolume}, Sell=${sellVolume}, Total=${totalVolume}`,
    )

    return { buyVolume, sellVolume, totalVolume }
  } catch (error) {
    console.error(`[v0] getUserVolume FAILED for ${userAddress}:`, error)
    return { buyVolume: "0", sellVolume: "0", totalVolume: "0" }
  }
}

export async function getAllTokenAddresses(): Promise<string[]> {
  try {
    const { fetchAllTokens } = await import("./tokens")
    const tokens = await fetchAllTokens()
    return tokens.map((token) => token.contractAddress)
  } catch (error) {
    console.error("Failed to get all token addresses:", error)
    return []
  }
}

export async function getCurveLiquidity(tokenAddress: string): Promise<string> {
  try {
    const jsonProvider = await getJsonProvider()
    const readOnlyContract = new Contract(CONTRACT_CONFIG.address, ABI, jsonProvider)
    const liquidity = await readOnlyContract.curveLiquidity(tokenAddress)
    return formatEther(liquidity)
  } catch (error) {
    console.error("Failed to get curve liquidity:", error)
    return "0"
  }
}
