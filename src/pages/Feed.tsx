import React, { useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Filter } from 'lucide-react'
import ActivityCard from '../components/activity/ActivityCard'
import Skeleton from '../components/common/Skeleton'
import BottomSheet from '../components/mobile/BottomSheet'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
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
      loadCachedFeed().then(() => {
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

  // Pull to refresh (touch gesture)
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetchFeed(true)
    } finally {
      setIsRefreshing(false)
    }
  }

  const { containerRef: pullRefreshRef, pullDistance, isRefreshing: isPtrRefreshing } = usePullToRefresh({
    onRefresh: async () => { await fetchFeed(true) }
  })

  // Convert feed activities to ActivityFeedItem format
  const feedItems: ActivityFeedItem[] = activities.map(activity => ({
    id: activity.id,
    authorPubkey: activity.authorPubkey,
    createdAt: activity.createdAt,
    activityId: activity.dTag,
    type: activity.type as ActivityType,
    title: activity.title,
    startedAt: new Date(activity.date).getTime() / 1000,
    
    metrics: {
      distanceMeters: activity.distance,
      movingSeconds: activity.duration,
      elevationGainMeters: activity.elevationGain,
      avgPaceSecondsPerKm: activity.distance && activity.duration 
        ? (activity.duration / (activity.distance / 1000)) 
        : undefined
    },
    
    content: activity.notes,
    
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
    
    reactionCount: activity.reactionCount,
    commentCount: activity.commentCount,
    zapAmount: activity.zapAmount,
    
    hasPhotos: activity.photos.length > 0,
    hasTrack: !!activity.gpxData,
    images: activity.photos.map(url => ({ url })),
    
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
      <section className="flex items-center justify-center min-h-screen bg-stone-900" aria-labelledby="welcome-heading">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl flex items-center justify-center" aria-hidden="true">
            <span className="text-2xl">🏃‍♂️</span>
          </div>
          <h2 id="welcome-heading" className="text-2xl font-bold text-white mb-3">
            Welcome to TrailStr
          </h2>
          <p className="text-stone-400 mb-6">
            Sign in to see your activity feed and share your adventures
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/login" className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl h-12 px-6 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900">
              Sign In
            </a>
            <a href="/login?signup=1" className="w-full sm:w-auto border border-stone-600 text-stone-300 hover:bg-stone-800 font-semibold rounded-xl h-12 px-6 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900">
              Create Account
            </a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-stone-900 min-h-screen" aria-labelledby="feed-heading">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-stone-900/95 backdrop-blur-xl border-b border-stone-800 px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 id="feed-heading" className="text-2xl font-bold text-white">
              Feed
            </h1>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 border border-stone-600 text-stone-300 hover:bg-stone-800 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-expanded={showFilters}
                aria-controls="feed-filters"
                aria-label="Toggle feed filters"
              >
                <Filter size={16} aria-hidden="true" />
                <span>Filter</span>
              </button>
              
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-semibold rounded-xl px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={isRefreshing ? 'Refreshing feed' : 'Refresh feed'}
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          
          {/* Filters - inline on desktop, bottom sheet on mobile */}
          <div className="hidden md:block">
            {showFilters && (
              <div id="feed-filters" className="mt-4 pt-4 border-t border-stone-800" role="region" aria-label="Feed filters">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-3 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={followingOnly}
                      onChange={toggleFollowingOnly}
                      className="w-5 h-5 text-emerald-600 bg-stone-700 border-stone-600 rounded focus:ring-emerald-500 focus:ring-2"
                    />
                    <span className="text-sm text-stone-300">
                      Following only
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
          <BottomSheet isOpen={showFilters} onClose={() => setShowFilters(false)} title="Feed Filters" snapPoints={[0.35]}>
            <div className="md:hidden">
              <label className="flex items-center space-x-3 cursor-pointer min-h-[48px] active:bg-stone-700/50 rounded-xl px-3 -mx-3 transition-colors">
                <input
                  type="checkbox"
                  checked={followingOnly}
                  onChange={toggleFollowingOnly}
                  className="w-5 h-5 text-emerald-600 bg-stone-700 border-stone-600 rounded focus:ring-emerald-500 focus:ring-2"
                />
                <span className="text-base text-stone-300">
                  Following only
                </span>
              </label>
            </div>
          </BottomSheet>
        </header>

        {/* Error State */}
        {error && (
          <div className="px-4 py-4" role="alert">
            <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                onClick={() => fetchFeed(true)}
                className="text-sm font-medium text-red-400 hover:text-red-300 underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || isPtrRefreshing) && (
          <div
            className="flex justify-center items-center overflow-hidden transition-all"
            style={{ height: `${pullDistance}px` }}
            role="status"
            aria-label={isPtrRefreshing ? 'Refreshing' : 'Pull to refresh'}
          >
            <div className={`text-emerald-500 ${isPtrRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 3}deg)` }}>
              <RefreshCw size={22} />
            </div>
          </div>
        )}

        {/* Content */}
        <div ref={pullRefreshRef} className="px-4 py-6 overflow-y-auto overscroll-y-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Loading skeletons for initial load */}
          {isLoading && feedItems.length === 0 && (
            <div className="space-y-6" role="status" aria-label="Loading activities">
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
              <span className="sr-only">Loading activities...</span>
            </div>
          )}

          {/* Activity Cards */}
          {feedItems.length > 0 && (
            <div className="space-y-6" role="feed" aria-label="Activity feed" aria-busy={isLoading}>
              {feedItems.map((activity) => (
                <article key={activity.id} aria-label={activity.title}>
                  <ActivityCard activity={activity} />
                </article>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && feedItems.length === 0 && !error && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl flex items-center justify-center" aria-hidden="true">
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
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl h-12 px-6 inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Record Activity
              </button>
            </div>
          )}

          {/* Load more trigger */}
          {hasMore && feedItems.length > 0 && (
            <div ref={loadMoreRef} className="py-6">
              {isLoadingMore && (
                <div className="text-center" role="status">
                  <div className="inline-flex items-center space-x-2 text-sm text-stone-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500" aria-hidden="true"></div>
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
    </section>
  )
}
