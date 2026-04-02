import { useState, useEffect } from 'react'
import { Star, Calendar, ThumbsUp, MessageCircle, MoreHorizontal } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import Avatar from '../common/Avatar'
import StarRating from '../common/StarRating'
import PhotoGallery from '../activity/PhotoGallery'
import { ReactionBar } from '../social/ReactionBar'

interface ReviewListProps {
  reviews: Array<{
    id: string
    authorPubkey: string
    rating: number
    comment: string
    createdAt: number
    hikedOn?: number
    conditions?: string[]
    images?: Array<{url: string, blurhash?: string}>
  }>
  onLoadMore?: () => void
  hasMore?: boolean
  isLoading?: boolean
  className?: string
}

interface UserProfile {
  name?: string
  displayName?: string
  picture?: string
  nip05?: string
}

const CONDITION_LABELS: Record<string, string> = {
  dry: 'Dry',
  muddy: 'Muddy', 
  icy: 'Icy',
  snow: 'Snow',
  crowded: 'Crowded',
  quiet: 'Quiet',
  overgrown: 'Overgrown',
  'washed-out': 'Washed Out'
}

const CONDITION_COLORS: Record<string, string> = {
  dry: 'bg-yellow-100 text-yellow-800',
  muddy: 'bg-amber-100 text-amber-800',
  icy: 'bg-blue-100 text-blue-800', 
  snow: 'bg-blue-100 text-blue-800',
  crowded: 'bg-red-100 text-red-800',
  quiet: 'bg-green-100 text-green-800',
  overgrown: 'bg-green-100 text-green-800',
  'washed-out': 'bg-red-100 text-red-800'
}

function ReviewItem({ 
  review, 
  profile
}: { 
  review: ReviewListProps['reviews'][0]
  profile?: UserProfile
}) {
  const { pubkey } = useAuthStore()
  const [showFullText, setShowFullText] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const isLongText = review.comment.length > 300
  const displayText = showFullText || !isLongText 
    ? review.comment 
    : review.comment.substring(0, 300) + '...'

  const displayName = profile?.displayName || profile?.name || 'Anonymous Hiker'
  const isOwnReview = pubkey === review.authorPubkey

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0 py-6">
      {/* Review Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <Avatar
            src={profile?.picture}
            alt={displayName}
            fallback={displayName}
            size="md"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">{displayName}</h4>
              {profile?.nip05 && (
                <span className="text-sm text-green-600">✓</span>
              )}
            </div>
            <div className="flex items-center space-x-3 text-sm text-gray-500">
              <span>{formatDate(review.createdAt)}</span>
              {review.hikedOn && (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    <Calendar size={12} />
                    <span>Hiked {formatDate(review.hikedOn)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <StarRating rating={review.rating} interactive={false} size="sm" />
          
          {isOwnReview && (
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <MoreHorizontal size={16} />
              </button>
              
              {showActions && (
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10">
                  <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    Edit Review
                  </button>
                  <button className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                    Delete Review
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trail Conditions */}
      {review.conditions && review.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {review.conditions.map((condition) => (
            <span
              key={condition}
              className={`px-2 py-1 text-xs rounded-full ${
                CONDITION_COLORS[condition] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {CONDITION_LABELS[condition] || condition}
            </span>
          ))}
        </div>
      )}

      {/* Review Text */}
      <div className="mb-4">
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {displayText}
        </p>
        {isLongText && (
          <button
            onClick={() => setShowFullText(!showFullText)}
            className="text-forest-600 hover:text-forest-700 text-sm font-medium mt-1"
          >
            {showFullText ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Photos */}
      {review.images && review.images.length > 0 && (
        <div className="mb-4">
          <PhotoGallery
            images={review.images.map(img => ({
              url: img.url,
              blurhash: img.blurhash
            }))}
            maxPreview={3}
          />
        </div>
      )}

      {/* Reactions */}
      <div className="flex items-center justify-between">
        <ReactionBar
          eventId={review.id}
          authorPubkey={review.authorPubkey}
        />
        
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <button className="flex items-center space-x-1 hover:text-gray-700">
            <ThumbsUp size={14} />
            <span>Helpful</span>
          </button>
          <button className="flex items-center space-x-1 hover:text-gray-700">
            <MessageCircle size={14} />
            <span>Reply</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReviewList({ 
  reviews,
  onLoadMore, 
  hasMore = false, 
  isLoading = false,
  className = ''
}: ReviewListProps) {
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map())
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'rating'>('newest')

  // Fetch user profiles for review authors
  useEffect(() => {
    const fetchProfiles = async () => {
      const uniquePubkeys = [...new Set(reviews.map(r => r.authorPubkey))]
      const uncachedPubkeys = uniquePubkeys.filter(pk => !profiles.has(pk))
      
      if (uncachedPubkeys.length === 0) return

      try {
        const { nostrClient } = await import('../../nostr/client')
        const { KINDS } = await import('../../nostr/kinds')
        
        const profileEvents = await nostrClient.query([
          {
            kinds: [KINDS.SET_METADATA],
            authors: uncachedPubkeys,
            limit: uncachedPubkeys.length
          }
        ])

        const newProfiles = new Map(profiles)
        for (const event of profileEvents) {
          try {
            const metadata = JSON.parse(event.content)
            newProfiles.set(event.pubkey, {
              name: metadata.name,
              displayName: metadata.display_name,
              picture: metadata.picture,
              nip05: metadata.nip05
            })
          } catch (error) {
            console.error('Failed to parse profile metadata:', error)
          }
        }
        
        setProfiles(newProfiles)
      } catch (error) {
        console.error('Failed to fetch profiles:', error)
      }
    }

    if (reviews.length > 0) {
      fetchProfiles()
    }
  }, [reviews])

  // Sort reviews
  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.createdAt - a.createdAt
      case 'oldest':
        return a.createdAt - b.createdAt
      case 'rating':
        return b.rating - a.rating
      default:
        return b.createdAt - a.createdAt
    }
  })

  // Calculate rating statistics
  const ratingStats = reviews.reduce((acc, review) => {
    acc[review.rating] = (acc[review.rating] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  if (reviews.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Star className="mx-auto mb-3 text-gray-400" size={48} />
        <h3 className="text-lg font-medium text-gray-700 mb-2">No reviews yet</h3>
        <p className="text-gray-500">Be the first to share your experience on this trail!</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Rating Summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="text-3xl font-bold text-gray-900">
              {averageRating.toFixed(1)}
            </div>
            <div>
              <StarRating rating={averageRating} interactive={false} size="lg" />
              <p className="text-sm text-gray-600 mt-1">
                Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>
          
          {/* Rating Distribution */}
          <div className="hidden md:flex flex-col space-y-1">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = ratingStats[rating] || 0
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
              
              return (
                <div key={rating} className="flex items-center space-x-2 text-sm">
                  <span className="w-8 text-gray-600">{rating}★</span>
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-forest-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-gray-600 text-xs">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Reviews ({reviews.length})
        </h3>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-forest-500"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="rating">Highest rated</option>
        </select>
      </div>

      {/* Reviews List */}
      <div className="space-y-0 divide-y divide-gray-100 border-t border-gray-100">
        {sortedReviews.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            profile={profiles.get(review.authorPubkey)}
          />
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span>Loading...</span>
              </div>
            ) : (
              'Load More Reviews'
            )}
          </button>
        </div>
      )}
    </div>
  )
}