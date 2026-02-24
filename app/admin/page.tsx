"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { deleteAllTokens, deleteTokensByContractAddress } from "@/lib/tokens"
import { Trash2, ShieldX, Download, RefreshCw, Settings } from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import { isAdmin } from "@/lib/admin-config"
import { importTokensFromContract } from "@/lib/contract-import"
import {
  recoverSellSpreadLiquidity,
  emergencyWithdrawTokens,
  setDexRouter,
  completeTokenLaunch,
  setDefaultPostMigrationTransferFeePercent,
  transferOwnership,
  setFeePercent as setFeePercentContract,
  setSellSpreadPercent,
  setTokenSellSpread,
} from "@/lib/contract-functions"

export default function AdminPage() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState("")
  const [message, setMessage] = useState("")
  const { address } = useWallet()
  const userIsAdmin = isAdmin(address)

  const [newOwnerAddress, setNewOwnerAddress] = useState("")
  const [routerAddress, setRouterAddress] = useState("")
  const [globalFeePercent, setGlobalFeePercent] = useState("")
  const [postMigrationFee, setPostMigrationFee] = useState("")
  const [defaultSpreadPercent, setDefaultSpreadPercent] = useState("")
  const [tokenSpreadAddress, setTokenSpreadAddress] = useState("")
  const [tokenSpreadPercent, setTokenSpreadPercent] = useState("")
  const [emergencyToken, setEmergencyToken] = useState("")
  const [recoverSpreadToken, setRecoverSpreadToken] = useState("")
  const [completeLaunchToken, setCompleteLaunchToken] = useState("")
  const [adminMessage, setAdminMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDeletingInvalid, setIsDeletingInvalid] = useState(false)

  if (!address) {
    return (
      <div className="container mx-auto p-8 pt-24">
        <div className="max-w-2xl mx-auto">
          <Card className="border-yellow-500/50 bg-card">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <ShieldX className="h-5 w-5" />
                Authentication Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">Please connect your wallet to access the admin panel.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!userIsAdmin) {
    return (
      <div className="container mx-auto p-8 pt-24">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-500/50 bg-card">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <ShieldX className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                You do not have permission to access this page. Only authorized administrators can access the admin
                panel.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const handleTransferOwnership = async () => {
    if (!newOwnerAddress) {
      setAdminMessage("Please enter new owner address")
      return
    }
    if (!confirm("WARNING: This will transfer contract ownership to a new address. Are you absolutely sure?")) {
      return
    }
    const confirmation = prompt("Type TRANSFER to confirm ownership transfer:")
    if (confirmation !== "TRANSFER") {
      setAdminMessage("Ownership transfer cancelled")
      return
    }
    setIsLoading(true)
    try {
      await transferOwnership(newOwnerAddress)
      setAdminMessage("Ownership transferred successfully!")
      setNewOwnerAddress("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetDexRouter = async () => {
    if (!routerAddress) {
      setAdminMessage("Please enter router address")
      return
    }
    setIsLoading(true)
    try {
      await setDexRouter(routerAddress)
      setAdminMessage("DEX router set successfully!")
      setRouterAddress("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetFeePercent = async () => {
    if (!globalFeePercent) {
      setAdminMessage("Please enter fee percent")
      return
    }
    setIsLoading(true)
    try {
      await setFeePercentContract(Number.parseInt(globalFeePercent))
      setAdminMessage("Fee percent set successfully!")
      setGlobalFeePercent("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetTransferFee = async () => {
    if (!postMigrationFee) {
      setAdminMessage("Please enter fee percent")
      return
    }
    setIsLoading(true)
    try {
      await setDefaultPostMigrationTransferFeePercent(Number.parseInt(postMigrationFee))
      setAdminMessage("Default post-migration transfer fee set successfully!")
      setPostMigrationFee("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetSellSpreadPercent = async () => {
    if (!defaultSpreadPercent) {
      setAdminMessage("Please enter a sell spread percent")
      return
    }
    setIsLoading(true)
    try {
      await setSellSpreadPercent(Number.parseInt(defaultSpreadPercent))
      setAdminMessage("Default sell spread percent set successfully!")
      setDefaultSpreadPercent("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetTokenSellSpread = async () => {
    if (!tokenSpreadAddress || !tokenSpreadPercent) {
      setAdminMessage("Please enter token address and sell spread percent")
      return
    }
    setIsLoading(true)
    try {
      await setTokenSellSpread(tokenSpreadAddress, Number.parseInt(tokenSpreadPercent))
      setAdminMessage("Token sell spread set successfully!")
      setTokenSpreadAddress("")
      setTokenSpreadPercent("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmergencyWithdraw = async () => {
    if (!emergencyToken) {
      setAdminMessage("Please enter token address")
      return
    }
    if (!confirm("WARNING: This will refund all users' native contributions for this token. Holders keep their tokens but cannot redeem again. Continue?")) {
      return
    }
    setIsLoading(true)
    try {
      await emergencyWithdrawTokens(emergencyToken)
      setAdminMessage("Emergency withdrawal successful!")
      setEmergencyToken("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecoverSellSpreadLiquidity = async () => {
    if (!recoverSpreadToken) {
      setAdminMessage("Please enter token address")
      return
    }
    setIsLoading(true)
    try {
      await recoverSellSpreadLiquidity(recoverSpreadToken)
      setAdminMessage("Sell spread liquidity recovered successfully!")
      setRecoverSpreadToken("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteTokenLaunch = async () => {
    if (!completeLaunchToken) {
      setAdminMessage("Please enter token address")
      return
    }
    if (!confirm("Are you sure you want to complete this token launch? This will mark the token as completed and run DEX migration (wrap, add liquidity, enable transfer fee). This action cannot be undone.")) {
      return
    }
    setIsLoading(true)
    try {
      await completeTokenLaunch(completeLaunchToken)
      setAdminMessage("Token launch completed successfully!")
      setCompleteLaunchToken("")
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportTokens = async () => {
    setIsImporting(true)
    setImportMessage("Fetching tokens from contract...")

    try {
      const result = await importTokensFromContract()
      if (result.success) {
        setImportMessage(`Successfully imported ${result.imported} token(s). ${result.skipped} already existed.`)
        setTimeout(() => {
          window.location.href = "/?t=" + Date.now()
        }, 2000)
      } else {
        setImportMessage(`Failed to import tokens: ${result.error}`)
      }
    } catch (error) {
      console.error("Error importing tokens:", error)
      setImportMessage("Error occurred while importing tokens")
    } finally {
      setIsImporting(false)
    }
  }

  const handleDeleteInvalidTokens = async () => {
    if (!confirm("This will delete all tokens with invalid contract addresses (not starting with 0x or wrong length). Continue?")) {
      return
    }

    setIsDeletingInvalid(true)
    setMessage("Scanning for invalid tokens...")

    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      if (!supabase) {
        setMessage("Supabase client not initialized")
        return
      }

      const { data: allTokens } = await supabase
        .from("meme_tokens")
        .select("id, name, symbol, contract_address")

      if (!allTokens || allTokens.length === 0) {
        setMessage("No tokens found in database")
        return
      }

      const invalidTokens = allTokens.filter(
        (t) => !t.contract_address || !t.contract_address.startsWith("0x") || t.contract_address.length !== 42
      )

      if (invalidTokens.length === 0) {
        setMessage("No invalid tokens found. All tokens have valid contract addresses.")
        return
      }

      setMessage(`Found ${invalidTokens.length} invalid token(s): ${invalidTokens.map(t => `${t.symbol} (${t.contract_address})`).join(", ")}. Deleting...`)

      let deleted = 0
      for (const token of invalidTokens) {
        const success = await deleteTokensByContractAddress(token.contract_address)
        if (success) deleted++
      }

      setMessage(`Deleted ${deleted}/${invalidTokens.length} invalid tokens.`)
    } catch (error) {
      console.error("Error deleting invalid tokens:", error)
      setMessage("Error occurred while deleting invalid tokens")
    } finally {
      setIsDeletingInvalid(false)
    }
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

  return (
    <div className="container mx-auto p-8 pt-24">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">Admin Panel</h1>

        <Card className="mb-6 border-blue-500/50 bg-card">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import Tokens
            </CardTitle>
            <CardDescription className="text-gray-400">Import tokens from the blockchain contract</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-blue-300">Import from Contract</h3>
              <p className="text-sm text-gray-400 mb-4">
                Fetch all tokens from the contract and add them to the database. Existing tokens will be skipped.
              </p>
              <Button onClick={handleImportTokens} disabled={isImporting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import Tokens from Contract
                  </>
                )}
              </Button>
            </div>

            {importMessage && (
              <div className="p-4 rounded-lg bg-gray-800 border border-gray-600 text-gray-200">
                {importMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 border-purple-500/50 bg-card">
          <CardHeader>
            <CardTitle className="text-purple-400 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Contract Management
            </CardTitle>
            <CardDescription className="text-gray-400">Configure contract parameters and manage tokens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-purple-300">Set Fee Percent</h3>
              <p className="text-sm text-gray-400 mb-3">
                Sets the global buy/sell fee percent (capped by MAX_FEE_PERCENT).
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Fee percent"
                  value={globalFeePercent}
                  onChange={(e) => setGlobalFeePercent(e.target.value)}
                  className="w-32 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleSetFeePercent}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Set Fee
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-purple-300">Set Default Post-Migration Transfer Fee</h3>
              <p className="text-sm text-gray-400 mb-3">
                Sets the default transfer fee % after DEX migration (capped).
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Fee percent"
                  value={postMigrationFee}
                  onChange={(e) => setPostMigrationFee(e.target.value)}
                  className="w-32 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleSetTransferFee}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Set Fee
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-purple-300">Set Default Sell Spread Percent</h3>
              <p className="text-sm text-gray-400 mb-3">
                Sets the default sell spread % (capped by MAX_SELL_SPREAD_PERCENT).
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Spread percent"
                  value={defaultSpreadPercent}
                  onChange={(e) => setDefaultSpreadPercent(e.target.value)}
                  className="w-32 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleSetSellSpreadPercent}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Set
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-purple-300">Set Token Sell Spread</h3>
              <p className="text-sm text-gray-400 mb-3">
                Sets per-token sell spread % for a specific token.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Token address"
                  value={tokenSpreadAddress}
                  onChange={(e) => setTokenSpreadAddress(e.target.value)}
                  className="flex-1 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Input
                  type="number"
                  placeholder="Spread %"
                  value={tokenSpreadPercent}
                  onChange={(e) => setTokenSpreadPercent(e.target.value)}
                  className="w-24 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleSetTokenSellSpread}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Set
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-purple-300">Set DEX Router</h3>
              <p className="text-sm text-gray-400 mb-3">
                Sets the DEX router used for migration.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Router address"
                  value={routerAddress}
                  onChange={(e) => setRouterAddress(e.target.value)}
                  className="flex-1 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleSetDexRouter}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Set
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-blue-300">Recover Sell Spread Liquidity</h3>
              <p className="text-sm text-gray-400 mb-3">
                Pulls excess (sell-spread) native from token contract to treasury.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Token address"
                  value={recoverSpreadToken}
                  onChange={(e) => setRecoverSpreadToken(e.target.value)}
                  className="flex-1 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleRecoverSellSpreadLiquidity}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Recover
                </Button>
              </div>
            </div>

            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-green-300">Complete Token Launch</h3>
              <p className="text-sm text-gray-400 mb-3">
                Marks token as completed and runs DEX migration (wrap, add liquidity, enable transfer fee).
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Token address"
                  value={completeLaunchToken}
                  onChange={(e) => setCompleteLaunchToken(e.target.value)}
                  className="flex-1 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleCompleteTokenLaunch}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Complete
                </Button>
              </div>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-red-300">Emergency Withdraw Tokens</h3>
              <p className="text-sm text-gray-400 mb-3">
                Refunds all users&apos; native contributions for a token. Holders keep tokens but can&apos;t redeem again.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Token address"
                  value={emergencyToken}
                  onChange={(e) => setEmergencyToken(e.target.value)}
                  className="flex-1 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleEmergencyWithdraw}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Withdraw
                </Button>
              </div>
            </div>

            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-orange-300">Transfer Ownership</h3>
              <p className="text-sm text-gray-400 mb-3">
                Sets a new owner (must be non-zero). This is irreversible - double check the address.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="New owner address"
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  className="flex-1 text-sm bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleTransferOwnership}
                  disabled={isLoading}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Transfer
                </Button>
              </div>
            </div>

            {adminMessage && (
              <div className="p-4 rounded-lg bg-gray-800 border border-gray-600 text-gray-200">
                {adminMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-500/50 bg-card mb-12">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-gray-400">Irreversible actions that affect the entire platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-yellow-300">Delete Invalid Tokens</h3>
              <p className="text-sm text-gray-400 mb-4">
                Scan for and delete tokens with invalid contract addresses (e.g., symbol saved as address). Only removes broken entries.
              </p>
              <Button variant="outline" onClick={handleDeleteInvalidTokens} disabled={isDeletingInvalid} className="border-yellow-500 text-yellow-300 hover:bg-yellow-500/20">
                {isDeletingInvalid ? "Scanning..." : "Delete Invalid Tokens"}
              </Button>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-red-300">Delete All Tokens</h3>
              <p className="text-sm text-gray-400 mb-4">
                This will permanently delete all meme tokens from the database. This action cannot be undone.
              </p>
              <Button variant="destructive" onClick={handleDeleteAllTokens} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
                {isDeleting ? "Deleting..." : "Delete All Tokens"}
              </Button>
            </div>

            {message && (
              <div className="p-4 rounded-lg bg-gray-800 border border-gray-600 text-gray-200">
                {message}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
