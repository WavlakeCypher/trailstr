import { create } from 'zustand'
import Dexie, { type Table } from 'dexie'
import { type Event } from 'nostr-tools'
import { KINDS } from '../nostr/kinds'

// Dexie database schema
interface CachedEvent {
  id: string
  pubkey: string
  kind: number
  created_at: number
  content: string
  tags: string[][]
  sig: string
  cachedAt: number
}

interface CachedProfile {
  pubkey: string
  data: any
  lastUpdated: number
}

interface CachedRelay {
  url: string
  lastConnected: number
  status: 'connected' | 'disconnected' | 'error'
}

class TrailStrDatabase extends Dexie {
  events!: Table<CachedEvent>
  profiles!: Table<CachedProfile>
  relays!: Table<CachedRelay>

  constructor() {
    super('TrailStrDB')
    this.version(1).stores({
      events: 'id, pubkey, kind, created_at, [pubkey+kind], cachedAt',
      profiles: 'pubkey, lastUpdated',
      relays: 'url, lastConnected, status'
    })
  }
}

export const db = new TrailStrDatabase()

export interface CacheState {
  isReady: boolean
  
  // Event caching
  cacheEvent: (event: Event) => Promise<void>
  getCachedEvents: (filter: {
    kinds?: number[]
    authors?: string[]
    limit?: number
    until?: number
  }) => Promise<Event[]>
  
  // Profile caching
  cacheProfile: (pubkey: string, profile: any) => Promise<void>
  getCachedProfile: (pubkey: string) => Promise<any | null>
  
  // Cleanup and maintenance
  cleanup: () => Promise<void>
  clearCache: () => Promise<void>
  
  // Stats
  getCacheStats: () => Promise<{
    eventCount: number
    profileCount: number
    oldestEvent: number | null
    newestEvent: number | null
  }>
}

export const useCacheStore = create<CacheState>()((_set, _get) => ({
  isReady: false,

  // Cache a nostr event
  cacheEvent: async (event: Event) => {
    try {
      const cachedEvent: CachedEvent = {
        id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        created_at: event.created_at,
        content: event.content,
        tags: event.tags,
        sig: event.sig,
        cachedAt: Date.now()
      }
      
      await db.events.put(cachedEvent)
    } catch (error) {
      console.error('Failed to cache event:', error)
    }
  },

  // Get cached events matching filter
  getCachedEvents: async (filter) => {
    try {
      let query = db.events.toCollection()

      // Apply filters
      if (filter.kinds && filter.kinds.length > 0) {
        query = query.filter(event => filter.kinds!.includes(event.kind))
      }

      if (filter.authors && filter.authors.length > 0) {
        query = query.filter(event => filter.authors!.includes(event.pubkey))
      }

      if (filter.until) {
        query = query.filter(event => event.created_at <= filter.until!)
      }

      // Sort by created_at descending and apply limit
      let events = await query.sortBy('created_at')
      events = events.reverse() // Newest first

      if (filter.limit) {
        events = events.slice(0, filter.limit)
      }

      // Convert back to Event objects
      return events.map(cached => ({
        id: cached.id,
        pubkey: cached.pubkey,
        kind: cached.kind,
        created_at: cached.created_at,
        content: cached.content,
        tags: cached.tags,
        sig: cached.sig
      }))
    } catch (error) {
      console.error('Failed to get cached events:', error)
      return []
    }
  },

  // Cache profile data
  cacheProfile: async (pubkey: string, profile: any) => {
    try {
      const cachedProfile: CachedProfile = {
        pubkey,
        data: profile,
        lastUpdated: Date.now()
      }
      
      await db.profiles.put(cachedProfile)
    } catch (error) {
      console.error('Failed to cache profile:', error)
    }
  },

  // Get cached profile
  getCachedProfile: async (pubkey: string) => {
    try {
      const cached = await db.profiles.get(pubkey)
      
      if (cached) {
        // Check if cache is not too old (7 days)
        const PROFILE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
        if (Date.now() - cached.lastUpdated < PROFILE_CACHE_TTL) {
          return cached.data
        }
      }
      
      return null
    } catch (error) {
      console.error('Failed to get cached profile:', error)
      return null
    }
  },

  // Cleanup old cache data
  cleanup: async () => {
    try {
      const now = Date.now()
      const EVENT_CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days
      const PROFILE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

      // Clean old events
      await db.events.where('cachedAt').below(now - EVENT_CACHE_TTL).delete()
      
      // Clean old profiles
      await db.profiles.where('lastUpdated').below(now - PROFILE_CACHE_TTL).delete()

      console.log('Cache cleanup completed')
    } catch (error) {
      console.error('Failed to cleanup cache:', error)
    }
  },

  // Clear all cached data
  clearCache: async () => {
    try {
      await db.events.clear()
      await db.profiles.clear()
      await db.relays.clear()
      console.log('Cache cleared')
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  },

  // Get cache statistics
  getCacheStats: async () => {
    try {
      const eventCount = await db.events.count()
      const profileCount = await db.profiles.count()
      
      const oldestEvent = await db.events.orderBy('created_at').first()
      const newestEvent = await db.events.orderBy('created_at').last()

      return {
        eventCount,
        profileCount,
        oldestEvent: oldestEvent?.created_at || null,
        newestEvent: newestEvent?.created_at || null
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return {
        eventCount: 0,
        profileCount: 0,
        oldestEvent: null,
        newestEvent: null
      }
    }
  }
}))

// Initialize database on module load
db.open()
  .then(() => {
    console.log('TrailStr cache database opened successfully')
    useCacheStore.setState({ isReady: true })
  })
  .catch(error => {
    console.error('Failed to open cache database:', error)
  })

// Utility functions for integrating with existing stores

export const cacheHelpers = {
  // Cache events from feedStore
  cacheEvents: async (events: Event[]) => {
    const { cacheEvent } = useCacheStore.getState()
    await Promise.all(events.map(event => cacheEvent(event)))
  },

  // Get cached feed data for immediate display
  getCachedFeedData: async (userPubkey: string, followedPubkeys: string[]) => {
    const { getCachedEvents } = useCacheStore.getState()
    
    const authors = [userPubkey, ...followedPubkeys]
    const events = await getCachedEvents({
      kinds: [KINDS.ACTIVITY],
      authors,
      limit: 20
    })
    
    return events
  },

  // Get cached profile data for avatars/names
  getCachedProfiles: async (pubkeys: string[]) => {
    const { getCachedProfile } = useCacheStore.getState()
    const profiles: Record<string, any> = {}
    
    await Promise.all(
      pubkeys.map(async (pubkey) => {
        const profile = await getCachedProfile(pubkey)
        if (profile) {
          profiles[pubkey] = profile
        }
      })
    )
    
    return profiles
  },

  // Schedule cleanup (call this periodically)
  scheduleCleanup: () => {
    const { cleanup } = useCacheStore.getState()
    
    // Run cleanup daily
    const cleanupInterval = setInterval(() => {
      cleanup()
    }, 24 * 60 * 60 * 1000)

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(cleanupInterval)
    })

    return cleanupInterval
  }
}