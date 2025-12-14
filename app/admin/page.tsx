"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { deleteAllTokens, fetchAllTokens } from "@/lib/tokens"
import { Trash2, ShieldX, Settings, Rocket, ArrowRightLeft, Percent, Loader2 } from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import { isAdmin } from "@/lib/admin-config"
import {
  transferOwnership,
  setDexRouter,
  setFeePercent,
  setDefaultPostMigrationTransferFeePercent,
  completeTokenLaunch,
  getFeePercent,
  getDexRouter,
  getDefaultPostMigrationTransferFeePercent,
  getContractOwner,
} from "@/lib/contract-functions"

export default function AdminPage() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState("")
  const { address } = useWallet()
  const userIsAdmin = isAdmin(address)

  const [newOwnerAddress, setNewOwnerAddress] = useState("")
  const [newDexRouter, setNewDexRouter] = useState("")
  const [newFeePercent, setNewFeePercent] = useState("")
  const [newPostMigrationFee, setNewPostMigrationFee] = useState("")
  const [selectedToken, setSelectedToken] = useState("")
  const [tokens, setTokens] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState("")
  const [isRecovering, setIsRecovering] = useState(false)
  const [currentOwner, setCurrentOwner] = useState("")
  const [currentDexRouter, setCurrentDexRouter] = useState("")
  const [currentFeePercent, setCurrentFeePercent] = useState("")
  const [currentPostMigrationFee, setCurrentPostMigrationFee] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const [owner, router, fee, postFee, allTokens] = await Promise.all([
          getContractOwner(),
          getDexRouter(),
          getFeePercent(),
          getDefaultPostMigrationTransferFeePercent(),
          fetchAllTokens(),
        ])
        setCurrentOwner(owner)
        setCurrentDexRouter(router)
        setCurrentFeePercent(fee)
        setCurrentPostMigrationFee(postFee)
        setTokens(allTokens.filter((t: any) => !t.isCompleted))
      } catch (error) {
        console.error("Failed to fetch contract data:", error)
      }
    }
    if (userIsAdmin) {
      fetchData()
    }
  }, [userIsAdmin])

  if (!address) {
    return (
      <div className="container mx-auto p-8 pt-36">
        <div className="max-w-2xl mx-auto">
          <Card className="border-yellow-200">
            <CardHeader>
              <CardTitle className="text-yellow-600 flex items-center gap-2">
                <ShieldX className="h-5 w-5" />
                Authentication Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Please connect your wallet to access the admin panel.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!userIsAdmin) {
    return (
      <div className="container mx-auto p-8 pt-36">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <ShieldX className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                You do not have permission to access this page. Only authorized administrators can access the admin
                panel.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const handleDeleteAllTokens = async () => {
    if (!confirm("WARNING: This will permanently delete ALL tokens from the database. Are you sure?")) {
      return
    }

    if (!confirm("This action CANNOT be undone. Type DELETE in the next prompt to continue.")) {
      return
    }

    const confirmation = prompt("Type DELETE to confirm:")
    if (confirmation !== "DELETE") {
      setMessage("Deletion cancelled")
      return
    }

    setIsDeleting(true)
    setMessage("Deleting all tokens...")

    try {
      const success = await deleteAllTokens()
      if (success) {
        setMessage("All tokens have been deleted successfully. Redirecting to homepage...")
        if (typeof window !== "undefined") {
          localStorage.removeItem("walletConnected")
        }
        setTimeout(() => {
          window.location.href = "/?t=" + Date.now()
        }, 1000)
      } else {
        setMessage("Failed to delete tokens. Check console for errors.")
      }
    } catch (error) {
      console.error("Error deleting tokens:", error)
      setMessage("Error occurred while deleting tokens")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTransferOwnership = async () => {
    if (!newOwnerAddress) {
      setMessage("Please enter a valid address")
      return
    }
    if (!confirm(`Are you sure you want to transfer ownership to ${newOwnerAddress}? This action cannot be undone.`)) {
      return
    }
    setIsProcessing("ownership")
    try {
      await transferOwnership(newOwnerAddress)
      setMessage("Ownership transferred successfully!")
      setCurrentOwner(newOwnerAddress)
      setNewOwnerAddress("")
    } catch (error: any) {
      setMessage(`Failed: ${error.message}`)
    } finally {
      setIsProcessing("")
    }
  }

  const handleSetDexRouter = async () => {
    if (!newDexRouter) {
      setMessage("Please enter a valid router address")
      return
    }
    setIsProcessing("router")
    try {
      await setDexRouter(newDexRouter)
      setMessage("DEX Router updated successfully!")
      setCurrentDexRouter(newDexRouter)
      setNewDexRouter("")
    } catch (error: any) {
      setMessage(`Failed: ${error.message}`)
    } finally {
      setIsProcessing("")
    }
  }

  const handleSetFeePercent = async () => {
    const fee = Number.parseFloat(newFeePercent)
    if (isNaN(fee) || fee < 0 || fee > 20) {
      setMessage("Fee must be between 0% and 20%")
      return
    }
    setIsProcessing("fee")
    try {
      await setFeePercent(fee)
      setMessage("Bonding curve fee updated successfully!")
      setCurrentFeePercent(fee)
      setNewFeePercent("")
    } catch (error: any) {
      setMessage(`Failed: ${error.message}`)
    } finally {
      setIsProcessing("")
    }
  }

  const handleSetPostMigrationFee = async () => {
    const fee = Number.parseFloat(newPostMigrationFee)
    if (isNaN(fee) || fee < 0 || fee > 5) {
      setMessage("Post migration fee must be between 0% and 5%")
      return
    }
    setIsProcessing("postFee")
    try {
      await setDefaultPostMigrationTransferFeePercent(fee)
      setMessage("Default post migration transfer fee updated successfully!")
      setCurrentPostMigrationFee(fee)
      setNewPostMigrationFee("")
    } catch (error: any) {
      setMessage(`Failed: ${error.message}`)
    } finally {
      setIsProcessing("")
    }
  }

  const handleCompleteTokenLaunch = async () => {
    if (!selectedToken) {
      setMessage("Please select a token for DEX migration")
      return
    }
    if (
      !confirm(
        `Are you sure you want to complete the launch and migrate ${selectedToken} to DEX? This action cannot be undone.`,
      )
    ) {
      return
    }
    setIsProcessing("launch")
    try {
      await completeTokenLaunch(selectedToken)
      setMessage("Token launch completed and migrated to DEX successfully!")
      setTokens(tokens.filter((t) => t.address !== selectedToken))
      setSelectedToken("")
    } catch (error: any) {
      setMessage(`Failed: ${error.message}`)
    } finally {
      setIsProcessing("")
    }
  }

  const handleRecoverOldTokens = async () => {
    if (
      !confirm(
        "This will fetch all tokens from the old contract (0xD9E849B6d44946B0D0FAEafe34b92C79c68cCbeF) and add them to the database. Continue?",
      )
    ) {
      return
    }

    setIsRecovering(true)
    setMessage("Recovering tokens from old contract...")

    try {
      const { Contract, JsonRpcProvider, formatEther } = await import("ethers")
      const { createClient } = await import("@supabase/supabase-js")
      const { calculateMarketCap } = await import("@/lib/bonding-curve")
      const { RPC_URL } = await import("@/lib/contract-config")
      const CONTRACT_ABI = (await import("@/lib/contract-abi.json")).default

      const OLD_CONTRACT_ADDRESS = "0xD9E849B6d44946B0D0FAEafe34b92C79c68cCbeF"

      console.log("[v0] Creating provider with RPC:", RPC_URL)
      const provider = new JsonRpcProvider(RPC_URL)

      try {
        const network = await provider.getNetwork()
        console.log("[v0] Connected to network:", network.chainId.toString())
      } catch (error) {
        console.error("[v0] Network connection error:", error)
        throw new Error("Failed to connect to blockchain network. Please check your internet connection and try again.")
      }

      const contract = new Contract(OLD_CONTRACT_ADDRESS, CONTRACT_ABI, provider)

      console.log("[v0] Fetching tokens from old contract...")
      setMessage("Connecting to blockchain...")

      let tokenAddresses: string[]
      try {
        tokenAddresses = await contract.getAllTokens()
        console.log(`[v0] Found ${tokenAddresses.length} tokens`)
      } catch (error: any) {
        console.error("[v0] Error calling getAllTokens:", error)
        throw new Error(`Failed to fetch tokens from contract: ${error.message || "Unknown error"}`)
      }

      if (tokenAddresses.length === 0) {
        setMessage("No tokens found in old contract")
        setIsRecovering(false)
        return
      }

      setMessage(`Found ${tokenAddresses.length} tokens. Fetching details...`)

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

      const { data: existingTokens } = await supabase.from("meme_tokens").select("contract_address")

      const existingAddresses = new Set((existingTokens || []).map((t: any) => t.contract_address.toLowerCase()))

      const tokensToInsert = []
      for (let i = 0; i < tokenAddresses.length; i++) {
        const tokenAddress = tokenAddresses[i]

        if (existingAddresses.has(tokenAddress.toLowerCase())) {
          console.log(`[v0] Token ${tokenAddress} already exists, skipping`)
          continue
        }

        console.log(`[v0] Fetching token ${i + 1}/${tokenAddresses.length}: ${tokenAddress}`)
        setMessage(`Fetching token ${i + 1}/${tokenAddresses.length}...`)

        try {
          const tokenInfo = await contract.getTokenInfo(tokenAddress)

          const name = tokenInfo.name || tokenInfo[0]
          const symbol = tokenInfo.symbol || tokenInfo[1]
          const metadata = tokenInfo.metadata || tokenInfo[2]
          const creator = tokenInfo.creator || tokenInfo[3]
          const maxSupply = tokenInfo.maxSupply || tokenInfo[5]
          const currentSupply = tokenInfo.currentSupply || tokenInfo[6]
          const completed = tokenInfo.completed !== undefined ? tokenInfo.completed : tokenInfo[9]
          const creationTime = tokenInfo.creationTime || tokenInfo[10]

          const maxSupplyEther = Number.parseFloat(formatEther(maxSupply))
          const currentSupplyEther = Number.parseFloat(formatEther(currentSupply))

          // Store as integer: Ether * 1,000,000 (fits in bigint, preserves 6 decimals)
          const maxSupplyInt = Math.floor(maxSupplyEther * 1e6)
          const currentSupplyInt = Math.floor(currentSupplyEther * 1e6)

          const marketCap = calculateMarketCap(currentSupplyEther)
          const currentPrice = currentSupplyEther > 0 ? marketCap / currentSupplyEther : 0

          let imageUrl = ""
          let intuitionLink = ""
          try {
            const meta = JSON.parse(metadata)
            imageUrl = meta.image || meta.imageUrl || ""
            intuitionLink = meta.intuitionLink || ""
          } catch (e) {
            console.warn("[v0] Failed to parse metadata for token", tokenAddress)
          }

          tokensToInsert.push({
            contract_address: tokenAddress.toLowerCase(),
            name,
            symbol,
            image: imageUrl,
            creator: creator.toLowerCase(),
            max_supply: maxSupplyInt,
            current_supply: currentSupplyInt,
            market_cap: marketCap,
            current_price: currentPrice,
            start_price: 0.0001,
            holders: 1,
            is_completed: completed,
            is_alpha: false,
            intuition_link: intuitionLink || null,
            created_at: new Date(Number(creationTime) * 1000).toISOString(),
            factory_address: OLD_CONTRACT_ADDRESS, // Mark as old contract token
          })
        } catch (error: any) {
          console.error(`[v0] Error fetching token ${tokenAddress}:`, error)
          setMessage(`Warning: Failed to fetch token ${tokenAddress}. Continuing...`)
        }
      }

      setMessage(`Fetched ${tokensToInsert.length} new tokens. Inserting into database...`)

      if (tokensToInsert.length > 0) {
        const { error } = await supabase.from("meme_tokens").insert(tokensToInsert)

        if (error) {
          console.error("[v0] Database error:", error)
          setMessage(`Failed to insert tokens: ${error.message}`)
        } else {
          setMessage(`Successfully recovered ${tokensToInsert.length} tokens from old contract!`)
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        }
      } else {
        setMessage("All tokens from old contract are already in the database")
      }
    } catch (error: any) {
      console.error("[v0] Recovery error:", error)
      setMessage(`Recovery failed: ${error.message || "Unknown error occurred"}`)
    } finally {
      setIsRecovering(false)
    }
  }

  return (
    <div className="container mx-auto p-8 pt-36">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

        {message && (
          <div
            className={`p-4 rounded-lg ${message.includes("successfully") ? "bg-green-50 text-green-800 border border-green-200" : message.includes("Failed") || message.includes("Error") ? "bg-red-50 text-red-800 border border-red-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}
          >
            {message}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Contract Settings
            </CardTitle>
            <CardDescription>View and update contract configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/20 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">Current Values</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Owner:</span>
                  <p className="font-mono text-xs truncate">{currentOwner || "Loading..."}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">DEX Router:</span>
                  <p className="font-mono text-xs truncate">{currentDexRouter || "Loading..."}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bonding Curve Fee:</span>
                  <p className="font-semibold">{currentFeePercent}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Post Migration Fee:</span>
                  <p className="font-semibold">{currentPostMigrationFee}%</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Transfer Ownership
              </h3>
              <p className="text-sm text-muted-foreground">
                Transfer contract ownership to a new address. This action is irreversible.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="New owner address (0x...)"
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleTransferOwnership} disabled={isProcessing === "ownership"} variant="outline">
                  {isProcessing === "ownership" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transfer"}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <h3 className="font-semibold">Set DEX Router</h3>
              <p className="text-sm text-muted-foreground">Update the DEX router address for token migrations.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="New router address (0x...)"
                  value={newDexRouter}
                  onChange={(e) => setNewDexRouter(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSetDexRouter} disabled={isProcessing === "router"} variant="outline">
                  {isProcessing === "router" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Bonding Curve Fee (Max 20%)
              </h3>
              <p className="text-sm text-muted-foreground">Set the fee percentage for bonding curve trades.</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Fee percent (0-20)"
                  value={newFeePercent}
                  onChange={(e) => setNewFeePercent(e.target.value)}
                  className="flex-1"
                  min="0"
                  max="20"
                />
                <Button onClick={handleSetFeePercent} disabled={isProcessing === "fee"} variant="outline">
                  {isProcessing === "fee" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Fee"}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <h3 className="font-semibold">Default Post Migration Transfer Fee (Max 5%)</h3>
              <p className="text-sm text-muted-foreground">Set the default transfer fee applied after DEX migration.</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Fee percent (0-5)"
                  value={newPostMigrationFee}
                  onChange={(e) => setNewPostMigrationFee(e.target.value)}
                  className="flex-1"
                  min="0"
                  max="5"
                />
                <Button onClick={handleSetPostMigrationFee} disabled={isProcessing === "postFee"} variant="outline">
                  {isProcessing === "postFee" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Fee"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              DEX Migration
            </CardTitle>
            <CardDescription>Complete token launch and migrate to DEX</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-3">
              <h3 className="font-semibold">Complete Token Launch</h3>
              <p className="text-sm text-muted-foreground">
                Select a token to complete its bonding curve and migrate liquidity to DEX. This action is irreversible.
              </p>
              <div className="flex gap-2">
                <select
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-border rounded-md text-sm"
                >
                  <option value="">Select a token...</option>
                  {tokens.map((token) => (
                    <option key={token.address || token.contractAddress} value={token.address || token.contractAddress}>
                      {token.name} ({token.symbol})
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleCompleteTokenLaunch}
                  disabled={isProcessing === "launch" || !selectedToken}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  {isProcessing === "launch" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Migrate to DEX"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-600 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Token Recovery
            </CardTitle>
            <CardDescription>Restore tokens from old contract</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold mb-2">Recover Old Tokens</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Fetch all tokens from the old contract (0xD9E849B6d44946B0D0FAEafe34b92C79c68cCbeF) and restore them to
                work alongside new tokens.
              </p>
              <Button
                onClick={handleRecoverOldTokens}
                disabled={isRecovering}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Recovering...
                  </>
                ) : (
                  "Recover Old Tokens"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible actions that affect the entire platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold mb-2">Delete All Tokens</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete all meme tokens from the database. This action cannot be undone. Use this
                before deploying a new contract.
              </p>
              <Button variant="destructive" onClick={handleDeleteAllTokens} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete All Tokens"}
              </Button>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold mb-2">Next Steps After Deletion</h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Update the contract address in lib/contract-config.ts</li>
                <li>Replace the ABI in lib/contract-abi.json with your new contract's ABI</li>
                <li>Test token creation with the new contract</li>
                <li>Verify all trading functions work correctly</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
