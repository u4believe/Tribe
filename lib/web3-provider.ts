import { BrowserProvider, Contract, formatEther, JsonRpcProvider } from "ethers"
import { CONTRACT_CONFIG } from "./contract-config"
import ABI from "./contract-abi.json"

let provider: BrowserProvider | null = null
let jsonProvider: JsonRpcProvider | null = null
let signer: any = null

export async function getProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask or Web3 wallet not found")
  }

  if (!provider) {
    provider = new BrowserProvider(window.ethereum)
  }

  return provider
}

export async function getJsonProvider() {
  if (!jsonProvider) {
    jsonProvider = new JsonRpcProvider(CONTRACT_CONFIG.network.rpcUrl, {
      name: CONTRACT_CONFIG.network.name,
      chainId: CONTRACT_CONFIG.chainId,
    })
  }
  return jsonProvider
}

export async function getSigner() {
  const prov = await getProvider()
  if (!signer) {
    signer = await prov.getSigner()
  }
  return signer
}

export async function getContract() {
  const sig = await getSigner()
  // This prevents ethers.js from attempting ENS resolution on networks that don't support it
  const jsonProv = await getJsonProvider()

  // Create a contract with the signer, but attach the json provider for read-only calls
  const contract = new Contract(CONTRACT_CONFIG.address, ABI, sig)

  // Override the provider on the contract to use the JSON provider for read operations
  Object.defineProperty(contract, "provider", {
    value: jsonProv,
    writable: true,
    configurable: true,
  })

  return contract
}

export async function switchNetwork() {
  if (!window.ethereum) {
    throw new Error("MetaMask or Web3 wallet not found")
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CONTRACT_CONFIG.chainId.toString(16)}` }],
    })
  } catch (error: any) {
    if (error.code === 4902) {
      // Network not added, add it
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
  try {
    await switchNetwork()
    const prov = await getProvider()
    const accounts = await prov.send("eth_requestAccounts", [])
    return accounts[0]
  } catch (error) {
    console.error("Failed to connect wallet:", error)
    throw error
  }
}

export async function getConnectedAddress() {
  try {
    const sig = await getSigner()
    return await sig.getAddress()
  } catch {
    return null
  }
}

export async function getBalance(address: string) {
  const prov = await getJsonProvider() // Use jsonProvider for read-only operations
  const balance = await prov.getBalance(address)
  return formatEther(balance)
}
