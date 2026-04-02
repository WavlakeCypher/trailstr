export interface ActivityMetrics {
  distanceMeters?: number
  elapsedSeconds?: number
  movingSeconds?: number
  elevationGainMeters?: number
  elevationLossMeters?: number
  avgPaceSecondsPerKm?: number
  avgHeartRateBpm?: number
  calories?: number
}

export interface ActivityImage {
  url: string
  blurhash?: string
  latitude?: number
  longitude?: number
  timestamp?: number
}

export interface LinkedTrail {
  authorPubkey: string
  slug: string
  relay?: string
  name?: string // Populated when resolved
}

export interface GpsPoint {
  latitude: number
  longitude: number
  elevation?: number
  timestamp?: number
  heartRate?: number
  cadence?: number
  power?: number
  temperature?: number
}

export interface ActivityTrack {
  points: GpsPoint[]
  totalDistanceMeters?: number
  totalElevationGainMeters?: number
  totalElevationLossMeters?: number
}

export type ActivityType = 
  | 'walk'
  | 'hike'
  | 'run' 
  | 'trail_run'
  | 'bike'
  | 'mountain_bike'
  | 'road_bike'
  | 'swim'
  | 'kayak'
  | 'ski'
  | 'snowboard'
  | 'climb'
  | 'other'

export interface Activity {
  // Event metadata
  id: string
  authorPubkey: string
  createdAt: number
  
  // Activity identification
  activityId: string // The 'd' tag value
  type: ActivityType
  title: string
  
  // Timing
  startedAt: number
  finishedAt?: number
  
  // Metrics
  metrics: ActivityMetrics
  
  // Location
  latitude?: number
  longitude?: number
  location?: string // Human-readable location
  
  // Content
  content?: string // User notes/description
  images?: ActivityImage[]
  
  // Data files
  trackUrl?: string // URL to GPX/GeoJSON track file
  track?: ActivityTrack // Parsed track data
  
  // Relationships
  linkedTrail?: LinkedTrail
  
  // Import metadata
  source?: string // 'garmin' | 'strava' | 'fitbit' | 'apple' | 'manual'
  originalFilename?: string
  importedAt?: number
  
  // Social stats (computed from other events)
  reactionCount?: number
  commentCount?: number
  repostCount?: number
  zapAmount?: number
  
  // UI state
  isLoading?: boolean
  error?: string
}

// For activity creation/editing
export interface ActivityDraft {
  type: ActivityType
  title: string
  startedAt: number
  finishedAt?: number
  metrics: Partial<ActivityMetrics>
  content?: string
  latitude?: number
  longitude?: number
  linkedTrail?: LinkedTrail
  images?: File[] | ActivityImage[] // Files during creation, URLs after upload
  trackFile?: File // GPX/FIT file for upload
  source?: string
}

// Activity feed item (includes author info)
export interface ActivityFeedItem extends Activity {
  author: {
    pubkey: string
    name?: string
    displayName?: string
    picture?: string
    nip05?: string
  }
  // Pre-computed for feed performance
  miniMapThumbnail?: string // Base64 encoded mini map image
  hasPhotos: boolean
  hasTrack: boolean
}

// Activity search/filter options
export interface ActivityFilter {
  authorPubkeys?: string[]
  activityTypes?: ActivityType[]
  startDate?: Date
  endDate?: Date
  minDistance?: number
  maxDistance?: number
  minElevationGain?: number
  maxElevationGain?: number
  hasPhotos?: boolean
  hasTrack?: boolean
  linkedToTrail?: boolean
  source?: string[]
  location?: {
    latitude: number
    longitude: number
    radiusKm: number
  }
}

// For activity statistics/aggregation
export interface ActivityStats {
  totalActivities: number
  totalDistanceMeters: number
  totalElevationGainMeters: number
  totalMovingSeconds: number
  totalCalories: number
  longestActivityMeters: number
  biggestElevationGainMeters: number
  activitiesByType: Record<ActivityType, number>
  activitiesThisWeek: number
  activitiesThisMonth: number
  activitiesThisYear: number
  currentStreak: number // Days with at least one activity
  longestStreak: number
}

// For import flow
export interface ImportedActivityPreview {
  filename: string
  type: ActivityType
  title: string
  startedAt: number
  metrics: ActivityMetrics
  trackPreview?: GpsPoint[] // Simplified track for preview
  selected: boolean
  error?: string
  linkedTrail?: LinkedTrail // User can assign during import
}

export interface ActivityImportResult {
  success: number
  failed: number
  errors: string[]
  activities: Activity[]
}