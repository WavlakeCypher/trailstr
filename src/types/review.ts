export type ReviewRating = 1 | 2 | 3 | 4 | 5

export type TrailCondition = 
  | 'dry'
  | 'muddy' 
  | 'wet'
  | 'icy'
  | 'snowy'
  | 'flooded'
  | 'overgrown'
  | 'washed-out'
  | 'crowded'
  | 'quiet'
  | 'buggy'
  | 'clear'
  | 'foggy'
  | 'windy'
  | 'hot'
  | 'cold'

export interface ReviewImage {
  url: string
  blurhash?: string
  caption?: string
  latitude?: number
  longitude?: number
  timestamp?: number
}

export interface Review {
  // Event metadata
  id: string
  authorPubkey: string
  createdAt: number
  updatedAt?: number
  
  // Review identification (d tag)
  reviewId: string // Format: "review:{trailAuthorPubkey}:{trailSlug}"
  
  // Trail reference
  trailAuthorPubkey: string
  trailSlug: string
  trailRelay?: string
  
  // Review content
  rating: ReviewRating
  content: string // Review text in markdown
  
  // Context
  hikedOn?: number // Unix timestamp of when they hiked it
  conditions?: TrailCondition[]
  
  // Media
  images?: ReviewImage[]
  
  // UI state
  isLoading?: boolean
  error?: string
}

// For review creation/editing
export interface ReviewDraft {
  trailAuthorPubkey: string
  trailSlug: string
  trailRelay?: string
  rating: ReviewRating
  content: string
  hikedOn?: Date
  conditions?: TrailCondition[]
  images?: File[] | ReviewImage[]
}

// Review with author info for display
export interface ReviewWithAuthor extends Review {
  author: {
    pubkey: string
    name?: string
    displayName?: string
    picture?: string
    nip05?: string
  }
  
  // Computed fields
  timeAgo: string // "2 days ago"
  isCurrentUser: boolean
  
  // Trail info (if available)
  trail?: {
    slug: string
    name: string
    authorPubkey: string
  }
}

// For review aggregation and statistics
export interface ReviewStats {
  totalReviews: number
  avgRating: number
  ratingDistribution: {
    1: number
    2: number  
    3: number
    4: number
    5: number
  }
  mostCommonConditions: Array<{
    condition: TrailCondition
    count: number
    percentage: number
  }>
  recentReviews: ReviewWithAuthor[]
  oldestReview?: number // Unix timestamp
  newestReview?: number // Unix timestamp
}

// For review filtering and search
export interface ReviewFilter {
  trailSlug?: string
  trailAuthorPubkey?: string
  authorPubkey?: string
  minRating?: ReviewRating
  maxRating?: ReviewRating
  conditions?: TrailCondition[]
  hasImages?: boolean
  hikedAfter?: Date
  hikedBefore?: Date
  searchText?: string
}

// For review moderation/reporting
export interface ReviewReport {
  reviewId: string
  reportedBy: string
  reportedAt: number
  reason: 'spam' | 'inappropriate' | 'false-info' | 'harassment' | 'other'
  details?: string
}

// For review helpfulness voting (if implemented)
export interface ReviewVote {
  reviewId: string
  voterPubkey: string
  helpful: boolean // true for helpful, false for not helpful
  createdAt: number
}

// Review with helpfulness stats
export interface ReviewWithStats extends ReviewWithAuthor {
  helpfulVotes: number
  unhelpfulVotes: number
  netHelpfulness: number // helpful - unhelpful
  userVote?: boolean // Current user's vote (if any)
}

// For review history/editing
export interface ReviewVersion {
  version: number
  content: string
  rating: ReviewRating
  conditions?: TrailCondition[]
  updatedAt: number
  updateReason?: string
}

export interface ReviewHistory {
  reviewId: string
  versions: ReviewVersion[]
  currentVersion: number
}

// For review notifications
export interface ReviewNotification {
  type: 'new-review' | 'review-reply' | 'review-helpful'
  reviewId: string
  trailSlug: string
  trailName: string
  reviewerPubkey: string
  reviewerName?: string
  createdAt: number
  read: boolean
}

// For review analytics
export interface ReviewAnalytics {
  reviewsPerMonth: Array<{
    month: string // "2024-01"
    count: number
    avgRating: number
  }>
  
  conditionTrends: Array<{
    condition: TrailCondition
    months: Array<{
      month: string
      count: number
      percentage: number
    }>
  }>
  
  topReviewers: Array<{
    pubkey: string
    name?: string
    reviewCount: number
    avgRating: number
  }>
  
  seasonalPatterns: {
    spring: ReviewStats
    summer: ReviewStats
    fall: ReviewStats
    winter: ReviewStats
  }
}

// For import/export
export interface ReviewExport {
  review: Review
  trail: {
    slug: string
    name: string
    authorPubkey: string
  }
  author: {
    pubkey: string
    name?: string
  }
}

// For review recommendations/suggestions
export interface ReviewSuggestion {
  trailSlug: string
  trailName: string
  trailAuthorPubkey: string
  reason: string // Why we're suggesting they review this trail
  priority: 'low' | 'medium' | 'high'
  hikedDate?: number // If we know when they hiked it
}

// Common condition groupings for UI
export const CONDITION_GROUPS = {
  weather: ['dry', 'wet', 'icy', 'snowy', 'clear', 'foggy', 'windy', 'hot', 'cold'] as TrailCondition[],
  trail: ['muddy', 'flooded', 'overgrown', 'washed-out'] as TrailCondition[],
  crowd: ['crowded', 'quiet'] as TrailCondition[],
  other: ['buggy'] as TrailCondition[]
}

// Helper type for condition display
export interface ConditionInfo {
  condition: TrailCondition
  label: string
  emoji: string
  category: keyof typeof CONDITION_GROUPS
  isNegative?: boolean
}