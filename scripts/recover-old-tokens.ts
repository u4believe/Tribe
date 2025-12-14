import { Contract, JsonRpcProvider } from "ethers"
import { createClient } from "@supabase/supabase-js"

const OLD_CONTRACT_ADDRESS = "0xD9E849B6d44946B0D0FAEafe34b92C79c68cCbeF"
const RPC_URL = "https://testnet.trustsmartchain.com"
const CHAIN_ID = 15555

// Contract ABI - minimal functions needed
const MINIMAL_ABI = [
  {
    inputs: [],
    name: "getAllTokens",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "tokenAddress", type: "address" }],
    name: "getTokenInfo",
    outputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "symbol", type: "string" },
      { internalType: "string", name: "description", type: "string" },
      { internalType: "string", name: "imageUrl", type: "string" },
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "uint256", name: "initialSupply", type: "uint256" },
      { internalType: "uint256", name: "createdAt", type: "uint256" },
      { internalType: "bool", name: "isLocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
]

async function recoverTokens() {
  console.log("[v0] Starting token recovery from old contract...")

  // Initialize provider
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const contract = new Contract(OLD_CONTRACT_ADDRESS, MINIMAL_ABI, provider)

  // Initialize Supabase
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    // Get all token addresses from old contract
    console.log("[v0] Fetching all tokens from blockchain...")
    const tokenAddresses = await contract.getAllTokens()
    console.log(`[v0] Found ${tokenAddresses.length} tokens`)

    // Fetch details for each token
    const tokensToInsert = []

    for (let i = 0; i < tokenAddresses.length; i++) {
      const address = tokenAddresses[i]
      console.log(`[v0] Fetching token ${i + 1}/${tokenAddresses.length}: ${address}`)

      try {
        const tokenInfo = await contract.getTokenInfo(address)

        tokensToInsert.push({
          address: address.toLowerCase(),
          name: tokenInfo[0],
          symbol: tokenInfo[1],
          description: tokenInfo[2],
          image_url: tokenInfo[3],
          creator_address: tokenInfo[4].toLowerCase(),
          initial_supply: tokenInfo[5].toString(),
          is_locked: tokenInfo[7],
          created_at: new Date(Number(tokenInfo[6]) * 1000).toISOString(),
          contract_address: OLD_CONTRACT_ADDRESS.toLowerCase(),
        })
      } catch (error) {
        console.error(`[v0] Error fetching token ${address}:`, error)
      }
    }

    console.log(`[v0] Successfully fetched ${tokensToInsert.length} tokens`)

    // Insert tokens into database
    if (tokensToInsert.length > 0) {
      console.log("[v0] Inserting tokens into database...")
      const { data, error } = await supabase.from("meme_tokens").insert(tokensToInsert)

      if (error) {
        console.error("[v0] Error inserting tokens:", error)
        throw error
      }

      console.log(`[v0] Successfully restored ${tokensToInsert.length} tokens!`)
      return tokensToInsert
    } else {
      console.log("[v0] No tokens to restore")
      return []
    }
  } catch (error) {
    console.error("[v0] Recovery failed:", error)
    throw error
  }
}

// Run the recovery
recoverTokens()
  .then((tokens) => {
    console.log("[v0] Recovery complete!")
    console.log(
      `[v0] Restored tokens:`,
      tokens.map((t) => `${t.name} (${t.symbol})`),
    )
  })
  .catch((error) => {
    console.error("[v0] Recovery failed:", error)
    process.exit(1)
  })
