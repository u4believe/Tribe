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

const CUSTOM_ERRORS: Record<string, string> = {
  "0x850c6f76": "SlippageTooHigh",
  "0x36b63ffd": "SlippageTooHighSell",
  "0x5d1ca88e": "Creator has reached the maximum buy limit for this token.",
  "0xc30436e9": "This purchase would exceed the maximum token supply. Try buying a smaller amount.",
  "0xfae7d962": "Token launch has been completed. Trading is no longer available through the bonding curve.",
  "0xc242447c": "No tokens available to buy. Please enter a valid amount.",
  "0x99c4b627": "Invalid purchase amount. Please enter a valid TRUST amount.",
  "0xf4d678b8": "Insufficient TRUST balance. You need more TRUST tokens to complete this purchase.",
  "0x5a8181f7": "Token is locked. The creator needs to buy more tokens to unlock trading.",
  "0xc1ab6dc1": "Invalid token address.",
  "0xb4fa3fb3": "Invalid input provided.",
  "0x90b8ec18": "Transfer failed. Please try again.",
  "0x42e4eb60": "No excess liquidity to recover for this token. The sell spread pool may be empty.",
  "0xcfc82168": "Insufficient bonding curve liquidity.",
  "0x1f77ff34": "Insufficient circulating supply.",
  "0xe4455cae": "Insufficient token balance.",
  "0x4db1ccc5": "Must sell tokens first.",
  "0xb3fc2e39": "No tokens have been purchased yet.",
  "0x30cd7471": "Only the contract owner can perform this action.",
  "0x37ed32e8": "Reentrant call detected. Please try again.",
  "0x6ac240bd": "Sell spread percentage exceeds the maximum allowed.",
  "0xaf9c21dc": "Fee percentage exceeds the maximum allowed.",
}

function extractErrorSelector(err: any): string {
  const paths = [
    err?.data,
    err?.info?.error?.data?.data,
    err?.info?.error?.data,
    err?.error?.data?.data,
    err?.error?.data,
  ]
  for (const p of paths) {
    if (typeof p === "string" && p.startsWith("0x") && p.length >= 10) {
      return p.slice(0, 10)
    }
  }
  const msg = err?.message || err?.toString() || ""
  const match = msg.match(/data="(0x[0-9a-fA-F]{8,})"/)
  if (match) return match[1].slice(0, 10)
  return ""
}

function decodeContractError(error: any): string {
  const selector = extractErrorSelector(error)
  if (selector && CUSTOM_ERRORS[selector]) {
    return CUSTOM_ERRORS[selector]
  }
  const msg = error?.message || error?.toString() || ""
  if (msg.includes("user rejected")) {
    return "Transaction was rejected by the user."
  }
  if (msg.includes("insufficient funds") || msg.includes("sender doesn't have enough")) {
    return "Insufficient funds to complete this transaction."
  }
  if (msg.includes("execution reverted")) {
    return `Transaction would fail: ${selector ? `error code ${selector}` : "unknown reason"}`
  }
  return ""
}

export async function createToken(name: string, symbol: string, metadata: string, spreadPercent: number = 0) {
  try {
    console.log("[v0] createToken - Starting token creation...")
    console.log("[v0] createToken - Parameters:", { name, symbol, metadata, spreadPercent })

    const contract = await getContract()
    console.log("[v0] createToken - Contract obtained, calling createToken...")

    const tx = await contract.createToken(name, symbol, metadata, spreadPercent)
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
          tokenAddress = parsed.args?.token || parsed.args?.[0]
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

    let gasEstimateOk = false
    try {
      console.log("[v0] buyTokens - Estimating gas...")
      const gasEstimate = await contract.buyTokens.estimateGas(tokenAddress, minTokensOutWei, {
        value: parseEther(trustAmount),
      })
      console.log("[v0] buyTokens - Gas estimate:", gasEstimate.toString())
      gasEstimateOk = true
    } catch (gasError: any) {
      console.error("[v0] buyTokens - Gas estimation failed:", gasError)

      const errorSelector = extractErrorSelector(gasError)
      console.log("[v0] buyTokens - Error selector:", errorSelector)
      const decodedError = errorSelector ? CUSTOM_ERRORS[errorSelector] : undefined

      if (decodedError === "SlippageTooHigh" || decodedError === "SlippageTooHighSell") {
        console.log("[v0] buyTokens - Slippage error detected, retrying with no minimum tokens out...")
        minTokensOutWei = toBigInt(0)
      } else if (decodedError) {
        throw new Error(decodedError)
      } else {
        const errorMessage = gasError.message || gasError.toString()

        if (errorMessage.includes("SlippageTooHigh") || errorMessage.includes("0x850c6f76")) {
          console.log("[v0] buyTokens - Slippage error from message, retrying with no minimum...")
          minTokensOutWei = toBigInt(0)
        } else if (errorMessage.includes("TokenLaunchCompleted")) {
          throw new Error("Token launch has been completed. Trading is no longer available through the bonding curve.")
        } else if (errorMessage.includes("insufficient funds") || errorMessage.includes("sender doesn't have enough")) {
          throw new Error("Insufficient TRUST balance. You need more TRUST tokens to complete this purchase.")
        } else if (errorMessage.includes("execution reverted")) {
          throw new Error(
            "Transaction would fail. Please check: you have enough TRUST, token exists, and launch is not completed.",
          )
        } else {
          throw new Error(`Transaction validation failed: ${errorMessage}`)
        }
      }
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
  } catch (error: any) {
    if (error?.code === "CALL_EXCEPTION") {
      console.log("[v0] Token not found on contract:", tokenAddress)
      return null
    }
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
    tokenAddress = formatAddress(tokenAddress)
    const contract = await getContract()
    const price = await contract.getCurrentPrice(tokenAddress)

    if (!price || price === null) {
      console.log("[v0] Price not yet available")
      return null
    }

    return formatEther(price)
  } catch (error: any) {
    if (error?.code !== "CALL_EXCEPTION") {
      console.warn("[v0] Failed to get current price:", error?.message || error)
    }
    return null
  }
}

export async function getTokenTVT(tokenAddress: string): Promise<string> {
  try {
    tokenAddress = formatAddress(tokenAddress)
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
        if (!token.contractAddress || !token.contractAddress.startsWith("0x") || token.contractAddress.length !== 42) {
          continue
        }
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

export async function recoverSellSpreadLiquidity(tokenAddress: string) {
  try {
    tokenAddress = formatAddress(tokenAddress)
    console.log("[v0] recoverSellSpreadLiquidity - Recovering sell spread liquidity:", { tokenAddress })

    const contract = await getContract()

    try {
      await contract.recoverSellSpreadLiquidity.estimateGas(tokenAddress)
    } catch (gasError: any) {
      console.error("[v0] recoverSellSpreadLiquidity - Gas estimation failed:", gasError)
      const decoded = decodeContractError(gasError)
      if (decoded) throw new Error(decoded)
      throw gasError
    }

    const tx = await contract.recoverSellSpreadLiquidity(tokenAddress)
    const receipt = await tx.wait()

    console.log("[v0] recoverSellSpreadLiquidity - Success!")
    return receipt
  } catch (error: any) {
    console.error("Failed to recover sell spread liquidity:", error)
    if (error.message?.includes("user rejected")) {
      throw new Error("Transaction was rejected by the user.")
    }
    const decoded = decodeContractError(error)
    if (decoded) throw new Error(decoded)
    throw error
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
    const tx = await contract.emergencyWithdrawTokens(tokenAddress)
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

export async function setSellSpreadPercent(newPercent: number) {
  try {
    console.log("[v0] setSellSpreadPercent - Setting default sell spread percent:", { newPercent })

    const contract = await getContract()
    const tx = await contract.setSellSpreadPercent(newPercent)
    const receipt = await tx.wait()

    console.log("[v0] setSellSpreadPercent - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to set sell spread percent:", error)
    throw error
  }
}

export async function setTokenSellSpread(tokenAddress: string, percent: number) {
  try {
    tokenAddress = formatAddress(tokenAddress)
    console.log("[v0] setTokenSellSpread - Setting sell spread for token:", { tokenAddress, percent })

    const contract = await getContract()
    const tx = await contract.setTokenSellSpread(tokenAddress, percent)
    const receipt = await tx.wait()

    console.log("[v0] setTokenSellSpread - Success!")
    return receipt
  } catch (error) {
    console.error("Failed to set token sell spread:", error)
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

export interface TokenHolder {
  address: string
  balance: string
  percentage: number
}

export async function getTokenHolders(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    const jsonProvider = await getJsonProvider()
    const contract = new Contract(CONTRACT_CONFIG.address, ABI, jsonProvider)
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, jsonProvider)

    const currentBlock = await jsonProvider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 500000)

    const uniqueAddresses = new Set<string>()

    try {
      const buyFilter = contract.filters.TokensBought(tokenAddress)
      const buyEvents = await contract.queryFilter(buyFilter, fromBlock, currentBlock)
      for (const event of buyEvents) {
        const log = event as any
        if (log.args && log.args[1]) {
          uniqueAddresses.add(log.args[1].toLowerCase())
        }
      }
    } catch (e) {
      console.error("Failed to query buy events:", e)
    }

    try {
      const sellFilter = contract.filters.TokensSold(tokenAddress)
      const sellEvents = await contract.queryFilter(sellFilter, fromBlock, currentBlock)
      for (const event of sellEvents) {
        const log = event as any
        if (log.args && log.args[1]) {
          uniqueAddresses.add(log.args[1].toLowerCase())
        }
      }
    } catch (e) {
      console.error("Failed to query sell events:", e)
    }

    if (uniqueAddresses.size === 0) {
      return []
    }

    let maxSupply = 0
    try {
      const tokenInfo = await contract.getTokenInfo(tokenAddress)
      if (tokenInfo && tokenInfo.maxSupply) {
        maxSupply = Number.parseFloat(formatEther(tokenInfo.maxSupply))
      }
    } catch {
      console.error("Failed to fetch maxSupply for holders percentage")
    }

    const holders: TokenHolder[] = []

    const addresses = Array.from(uniqueAddresses)
    const batchSize = 5
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize)
      const balances = await Promise.all(
        batch.map(async (addr) => {
          try {
            const bal = await tokenContract.balanceOf(addr)
            return { addr, balance: formatEther(bal) }
          } catch {
            return { addr, balance: "0" }
          }
        })
      )
      for (const { addr, balance } of balances) {
        const num = Number.parseFloat(balance)
        if (num > 0) {
          const percentage = maxSupply > 0 ? (num / maxSupply) * 100 : 0
          holders.push({ address: addr, balance, percentage })
        }
      }
    }

    holders.sort((a, b) => Number.parseFloat(b.balance) - Number.parseFloat(a.balance))

    return holders
  } catch (error) {
    console.error("Failed to get token holders:", error)
    return []
  }
}

export interface TradeEvent {
  time: number
  price: number
  type: "buy" | "sell"
}

export async function getTradeHistory(tokenAddress: string): Promise<TradeEvent[]> {
  try {
    if (!tokenAddress || !tokenAddress.startsWith("0x") || tokenAddress.length !== 42) return []

    const jsonProvider = await getJsonProvider()
    const contract = new Contract(CONTRACT_CONFIG.address, ABI, jsonProvider)

    const currentBlock = await jsonProvider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 500000)

    const trades: TradeEvent[] = []

    try {
      const buyFilter = contract.filters.TokensBought(tokenAddress)
      const buyEvents = await contract.queryFilter(buyFilter, fromBlock, currentBlock)
      for (const event of buyEvents) {
        const log = event as any
        if (log.args && log.args[4]) {
          const block = await log.getBlock()
          trades.push({
            time: block.timestamp * 1000,
            price: Number.parseFloat(formatEther(log.args[4])),
            type: "buy",
          })
        }
      }
    } catch (e) {
      console.error("Failed to query buy events for chart:", e)
    }

    try {
      const sellFilter = contract.filters.TokensSold(tokenAddress)
      const sellEvents = await contract.queryFilter(sellFilter, fromBlock, currentBlock)
      for (const event of sellEvents) {
        const log = event as any
        if (log.args) {
          const block = await log.getBlock()
          const tokens = Number.parseFloat(formatEther(log.args[2]))
          const payment = Number.parseFloat(formatEther(log.args[3]))
          const price = tokens > 0 ? payment / tokens : 0
          trades.push({
            time: block.timestamp * 1000,
            price,
            type: "sell",
          })
        }
      }
    } catch (e) {
      console.error("Failed to query sell events for chart:", e)
    }

    trades.sort((a, b) => a.time - b.time)
    return trades
  } catch (error) {
    console.error("Failed to get trade history:", error)
    return []
  }
}

export async function isTokenUnlocked(tokenAddress: string): Promise<boolean> {
  try {
    tokenAddress = formatAddress(tokenAddress)
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
