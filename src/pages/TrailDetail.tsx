import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  MapPin, 
  Ruler, 
  Mountain, 
  Star, 
  Heart, 
  Share2, 
  ArrowLeft,
  Users,
  Camera,
  Calendar
} from 'lucide-react'
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useTrailStore } from '../stores/trailStore'
import { useAuthStore } from '../stores/authStore'
import BlurhashImage from '../components/common/BlurhashImage'
import PhotoGallery from '../components/activity/PhotoGallery'
import { ReactionBar } from '../components/social/ReactionBar'
import { CommentThread } from '../components/social/CommentThread'
import { ReviewForm } from '../components/trail/ReviewForm'
import { ReviewList } from '../components/trail/ReviewList'

export default function TrailDetail() {
  const { id } = useParams<{ id: string }>()
  const { currentTrail, currentTrailReviews, fetchTrailById, fetchTrailReviews, isLoadingTrail } = useTrailStore()
  const { isAuthenticated } = useAuthStore()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'activities'>('overview')
  const [isWishlisted, setIsWishlisted] = useState(false)

  useEffect(() => {
    if (id) {
      fetchTrailById(id)
      fetchTrailReviews(id)
    }
  }, [id, fetchTrailById, fetchTrailReviews])

  useEffect(() => {
    if (currentTrail && mapContainer.current && !map.current) {
      const coordinates = currentTrail.startCoordinates || [0, 0]
      
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [coordinates[0], coordinates[1]],
        zoom: 13
      })

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

      new maplibregl.Marker({ color: '#22c55e' })
        .setLngLat([coordinates[0], coordinates[1]])
        .addTo(map.current)

      if (currentTrail.routeData) {
        console.log('Route data available for visualization:', currentTrail.routeData)
      }
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [currentTrail])

  const formatDistance = (meters: number): string => {
    const km = meters / 1000
    return km < 1 ? `${meters}m` : `${km.toFixed(1)}km`
  }

  const formatElevation = (meters: number): string => {
    return `${meters}m`
  }

  const handleWishlistToggle = () => {
    setIsWishlisted(!isWishlisted)
  }

  const handleShare = async () => {
    if (navigator.share && currentTrail) {
      try {
        await navigator.share({
          title: currentTrail.name,
          text: currentTrail.summary,
          url: window.location.href
        })
      } catch (error) {
        navigator.clipboard.writeText(window.location.href)
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  if (isLoadingTrail) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900">
        <div className="animate-pulse">
          <div className="h-64 bg-stone-300 dark:bg-stone-700"></div>
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            <div className="h-8 bg-stone-300 dark:bg-stone-700 rounded w-3/4"></div>
            <div className="h-4 bg-stone-300 dark:bg-stone-700 rounded w-1/2"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-stone-300 dark:bg-stone-700 rounded"></div>
              <div className="h-16 bg-stone-300 dark:bg-stone-700 rounded"></div>
              <div className="h-16 bg-stone-300 dark:bg-stone-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentTrail) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center">
        <div className="text-center">
          <Mountain className="mx-auto mb-4 text-stone-400 dark:text-stone-600" size={48} />
          <h2 className="text-xl font-semibold text-stone-700 dark:text-stone-300 mb-2">Trail not found</h2>
          <p className="text-stone-500 dark:text-stone-400 mb-4">The trail you're looking for doesn't exist or has been removed.</p>
          <Link
            to="/trail-explorer"
            className="inline-flex items-center px-4 py-2 bg-forest-500 text-white rounded-md hover:bg-forest-600"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Explorer
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-900">
      {/* Hero Image */}
      <div className="relative h-80 bg-gradient-to-br from-emerald-600 to-emerald-800">
        {currentTrail.heroPhoto ? (
          <BlurhashImage
            src={currentTrail.heroPhoto}
            blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
            alt={currentTrail.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mountain className="text-white/20" size={80} />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
        
        <Link
          to="/trail-explorer"
          className="absolute top-6 left-6 p-3 bg-stone-900/50 backdrop-blur-sm text-white rounded-full hover:bg-stone-900/70 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        
        <div className="absolute top-6 right-6 flex space-x-3">
          {isAuthenticated && (
            <button
              onClick={handleWishlistToggle}
              className={`p-3 backdrop-blur-sm rounded-full transition-colors ${
                isWishlisted 
                  ? 'bg-red-500 text-white' 
                  : 'bg-stone-900/50 text-white hover:bg-stone-900/70'
              }`}
            >
              <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            onClick={handleShare}
            className="p-3 bg-stone-900/50 backdrop-blur-sm text-white rounded-full hover:bg-stone-900/70 transition-colors"
          >
            <Share2 size={20} />
          </button>
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <h1 className="text-3xl font-bold text-white mb-2">{currentTrail.name}</h1>
          <div className="flex items-center space-x-4 text-white/90">
            <div className="flex items-center">
              <MapPin size={16} className="mr-2" />
              <span className="text-sm">{currentTrail.location}</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              currentTrail.difficulty === 'easy' ? 'bg-emerald-500' :
              currentTrail.difficulty === 'moderate' ? 'bg-amber-500' :
              currentTrail.difficulty === 'hard' ? 'bg-orange-500' :
              'bg-red-500'
            }`}>
              {currentTrail.difficulty}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4">
        {/* Stats Grid */}
        <div className="flex gap-4 overflow-x-auto pb-6 mb-8 -mt-10 relative z-10">
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-center min-w-[140px] flex-shrink-0">
            <Ruler className="mx-auto mb-3 text-emerald-500" size={24} />
            <div className="text-xl font-bold text-white">{formatDistance(currentTrail.distance * 1000)}</div>
            <div className="text-sm text-stone-400">Distance</div>
          </div>
          
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-center min-w-[140px] flex-shrink-0">
            <Mountain className="mx-auto mb-3 text-emerald-500" size={24} />
            <div className="text-xl font-bold text-white">{formatElevation(currentTrail.elevationGain)}</div>
            <div className="text-sm text-stone-400">Elevation Gain</div>
          </div>
          
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-center min-w-[140px] flex-shrink-0">
            <Star className="mx-auto mb-3 text-emerald-500" size={24} />
            <div className="text-xl font-bold text-white">{currentTrail.averageRating.toFixed(1)}</div>
            <div className="text-sm text-stone-400">Rating</div>
          </div>
          
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6 text-center min-w-[140px] flex-shrink-0">
            <Users className="mx-auto mb-3 text-emerald-500" size={24} />
            <div className="text-xl font-bold text-white">{currentTrail.reviewCount}</div>
            <div className="text-sm text-stone-400">Reviews</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8 border-b border-stone-700/50">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'reviews', label: `Reviews (${currentTrail.reviewCount})` },
              { id: 'activities', label: `Activities (${currentTrail.activityCount})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent text-stone-400 hover:text-stone-300 hover:border-stone-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {currentTrail.summary && (
              <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
                <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3">About This Trail</h3>
                <p className="text-stone-300 leading-relaxed">{currentTrail.summary}</p>
              </div>
            )}

            <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
              <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3">Map & Route</h3>
              <div className="h-64 rounded-xl overflow-hidden border border-stone-700/50">
                <div ref={mapContainer} className="w-full h-full" />
              </div>
            </div>

            {currentTrail.photos && currentTrail.photos.length > 0 && (
              <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
                <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-3 flex items-center">
                  <Camera className="mr-2" size={16} />
                  Photos ({currentTrail.photos.length})
                </h3>
                <PhotoGallery images={currentTrail.photos.map(url => ({ url }))} />
              </div>
            )}

            <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
              <ReactionBar eventId={currentTrail.id} authorPubkey={currentTrail.authorPubkey} />
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <ReviewForm
              trailAuthorPubkey={currentTrail.authorPubkey}
              trailSlug={currentTrail.dTag}
              onSubmit={() => {
                fetchTrailReviews(currentTrail.id)
              }}
            />

            <ReviewList
              reviews={currentTrailReviews.map(review => ({
                id: review.id,
                authorPubkey: review.authorPubkey,
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
                hikedOn: review.hikedOn,
                conditions: review.conditions,
                images: review.images
              }))}
              hasMore={false}
              isLoading={false}
            />
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="bg-stone-800/50 border border-stone-700/50 rounded-2xl p-8 text-center">
            <Calendar className="mx-auto mb-4 text-stone-600" size={48} />
            <h3 className="text-lg font-medium text-stone-300 mb-2">No activities yet</h3>
            <p className="text-stone-500 mb-4">Activities on this trail will appear here.</p>
          </div>
        )}

        {/* Comments */}
        <div className="mt-8 bg-stone-800/50 border border-stone-700/50 rounded-2xl p-6">
          <h3 className="text-xs font-semibold tracking-wider text-stone-400 uppercase mb-4">Comments</h3>
          <CommentThread eventId={currentTrail.id} authorPubkey={currentTrail.authorPubkey} />
        </div>
      </div>
    </div>
  )
}
