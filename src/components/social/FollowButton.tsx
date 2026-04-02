import { useState, useEffect } from 'react'
import { UserPlus, UserCheck, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { nostrClient } from '../../nostr/client'
import { buildContactListEvent } from '../../nostr/events'
import { KINDS } from '../../nostr/kinds'

interface FollowButtonProps {
  targetPubkey: string
  className?: string
  size?: 'sm' | 'md'
}

export function FollowButton({ targetPubkey, className = '', size = 'md' }: FollowButtonProps) {
  const { pubkey, getSigner } = useAuthStore()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [contactList, setContactList] = useState<string[]>([])
  const [relayContent, setRelayContent] = useState('')

  // Don't show follow button for own profile
  if (pubkey === targetPubkey) return null

  useEffect(() => {
    if (pubkey) loadContactList()
  }, [pubkey])

  const loadContactList = async () => {
    if (!pubkey) return
    try {
      const events = await nostrClient.query([
        { kinds: [KINDS.CONTACT_LIST], authors: [pubkey], limit: 1 }
      ])

      if (events.length > 0) {
        // Sort by created_at to get latest
        const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
        const followed = latest.tags
          .filter(tag => tag[0] === 'p')
          .map(tag => tag[1])
        
        setContactList(followed)
        setRelayContent(latest.content || '')
        setIsFollowing(followed.includes(targetPubkey))
      }
    } catch (error) {
      console.error('Failed to load contact list:', error)
    }
  }

  const toggleFollow = async () => {
    const signer = getSigner()
    if (!pubkey || !signer) return

    setIsLoading(true)
    try {
      let newContactList: string[]

      if (isFollowing) {
        newContactList = contactList.filter(pk => pk !== targetPubkey)
      } else {
        newContactList = [...contactList, targetPubkey]
      }

      // Parse relay list from existing content
      let relayList: Record<string, { read: boolean; write: boolean }> | undefined
      if (relayContent) {
        try {
          relayList = JSON.parse(relayContent)
        } catch { /* ignore */ }
      }

      const event = buildContactListEvent(newContactList, pubkey, relayList)
      const signedEvent = await signer.signEvent(event)
      await nostrClient.publish(signedEvent)

      // Optimistic update
      setContactList(newContactList)
      setIsFollowing(!isFollowing)
    } catch (error) {
      console.error('Failed to toggle follow:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!pubkey) return null

  const sizeClasses = size === 'sm'
    ? 'px-3 py-1 text-xs gap-1'
    : 'px-4 py-1.5 text-sm gap-1.5'

  const iconSize = size === 'sm' ? 14 : 16

  return (
    <button
      onClick={toggleFollow}
      disabled={isLoading}
      className={`
        inline-flex items-center rounded-full font-medium transition-colors
        ${sizeClasses}
        ${isFollowing
          ? 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400'
          : 'bg-forest-500 text-white hover:bg-forest-600'
        }
        disabled:opacity-50
        ${className}
      `}
    >
      {isLoading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : isFollowing ? (
        <UserCheck size={iconSize} />
      ) : (
        <UserPlus size={iconSize} />
      )}
      <span>{isFollowing ? 'Following' : 'Follow'}</span>
    </button>
  )
}
