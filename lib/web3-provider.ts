import { BrowserProvider, Contract, formatEther, JsonRpcProvider, Network } from "ethers"
import { CONTRACT_CONFIG } from "./contract-config"
import ABI from "./contract-abi.json"

let provider: BrowserProvider | null = null
let jsonProvider: JsonRpcProvider | null = null
let signer: any = null

let isConnecting = false
let connectionPromise: Promise<string> | null = null

export async function getProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask or Web3 wallet not found")
  }

  if (!provider) {
    provider = new BrowserProvider(window.ethereum)
  }

  return provider
}

export async function getJsonProvider() {
  if (!jsonProvider) {
    const network = Network.from({
      name: CONTRACT_CONFIG.network.name,
      chainId: CONTRACT_CONFIG.chainId,
    })
    jsonProvider = new JsonRpcProvider(CONTRACT_CONFIG.network.rpcUrl, network, {
      staticNetwork: network,
    })
  }
  return jsonProvider
}

export async function getSigner() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask or Web3 wallet not found")
  }

  const prov = await getProvider()

  if (!signer) {
    signer = await prov.getSigner()
  }

  return signer
}

let contract: Contract | null = null

export async function getContract() {
  const sig = await getSigner()
  // This prevents ethers.js from attempting ENS resolution on networks that don't support it
  const jsonProv = await getJsonProvider()

  // Create a contract with the signer, but attach the json provider for read-only calls
  if (!contract) {
    contract = new Contract(CONTRACT_CONFIG.address, ABI, sig)
  }

  // Override the provider on the contract to use the JSON provider for read operations
  Object.defineProperty(contract, "provider", {
    value: jsonProv,
    writable: true,
    configurable: true,
  })

  return contract
}

export async function switchNetwork() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask or Web3 wallet not found")
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CONTRACT_CONFIG.chainId.toString(16)}` }],
    })
  } catch (error: any) {
    if (error.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${CONTRACT_CONFIG.chainId.toString(16)}`,
            chainName: CONTRACT_CONFIG.network.name,
            rpcUrls: [CONTRACT_CONFIG.network.rpcUrl],
            nativeCurrency: {
              name: CONTRACT_CONFIG.network.currency,
              symbol: CONTRACT_CONFIG.network.currency,
              decimals: 18,
            },
            blockExplorerUrls: [CONTRACT_CONFIG.network.blockExplorer],
          },
        ],
      })
    } else {
      throw error
    }
  }
}

export async function connectWallet() {
  if (typeof window === "undefined") {
    throw new Error("Cannot connect wallet on server side")
  }

  if (!window.ethereum) {
    throw new Error("No Web3 wallet detected. Please install MetaMask or another Web3 wallet.")
  }

  if (isConnecting && connectionPromise) {
    console.log("[v0] Connection already in progress, returning existing promise")
    return connectionPromise
  }

  connectionPromise = (async () => {
    try {
      isConnecting = true

      try {
        await switchNetwork()
      } catch (networkError: any) {
        console.error("[v0] Network switch error:", networkError)
        if (networkError.code === 4001) {
          throw new Error("Network switch cancelled by user")
        }
        throw new Error(`Failed to switch network: ${networkError.message || "Unknown error"}`)
      }

      try {
        const prov = await getProvider()
        const accounts = await prov.send("eth_requestAccounts", [])

        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found in wallet")
        }

        signer = null
        return accounts[0]
      } catch (accountError: any) {
        console.error("[v0] Account request error:", accountError)
        if (accountError.code === 4001) {
          throw new Error("Connection cancelled by user")
        }
        if (accountError.code === -32002) {
          throw new Error(
            "A wallet connection request is already pending. Please check your wallet extension and complete or cancel the existing request first.",
          )
        }
        throw new Error(`Failed to connect wallet: ${accountError.message || "Unknown error"}`)
      }
    } catch (error: any) {
      console.error("[v0] Failed to connect wallet:", error)
      throw error
    } finally {
      isConnecting = false
      connectionPromise = null
    }
  })()

  connectionPromise.catch((err) => {
    console.error("[v0] Unhandled wallet connection error:", err)
  })

  return connectionPromise
}

export async function getConnectedAddress() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null
  }

  try {
    const prov = await getProvider()
    const accounts = await prov.send("eth_accounts", [])
    return accounts.length > 0 ? accounts[0] : null
  } catch (error) {
    console.error("[v0] Error getting connected address:", error)
    return null
  }
}

export async function getBalance(address: string) {
  const prov = await getJsonProvider() // Use jsonProvider for read-only operations
  const balance = await prov.getBalance(address)
  return formatEther(balance)
}

export async function disconnectWallet() {
  provider = null
  signer = null
  contract = null
  jsonProvider = null

  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    localStorage.removeItem("walletConnected")
  }
}

export async function forceNewWalletConnection() {
  // Clear all cached instances first
  provider = null
  signer = null
  contract = null
  jsonProvider = null

  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No Web3 wallet detected. Please install MetaMask or another Web3 wallet.")
  }

  // Switch to correct network first
  await switchNetwork()

  // Force MetaMask to show account picker by requesting permissions
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    })
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("Connection cancelled by user")
    }
    // If wallet_requestPermissions fails, continue with normal connection
    console.log("[v0] wallet_requestPermissions not supported, using eth_requestAccounts")
  }

  // Now get the accounts
  const freshProvider = new BrowserProvider(window.ethereum)
  provider = freshProvider
  const accounts = await freshProvider.send("eth_requestAccounts", [])

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found in wallet")
  }

  signer = null // Reset signer so it gets recreated with new account
  return accounts[0]
}

export async function forceReconnectWallet() {
  // Clear all cached instances
  provider = null
  signer = null
  contract = null

  // Request accounts again to get the current wallet
  return connectWallet()
}
