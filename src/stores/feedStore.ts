import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Event } from 'nostr-tools'
import { KINDS } from '../nostr/kinds'
import { useAuthStore } from './authStore'
import { useCacheStore, cacheHelpers } from './cacheStore'

// Simplified Activity interface for feed purposes
interface FeedActivity {
  id: string
  authorPubkey: string
  createdAt: number
  title: string
  type: string
  date: string
  distance?: number
  duration?: number
  elevationGain?: number
  notes: string
  geoTags: string[]
  dTag: string
  
  // Social stats
  reactionCount: number
  commentCount: number
  zapAmount: number
  
  // Media
  photos: string[]
  gpxData?: any
  
  // Raw event for reference
  rawEvent: Event
}

export interface FeedState {
  // Feed data
  activities: FeedActivity[]
  events: Event[] // Raw Nostr events
  isLoading: boolean
  hasMore: boolean
  error: string | null
  
  // Pagination
  until?: number // Timestamp for pagination
  limit: number
  
  // Filter options
  followingOnly: boolean
  activityTypes: string[]
  
  // Actions
  fetchFeed: (refresh?: boolean) => Promise<void>
  loadCachedFeed: () => Promise<void>
  loadMore: () => Promise<void>
  addActivity: (activity: FeedActivity, optimistic?: boolean) => void
  updateActivity: (id: string, updates: Partial<FeedActivity>) => void
  removeActivity: (id: string) => void
  toggleFollowingOnly: () => void
  setActivityTypeFilter: (types: string[]) => void
  clearFeed: () => void
  
  // Real-time updates
  handleNewEvent: (event: Event) => void
}

// Parse a kind-30531 event into an Activity
function parseActivityEvent(event: Event): FeedActivity | null {
  try {
    let content: any = {}
    
    if (event.content) {
      try {
        content = JSON.parse(event.content)
      } catch {
        // If content is not JSON, treat as plain text
        content = { notes: event.content }
      }
    }
    
    // Extract data from tags
    const tags: Record<string, string> = {}
    const geoTags: string[] = []
    
    for (const tag of event.tags) {
      if (tag[0] && tag[1]) {
        switch (tag[0]) {
          case 'd':
            tags.d = tag[1] // Identifier tag for parameterized replaceable events
            break
          case 'title':
            tags.title = tag[1]
            break
          case 'type':
            tags.type = tag[1]
            break
          case 'distance':
            tags.distance = tag[1]
            break
          case 'duration':
            tags.duration = tag[1]
            break
          case 'elevation':
            tags.elevation = tag[1]
            break
          case 'date':
            tags.date = tag[1]
            break
          case 'g': // Geohash tags
            geoTags.push(tag[1])
            break
        }
      }
    }
    
    const activity: FeedActivity = {
      id: event.id,
      authorPubkey: event.pubkey,
      createdAt: event.created_at,
      title: tags.title || content.title || 'Untitled Activity',
      type: tags.type || content.type || 'other',
      date: tags.date || content.date || new Date(event.created_at * 1000).toISOString(),
      distance: parseFloat(tags.distance || content.distance) || undefined,
      duration: parseFloat(tags.duration || content.duration) || undefined,
      elevationGain: parseFloat(tags.elevation || content.elevation) || undefined,
      notes: content.notes || content.description || '',
      geoTags,
      dTag: tags.d || `${event.pubkey}:${event.created_at}`,
      
      // Social stats (to be populated later)
      reactionCount: 0,
      commentCount: 0,
      zapAmount: 0,
      
      // Media (to be implemented later)
      photos: content.photos || [],
      gpxData: content.gpx || content.track || undefined,
      
      // Raw event for reference
      rawEvent: event
    }
    
    return activity
  } catch (error) {
    console.error('Failed to parse activity event:', error, event)
    return null
  }
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      // Initial state
      activities: [],
      events: [],
      isLoading: false,
      hasMore: true,
      error: null,
      limit: 20,
      followingOnly: true,
      activityTypes: [],

      // Load cached feed data immediately (for offline-first experience)
      loadCachedFeed: async () => {
        const authStore = useAuthStore.getState()
        if (!authStore.isAuthenticated) return

        try {
          set({ isLoading: true })

          // Get followed pubkeys from contact list (cached if available)
          let authors: string[] = [authStore.pubkey!]
          
          const { followingOnly } = get()
          if (followingOnly) {
            // Try to get cached contact events first
            const { getCachedEvents } = useCacheStore.getState()
            const contactEvents = await getCachedEvents({
              kinds: [KINDS.CONTACT_LIST],
              authors: [authStore.pubkey!],
              limit: 1
            })

            if (contactEvents.length > 0) {
              const contactEvent = contactEvents[0]
              const followedPubkeys = contactEvent.tags
                .filter(tag => tag[0] === 'p')
                .map(tag => tag[1])
              
              authors = [...authors, ...followedPubkeys]
            }
          }

          // Get cached activities
          const cachedEvents = await cacheHelpers.getCachedFeedData(authStore.pubkey!, authors.slice(1))
          
          if (cachedEvents.length > 0) {
            // Parse cached events into activities
            const cachedActivities = cachedEvents
              .map(parseActivityEvent)
              .filter(Boolean) as FeedActivity[]
            
            // Sort by date (newest first)
            cachedActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            set({
              activities: cachedActivities,
              events: cachedEvents,
              isLoading: false
            })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          console.error('Failed to load cached feed:', error)
          set({ isLoading: false })
        }
      },

      // Fetch feed from relays
      fetchFeed: async (refresh = false) => {
        const authStore = useAuthStore.getState()
        if (!authStore.isAuthenticated) {
          set({ error: 'Not authenticated', isLoading: false })
          return
        }

        try {
          set({ 
            isLoading: true, 
            error: null,
            ...(refresh && { activities: [], events: [], until: undefined, hasMore: true })
          })

          const { until, limit, followingOnly } = get()
          
          // Import nostr client dynamically to avoid circular dependencies
          const { useRelayStore } = await import('./relayStore')
          
          // Get relay configuration
          const relayStore = useRelayStore.getState()
          const { NostrClient } = await import('../nostr/client')
          
          const client = new NostrClient({
            readRelays: relayStore.getReadRelays(),
            writeRelays: relayStore.getWriteRelays()
          })

          let authors: string[] = [authStore.pubkey!]

          // If following only, get contact list
          if (followingOnly) {
            try {
              const contactEvents = await client.query({
                kinds: [KINDS.CONTACT_LIST],
                authors: [authStore.pubkey!],
                limit: 1
              }, 3000)

              if (contactEvents.length > 0) {
                const contactEvent = contactEvents[0]
                const followedPubkeys = contactEvent.tags
                  .filter(tag => tag[0] === 'p')
                  .map(tag => tag[1])
                
                authors = [...authors, ...followedPubkeys]
              }
            } catch (error) {
              console.error('Failed to fetch contact list:', error)
              // Continue with just own pubkey
            }
          } else {
            // For global feed, we would need a different approach
            // For now, just use own activities
          }

          // Build filter
          const filter: any = {
            kinds: [KINDS.ACTIVITY],
            authors,
            limit,
          }

          if (until) {
            filter.until = until
          }

          // TODO: Add activity type filtering when we define tag standards
          // if (activityTypes.length > 0) {
          //   filter['#type'] = activityTypes
          // }

          const events = await client.query(filter, 10000)
          
          // Cache the new events for offline access
          if (events.length > 0) {
            await cacheHelpers.cacheEvents(events)
          }
          
          // Parse events into activities
          const newActivities = events
            .map(parseActivityEvent)
            .filter(Boolean) as FeedActivity[]
          
          // Sort by date (newest first)
          newActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

          const { activities: currentActivities } = get()
          const allActivities = refresh 
            ? newActivities 
            : [...currentActivities, ...newActivities]
          
          // Remove duplicates by ID
          const uniqueActivities = allActivities.filter((activity, index, arr) => 
            arr.findIndex(a => a.id === activity.id) === index
          )

          // Determine pagination
          const hasMoreResults = events.length === limit
          const nextUntil = events.length > 0 ? events[events.length - 1].created_at - 1 : undefined

          set({
            activities: uniqueActivities,
            events: [...(refresh ? [] : get().events), ...events],
            until: nextUntil,
            hasMore: hasMoreResults,
            isLoading: false
          })

        } catch (error: any) {
          console.error('Failed to fetch feed:', error)
          set({ 
            error: error.message || 'Failed to fetch activities',
            isLoading: false 
          })
        }
      },

      // Load more activities (pagination)
      loadMore: async () => {
        const { hasMore, isLoading } = get()
        if (!hasMore || isLoading) return
        
        await get().fetchFeed(false)
      },

      // Add new activity (optimistic updates)
      addActivity: (activity: FeedActivity, optimistic = false) => {
        set(state => {
          const newActivities = [activity, ...state.activities]
          return { 
            activities: newActivities,
            ...(optimistic && { isLoading: false })
          }
        })
      },

      // Update existing activity
      updateActivity: (id: string, updates: Partial<FeedActivity>) => {
        set(state => ({
          activities: state.activities.map(activity =>
            activity.id === id ? { ...activity, ...updates } : activity
          )
        }))
      },

      // Remove activity
      removeActivity: (id: string) => {
        set(state => ({
          activities: state.activities.filter(activity => activity.id !== id),
          events: state.events.filter(event => event.id !== id)
        }))
      },

      // Toggle following-only filter
      toggleFollowingOnly: () => {
        set(state => ({ followingOnly: !state.followingOnly }))
        // Refresh feed with new filter
        get().fetchFeed(true)
      },

      // Set activity type filter
      setActivityTypeFilter: (types: string[]) => {
        set({ activityTypes: types })
        // Refresh feed with new filter
        get().fetchFeed(true)
      },

      // Clear all feed data
      clearFeed: () => {
        set({
          activities: [],
          events: [],
          until: undefined,
          hasMore: true,
          error: null
        })
      },

      // Handle real-time event updates
      handleNewEvent: (event: Event) => {
        if (event.kind === KINDS.ACTIVITY) {
          const activity = parseActivityEvent(event)
          if (activity) {
            get().addActivity(activity)
          }
        }
        // TODO: Handle reactions, comments, zaps, etc.
      }
    }),
    {
      name: 'trailstr-feed',
      // Only persist minimal data to avoid storage bloat
      partialize: (state) => ({
        followingOnly: state.followingOnly,
        activityTypes: state.activityTypes,
        limit: state.limit
      })
    }
  )
)