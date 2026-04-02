import React, { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Filter } from 'lucide-react'
import ActivityCard from '../components/activity/ActivityCard'
import Skeleton from '../components/common/Skeleton'
import { FeedEmptyState } from '../components/common/EmptyState'
import { useFeedStore } from '../stores/feedStore'
import { useAuthStore } from '../stores/authStore'
import type { ActivityFeedItem, ActivityType } from '../types/activity'

export default function Feed() {
  const navigate = useNavigate()
  const {
    activities,
    isLoading,
    hasMore,
    error,
    followingOnly,
    fetchFeed,
    loadCachedFeed,
    loadMore,
    toggleFollowingOnly
  } = useFeedStore()
  
  const { isAuthenticated, profile: userProfile, pubkey: currentUserPubkey } = useAuthStore()
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [showFilters, setShowFilters] = React.useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)

  // Initial feed load - cache first, then sync
  useEffect(() => {
    if (isAuthenticated) {
      // First load cached data for immediate display
      loadCachedFeed().then(() => {
        // Then sync with relays in background
        fetchFeed(false)
      })
    }
  }, [isAuthenticated, loadCachedFeed, fetchFeed])

  // Infinite scroll handler
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoading || isLoadingMore) return
    
    setIsLoadingMore(true)
    try {
      await loadMore()
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasMore, isLoading, isLoadingMore, loadMore])

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          handleLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoading, isLoadingMore, handleLoadMore])

  // Pull to refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetchFeed(true)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Convert feed activities to ActivityFeedItem format
  const feedItems: ActivityFeedItem[] = activities.map(activity => ({
    // Basic activity data
    id: activity.id,
    authorPubkey: activity.authorPubkey,
    createdAt: activity.createdAt,
    activityId: activity.dTag,
    type: activity.type as ActivityType,
    title: activity.title,
    startedAt: new Date(activity.date).getTime() / 1000,
    
    // Metrics
    metrics: {
      distanceMeters: activity.distance,
      movingSeconds: activity.duration,
      elevationGainMeters: activity.elevationGain,
      avgPaceSecondsPerKm: activity.distance && activity.duration 
        ? (activity.duration / (activity.distance / 1000)) 
        : undefined
    },
    
    // Content
    content: activity.notes,
    
    // Author info - try to populate from userProfile or use fallback
    author: {
      pubkey: activity.authorPubkey,
      displayName: activity.authorPubkey === currentUserPubkey 
        ? userProfile?.display_name || userProfile?.name 
        : undefined,
      name: activity.authorPubkey === currentUserPubkey 
        ? userProfile?.name 
        : undefined,
      picture: activity.authorPubkey === currentUserPubkey 
        ? userProfile?.picture 
        : undefined
    },
    
    // Social stats
    reactionCount: activity.reactionCount,
    commentCount: activity.commentCount,
    zapAmount: activity.zapAmount,
    
    // Media flags
    hasPhotos: activity.photos.length > 0,
    hasTrack: !!activity.gpxData,
    images: activity.photos.map(url => ({ url })),
    
    // Track data if available
    track: activity.gpxData ? {
      points: activity.gpxData.coordinates?.map((coord: [number, number, number?]) => ({
        longitude: coord[0],
        latitude: coord[1],
        elevation: coord[2]
      })) || []
    } : undefined
  }))

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-900">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">🏃‍♂️</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Welcome to TrailStr
          </h2>
          <p className="text-stone-400 mb-6">
            Sign in to see your activity feed and share your adventures
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/login" className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl h-12 px-6 flex items-center justify-center transition-colors">
              Sign In
            </a>
            <a href="/login?signup=1" className="w-full sm:w-auto border border-stone-600 text-stone-300 hover:bg-stone-800 font-semibold rounded-xl h-12 px-6 flex items-center justify-center transition-colors">
              Create Account
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-stone-900 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-stone-900/95 backdrop-blur-xl border-b border-stone-800 px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">
              Feed
            </h1>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 border border-stone-600 text-stone-300 hover:bg-stone-800 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
              >
                <Filter size={16} />
                <span>Filter</span>
              </button>
              
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-semibold rounded-xl px-3 py-2 text-sm transition-colors"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          
          {/* Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-stone-800">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={followingOnly}
                    onChange={toggleFollowingOnly}
                    className="w-4 h-4 text-emerald-600 bg-stone-700 border-stone-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-stone-400">
                    Following only
                  </span>
                </label>
                
                {/* Activity type filters could be added here */}
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="px-4 py-4">
            <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={() => fetchFeed(true)}
                className="text-sm font-medium text-red-400 hover:text-red-300 underline transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-6">
          {/* Loading skeletons for initial load */}
          {isLoading && feedItems.length === 0 && (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
                  <div className="flex items-start space-x-3 mb-4">
                    <Skeleton className="w-12 h-12 rounded-xl bg-stone-700" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2 bg-stone-700" />
                      <Skeleton className="h-3 w-20 bg-stone-700" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-3/4 mb-4 bg-stone-700" />
                  <Skeleton className="h-32 w-full mb-4 rounded-xl bg-stone-700" />
                  <div className="flex space-x-4">
                    <Skeleton className="h-4 w-16 bg-stone-700" />
                    <Skeleton className="h-4 w-16 bg-stone-700" />
                    <Skeleton className="h-4 w-16 bg-stone-700" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity Cards */}
          {feedItems.length > 0 && (
            <div className="space-y-6">
              {feedItems.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && feedItems.length === 0 && !error && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🏃‍♂️</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                No activities yet
              </h3>
              <p className="text-stone-400 mb-6 max-w-md mx-auto">
                {followingOnly 
                  ? "Follow some people or create your first activity to see content here!"
                  : "Be the first to share an outdoor adventure!"
                }
              </p>
              <button 
                onClick={() => window.location.href = '/record'}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl h-12 px-6 inline-flex items-center justify-center transition-colors"
              >
                Record Activity
              </button>
            </div>
          )}

          {/* Load more trigger */}
          {hasMore && feedItems.length > 0 && (
            <div ref={loadMoreRef} className="py-6">
              {isLoadingMore && (
                <div className="text-center">
                  <div className="inline-flex items-center space-x-2 text-sm text-stone-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                    <span>Loading more activities...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* End of feed */}
          {!hasMore && feedItems.length > 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-stone-500">
                That's all for now! 🎉
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}