import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Event } from 'nostr-tools'
import { KINDS } from '../nostr/kinds'

export interface Notification {
  id: string
  type: 'reaction' | 'comment' | 'follow' | 'zap' | 'mention'
  fromPubkey: string
  fromProfile?: {
    name?: string
    displayName?: string
    picture?: string
  }
  targetEventId: string
  targetEventKind: number
  content: string
  amount?: number // For zaps
  createdAt: number
  isRead: boolean
  rawEvent: Event
}

export interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  lastChecked: number
  subscriptionId?: string

  // Actions
  fetchNotifications: (pubkey: string) => Promise<void>
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  subscribe: (pubkey: string) => void
  unsubscribe: () => void
  addNotification: (notification: Notification) => void
  updateProfile: (pubkey: string, profile: any) => void
  fetchProfiles: (pubkeys: string[]) => Promise<void>
}

// Parse notification from nostr event
function parseNotificationEvent(event: Event, userPubkey: string): Notification | null {
  try {
    let type: Notification['type']
    let targetEventId = ''
    let targetEventKind = 0
    let content = event.content
    let amount: number | undefined

    // Determine notification type and extract target
    switch (event.kind) {
      case KINDS.REACTION:
        type = 'reaction'
        // Find target event from e tags
        for (const tag of event.tags) {
          if (tag[0] === 'e' && tag[1]) {
            targetEventId = tag[1]
            break
          }
        }
        break

      case KINDS.TEXT_NOTE:
        // Check if it's a comment/reply or mention
        const isPTagged = event.tags.some(tag => tag[0] === 'p' && tag[1] === userPubkey)
        if (isPTagged) {
          // Check if it's a reply to our event
          const isReply = event.tags.some(tag => tag[0] === 'e')
          type = isReply ? 'comment' : 'mention'
          
          // Find target event for replies
          if (type === 'comment') {
            for (const tag of event.tags) {
              if (tag[0] === 'e' && tag[1]) {
                targetEventId = tag[1]
                break
              }
            }
          }
        } else {
          return null // Not a notification for this user
        }
        break

      case KINDS.CONTACT_LIST:
        type = 'follow'
        // Check if user is in the follow list
        const isFollowed = event.tags.some(tag => tag[0] === 'p' && tag[1] === userPubkey)
        if (!isFollowed) return null
        content = 'started following you'
        break

      case KINDS.ZAP_RECEIPT:
        type = 'zap'
        // Parse zap request for amount and target
        try {
          const zapRequest = JSON.parse(event.content)
          amount = zapRequest.amount ? Math.floor(zapRequest.amount / 1000) : undefined // Convert to sats
        } catch {
          // Fallback parsing
        }
        
        for (const tag of event.tags) {
          if (tag[0] === 'e' && tag[1]) {
            targetEventId = tag[1]
            break
          }
        }
        break

      default:
        return null
    }

    const notification: Notification = {
      id: event.id,
      type,
      fromPubkey: event.pubkey,
      targetEventId,
      targetEventKind,
      content,
      amount,
      createdAt: event.created_at,
      isRead: false,
      rawEvent: event
    }

    return notification
  } catch (error) {
    console.error('Failed to parse notification event:', error)
    return null
  }
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      lastChecked: 0,

      fetchNotifications: async (pubkey: string) => {
        set({ isLoading: true })
        
        try {
          const { nostrClient } = await import('../nostr/client')
          
          // Query for events that mention the user
          const events = await nostrClient.query([
            {
              kinds: [KINDS.REACTION, KINDS.TEXT_NOTE, KINDS.CONTACT_LIST, KINDS.ZAP_RECEIPT],
              '#p': [pubkey],
              limit: 100,
              since: get().lastChecked || Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60) // Last week
            }
          ], 10000)

          // Parse notifications
          const notifications = events
            .map(event => parseNotificationEvent(event, pubkey))
            .filter(Boolean) as Notification[]

          // Sort by creation time (newest first)
          notifications.sort((a, b) => b.createdAt - a.createdAt)

          // Remove duplicates (keep most recent)
          const uniqueNotifications = notifications.filter((notif, index, arr) => 
            arr.findIndex(n => n.fromPubkey === notif.fromPubkey && 
                              n.type === notif.type && 
                              n.targetEventId === notif.targetEventId) === index
          )

          // Calculate unread count
          const unreadCount = uniqueNotifications.filter(n => !n.isRead).length

          set({
            notifications: uniqueNotifications,
            unreadCount,
            isLoading: false,
            lastChecked: Math.floor(Date.now() / 1000)
          })

          // Fetch profiles for notification authors
          const uniquePubkeys = [...new Set(notifications.map(n => n.fromPubkey))]
          get().fetchProfiles(uniquePubkeys)

        } catch (error) {
          console.error('Failed to fetch notifications:', error)
          set({ isLoading: false })
        }
      },

      markAsRead: (notificationId: string) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1)
        }))
      },

      markAllAsRead: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true })),
          unreadCount: 0
        }))
      },

      subscribe: (pubkey: string) => {
        get().unsubscribe() // Clean up any existing subscription
        
        const subscribeToNotifications = async () => {
          try {
            const { nostrClient } = await import('../nostr/client')
            
            // Subscribe to real-time notifications
            const subscriptionId = await nostrClient.subscribe([
              {
                kinds: [KINDS.REACTION, KINDS.TEXT_NOTE, KINDS.CONTACT_LIST, KINDS.ZAP_RECEIPT],
                '#p': [pubkey],
                since: Math.floor(Date.now() / 1000)
              }
            ], (event) => {
              // Handle new notification
              const notification = parseNotificationEvent(event, pubkey)
              if (notification) {
                get().addNotification(notification)
              }
            })

            set({ subscriptionId })
          } catch (error) {
            console.error('Failed to subscribe to notifications:', error)
          }
        }

        subscribeToNotifications()
      },

      unsubscribe: () => {
        const { subscriptionId } = get()
        if (subscriptionId) {
          const unsubscribe = async () => {
            try {
              const { nostrClient } = await import('../nostr/client')
              await nostrClient.unsubscribe(subscriptionId)
              set({ subscriptionId: undefined })
            } catch (error) {
              console.error('Failed to unsubscribe from notifications:', error)
            }
          }
          unsubscribe()
        }
      },

      addNotification: (notification: Notification) => {
        set(state => {
          // Check for duplicates
          const exists = state.notifications.some(n => 
            n.id === notification.id ||
            (n.fromPubkey === notification.fromPubkey && 
             n.type === notification.type && 
             n.targetEventId === notification.targetEventId)
          )

          if (exists) return state

          return {
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1
          }
        })

        // Fetch profile for the notification author
        get().fetchProfiles([notification.fromPubkey])
      },

      updateProfile: (pubkey: string, profile: any) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.fromPubkey === pubkey 
              ? { ...n, fromProfile: profile }
              : n
          )
        }))
      },

      // Helper method to fetch profiles (not in the main interface)
      fetchProfiles: async (pubkeys: string[]) => {
        try {
          const { nostrClient } = await import('../nostr/client')
          
          const profileEvents = await nostrClient.query([
            {
              kinds: [KINDS.SET_METADATA],
              authors: pubkeys,
              limit: pubkeys.length
            }
          ])

          for (const event of profileEvents) {
            try {
              const metadata = JSON.parse(event.content)
              get().updateProfile(event.pubkey, {
                name: metadata.name,
                displayName: metadata.display_name,
                picture: metadata.picture
              })
            } catch (error) {
              console.error('Failed to parse profile metadata:', error)
            }
          }
        } catch (error) {
          console.error('Failed to fetch profiles:', error)
        }
      }
    }),
    {
      name: 'trailstr-notifications',
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        lastChecked: state.lastChecked
      })
    }
  )
)