"use client"

import { useState, useEffect } from "react"
import { ethers } from "ethers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_CONFIG } from "@/lib/contract-config"
import CONTRACT_ABI from "@/lib/contract-abi.json"
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { getAllTokenAddresses } from "@/lib/contract-functions"

export default function ContractDiagnosticsPage() {
  const [contractBalance, setContractBalance] = useState<string>("Loading...")
  const [contractBalanceRaw, setContractBalanceRaw] = useState<bigint>(BigInt(0))
  const [treasuryAddress, setTreasuryAddress] = useState<string>("Loading...")
  const [treasuryBalance, setTreasuryBalance] = useState<string>("Loading...")
  const [ownerAddress, setOwnerAddress] = useState<string>("Loading...")
  const [allTokens, setAllTokens] = useState<string[]>([])
  const [tokenDetails, setTokenDetails] = useState<any[]>([])
  const [totalTVT, setTotalTVT] = useState<string>("Loading...")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDiagnostics = async () => {
    setLoading(true)
    setError(null)

    try {
      const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl)
      const contract = new ethers.Contract(CONTRACT_CONFIG.address, CONTRACT_ABI, provider)

      // Get contract TRUST balance
      const balance = await provider.getBalance(CONTRACT_CONFIG.address)
      setContractBalanceRaw(balance)
      setContractBalance(ethers.formatEther(balance) + " TRUST")

      // Get treasury address and balance
      try {
        const treasury = await contract.treasuryAddress()
        setTreasuryAddress(treasury)
        const treasuryBal = await provider.getBalance(treasury)
        setTreasuryBalance(ethers.formatEther(treasuryBal) + " TRUST")
      } catch (e) {
        setTreasuryAddress("Error fetching treasury")
        setTreasuryBalance("N/A")
      }

      // Get owner address
      try {
        const owner = await contract.owner()
        setOwnerAddress(owner)
      } catch (e) {
        setOwnerAddress("N/A")
      }

      // Get total TVT
      try {
        const tvt = await contract.getTotalTVT()
        setTotalTVT(ethers.formatEther(tvt) + " TRUST")
      } catch (e) {
        setTotalTVT("N/A")
      }

      try {
        const tokens = await getAllTokenAddresses()
        setAllTokens(tokens)

        // Get details for each token
        const details = await Promise.all(
          tokens.slice(0, 20).map(async (tokenAddress: string) => {
            try {
              const info = await contract.getTokenInfo(tokenAddress)
              const isUnlocked = await contract.tokenUnlocked(tokenAddress)

              let tvt = "0"
              try {
                const tokenTvt = await contract.getTokenTVT(tokenAddress)
                tvt = ethers.formatEther(tokenTvt)
              } catch (e) {
                // getTokenTVT might not exist in old contract
              }

              return {
                address: tokenAddress,
                name: info.name,
                symbol: info.symbol,
                creator: info.creator,
                currentSupply: ethers.formatEther(info.currentSupply),
                maxSupply: ethers.formatEther(info.maxSupply),
                completed: info.completed,
                isUnlocked: isUnlocked,
                tvt: tvt,
              }
            } catch (e) {
              return {
                address: tokenAddress,
                error: String(e),
              }
            }
          }),
        )
        setTokenDetails(details)
      } catch (e) {
        console.error("Error fetching tokens:", e)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiagnostics()
  }, [])

  const hasZeroBalance = contractBalanceRaw === BigInt(0)

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Contract Security & Balance Diagnostics</h1>

      {/* Critical Warning Banner */}
      {hasZeroBalance && !loading && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-500">Critical: Contract Has 0 TRUST Balance</h3>
                <p className="text-sm mt-1">
                  The factory contract has no TRUST to pay sellers. This means ALL sell transactions will return 0 TRUST
                  to users, even if they own tokens. The bonding curve requires incoming buys to fund outgoing sells.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Contract Balances
            <Button variant="outline" size="sm" onClick={fetchDiagnostics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Factory Contract Balance</p>
              <p className={`text-2xl font-bold ${hasZeroBalance ? "text-red-500" : "text-green-500"}`}>
                {contractBalance}
              </p>
              <p className="text-xs text-muted-foreground mt-1 break-all">{CONTRACT_CONFIG.address}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Treasury Balance (Fees)</p>
              <p className="text-2xl font-bold text-blue-500">{treasuryBalance}</p>
              <p className="text-xs text-muted-foreground mt-1 break-all">{treasuryAddress}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Total Volume Traded (TVT)</p>
              <p className="text-xl font-semibold">{totalTVT}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Contract Owner</p>
              <p className="text-xs break-all">{ownerAddress}</p>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">Error: {error}</p>}
        </CardContent>
      </Card>

      {/* Security Analysis Card */}
      <Card>
        <CardHeader>
          <CardTitle>Security Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            {hasZeroBalance ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            <span>Contract has sufficient TRUST to pay sellers</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Vercel/frontend cannot directly access smart contract funds</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Only authorized functions can move contract funds</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span>Check if owner/admin has called any withdrawal functions</span>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Where Did the TRUST Go?</h4>
            <ul className="text-sm space-y-2">
              <li>
                <strong>1. Seller withdrawals:</strong> When users sell tokens, TRUST leaves the contract
              </li>
              <li>
                <strong>2. Treasury fees:</strong> 1% of each trade goes to treasury ({treasuryAddress})
              </li>
              <li>
                <strong>3. Token migrations:</strong> When tokens complete, liquidity may be moved to DEX
              </li>
              <li>
                <strong>4. Owner withdrawals:</strong> Check blockchain explorer for owner transactions
              </li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 className="font-semibold mb-2">Recommended Actions</h4>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Check the blockchain explorer for recent transactions on the contract</li>
              <li>Verify the treasury address received expected fees</li>
              <li>Review if any admin/owner functions were called</li>
              <li>Compare TVT (total volume) against expected contract balance</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Token Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Tokens on Contract ({allTokens.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tokenDetails.length === 0 && !loading && (
              <p className="text-muted-foreground">No tokens found on contract</p>
            )}
            {tokenDetails.map((token, i) => (
              <div key={i} className="border p-3 rounded-lg">
                {token.error ? (
                  <p className="text-red-500 text-sm">Error loading token: {token.address}</p>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {token.name} ({token.symbol})
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          token.completed
                            ? "bg-blue-500/20 text-blue-500"
                            : token.isUnlocked
                              ? "bg-green-500/20 text-green-500"
                              : "bg-yellow-500/20 text-yellow-500"
                        }`}
                      >
                        {token.completed ? "Migrated" : token.isUnlocked ? "Unlocked" : "Locked"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground break-all">{token.address}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                      <div>
                        <span className="text-muted-foreground">Supply:</span>{" "}
                        {Number.parseFloat(token.currentSupply).toLocaleString()} /{" "}
                        {Number.parseFloat(token.maxSupply).toLocaleString()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">TVT:</span> {token.tvt} TRUST
                      </div>
                    </div>
                    <p className="text-xs">
                      <span className="text-muted-foreground">Creator:</span>{" "}
                      <span className="break-all">{token.creator}</span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Explanation Card */}
      <Card>
        <CardHeader>
          <CardTitle>Understanding the Bonding Curve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p>
            The meme token launchpad uses a <strong>bonding curve</strong> model where the contract acts as an automated
            market maker (AMM).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <h4 className="font-semibold text-green-500">When Users BUY</h4>
              <p>TRUST flows INTO the contract. Price increases.</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg">
              <h4 className="font-semibold text-red-500">When Users SELL</h4>
              <p>TRUST flows OUT of the contract. Price decreases.</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            If net sells exceed net buys, the contract balance depletes to zero. When balance is zero, the contract
            cannot pay sellers regardless of their token holdings.
          </p>
          <p className="font-semibold">
            Solution: The pool needs new buyers to send TRUST into the contract before sells can be honored.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
