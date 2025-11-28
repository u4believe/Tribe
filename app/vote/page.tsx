"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { isAdmin } from "@/lib/admin-config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  ThumbsUp,
  ThumbsDown,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Timer,
  AlertCircle,
} from "lucide-react"
import {
  getAllProposals,
  createProposal,
  castVote,
  hasUserVoted,
  checkTokenHolding,
  addToWhitelist,
  removeFromWhitelist,
  getProposalWhitelist,
  closeProposal,
  checkProposalValidity,
  type VotingProposal,
  type WhitelistedAddress,
  type ProposalValidityResult,
} from "@/lib/voting"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"

export default function VotePage() {
  const { address, isConnected } = useWallet()
  const [proposals, setProposals] = useState<VotingProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({})
  const [userVotedMap, setUserVotedMap] = useState<Record<string, boolean>>({})
  const [eligibilityMap, setEligibilityMap] = useState<Record<string, boolean>>({})
  const [validityMap, setValidityMap] = useState<Record<string, ProposalValidityResult>>({})
  const [, setTimeUpdate] = useState(0)
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newTokenAddress, setNewTokenAddress] = useState("")
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null)
  const [loadingWhitelist, setLoadingWhitelist] = useState(false)
  const [whitelist, setWhitelist] = useState<WhitelistedAddress[]>([])
  const [whitelistAddress, setWhitelistAddress] = useState("")

  useEffect(() => {
    loadProposals()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUpdate((prev) => prev + 1)
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (address && proposals.length > 0) {
      checkUserVotes()
      checkEligibility()
    }
  }, [address, proposals])

  useEffect(() => {
    if (proposals.length > 0) {
      checkProposalValidities()
    }
  }, [proposals])

  async function loadProposals() {
    setLoading(true)
    const data = await getAllProposals()
    setProposals(data)
    setLoading(false)
  }

  async function checkProposalValidities() {
    const validities: Record<string, ProposalValidityResult> = {}
    for (const proposal of proposals) {
      const timeRemaining = getTimeRemaining(proposal.ends_at)
      const isExpired = timeRemaining.expired || proposal.status === "closed"

      if (isExpired) {
        validities[proposal.id] = await checkProposalValidity(proposal)
      }
    }
    setValidityMap(validities)
  }

  async function checkUserVotes() {
    if (!address) return

    const voteMap: Record<string, boolean> = {}
    for (const proposal of proposals) {
      voteMap[proposal.id] = await hasUserVoted(proposal.id, address)
    }
    setUserVotedMap(voteMap)
  }

  async function checkEligibility() {
    if (!address) return

    const eligibility: Record<string, boolean> = {}
    for (const proposal of proposals) {
      eligibility[proposal.id] = await checkTokenHolding(proposal.token_address, address)
    }
    setEligibilityMap(eligibility)
  }

  async function handleCreateProposal() {
    if (!address || !newTitle || !newDescription || !newTokenAddress) return

    setCreating(true)
    const proposal = await createProposal(newTitle, newDescription, newTokenAddress, address)

    if (proposal) {
      setProposals([proposal, ...proposals])
      setNewTitle("")
      setNewDescription("")
      setNewTokenAddress("")
      setShowCreateForm(false)
    }
    setCreating(false)
  }

  async function handleVote(proposalId: string, vote: "yes" | "no", tokenAddress: string) {
    if (!address) return

    setVotingStates({ ...votingStates, [proposalId]: true })

    const result = await castVote(proposalId, address, vote, tokenAddress)

    if (result.success) {
      await loadProposals()
      setUserVotedMap({ ...userVotedMap, [proposalId]: true })
    } else {
      alert(result.error || "Failed to cast vote")
    }

    setVotingStates({ ...votingStates, [proposalId]: false })
  }

  async function handleLoadWhitelist(proposalId: string) {
    setSelectedProposal(proposalId)
    setLoadingWhitelist(true)
    const data = await getProposalWhitelist(proposalId)
    setWhitelist(data)
    setLoadingWhitelist(false)
  }

  async function handleAddToWhitelist() {
    if (!selectedProposal || !whitelistAddress) return

    const success = await addToWhitelist(selectedProposal, whitelistAddress)
    if (success) {
      await handleLoadWhitelist(selectedProposal)
      setWhitelistAddress("")
    }
  }

  async function handleRemoveFromWhitelist(walletAddress: string) {
    if (!selectedProposal) return

    const success = await removeFromWhitelist(selectedProposal, walletAddress)
    if (success) {
      await handleLoadWhitelist(selectedProposal)
    }
  }

  async function handleCloseProposal(proposalId: string) {
    const success = await closeProposal(proposalId)
    if (success) {
      await loadProposals()
    }
  }

  function formatAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  function getVotePercentage(yesVotes: number, noVotes: number): { yes: number; no: number } {
    const total = yesVotes + noVotes
    if (total === 0) return { yes: 0, no: 0 }
    return {
      yes: Math.round((yesVotes / total) * 100),
      no: Math.round((noVotes / total) * 100),
    }
  }

  function getTimeRemaining(endsAt: string | null): { text: string; expired: boolean } {
    if (!endsAt) return { text: "No end date", expired: false }

    const now = new Date()
    const end = new Date(endsAt)
    const diff = end.getTime() - now.getTime()

    if (diff <= 0) {
      return { text: "Voting ended", expired: true }
    }

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return { text: `${days}d ${remainingHours}h remaining`, expired: false }
    }

    return { text: `${hours}h ${minutes}m remaining`, expired: false }
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />

      <main className="ml-16 pt-28 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Voting</h1>
              <p className="text-sm text-muted-foreground">Vote on community proposals (72-hour voting period)</p>
            </div>

            {isAdmin(address) && (
              <Button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Proposal
              </Button>
            )}
          </div>

          {/* Create Proposal Form (Admin Only) */}
          {showCreateForm && isAdmin(address) && (
            <Card className="mb-6 border-primary/50">
              <CardHeader>
                <CardTitle className="text-lg">Create New Proposal</CardTitle>
                <CardDescription>Voting will automatically end after 72 hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Title</label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Proposal title" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe the proposal in detail..."
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Token Address</label>
                  <Input
                    value={newTokenAddress}
                    onChange={(e) => setNewTokenAddress(e.target.value)}
                    placeholder="0x..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">The meme coin token address for this proposal</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateProposal}
                    disabled={creating || !newTitle || !newDescription || !newTokenAddress}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Proposal"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Whitelist Management Modal (Admin Only) */}
          {selectedProposal && isAdmin(address) && (
            <Card className="mb-6 border-yellow-500/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-yellow-500" />
                  Whitelist Management (20x Voting Power)
                </CardTitle>
                <CardDescription>Add creator addresses to give them 20x voting power</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={whitelistAddress}
                    onChange={(e) => setWhitelistAddress(e.target.value)}
                    placeholder="Creator wallet address (0x...)"
                    className="flex-1"
                  />
                  <Button onClick={handleAddToWhitelist} disabled={!whitelistAddress}>
                    Add
                  </Button>
                </div>

                {loadingWhitelist ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : whitelist.length > 0 ? (
                  <div className="space-y-2">
                    {whitelist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="text-sm font-mono">{formatAddress(item.wallet_address)}</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveFromWhitelist(item.wallet_address)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">No whitelisted addresses yet</p>
                )}

                <Button variant="outline" onClick={() => setSelectedProposal(null)} className="w-full">
                  Close
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Proposals List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : proposals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No proposals yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => {
                const percentages = getVotePercentage(proposal.yes_voting_power, proposal.no_voting_power)
                const isVoting = votingStates[proposal.id]
                const hasVoted = userVotedMap[proposal.id]
                const isEligible = eligibilityMap[proposal.id]
                const isClosed = proposal.status === "closed"
                const timeRemaining = getTimeRemaining(proposal.ends_at)
                const isExpired = timeRemaining.expired || isClosed
                const validity = validityMap[proposal.id]

                return (
                  <Card key={proposal.id} className={isExpired ? "opacity-75" : ""}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <CardTitle className="text-lg">{proposal.title}</CardTitle>
                            <Badge variant={isExpired ? "secondary" : "default"}>
                              {isClosed ? "Closed" : timeRemaining.expired ? "Ended" : "Active"}
                            </Badge>
                            {isExpired && validity && (
                              <Badge
                                variant={validity.isValid ? "default" : "destructive"}
                                className={validity.isValid ? "bg-green-600 hover:bg-green-700" : ""}
                              >
                                {validity.isValid ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Valid
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Invalid
                                  </>
                                )}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">
                            Token: {formatAddress(proposal.token_address)}
                          </CardDescription>
                        </div>

                        {isAdmin(address) && !isExpired && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleLoadWhitelist(proposal.id)}>
                              <Shield className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleCloseProposal(proposal.id)}>
                              Close
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-foreground">{proposal.description}</p>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1 text-green-500">
                            <ThumbsUp className="w-4 h-4" />
                            Yes: {proposal.yes_voting_power} ({percentages.yes}%)
                          </span>
                          <span className="flex items-center gap-1 text-red-500">
                            No: {proposal.no_voting_power} ({percentages.no}%)
                            <ThumbsDown className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                          <div
                            className="bg-green-500 transition-all duration-300"
                            style={{ width: `${percentages.yes}%` }}
                          />
                          <div
                            className="bg-red-500 transition-all duration-300"
                            style={{ width: `${percentages.no}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {proposal.yes_voting_power + proposal.no_voting_power} voting power (
                              {proposal.yes_votes + proposal.no_votes} voters)
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(proposal.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <span
                            className={`flex items-center gap-1 ${timeRemaining.expired ? "text-red-500" : "text-primary"}`}
                          >
                            <Timer className="w-4 h-4" />
                            {timeRemaining.text}
                          </span>
                        </div>
                      </div>

                      {isExpired && validity && !validity.isValid && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <p className="text-sm font-medium text-red-500 mb-1">Proposal Invalid:</p>
                          <ul className="text-xs text-red-400 list-disc list-inside space-y-0.5">
                            {validity.reasons.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {isExpired && validity && validity.isValid && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <p className="text-sm font-medium text-green-500 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Proposal Valid
                          </p>
                          <p className="text-xs text-green-400 mt-1">
                            {validity.totalVoters} voters • {validity.winningPercentage.toFixed(1)}% majority
                          </p>
                        </div>
                      )}

                      {!isExpired && isConnected && (
                        <div className="space-y-2">
                          {hasVoted ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              You have already voted on this proposal
                            </div>
                          ) : !isEligible ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <XCircle className="w-4 h-4 text-red-500" />
                              You need at least 100,000 tokens to vote
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleVote(proposal.id, "yes", proposal.token_address)}
                                disabled={isVoting}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                {isVoting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <ThumbsUp className="w-4 h-4 mr-2" />
                                    Vote Yes
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => handleVote(proposal.id, "no", proposal.token_address)}
                                disabled={isVoting}
                                className="flex-1 bg-red-600 hover:bg-red-700"
                              >
                                {isVoting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <ThumbsDown className="w-4 h-4 mr-2" />
                                    Vote No
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {!isConnected && !isExpired && (
                        <p className="text-sm text-muted-foreground text-center">Connect wallet to vote</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
