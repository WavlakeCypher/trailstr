import { useState, useEffect, useCallback } from 'react'
import { Send, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { nostrClient } from '../../nostr/client'
import { buildCommentEvent } from '../../nostr/events'
import { KINDS } from '../../nostr/kinds'
import Avatar from '../common/Avatar'
import { type Event } from 'nostr-tools'

interface CommentThreadProps {
  eventId: string
  authorPubkey: string
  className?: string
}

interface Comment {
  id: string
  pubkey: string
  content: string
  createdAt: number
  replyTo: string | null // parent comment id (null = top-level)
  rootId: string
  profile?: {
    name?: string
    picture?: string
  }
  replies: Comment[]
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(timestamp * 1000).toLocaleDateString()
}

function CommentItem({
  comment,
  eventId,
  authorPubkey,
  depth = 0,
  onReply
}: {
  comment: Comment
  eventId: string
  authorPubkey: string
  depth?: number
  onReply: (parentId: string, content: string) => Promise<void>
}) {
  const { pubkey } = useAuthStore()
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [collapsed, setCollapsed] = useState(depth >= 3)

  const handleReply = async () => {
    if (!replyText.trim()) return
    setIsSubmitting(true)
    try {
      await onReply(comment.id, replyText.trim())
      setReplyText('')
      setShowReplyInput(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const maxDepthIndent = Math.min(depth, 4)

  return (
    <div className={`${maxDepthIndent > 0 ? 'ml-6 pl-3 border-l-2 border-stone-700/50' : ''}`}>
      <div className="flex items-start space-x-3 py-3">
        <Avatar
          src={comment.profile?.picture}
          alt={comment.profile?.name}
          fallback={comment.profile?.name}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-white">
              {comment.profile?.name || comment.pubkey.slice(0, 8) + '...'}
            </span>
            <span className="text-xs text-stone-400">
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-stone-300 mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
          <div className="flex items-center space-x-3 mt-1">
            {pubkey && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-xs text-stone-400 hover:text-emerald-400 transition-colors"
              >
                Reply
              </button>
            )}
            {comment.replies.length > 0 && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center space-x-1 text-xs text-stone-400 hover:text-stone-300 transition-colors"
              >
                {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                <span>{comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</span>
              </button>
            )}
          </div>

          {/* Reply input */}
          {showReplyInput && (
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                placeholder="Write a reply..."
                className="flex-1 text-sm px-3 py-1.5 rounded-xl border border-stone-600 bg-stone-800 text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={isSubmitting}
              />
              <button
                onClick={handleReply}
                disabled={isSubmitting || !replyText.trim()}
                className="p-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {!collapsed && comment.replies.map(reply => (
        <CommentItem
          key={reply.id}
          comment={reply}
          eventId={eventId}
          authorPubkey={authorPubkey}
          depth={depth + 1}
          onReply={onReply}
        />
      ))}
    </div>
  )
}

export function CommentThread({ eventId, authorPubkey, className = '' }: CommentThreadProps) {
  const { pubkey, getSigner } = useAuthStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [profileCache, setProfileCache] = useState<Map<string, { name?: string; picture?: string }>>(new Map())

  const fetchProfiles = useCallback(async (pubkeys: string[]) => {
    const uncached = pubkeys.filter(pk => !profileCache.has(pk))
    if (uncached.length === 0) return

    try {
      const profileEvents = await nostrClient.query([
        { kinds: [KINDS.SET_METADATA], authors: uncached, limit: uncached.length }
      ])

      const newCache = new Map(profileCache)
      for (const event of profileEvents) {
        try {
          const meta = JSON.parse(event.content)
          newCache.set(event.pubkey, {
            name: meta.display_name || meta.name,
            picture: meta.picture
          })
        } catch { /* ignore */ }
      }
      setProfileCache(newCache)
    } catch (error) {
      console.error('Failed to fetch profiles:', error)
    }
  }, [profileCache])

  const buildTree = useCallback((events: Event[]): Comment[] => {
    const commentMap = new Map<string, Comment>()

    // Create flat comment objects
    for (const event of events) {
      let replyTo: string | null = null
      let rootId = eventId

      for (const tag of event.tags) {
        if (tag[0] === 'e') {
          if (tag[3] === 'reply') replyTo = tag[1]
          else if (tag[3] === 'root') rootId = tag[1]
          else if (!replyTo && tag[1] !== eventId) replyTo = tag[1]
        }
      }

      commentMap.set(event.id, {
        id: event.id,
        pubkey: event.pubkey,
        content: event.content,
        createdAt: event.created_at,
        replyTo,
        rootId,
        profile: profileCache.get(event.pubkey),
        replies: []
      })
    }

    // Build tree
    const topLevel: Comment[] = []
    for (const comment of commentMap.values()) {
      if (comment.replyTo && commentMap.has(comment.replyTo)) {
        commentMap.get(comment.replyTo)!.replies.push(comment)
      } else {
        topLevel.push(comment)
      }
    }

    // Sort: top-level oldest first, replies oldest first
    const sortByTime = (a: Comment, b: Comment) => a.createdAt - b.createdAt
    topLevel.sort(sortByTime)
    const sortReplies = (comments: Comment[]) => {
      for (const c of comments) {
        c.replies.sort(sortByTime)
        sortReplies(c.replies)
      }
    }
    sortReplies(topLevel)

    return topLevel
  }, [eventId, profileCache])

  useEffect(() => {
    loadComments()
  }, [eventId])

  const loadComments = async () => {
    setIsLoading(true)
    try {
      const commentEvents = await nostrClient.query([
        {
          kinds: [KINDS.TEXT_NOTE],
          '#e': [eventId],
          limit: 200
        }
      ])

      // Fetch profiles for commenters
      const pubkeys = [...new Set(commentEvents.map(e => e.pubkey))]
      await fetchProfiles(pubkeys)

      setComments(buildTree(commentEvents))
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Rebuild tree when profile cache updates
  useEffect(() => {
    if (comments.length > 0) {
      // We need to re-apply profiles; simplest: reload from stored events won't work
      // Instead update profiles in existing tree
      const updateProfiles = (comments: Comment[]): Comment[] =>
        comments.map(c => ({
          ...c,
          profile: profileCache.get(c.pubkey) || c.profile,
          replies: updateProfiles(c.replies)
        }))
      setComments(prev => updateProfiles(prev))
    }
  }, [profileCache])

  const postComment = async (parentId: string | null, content: string) => {
    const signer = getSigner()
    if (!pubkey || !signer) return

    const replyToId = parentId || eventId
    const rootId = eventId

    const commentEvent = buildCommentEvent(
      content,
      replyToId,
      authorPubkey,
      pubkey,
      undefined,
      parentId ? rootId : undefined
    )

    const signedEvent = await signer.signEvent(commentEvent)
    await nostrClient.publish(signedEvent)

    // Optimistic update
    const newComment: Comment = {
      id: signedEvent.id,
      pubkey,
      content,
      createdAt: signedEvent.created_at,
      replyTo: parentId,
      rootId,
      profile: profileCache.get(pubkey),
      replies: []
    }

    if (parentId) {
      // Add as nested reply
      const addReply = (comments: Comment[]): Comment[] =>
        comments.map(c => {
          if (c.id === parentId) {
            return { ...c, replies: [...c.replies, newComment] }
          }
          return { ...c, replies: addReply(c.replies) }
        })
      setComments(prev => addReply(prev))
    } else {
      setComments(prev => [...prev, newComment])
    }
  }

  const handlePostTopLevel = async () => {
    if (!newComment.trim()) return
    setIsSubmitting(true)
    try {
      await postComment(null, newComment.trim())
      setNewComment('')
    } catch (error) {
      console.error('Failed to post comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={className}>
      {/* Comment input */}
      {pubkey && (
        <div className="flex items-center space-x-3 mb-4">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePostTopLevel()}
            placeholder="Write a comment..."
            className="flex-1 px-4 py-2 h-12 rounded-xl border border-stone-600 bg-stone-800 text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            disabled={isSubmitting}
          />
          <button
            onClick={handlePostTopLevel}
            disabled={isSubmitting || !newComment.trim()}
            className="p-3 h-12 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      )}

      {/* Comments */}
      {isLoading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto"></div>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-6">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="divide-y divide-stone-700/50">
          {comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              eventId={eventId}
              authorPubkey={authorPubkey}
              onReply={(parentId, content) => postComment(parentId, content)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
