"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { deleteAllTokens } from "@/lib/tokens"
import { Trash2, ShieldX, Download, RefreshCw, Settings } from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import { isAdmin } from "@/lib/admin-config"
import { importTokensFromContract } from "@/lib/contract-import"
import {
  setTokenBuySpread,
  setTokenSellSpread,
  emergencyWithdraw,
  setDexRouter,
  getTokenInfo,
} from "@/lib/contract-functions"

export default function AdminPage() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState("")
  const [message, setMessage] = useState("")
  const { address } = useWallet()
  const userIsAdmin = isAdmin(address)

  // Form states for admin functions
  const [tokenAddress, setTokenAddress] = useState("")
  const [spreadPercent, setSpreadPercent] = useState("")
  const [routerAddress, setRouterAddress] = useState("")
  const [adminMessage, setAdminMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  if (!address) {
    return (
      <div className="container mx-auto p-8">
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
      <div className="container mx-auto p-8">
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

  const handleSetBuySpread = async () => {
    if (!tokenAddress || !spreadPercent) {
      setAdminMessage("❌ Please enter token address and spread percent")
      return
    }
    setIsLoading(true)
    try {
      await setTokenBuySpread(tokenAddress, Number.parseInt(spreadPercent))
      setAdminMessage("✅ Buy spread set successfully!")
      setTokenAddress("")
      setSpreadPercent("")
    } catch (error) {
      setAdminMessage(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetSellSpread = async () => {
    if (!tokenAddress || !spreadPercent) {
      setAdminMessage("❌ Please enter token address and spread percent")
      return
    }
    setIsLoading(true)
    try {
      await setTokenSellSpread(tokenAddress, Number.parseInt(spreadPercent))
      setAdminMessage("✅ Sell spread set successfully!")
      setTokenAddress("")
      setSpreadPercent("")
    } catch (error) {
      setAdminMessage(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmergencyWithdraw = async () => {
    if (!tokenAddress) {
      setAdminMessage("❌ Please enter token address")
      return
    }
    setIsLoading(true)
    try {
      await emergencyWithdraw(tokenAddress)
      setAdminMessage("✅ Emergency withdrawal successful!")
      setTokenAddress("")
    } catch (error) {
      setAdminMessage(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetDexRouter = async () => {
    if (!routerAddress) {
      setAdminMessage("❌ Please enter router address")
      return
    }
    setIsLoading(true)
    try {
      await setDexRouter(routerAddress)
      setAdminMessage("✅ DEX router set successfully!")
      setRouterAddress("")
    } catch (error) {
      setAdminMessage(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGetTokenInfo = async () => {
    if (!tokenAddress) {
      setAdminMessage("❌ Please enter token address")
      return
    }
    setIsLoading(true)
    try {
      const info = await getTokenInfo(tokenAddress)
      setAdminMessage(`✅ Token Info: Created by ${info.creator}, Completed: ${info.completed}`)
    } catch (error) {
      setAdminMessage(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`)
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
        setImportMessage(`✅ Successfully imported ${result.imported} token(s). ${result.skipped} already existed.`)
        // Refresh page after 2 seconds
        setTimeout(() => {
          window.location.href = "/?t=" + Date.now()
        }, 2000)
      } else {
        setImportMessage(`❌ Failed to import tokens: ${result.error}`)
      }
    } catch (error) {
      console.error("Error importing tokens:", error)
      setImportMessage("❌ Error occurred while importing tokens")
    } finally {
      setIsImporting(false)
    }
  }

  const handleDeleteAllTokens = async () => {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL tokens from the database. Are you sure?")) {
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
        setMessage("✅ All tokens have been deleted successfully. Redirecting to homepage...")
        // Clear localStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem("walletConnected")
        }
        // Reload page after 1 second with cache bypass
        setTimeout(() => {
          window.location.href = "/?t=" + Date.now()
        }, 1000)
      } else {
        setMessage("❌ Failed to delete tokens. Check console for errors.")
      }
    } catch (error) {
      console.error("Error deleting tokens:", error)
      setMessage("❌ Error occurred while deleting tokens")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

        <Card className="mb-6 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-600 flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import Tokens
            </CardTitle>
            <CardDescription>Import tokens from the blockchain contract</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold mb-2">Import from Contract</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will fetch all tokens from the contract at 0xD9E849B6d44946B0D0FAEafe34b92C79c68cCbeF and add them
                to the database. Existing tokens will be skipped.
              </p>
              <Button onClick={handleImportTokens} disabled={isImporting} className="bg-blue-600 hover:bg-blue-700">
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
              <div
                className={`p-4 rounded-lg ${
                  importMessage.includes("✅")
                    ? "bg-green-50 text-green-800"
                    : importMessage.includes("❌")
                      ? "bg-red-50 text-red-800"
                      : "bg-blue-50 text-blue-800"
                }`}
              >
                {importMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 border-purple-200">
          <CardHeader>
            <CardTitle className="text-purple-600 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Admin Settings
            </CardTitle>
            <CardDescription>Configure contract parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold mb-2">Set Token Buy Spread</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  placeholder="Token address"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Input
                  type="number"
                  placeholder="Spread %"
                  value={spreadPercent}
                  onChange={(e) => setSpreadPercent(e.target.value)}
                  className="w-24 text-sm"
                />
                <Button
                  onClick={handleSetBuySpread}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Set
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold mb-2">Set Token Sell Spread</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  placeholder="Token address"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Input
                  type="number"
                  placeholder="Spread %"
                  value={spreadPercent}
                  onChange={(e) => setSpreadPercent(e.target.value)}
                  className="w-24 text-sm"
                />
                <Button
                  onClick={handleSetSellSpread}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Set
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold mb-2">Emergency Withdrawal</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  placeholder="Token address"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  onClick={handleEmergencyWithdraw}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Withdraw
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold mb-2">Set DEX Router</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  placeholder="Router address"
                  value={routerAddress}
                  onChange={(e) => setRouterAddress(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  onClick={handleSetDexRouter}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Set
                </Button>
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold mb-2">Get Token Info</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  placeholder="Token address"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  onClick={handleGetTokenInfo}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Info
                </Button>
              </div>
            </div>

            {adminMessage && (
              <div
                className={`p-4 rounded-lg ${
                  adminMessage.includes("✅")
                    ? "bg-green-50 text-green-800"
                    : adminMessage.includes("❌")
                      ? "bg-red-50 text-red-800"
                      : "bg-blue-50 text-blue-800"
                }`}
              >
                {adminMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Legacy Contract Functions
            </CardTitle>
            <CardDescription>Deprecated admin functions from previous contract version</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These functions were available in the previous contract and are no longer used. Please use the Admin Settings above instead.
            </p>
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

            {message && (
              <div
                className={`p-4 rounded-lg ${message.includes("✅") ? "bg-green-50 text-green-800" : message.includes("❌") ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}
              >
                {message}
              </div>
            )}

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
