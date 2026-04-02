export type TrailDifficulty = 'easy' | 'moderate' | 'hard' | 'expert'
export type TrailType = 'loop' | 'out-and-back' | 'point-to-point'
export type ActivityType = 'hike' | 'walk' | 'run' | 'trail_run' | 'bike' | 'mountain_bike' | 'ski' | 'snowboard'

export interface TrailImage {
  url: string
  blurhash?: string
  caption?: string
  latitude?: number
  longitude?: number
}

export interface TrailCoordinate {
  latitude: number
  longitude: number
  elevation?: number
}

export interface TrailRoute {
  coordinates: TrailCoordinate[]
  totalDistanceMeters: number
  totalElevationGainMeters: number
  totalElevationLossMeters: number
  minElevation?: number
  maxElevation?: number
}

export interface Trail {
  // Event metadata
  id: string
  authorPubkey: string
  createdAt: number
  updatedAt?: number
  
  // Trail identification
  slug: string // The 'd' tag value
  name: string
  summary?: string
  
  // Classification
  difficulty: TrailDifficulty
  trailType: TrailType
  activityTypes: ActivityType[] // What activities this trail supports
  
  // Physical attributes
  distanceMeters: number
  elevationGainMeters: number
  location: string // Human-readable location
  latitude: number // Trailhead/start coordinates
  longitude: number
  
  // Content
  content: string // Full markdown description
  heroImage?: TrailImage
  additionalImages?: TrailImage[]
  
  // Route data
  routeUrl?: string // URL to GeoJSON/GPX file
  route?: TrailRoute // Parsed route data
  
  // Computed stats (from reviews and activities)
  avgRating?: number
  reviewCount: number
  activityCount: number
  lastActivityAt?: number
  
  // Geohashes for spatial queries
  geohashes: string[] // Multiple precision levels
  
  // UI state
  isLoading?: boolean
  error?: string
}

// For trail creation/editing
export interface TrailDraft {
  slug: string
  name: string
  summary?: string
  difficulty: TrailDifficulty
  trailType: TrailType
  activityTypes: ActivityType[]
  location: string
  latitude: number
  longitude: number
  content: string
  heroImage?: File | TrailImage
  additionalImages?: (File | TrailImage)[]
  routeFile?: File // GPX/GeoJSON for route
  route?: TrailCoordinate[] // Manual route drawing
}

// Trail search/filter options
export interface TrailFilter {
  location?: {
    latitude: number
    longitude: number
    radiusKm: number
  }
  difficulties?: TrailDifficulty[]
  trailTypes?: TrailType[]
  activityTypes?: ActivityType[]
  minDistance?: number
  maxDistance?: number
  minElevationGain?: number
  maxElevationGain?: number
  minRating?: number
  hasPhotos?: boolean
  authorPubkey?: string
  searchText?: string
}

// Trail discovery/explorer view
export interface TrailMapMarker {
  trailId: string
  slug: string
  name: string
  latitude: number
  longitude: number
  difficulty: TrailDifficulty
  distanceMeters: number
  avgRating?: number
  heroImageUrl?: string
}

// Trail detail with computed data
export interface TrailDetail extends Trail {
  author: {
    pubkey: string
    name?: string
    displayName?: string
    picture?: string
    nip05?: string
  }
  
  // Recent activities on this trail
  recentActivities: Array<{
    id: string
    authorPubkey: string
    authorName?: string
    authorPicture?: string
    title: string
    type: ActivityType
    startedAt: number
    distanceMeters?: number
    movingSeconds?: number
  }>
  
  // Weather info (if coordinates available)
  currentWeather?: {
    temperature: number
    conditions: string
    icon: string
  }
  
  // Nearby trails
  nearbyTrails?: TrailMapMarker[]
}

// For trail statistics
export interface TrailStats {
  totalTrails: number
  trailsByDifficulty: Record<TrailDifficulty, number>
  trailsByType: Record<TrailType, number>
  trailsByActivityType: Record<ActivityType, number>
  avgDistance: number
  avgElevationGain: number
  totalDistance: number
  totalElevationGain: number
  mostPopularTrail?: {
    slug: string
    name: string
    activityCount: number
  }
  highestRatedTrail?: {
    slug: string
    name: string
    avgRating: number
  }
}

// For import/export
export interface TrailExport {
  trail: Trail
  reviews: any[] // Review events
  activities: any[] // Activity events that reference this trail
}

// For trail recommendations
export interface TrailRecommendation extends Trail {
  score: number
  reasons: string[] // Why this trail is recommended
  matchingActivityTypes: ActivityType[]
}

// GPX/route file parsing results
export interface ParsedTrailRoute {
  coordinates: TrailCoordinate[]
  name?: string
  description?: string
  totalDistanceMeters: number
  elevationGainMeters: number
  minElevation?: number
  maxElevation?: number
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
}

// For route drawing/editing tools
export interface RouteEditState {
  isDrawing: boolean
  coordinates: TrailCoordinate[]
  currentSegment: TrailCoordinate[]
  canUndo: boolean
  canRedo: boolean
}

// Geospatial utilities
export interface BoundingBox {
  north: number
  south: number
  east: number
  west: number
}

export interface GeohashPrecision {
  level: number
  kmPerChar: number
  description: string
}

// Trail conditions/status
export interface TrailConditions {
  reportedAt: number
  reportedBy: string
  conditions: 'excellent' | 'good' | 'fair' | 'poor' | 'closed'
  issues?: string[] // 'muddy', 'icy', 'washed-out', 'overgrown', etc.
  notes?: string
}

// Trail wishlist/bookmark
export interface TrailBookmark {
  trailId: string
  addedAt: number
  notes?: string
  priority?: 'low' | 'medium' | 'high'
}