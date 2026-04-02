import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { nostrClient } from '../../nostr/client'
import { buildReactionEvent } from '../../nostr/events'
import { KINDS } from '../../nostr/kinds'

interface ReactionBarProps {
  eventId: string
  authorPubkey: string
  className?: string
}

interface ReactionCount {
  emoji: string
  count: number
  reacted: boolean // Whether current user has reacted with this emoji
}

const QUICK_EMOJIS = ['🥾', '👟', '🔥', '❤️', '👏']

export function ReactionBar({ eventId, authorPubkey, className = '' }: ReactionBarProps) {
  const { pubkey, getSigner } = useAuthStore()
  const [reactions, setReactions] = useState<ReactionCount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Load existing reactions
  useEffect(() => {
    loadReactions()
  }, [eventId])

  const loadReactions = async () => {
    try {
      // Query for reaction events (kind 7) that reference this event
      const reactionEvents = await nostrClient.query([
        {
          kinds: [KINDS.REACTION],
          '#e': [eventId],
          limit: 100
        }
      ])

      // Group reactions by emoji
      const reactionMap = new Map<string, { count: number; reacted: boolean }>()
      
      for (const event of reactionEvents) {
        const emoji = event.content
        if (!emoji) continue

        const existing = reactionMap.get(emoji) || { count: 0, reacted: false }
        existing.count++
        
        // Check if current user reacted with this emoji
        if (event.pubkey === pubkey) {
          existing.reacted = true
        }
        
        reactionMap.set(emoji, existing)
      }

      // Convert to array and sort by count
      const reactionCounts: ReactionCount[] = Array.from(reactionMap.entries())
        .map(([emoji, data]) => ({
          emoji,
          count: data.count,
          reacted: data.reacted
        }))
        .sort((a, b) => b.count - a.count)

      setReactions(reactionCounts)
    } catch (error) {
      console.error('Failed to load reactions:', error)
    }
  }

  const addReaction = async (emoji: string) => {
    const signer = getSigner()
    if (!pubkey || !signer) {
      return
    }

    try {
      setIsLoading(true)

      // Check if user already reacted with this emoji
      const existingReaction = reactions.find(r => r.emoji === emoji && r.reacted)
      if (existingReaction) {
        // TODO: Remove reaction (would need to store event IDs and delete)
        // For now, just return early
        return
      }

      // Create reaction event
      const reactionEvent = buildReactionEvent(
        eventId,
        authorPubkey,
        emoji,
        pubkey
      )

      // Sign and publish
      const signedEvent = await signer.signEvent(reactionEvent)
      await nostrClient.publish(signedEvent)

      // Update local state optimistically
      setReactions(prev => {
        const updated = [...prev]
        const existingIndex = updated.findIndex(r => r.emoji === emoji)
        
        if (existingIndex >= 0) {
          // Increment existing emoji count
          updated[existingIndex] = {
            ...updated[existingIndex],
            count: updated[existingIndex].count + 1,
            reacted: true
          }
        } else {
          // Add new emoji
          updated.push({
            emoji,
            count: 1,
            reacted: true
          })
        }
        
        // Sort by count
        return updated.sort((a, b) => b.count - a.count)
      })

      setShowEmojiPicker(false)
    } catch (error) {
      console.error('Failed to add reaction:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!pubkey) {
    // Show read-only reactions for non-authenticated users
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {reactions.map(reaction => (
          <span
            key={reaction.emoji}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-sm"
          >
            <span>{reaction.emoji}</span>
            <span className="text-gray-600 dark:text-gray-400">{reaction.count}</span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Existing reactions */}
      {reactions.map(reaction => (
        <button
          key={reaction.emoji}
          onClick={() => addReaction(reaction.emoji)}
          disabled={isLoading}
          className={`
            flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors
            ${reaction.reacted
              ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
            disabled:opacity-50
          `}
        >
          <span>{reaction.emoji}</span>
          <span className={`${reaction.reacted ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {reaction.count}
          </span>
        </button>
      ))}

      {/* Quick reaction buttons */}
      {QUICK_EMOJIS.map(emoji => {
        const existing = reactions.find(r => r.emoji === emoji)
        if (existing) return null // Already shown above
        
        return (
          <button
            key={emoji}
            onClick={() => addReaction(emoji)}
            disabled={isLoading}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            title={`React with ${emoji}`}
          >
            <span className="text-lg">{emoji}</span>
          </button>
        )
      })}

      {/* Add custom emoji button */}
      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={isLoading}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          title="More reactions"
        >
          <Plus className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Simple emoji picker */}
        {showEmojiPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
            <div className="grid grid-cols-6 gap-1">
              {['😀', '😂', '🤩', '😍', '🤯', '😱', '💪', '👍', '👎', '🙌', '👌', '✊', '🚀', '💯', '⭐', '💝', '🎉', '🎊'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => addReaction(emoji)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}