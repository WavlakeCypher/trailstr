import React, { useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Filter } from 'lucide-react'
import ActivityCard from '../components/activity/ActivityCard'
import Skeleton from '../components/common/Skeleton'
import { useFeedStore } from '../stores/feedStore'
import { useAuthStore } from '../stores/authStore'
import type { ActivityFeedItem, ActivityType } from '../types/activity'

export default function Feed() {
  const {
    activities,
    isLoading,
    hasMore,
    error,
    followingOnly,
    fetchFeed,
    loadMore,
    toggleFollowingOnly
  } = useFeedStore()
  
  const { isAuthenticated, profile: userProfile, pubkey: currentUserPubkey } = useAuthStore()
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [showFilters, setShowFilters] = React.useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)

  // Initial feed load
  useEffect(() => {
    if (isAuthenticated && activities.length === 0) {
      fetchFeed(true)
    }
  }, [isAuthenticated, activities.length, fetchFeed])

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
            Welcome to TrailStr
          </h2>
          <p className="text-stone-600 dark:text-stone-400 mb-4">
            Sign in to see your activity feed
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-forest-800 dark:text-forest-200">
            Feed
          </h1>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              <Filter size={16} />
              <span>Filter</span>
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-forest-600 dark:text-forest-400 hover:text-forest-800 dark:hover:text-forest-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-700">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={followingOnly}
                  onChange={toggleFollowingOnly}
                  className="rounded border-stone-300 text-forest-600 focus:border-forest-500 focus:ring-forest-500"
                />
                <span className="text-sm text-stone-700 dark:text-stone-300">
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
        <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={() => fetchFeed(true)}
            className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4">
        {/* Loading skeletons for initial load */}
        {isLoading && feedItems.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-stone-800 rounded-lg p-4 border border-stone-200 dark:border-stone-700">
                <div className="flex items-start space-x-3 mb-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-32 w-full mb-3 rounded-lg" />
                <div className="flex space-x-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Activity Cards */}
        {feedItems.length > 0 && (
          <div className="space-y-4">
            {feedItems.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && feedItems.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center">
              <span className="text-2xl">🏃‍♂️</span>
            </div>
            <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">
              No activities yet
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-4">
              {followingOnly 
                ? "Follow some people or create your first activity!"
                : "Be the first to share an activity!"
              }
            </p>
          </div>
        )}

        {/* Load more trigger */}
        {hasMore && feedItems.length > 0 && (
          <div ref={loadMoreRef} className="py-4">
            {isLoadingMore && (
              <div className="text-center">
                <div className="inline-flex items-center space-x-2 text-sm text-stone-500 dark:text-stone-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-forest-500"></div>
                  <span>Loading more activities...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* End of feed */}
        {!hasMore && feedItems.length > 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              That's all for now! 🎉
            </p>
          </div>
        )}
      </div>
    </div>
  )
}