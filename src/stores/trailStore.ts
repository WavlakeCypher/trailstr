import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Event } from 'nostr-tools'
import { KINDS } from '../nostr/kinds'

// Simplified Trail interface for store purposes
interface StoreTrail {
  id: string
  authorPubkey: string
  createdAt: number
  dTag: string
  name: string
  summary: string
  difficulty: string
  type: string
  location: string
  distance: number
  elevationGain: number
  estimatedDuration?: number
  
  // Coordinates and route data
  startCoordinates?: [number, number]
  endCoordinates?: [number, number]
  routeData?: any
  waypoints: any[]
  geoTags: string[]
  
  // Media
  photos: string[]
  heroPhoto?: string
  
  // Stats
  averageRating: number
  reviewCount: number
  activityCount: number
  
  // Raw event for reference
  rawEvent: Event
}

// Simplified Review interface for store purposes
interface StoreReview {
  id: string
  authorPubkey: string
  createdAt: number
  trailId: string
  rating: number
  comment: string
  hikedOn?: number
  conditions?: string[]
  images?: Array<{url: string, blurhash?: string}>
  rawEvent: Event
}

export interface TrailState {
  // Trail data
  trails: StoreTrail[]
  events: Event[] // Raw Nostr events
  isLoading: boolean
  hasMore: boolean
  error: string | null
  
  // Current trail details
  currentTrail: StoreTrail | null
  currentTrailReviews: StoreReview[]
  isLoadingTrail: boolean
  isLoadingReviews: boolean
  
  // Pagination
  until?: number
  limit: number
  
  // Search and filters
  searchQuery: string
  difficulty: string[]
  trailTypes: string[]
  location: string
  
  // Actions
  fetchTrails: (refresh?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  fetchTrailById: (id: string) => Promise<void>
  fetchTrailReviews: (trailId: string) => Promise<void>
  addTrail: (trail: StoreTrail, optimistic?: boolean) => void
  updateTrail: (id: string, updates: Partial<StoreTrail>) => void
  removeTrail: (id: string) => void
  createTrail: (trailData: Omit<StoreTrail, 'id' | 'authorPubkey' | 'createdAt'>) => Promise<StoreTrail>
  
  // Reviews
  addReview: (review: StoreReview) => void
  updateReview: (reviewId: string, updates: Partial<StoreReview>) => void
  removeReview: (reviewId: string) => void
  createReview: (trailId: string, reviewData: Omit<StoreReview, 'id' | 'authorPubkey' | 'createdAt' | 'trailId'>) => Promise<StoreReview>
  
  // Search and filters
  setSearchQuery: (query: string) => void
  setDifficultyFilter: (difficulty: string[]) => void
  setTrailTypeFilter: (types: string[]) => void
  setLocationFilter: (location: string) => void
  clearFilters: () => void
  
  // Map/location based
  fetchTrailsInBounds: (bounds: { north: number, south: number, east: number, west: number }) => Promise<void>
  
  // Real-time updates
  handleNewEvent: (event: Event) => void
}

// Parse a kind-30530 trail event
function parseTrailEvent(event: Event): StoreTrail | null {
  try {
    let content: any = {}
    
    if (event.content) {
      try {
        content = JSON.parse(event.content)
      } catch {
        content = { description: event.content }
      }
    }
    
    // Extract data from tags
    const tags: Record<string, string> = {}
    const geoTags: string[] = []
    
    for (const tag of event.tags) {
      if (tag[0] && tag[1]) {
        switch (tag[0]) {
          case 'd':
            tags.d = tag[1] // Identifier tag
            break
          case 'name':
            tags.name = tag[1]
            break
          case 'difficulty':
            tags.difficulty = tag[1]
            break
          case 'type':
            tags.type = tag[1]
            break
          case 'distance':
            tags.distance = tag[1]
            break
          case 'elevation':
            tags.elevation = tag[1]
            break
          case 'location':
            tags.location = tag[1]
            break
          case 'g': // Geohash tags
            geoTags.push(tag[1])
            break
        }
      }
    }
    
    const trail: StoreTrail = {
      id: event.id,
      authorPubkey: event.pubkey,
      createdAt: event.created_at,
      dTag: tags.d || `${event.pubkey}:${event.created_at}`,
      name: tags.name || content.name || 'Unnamed Trail',
      summary: content.description || '',
      difficulty: tags.difficulty || content.difficulty || 'moderate',
      type: tags.type || content.type || 'hiking',
      location: tags.location || content.location || '',
      distance: parseFloat(tags.distance || content.distance) || 0,
      elevationGain: parseFloat(tags.elevation || content.elevation) || 0,
      estimatedDuration: content.estimatedDuration || undefined,
      
      // Coordinates and route data
      startCoordinates: content.startCoordinates || undefined,
      endCoordinates: content.endCoordinates || undefined,
      routeData: content.route || content.gpx || undefined,
      waypoints: content.waypoints || [],
      geoTags,
      
      // Media
      photos: content.photos || [],
      heroPhoto: content.heroPhoto || undefined,
      
      // Stats (will be populated from reviews)
      averageRating: 0,
      reviewCount: 0,
      activityCount: 0,
      
      // Raw event for reference
      rawEvent: event
    }
    
    return trail
  } catch (error) {
    console.error('Failed to parse trail event:', error, event)
    return null
  }
}

// Parse a kind-30532 review event
function parseReviewEvent(event: Event): StoreReview | null {
  try {
    let content: any = {}
    
    if (event.content) {
      try {
        content = JSON.parse(event.content)
      } catch {
        content = { comment: event.content }
      }
    }
    
    // Extract data from tags
    let trailId = ''
    let rating = 0
    let hikedOn: number | undefined
    const conditions: string[] = []
    const images: Array<{url: string, blurhash?: string}> = []
    
    for (const tag of event.tags) {
      switch (tag[0]) {
        case 'a': // Trail reference (kind:pubkey:d-tag format)
          if (tag[1] && tag[1].includes(':')) {
            // Extract trail reference - we'll use the full a-tag reference as trailId
            trailId = tag[1]
          }
          break
        case 'e': // Legacy direct event reference
          if (tag[1] && !trailId) {
            trailId = tag[1]
          }
          break
        case 'rating':
          rating = parseInt(tag[1]) || 0
          break
        case 'hiked_on':
          hikedOn = parseInt(tag[1]) || undefined
          break
        case 'conditions':
          if (tag[1]) conditions.push(tag[1])
          break
        case 'image':
          if (tag[1]) {
            images.push({
              url: tag[1],
              blurhash: tag[2] || undefined
            })
          }
          break
      }
    }
    
    if (!trailId) {
      console.warn('Review event missing trail ID:', event)
      return null
    }
    
    const review: StoreReview = {
      id: event.id,
      authorPubkey: event.pubkey,
      createdAt: event.created_at,
      trailId,
      rating: rating || content.rating || 0,
      comment: content || '',
      hikedOn,
      conditions: conditions.length > 0 ? conditions : undefined,
      images: images.length > 0 ? images : undefined,
      rawEvent: event
    }
    
    return review
  } catch (error) {
    console.error('Failed to parse review event:', error, event)
    return null
  }
}

export const useTrailStore = create<TrailState>()(
  persist(
    (set, get) => ({
      // Initial state
      trails: [],
      events: [],
      isLoading: false,
      hasMore: true,
      error: null,
      currentTrail: null,
      currentTrailReviews: [],
      isLoadingTrail: false,
      isLoadingReviews: false,
      limit: 20,
      searchQuery: '',
      difficulty: [],
      trailTypes: [],
      location: '',

      // Fetch trails from relays
      fetchTrails: async (refresh = false) => {
        try {
          set({ 
            isLoading: true, 
            error: null,
            ...(refresh && { trails: [], events: [], until: undefined, hasMore: true })
          })

          const { until, limit, searchQuery, difficulty, trailTypes, location } = get()
          
          // Import dependencies dynamically
          const { useRelayStore } = await import('./relayStore')
          const { NostrClient } = await import('../nostr/client')
          
          const relayStore = useRelayStore.getState()
          const client = new NostrClient({
            readRelays: relayStore.getReadRelays(),
            writeRelays: relayStore.getWriteRelays()
          })

          // Build filter
          const filter: any = {
            kinds: [KINDS.TRAIL],
            limit,
          }

          if (until) {
            filter.until = until
          }

          // TODO: Add search and filtering when we define tag standards
          // This would require implementing proper tag-based filtering

          const events = await client.query(filter, 10000)
          
          // Parse events into trails
          const newTrails = events
            .map(parseTrailEvent)
            .filter(Boolean) as StoreTrail[]
          
          // Filter by search query (client-side for now)
          let filteredTrails = newTrails
          if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filteredTrails = newTrails.filter(trail =>
              trail.name.toLowerCase().includes(query) ||
              trail.summary.toLowerCase().includes(query) ||
              trail.location.toLowerCase().includes(query)
            )
          }

          // Filter by difficulty
          if (difficulty.length > 0) {
            filteredTrails = filteredTrails.filter(trail =>
              difficulty.includes(trail.difficulty)
            )
          }

          // Filter by trail type
          if (trailTypes.length > 0) {
            filteredTrails = filteredTrails.filter(trail =>
              trailTypes.includes(trail.type)
            )
          }

          // Filter by location (basic string matching)
          if (location) {
            const locationQuery = location.toLowerCase()
            filteredTrails = filteredTrails.filter(trail =>
              trail.location.toLowerCase().includes(locationQuery)
            )
          }

          const { trails: currentTrails } = get()
          const allTrails = refresh 
            ? filteredTrails 
            : [...currentTrails, ...filteredTrails]
          
          // Remove duplicates
          const uniqueTrails = allTrails.filter((trail, index, arr) => 
            arr.findIndex(t => t.id === trail.id) === index
          )

          const hasMoreResults = events.length === limit
          const nextUntil = events.length > 0 ? events[events.length - 1].created_at - 1 : undefined

          set({
            trails: uniqueTrails,
            events: [...(refresh ? [] : get().events), ...events],
            until: nextUntil,
            hasMore: hasMoreResults,
            isLoading: false
          })

        } catch (error: any) {
          console.error('Failed to fetch trails:', error)
          set({ 
            error: error.message || 'Failed to fetch trails',
            isLoading: false 
          })
        }
      },

      // Load more trails (pagination)
      loadMore: async () => {
        const { hasMore, isLoading } = get()
        if (!hasMore || isLoading) return
        
        await get().fetchTrails(false)
      },

      // Fetch specific trail by ID
      fetchTrailById: async (id: string) => {
        try {
          set({ isLoadingTrail: true, error: null })

          const { useRelayStore } = await import('./relayStore')
          const { NostrClient } = await import('../nostr/client')
          
          const relayStore = useRelayStore.getState()
          const client = new NostrClient({
            readRelays: relayStore.getReadRelays(),
            writeRelays: relayStore.getWriteRelays()
          })

          const events = await client.query({
            ids: [id],
            kinds: [KINDS.TRAIL],
            limit: 1
          }, 5000)

          if (events.length > 0) {
            const trail = parseTrailEvent(events[0])
            if (trail) {
              set({ currentTrail: trail })
            }
          }

        } catch (error: any) {
          console.error('Failed to fetch trail:', error)
          set({ error: error.message || 'Failed to fetch trail' })
        } finally {
          set({ isLoadingTrail: false })
        }
      },

      // Fetch reviews for a trail
      fetchTrailReviews: async (trailId: string) => {
        try {
          set({ isLoadingReviews: true })

          const { useRelayStore } = await import('./relayStore')
          const { NostrClient } = await import('../nostr/client')
          
          const relayStore = useRelayStore.getState()
          const client = new NostrClient({
            readRelays: relayStore.getReadRelays(),
            writeRelays: relayStore.getWriteRelays()
          })

          const events = await client.query({
            kinds: [KINDS.REVIEW],
            '#e': [trailId], // Reviews referencing this trail
            limit: 100
          }, 5000)

          const reviews = events
            .map(parseReviewEvent)
            .filter(Boolean) as StoreReview[]

          reviews.sort((a, b) => b.createdAt - a.createdAt)

          set({ currentTrailReviews: reviews })

          // Update trail rating if this is the current trail
          const { currentTrail } = get()
          if (currentTrail && currentTrail.id === trailId) {
            const avgRating = reviews.length > 0 
              ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
              : 0

            set({
              currentTrail: {
                ...currentTrail,
                averageRating: avgRating,
                reviewCount: reviews.length
              }
            })
          }

        } catch (error: any) {
          console.error('Failed to fetch reviews:', error)
        } finally {
          set({ isLoadingReviews: false })
        }
      },

      // Add trail (optimistic)
      addTrail: (trail: StoreTrail, optimistic = false) => {
        set(state => ({
          trails: [trail, ...state.trails],
          ...(optimistic && { isLoading: false })
        }))
      },

      // Update trail
      updateTrail: (id: string, updates: Partial<StoreTrail>) => {
        set(state => ({
          trails: state.trails.map(trail =>
            trail.id === id ? { ...trail, ...updates } : trail
          ),
          currentTrail: state.currentTrail?.id === id 
            ? { ...state.currentTrail, ...updates }
            : state.currentTrail
        }))
      },

      // Remove trail
      removeTrail: (id: string) => {
        set(state => ({
          trails: state.trails.filter(trail => trail.id !== id),
          events: state.events.filter(event => event.id !== id),
          currentTrail: state.currentTrail?.id === id ? null : state.currentTrail
        }))
      },

      // Create new trail
      createTrail: async (_trailData) => {
        // TODO: Implement trail creation with proper data mapping
        throw new Error('Trail creation not yet implemented')
      },

      // Add review
      addReview: (review: StoreReview) => {
        set(state => ({
          currentTrailReviews: [review, ...state.currentTrailReviews]
        }))
      },

      // Update review
      updateReview: (reviewId: string, updates: Partial<StoreReview>) => {
        set(state => ({
          currentTrailReviews: state.currentTrailReviews.map(review =>
            review.id === reviewId ? { ...review, ...updates } : review
          )
        }))
      },

      // Remove review
      removeReview: (reviewId: string) => {
        set(state => ({
          currentTrailReviews: state.currentTrailReviews.filter(
            review => review.id !== reviewId
          )
        }))
      },

      // Create new review
      createReview: async (_trailId, _reviewData) => {
        // TODO: Implement review creation with proper data mapping
        throw new Error('Review creation not yet implemented')
      },

      // Search and filter methods
      setSearchQuery: (query: string) => {
        set({ searchQuery: query })
        get().fetchTrails(true)
      },

      setDifficultyFilter: (difficulty: string[]) => {
        set({ difficulty })
        get().fetchTrails(true)
      },

      setTrailTypeFilter: (types: string[]) => {
        set({ trailTypes: types })
        get().fetchTrails(true)
      },

      setLocationFilter: (location: string) => {
        set({ location })
        get().fetchTrails(true)
      },

      clearFilters: () => {
        set({ 
          searchQuery: '', 
          difficulty: [], 
          trailTypes: [], 
          location: '' 
        })
        get().fetchTrails(true)
      },

      // Fetch trails within map bounds
      fetchTrailsInBounds: async (_bounds) => {
        // This would require implementing geohash-based filtering
        // For now, just fetch all trails and filter client-side
        await get().fetchTrails(true)
      },

      // Handle real-time events
      handleNewEvent: (event: Event) => {
        if (event.kind === KINDS.TRAIL) {
          const trail = parseTrailEvent(event)
          if (trail) {
            get().addTrail(trail)
          }
        } else if (event.kind === KINDS.REVIEW) {
          const review = parseReviewEvent(event)
          if (review && get().currentTrail?.id === review.trailId) {
            get().addReview(review)
          }
        }
      }
    }),
    {
      name: 'trailstr-trails',
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        difficulty: state.difficulty,
        trailTypes: state.trailTypes,
        location: state.location,
        limit: state.limit
      })
    }
  )
)