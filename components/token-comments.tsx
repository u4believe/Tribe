"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useWallet } from "@/hooks/use-wallet"
import { MessageSquare, Send } from "lucide-react"
import { awardCommentPoints } from "@/lib/points-system"
import { createBrowserClient } from "@/lib/supabase/client"

interface Comment {
  commenter: string
  text: string
  timestamp: number
}

interface TokenCommentsProps {
  tokenAddress: string
}

export default function TokenComments({ tokenAddress }: TokenCommentsProps) {
  const { address } = useWallet()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadComments = async () => {
    try {
      setIsLoading(true)
      const supabase = createBrowserClient()

      const { data, error } = await supabase
        .from("token_comments")
        .select("*")
        .eq("token_address", tokenAddress.toLowerCase())
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Failed to load comments from Supabase:", error)
        setComments([])
        return
      }

      const formattedComments: Comment[] = (data || []).map((c: any) => ({
        commenter: c.commenter_address || c.commenter,
        text: c.comment_text || c.text,
        timestamp: new Date(c.created_at).getTime() / 1000,
      }))

      setComments(formattedComments)
    } catch (error) {
      console.error("Failed to load comments:", error)
      setComments([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadComments()
  }, [tokenAddress])

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !address) return

    try {
      setIsSubmitting(true)

      const supabase = createBrowserClient()

      const { error } = await supabase.from("token_comments").insert({
        token_address: tokenAddress.toLowerCase(),
        commenter_address: address,
        comment_text: newComment.trim(),
        created_at: new Date().toISOString(),
      })

      if (error) {
        throw new Error(error.message)
      }

      await awardCommentPoints(address)
      setNewComment("")
      // Reload comments after submission
      await loadComments()
    } catch (error: any) {
      console.error("Failed to submit comment:", error)
      alert(error.message || "Failed to submit comment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-xl font-bold text-foreground">Comments</h2>
        <span className="text-sm text-muted-foreground">({comments.length})</span>
      </div>

      {/* Comment Input */}
      {address ? (
        <div className="mb-6">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts about this token..."
            className="mb-3 min-h-[100px] resize-none"
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{newComment.length}/500</span>
            <Button onClick={handleSubmitComment} disabled={!newComment.trim() || isSubmitting} className="gap-2">
              <Send className="w-4 h-4" />
              {isSubmitting ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">Connect your wallet to post a comment</p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment, index) => (
            <div key={index} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-primary">{formatAddress(comment.commenter)}</span>
                <span className="text-xs text-muted-foreground">{formatTimestamp(comment.timestamp)}</span>
              </div>
              <p className="text-foreground whitespace-pre-wrap break-words">{comment.text}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
